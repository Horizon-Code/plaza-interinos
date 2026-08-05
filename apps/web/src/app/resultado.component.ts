import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ordenarEnCascada } from '@plazainterinos/core';
import { ConfiguracionService } from './configuracion.service';
import { EstadoService, VacanteEvaluada } from './estado.service';
import { ExtensionService } from './extension.service';
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
  imports: [TablaVacantesComponent],
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
        <h2>Recomendadas</h2>
        @if (recomendadas().length) {
          <tp-tabla-vacantes [filas]="recomendadas()" />
        } @else { <p>Ninguna plaza cumple todo tu perfil sin avisos.</p> }

        <h2>Posibles, con advertencias</h2>
        @if (conAvisos().length) {
          <tp-tabla-vacantes [filas]="conAvisos()" />
        } @else { <p>Sin plazas en este bloque.</p> }

        <h2>Excluidas y por qué</h2>
        @if (excluidas().length) {
          <tp-tabla-vacantes [filas]="excluidas()" [seleccionable]="false" />
        } @else { <p>Ninguna plaza queda fuera.</p> }
      } @else {
        <h2>Recomendadas</h2>
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
        <button (click)="comprobar()">Comprobar antes de enviar</button>
        <button class="secundario" (click)="exportarCsv()">Exportar CSV</button>
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
    } @else if (recalculando()) {
      <p class="progreso"><span class="spinner"></span> Recuperando tu lista…</p>
    } @else {
      <p>Todavía no hay resultados. <a href="/importar">Importa una convocatoria</a> y completa tu perfil.</p>
      @if (estado.error()) { <p class="error">{{ estado.error() }}</p> }
    }
  `
})
export class ResultadoComponent {
  readonly estado = inject(EstadoService);
  readonly config = inject(ConfiguracionService);
  readonly ext = inject(ExtensionService);
  private readonly router = inject(Router);

  readonly vista = signal<Vista>('tarjetas');
  readonly recalculando = signal(false);

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
    return ordenarEnCascada(filas, this.config.cascada(), this.ordenEspecialidades());
  }

  readonly recomendadas = computed(() => this.ordenar(this.estado.resultado()?.recommended));
  readonly conAvisos = computed(() => this.ordenar(this.estado.resultado()?.withWarnings));
  readonly excluidas = computed(() => this.ordenar(this.estado.resultado()?.excluded));

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
    if (e.travelMinutes == null) return 'distancia sin calcular';
    const base = `${e.travelMinutes} min · ${e.distanceKm} km`;
    if (e.dailyCostEur == null) return base;
    const euros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(e.dailyCostEur);
    return `${base} · ≈ ${euros} ida y vuelta/día`;
  }

  fuente(e: VacanteEvaluada): string | null {
    const conFuente = [...e.hardExclusionReasons, ...e.warnings].find(r => r.sourceText);
    return conFuente?.sourceText ?? null;
  }

  exportarCsv(): void {
    const filas = [...this.recomendadas(), ...this.conAvisos()];
    if (!filas.length) return;
    const lineas = ['orden;centro;localidad;especialidad;jornada;tipo;distancia_km;minutos;coste_eur_dia;avisos'];
    filas.forEach((e, i) => {
      const v = e.vacancy;
      lineas.push([
        i + 1,
        v.centerName ?? '',
        v.municipality ?? '',
        v.specialtyName ?? '',
        v.workload != null ? Math.round(v.workload * 100) + '%' : '',
        v.voluntary ? 'voluntaria' : 'obligatoria',
        e.distanceKm ?? '',
        e.travelMinutes ?? '',
        e.dailyCostEur ?? '',
        e.warnings.map(w => w.message).join(' | ')
      ].join(';'));
    });
    const blob = new Blob([lineas.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plazainterinos-lista.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async comprobar(): Promise<void> {
    await this.estado.comprobar();
    await this.router.navigate(['/comprobar']);
  }
}
