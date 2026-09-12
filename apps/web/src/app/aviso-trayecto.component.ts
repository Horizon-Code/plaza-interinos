import { Component } from '@angular/core';
import { AVISO_TRAYECTO_APROXIMADO, AVISO_TRAYECTO_CORTO } from '@plazainterinos/core';

/**
 * El aviso de que los minutos son una estimación, en las vistas que los pintan.
 *
 * Es un componente y no un trozo de plantilla repetido porque el icono, el
 * texto corto y la explicación larga tienen que decir lo mismo en Filtrar, en
 * Ordenar y en Comprobar: si se copian a mano acaban divergiendo.
 *
 * Dice poco a propósito — tres palabras al lado de las pestañas, sin robar una
 * línea — y deja la explicación entera en el `title`, para quien quiera saber
 * por qué. El matiz importante, que los kilómetros sí son los reales, vive ahí.
 */
@Component({
  selector: 'tp-aviso-trayecto',
  standalone: true,
  // El que se coloca en la fila es este host, no el <span> de dentro: sin esto
  // el `margin-left:auto` se aplicaba a un elemento que no era el item flex y
  // el aviso se quedaba pegado a las pestañas en vez de irse a la derecha.
  styles: [':host { display: inline-flex; }'],
  template: `
    <span class="chip-aviso" [title]="explicacion">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M10.3 3.2 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.2a2 2 0 0 0-3.4 0Z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      {{ corto }}
    </span>
  `
})
export class AvisoTrayectoComponent {
  readonly corto = AVISO_TRAYECTO_CORTO;
  readonly explicacion = AVISO_TRAYECTO_APROXIMADO;
}
