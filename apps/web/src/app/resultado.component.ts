import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { EstadoService, VacanteEvaluada } from './estado.service';
import { ExtensionService } from './extension.service';

@Component({
  selector: 'tp-resultado',
  standalone: true,
  template: `
    @if (estado.resultado(); as resultado) {
      <h1>Tu lista, explicada</h1>
      <p class="lead">
        Ordenada por cercanía y preferencias. Cada exclusión muestra el motivo y el
        texto original del PDF que la provocó: no te pedimos que te fíes, te pedimos que compruebes.
      </p>

      <div class="metricas">
        <div class="metrica"><div class="n" style="color:var(--acierto)">{{ resultado.recommended.length }}</div><div class="l">recomendadas</div></div>
        <div class="metrica"><div class="n" style="color:var(--aviso)">{{ resultado.withWarnings.length }}</div><div class="l">posibles con advertencias</div></div>
        <div class="metrica"><div class="n" style="color:var(--tinta-suave)">{{ resultado.excluded.length }}</div><div class="l">excluidas</div></div>
      </div>

      <h2>Recomendadas</h2>
      @for (e of resultado.recommended; track e.vacancyId) {
        <div class="card">
          <div class="fila">
            <strong>
              <input type="checkbox" [checked]="estado.seleccion().has(e.vacancyId)"
                (change)="estado.alternarSeleccion(e.vacancyId)" />
              {{ e.vacancy.centerName }} — {{ e.vacancy.municipality }}
            </strong>
            <span style="color:var(--tinta-suave); font-size:14px;">{{ trayecto(e) }}</span>
          </div>
          <div>
            @for (razon of e.positiveReasons; track razon.reasonCode) {
              <span class="chip ok">{{ razon.message }}</span>
            }
          </div>
        </div>
      } @empty { <p>Ninguna plaza cumple todo tu perfil sin avisos.</p> }

      <h2>Posibles, con advertencias</h2>
      @for (e of resultado.withWarnings; track e.vacancyId) {
        <div class="card">
          <div class="fila">
            <strong>
              <input type="checkbox" [checked]="estado.seleccion().has(e.vacancyId)"
                (change)="estado.alternarSeleccion(e.vacancyId)" />
              {{ e.vacancy.centerName }} — {{ e.vacancy.municipality }}
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
        </div>
      } @empty { <p>Sin plazas en este bloque.</p> }

      <h2>Excluidas y por qué</h2>
      @for (e of resultado.excluded; track e.vacancyId) {
        <div class="card">
          <div class="fila">
            <span class="tachado">{{ e.vacancy.centerName }} — {{ e.vacancy.municipality }}</span>
            <span class="chip fuera">{{ e.hardExclusionReasons[0].message }}</span>
          </div>
          @if (fuente(e); as texto) { <p class="fuente">"{{ texto }}"</p> }
        </div>
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
    } @else {
      <p>Todavía no hay resultados. <a href="/importar">Importa una convocatoria</a> y guarda tu perfil.</p>
    }
  `
})
export class ResultadoComponent {
  readonly estado = inject(EstadoService);
  readonly ext = inject(ExtensionService);
  private readonly router = inject(Router);

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
    const r = this.estado.resultado();
    if (!r) return;
    const filas = [...r.recommended, ...r.withWarnings];
    const lineas = ['orden;centro;localidad;jornada;distancia_km;minutos;coste_eur_dia;avisos'];
    filas.forEach((e, i) => {
      const v = e.vacancy;
      lineas.push([
        i + 1,
        v.centerName ?? '',
        v.municipality ?? '',
        v.workload != null ? Math.round(v.workload * 100) + '%' : '',
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
