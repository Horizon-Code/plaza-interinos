import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EstadoService } from './estado.service';

@Component({
  selector: 'tp-comprobar',
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (estado.comprobacion(); as c) {
      <h1>Comprobación antes de enviar</h1>
      <p class="lead">El último vistazo que evita el error que se paga todo el curso.</p>

      @if (c.selectedButExcluded.length > 0) {
        <div class="card" style="border-color:var(--descarte);">
          <strong style="color:var(--descarte)">{{ c.selectedButExcluded.length }} plaza(s) seleccionada(s) que tu perfil excluye</strong>
          @for (e of c.selectedButExcluded; track e.vacancyId) {
            <p style="margin:8px 0 0;">{{ e.vacancy.centerName }} — {{ e.hardExclusionReasons[0].message }}</p>
            @if (e.hardExclusionReasons[0].sourceText; as texto) { <p class="fuente">"{{ texto }}"</p> }
          }
        </div>
      }

      @if (c.missingCompatible.length > 0) {
        <div class="card" style="border-color:var(--acierto);">
          <strong style="color:var(--acierto)">{{ c.missingCompatible.length }} plaza(s) compatibles que no habías seleccionado</strong>
          @for (e of c.missingCompatible; track e.vacancyId) {
            <p style="margin:8px 0 0;">{{ e.vacancy.centerName }} — {{ e.vacancy.municipality }} ({{ e.travelMinutes ?? '?' }} min)</p>
          }
        </div>
      }

      @if (c.selectedNeedsReview.length > 0) {
        <div class="card" style="border-color:var(--aviso);">
          <strong style="color:var(--aviso)">{{ c.selectedNeedsReview.length }} plaza(s) con información que conviene leer</strong>
          @for (e of c.selectedNeedsReview; track e.vacancyId) {
            <p style="margin:8px 0 0;">{{ e.vacancy.centerName }} — {{ e.vacancy.additionalInfoRaw }}</p>
          }
        </div>
      }

      @if (c.selectedButExcluded.length === 0 && c.missingCompatible.length === 0 && c.selectedNeedsReview.length === 0) {
        <div class="card" style="border-color:var(--acierto);">
          <strong style="color:var(--acierto)">Todo en orden.</strong>
          <p style="margin:8px 0 0;">Tu selección coincide con tu perfil y no falta ninguna plaza compatible.</p>
        </div>
      }

      <div style="margin-top:22px; display:flex; gap:10px;">
        <a routerLink="/resultado" class="btn secundario" style="text-decoration:none;">Volver a la lista</a>
        <a class="btn" href="/api/export.csv" style="text-decoration:none;">Exportar lista final</a>
      </div>
    } @else {
      <p>Primero <a routerLink="/resultado">revisa tu lista</a> y pulsa "Comprobar antes de enviar".</p>
    }
  `
})
export class ComprobarComponent {
  readonly estado = inject(EstadoService);
}
