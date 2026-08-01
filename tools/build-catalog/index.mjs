/**
 * Herramienta de calibración sobre los PDFs reales de Aragón.
 *
 * Usos (desde la raíz del repo, con el core compilado):
 *   node tools/build-catalog/index.mjs                      → regenera el catálogo de cuerpos/especialidades
 *   node tools/build-catalog/index.mjs --dump-lines 1-6     → vuelca líneas de vacantes.pdf (fixtures)
 *   node tools/build-catalog/index.mjs --dump-candidatos 1-3 → vuelca páginas de candidatos.pdf (fixtures)
 *   node tools/build-catalog/index.mjs --check              → parsea vacantes.pdf entero y reporta issues
 */
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const core = await import(join(raiz, 'packages/core/dist/index.js'));
const { reconstruirLineas, parseVacantesAragon } = core;

async function abrirPdf(ruta) {
  const data = new Uint8Array(readFileSync(ruta));
  return await getDocument({ data, useSystemFonts: true }).promise;
}

/** Normaliza los items de pdf.js a {str,x,y}, corrigiendo la rotación de página. */
function itemsNormalizados(page, content) {
  const rot = ((page.rotate % 360) + 360) % 360;
  const { width, height } = page.getViewport({ scale: 1 });
  return content.items
    .filter(it => 'str' in it && it.str.trim())
    .map(it => {
      const tx = it.transform[4];
      const ty = it.transform[5];
      if (rot === 90) return { str: it.str, x: ty, y: width - tx };
      if (rot === 270) return { str: it.str, x: height - ty, y: tx };
      if (rot === 180) return { str: it.str, x: width - tx, y: height - ty };
      return { str: it.str, x: tx, y: ty };
    });
}

async function paginasDeLineas(doc, desde = 1, hasta = doc.numPages) {
  const pages = [];
  for (let p = desde; p <= hasta; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    pages.push({ page: p, lines: reconstruirLineas(itemsNormalizados(page, content)) });
    if (p % 100 === 0) console.error(`  … página ${p}/${hasta}`);
  }
  return pages;
}

function rango(arg) {
  const [a, b] = (arg ?? '').split('-').map(Number);
  return [a || 1, b || a || 1];
}

const argv = process.argv.slice(2);
const flag = name => {
  const i = argv.indexOf(name);
  return i === -1 ? null : argv[i + 1] ?? '';
};

if (argv.includes('--dump-lines')) {
  const [a, b] = rango(flag('--dump-lines'));
  const doc = await abrirPdf(join(raiz, 'docs/vacantes.pdf'));
  const pages = await paginasDeLineas(doc, a, b);
  console.log(JSON.stringify(pages, null, 2));
} else if (argv.includes('--dump-candidatos')) {
  const [a, b] = rango(flag('--dump-candidatos'));
  const doc = await abrirPdf(join(raiz, 'docs/candidatos.pdf'));
  const pages = [];
  for (let p = a; p <= b; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items = itemsNormalizados(page, content);
    pages.push({ page: p, text: items.map(i => i.str).join(' '), items });
  }
  console.log(JSON.stringify(pages, null, 2));
} else if (argv.includes('--find')) {
  const nombre = flag('--find');
  const doc = await abrirPdf(join(raiz, 'docs/candidatos.pdf'));
  console.error(`Buscando "${nombre}" en ${doc.numPages} páginas…`);
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items = itemsNormalizados(page, content);
    pages.push({ page: p, text: items.map(i => i.str).join(' '), items });
    if (p % 100 === 0) console.error(`  … página ${p}/${doc.numPages}`);
  }
  const matches = core.findCandidateSpecialties(pages, nombre);
  console.log(JSON.stringify(matches, null, 2));
} else if (argv.includes('--check')) {
  const doc = await abrirPdf(join(raiz, 'docs/vacantes.pdf'));
  console.error(`Parseando ${doc.numPages} páginas…`);
  const pages = await paginasDeLineas(doc);
  const { vacancies, issues } = parseVacantesAragon(pages);
  console.log(`Vacantes parseadas: ${vacancies.length}`);
  console.log(`Issues: ${issues.length}`);
  for (const issue of issues.slice(0, 20)) {
    console.log(`  p${issue.page}: ${issue.message} ${issue.context ?? ''}`);
  }
  const conInfo = vacancies.filter(v => v.additionalInfoRaw).length;
  const parciales = vacancies.filter(v => v.workload != null && v.workload < 1).length;
  console.log(`Con información adicional: ${conInfo} · Parciales: ${parciales} · Voluntarias: ${vacancies.filter(v => v.voluntary).length}`);
} else {
  // Modo por defecto: regenerar el catálogo de cuerpos/especialidades.
  const doc = await abrirPdf(join(raiz, 'docs/vacantes.pdf'));
  console.error(`Extrayendo catálogo de ${doc.numPages} páginas…`);
  const pages = await paginasDeLineas(doc);
  const { vacancies, issues } = parseVacantesAragon(pages);
  console.error(`  ${vacancies.length} vacantes, ${issues.length} issues.`);

  const cuerpos = new Map();
  for (const v of vacancies) {
    if (!cuerpos.has(v.bodyCode)) {
      cuerpos.set(v.bodyCode, { code: v.bodyCode, name: v.bodyName, especialidades: new Map() });
    }
    const cuerpo = cuerpos.get(v.bodyCode);
    if (!cuerpo.especialidades.has(v.specialtyCode)) {
      cuerpo.especialidades.set(v.specialtyCode, { code: v.specialtyCode, name: v.specialtyName });
    }
  }
  const catalogo = [...cuerpos.values()]
    .sort((a, b) => a.code.localeCompare(b.code))
    .map(c => ({
      code: c.code,
      name: c.name,
      especialidades: [...c.especialidades.values()].sort((a, b) => a.code.localeCompare(b.code))
    }));

  const destino = join(raiz, 'packages/core/src/catalog/cuerpos-especialidades.ts');
  mkdirSync(dirname(destino), { recursive: true });
  const contenido = `/**
 * Catálogo de cuerpos y especialidades docentes de Aragón.
 * GENERADO por \`npm run build:catalog\` a partir de docs/vacantes.pdf — no editar a mano.
 */

export interface CatalogoEspecialidad {
  code: string;
  name: string;
}

export interface CatalogoCuerpo {
  code: string;
  name: string;
  especialidades: CatalogoEspecialidad[];
}

export const CUERPOS: CatalogoCuerpo[] = ${JSON.stringify(catalogo, null, 2)};
`;
  writeFileSync(destino, contenido);
  console.error(`Catálogo escrito en ${destino}: ${catalogo.length} cuerpos, ${catalogo.reduce((n, c) => n + c.especialidades.length, 0)} especialidades.`);
}
