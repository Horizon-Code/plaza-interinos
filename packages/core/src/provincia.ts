/**
 * La provincia no viaja en el PDF de vacantes ni en CENTROS_ARAGON, que solo
 * guarda municipio. Se deduce de las dos primeras cifras del código de centro:
 * en el registro estatal son el código INE de provincia. Cubre 957 de los 961
 * centros del catálogo.
 */
const PROVINCIAS_ARAGON: Record<string, string> = {
  '22': 'Huesca',
  '44': 'Teruel',
  '50': 'Zaragoza'
};

/**
 * Respaldo por municipio para los centros de comisión de servicios (códigos
 * `0000xxxx`), que no codifican provincia: son los 4 restantes del catálogo, y
 * los cuatro están en Zaragoza.
 *
 * Solo las tres capitales a propósito. Derivar el mapa completo desde
 * CENTROS_ARAGON resolvería cualquier municipio, pero arrastra el catálogo
 * entero al bundle (+110 KB medidos) para ganar cuatro filas: no compensa.
 */
const CAPITALES: Record<string, string> = {
  zaragoza: 'Zaragoza',
  huesca: 'Huesca',
  teruel: 'Teruel'
};

/** Sin acentos ni mayúsculas: el municipio del PDF no siempre coincide con el del catálogo. */
function normalizar(municipio: string): string {
  return municipio.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Devuelve cadena vacía si no hay forma de saberlo, nunca un valor inventado.
 *
 * @param centerCode Código de centro; su prefijo manda cuando existe.
 * @param municipio Municipio de la vacante, usado solo si el código no basta.
 */
export function provinciaDeCentro(
  centerCode: string | undefined,
  municipio?: string
): string {
  const porCodigo = centerCode ? PROVINCIAS_ARAGON[centerCode.slice(0, 2)] : undefined;
  if (porCodigo) return porCodigo;
  if (!municipio) return '';
  return CAPITALES[normalizar(municipio)] ?? '';
}
