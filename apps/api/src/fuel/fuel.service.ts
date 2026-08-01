import { Injectable, Logger } from '@nestjs/common';

export interface FuelPrices {
  /** €/litro medio de Gasóleo A. */
  diesel: number;
  /** €/litro medio de Gasolina 95 E5. */
  gasolina: number;
  /** true si son los valores de reserva (la fuente oficial no respondió). */
  fallback: boolean;
  updatedAt: string;
}

/** Valores de reserva si la fuente oficial no responde (aprox. mercado 2026). */
const PRECIOS_RESERVA = { diesel: 1.45, gasolina: 1.55 };

const URL_MINETUR =
  'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/FiltroCCAA/02'; // 02 = Aragón

const CACHE_MS = 24 * 60 * 60 * 1000;

/**
 * Precios medios de combustible en Aragón según el geoportal oficial del
 * Ministerio (datos de todas las gasolineras, decimales con coma). Caché de
 * 24 h en memoria; si la fuente falla, valores de reserva editables en la UI.
 */
@Injectable()
export class FuelService {
  private readonly logger = new Logger(FuelService.name);
  private cache: FuelPrices | null = null;

  async prices(): Promise<FuelPrices> {
    if (this.cache && Date.now() - Date.parse(this.cache.updatedAt) < CACHE_MS && !this.cache.fallback) {
      return this.cache;
    }
    try {
      const respuesta = await fetch(URL_MINETUR, { signal: AbortSignal.timeout(15_000) });
      if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
      const datos = (await respuesta.json()) as {
        ListaEESSPrecio: { 'Precio Gasoleo A': string; 'Precio Gasolina 95 E5': string }[];
      };
      const diesel = this.media(datos.ListaEESSPrecio.map(e => e['Precio Gasoleo A']));
      const gasolina = this.media(datos.ListaEESSPrecio.map(e => e['Precio Gasolina 95 E5']));
      this.cache = {
        diesel: diesel ?? PRECIOS_RESERVA.diesel,
        gasolina: gasolina ?? PRECIOS_RESERVA.gasolina,
        fallback: diesel == null && gasolina == null,
        updatedAt: new Date().toISOString()
      };
    } catch (error) {
      this.logger.warn(`Fuente de precios no disponible: ${error}. Usando valores de reserva.`);
      this.cache = { ...PRECIOS_RESERVA, fallback: true, updatedAt: new Date().toISOString() };
    }
    return this.cache;
  }

  /** Media de precios "1,459" (coma decimal), ignorando vacíos. */
  private media(valores: string[]): number | undefined {
    const numeros = valores
      .map(v => Number((v ?? '').replace(',', '.')))
      .filter(n => Number.isFinite(n) && n > 0);
    if (!numeros.length) return undefined;
    return Math.round((numeros.reduce((a, b) => a + b, 0) / numeros.length) * 1000) / 1000;
  }
}
