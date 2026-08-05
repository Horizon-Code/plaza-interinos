/**
 * Catálogo geolocalizado de centros educativos de Aragón.
 *
 * Uso (desde la raíz del repo):
 *   npm run build:centros
 *
 * Fuente: WFS de IDEAragón (IGEAR), capas `VISOR2D:v206_educa_centros` y
 * `VISOR2D:Cen_Educa_old`. Cada centro trae `idcentrorc`, que es el mismo
 * código oficial de 8 dígitos que aparece entre paréntesis en el PDF de
 * vacantes — el cruce es exacto, sin ambigüedad de nombres.
 *
 * Dos cautelas verificadas contra los datos reales:
 *  1. El origen es EPSG:25830 (UTM 30N). Pedimos `srsName=EPSG:4326` para que
 *     el servidor reproyecte a WGS84, que es lo que espera Haversine.
 *  2. Las propiedades `longitud`/`latitud` de algunos registros están
 *     desactualizadas y no coinciden con la geometría. Mandan las coordenadas
 *     de `geometry`; los descuadres se avisan por consola.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const WFS = 'https://idearagon.aragon.es/geoserver/wfs';
/** Se combinan porque ninguna capa por separado cubre todos los centros. */
const CAPAS = ['VISOR2D:v206_educa_centros', 'VISOR2D:Cen_Educa_old'];

/** Aragón cae dentro de esta caja en WGS84: sirve de red de seguridad. */
const CAJA_ARAGON = { latMin: 39.8, latMax: 43.0, lonMin: -2.2, lonMax: 1.0 };

async function descargarCapa(capa) {
  const url =
    `${WFS}?service=WFS&version=2.0.0&request=GetFeature` +
    `&typeNames=${encodeURIComponent(capa)}&outputFormat=application/json&srsName=EPSG:4326`;
  const respuesta = await fetch(url);
  if (!respuesta.ok) throw new Error(`${capa}: HTTP ${respuesta.status}`);
  const { features } = await respuesta.json();
  if (!features?.length) throw new Error(`${capa}: sin features`);
  return features;
}

const centros = new Map();
let descuadres = 0;
let fueraDeCaja = 0;

for (const capa of CAPAS) {
  const features = await descargarCapa(capa);
  let nuevos = 0;
  for (const feature of features) {
    const p = feature.properties ?? {};
    const coords = feature.geometry?.coordinates;
    const codigo = String(p.idcentrorc ?? '').padStart(8, '0');
    if (!coords || !/^\d{8}$/.test(codigo)) continue;

    // GeoJSON es [lon, lat]: invertirlos aquí es el error clásico.
    const [lng, lat] = coords;
    if (
      lat < CAJA_ARAGON.latMin || lat > CAJA_ARAGON.latMax ||
      lng < CAJA_ARAGON.lonMin || lng > CAJA_ARAGON.lonMax
    ) {
      fueraDeCaja += 1;
      continue;
    }
    if (p.latitud != null && (Math.abs(lat - p.latitud) > 0.001 || Math.abs(lng - p.longitud) > 0.001)) {
      descuadres += 1;
    }
    if (centros.has(codigo)) continue;
    centros.set(codigo, {
      lat: Math.round(lat * 1e6) / 1e6,
      lng: Math.round(lng * 1e6) / 1e6,
      nombre: (p.nombre_cen ?? '').trim() || undefined,
      municipio: (p.localidad ?? '').trim() || undefined
    });
    nuevos += 1;
  }
  console.error(`  ${capa}: ${features.length} features, ${nuevos} centros nuevos.`);
}

if (centros.size < 500) {
  throw new Error(`Solo ${centros.size} centros: la fuente ha cambiado, revisa las capas antes de escribir.`);
}
if (fueraDeCaja) console.error(`  ⚠ ${fueraDeCaja} centros fuera de la caja de Aragón: descartados.`);
if (descuadres) {
  console.error(`  ⚠ ${descuadres} centros con longitud/latitud desactualizadas en las propiedades (manda la geometría).`);
}

const ordenados = [...centros.entries()].sort(([a], [b]) => a.localeCompare(b));
const filas = ordenados
  .map(([codigo, c]) => {
    const nombre = JSON.stringify(c.nombre ?? '');
    const municipio = JSON.stringify(c.municipio ?? '');
    return `  '${codigo}': { lat: ${c.lat}, lng: ${c.lng}, nombre: ${nombre}, municipio: ${municipio} }`;
  })
  .join(',\n');

const destino = join(raiz, 'packages/core/src/catalog/centros-aragon.ts');
mkdirSync(dirname(destino), { recursive: true });
writeFileSync(
  destino,
  `/**
 * Centros educativos de Aragón con coordenadas WGS84, indexados por el código
 * oficial de 8 dígitos (RCE) que trae el PDF de vacantes.
 *
 * GENERADO por \`npm run build:centros\` desde el WFS de IDEAragón — no editar a mano.
 * Fuente: ${CAPAS.join(' + ')} (licencia abierta, Gobierno de Aragón).
 */

export interface CentroGeolocalizado {
  lat: number;
  lng: number;
  nombre: string;
  municipio: string;
}

export const CENTROS_ARAGON: Record<string, CentroGeolocalizado> = {
${filas}
};
`
);
console.error(`Catálogo escrito en ${destino}: ${centros.size} centros.`);
