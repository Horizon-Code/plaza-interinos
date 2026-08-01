import type { VacancyRequirement } from '../models.js';
import type { PageLines } from './lineas.js';

/**
 * Parser del PDF real de vacantes de Aragón ("RELACIÓN DE VACANTES ORDINARIAS
 * OFERTADAS A INTERINOS PARA EL ACTO DE ELECCIÓN"). Formato de fichas:
 *
 *   - Vacante -- Cuerpo/Especialidad -  |  - Centro -
 *   0590 - PROFESORES DE ENSEÑANZA SECUNDARIA  |  (22000809) IES HERMANOS ARGENSOLA
 *   7237
 *   001 - FILOSOFIA  |  BARBASTRO (HUESCA)
 *   - Jornada -  |  - Duración -  |  - Obligación -  |  - Causa -
 *   Parcial  |  Curso Completo Voluntaria  |  De Cupo Sin titular
 *   - Horas Lectivas -  [ |  - Compartida -  [ |  - En Distinta Localidad - ]]
 *   9:00 horas (50%)    [ |  Si  [ |  Si ]]      <- el % puede venir en línea aparte "(66.67%)"
 *   - Información Adicional -                    <- opcional, 1..N líneas de texto libre
 *
 * Algunas fichas van precedidas del banner "- Vacante de Larga Duración -"
 * seguido de una línea explicativa; marcan durationType 'long_term'.
 *
 * Principio: nunca abortar el documento entero. Las fichas que no cierren
 * bien se registran en `issues` y se descartan individualmente.
 */

/** Objeto compatible con el payload de POST /api/convocatoria/import. */
export interface VacanteImportada {
  id: string;
  bodyCode: string;
  bodyName: string;
  specialtyCode: string;
  specialtyName: string;
  centerCode: string;
  centerName: string;
  municipality: string;
  province: string;
  workload?: number;
  voluntary: boolean;
  durationType?: 'long_term';
  additionalInfoRaw?: string;
  requirements: VacancyRequirement[];
  tags: string[];
  sourcePage: number;
}

export interface ParseIssue {
  page: number;
  message: string;
  context?: string;
}

export interface ParseVacantesResult {
  vacancies: VacanteImportada[];
  issues: ParseIssue[];
}

const RE_INICIO_FICHA = /^- Vacante --/;
const RE_BANNER_LARGA = /^- Vacante de Larga Duraci(ó|o)n -/i;
const RE_CUERPO_SOLO = /^(\d{4})\s*-\s*(.+)$/;
const RE_CENTRO_SOLO = /^\((\d{8})\)\s*(.+)$/;
const RE_ESPECIALIDAD_SOLA = /^(\d{3})\s*-\s*([^|]+)$/;
const RE_MUNICIPIO_SOLO = /^(.+?)\s*\(([^)]+)\)\s*$/;
const RE_NUMERO = /^\d{1,6}$/;
const RE_ETIQUETAS_JORNADA = /^- Jornada -/;
const RE_ETIQUETAS_HORAS = /^- Horas Lectivas -/;
const RE_ETIQUETA_INFO = /^- Informaci(ó|o)n Adicional -/i;
const RE_ETIQUETA_PERFILADA = /^- Perfilada -/;
const RE_ETIQUETA_REQUISITOS = /^- Requisitos Vacante Perfilada -/i;
const RE_NUMERO_ESPECIALIDAD = /^(\d{1,6})\s+(\d{3})\s*-\s*(.+)$/;
const RE_HORAS = /^(\d{1,2}):(\d{2})\s*horas(?:\s*\((\d+(?:[.,]\d+)?)\s*%\))?/;
const RE_PCT_SUELTO = /^\((\d+(?:[.,]\d+)?)\s*%\)$/;

/** Cabeceras y pies de página del documento, intercalados en cualquier punto. */
const RE_RUIDO = [
  /^SEC\s*-\s*\d{4}\s*-\s*\d+/,
  /^\d{2}\/\d{2}\/\d{4}$/,
  /^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}/,
  /Página\s+\d+\s+de\s+\d+/,
  /^RELACI(Ó|O)N DE VACANTES/i,
  /^INTERINOS PARA EL ACTO/i,
  /^CURSO DE FECHA/i
];

/** Horas lectivas de referencia para estimar jornada cuando falta el %. */
const HORAS_JORNADA_COMPLETA = 18;

const esRuido = (linea: string): boolean => RE_RUIDO.some(re => re.test(linea));

interface LineaConPagina {
  page: number;
  texto: string;
}

/** Ficha en construcción. */
interface FichaParcial {
  page: number;
  largaDuracion: boolean;
  bodyCode?: string;
  bodyName?: string;
  centerCode?: string;
  centerName?: string;
  numero?: string;
  specialtyCode?: string;
  specialtyName?: string;
  municipality?: string;
  province?: string;
  jornada?: 'Completa' | 'Parcial';
  voluntary?: boolean;
  causa?: string;
  workload?: number;
  horas?: number;
  compartida?: boolean;
  distintaLocalidad?: boolean;
  perfilada?: boolean;
  requisitosLineas?: string[];
  etiquetasHoras?: string[];
  infoLineas?: string[];
}

export function parseVacantesAragon(pages: PageLines[]): ParseVacantesResult {
  const lineas: LineaConPagina[] = [];
  for (const page of pages) {
    for (const texto of page.lines) {
      const limpio = texto.trim();
      if (limpio && !esRuido(limpio)) lineas.push({ page: page.page, texto: limpio });
    }
  }

  const vacancies: VacanteImportada[] = [];
  const issues: ParseIssue[] = [];
  let ficha: FichaParcial | null = null;
  let largaDuracionPendiente = false;
  let modo: 'ninguno' | 'valores' | 'horas' | 'info' | 'perfilada' | 'requisitos' = 'ninguno';

  const cerrarFicha = () => {
    if (!ficha) return;
    const resultado = finalizarFicha(ficha);
    if ('issue' in resultado) issues.push(resultado.issue);
    else vacancies.push(resultado.vacante);
    ficha = null;
    modo = 'ninguno';
  };

  for (const { page, texto } of lineas) {
    if (RE_BANNER_LARGA.test(texto)) {
      cerrarFicha();
      largaDuracionPendiente = true;
      continue;
    }
    if (largaDuracionPendiente && /^La vacante es de larga duraci/i.test(texto)) {
      continue; // línea explicativa del banner
    }
    if (RE_INICIO_FICHA.test(texto)) {
      cerrarFicha();
      ficha = { page, largaDuracion: largaDuracionPendiente };
      largaDuracionPendiente = false;
      continue;
    }
    if (!ficha) continue;

    if (RE_ETIQUETAS_JORNADA.test(texto)) {
      modo = 'valores';
      continue;
    }
    if (RE_ETIQUETAS_HORAS.test(texto)) {
      modo = 'horas';
      ficha.etiquetasHoras = texto.split('|').map(s => s.trim());
      continue;
    }
    if (RE_ETIQUETA_INFO.test(texto)) {
      modo = 'info';
      ficha.infoLineas = ficha.infoLineas ?? [];
      continue;
    }
    if (RE_ETIQUETA_PERFILADA.test(texto)) {
      modo = 'perfilada';
      continue;
    }
    if (RE_ETIQUETA_REQUISITOS.test(texto)) {
      modo = 'requisitos';
      ficha.requisitosLineas = ficha.requisitosLineas ?? [];
      continue;
    }

    if (modo === 'ninguno') {
      aplicarCabecera(ficha, texto);
      continue;
    }

    if (modo === 'valores') {
      aplicarValores(ficha, texto);
      continue;
    }
    if (modo === 'horas') {
      aplicarHoras(ficha, texto);
      continue;
    }
    if (modo === 'info') {
      ficha.infoLineas!.push(texto);
      continue;
    }
    if (modo === 'perfilada') {
      if (/^si$/i.test(texto)) ficha.perfilada = true;
      else ficha.requisitosLineas = [...(ficha.requisitosLineas ?? []), texto];
      continue;
    }
    if (modo === 'requisitos') {
      ficha.requisitosLineas!.push(texto);
      continue;
    }
  }
  cerrarFicha();

  return { vacancies, issues };
}

/**
 * Cabecera de la ficha. El PDF tiene dos columnas — col. 1: cuerpo, número de
 * vacante y especialidad; col. 2: centro y municipio — y los nombres largos se
 * parten en líneas adicionales en cualquiera de las dos columnas. Cada línea se
 * divide por el separador de columnas y cada parte se interpreta por columna.
 */
function aplicarCabecera(ficha: FichaParcial, texto: string): void {
  const partes = texto.split(/\s+\|\s+/);
  if (partes.length >= 2) {
    aplicarColumnaVacante(ficha, partes[0].trim());
    aplicarColumnaCentro(ficha, partes.slice(1).join(' ').trim());
    return;
  }
  // Línea de una sola columna: puede ser de cualquiera de las dos.
  const parte = partes[0].trim();
  if (aplicarColumnaVacante(ficha, parte, true)) return;
  if (aplicarColumnaCentro(ficha, parte, true)) return;
  // Un municipio repetido ("ZARAGOZA (ZARAGOZA)") nunca es continuación de nombre.
  if (ficha.municipality && RE_MUNICIPIO_SOLO.test(parte)) return;
  // Continuación de un nombre partido: especialidad si ya existe; si no, centro.
  if (/^[A-ZÁÉÍÓÚÑÜ0-9 .,()/-]+$/.test(parte)) {
    if (ficha.specialtyName && ficha.municipality) {
      ficha.specialtyName = `${ficha.specialtyName} ${parte}`;
    } else if (ficha.centerName && !ficha.specialtyCode) {
      ficha.centerName = `${ficha.centerName} ${parte}`;
    } else if (ficha.specialtyName) {
      ficha.specialtyName = `${ficha.specialtyName} ${parte}`;
    }
  }
}

/** Columna 1: cuerpo "0590 - X", número "7237", "7237 111 - X" o "111 - X". */
function aplicarColumnaVacante(ficha: FichaParcial, parte: string, soloSiEncaja = false): boolean {
  const cuerpo = parte.match(RE_CUERPO_SOLO);
  if (cuerpo && !ficha.bodyCode) {
    ficha.bodyCode = cuerpo[1];
    ficha.bodyName = cuerpo[2].trim();
    return true;
  }
  const numeroEspecialidad = parte.match(RE_NUMERO_ESPECIALIDAD);
  if (numeroEspecialidad && !ficha.specialtyCode) {
    ficha.numero = ficha.numero ?? numeroEspecialidad[1];
    ficha.specialtyCode = numeroEspecialidad[2];
    ficha.specialtyName = numeroEspecialidad[3].trim();
    return true;
  }
  const especialidad = parte.match(RE_ESPECIALIDAD_SOLA);
  if (especialidad && !ficha.specialtyCode && ficha.bodyCode) {
    ficha.specialtyCode = especialidad[1];
    let nombre = especialidad[2].trim();
    // Caso raro: municipio fusionado al final del nombre ("… PIEL ZARAGOZA (ZARAGOZA)").
    const fusionado = nombre.match(/^(.+?)\s+([A-ZÁÉÍÓÚÑÜ]+)\s*\(([^)]+)\)$/);
    if (fusionado && fusionado[2].toUpperCase() === fusionado[3].trim().toUpperCase()) {
      nombre = fusionado[1];
      ficha.municipality = fusionado[2];
      ficha.province = capitalizar(fusionado[3]);
    }
    ficha.specialtyName = nombre;
    return true;
  }
  if (RE_NUMERO.test(parte) && !ficha.numero && ficha.bodyCode) {
    ficha.numero = parte;
    return true;
  }
  if (soloSiEncaja) return false;
  // Continuación del nombre de la especialidad en la columna 1.
  if (ficha.specialtyName && parte) {
    ficha.specialtyName = `${ficha.specialtyName} ${parte}`;
    return true;
  }
  return false;
}

/** Columna 2: centro "(22000809) IES X" o municipio "BARBASTRO (HUESCA)". */
function aplicarColumnaCentro(ficha: FichaParcial, parte: string, soloSiEncaja = false): boolean {
  const centro = parte.match(RE_CENTRO_SOLO);
  if (centro && !ficha.centerCode) {
    ficha.centerCode = centro[1];
    ficha.centerName = centro[2].trim();
    return true;
  }
  const municipio = parte.match(RE_MUNICIPIO_SOLO);
  if (municipio && ficha.specialtyCode && !ficha.municipality && !/\d/.test(municipio[2])) {
    ficha.municipality = municipio[1];
    ficha.province = capitalizar(municipio[2]);
    return true;
  }
  if (soloSiEncaja) return false;
  // Continuación del nombre del centro en la columna 2.
  if (ficha.centerName && parte && !ficha.municipality) {
    ficha.centerName = `${ficha.centerName} ${parte}`;
    return true;
  }
  return false;
}

/** Los valores pueden venir fusionados ("Curso Completo Voluntaria"): anclas. */
function aplicarValores(ficha: FichaParcial, texto: string): void {
  const partes = texto.split('|').map(s => s.trim());
  for (const parte of partes) {
    if (/\bParcial\b/.test(parte)) ficha.jornada = 'Parcial';
    else if (/\bCompleta\b/.test(parte)) ficha.jornada = 'Completa';
    if (/\bVoluntaria\b/i.test(parte)) ficha.voluntary = true;
    else if (/\bObligatoria\b/i.test(parte)) ficha.voluntary = false;
    if (!/Curso Completo|Voluntaria|Obligatoria|Parcial|Completa/i.test(parte) && parte) {
      ficha.causa = ficha.causa ? `${ficha.causa} ${parte}` : parte;
    }
  }
}

function aplicarHoras(ficha: FichaParcial, texto: string): void {
  const pctSuelto = texto.match(RE_PCT_SUELTO);
  if (pctSuelto) {
    ficha.workload = numeroPct(pctSuelto[1]);
    return;
  }
  const horas = texto.match(RE_HORAS);
  if (!horas) return;
  ficha.horas = Number(horas[1]) + Number(horas[2]) / 60;
  if (horas[3]) ficha.workload = numeroPct(horas[3]);
  // Columnas extra "Si" según las etiquetas (- Compartida -, - En Distinta Localidad -).
  const valores = texto.split('|').map(s => s.trim()).slice(1);
  const etiquetas = (ficha.etiquetasHoras ?? []).slice(1);
  etiquetas.forEach((etiqueta, i) => {
    const si = /^si$/i.test(valores[i] ?? '');
    if (!si) return;
    if (/Compartida/i.test(etiqueta)) ficha.compartida = true;
    if (/Distinta Localidad/i.test(etiqueta)) ficha.distintaLocalidad = true;
  });
}

function finalizarFicha(
  ficha: FichaParcial
): { vacante: VacanteImportada } | { issue: ParseIssue } {
  const faltan: string[] = [];
  if (!ficha.bodyCode) faltan.push('cuerpo');
  if (!ficha.specialtyCode) faltan.push('especialidad');
  if (!ficha.centerCode) faltan.push('centro');
  if (!ficha.jornada) faltan.push('jornada');
  if (faltan.length) {
    return {
      issue: {
        page: ficha.page,
        message: `Ficha descartada: falta ${faltan.join(', ')}.`,
        context: ficha.numero ? `vacante ${ficha.numero}` : undefined
      }
    };
  }

  let workload = ficha.workload;
  if (workload == null) {
    if (ficha.jornada === 'Completa') workload = 1;
    else if (ficha.horas != null) {
      workload = Math.min(1, Math.round((ficha.horas / HORAS_JORNADA_COMPLETA) * 100) / 100);
    }
  }

  const tags: string[] = [];
  const requirements: VacancyRequirement[] = [];
  if (ficha.compartida) {
    tags.push('compartida');
    requirements.push({
      code: 'compartida',
      label: 'Plaza compartida entre centros',
      category: 'mobility',
      required: true,
      confidence: 1,
      sourceText: '- Compartida -: Si'
    });
  }
  if (ficha.distintaLocalidad) {
    tags.push('distinta_localidad');
    requirements.push({
      code: 'distinta_localidad',
      label: 'Compartida en distinta localidad',
      category: 'mobility',
      required: true,
      confidence: 1,
      sourceText: '- En Distinta Localidad -: Si'
    });
  }

  const requisitos = (ficha.requisitosLineas ?? []).join(' ').trim();
  if (ficha.perfilada) {
    tags.push('perfilada');
    requirements.push({
      code: 'perfilada',
      label: 'Plaza perfilada (requisitos específicos)',
      category: 'qualification',
      required: true,
      confidence: 1,
      sourceText: requisitos || '- Perfilada -: Si'
    });
  }

  // Los requisitos de la plaza perfilada se añaden al texto analizable para
  // que la extracción de etiquetas (idiomas C1/B2, etc.) también los vea.
  const info = [(ficha.infoLineas ?? []).join(' ').trim(), requisitos ? `Requisitos: ${requisitos}` : '']
    .filter(Boolean)
    .join(' ');
  const numero = ficha.numero ?? `p${ficha.page}-${ficha.centerCode}-${ficha.specialtyCode}`;

  return {
    vacante: {
      id: `ara-${numero}`,
      bodyCode: ficha.bodyCode!,
      bodyName: ficha.bodyName!,
      specialtyCode: ficha.specialtyCode!,
      specialtyName: ficha.specialtyName!,
      centerCode: ficha.centerCode!,
      centerName: ficha.centerName!,
      municipality: ficha.municipality!,
      province: ficha.province!,
      workload,
      voluntary: ficha.voluntary ?? false,
      ...(ficha.largaDuracion ? { durationType: 'long_term' as const } : {}),
      ...(info ? { additionalInfoRaw: info } : {}),
      requirements,
      tags,
      sourcePage: ficha.page
    }
  };
}

const numeroPct = (s: string): number =>
  Math.round(Number(s.replace(',', '.')) * 100) / 10000;

const capitalizar = (s: string): string =>
  s
    .toLowerCase()
    .split(/\s+/)
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
