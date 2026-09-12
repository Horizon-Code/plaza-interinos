import { Injectable } from '@angular/core';
import writeXlsxFile, { type Column } from 'write-excel-file/browser';
import { formatearTrayecto, provinciaDeCentro } from '@plazainterinos/core';
import { VacanteEvaluada } from './estado.service';

/**
 * Fila del Excel final, ya aplanada. Se construye una vez y se reutiliza para
 * todas las columnas: cada `cell()` de write-excel-file recibe este objeto, no
 * la VacanteEvaluada cruda, para que el aplanado viva en un solo sitio.
 */
interface FilaFinal {
  orden: number;
  numero: string;
  centro: string;
  localidad: string;
  provincia: string;
  tipo: string;
  especialidad: string;
  jornada: string;
  informacion: string;
  trayecto: string;
  telefono: string;
  anotaciones: string;
  avisos: string;
}

const CABECERA = { fontWeight: 'bold', backgroundColor: '#e7f3ec', align: 'left' } as const;

/**
 * Paso final (SCRUM-27). Genera un .xlsx real, no un CSV renombrado: Excel y
 * LibreOffice abren el archivo sin el diálogo de importación y sin romper los
 * acentos, que es justo lo que fallaba al exportar en CSV.
 */
@Injectable({ providedIn: 'root' })
export class ExcelService {
  /**
   * @param filas Lista final YA ordenada. El orden de llegada es el que se
   *   escribe: la columna "Orden" es la posición en este array, para que el
   *   Excel coincida con lo que el usuario ve en pantalla.
   * @param anotaciones Notas por vacante. Todavía no existen (las trae
   *   SCRUM-25); cuando lleguen, basta con pasarlas aquí.
   */
  async descargar(
    filas: readonly VacanteEvaluada[],
    anotaciones?: ReadonlyMap<string, string>
  ): Promise<void> {
    const datos = filas.map((e, i) => this.aplanar(e, i + 1, anotaciones));
    await writeXlsxFile(datos, {
      columns: COLUMNAS,
      sheet: 'Lista final'
    }).toFile(this.nombreArchivo());
  }

  private aplanar(
    e: VacanteEvaluada,
    orden: number,
    anotaciones?: ReadonlyMap<string, string>
  ): FilaFinal {
    const v = e.vacancy;
    return {
      orden,
      numero: v.id,
      centro: v.centerName ?? '',
      localidad: v.municipality ?? '',
      provincia: v.province?.trim() || provinciaDeCentro(v.centerCode, v.municipality),
      tipo: v.voluntary ? 'Voluntaria' : 'Obligatoria',
      especialidad: v.specialtyName ?? '',
      jornada: v.workload != null ? `${Math.round(v.workload * 100)}%` : '',
      informacion: v.additionalInfoRaw ?? '',
      trayecto: this.trayecto(e),
      // El modelo no trae teléfono todavía. Va vacío a propósito: SCRUM-25
      // pide explícitamente no escribir nunca "Teléfono pendiente".
      telefono: '',
      anotaciones: anotaciones?.get(e.vacancyId) ?? '',
      avisos: e.warnings.map(w => w.message).join(' | ')
    };
  }

  private trayecto(e: VacanteEvaluada): string {
    return formatearTrayecto(e);
  }

  /** `Lista_PlazaInterinos_2026-08-29.xlsx`: ordenable por nombre. */
  private nombreArchivo(): string {
    const hoy = new Date();
    const iso = [
      hoy.getFullYear(),
      String(hoy.getMonth() + 1).padStart(2, '0'),
      String(hoy.getDate()).padStart(2, '0')
    ].join('-');
    return `Lista_PlazaInterinos_${iso}.xlsx`;
  }
}

/**
 * Las trece columnas que pide SCRUM-27, en su orden. Los anchos están medidos
 * para que nada salga cortado al abrir el archivo.
 */
const COLUMNAS: Column<FilaFinal>[] = [
  { header: { value: 'Orden', ...CABECERA }, width: 7, cell: f => ({ value: f.orden, type: Number }) },
  { header: { value: 'Nº vacante', ...CABECERA }, width: 14, cell: f => f.numero },
  { header: { value: 'Centro', ...CABECERA }, width: 34, cell: f => f.centro },
  { header: { value: 'Localidad', ...CABECERA }, width: 20, cell: f => f.localidad },
  { header: { value: 'Provincia', ...CABECERA }, width: 13, cell: f => f.provincia },
  { header: { value: 'Tipo', ...CABECERA }, width: 13, cell: f => f.tipo },
  { header: { value: 'Especialidad', ...CABECERA }, width: 24, cell: f => f.especialidad },
  { header: { value: 'Jornada', ...CABECERA }, width: 10, cell: f => f.jornada },
  { header: { value: 'Información adicional', ...CABECERA }, width: 42, cell: f => f.informacion },
  { header: { value: 'Trayecto', ...CABECERA }, width: 18, cell: f => f.trayecto },
  { header: { value: 'Teléfono', ...CABECERA }, width: 14, cell: f => f.telefono },
  { header: { value: 'Anotaciones', ...CABECERA }, width: 34, cell: f => f.anotaciones },
  { header: { value: 'Avisos', ...CABECERA }, width: 42, cell: f => f.avisos }
];
