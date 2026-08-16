import { Component, ElementRef, computed, inject, signal } from '@angular/core';
import { COMUNIDADES, type Comunidad } from './comunidades';

/**
 * Selector de comunidad de la cabecera. Hoy solo Aragón es elegible, pero el
 * desplegable enseña el resto en gris: dice qué falta sin fingir que está.
 *
 * No es un `<select>` nativo porque cada opción lleva su bandera, y las options
 * no admiten contenido. A cambio hay que cerrar a mano con Escape y con el
 * clic fuera.
 */
@Component({
  selector: 'pi-selector-comunidad',
  standalone: true,
  host: {
    '(document:click)': 'cerrarSiEsFuera($event)',
    '(document:keydown.escape)': 'abierto.set(false)'
  },
  template: `
    <div class="selector-comunidad">
      <button
        type="button"
        class="pill-region"
        [attr.aria-expanded]="abierto()"
        aria-haspopup="listbox"
        aria-label="Comunidad autónoma"
        (click)="abierto.set(!abierto())"
      >
        <span class="bandera" [class]="'bandera bandera-' + actual().id" aria-hidden="true"></span>
        <span class="nombre">{{ actual().nombre }}</span>
        <span class="chevron" [class.arriba]="abierto()" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>

      @if (abierto()) {
        <ul class="menu-comunidades" role="listbox" aria-label="Elige comunidad"
            animate.enter="entra-menu" animate.leave="sale-menu">
          @for (c of comunidades; track c.id) {
            <li role="option" [attr.aria-selected]="c.id === actual().id"
                [attr.aria-disabled]="!c.disponible">
              <button type="button" [disabled]="!c.disponible" (click)="elegir(c)">
                <span [class]="'bandera bandera-' + c.id" aria-hidden="true"></span>
                <span class="nombre">{{ c.nombre }}</span>
                @if (!c.disponible) {
                  <span class="pronto">Próximamente</span>
                } @else if (c.id === actual().id) {
                  <span class="marca" aria-hidden="true">✓</span>
                }
              </button>
            </li>
          }
        </ul>
      }
    </div>
  `
})
export class SelectorComunidadComponent {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly comunidades = COMUNIDADES;
  readonly abierto = signal(false);
  readonly elegida = signal(COMUNIDADES[0].id);
  readonly actual = computed(
    () => this.comunidades.find(c => c.id === this.elegida()) ?? this.comunidades[0]
  );

  elegir(c: Comunidad): void {
    if (!c.disponible) return;
    this.elegida.set(c.id);
    this.abierto.set(false);
  }

  cerrarSiEsFuera(evento: Event): void {
    if (!this.abierto()) return;
    if (!this.host.nativeElement.contains(evento.target as Node)) this.abierto.set(false);
  }
}
