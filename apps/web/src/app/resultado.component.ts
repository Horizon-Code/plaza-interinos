import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { formatearTrayecto, ordenarEnCascada } from '@plazainterinos/core';
import { ConfiguracionService } from './configuracion.service';
import { EstadoService, VacanteEvaluada } from './estado.service';
import { ExtensionService } from './extension.service';
import { ListaService } from './lista.service';
import { AvisoTrayectoComponent } from './aviso-trayecto.component';
import { TablaVacantesComponent } from './tabla-vacantes.component';

type Vista = 'tarjetas' | 'tabla';

/**
 * Paso 5 · Lista. Dos vistas de lo mismo: tarjetas para leer una plaza a fondo,
 * tabla para comparar muchas de un vistazo (punto 6).
 *
 * El orden en cascada del paso 4 se aplica aquí, dentro de cada grupo, para no
 * mezclar recomendadas con excluidas: ordenar recoloca, nunca descarta.
 */
@Component({
  selector: 'tp-resultado',
  standalone: true,
  imports: [TablaVacantesComponent, AvisoTrayectoComponent],
  template: `
    @if (estado.resultado()) {
      <h1>Tu lista, explicada</h1>
      <p class="lead">
        {{ descripcionOrden() }}. Cada exclusión muestra el motivo y el
        texto original del PDF que la provocó: no te pedimos que te fíes, te pedimos que compruebes.
      </p>

      <div class="metricas">
        <div class="metrica"><div class="n" style="color:var(--acierto)">{{ recomendadas().length }}</div><div class="l">recomendadas</div></div>
        <div class="metrica"><div class="n" style="color:var(--aviso)">{{ conAvisos().length }}</div><div class="l">posibles con advertencias</div></div>
        <div class="metrica"><div class="n" style="color:var(--tinta-suave)">{{ excluidas().length }}</div><div class="l">excluidas</div></div>
      </div>

      <div class="tabs vistas" role="tablist" aria-label="Forma de ver la lista">
        <button type="button" role="tab" [attr.aria-selected]="vista() === 'tarjetas'"
                [class.activa]="vista() === 'tarjetas'" (click)="vista.set('tarjetas')">Tarjetas</button>
        <button type="button" role="tab" [attr.aria-selected]="vista() === 'tabla'"
                [class.activa]="vista() === 'tabla'" (click)="vista.set('tabla')">Tabla</button>
      </div>

      @if (vista() === 'tabla') {
        <div class="fila-aviso" style="margin:14px 0 8px;"><tp-aviso-trayecto /></div>
        <tp-tabla-vacantes [filas]="listaFinal()" (reordenada)="ordenCambiado()" />

        <h2>Excluidas y por qué</h2>
        @for (e of excluidas(); track e.vacancyId) {
          <div class="card">
            <div class="fila">
              <span class="tachado">{{ e.vacancy.centerName }} — {{ e.vacancy.municipality }}</span>
              <span class="chip fuera">{{ e.hardExclusionReasons[0].message }}</span>
            </div>
          </div>
        } @empty { <p>Ninguna plaza queda fuera.</p> }
      } @else {
        <div class="fila-aviso"><h2>Recomendadas</h2><tp-aviso-trayecto /></div>
        @for (e of recomendadas(); track e.vacancyId) {
          <div class="card">
            <div class="fila">
              <strong>
                <input type="checkbox" [checked]="estado.seleccion().has(e.vacancyId)"
                  (change)="estado.alternarSeleccion(e.vacancyId)"
                  [attr.aria-label]="'Elegir ' + e.vacancy.centerName" />
                {{ e.vacancy.centerName }} — {{ e.vacancy.municipality }}
                <span class="chip" [class.ok]="!e.vacancy.voluntary" [class.aviso]="e.vacancy.voluntary">
                  {{ e.vacancy.voluntary ? 'voluntaria' : 'obligatoria' }}
                </span>
              </strong>
              <span style="color:var(--tinta-suave); font-size:14px;">{{ trayecto(e) }}</span>
            </div>
            <div>
              @for (razon of e.positiveReasons; track razon.reasonCode) {
                <span class="chip ok">{{ razon.message }}</span>
              }
            </div>
            @if (e.vacancy.additionalInfoRaw; as info) { <p class="fuente">{{ info }}</p> }
          </div>
        } @empty { <p>Ninguna plaza cumple todo tu perfil sin avisos.</p> }

        <h2>Posibles, con advertencias</h2>
        @for (e of conAvisos(); track e.vacancyId) {
          <div class="card">
            <div class="fila">
              <strong>
                <input type="checkbox" [checked]="estado.seleccion().has(e.vacancyId)"
                  (change)="estado.alternarSeleccion(e.vacancyId)"
                  [attr.aria-label]="'Elegir ' + e.vacancy.centerName" />
                {{ e.vacancy.centerName }} — {{ e.vacancy.municipality }}
                <span class="chip" [class.ok]="!e.vacancy.voluntary" [class.aviso]="e.vacancy.voluntary">
                  {{ e.vacancy.voluntary ? 'voluntaria' : 'obligatoria' }}
                </span>
              </strong>
              <span style="color:var(--tinta-suave); font-size:14px;">{{ trayecto(e) }}</span>
            </div>
            <div>
              @for (aviso of e.warnings; track aviso.reasonCode) {
                <span class="chip aviso">{{ aviso.message }}</span>
              }
              @if (e.requiresManualReview) { <span class="chip neutro">Revisa el texto original</span> }
            </div>
            @if (fuente(e); as texto) { <p class="fuente">"{{ texto }}"</p> }
            @if (e.vacancy.additionalInfoRaw; as info) { <p class="fuente">{{ info }}</p> }
          </div>
        } @empty { <p>Sin plazas en este bloque.</p> }

        <h2>Excluidas y por qué</h2>
        @for (e of excluidas(); track e.vacancyId) {
          <div class="card">
            <div class="fila">
              <span class="tachado">{{ e.vacancy.centerName }} — {{ e.vacancy.municipality }}</span>
              <span class="chip fuera">{{ e.hardExclusionReasons[0].message }}</span>
            </div>
            @if (fuente(e); as texto) { <p class="fuente">"{{ texto }}"</p> }
          </div>
        }
      }

      <div style="margin-top:26px; display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
        <button (click)="intentarContinuar()">Comprobar antes de enviar</button>
        <button class="secundario" (click)="lista.borrarAnotaciones()"
                [disabled]="!cuantasNotas()">Borrar anotaciones</button>
        <button class="secundario" (click)="lista.borrarAvisos()"
                [disabled]="!cuantosAvisos()">Borrar avisos ⚠</button>
        @switch (ext.estado()) {
          @case ('paddoc_activo') {
            <button (click)="rellenar()">Rellenar en PADDOC</button>
          }
          @case ('extension_lista') {
            <button class="secundario" disabled title="Entra en PADDOC con tu Cl@ve">Rellenar en PADDOC · entra en PADDOC</button>
          }
          @default {
            <span style="font-size:13px; color:var(--tinta-suave);">
              <a href="/extension" style="color:var(--pizarra);">Conecta la extensión</a> para rellenar en PADDOC automáticamente.
            </span>
          }
        }
      </div>
      @if (confirmando()) {
        <div class="velo" (click)="confirmando.set(false)"></div>
        <div class="dialogo" role="dialog" aria-modal="true" aria-labelledby="tit-confirmar">
          <h2 id="tit-confirmar">Antes de continuar</h2>
          <p>Tienes plazas marcadas que conviene repasar:</p>
          @if (conNota().length) {
            <strong>{{ conNota().length }} con anotación</strong>
            <ul>
              @for (e of conNota(); track e.vacancyId) {
                <li>{{ e.vacancy.centerName }} — <em>{{ lista.anotacion(e.vacancyId) }}</em></li>
              }
            </ul>
          }
          @if (conAviso().length) {
            <strong>{{ conAviso().length }} marcadas con aviso ⚠</strong>
            <ul>
              @for (e of conAviso(); track e.vacancyId) {
                <li>{{ e.vacancy.centerName }} — {{ e.vacancy.municipality }}</li>
              }
            </ul>
          }
          <div class="fila-botones">
            <button (click)="confirmando.set(false); comprobar()">Continuar igualmente</button>
            <button class="secundario" (click)="confirmando.set(false)">Volver a la lista</button>
          </div>
        </div>
      }
    } @else if (recalculando()) {
      <p class="progreso"><span class="spinner"></span> Recuperando tu lista…</p>
    } @else {
      <p>Todavía no hay resultados. <a href="/importar">Importa una convocatoria</a> y completa tu perfil.</p>
      @if (estado.error()) { <p class="error">{{ estado.error() }}</p> }
    }
  `,
  styles: [`
    .velo { position:fixed; inset:0; background:rgba(29,35,33,.45); z-index:10; }
    .dialogo { position:fixed; z-index:11; top:50%; left:50%; transform:translate(-50%,-50%);
      width:min(92vw,520px); max-height:80vh; overflow:auto; background:#fff;
      border-radius:var(--radio); padding:20px 22px; box-shadow:0 12px 40px rgba(0,0,0,.25); }
    .dialogo h2 { margin-top:0; }
    .dialogo ul { margin:6px 0 14px; padding-left:20px; font-size:14px; }
    .dialogo li { margin-bottom:3px; }
  `]
})
export class ResultadoComponent {
  readonly estado = inject(EstadoService);
  readonly config = inject(ConfiguracionService);
  readonly ext = inject(ExtensionService);
  readonly lista = inject(ListaService);
  private readonly router = inject(Router);

  readonly vista = signal<Vista>('tarjetas');
  readonly recalculando = signal(false);
  readonly confirmando = signal(false);

  constructor() {
    // Tras un refresco la lista se recalcula sola: la convocatoria y el perfil
    // siguen en la API, así que no hay motivo para hacer repetir los seis pasos.
    if (!this.estado.resultado() && this.estado.hayConvocatoria()) void this.recuperar();
  }

  private async recuperar(): Promise<void> {
    this.recalculando.set(true);
    try {
      await this.estado.evaluar();
    } catch (error) {
      this.estado.error.set(String(error instanceof Error ? error.message : error));
    } finally {
      this.recalculando.set(false);
    }
  }

  private readonly ordenEspecialidades = computed(() =>
    this.config.ordenPorEspecialidad(this.estado.especialidadesUsuario())
  );

  private ordenar(filas: VacanteEvaluada[] | undefined): VacanteEvaluada[] {
    if (!filas) return [];
    return ordenarEnCascada(filas, this.config.cascada(), this.ordenEspecialidades(), this.config.ordenProvincias(), this.config.ordenVoluntarias(), this.config.modo());
  }

  readonly recomendadas = computed(() => this.ordenar(this.estado.resultado()?.recommended));
  readonly conAvisos = computed(() => this.ordenar(this.estado.resultado()?.withWarnings));
  readonly excluidas = computed(() => this.ordenar(this.estado.resultado()?.excluded));

  /**
   * La lista que el usuario ajusta y exporta: recomendadas y con avisos, en la
   * cascada del paso 4, y encima el orden manual de esta pantalla, que manda.
   */
  readonly listaFinal = computed(() =>
    this.lista.componer([...this.recomendadas(), ...this.conAvisos()], this.excluidas())
  );

  readonly conNota = computed(() =>
    this.listaFinal().filter(e => !!this.lista.anotacion(e.vacancyId))
  );
  readonly conAviso = computed(() =>
    this.listaFinal().filter(e => this.lista.tieneAviso(e.vacancyId))
  );
  readonly cuantasNotas = computed(() => this.conNota().length);
  readonly cuantosAvisos = computed(() => this.conAviso().length);

  /** Al reordenar a mano se fija el orden completo, no solo la fila movida. */
  ordenCambiado(): void {
    this.lista.fijarOrden(this.listaFinal().map(e => e.vacancyId));
  }

  /** SCRUM-25: si hay notas o avisos, se avisa antes de pasar a Comprobación. */
  intentarContinuar(): void {
    if (this.cuantasNotas() || this.cuantosAvisos()) this.confirmando.set(true);
    else void this.comprobar();
  }

  readonly descripcionOrden = computed(() => {
    const como: Record<string, string> = {
      'cerca-primero': 'Ordenada por cercanía',
      'lejos-primero': 'Ordenada por lejanía',
      'mi-orden-bajo-primero': 'Ordenada por tu número de orden',
      'mi-orden-alto-primero': 'Ordenada por tu número de orden, de mayor a menor',
      'completa-primero': 'Ordenada por jornada, la completa primero',
      'parcial-primero': 'Ordenada por jornada, la parcial primero',
      'obligatoria-primero': 'Ordenada con las obligatorias primero',
      'voluntaria-primero': 'Ordenada con las voluntarias primero'
    };
    return como[this.config.cascada()[0]?.direccion] ?? 'Ordenada por cercanía';
  });

  rellenar(): void {
    const ids = Array.from(this.estado.seleccion());
    window.postMessage({ source: 'tuplaza-app', type: 'rellenar', vacancyIds: ids }, '*');
    this.router.navigate(['/comprobar']);
  }

  trayecto(e: VacanteEvaluada): string {
    const base = formatearTrayecto(e);
    if (e.dailyCostEur == null) return base;
    const euros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(e.dailyCostEur);
    return `${base} · ≈ ${euros} ida y vuelta/día`;
  }

  fuente(e: VacanteEvaluada): string | null {
    const conFuente = [...e.hardExclusionReasons, ...e.warnings].find(r => r.sourceText);
    return conFuente?.sourceText ?? null;
  }

  async comprobar(): Promise<void> {
    await this.estado.comprobar();
    await this.router.navigate(['/comprobar']);
  }
}
