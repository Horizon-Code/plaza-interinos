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

export type CriterioOrden = 'distance' | 'specialty' | 'workload' | 'voluntary';

export type DireccionOrden =
  | 'cerca-primero' | 'lejos-primero'
  | 'mi-orden-bajo-primero' | 'mi-orden-alto-primero'
  | 'completa-primero' | 'parcial-primero'
  | 'obligatoria-primero' | 'voluntaria-primero';

export interface CriterioConfigurado {
  criterio: CriterioOrden;
  direccion: DireccionOrden;
}

/** Direcciones posibles de cada criterio, en el orden en que cicla el botón ↕. */
export const DIRECCIONES: Record<CriterioOrden, DireccionOrden[]> = {
  distance: ['cerca-primero', 'lejos-primero'],
  specialty: ['mi-orden-bajo-primero', 'mi-orden-alto-primero'],
  workload: ['completa-primero', 'parcial-primero'],
  voluntary: ['obligatoria-primero', 'voluntaria-primero']
};

/** Cascada por defecto: cercanía primero, que es lo que promete la app sin tocar nada. */
export const ORDEN_POR_DEFECTO: CriterioConfigurado[] = [
  { criterio: 'distance', direccion: 'cerca-primero' },
  { criterio: 'specialty', direccion: 'mi-orden-bajo-primero' },
  { criterio: 'workload', direccion: 'completa-primero' },
  { criterio: 'voluntary', direccion: 'obligatoria-primero' }
];

/** Lo que el comparador necesita saber de cada fila de la lista. */
export interface FilaOrdenable {
  distanceKm?: number;
  vacancy: {
    bodyCode?: string;
    specialtyCode?: string;
    workload?: number;
    voluntary: boolean;
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

function valor(
  criterio: CriterioOrden,
  fila: FilaOrdenable,
  ordenEspecialidades: OrdenPorEspecialidad
): number {
  switch (criterio) {
    case 'distance':
      return fila.distanceKm ?? AL_FINAL;
    case 'specialty':
      return ordenEspecialidades[claveEspecialidad(fila.vacancy.bodyCode, fila.vacancy.specialtyCode)] ?? AL_FINAL;
    case 'workload':
      return fila.vacancy.workload == null ? AL_FINAL : -fila.vacancy.workload;
    case 'voluntary':
      return fila.vacancy.voluntary ? 1 : 0;
  }
}

/** true si la dirección elegida es la "natural" (menor valor primero). */
function ascendente(direccion: DireccionOrden): boolean {
  return (
    direccion === 'cerca-primero' ||
    direccion === 'mi-orden-bajo-primero' ||
    direccion === 'completa-primero' ||
    direccion === 'obligatoria-primero'
  );
}

export function compararEnCascada(
  cascada: CriterioConfigurado[],
  ordenEspecialidades: OrdenPorEspecialidad = {}
): (a: FilaOrdenable, b: FilaOrdenable) => number {
  return (a, b) => {
    for (const { criterio, direccion } of cascada) {
      const va = valor(criterio, a, ordenEspecialidades);
      const vb = valor(criterio, b, ordenEspecialidades);
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
  ordenEspecialidades: OrdenPorEspecialidad = {}
): T[] {
  return [...filas].sort(compararEnCascada(cascada, ordenEspecialidades));
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
