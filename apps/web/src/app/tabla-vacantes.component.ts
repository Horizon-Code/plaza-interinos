import { Component, computed, inject, input, signal } from '@angular/core';
import { EstadoService, VacanteEvaluada } from './estado.service';

/**
 * Vista tabla de un bloque de vacantes (punto 6). Sirve para comparar muchas de
 * un vistazo, que es justo lo que las tarjetas apiladas no dejan hacer.
 *
 * La información adicional no ocupa columna: en escritorio va en el `title` de
 * la fila y en móvil se despliega tocando el icono ⓘ. Siete columnas no caben
 * en 380 px, así que la tabla lleva su propio scroll horizontal.
 */
@Component({
  selector: 'tp-tabla-vacantes',
  standalone: true,
  template: `
    <div class="tabla-scroll">
      <table class="tabla-vacantes">
        <thead>
          <tr>
            <th scope="col" class="col-info"><span class="visualmente-oculta">Información adicional</span></th>
            @if (seleccionable()) {
              <th scope="col"><span class="visualmente-oculta">Elegida</span></th>
            }
            <th scope="col">Centro</th>
            <th scope="col">Localidad</th>
            <th scope="col">Especialidad</th>
            <th scope="col">Jornada</th>
            <th scope="col">Tipo</th>
            <th scope="col">Distancia</th>
            <th scope="col">Motivo</th>
          </tr>
        </thead>
        <tbody>
          @for (e of filas(); track e.vacancyId) {
            <tr [title]="e.vacancy.additionalInfoRaw ?? ''">
              <td class="col-info">
                @if (e.vacancy.additionalInfoRaw) {
                  <button type="button" class="info" (click)="alternar(e.vacancyId)"
                          [attr.aria-expanded]="abiertas().has(e.vacancyId)"
                          [attr.aria-label]="'Ver la información adicional de ' + e.vacancy.centerName">ⓘ</button>
                }
              </td>
              @if (seleccionable()) {
                <td>
                  <input type="checkbox" [checked]="estado.seleccion().has(e.vacancyId)"
                         (change)="estado.alternarSeleccion(e.vacancyId)"
                         [attr.aria-label]="'Elegir ' + e.vacancy.centerName" />
                </td>
              }
              <td [class.tachado]="!seleccionable()">{{ e.vacancy.centerName }}</td>
              <td>{{ e.vacancy.municipality }}</td>
              <td>{{ e.vacancy.specialtyName }}</td>
              <td>{{ jornada(e) }}</td>
              <td>
                <span class="chip" [class.ok]="!e.vacancy.voluntary" [class.aviso]="e.vacancy.voluntary">
                  {{ e.vacancy.voluntary ? 'voluntaria' : 'obligatoria' }}
                </span>
              </td>
              <td>{{ trayecto(e) }}</td>
              <td class="col-motivo">{{ motivo(e) }}</td>
            </tr>
            @if (abiertas().has(e.vacancyId)) {
              <tr class="fila-detalle">
                <td [attr.colspan]="columnas()">{{ e.vacancy.additionalInfoRaw }}</td>
              </tr>
            }
          }
        </tbody>
      </table>
    </div>
  `
})
export class TablaVacantesComponent {
  readonly estado = inject(EstadoService);

  readonly filas = input.required<VacanteEvaluada[]>();
  /** Las excluidas no se pueden elegir: sin casilla y con el centro tachado. */
  readonly seleccionable = input(true);

  readonly abiertas = signal<Set<string>>(new Set());
  readonly columnas = computed(() => (this.seleccionable() ? 9 : 8));

  alternar(id: string): void {
    const nuevas = new Set(this.abiertas());
    nuevas.has(id) ? nuevas.delete(id) : nuevas.add(id);
    this.abiertas.set(nuevas);
  }

  jornada(e: VacanteEvaluada): string {
    return e.vacancy.workload != null ? `${Math.round(e.vacancy.workload * 100)} %` : '—';
  }

  trayecto(e: VacanteEvaluada): string {
    if (e.travelMinutes == null) return 'sin calcular';
    const base = `${e.travelMinutes} min · ${e.distanceKm} km`;
    if (e.dailyCostEur == null) return base;
    const euros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(e.dailyCostEur);
    return `${base} · ${euros}/día`;
  }

  /** Lo que en las tarjetas eran chips a toda fila, aquí cabe en una columna. */
  motivo(e: VacanteEvaluada): string {
    if (e.hardExclusionReasons.length) return e.hardExclusionReasons.map(r => r.message).join(' · ');
    const mensajes = e.warnings.map(w => w.message);
    if (e.requiresManualReview) mensajes.push('Revisa el texto original.');
    if (!mensajes.length) mensajes.push(...e.positiveReasons.map(r => r.message));
    return mensajes.join(' · ') || '—';
  }
}
