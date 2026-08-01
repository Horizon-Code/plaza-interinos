import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  CUERPOS,
  findCandidateSpecialties,
  parseVacantesAragon,
  type CandidateMatch,
  type CandidatosPage
} from '@plazainterinos/core';
import { EstadoService } from './estado.service';
import { PdfService } from './pdf.service';

type Cargando = null | { fase: string; pagina: number; total: number };

@Component({
  selector: 'tp-importar',
  standalone: true,
  imports: [FormsModule],
  template: `
    <h1>Importa tu convocatoria</h1>
    <p class="lead">
      Sube el PDF oficial de vacantes y, si quieres, el de candidatos: con tu
      nombre localizamos en qué cuerpos y especialidades puedes pedir plaza.
    </p>

    <!-- ── Bloque 1: vacantes ─────────────────────────────────────────── -->
    <div class="card">
      <h2>1 · Vacantes (PDF oficial)</h2>
      <div
        class="dropzone"
        [class.activa]="arrastrandoVacantes()"
        (dragover)="$event.preventDefault(); arrastrandoVacantes.set(true)"
        (dragleave)="arrastrandoVacantes.set(false)"
        (drop)="soltarVacantes($event)"
      >
        @if (vacantesListas()) {
          <p>✓ <strong>{{ estado.vacantesParseadas().length }}</strong> vacantes leídas
            @if (issuesVacantes() > 0) { <span class="chip aviso">{{ issuesVacantes() }} fichas ilegibles</span> }
          </p>
          <p class="fuente">Puedes soltar otro PDF para sustituirlo.</p>
        } @else {
          <p>Arrastra aquí el PDF de vacantes…</p>
        }
        <div class="fila-botones">
          <button type="button" (click)="inputVacantes.click()">Elegir PDF</button>
          <input #inputVacantes type="file" accept="application/pdf" hidden
                 (change)="ficheroVacantes($event)" />
        </div>
        <div class="fila-url">
          <input type="url" [(ngModel)]="urlVacantes" placeholder="…o pega el enlace del PDF (https://…)" />
          <button type="button" class="secundario" (click)="urlVacantesCargar()"
                  [disabled]="!urlVacantes.trim()">Cargar desde URL</button>
        </div>
      </div>
    </div>

    <!-- ── Bloque 2: candidatos (opcional) ────────────────────────────── -->
    <div class="card">
      <h2>2 · Candidatos (opcional)</h2>
      <p class="fuente">
        El PDF de candidatos nos dice en qué cuerpos y especialidades aparece tu
        nombre. Si no lo tienes, añádelas a mano más abajo.
      </p>
      <label>Tu nombre y apellidos, tal como aparece en las listas (APELLIDOS, NOMBRE)</label>
      <input type="text" [(ngModel)]="nombreCandidato" placeholder="GARCÍA LÓPEZ, MARÍA"
             (ngModelChange)="rebuscarCandidato()" />

      <div
        class="dropzone"
        [class.activa]="arrastrandoCandidatos()"
        (dragover)="$event.preventDefault(); arrastrandoCandidatos.set(true)"
        (dragleave)="arrastrandoCandidatos.set(false)"
        (drop)="soltarCandidatos($event)"
      >
        @if (paginasCandidatos) {
          <p>✓ PDF de candidatos leído ({{ paginasCandidatos.length }} páginas).</p>
        } @else {
          <p>Arrastra aquí el PDF de candidatos…</p>
        }
        <div class="fila-botones">
          <button type="button" (click)="inputCandidatos.click()">Elegir PDF</button>
          <input #inputCandidatos type="file" accept="application/pdf" hidden
                 (change)="ficheroCandidatos($event)" />
        </div>
        <div class="fila-url">
          <input type="url" [(ngModel)]="urlCandidatos" placeholder="…o pega el enlace del PDF (https://…)" />
          <button type="button" class="secundario" (click)="urlCandidatosCargar()"
                  [disabled]="!urlCandidatos.trim()">Cargar desde URL</button>
        </div>
      </div>

      @if (paginasCandidatos && nombreCandidato.trim() && estado.especialidadesUsuario().length === 0) {
        <p class="error">No hemos encontrado ese nombre en las listas. Comprueba el formato
          "APELLIDOS, NOMBRE" o añade tus especialidades a mano.</p>
      }

      <!-- Especialidades del aspirante (detectadas + manuales) -->
      @if (estado.especialidadesUsuario().length) {
        <label>Puedes aspirar a:</label>
        <div class="chips">
          @for (e of estado.especialidadesUsuario(); track e.bodyCode + e.specialtyCode) {
            <span class="chip ok">
              {{ e.bodyCode }} · {{ e.specialtyName }}
              @if (e.orden != null) { (orden {{ e.orden }}) }
              <button type="button" class="quitar" (click)="quitarEspecialidad(e)">✕</button>
            </span>
          }
        </div>
      }

      <label>Añadir cuerpo y especialidad a mano</label>
      <div class="fila-selects">
        <select [(ngModel)]="cuerpoManual">
          <option value="">— Cuerpo —</option>
          @for (c of cuerpos; track c.code) {
            <option [value]="c.code">{{ c.code }} · {{ c.name }}</option>
          }
        </select>
        <select [(ngModel)]="especialidadManual" [disabled]="!cuerpoManual">
          <option value="">— Especialidad —</option>
          @for (e of especialidadesDelCuerpo(); track e.code) {
            <option [value]="e.code">{{ e.code }} · {{ e.name }}</option>
          }
        </select>
        <button type="button" class="secundario" (click)="anadirManual()"
                [disabled]="!cuerpoManual || !especialidadManual">Añadir</button>
      </div>
    </div>

    <!-- ── Progreso / errores ─────────────────────────────────────────── -->
    @if (cargando(); as c) {
      <div class="card progreso">
        <span class="spinner"></span>
        {{ c.fase }} — página {{ c.pagina }} de {{ c.total }}
      </div>
    }
    @if (estado.error()) { <p class="error">{{ estado.error() }}</p> }

    <!-- ── Descubrir vacantes ─────────────────────────────────────────── -->
    <div class="fila-botones" style="margin-top:16px;">
      <button (click)="descubrir()" [disabled]="!puedeDescubrir()">
        @if (descubriendo()) { <span class="spinner"></span> Casando vacantes… }
        @else { Descubrir vacantes }
      </button>
      @if (!puedeDescubrir() && !descubriendo()) {
        <span class="fuente">Necesitas el PDF de vacantes y al menos una especialidad.</span>
      }
    </div>

    <!-- ── Resumen ────────────────────────────────────────────────────── -->
    @if (estado.resumen(); as resumen) {
      <h2>Hemos detectado</h2>
      <div class="metricas">
        <div class="metrica"><div class="n">{{ resumen.total }}</div><div class="l">vacantes tuyas</div></div>
        <div class="metrica"><div class="n">{{ resumen.voluntary }}</div><div class="l">voluntarias</div></div>
        <div class="metrica"><div class="n">{{ resumen.languageRequirement }}</div><div class="l">con requisito de idioma</div></div>
        <div class="metrica"><div class="n">{{ resumen.afternoon }}</div><div class="l">con horario de tarde</div></div>
        <div class="metrica"><div class="n">{{ resumen.ambiguous }}</div><div class="l">con información ambigua</div></div>
      </div>
      <button (click)="continuar()">Continuar con mi perfil</button>
    }

    <!-- ── Vía de escape avanzada ─────────────────────────────────────── -->
    <details style="margin-top:24px;">
      <summary class="fuente">Avanzado: pegar vacantes en JSON</summary>
      <div class="card">
        <textarea [value]="textoJson()" (input)="textoJson.set($any($event.target).value)"
          placeholder='[{ "bodyCode": "0590", "specialtyCode": "006", "municipality": "Zaragoza", "additionalInfoRaw": "…" }]'></textarea>
        <button class="secundario" (click)="importarJson()" [disabled]="!textoJson().trim()">Importar JSON</button>
      </div>
    </details>
  `
})
export class ImportarComponent {
  readonly estado = inject(EstadoService);
  private readonly pdf = inject(PdfService);
  private readonly router = inject(Router);

  readonly cuerpos = CUERPOS;
  readonly cargando = signal<Cargando>(null);
  readonly descubriendo = signal(false);
  readonly arrastrandoVacantes = signal(false);
  readonly arrastrandoCandidatos = signal(false);
  readonly issuesVacantes = signal(0);
  readonly textoJson = signal('');

  urlVacantes = '';
  urlCandidatos = '';
  nombreCandidato = '';
  cuerpoManual = '';
  especialidadManual = '';

  /** Páginas del PDF de candidatos, para rebuscar si cambia el nombre. */
  paginasCandidatos: CandidatosPage[] | null = null;
  /** Especialidades añadidas a mano (se combinan con las detectadas). */
  private manuales: CandidateMatch[] = [];
  private detectadas: CandidateMatch[] = [];

  vacantesListas(): boolean {
    return this.estado.vacantesParseadas().length > 0;
  }

  puedeDescubrir(): boolean {
    return this.vacantesListas() && this.estado.especialidadesUsuario().length > 0 && !this.descubriendo();
  }

  especialidadesDelCuerpo() {
    return this.cuerpos.find(c => c.code === this.cuerpoManual)?.especialidades ?? [];
  }

  // ── Vacantes ──────────────────────────────────────────────────────────
  async ficheroVacantes(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) await this.procesarVacantes(await file.arrayBuffer());
  }

  async soltarVacantes(event: DragEvent): Promise<void> {
    event.preventDefault();
    this.arrastrandoVacantes.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) await this.procesarVacantes(await file.arrayBuffer());
  }

  async urlVacantesCargar(): Promise<void> {
    await this.conErrores(async () => {
      this.cargando.set({ fase: 'Descargando PDF de vacantes', pagina: 0, total: 0 });
      const data = await this.pdf.descargarPdf(this.urlVacantes.trim());
      await this.procesarVacantes(data);
    });
  }

  private async procesarVacantes(data: ArrayBuffer): Promise<void> {
    await this.conErrores(async () => {
      const pages = await this.pdf.leerVacantes(data, p =>
        this.cargando.set({ fase: 'Leyendo vacantes', pagina: p.page, total: p.total })
      );
      const { vacancies, issues } = parseVacantesAragon(pages);
      if (!vacancies.length) {
        throw new Error('No se ha reconocido ninguna vacante en ese PDF. ¿Es el documento oficial de vacantes?');
      }
      this.estado.vacantesParseadas.set(vacancies);
      this.issuesVacantes.set(issues.length);
    });
  }

  // ── Candidatos ────────────────────────────────────────────────────────
  async ficheroCandidatos(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) await this.procesarCandidatos(await file.arrayBuffer());
  }

  async soltarCandidatos(event: DragEvent): Promise<void> {
    event.preventDefault();
    this.arrastrandoCandidatos.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) await this.procesarCandidatos(await file.arrayBuffer());
  }

  async urlCandidatosCargar(): Promise<void> {
    await this.conErrores(async () => {
      this.cargando.set({ fase: 'Descargando PDF de candidatos', pagina: 0, total: 0 });
      const data = await this.pdf.descargarPdf(this.urlCandidatos.trim());
      await this.procesarCandidatos(data);
    });
  }

  private async procesarCandidatos(data: ArrayBuffer): Promise<void> {
    await this.conErrores(async () => {
      this.paginasCandidatos = await this.pdf.leerCandidatos(data, p =>
        this.cargando.set({ fase: 'Leyendo candidatos', pagina: p.page, total: p.total })
      );
      this.rebuscarCandidato();
    });
  }

  rebuscarCandidato(): void {
    if (!this.paginasCandidatos) return;
    const nombre = this.nombreCandidato.trim();
    this.detectadas = nombre ? findCandidateSpecialties(this.paginasCandidatos, nombre) : [];
    this.combinarEspecialidades();
  }

  // ── Especialidades manuales ───────────────────────────────────────────
  anadirManual(): void {
    const cuerpo = this.cuerpos.find(c => c.code === this.cuerpoManual);
    const especialidad = cuerpo?.especialidades.find(e => e.code === this.especialidadManual);
    if (!cuerpo || !especialidad) return;
    this.manuales.push({
      bodyCode: cuerpo.code,
      bodyName: cuerpo.name,
      specialtyCode: especialidad.code,
      specialtyName: especialidad.name,
      page: 0
    });
    this.especialidadManual = '';
    this.combinarEspecialidades();
  }

  quitarEspecialidad(e: CandidateMatch): void {
    const clave = `${e.bodyCode}-${e.specialtyCode}`;
    this.manuales = this.manuales.filter(m => `${m.bodyCode}-${m.specialtyCode}` !== clave);
    this.detectadas = this.detectadas.filter(d => `${d.bodyCode}-${d.specialtyCode}` !== clave);
    this.combinarEspecialidades();
  }

  private combinarEspecialidades(): void {
    const todas = new Map<string, CandidateMatch>();
    for (const e of [...this.detectadas, ...this.manuales]) {
      todas.set(`${e.bodyCode}-${e.specialtyCode}`, e);
    }
    this.estado.especialidadesUsuario.set([...todas.values()]);
  }

  // ── Descubrir ─────────────────────────────────────────────────────────
  async descubrir(): Promise<void> {
    const claves = new Set(
      this.estado.especialidadesUsuario().map(e => `${e.bodyCode}-${e.specialtyCode}`)
    );
    const tuyas = this.estado
      .vacantesParseadas()
      .filter(v => claves.has(`${v.bodyCode}-${v.specialtyCode}`));
    if (!tuyas.length) {
      this.estado.error.set('Ninguna vacante del PDF corresponde a tus cuerpos y especialidades.');
      return;
    }
    this.descubriendo.set(true);
    try {
      await this.estado.importar(tuyas);
    } catch (error) {
      this.estado.error.set(String(error instanceof Error ? error.message : error));
    } finally {
      this.descubriendo.set(false);
    }
  }

  async importarJson(): Promise<void> {
    try {
      const vacancies = JSON.parse(this.textoJson());
      await this.estado.importar(vacancies);
    } catch (error) {
      this.estado.error.set(error instanceof SyntaxError ? 'El JSON no es válido.' : String(error));
    }
  }

  continuar(): void {
    this.router.navigate(['/perfil']);
  }

  private async conErrores(fn: () => Promise<void>): Promise<void> {
    this.estado.error.set('');
    try {
      await fn();
    } catch (error) {
      this.estado.error.set(String(error instanceof Error ? error.message : error));
    } finally {
      this.cargando.set(null);
    }
  }
}
