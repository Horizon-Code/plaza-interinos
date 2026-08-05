import { Injectable, computed, effect, signal } from '@angular/core';
import {
  ORDEN_POR_DEFECTO,
  claveEspecialidad,
  type CriterioConfigurado,
  type OrdenPorEspecialidad
} from '@plazainterinos/core';
import type { Geocodificado } from './estado.service';

export type Modo = 'minutes' | 'km';

/** "De A a B de trayecto me compensa una jornada de entre C% y D%." */
export interface Banda {
  desde: number;
  hasta: number;
  minJornada: number;
  maxJornada: number;
}

export interface Coche {
  fuelType: 'diesel' | 'gasolina';
  consumo: number;
  precio: number;
  precioOficial: number | null;
}

/** Tope de cada escala: 2 h de coche, 200 km. */
export const ESCALA: Record<Modo, number> = { minutes: 120, km: 200 };

/** Códigos de idioma reales (excluye el "bilingüe sin especificar"). */
const IDIOMAS = new Set(['en', 'fr', 'ca']);

const CLAVE = 'pi_configuracion';
const VERSION = 1;

interface Guardado {
  version: number;
  data: Record<string, unknown>;
}

/**
 * Todo lo que el docente configura a lo largo de los seis pasos, en un solo
 * sitio y persistido en localStorage.
 *
 * Vive fuera de los componentes por dos razones: perfil, filtros y orden son
 * ahora pasos distintos que comparten datos, y un refresco de página no puede
 * borrar veinte minutos de trabajo (punto 4). El esquema va versionado para
 * poder migrarlo sin romper lo ya guardado.
 */
@Injectable({ providedIn: 'root' })
export class ConfiguracionService {
  // ── Paso 2 · Perfil ────────────────────────────────────────────────────
  readonly especialidadesIncluidas = signal<string[]>([]);
  readonly direccion = signal('');
  readonly ubicacion = signal<Geocodificado | null>(null);
  readonly modo = signal<Modo>('minutes');
  readonly maxPorModo = signal<Record<Modo, number | null>>({ minutes: 45, km: 60 });
  readonly coche = signal<Coche | null>(null);
  /** Cada unidad guarda sus propias bandas: 30 min no es lo mismo que 30 km. */
  readonly bandasPorModo = signal<Record<Modo, Banda[]>>({
    minutes: [
      { desde: 0, hasta: 20, minJornada: 0, maxJornada: 100 },
      { desde: 20, hasta: 45, minJornada: 50, maxJornada: 100 }
    ],
    km: [
      { desde: 0, hasta: 25, minJornada: 0, maxJornada: 100 },
      { desde: 25, hasta: 60, minJornada: 50, maxJornada: 100 }
    ]
  });

  // ── Paso 3 · Filtrar ───────────────────────────────────────────────────
  readonly voluntarias = signal(true);
  readonly acepta = signal<Record<string, boolean>>({});
  readonly trayectoCondicion = signal<Record<string, number | null>>({});
  readonly municipiosExcluidos = signal<string[]>([]);
  /** Códigos de centro de 8 dígitos: el nombre no es identificador estable. */
  readonly centrosExcluidos = signal<string[]>([]);

  // ── Paso 4 · Ordenar ───────────────────────────────────────────────────
  readonly cascada = signal<CriterioConfigurado[]>([...ORDEN_POR_DEFECTO]);

  /** Paso más lejano alcanzado: solo se puede volver atrás, nunca saltar hacia delante. */
  readonly pasoMaximo = signal(1);

  readonly bandas = computed(() => this.bandasPorModo()[this.modo()]);
  readonly escala = computed(() => ESCALA[this.modo()]);
  readonly maxActual = computed(() => this.maxPorModo()[this.modo()]);
  readonly unidad = computed(() => (this.modo() === 'km' ? 'km' : 'min'));

  constructor() {
    this.rehidratar();
    // Un efecto basta: cualquier señal leída aquí dispara el guardado.
    effect(() => this.guardar());
  }

  alcanzarPaso(n: number): void {
    if (n > this.pasoMaximo()) this.pasoMaximo.set(n);
  }

  /** Coste diario ida y vuelta, misma fórmula que `dailyTravelCostEur` del core. */
  costeDiario(km: number): string {
    const c = this.coche();
    if (!c) return '—';
    return (Math.round(km * 2 * (c.consumo / 100) * c.precio * 100) / 100).toFixed(2);
  }

  /**
   * Descarta todo lo configurado y vuelve al estado inicial. Recarga a propósito:
   * es la forma más honesta de garantizar que no queda nada rehidratado en memoria.
   */
  empezarDeCero(): void {
    localStorage.removeItem(CLAVE);
    localStorage.removeItem('pi_convocatoria');
    location.href = '/importar';
  }

  // ── Persistencia ───────────────────────────────────────────────────────
  private guardar(): void {
    const data = {
      especialidadesIncluidas: this.especialidadesIncluidas(),
      direccion: this.direccion(),
      ubicacion: this.ubicacion(),
      modo: this.modo(),
      maxPorModo: this.maxPorModo(),
      coche: this.coche(),
      bandasPorModo: this.bandasPorModo(),
      voluntarias: this.voluntarias(),
      acepta: this.acepta(),
      trayectoCondicion: this.trayectoCondicion(),
      municipiosExcluidos: this.municipiosExcluidos(),
      centrosExcluidos: this.centrosExcluidos(),
      cascada: this.cascada(),
      pasoMaximo: this.pasoMaximo()
    };
    try {
      localStorage.setItem(CLAVE, JSON.stringify({ version: VERSION, data } satisfies Guardado));
    } catch {
      // Cuota llena o almacenamiento bloqueado: la app sigue, solo pierde la persistencia.
    }
  }

  private rehidratar(): void {
    let guardado: Guardado | null = null;
    try {
      guardado = JSON.parse(localStorage.getItem(CLAVE) ?? 'null');
    } catch {
      guardado = null;
    }
    // Un esquema de otra versión se ignora en vez de romper: mejor empezar de
    // cero que rehidratar con una forma que ya no encaja.
    if (!guardado || guardado.version !== VERSION) return;
    const d = guardado.data;
    const leer = <T>(clave: string, destino: { set(v: T): void }) => {
      if (d[clave] !== undefined && d[clave] !== null) destino.set(d[clave] as T);
    };
    leer('especialidadesIncluidas', this.especialidadesIncluidas);
    leer('direccion', this.direccion);
    leer('ubicacion', this.ubicacion);
    leer('modo', this.modo);
    leer('maxPorModo', this.maxPorModo);
    leer('coche', this.coche);
    leer('bandasPorModo', this.bandasPorModo);
    leer('voluntarias', this.voluntarias);
    leer('acepta', this.acepta);
    leer('trayectoCondicion', this.trayectoCondicion);
    leer('municipiosExcluidos', this.municipiosExcluidos);
    leer('centrosExcluidos', this.centrosExcluidos);
    leer('cascada', this.cascada);
    leer('pasoMaximo', this.pasoMaximo);
  }

  // ── Traducción al perfil que entiende el core ──────────────────────────
  /** Número de orden del aspirante por especialidad, para el criterio de orden. */
  ordenPorEspecialidad(especialidades: { bodyCode: string; specialtyCode: string; orden?: number }[]): OrdenPorEspecialidad {
    const mapa: OrdenPorEspecialidad = {};
    for (const e of especialidades) {
      const clave = claveEspecialidad(e.bodyCode, e.specialtyCode);
      const actual = mapa[clave];
      // Si una vacante vale para dos especialidades suyas, manda el mejor número.
      if (e.orden != null && (actual == null || e.orden < actual)) mapa[clave] = e.orden;
    }
    return mapa;
  }

  construirPerfil(
    especialidades: { bodyCode: string; bodyName?: string; specialtyCode: string; specialtyName?: string; orden?: number }[],
    condicionesDetectadas: { tag: string; category: string }[]
  ): Record<string, unknown> {
    const modo = this.modo();
    const acepta = this.acepta();

    // Sin plazas voluntarias no queda nada que filtrar por condiciones: solo
    // entran obligatorias, y sus condiciones no descartan (las acepta el core).
    const conditionAccepts: Record<string, boolean> = {};
    for (const c of condicionesDetectadas) {
      conditionAccepts[c.tag] = this.voluntarias() ? acepta[c.tag] === true : true;
    }

    const limite = (n: number) => (modo === 'km' ? { maxKm: n } : { maxMinutes: n });
    const conditionTravelLimits: Record<string, { maxMinutes?: number; maxKm?: number }> = {};
    for (const [tag, n] of Object.entries(this.trayectoCondicion())) {
      if (conditionAccepts[tag] && n != null && n > 0) conditionTravelLimits[tag] = limite(+n);
    }

    const travelWorkloadBands = this.bandas()
      .filter(b => b.hasta > b.desde)
      .map(b => ({
        fromTravel: b.desde,
        toTravel: b.hasta,
        minWorkload: b.minJornada / 100,
        maxWorkload: b.maxJornada / 100
      }));

    // Campos legados derivados de las decisiones dinámicas (reglas existentes).
    const acceptedLanguages = condicionesDetectadas
      .filter(c => c.category === 'language' && IDIOMAS.has(c.tag) && conditionAccepts[c.tag])
      .map(c => c.tag);
    const excludedPrograms = condicionesDetectadas
      .filter(c => c.category === 'program' && !conditionAccepts[c.tag])
      .map(c => c.tag);

    const incluidas = new Set(this.especialidadesIncluidas());
    const specialties = especialidades
      .filter(e => incluidas.has(claveEspecialidad(e.bodyCode, e.specialtyCode)))
      .map(e => ({ bodyCode: e.bodyCode, specialtyCode: e.specialtyCode, blockOrder: e.orden }));

    const maximo = this.maxActual();
    const coche = this.coche();
    return {
      id: 'perfil-local',
      name: 'Mi perfil',
      homeLocation: {
        address: this.direccion() || undefined,
        latitude: this.ubicacion()?.lat,
        longitude: this.ubicacion()?.lng
      },
      specialties,
      travelMode: modo,
      maxDistanceKm: modo === 'km' ? maximo ?? undefined : undefined,
      maxTravelMinutes: modo === 'minutes' ? maximo ?? undefined : undefined,
      // Las bandas sustituyen a los tramos: la distancia decide la jornada.
      workloadTravelTiers: [],
      travelWorkloadBands,
      conditionAccepts,
      conditionTravelLimits,
      car: coche
        ? {
            fuelType: coche.fuelType,
            consumptionLper100: coche.consumo,
            // Solo fijamos el precio si el usuario cambió el oficial del día.
            fuelPricePerLiter: coche.precio !== coche.precioOficial ? coche.precio : undefined
          }
        : undefined,
      // La jornada ya no tiene un mínimo global: siempre depende del trayecto.
      acceptsPartialWorkload: true,
      minimumWorkload: undefined,
      acceptsVoluntary: this.voluntarias(),
      acceptsAfternoon: conditionAccepts['afternoon'] ?? false,
      acceptsItinerant: conditionAccepts['itinerant'] ?? false,
      acceptsBilingual: acceptedLanguages.length > 0,
      acceptsLongTerm: conditionAccepts['long_term'] ?? true,
      acceptedLanguages,
      excludedPrograms,
      excludedTags: [],
      preferredMunicipalities: [],
      excludedMunicipalities: this.municipiosExcluidos(),
      preferredCenters: [],
      excludedCenters: this.centrosExcluidos()
    };
  }
}
