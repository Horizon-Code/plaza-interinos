import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

/**
 * Geocodificación vía Nominatim (OpenStreetMap). Se hace en el servidor para
 * cumplir su política de uso: User-Agent identificable, máximo 1 petición por
 * segundo (cola simple) y caché en memoria por consulta.
 */
@Injectable()
export class GeoService {
  private readonly cache = new Map<string, GeocodeResult>();
  private lastRequestAt = 0;

  async geocode(query: string): Promise<GeocodeResult> {
    const clave = query.trim().toLowerCase();
    const cacheado = this.cache.get(clave);
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
    this.cache.set(clave, resultado);
    return resultado;
  }

  private async respetarRateLimit(): Promise<void> {
    const ahora = Date.now();
    const espera = Math.max(0, this.lastRequestAt + 1100 - ahora);
    this.lastRequestAt = ahora + espera;
    if (espera > 0) await new Promise(r => setTimeout(r, espera));
  }
}
