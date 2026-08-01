import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ExtensionService } from './extension.service';

@Component({
  selector: 'tp-extension',
  standalone: true,
  imports: [RouterLink],
  template: `
    <h1>Rellenar en PADDOC</h1>
    <p class="lead">
      Función opcional. PlazaInterinos funciona sin ella: puedes subir la convocatoria,
      ordenar tu lista y exportarla. La extensión solo añade rellenar las plazas
      en PADDOC automáticamente, dentro de tu propia sesión.
    </p>

    <div class="paso" [class.hecho]="ext.conectada">
      <div class="num">{{ ext.conectada ? '✓' : '1' }}</div>
      <div>
        <strong>Instala la extensión de PlazaInterinos</strong>
        <p>Se instala una sola vez. Rellena tus plazas dentro de tu sesión de PADDOC, sin que tus credenciales pasen por nosotros.</p>
        @if (!ext.conectada) {
          <a class="btn" href="https://chrome.google.com/webstore" target="_blank" rel="noopener" style="text-decoration:none;">Ir a Chrome Web Store</a>
        } @else {
          <span style="color:var(--acierto); font-weight:600;">Extensión detectada.</span>
        }
      </div>
    </div>

    <div class="paso" [class.hecho]="ext.paddocListo" [class.bloq]="!ext.conectada">
      <div class="num">{{ ext.paddocListo ? '✓' : '2' }}</div>
      <div>
        <strong>Entra en PADDOC con tu Cl&#64;ve</strong>
        <p>Ábrelo y entra como haces siempre, en el sitio oficial. Esperamos aquí hasta detectar tu sesión.</p>
        @if (ext.conectada && !ext.paddocListo) {
          <a class="btn" href="https://paddoc.aragon.es/" target="_blank" rel="noopener" style="text-decoration:none;">Abrir PADDOC</a>
        } @else if (ext.paddocListo) {
          <span style="color:var(--acierto); font-weight:600;">Sesión de PADDOC activa.</span>
        }
      </div>
    </div>

    <div class="paso" [class.bloq]="!ext.paddocListo">
      <div class="num">3</div>
      <div>
        <strong>Vuelve a tu lista y pulsa "Rellenar en PADDOC"</strong>
        <p>Rellenamos las plazas en orden, a la vista. El envío final lo confirmas tú.</p>
        @if (ext.paddocListo) {
          <a routerLink="/resultado" class="btn" style="text-decoration:none;">Ir a mi lista</a>
        }
      </div>
    </div>

    <p style="margin-top:24px;">
      <a routerLink="/importar" style="color:var(--pizarra);">← Seguir trabajando sin la extensión</a>
    </p>
  `,
  styles: [`
    .paso { display:flex; gap:14px; background:#fff; border:1px solid var(--linea); border-radius:10px; padding:16px 18px; margin-bottom:10px; }
    .paso.hecho { border-color:var(--acierto); }
    .paso.bloq { opacity:0.5; }
    .paso .num { flex-shrink:0; width:28px; height:28px; border-radius:50%; background:var(--pizarra); color:var(--tiza); display:flex; align-items:center; justify-content:center; font-weight:600; }
    .paso.hecho .num { background:var(--acierto); }
    .paso strong { font-size:15px; }
    .paso p { margin:4px 0 10px; font-size:14px; color:var(--tinta-suave); }
  `]
})
export class ExtensionComponent {
  readonly ext = inject(ExtensionService);
}
