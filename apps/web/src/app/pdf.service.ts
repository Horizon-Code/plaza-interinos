import { Injectable, inject } from '@angular/core';
import {
  normalizarItemsPdf,
  reconstruirLineas,
  type CandidatosPage,
  type PageLines
} from '@plazainterinos/core';
import { EstadoService } from './estado.service';

export interface ProgresoLectura {
  page: number;
  total: number;
}

/**
 * Lectura de PDFs en el navegador con pdf.js (carga perezosa). Los documentos
 * reales son grandes (700+ páginas): se procesa por lotes cediendo al event
 * loop para no congelar la interfaz, con progreso por página.
 */
@Injectable({ providedIn: 'root' })
export class PdfService {
  private readonly estado = inject(EstadoService);
  private pdfjs: typeof import('pdfjs-dist') | null = null;

  private async lib(): Promise<typeof import('pdfjs-dist')> {
    if (!this.pdfjs) {
      const pdfjs = await import('pdfjs-dist');
      // El worker se copia como asset propio (ver angular.json). Servirlo desde
      // la raíz evita el 403 de Vite con el node_modules hoisted del monorepo,
      // y respeta el <base href> en producción.
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdf.worker.min.mjs',
        document.baseURI
      ).toString();
      this.pdfjs = pdfjs;
    }
    return this.pdfjs;
  }

  /** Lee el PDF de vacantes y devuelve las líneas reconstruidas por página. */
  async leerVacantes(
    data: ArrayBuffer,
    onProgress?: (p: ProgresoLectura) => void
  ): Promise<PageLines[]> {
    const { getDocument } = await this.lib();
    const doc = await getDocument({ data }).promise;
    const pages: PageLines[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const { width, height } = page.getViewport({ scale: 1 });
      const items = normalizarItemsPdf(content.items as any, page.rotate, width, height);
      pages.push({ page: p, lines: reconstruirLineas(items) });
      page.cleanup();
      if (p % 20 === 0) {
        onProgress?.({ page: p, total: doc.numPages });
        await new Promise(r => setTimeout(r));
      }
    }
    onProgress?.({ page: doc.numPages, total: doc.numPages });
    await doc.destroy();
    return pages;
  }

  /** Lee el PDF de candidatos: texto por página + items para localizar el orden. */
  async leerCandidatos(
    data: ArrayBuffer,
    onProgress?: (p: ProgresoLectura) => void
  ): Promise<CandidatosPage[]> {
    const { getDocument } = await this.lib();
    const doc = await getDocument({ data }).promise;
    const pages: CandidatosPage[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const { width, height } = page.getViewport({ scale: 1 });
      const items = normalizarItemsPdf(content.items as any, page.rotate, width, height);
      pages.push({ page: p, text: items.map(i => i.str).join(' '), items });
      page.cleanup();
      if (p % 20 === 0) {
        onProgress?.({ page: p, total: doc.numPages });
        await new Promise(r => setTimeout(r));
      }
    }
    onProgress?.({ page: doc.numPages, total: doc.numPages });
    await doc.destroy();
    return pages;
  }

  /** Descarga un PDF por URL a través del proxy de la API (evita CORS). */
  descargarPdf(url: string): Promise<ArrayBuffer> {
    return this.estado.descargarPdf(url);
  }
}
