import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { ConfiguracionService } from './configuracion.service';

export interface Paso {
  numero: number;
  nombre: string;
  ruta: string;
  opcional?: boolean;
}

export const PASOS: Paso[] = [
  { numero: 1, nombre: 'Convocatoria', ruta: '/importar' },
  { numero: 2, nombre: 'Perfil', ruta: '/perfil' },
  { numero: 3, nombre: 'Filtrar', ruta: '/filtrar', opcional: true },
  { numero: 4, nombre: 'Ordenar', ruta: '/ordenar', opcional: true },
  { numero: 5, nombre: 'Lista', ruta: '/resultado' },
  { numero: 6, nombre: 'Comprobación', ruta: '/comprobar' },
  { numero: 7, nombre: 'Final', ruta: '/final' }
];

/**
 * Barra de pasos (punto 3). Es un stepper, no un breadcrumb: siete fases de una
 * secuencia lineal, no una jerarquía.
 *
 * Solo se puede volver atrás. Saltar hacia delante llevaría, por ejemplo, a una
 * lista sin perfil, que no significa nada; volver, en cambio, no borra nada
 * porque todo vive en ConfiguracionService.
 */
@Component({
  selector: 'pi-pasos',
  standalone: true,
  template: `
    <nav class="stepper" aria-label="Pasos">
      <div class="stepper-caja">
        <ol>
          @for (paso of pasos; track paso.numero) {
            <li
              class="paso"
              [class.completado]="paso.numero < actual()"
              [class.activo]="paso.numero === actual()"
              [class.futuro]="paso.numero > actual()"
            >
              <button
                type="button"
                class="circulo"
                [disabled]="!accesible(paso.numero)"
                [attr.aria-current]="paso.numero === actual() ? 'step' : null"
                [attr.aria-label]="'Paso ' + paso.numero + ': ' + paso.nombre"
                (click)="ir(paso)"
              >
                @if (paso.numero < actual()) { <span aria-hidden="true">✓</span> }
                @else { {{ paso.numero }} }
              </button>
              <span class="etiqueta">
                {{ paso.nombre }}
                @if (paso.opcional) { <span class="opcional">opcional</span> }
              </span>
            </li>
          }
        </ol>
      </div>
    </nav>
  `
})
export class PasosComponent {
  private readonly router = inject(Router);
  private readonly config = inject(ConfiguracionService);

  readonly pasos = PASOS;
  private readonly url = signal(this.router.url);

  readonly actual = computed(() => {
    const ruta = this.url().split('?')[0];
    return PASOS.find(p => ruta.startsWith(p.ruta))?.numero ?? 1;
  });
  constructor() {
    this.router.events.subscribe(evento => {
      if (evento instanceof NavigationEnd) {
        this.url.set(evento.urlAfterRedirects);
        this.config.alcanzarPaso(this.actual());
      }
    });
    this.config.alcanzarPaso(this.actual());
  }

  /**
   * Clicable = ya visitado. Un paso que nunca has pisado no lo es: la lista no
   * significa nada sin el perfil, así que no se puede saltar hasta ella.
   */
  accesible(numero: number): boolean {
    return numero !== this.actual() && numero <= this.config.pasoMaximo();
  }

  ir(paso: Paso): void {
    if (this.accesible(paso.numero)) this.router.navigate([paso.ruta]);
  }
}
