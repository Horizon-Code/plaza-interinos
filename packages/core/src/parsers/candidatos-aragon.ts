/**
 * Búsqueda del aspirante en el PDF real de candidatos de Aragón ("RELACIÓN DE
 * CANDIDATOS PRESELECCIONADOS PARA EL ACTO DE ELECCIÓN"). El documento es una
 * tabla apaisada: cada página corresponde a un cuerpo+especialidad (cabecera
 * tipo "0590 - PROFESORES DE ENSEÑANZA SECUNDARIA001 - FILOSOFIA") y contiene
 * los nombres en formato "APELLIDOS, NOMBRE".
 *
 * Estrategia: búsqueda por substring del nombre normalizado (sin acentos,
 * mayúsculas, espacios colapsados) sobre el texto completo de cada página.
 * El número de orden es best-effort: requiere items con coordenadas
 * normalizadas por rotación; si no se puede alinear, se omite.
 */

export interface CandidatosPage {
  page: number;
  /** Texto completo de la página (concatenación de items). */
  text: string;
  /** Items posicionados, ya normalizados por rotación (opcional, para el orden). */
  items?: { str: string; x: number; y: number }[];
}

export interface CandidateMatch {
  bodyCode: string;
  bodyName: string;
  specialtyCode: string;
  specialtyName: string;
  page: number;
  orden?: number;
}

/**
 * En el texto de la página (orden de pintado del PDF, no visual) el cuerpo y
 * la especialidad aparecen sueltos y en cualquier orden, p. ej.:
 * "… CUERPO 001 - FILOSOFIA 0590 - PROFESORES DE ENSEÑANZA SECUNDARIA ESPECIALIDAD …".
 * Se capturan por separado: el código de cuerpo son 4 cifras empezando por 0;
 * el de especialidad, 3 cifras no precedidas de otra cifra.
 */
const RE_CUERPO = /(?<!\d)(0\d{3})\s*-\s*([A-ZÁÉÍÓÚÑÜ ]+)/;
const RE_ESPECIALIDAD = /(?<!\d)(\d{3})\s*-\s*([A-ZÁÉÍÓÚÑÜ().,\- ]+)/;

/** Palabras de la plantilla de la tabla que pueden colarse tras el nombre de la especialidad. */
const RE_COLA_TABLA =
  /\s+(FECHA|NIF|ORDEN|BLOQUE|LISTA|RELACI(Ó|O)N|PROVINCIA|REFERENCIA|CANDIDATO|SUSPENSI(Ó|O)N|CUERPO|ESPECIALIDAD|HUESCA|TERUEL|ZARAGOZA|APELLIDOS)\b.*$/;

/** Normaliza para comparar: mayúsculas, sin acentos, espacios colapsados. */
export function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function findCandidateSpecialties(
  pages: CandidatosPage[],
  fullName: string
): CandidateMatch[] {
  const objetivo = normalizeName(fullName);
  if (!objetivo) return [];

  const matches = new Map<string, CandidateMatch>();
  for (const page of pages) {
    const texto = normalizeName(page.text);
    if (!texto.includes(objetivo)) continue;

    const cuerpo = page.text.match(RE_CUERPO);
    if (!cuerpo) continue;
    // La especialidad es el primer "NNN - X" que no sea el propio cuerpo.
    const resto = page.text.slice(0, cuerpo.index) + ' ' + page.text.slice(cuerpo.index! + cuerpo[0].length);
    const especialidad = resto.match(RE_ESPECIALIDAD);
    if (!especialidad) continue;
    const match: CandidateMatch = {
      bodyCode: cuerpo[1],
      bodyName: cuerpo[2].replace(RE_COLA_TABLA, '').trim(),
      specialtyCode: especialidad[1],
      specialtyName: especialidad[2].replace(RE_COLA_TABLA, '').trim(),
      page: page.page,
      orden: extraerOrden(page, objetivo)
    };
    const clave = `${match.bodyCode}-${match.specialtyCode}`;
    // Conservar la primera aparición (el orden más alto en la lista).
    if (!matches.has(clave)) matches.set(clave, match);
  }
  return [...matches.values()];
}

/**
 * Best-effort: localiza el item cuyo texto contiene el nombre y busca el
 * número de orden en la banda vertical más próxima de la columna de órdenes.
 * En las tablas rotadas los nombres suelen venir como items individuales;
 * si la página no trae items o no hay alineación fiable, devuelve undefined.
 */
function extraerOrden(page: CandidatosPage, objetivoNormalizado: string): number | undefined {
  if (!page.items?.length) return undefined;
  const itemNombre = page.items.find(it => normalizeName(it.str).includes(objetivoNormalizado));
  if (!itemNombre) return undefined;

  // Candidatos a "orden": items exclusivamente numéricos de 1-4 cifras.
  const numericos = page.items.filter(it => /^\d{1,4}$/.test(it.str.trim()));
  if (!numericos.length) return undefined;

  // El más cercano en la coordenada Y (misma fila visual tras normalizar rotación).
  let mejor: { dist: number; valor: number } | null = null;
  for (const it of numericos) {
    const dist = Math.abs(it.y - itemNombre.y);
    if (dist < 4 && (!mejor || dist < mejor.dist)) {
      mejor = { dist, valor: Number(it.str.trim()) };
    }
  }
  return mejor?.valor;
}
