import { extractFromAdditionalInfo } from './tags.js';
import type { VacancyRequirement } from './models.js';

/** Lo que necesita una vacante para poder etiquetarla. */
export interface VacanteEtiquetable {
  specialtyName?: string;
  additionalInfoRaw?: string;
  requirements?: VacancyRequirement[];
}

/** Cajón para lo que no da para categoría propia. Se ordena como una más. */
export const OTRAS_CONDICIONES = 'Otras condiciones';

/** Por debajo de esto una etiqueta no merece una fila propia en el orden. */
const MINIMO_POR_DEFECTO = 5;

/**
 * A partir de aquí ya no es una etiqueta, es una frase copiada del PDF. Ocho y
 * no cinco porque hay condiciones legítimamente largas —"profesores de apoyo al
 * área de ciencias o tecnología"— y cortarlas antes las borraba del mapa.
 */
const MAX_PALABRAS = 8;
const MAX_CARACTERES = 60;

/**
 * Clave de fusión: sin tildes, sin mayúsculas y sin las palabras vacías que
 * distinguen "profesores de apoyo AL área" de "profesores de apoyo DEL area".
 * Son la misma condición escrita de tres formas por tres centros distintos.
 */
function clave(etiqueta: string): string {
  return etiqueta
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b(de|del|la|el|los|las|al|a|en|con|y|o|u)\b/g, ' ')
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim();
}

/** Descarta lo que es un resto de la frase y no el nombre de una condición. */
function esEtiqueta(etiqueta: string): boolean {
  const limpia = etiqueta.trim();
  if (limpia.length < 3) return false;
  if (/^(o|y|u|de|del|la|el|en|con)\b/i.test(limpia)) return false;
  // "Imparte programa de aprendizaje inclusivo - vacante de larga duración. La
  // vacante es de larga duración…" no es una etiqueta: es el párrafo entero.
  if (limpia.split(/\s+/).length > MAX_PALABRAS) return false;
  if (limpia.length > MAX_CARACTERES) return false;
  // Un punto seguido delata una frase, por corta que sea.
  if (/\.\s/.test(limpia)) return false;
  return true;
}

function limpiar(label: string): string {
  return label.replace(/^con\s+horas\s+de\s+/i, '').trim();
}

/**
 * Las condiciones de una vacante, como etiquetas cortas. Es la misma lista que
 * la clasifica en los subgrupos de Filtrar, así que ficha, filtro y orden
 * hablan del mismo conjunto.
 */
export function etiquetasDeVacante(v: VacanteEtiquetable): string[] {
  const fuera: string[] = [];
  const vistas = new Set<string>();
  const anadir = (bruta: string) => {
    const etiqueta = limpiar(bruta);
    if (!esEtiqueta(etiqueta)) return;
    const k = clave(etiqueta);
    if (!k || vistas.has(k)) return;
    vistas.add(k);
    fuera.push(etiqueta);
  };

  if (/orientaci(ó|o)n/i.test(v.specialtyName ?? '')) anadir('Orientación');
  const requisitos = [
    ...(v.requirements ?? []),
    ...extractFromAdditionalInfo(v.additionalInfoRaw).requirements
  ];
  for (const req of requisitos) {
    if (!req.required) continue;
    anadir(req.label);
  }
  return fuera;
}

export interface EtiquetaContada {
  etiqueta: string;
  cuantas: number;
  /** Cuántas formas distintas de escribirla se han fundido en esta. */
  variantes: number;
}

/**
 * Catálogo de etiquetas de un conjunto de vacantes, ya domado: las variantes
 * de la misma condición fundidas en una, y lo que pesa poco recogido en
 * "Otras condiciones".
 *
 * Sin esto la lista sale con más de veinte entradas, tres de ellas la misma
 * cosa con distintas tildes, y ordenar eso a mano no lo hace nadie.
 */
export function catalogoEtiquetas(
  vacantes: readonly VacanteEtiquetable[],
  minimo: number = MINIMO_POR_DEFECTO
): EtiquetaContada[] {
  const cuenta = new Map<string, { etiqueta: string; cuantas: number; formas: Set<string> }>();
  for (const v of vacantes) {
    for (const etiqueta of etiquetasDeVacante(v)) {
      const k = clave(etiqueta);
      const fila = cuenta.get(k) ?? { etiqueta, cuantas: 0, formas: new Set<string>() };
      fila.cuantas++;
      fila.formas.add(etiqueta);
      // De las variantes se queda la más corta: suele ser la más limpia.
      if (etiqueta.length < fila.etiqueta.length) fila.etiqueta = etiqueta;
      cuenta.set(k, fila);
    }
  }

  const todas = [...cuenta.values()].sort((a, b) => b.cuantas - a.cuantas);
  const grandes = todas.filter(f => f.cuantas >= minimo);
  const pequenas = todas.filter(f => f.cuantas < minimo);

  const catalogo: EtiquetaContada[] = grandes.map(f => ({
    etiqueta: f.etiqueta,
    cuantas: f.cuantas,
    variantes: f.formas.size
  }));
  if (pequenas.length) {
    catalogo.push({
      etiqueta: OTRAS_CONDICIONES,
      cuantas: pequenas.reduce((n, f) => n + f.cuantas, 0),
      variantes: pequenas.length
    });
  }
  return catalogo;
}

/** Si una vacante cae en "Otras condiciones" para un catálogo dado. */
export function encajaEnEtiqueta(
  v: VacanteEtiquetable,
  etiqueta: string,
  catalogo: readonly EtiquetaContada[]
): boolean {
  const suyas = etiquetasDeVacante(v).map(clave);
  if (etiqueta !== OTRAS_CONDICIONES) return suyas.includes(clave(etiqueta));
  const conNombre = new Set(
    catalogo.filter(e => e.etiqueta !== OTRAS_CONDICIONES).map(e => clave(e.etiqueta))
  );
  return suyas.length > 0 && suyas.every(k => !conNombre.has(k));
}
