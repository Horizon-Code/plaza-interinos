// Copia el worker de pdf.js al directorio public/ de la web para que Angular lo
// sirva como asset propio. Se ejecuta antes de servir/compilar, de modo que el
// worker siempre coincide con la versión de pdfjs-dist instalada (evita desajustes
// de versión al actualizar y el 403 de Vite con el node_modules hoisted).
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const raiz = dirname(fileURLToPath(import.meta.url)); // apps/web/scripts
const origen = require.resolve('pdfjs-dist/build/pdf.worker.min.mjs');
const destinoDir = join(raiz, '..', 'public');
const destino = join(destinoDir, 'pdf.worker.min.mjs');

mkdirSync(destinoDir, { recursive: true });
copyFileSync(origen, destino);
console.log(`worker pdf.js copiado → ${destino}`);
