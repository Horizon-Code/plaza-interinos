import { Component, computed, inject, signal } from '@angular/core';
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

/** A qué zona de arrastre pertenece el progreso que se está mostrando. */
type Destino = 'vacantes' | 'candidatos';

/** `total` a 0 = aún no se sabe cuántas páginas hay (descarga o apertura). */
type Cargando = null | { destino: Destino; fase: string; pagina: number; total: number };

@Component({
  selector: 'tp-importar',
  standalone: true,
  imports: [FormsModule],
  template: `
    <h1>Importa tu convocatoria</h1>
    <p class="lead">
      Sube el PDF oficial de vacantes y, si quieres, indica tus listas para
      descubrir las plazas que mejor encajan contigo.
    </p>

    <!-- ── Bloque 1: vacantes ─────────────────────────────────────────── -->
    <section class="card seccion">
      <div class="seccion-cab">
        <span class="seccion-icono" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
            <path d="M14 2v5h5" /><path d="M9 13h6" /><path d="M9 17h4" />
          </svg>
        </span>
        <h2>1 · Vacantes (PDF oficial)</h2>
      </div>

      <div class="seccion-cuerpo">
        <!-- Toda la zona es clicable; el input vive fuera para que su propio
             click no vuelva a burbujear hasta aquí. -->
        <div
          class="dropzone"
          [class.activa]="arrastrandoVacantes()"
          [class.ocupada]="cargandoDe('vacantes')"
          (click)="cargando() || inputVacantes.click()"
          (dragover)="$event.preventDefault(); arrastrandoVacantes.set(true)"
          (dragleave)="arrastrandoVacantes.set(false)"
          (drop)="soltarVacantes($event)"
        >
          <span class="icono" aria-hidden="true">
            @if (cargandoDe('vacantes')) {
              <span class="spinner"></span>
            } @else {
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6.5 18a4.5 4.5 0 0 1-.7-8.95A6 6 0 0 1 17.7 8.4 4.3 4.3 0 0 1 17.5 18z" />
                <path d="M12 12v6" /><path d="m9.5 14.5 2.5-2.5 2.5 2.5" />
              </svg>
            }
          </span>
          <span class="texto" aria-live="polite">
            @if (cargandoDe('vacantes'); as c) {
              <span class="estado" animate.enter="aparece">
                <strong>{{ c.fase }}…</strong>
                <span>{{ progresoTexto(c) }}</span>
                <span class="barra" [class.indeterminada]="!c.total">
                  <span [style.width.%]="porcentaje(c)"></span>
                </span>
              </span>
            } @else if (vacantesListas()) {
              <span class="estado" animate.enter="aparece">
                <strong>✓ {{ estado.vacantesParseadas().length }} vacantes leídas</strong>
                @if (issuesVacantes() > 0) {
                  <span class="aviso">{{ issuesVacantes() }} fichas ilegibles</span>
                } @else {
                  <span>Puedes soltar otro PDF para sustituirlo.</span>
                }
              </span>
            } @else {
              <span class="estado">
                <strong>Arrastra aquí el PDF de vacantes</strong>
                <span>o haz clic para seleccionar</span>
              </span>
            }
          </span>
          <button type="button" [disabled]="!!cargando()">Elegir PDF</button>
        </div>
        <input #inputVacantes type="file" accept="application/pdf" hidden
               (change)="ficheroVacantes($event)" />

        <fieldset class="campo-url">
          <legend>o pega el enlace del PDF (https://…)</legend>
          <input type="url" [(ngModel)]="urlVacantes" placeholder="https://ejemplo.com/vacantes.pdf" />
          <button type="button" class="secundario" (click)="urlVacantesCargar()"
                  [disabled]="!urlVacantes.trim() || !!cargando()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
              <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
            </svg>
            Cargar desde URL
          </button>
        </fieldset>
      </div>
    </section>

    <!-- ── Bloque 2: especialidades del aspirante ─────────────────────── -->
    <section class="card seccion">
      <div class="seccion-cab">
        <span class="seccion-icono" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20" />
            <circle cx="10" cy="8" r="3.2" /><path d="M19 20v-1.5a3.5 3.5 0 0 0-2.6-3.4" />
            <path d="M15 5.2a3.2 3.2 0 0 1 0 5.6" />
          </svg>
        </span>
        <h2>2 · Especialidades</h2>
        <button type="button" class="plegar" [class.cerrado]="!seccionAbierta()"
                [attr.aria-expanded]="seccionAbierta()"
                aria-label="Plegar o desplegar las especialidades"
                (click)="seccionAbierta.set(!seccionAbierta())">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m6 15 6-6 6 6" />
          </svg>
        </button>
      </div>

      @if (seccionAbierta()) {
        <div class="plegable" animate.enter="despliega" animate.leave="repliega">
        <div class="seccion-cuerpo opciones">
          <!-- Vía A: PDF de candidatos + nombre -->
          <div class="opcion" [class.activa]="viaPdfEnUso()">
            <button type="button" class="opcion-cab" [class.cerrado]="!abiertoPdf()"
                    [attr.aria-expanded]="abiertoPdf()"
                    (click)="abiertoPdf.set(!abiertoPdf())">
              <span class="marca-estado" aria-hidden="true">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m5 12 5 5 9-10" />
                </svg>
              </span>
              <span class="titulo">Usar PDF y nombre</span>
              <span class="senal" aria-hidden="true">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m6 15 6-6 6 6" />
                </svg>
              </span>
            </button>

            @if (abiertoPdf()) {
              <div class="plegable" animate.enter="despliega" animate.leave="repliega">
              <div class="opcion-cuerpo">
                <label for="nombre-candidato">Tu nombre y apellidos, tal como aparece en las listas</label>
                <input id="nombre-candidato" type="text" [(ngModel)]="nombreCandidato"
                       placeholder="GARCÍA LÓPEZ, MARÍA" (ngModelChange)="rebuscarCandidato()" />

                <label>PDF de candidatos</label>
                <div
                  class="dropzone"
                  [class.activa]="arrastrandoCandidatos()"
                  [class.ocupada]="cargandoDe('candidatos')"
                  (click)="cargando() || inputCandidatos.click()"
                  (dragover)="$event.preventDefault(); arrastrandoCandidatos.set(true)"
                  (dragleave)="arrastrandoCandidatos.set(false)"
                  (drop)="soltarCandidatos($event)"
                >
                  <span class="icono" aria-hidden="true">
                    @if (cargandoDe('candidatos')) {
                      <span class="spinner"></span>
                    } @else {
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                           stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M6.5 18a4.5 4.5 0 0 1-.7-8.95A6 6 0 0 1 17.7 8.4 4.3 4.3 0 0 1 17.5 18z" />
                        <path d="M12 12v6" /><path d="m9.5 14.5 2.5-2.5 2.5 2.5" />
                      </svg>
                    }
                  </span>
                  <span class="texto" aria-live="polite">
                    @if (cargandoDe('candidatos'); as c) {
                      <span class="estado" animate.enter="aparece">
                        <strong>{{ c.fase }}…</strong>
                        <span>{{ progresoTexto(c) }}</span>
                        <span class="barra" [class.indeterminada]="!c.total">
                          <span [style.width.%]="porcentaje(c)"></span>
                        </span>
                      </span>
                    } @else if (paginasCandidatos) {
                      <span class="estado" animate.enter="aparece">
                        <strong>✓ PDF de candidatos leído</strong>
                        <span>{{ paginasCandidatos.length }} páginas. Puedes soltar otro para sustituirlo.</span>
                      </span>
                    } @else {
                      <span class="estado">
                        <strong>Arrastra aquí el PDF de candidatos</strong>
                        <span>o haz clic para seleccionar</span>
                      </span>
                    }
                  </span>
                  <button type="button" [disabled]="!!cargando()">Elegir PDF</button>
                </div>
                <input #inputCandidatos type="file" accept="application/pdf" hidden
                       (change)="ficheroCandidatos($event)" />

                <fieldset class="campo-url">
                  <legend>o pega el enlace del PDF (https://…)</legend>
                  <input type="url" [(ngModel)]="urlCandidatos" placeholder="https://ejemplo.com/candidatos.pdf" />
                  <button type="button" class="secundario" (click)="urlCandidatosCargar()"
                          [disabled]="!urlCandidatos.trim() || !!cargando()">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         stroke-width="2" stroke-linecap="round" aria-hidden="true">
                      <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
                      <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
                    </svg>
                    Cargar desde URL
                  </button>
                </fieldset>

                @if (paginasCandidatos && nombreCandidato.trim() && detectadas.length === 0) {
                  <p class="error">No hemos encontrado ese nombre en las listas. Comprueba el
                    formato "APELLIDOS, NOMBRE" o añade tus especialidades a mano.</p>
                }
              </div>
              </div>
            }
          </div>

          <!-- Vía B: a mano. Complementaria, no alternativa: se suma a lo que
               haya detectado el PDF. -->
          <div class="opcion" [class.activa]="manuales.length > 0">
            <button type="button" class="opcion-cab" [class.cerrado]="!abiertoManual()"
                    [attr.aria-expanded]="abiertoManual()"
                    (click)="abiertoManual.set(!abiertoManual())">
              <span class="marca-estado" aria-hidden="true">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m5 12 5 5 9-10" />
                </svg>
              </span>
              <span class="titulo">Añadir especialidades a mano</span>
              <span class="senal" aria-hidden="true">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m6 15 6-6 6 6" />
                </svg>
              </span>
            </button>

            @if (abiertoManual()) {
              <div class="plegable" animate.enter="despliega" animate.leave="repliega">
              <div class="opcion-cuerpo">
                <div class="fila-selects">
                  <div class="campo">
                    <label for="cuerpo-manual">Cuerpo</label>
                    <select id="cuerpo-manual" [(ngModel)]="cuerpoManual"
                            (ngModelChange)="especialidadManual = ''">
                      <option value="">Selecciona…</option>
                      @for (c of cuerpos; track c.code) {
                        <option [value]="c.code">{{ c.code }} · {{ c.name }}</option>
                      }
                    </select>
                  </div>
                  <div class="campo">
                    <label for="especialidad-manual">Especialidad</label>
                    <select id="especialidad-manual" [(ngModel)]="especialidadManual"
                            [disabled]="!cuerpoManual">
                      <option value="">Selecciona…</option>
                      @for (e of especialidadesDelCuerpo(); track e.code) {
                        <option [value]="e.code">{{ e.code }} · {{ e.name }}</option>
                      }
                    </select>
                  </div>
                  <div class="campo estrecho">
                    <label for="orden-manual">Lugar en listas <span class="opcional">(opcional)</span></label>
                    <input id="orden-manual" type="number" min="1" [(ngModel)]="ordenManual"
                           placeholder="N.º (opcional)" />
                  </div>
                  <button type="button" class="secundario" (click)="anadirManual()"
                          [disabled]="!cuerpoManual || !especialidadManual">Añadir</button>
                </div>
              </div>
              </div>
            }
          </div>

          <!-- Especialidades reunidas por cualquiera de las dos vías -->
          @if (estado.especialidadesUsuario().length) {
            <div>
              <label>Puedes aspirar a:</label>
              <div class="chips">
                @for (e of estado.especialidadesUsuario(); track e.bodyCode + e.specialtyCode) {
                  <span class="chip ok" animate.enter="entra-chip" animate.leave="sale-chip">
                    {{ e.bodyCode }} · {{ e.specialtyName }}
                    @if (e.orden != null) { (orden {{ e.orden }}) }
                    <button type="button" class="quitar"
                            [attr.aria-label]="'Quitar ' + e.specialtyName"
                            (click)="quitarEspecialidad(e)">✕</button>
                  </span>
                }
              </div>
            </div>
          }
        </div>
        </div>
      }
    </section>

    <!-- El progreso ya se pinta dentro de la zona que lo provoca; aquí solo
         quedan los errores. -->
    @if (estado.error()) { <p class="error">{{ estado.error() }}</p> }

    <!-- ── Descubrir vacantes ─────────────────────────────────────────────
         Se retira cuando su resultado ya está debajo y vuelve si los datos
         cambian: un botón que sigue ahí sin nada que hacer parece roto. -->
    @if (mostrarDescubrir()) {
      <div class="cta" animate.leave="sale-cta">
        @if (resumenDesactualizado()) {
          <p class="aviso-fuerte">
            Has cambiado el PDF o tus especialidades. Vuelve a descubrir para
            actualizar la lista.
          </p>
        }
        <button (click)="descubrir()" [disabled]="!puedeDescubrir()">
          @if (descubriendo()) { <span class="spinner"></span> Casando vacantes… }
          @else {
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6z" />
              <path d="M18.5 15l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z" />
            </svg>
            {{ resumenDesactualizado() ? 'Volver a descubrir' : 'Descubrir vacantes' }}
          }
        </button>
        @if (!puedeDescubrir() && !descubriendo()) {
          <p class="requisito">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
            Necesitas el PDF de vacantes y al menos una especialidad.
          </p>
        }
      </div>
    }

    <!-- ── Resumen ────────────────────────────────────────────────────── -->
    @if (estado.resumen(); as resumen) {
      <h2 animate.enter="aparece">Hemos detectado</h2>
      <div class="metricas" animate.enter="aparece">
        <div class="metrica"><div class="n">{{ resumen.total }}</div><div class="l">vacantes tuyas</div></div>
        <div class="metrica"><div class="n">{{ resumen.voluntary }}</div><div class="l">voluntarias</div></div>
        <div class="metrica"><div class="n">{{ resumen.languageRequirement }}</div><div class="l">con requisito de idioma</div></div>
        <div class="metrica"><div class="n">{{ resumen.afternoon }}</div><div class="l">con horario de tarde</div></div>
        <div class="metrica"><div class="n">{{ resumen.ambiguous }}</div><div class="l">con información ambigua</div></div>
      </div>
      <button (click)="continuar()">Continuar con mi perfil</button>
    }

    <!-- ── Vía de escape avanzada ─────────────────────────────────────────
         No es un <details> porque su apertura nativa no se puede animar, y
         aquí se pliega igual que todo lo demás. -->
    <section class="card avanzado">
      <button type="button" class="avanzado-cab" [class.cerrado]="!avanzadoAbierto()"
              [attr.aria-expanded]="avanzadoAbierto()"
              (click)="avanzadoAbierto.set(!avanzadoAbierto())">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H1a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 2.6 7a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V1a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H23a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
        </svg>
        <span class="titulo">Opciones avanzadas</span>
        <span class="senal" aria-hidden="true">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>
      @if (avanzadoAbierto()) {
        <div class="plegable" animate.enter="despliega" animate.leave="repliega">
          <div class="contenido">
            <label for="json-vacantes">Pegar vacantes en JSON</label>
            <textarea id="json-vacantes" [value]="textoJson()"
              (input)="textoJson.set($any($event.target).value)"
              placeholder='[{ "bodyCode": "0590", "specialtyCode": "006", "municipality": "Zaragoza", "additionalInfoRaw": "…" }]'></textarea>
            <button class="secundario" (click)="importarJson()" [disabled]="!textoJson().trim()">Importar JSON</button>
          </div>
        </div>
      }
    </section>
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
  readonly seccionAbierta = signal(true);
  readonly abiertoPdf = signal(true);
  readonly abiertoManual = signal(true);
  readonly avanzadoAbierto = signal(false);

  urlVacantes = '';
  urlCandidatos = '';
  nombreCandidato = '';
  cuerpoManual = '';
  especialidadManual = '';
  ordenManual: number | null = null;

  /**
   * Qué se casó la última vez que se descubrió, para saber si el resumen que
   * hay en pantalla sigue valiendo. Sin esto no se puede distinguir "ya está
   * hecho" de "está hecho pero con otros datos".
   */
  private readonly firmaImportada = signal('');

  /** Vacantes leídas y especialidades elegidas: lo que decide el casado. */
  readonly firmaActual = computed(() =>
    [
      this.estado.vacantesParseadas().length,
      ...this.estado
        .especialidadesUsuario()
        .map(e => `${e.bodyCode}-${e.specialtyCode}`)
        .sort()
    ].join('|')
  );

  readonly resumenDesactualizado = computed(
    () => !!this.estado.resumen() && this.firmaActual() !== this.firmaImportada()
  );

  /**
   * El botón desaparece cuando su trabajo ya está pintado debajo, y vuelve solo
   * si cambias el PDF o las especialidades. Tras recargar no vuelve: el resumen
   * persiste pero las vacantes en crudo no, así que no habría nada que recasar.
   */
  readonly mostrarDescubrir = computed(
    () => !this.estado.resumen() || (this.vacantesListas() && this.resumenDesactualizado())
  );

  /** Páginas del PDF de candidatos, para rebuscar si cambia el nombre. */
  paginasCandidatos: CandidatosPage[] | null = null;
  /** Especialidades añadidas a mano (se combinan con las detectadas). */
  manuales: CandidateMatch[] = [];
  /** Especialidades halladas en el PDF de candidatos con el nombre dado. */
  detectadas: CandidateMatch[] = [];

  vacantesListas(): boolean {
    return this.estado.vacantesParseadas().length > 0;
  }

  /**
   * La vía del PDF cuenta como "en uso" en cuanto hay nombre o PDF, no solo si
   * ha dado resultados: si has puesto el nombre y no aparece, el bloque sigue
   * siendo el que estás usando y el aviso de "no encontrado" vive dentro.
   */
  viaPdfEnUso(): boolean {
    return this.paginasCandidatos !== null || this.nombreCandidato.trim().length > 0;
  }

  puedeDescubrir(): boolean {
    return this.vacantesListas() && this.estado.especialidadesUsuario().length > 0 && !this.descubriendo();
  }

  especialidadesDelCuerpo() {
    return this.cuerpos.find(c => c.code === this.cuerpoManual)?.especialidades ?? [];
  }

  /** El progreso en curso, solo si es el de esta zona de arrastre. */
  cargandoDe(destino: Destino): Cargando {
    const c = this.cargando();
    return c && c.destino === destino ? c : null;
  }

  progresoTexto(c: NonNullable<Cargando>): string {
    return c.total ? `Página ${c.pagina} de ${c.total}` : 'Esto puede tardar un poco…';
  }

  /**
   * Mientras no se sabe el total se deja en 8 %: una barra a cero parece
   * atascada, y una indeterminada aquí no aporta nada que no diga el spinner.
   */
  porcentaje(c: NonNullable<Cargando>): number {
    return c.total ? Math.round((c.pagina / c.total) * 100) : 8;
  }

  // ── Vacantes ──────────────────────────────────────────────────────────
  async ficheroVacantes(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    // Antes del `await`: abrir el PDF tarda y hasta el primer progreso de
    // pdf.js no hay señal ninguna.
    this.iniciarCarga('vacantes', 'Leyendo vacantes');
    const data = await this.bytes(file);
    // Permite volver a elegir el mismo fichero (si no, no hay evento change).
    input.value = '';
    if (data) await this.procesarVacantes(data);
  }

  async soltarVacantes(event: DragEvent): Promise<void> {
    event.preventDefault();
    this.arrastrandoVacantes.set(false);
    if (this.cargando()) return;
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    this.iniciarCarga('vacantes', 'Leyendo vacantes');
    const data = await this.bytes(file);
    if (data) await this.procesarVacantes(data);
  }

  async urlVacantesCargar(): Promise<void> {
    await this.conErrores(async () => {
      this.iniciarCarga('vacantes', 'Descargando PDF de vacantes');
      const data = await this.pdf.descargarPdf(this.urlVacantes.trim());
      this.iniciarCarga('vacantes', 'Leyendo vacantes');
      await this.procesarVacantes(data);
    });
  }

  private iniciarCarga(destino: Destino, fase: string): void {
    this.cargando.set({ destino, fase, pagina: 0, total: 0 });
  }

  /**
   * El progreso se enciende antes de leer el fichero, así que si la lectura
   * falla hay que apagarlo aquí: si no, el spinner se queda girando para
   * siempre sin que nadie lo pare.
   */
  private async bytes(file: File): Promise<ArrayBuffer | null> {
    try {
      return await file.arrayBuffer();
    } catch {
      this.cargando.set(null);
      this.estado.error.set('No se ha podido leer el fichero. Vuelve a elegirlo.');
      return null;
    }
  }

  private async procesarVacantes(data: ArrayBuffer): Promise<void> {
    await this.conErrores(async () => {
      const pages = await this.pdf.leerVacantes(data, p =>
        this.cargando.set({
          destino: 'vacantes',
          fase: 'Leyendo vacantes',
          pagina: p.page,
          total: p.total
        })
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
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.iniciarCarga('candidatos', 'Leyendo candidatos');
    const data = await this.bytes(file);
    input.value = '';
    if (data) await this.procesarCandidatos(data);
  }

  async soltarCandidatos(event: DragEvent): Promise<void> {
    event.preventDefault();
    this.arrastrandoCandidatos.set(false);
    if (this.cargando()) return;
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    this.iniciarCarga('candidatos', 'Leyendo candidatos');
    const data = await this.bytes(file);
    if (data) await this.procesarCandidatos(data);
  }

  async urlCandidatosCargar(): Promise<void> {
    await this.conErrores(async () => {
      this.iniciarCarga('candidatos', 'Descargando PDF de candidatos');
      const data = await this.pdf.descargarPdf(this.urlCandidatos.trim());
      this.iniciarCarga('candidatos', 'Leyendo candidatos');
      await this.procesarCandidatos(data);
    });
  }

  private async procesarCandidatos(data: ArrayBuffer): Promise<void> {
    await this.conErrores(async () => {
      this.paginasCandidatos = await this.pdf.leerCandidatos(data, p =>
        this.cargando.set({
          destino: 'candidatos',
          fase: 'Leyendo candidatos',
          pagina: p.page,
          total: p.total
        })
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
    const orden = Number(this.ordenManual);
    this.manuales.push({
      bodyCode: cuerpo.code,
      bodyName: cuerpo.name,
      specialtyCode: especialidad.code,
      specialtyName: especialidad.name,
      page: 0,
      orden: Number.isFinite(orden) && orden > 0 ? orden : undefined
    });
    this.especialidadManual = '';
    this.ordenManual = null;
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
      this.firmaImportada.set(this.firmaActual());
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
