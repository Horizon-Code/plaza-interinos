/**
 * Reconstrucción de líneas de texto a partir de los items posicionados que
 * devuelve pdf.js (`getTextContent()`). Compartida por la web, el script de
 * catálogo y las fixtures de tests, para que todos vean el PDF igual.
 */

export interface TextItemPos {
  str: string;
  x: number;
  y: number;
}

export interface PageLines {
  page: number;
  lines: string[];
}

/** Tolerancia vertical (pt) para considerar que dos items comparten línea. */
const TOLERANCIA_Y = 2;
/** Hueco horizontal (pt) a partir del cual se inserta el separador de columna. */
const HUECO_COLUMNA = 20;
/** Hueco horizontal (pt) a partir del cual se inserta un espacio. */
const HUECO_ESPACIO = 6;
/** Anchura media aproximada de un carácter (pt) para estimar el fin del item. */
const ANCHO_CARACTER = 4.5;

export const SEPARADOR_COLUMNA = '  |  ';

/**
 * Normaliza los items de pdf.js a coordenadas visuales {x,y} corrigiendo la
 * rotación de página (los PDFs de candidatos vienen apaisados).
 */
export function normalizarItemsPdf(
  items: { str: string; transform: number[] }[],
  rotate: number,
  width: number,
  height: number
): TextItemPos[] {
  const rot = ((rotate % 360) + 360) % 360;
  return items
    .filter(it => it.str.trim())
    .map(it => {
      const tx = it.transform[4];
      const ty = it.transform[5];
      if (rot === 90) return { str: it.str, x: ty, y: width - tx };
      if (rot === 270) return { str: it.str, x: height - ty, y: tx };
      if (rot === 180) return { str: it.str, x: width - tx, y: height - ty };
      return { str: it.str, x: tx, y: ty };
    });
}

/**
 * Agrupa los items por coordenada Y (redondeada con tolerancia), ordena cada
 * grupo por X y une los fragmentos insertando espacios o separadores de
 * columna según el hueco horizontal. Devuelve las líneas de arriba abajo.
 */
export function reconstruirLineas(items: TextItemPos[]): string[] {
  const filas = new Map<number, TextItemPos[]>();
  for (const item of items) {
    if (!item.str.trim()) continue;
    const y = Math.round(item.y / TOLERANCIA_Y) * TOLERANCIA_Y;
    const fila = filas.get(y);
    if (fila) fila.push(item);
    else filas.set(y, [item]);
  }

  const lineas: string[] = [];
  for (const [, fila] of [...filas.entries()].sort((a, b) => b[0] - a[0])) {
    fila.sort((a, b) => a.x - b.x);
    let linea = '';
    let finAnterior = 0;
    for (const item of fila) {
      const hueco = item.x - finAnterior;
      if (linea && hueco > HUECO_ESPACIO) {
        linea += hueco > HUECO_COLUMNA ? SEPARADOR_COLUMNA : ' ';
      }
      linea += item.str;
      finAnterior = item.x + item.str.length * ANCHO_CARACTER;
    }
    lineas.push(linea);
  }
  return lineas;
}
