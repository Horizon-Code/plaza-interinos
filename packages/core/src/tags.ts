import type { DetectedCondition, RequirementCategory, Vacancy, VacancyRequirement } from './models.js';

/**
 * Convierte el texto libre de "Información Adicional" en etiquetas y
 * requisitos estructurados. Patrones calibrados con el vocabulario real del
 * PDF de vacantes de Aragón (SEC-2026-1, 1.408 textos únicos analizados).
 *
 * Tres fuentes de condiciones:
 *  1. Patrones fijos (horario, FP, programas, movilidad, idiomas...).
 *  2. Asignaturas dinámicas: "CON HORAS DE <X>" → asignatura:<slug>.
 *  3. Segmentos cortos no cubiertos por nada ("CULTURA CLÁSICA") → asignatura
 *     con confianza baja (pedirá revisión manual).
 *
 * Principio: nunca ocultar incertidumbre. Si un patrón es ambiguo, se emite
 * con confianza menor y el evaluador marcará revisión manual.
 */

interface Pattern {
  regex: RegExp;
  tag: string;
  requirement?: {
    code: string;
    label: string;
    category: RequirementCategory;
    required: boolean;
  };
  confidence: number;
}

const PATTERNS: Pattern[] = [
  // --- Idiomas ---
  {
    regex: /biling(ü|u)e\s+ingl(é|e)s|programa\s+brit(á|a)nico|british|(c1|b2|b1)\s+(de\s+|en\s+)?ingl(é|e)s|ingl(é|e)s\s*[.:]?\s*titulaci(ó|o)n/i,
    tag: 'bilingual_en',
    requirement: { code: 'en', label: 'Requisito de inglés (bilingüe/C1)', category: 'language', required: true },
    confidence: 0.95
  },
  {
    regex: /biling(ü|u)e\s+franc(é|e)s|(c1|b2|b1)\s+(de\s+|en\s+)?franc(é|e)s|franc(é|e)s\s*[.:]?\s*titulaci(ó|o)n|titulaci(ó|o)n\s+habilitante\s+para\s+franc(é|e)s/i,
    tag: 'bilingual_fr',
    requirement: { code: 'fr', label: 'Requisito de francés (bilingüe/C1)', category: 'language', required: true },
    confidence: 0.95
  },
  {
    regex: /(c1|b2|b1)\s+(de\s+|en\s+)?catal(á|a)n|catal(á|a)n\s*[.:]?\s*titulaci(ó|o)n|biling(ü|u)e\s+catal(á|a)n/i,
    tag: 'bilingual_ca',
    requirement: { code: 'ca', label: 'Requisito de catalán', category: 'language', required: true },
    confidence: 0.95
  },
  {
    regex: /competencia\s+digital/i,
    tag: 'competencia_digital',
    requirement: { code: 'competencia_digital', label: 'Requisito de competencia digital docente', category: 'qualification', required: true },
    confidence: 0.9
  },
  {
    regex: /biling(ü|u)e(?!\s+(ingl|franc))/i,
    tag: 'bilingual_unspecified',
    requirement: { code: 'lang_unknown', label: 'Programa bilingüe (idioma sin especificar)', category: 'language', required: true },
    confidence: 0.6
  },
  // --- Horario ---
  {
    regex: /(horario\s+de\s+tarde|vespertin[oa]|turno\s+de\s+tarde|nocturn[oa]|ma(ñ|n)ana\s+y\s+tarde)/i,
    tag: 'afternoon',
    requirement: { code: 'afternoon', label: 'Horario de tarde/vespertino', category: 'schedule', required: true },
    confidence: 0.9
  },
  {
    regex: /\bvirtual\b|a\s+distancia|\bdistancia\b/i,
    tag: 'virtual',
    requirement: { code: 'virtual', label: 'Modalidad virtual / a distancia', category: 'other', required: true },
    confidence: 0.8
  },
  // --- FP ---
  {
    regex: /\b(FPB|FPGB|CFGB|FPGM|FPGS)\b|FP\s+B(á|a)sica|ciclos?\s+formativos?|grado\s+b(á|a)sico|grados\s+D\s+y\s+E|ciclos\s+TEC/i,
    tag: 'fp',
    requirement: { code: 'fp', label: 'Docencia en FP (ciclos formativos)', category: 'fp', required: true },
    confidence: 0.9
  },
  {
    regex: /\bDUAL\b/i,
    tag: 'fp_dual',
    requirement: { code: 'fp_dual', label: 'FP Dual', category: 'fp', required: true },
    confidence: 0.85
  },
  // --- Programas ---
  {
    regex: /\bPAI\b|programa\s+de\s+aprendizaje\s+inclusivo/i,
    tag: 'pai',
    requirement: { code: 'pai', label: 'Programa PAI (aprendizaje inclusivo)', category: 'program', required: true },
    confidence: 0.9
  },
  {
    regex: /diversificaci(ó|o)n/i,
    tag: 'diversificacion',
    requirement: { code: 'diversificacion', label: 'Diversificación curricular', category: 'program', required: true },
    confidence: 0.9
  },
  {
    regex: /\bPROA\b/i,
    tag: 'proa',
    requirement: { code: 'proa', label: 'Programa PROA+', category: 'program', required: true },
    confidence: 0.85
  },
  {
    regex: /\bPDPS\b|desarrollo\s+personal\s+y\s+social/i,
    tag: 'pdps',
    requirement: { code: 'pdps', label: 'Programa PDPS (desarrollo personal y social)', category: 'program', required: true },
    confidence: 0.85
  },
  {
    regex: /\bCOFOTAP\b/i,
    tag: 'cofotap',
    requirement: { code: 'cofotap', label: 'Programa COFOTAP', category: 'program', required: true },
    confidence: 0.85
  },
  {
    regex: /compensatoria/i,
    tag: 'compensatoria',
    requirement: { code: 'compensatoria', label: 'Educación compensatoria', category: 'program', required: true },
    confidence: 0.85
  },
  {
    regex: /simultaneidad/i,
    tag: 'simultaneidad',
    requirement: { code: 'simultaneidad', label: 'Programa de simultaneidad', category: 'program', required: true },
    confidence: 0.85
  },
  {
    regex: /\bPPPSE\b/i,
    tag: 'pppse',
    requirement: { code: 'pppse', label: 'Programa PPPSE', category: 'program', required: true },
    confidence: 0.8
  },
  {
    regex: /\bARCOMAT\b/i,
    tag: 'arcomat',
    requirement: { code: 'arcomat', label: 'Programa ARCOMAT', category: 'program', required: true },
    confidence: 0.85
  },
  {
    regex: /\bapoyo\b/i,
    tag: 'apoyo',
    requirement: { code: 'apoyo', label: 'Apoyo (departamento de orientación)', category: 'program', required: true },
    confidence: 0.7
  },
  // --- Asignaturas con patrón fijo ---
  {
    regex: /rob(ó|o)tica/i,
    tag: 'robotics',
    requirement: { code: 'robotics', label: 'Robótica', category: 'asignatura', required: true },
    confidence: 0.9
  },
  // --- Movilidad ---
  {
    regex: /itineran(te|cia)/i,
    tag: 'itinerant',
    requirement: { code: 'itinerant', label: 'Plaza itinerante', category: 'mobility', required: true },
    confidence: 0.95
  },
  {
    regex: /compartida/i,
    tag: 'compartida',
    requirement: { code: 'compartida', label: 'Plaza compartida entre centros', category: 'mobility', required: true },
    confidence: 0.9
  },
  {
    regex: /(á|a)mbito\s+zona/i,
    tag: 'ambito_zona',
    requirement: { code: 'ambito_zona', label: 'Ámbito zona (varios centros)', category: 'mobility', required: true },
    confidence: 0.7
  },
  // --- Otras condiciones ---
  {
    regex: /superar\s+entrevista/i,
    tag: 'entrevista',
    requirement: { code: 'entrevista', label: 'Necesario superar entrevista', category: 'other', required: true },
    confidence: 0.95
  },
  // --- Duración / jornada (solo etiquetas, sin requisito) ---
  {
    regex: /larga\s+duraci(ó|o)n/i,
    tag: 'long_term',
    requirement: { code: 'long_term', label: 'Larga duración', category: 'duration', required: true },
    confidence: 0.95
  },
  {
    regex: /(media\s+jornada|jornada\s+parcial|1\/2\s+jornada)/i,
    tag: 'partial_half',
    confidence: 0.9
  },
  {
    regex: /(tercio\s+de\s+jornada|1\/3\s+jornada)/i,
    tag: 'partial_third',
    confidence: 0.9
  },
  {
    regex: /voluntaria/i,
    tag: 'voluntary',
    confidence: 0.9
  }
];

/** "CON HORAS DE X" / "CON HORAS EN X" / "CON HORAS DOCENCIA X". */
const RE_CON_HORAS = /con\s+horas\s+(?:de\s+la\s+|de\s+|en\s+|del\s+)?(?:docencia\s+(?:de\s+|en\s+)?)?([^.;]+)/gi;

/** Palabras que descartan un segmento suelto como asignatura. */
const STOPWORDS_ASIGNATURA =
  /\b(curso|todo|toda|posibilidad|posible|turno|horario|diurno|plaza|centro|centros|departamento|orientaci(ó|o)n|jornada|horas?|programa|docencia|imparte|m(ó|o)dulo|modalidad|equipo|proyectos?|necesario|fondo|europeo|secci(ó|o)n|reserva|titular|vacante)\b/i;

export interface TagExtractionResult {
  tags: string[];
  requirements: VacancyRequirement[];
  /** Fragmentos que activaron cada etiqueta, para resaltar en la interfaz. */
  matches: { tag: string; sourceText: string }[];
}

export function extractFromAdditionalInfo(raw: string | undefined): TagExtractionResult {
  const result: TagExtractionResult = { tags: [], requirements: [], matches: [] };
  if (!raw || !raw.trim()) return result;

  const añadir = (
    tag: string,
    sourceText: string,
    confidence: number,
    requirement?: Omit<VacancyRequirement, 'confidence' | 'sourceText'>
  ) => {
    if (result.tags.includes(tag)) return;
    result.tags.push(tag);
    result.matches.push({ tag, sourceText });
    if (requirement) {
      result.requirements.push({ ...requirement, confidence, sourceText });
    }
  };

  // 1. Patrones fijos sobre el texto completo.
  for (const pattern of PATTERNS) {
    const match = raw.match(pattern.regex);
    if (!match) continue;
    añadir(pattern.tag, match[0], pattern.confidence, pattern.requirement);
  }

  // 2. Asignaturas dinámicas: "CON HORAS DE <X>".
  for (const match of raw.matchAll(RE_CON_HORAS)) {
    const sujeto = limpiarSujeto(match[1]);
    if (!sujeto) continue;
    // Si el sujeto ya lo cubre un patrón fijo (FP, PAI, vespertino...), no es asignatura.
    if (PATTERNS.some(p => p.regex.test(sujeto))) continue;
    const slug = slugify(sujeto);
    if (!slug) continue;
    añadir(`asignatura:${slug}`, match[0].trim(), 0.75, {
      code: `asignatura:${slug}`,
      label: `Con horas de ${titulo(sujeto)}`,
      category: 'asignatura',
      required: true
    });
  }

  // 3. Segmentos cortos sin cubrir → posible asignatura suelta ("CULTURA CLÁSICA").
  for (const segmento of raw.split(/[.;]/)) {
    const texto = segmento.trim();
    if (!texto || texto.length > 60) continue;
    if (/con\s+horas/i.test(texto)) continue;
    if (PATTERNS.some(p => p.regex.test(texto))) continue;
    if (STOPWORDS_ASIGNATURA.test(texto)) continue;
    const palabras = texto.split(/\s+/);
    if (palabras.length > 6) continue;
    if (!/^[A-Za-zÁÉÍÓÚÑÜáéíóúñü\s,()+-]+$/.test(texto)) continue;
    const slug = slugify(texto);
    if (!slug) continue;
    añadir(`asignatura:${slug}`, texto, 0.6, {
      code: `asignatura:${slug}`,
      label: titulo(texto),
      category: 'asignatura',
      required: true
    });
  }

  return result;
}

/** Agrega las condiciones obligatorias de una convocatoria, para el perfil dinámico. */
export function buildDetectedConditions(
  vacancies: Pick<Vacancy, 'requirements'>[]
): DetectedCondition[] {
  const porCodigo = new Map<string, DetectedCondition>();
  for (const vacancy of vacancies) {
    const vistos = new Set<string>();
    for (const req of vacancy.requirements) {
      if (!req.required || vistos.has(req.code)) continue;
      vistos.add(req.code);
      const actual = porCodigo.get(req.code);
      if (actual) actual.count += 1;
      else porCodigo.set(req.code, { tag: req.code, label: req.label, category: req.category, count: 1 });
    }
  }
  return [...porCodigo.values()].sort((a, b) => b.count - a.count);
}

function limpiarSujeto(s: string): string {
  return s
    .replace(/\(.*?\)/g, ' ')
    .replace(/[.,;:]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function titulo(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map(p => (p.length > 2 ? p.charAt(0).toUpperCase() + p.slice(1) : p))
    .join(' ');
}

/** Umbral por debajo del cual una vacante pide revisión manual. */
export const MANUAL_REVIEW_CONFIDENCE = 0.7;
