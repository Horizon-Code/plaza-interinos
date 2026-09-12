import { Injectable, Logger } from '@nestjs/common';
import { corregirMinutosRuta } from '@plazainterinos/core';
import { PrismaService } from '../prisma/prisma.service';

export interface Punto {
  lat: number;
  lng: number;
}

/**
 * Trayecto real por carretera, en un solo sentido. Los kilómetros son los que
 * da el router; los minutos van ya corregidos por `corregirMinutosRuta`, porque
 * el tiempo a velocidad libre de OSRM no es el que tarda nadie de verdad.
 */
export interface Ruta {
  km: number;
  minutos: number;
}

/**
 * Servidor de rutas OSRM. El público de demostración no pide clave ni cuesta
 * dinero; con `OSRM_URL` se puede apuntar a una instancia propia sin tocar
 * código (es lo recomendable en producción: el público no da garantías).
 */
const OSRM_POR_DEFECTO = 'https://router.project-osrm.org';

/** El servidor público admite 100 coordenadas por tabla; el origen ocupa una. */
const DESTINOS_POR_TANDA = 95;

/** Cortesía con el servidor público entre tandas. */
const ESPERA_ENTRE_TANDAS_MS = 350;

const TIMEOUT_MS = 20_000;

/** Cinco decimales ≈ 1 m: suficiente para identificar un centro y cachearlo. */
export function clavePunto(p: Punto): string {
  return `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
}

export function puntoValido(p: Punto): boolean {
  return Number.isFinite(p.lat) && Math.abs(p.lat) <= 90 &&
    Number.isFinite(p.lng) && Math.abs(p.lng) <= 180;
}

interface RespuestaTabla {
  code: string;
  /** Metros, una fila por origen. */
  distances?: (number | null)[][];
  /** Segundos, una fila por origen. */
  durations?: (number | null)[][];
}

/**
 * Trayectos reales casa → centro (punto 3 de SCRUM-22).
 *
 * Antes los minutos y los kilómetros salían de `HaversineEstimator`: línea
 * recta × 1,3 a 55 km/h medios. Es un número inventado — en Aragón, con puertos
 * y carreteras comarcales, se desvía fácil un 40 % — y sobre él se decidía qué
 * vacantes entraban. Aquí se pide la ruta de verdad al servicio `table` de
 * OSRM, que devuelve duración y distancia por carretera de un origen a muchos
 * destinos en una sola petición.
 *
 * Si el servicio falla, el par se queda sin ruta a propósito: la vacante saldrá
 * como "distancia sin calcular" y a revisión manual. Una distancia falsa es
 * peor que ninguna, igual que con las coordenadas en `geolocalizar.ts`.
 */
@Injectable()
export class RutasService {
  private readonly logger = new Logger(RutasService.name);

  /**
   * Primer nivel, por proceso: evita ir a la base de datos dos veces por el
   * mismo centro dentro de una misma pantalla. `null` = OSRM dice que no hay
   * ruta posible, y eso también se recuerda para no volver a preguntarlo.
   */
  private readonly cache = new Map<string, Ruta | null>();

  constructor(private readonly prisma: PrismaService) {}

  private get servidor(): string {
    return (process.env['OSRM_URL'] ?? OSRM_POR_DEFECTO).replace(/\/+$/, '');
  }

  /**
   * Metros y segundos del router a lo que enseña la aplicación. La corrección
   * de los minutos se aplica aquí, al salir, y nunca antes de guardar en caché.
   */
  private aRuta(metros: number, segundos: number): Ruta {
    return {
      km: metros === 0 ? 0 : Math.max(0.1, Math.round(metros / 100) / 10),
      minutos: segundos === 0 ? 0 : Math.max(1, Math.round(corregirMinutosRuta(segundos / 60)))
    };
  }

  /**
   * Rutas desde un origen a muchos destinos. La clave del mapa devuelto es
   * `clavePunto(destino)`; los destinos que no se hayan podido calcular
   * simplemente no aparecen.
   */
  async calcular(origen: Punto, destinos: Punto[]): Promise<Map<string, Ruta>> {
    const resultado = new Map<string, Ruta>();
    if (!puntoValido(origen)) return resultado;

    // Muchas vacantes comparten centro: se pide cada coordenada una sola vez.
    const unicos = new Map<string, Punto>();
    for (const d of destinos) {
      if (puntoValido(d)) unicos.set(clavePunto(d), d);
    }

    const claveOrigen = clavePunto(origen);
    const pendientes: Punto[] = [];
    for (const [clave, punto] of unicos) {
      const cacheado = this.cache.get(`${claveOrigen}>${clave}`);
      if (cacheado === undefined) pendientes.push(punto);
      else if (cacheado !== null) resultado.set(clave, cacheado);
    }
    if (!pendientes.length) return resultado;

    // Segundo nivel: lo que ya se preguntó alguna vez, en cualquier sesión y
    // por cualquier usuario. Los centros se repiten muchísimo entre personas,
    // así que a partir del primer usuario de una zona esto se lleva casi todo.
    const porPreguntar = await this.rescatarDeBd(claveOrigen, pendientes, resultado);
    if (!porPreguntar.length) return resultado;

    for (let i = 0; i < porPreguntar.length; i += DESTINOS_POR_TANDA) {
      const tanda = porPreguntar.slice(i, i + DESTINOS_POR_TANDA);
      if (i > 0) await new Promise(r => setTimeout(r, ESPERA_ENTRE_TANDAS_MS));
      const crudas = await this.pedirTabla(origen, tanda);
      if (!crudas) continue; // Fallo de red o del servidor: sin ruta, sin invento.
      const paraGuardar: { origen: string; destino: string; metros: number; segundos: number }[] = [];
      tanda.forEach((destino, j) => {
        const clave = clavePunto(destino);
        const cruda = crudas[j];
        const ruta = cruda ? this.aRuta(cruda.metros, cruda.segundos) : null;
        this.cache.set(`${claveOrigen}>${clave}`, ruta);
        if (ruta && cruda) {
          resultado.set(clave, ruta);
          paraGuardar.push({ origen: claveOrigen, destino: clave, ...cruda });
        }
      });
      await this.guardarEnBd(paraGuardar);
    }
    return resultado;
  }

  /**
   * Saca de la base de datos las rutas que ya conocemos y devuelve las que
   * siguen haciendo falta. Un fallo aquí no puede tumbar la pantalla: si la
   * caché no responde se pregunta al router, que es justo lo que hacíamos antes.
   */
  private async rescatarDeBd(
    claveOrigen: string, pendientes: Punto[], resultado: Map<string, Ruta>
  ): Promise<Punto[]> {
    const claves = pendientes.map(clavePunto);
    let filas: { destino: string; metros: number; segundos: number }[] = [];
    try {
      filas = await this.prisma.rutaCache.findMany({
        where: { origen: claveOrigen, destino: { in: claves } },
        select: { destino: true, metros: true, segundos: true }
      });
    } catch (error) {
      this.logger.warn(`No se ha podido leer la caché de rutas: ${error instanceof Error ? error.message : error}`);
      return pendientes;
    }
    const guardadas = new Map(filas.map(f => [f.destino, f]));
    const faltan: Punto[] = [];
    for (const punto of pendientes) {
      const clave = clavePunto(punto);
      const fila = guardadas.get(clave);
      if (!fila) { faltan.push(punto); continue; }
      const ruta = this.aRuta(fila.metros, fila.segundos);
      this.cache.set(`${claveOrigen}>${clave}`, ruta);
      resultado.set(clave, ruta);
    }
    return faltan;
  }

  /** Guardar es mejor esfuerzo: si falla, se ha perdido una caché, no una ruta. */
  private async guardarEnBd(
    filas: { origen: string; destino: string; metros: number; segundos: number }[]
  ): Promise<void> {
    if (!filas.length) return;
    try {
      // `skipDuplicates` porque dos usuarios pueden pedir el mismo par a la vez.
      await this.prisma.rutaCache.createMany({ data: filas, skipDuplicates: true });
    } catch (error) {
      this.logger.warn(`No se ha podido guardar la caché de rutas: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Una petición `table` de OSRM: un origen, hasta 95 destinos. Devuelve los
   * metros y segundos tal cual, sin corregir: así es como se guardan en caché.
   */
  private async pedirTabla(
    origen: Punto, destinos: Punto[]
  ): Promise<({ metros: number; segundos: number } | null)[] | null> {
    // OSRM espera lon,lat separadas por punto y coma, con el origen el primero.
    const coordenadas = [origen, ...destinos].map(p => `${p.lng},${p.lat}`).join(';');
    // Sin destinations, OSRM incluye la columna casa → casa y desplaza todas
    // las rutas un puesto. Pedimos solo centros, en el orden de esta tanda.
    const indices = destinos.map((_, i) => i + 1).join(';');
    const url =
      `${this.servidor}/table/v1/driving/${coordenadas}` +
      `?sources=0&destinations=${indices}&annotations=duration,distance&skip_waypoints=true`;

    let datos: RespuestaTabla;
    try {
      const respuesta = await fetch(url, {
        headers: { 'User-Agent': 'PlazaInterinos/0.1 (+https://github.com/Horizon-Code/plaza-interinos)' },
        signal: AbortSignal.timeout(TIMEOUT_MS)
      });
      if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
      datos = (await respuesta.json()) as RespuestaTabla;
    } catch (error) {
      this.logger.warn(
        `No se han podido calcular ${destinos.length} rutas: ${error instanceof Error ? error.message : error}`
      );
      return null;
    }

    const metros = datos.distances?.[0];
    const segundos = datos.durations?.[0];
    if (datos.code !== 'Ok' || !Array.isArray(metros) || !Array.isArray(segundos) ||
        metros.length !== destinos.length || segundos.length !== destinos.length) {
      this.logger.warn(`Respuesta de rutas inservible (code=${datos.code}, sin distancias o duraciones).`);
      return null;
    }

    return destinos.map((_, j) => {
      const m = metros[j];
      const s = segundos[j];
      if (m == null || s == null || !Number.isFinite(m) || !Number.isFinite(s) || m < 0 || s < 0) return null;
      return { metros: Math.round(m), segundos: Math.round(s) };
    });
  }
}
