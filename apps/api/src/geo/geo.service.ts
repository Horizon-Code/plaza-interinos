import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { puntoValido } from './rutas.service';
import { PrismaService } from '../prisma/prisma.service';

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

/**
 * Geocodificación vía Nominatim (OpenStreetMap). Se hace en el servidor para
 * cumplir su política de uso: User-Agent identificable y máximo una petición
 * por segundo.
 *
 * Ese límite de una por segundo es el motivo de que las respuestas se guarden
 * en la base de datos y no solo en memoria: con varios usuarios a la vez la
 * cola se hace insoportable y, si se incumple, Nominatim bloquea la IP entera.
 * Una dirección resuelta no cambia, así que se pregunta una vez y ya.
 */
@Injectable()
export class GeoService {
  /** Primer nivel, por proceso. El segundo es `GeocodeCache` en la base. */
  private readonly cache = new Map<string, GeocodeResult>();
  private lastRequestAt = 0;

  constructor(private readonly prisma: PrismaService) {}

  /** Un fallo de caché nunca puede impedir geocodificar: se sigue sin ella. */
  private async desdeBd(clave: string): Promise<GeocodeResult | undefined> {
    try {
      const fila = await this.prisma.geocodeCache.findUnique({ where: { consulta: clave } });
      if (!fila) return undefined;
      const resultado = { lat: fila.lat, lng: fila.lng, displayName: fila.etiqueta };
      this.cache.set(clave, resultado);
      return resultado;
    } catch {
      return undefined;
    }
  }

  private async guardarEnBd(clave: string, r: GeocodeResult): Promise<void> {
    try {
      await this.prisma.geocodeCache.upsert({
        where: { consulta: clave },
        create: { consulta: clave, lat: r.lat, lng: r.lng, etiqueta: r.displayName },
        update: {}
      });
    } catch {
      // Se ha perdido una entrada de caché, no una dirección.
    }
  }

  async geocode(query: string): Promise<GeocodeResult> {
    const clave = query.trim().toLowerCase();
    const cacheado = this.cache.get(clave) ?? await this.desdeBd(clave);
    if (cacheado) return cacheado;

    await this.respetarRateLimit();

    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '1');
    url.searchParams.set('countrycodes', 'es');

    let respuesta: Response;
    try {
      respuesta = await fetch(url, {
        headers: { 'User-Agent': 'PlazaInterinos/0.1 (contacto: saritaylucas00@gmail.com)' },
        signal: AbortSignal.timeout(10_000)
      });
    } catch {
      throw new ServiceUnavailableException('El servicio de geocodificación no responde. Prueba de nuevo en unos segundos.');
    }
    if (!respuesta.ok) {
      throw new ServiceUnavailableException('El servicio de geocodificación ha fallado.');
    }
    const datos = (await respuesta.json()) as { lat: string; lon: string; display_name: string }[];
    if (!datos.length) {
      throw new NotFoundException('Dirección no encontrada. Prueba con "calle, municipio" o solo el municipio.');
    }
    const resultado: GeocodeResult = {
      lat: Number(datos[0].lat),
      lng: Number(datos[0].lon),
      displayName: datos[0].display_name
    };
    if (!datos[0].lat?.trim() || !datos[0].lon?.trim() || !puntoValido(resultado)) {
      throw new ServiceUnavailableException('El servicio de geocodificación ha devuelto una ubicación inválida.');
    }
    this.cache.set(clave, resultado);
    await this.guardarEnBd(clave, resultado);
    return resultado;
  }

  /**
   * Geocodificación inversa: de las coordenadas que da `navigator.geolocation`
   * a una dirección legible. Misma política de uso que `geocode`.
   */
  async reverse(lat: number, lng: number): Promise<GeocodeResult> {
    const clave = `rev:${lat.toFixed(5)},${lng.toFixed(5)}`;
    const cacheado = this.cache.get(clave) ?? await this.desdeBd(clave);
    if (cacheado) return cacheado;

    await this.respetarRateLimit();

    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lng));
    url.searchParams.set('format', 'json');
    url.searchParams.set('zoom', '18');

    let respuesta: Response;
    try {
      respuesta = await fetch(url, {
        headers: { 'User-Agent': 'PlazaInterinos/0.1 (contacto: saritaylucas00@gmail.com)' },
        signal: AbortSignal.timeout(10_000)
      });
    } catch {
      throw new ServiceUnavailableException('El servicio de geocodificación no responde. Prueba de nuevo en unos segundos.');
    }
    if (!respuesta.ok) {
      throw new ServiceUnavailableException('El servicio de geocodificación ha fallado.');
    }
    const datos = (await respuesta.json()) as { display_name?: string; error?: string };
    if (!datos.display_name) {
      throw new NotFoundException('No hemos podido poner nombre a esa ubicación. Escribe la dirección a mano.');
    }
    // Las coordenadas mandan: son las del GPS, no las que Nominatim redondee.
    const resultado: GeocodeResult = { lat, lng, displayName: datos.display_name };
    this.cache.set(clave, resultado);
    await this.guardarEnBd(clave, resultado);
    return resultado;
  }

  private async respetarRateLimit(): Promise<void> {
    const ahora = Date.now();
    const espera = Math.max(0, this.lastRequestAt + 1100 - ahora);
    this.lastRequestAt = ahora + espera;
    if (espera > 0) await new Promise(r => setTimeout(r, espera));
  }
}
