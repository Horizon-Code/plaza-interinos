import { etiquetasDeVacante, OTRAS_CONDICIONES } from './etiquetas.js';
import type { VacancyRequirement, TravelMode } from './models.js';
import { provinciaDeCentro } from './provincia.js';

/**
 * Orden en cascada (punto 7 de la especificación).
 *
 * El docente prioriza cuatro criterios de 1 a 4, sin empates: el criterio N
 * desempata al N-1. Es un comparador multinivel, no una suma de pesos, para
 * que la promesa de la pantalla ("arriba manda") se cumpla literalmente.
 *
 * Se aplica DENTRO de cada grupo de `rankAndGroup`, así que no mezcla
 * recomendadas con excluidas: solo recoloca, nunca descarta.
 */

export type CriterioOrden =
  | 'distance' | 'specialty' | 'workload' | 'voluntary' | 'province' | 'duration'
  /** Orden entre los subgrupos de voluntarias (PROA+, Economía, …). */
  | 'volGroup';

export type DireccionOrden =
  | 'cerca-primero' | 'lejos-primero'
  | 'mi-orden-bajo-primero' | 'mi-orden-alto-primero'
  | 'completa-primero' | 'parcial-primero'
  | 'obligatoria-primero' | 'voluntaria-primero'
  | 'provincia-az' | 'provincia-za' | 'provincia-mi-orden'
  | 'larga-primero' | 'corta-primero'
  | 'vol-mi-orden';

export interface CriterioConfigurado {
  criterio: CriterioOrden;
  direccion: DireccionOrden;
  /** `false` lo deja fuera de la cascada sin perder su posición. Ausente = activo. */
  activo?: boolean;
}

/** Direcciones posibles de cada criterio, en el orden en que cicla el botón ↕. */
export const DIRECCIONES: Record<CriterioOrden, DireccionOrden[]> = {
  distance: ['cerca-primero', 'lejos-primero'],
  specialty: ['mi-orden-bajo-primero', 'mi-orden-alto-primero'],
  workload: ['completa-primero', 'parcial-primero'],
  voluntary: ['obligatoria-primero', 'voluntaria-primero'],
  province: ['provincia-mi-orden'],
  duration: ['larga-primero', 'corta-primero'],
  volGroup: ['vol-mi-orden']
};

/**
 * Cascada por defecto (SCRUM-24): 1 Jornada, 2 Distancia, 3 Obligatorias/voluntarias.
 *
 * Especialidad va cuarta y Provincia ni aparece: ambas son criterios que solo
 * significan algo cuando hay variedad, y `criteriosUtiles()` las esconde cuando
 * no la hay.
 */
export const ORDEN_POR_DEFECTO: CriterioConfigurado[] = [
  { criterio: 'workload', direccion: 'completa-primero' },
  { criterio: 'distance', direccion: 'cerca-primero' },
  { criterio: 'voluntary', direccion: 'obligatoria-primero' },
  { criterio: 'volGroup', direccion: 'vol-mi-orden' },
  { criterio: 'specialty', direccion: 'mi-orden-bajo-primero' },
  { criterio: 'province', direccion: 'provincia-mi-orden' },
  { criterio: 'duration', direccion: 'larga-primero' }
];

/** Lo que el comparador necesita saber de cada fila de la lista. */
export interface FilaOrdenable {
  distanceKm?: number;
  travelMinutes?: number;
  vacancy: {
    bodyCode?: string;
    specialtyCode?: string;
    centerCode?: string;
    municipality?: string;
    /** La del PDF. Si falta, se deriva del código de centro. */
    province?: string;
    durationType?: string;
    workload?: number;
    voluntary: boolean;
    /** Lo que hace falta para etiquetar la vacante en subgrupos de voluntarias. */
    specialtyName?: string;
    additionalInfoRaw?: string;
    requirements?: VacancyRequirement[];
  };
}

/**
 * Número de orden del aspirante por especialidad. Una vacante válida para dos
 * de sus especialidades usa el mejor número (el más bajo): es la posición desde
 * la que realmente puede pedirla.
 */
export type OrdenPorEspecialidad = Record<string, number | undefined>;

export function claveEspecialidad(bodyCode?: string, specialtyCode?: string): string {
  return `${bodyCode ?? ''}-${specialtyCode ?? ''}`;
}

/** Un valor ausente nunca "gana": va siempre al final, mire donde mire la dirección. */
const AL_FINAL = Number.POSITIVE_INFINITY;

/** Las tres provincias de Aragón en orden alfabético: basta un rango para comparar. */
const RANGO_PROVINCIA: Record<string, number> = { Huesca: 0, Teruel: 1, Zaragoza: 2 };

/** De más larga a más corta: es el sentido natural de "larga-primero". */
const RANGO_DURACION: Record<string, number> = {
  full_course: 0,
  long_term: 1,
  substitution: 2
};

/** Sin tildes ni palabras vacías: la misma clave con la que se funden. */
function claveEtiqueta(e: string): string {
  return e
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(de|del|la|el|los|las|al|a|en|con|y|o|u)\b/g, ' ')
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim();
}

function valor(
  criterio: CriterioOrden,
  fila: FilaOrdenable,
  ordenEspecialidades: OrdenPorEspecialidad,
  direccion: DireccionOrden,
  ordenProvincias: readonly string[],
  ordenVoluntarias: readonly string[],
  modo: TravelMode
): number {
  switch (criterio) {
    case 'distance':
      return (modo === 'minutes' ? fila.travelMinutes : fila.distanceKm) ?? AL_FINAL;
    case 'specialty':
      return ordenEspecialidades[claveEspecialidad(fila.vacancy.bodyCode, fila.vacancy.specialtyCode)] ?? AL_FINAL;
    case 'workload':
      return fila.vacancy.workload == null ? AL_FINAL : -fila.vacancy.workload;
    case 'voluntary':
      return fila.vacancy.voluntary ? 1 : 0;
    case 'province': {
      const provincia = provinciaDeVacante(fila);
      // Con orden propio manda la lista del usuario; sin ella, el alfabético.
      // Una provincia que no esté en su lista cierra, no se cuela en medio.
      if (direccion === 'provincia-mi-orden') {
        const posicion = ordenProvincias.indexOf(provincia);
        return posicion < 0 ? AL_FINAL : posicion;
      }
      return RANGO_PROVINCIA[provincia] ?? AL_FINAL;
    }
    case 'duration':
      return RANGO_DURACION[fila.vacancy.durationType ?? ''] ?? AL_FINAL;
    case 'volGroup': {
      // Solo ordena entre voluntarias: una obligatoria no pertenece a ningún
      // subgrupo de estos y no debe colarse en medio de ellos.
      if (!fila.vacancy.voluntary || ordenVoluntarias.length === 0) return AL_FINAL;
      const suyas = etiquetasDeVacante(fila.vacancy).map(claveEtiqueta);
      let mejor = AL_FINAL;
      ordenVoluntarias.forEach((etiqueta, i) => {
        if (etiqueta === OTRAS_CONDICIONES) return;
        if (suyas.includes(claveEtiqueta(etiqueta))) mejor = Math.min(mejor, i);
      });
      if (mejor !== AL_FINAL) return mejor;
      // Lo que no encaja en ninguna con nombre cae en "Otras condiciones", si
      // el usuario la tiene en su lista; si no, al final.
      const otras = ordenVoluntarias.indexOf(OTRAS_CONDICIONES);
      return otras < 0 ? AL_FINAL : otras;
    }
  }
}

/**
 * El PDF trae la provincia; la derivación del código de centro es solo el plan B
 * para las convocatorias en que ese campo no venga.
 */
function provinciaDeVacante(fila: FilaOrdenable): string {
  return fila.vacancy.province?.trim()
    || provinciaDeCentro(fila.vacancy.centerCode, fila.vacancy.municipality);
}

/** true si la dirección elegida es la "natural" (menor valor primero). */
function ascendente(direccion: DireccionOrden): boolean {
  return (
    direccion === 'cerca-primero' ||
    direccion === 'mi-orden-bajo-primero' ||
    direccion === 'completa-primero' ||
    direccion === 'obligatoria-primero' ||
    direccion === 'provincia-az' ||
    // Con orden propio el valor YA es la posición elegida: invertirlo lo rompería.
    direccion === 'provincia-mi-orden' ||
    direccion === 'larga-primero' ||
    // Como en provincias: el valor YA es la posición elegida.
    direccion === 'vol-mi-orden'
  );
}

export function compararEnCascada(
  cascada: CriterioConfigurado[],
  ordenEspecialidades: OrdenPorEspecialidad = {},
  ordenProvincias: readonly string[] = [],
  ordenVoluntarias: readonly string[] = [],
  modo: TravelMode = 'km'
): (a: FilaOrdenable, b: FilaOrdenable) => number {
  return (a, b) => {
    for (const { criterio, direccion, activo } of cascada) {
      if (activo === false) continue;
      const va = valor(criterio, a, ordenEspecialidades, direccion, ordenProvincias, ordenVoluntarias, modo);
      const vb = valor(criterio, b, ordenEspecialidades, direccion, ordenProvincias, ordenVoluntarias, modo);
      if (va === vb) continue;
      // Los ausentes cierran la lista aunque la dirección esté invertida.
      if (va === AL_FINAL) return 1;
      if (vb === AL_FINAL) return -1;
      return ascendente(direccion) ? va - vb : vb - va;
    }
    return 0;
  };
}

export function ordenarEnCascada<T extends FilaOrdenable>(
  filas: T[],
  cascada: CriterioConfigurado[],
  ordenEspecialidades: OrdenPorEspecialidad = {},
  ordenProvincias: readonly string[] = [],
  ordenVoluntarias: readonly string[] = [],
  modo: TravelMode = 'km'
): T[] {
  return [...filas].sort(
    compararEnCascada(cascada, ordenEspecialidades, ordenProvincias, ordenVoluntarias, modo)
  );
}

/**
 * Mueve un criterio a la posición `destino` (0..n-1) recolocando los demás.
 * Modelo de lista estricta: sin huecos y sin dos criterios en la misma posición.
 */
export function moverCriterio(
  cascada: CriterioConfigurado[],
  desde: number,
  destino: number
): CriterioConfigurado[] {
  const limite = Math.max(0, Math.min(cascada.length - 1, destino));
  if (desde === limite || desde < 0 || desde >= cascada.length) return cascada;
  const copia = [...cascada];
  const [movido] = copia.splice(desde, 1);
  copia.splice(limite, 0, movido);
  return copia;
}


/** Por qué un criterio no se puede usar; `undefined` si sí se puede. */
export interface UtilidadCriterio {
  util: boolean;
  motivo?: string;
}

/**
 * Un criterio que no distingue nada no es una opción, es ruido: ordenar por
 * provincia cuando solo queda Zaragoza no cambia una sola fila.
 *
 * La pantalla de Ordenar los esconde por completo, no los atenúa: si el criterio
 * dejó de valer fue porque el propio usuario acotó en Filtrar un paso antes, y no
 * hay que explicarle lo que acaba de hacer. `motivo` se conserva porque describe
 * POR QUÉ deja de servir y lo aprovechan los tests y la depuración.
 */
export function utilidadCriterios(
  filas: readonly FilaOrdenable[],
  ordenEspecialidades: OrdenPorEspecialidad = {}
): Record<CriterioOrden, UtilidadCriterio> {
  const provincias = new Set(filas.map(provinciaDeVacante).filter(Boolean));
  const especialidades = new Set(
    filas.map(f => claveEspecialidad(f.vacancy.bodyCode, f.vacancy.specialtyCode))
  );
  const jornadas = new Set(filas.map(f => f.vacancy.workload).filter(w => w != null));
  const conTrayecto = filas.some(f => f.distanceKm != null);
  const tipos = new Set(filas.map(f => f.vacancy.voluntary));
  // "unknown" no es una duración real: no cuenta para decidir si hay variedad.
  const duraciones = new Set(
    filas.map(f => f.vacancy.durationType).filter(d => d != null && d !== 'unknown')
  );

  // Cuántos subgrupos distintos hay entre las voluntarias: con uno o ninguno,
  // ordenar por subgrupo no cambia una sola fila.
  const subgruposVol = new Set(
    filas
      .filter(f => f.vacancy.voluntary)
      .flatMap(f => etiquetasDeVacante(f.vacancy))
  );

  const unica = (s: Set<string>) => [...s][0];

  return {
    distance: conTrayecto
      ? { util: true }
      : { util: false, motivo: 'Sin trayecto calculado' },
    province: provincias.size > 1
      ? { util: true }
      : { util: false, motivo: provincias.size === 1 ? `Solo queda ${unica(provincias)}` : 'Sin provincia conocida' },
    specialty: especialidades.size > 1
      ? { util: true }
      : { util: false, motivo: 'Una sola especialidad activa' },
    workload: jornadas.size > 1
      ? { util: true }
      : { util: false, motivo: 'Todas la misma jornada' },
    voluntary: tipos.size > 1
      ? { util: true }
      : { util: false, motivo: tipos.has(true) ? 'Todas voluntarias' : 'Todas obligatorias' },
    duration: duraciones.size > 1
      ? { util: true }
      : { util: false, motivo: 'Una sola duración' },
    volGroup: subgruposVol.size > 1
      ? { util: true }
      : {
          util: false,
          motivo: subgruposVol.size === 1
            ? 'Un solo subgrupo de voluntarias'
            : 'Ninguna voluntaria con condiciones'
        }
  };
}
