import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { EstadoService } from './estado.service';

/** Lo que el script de Google deja en `window`, solo lo que usamos. */
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(config: {
            client_id: string;
            callback: (respuesta: { credential?: string }) => void;
            cancel_on_tap_outside?: boolean;
          }): void;
          renderButton(elemento: HTMLElement, opciones: Record<string, unknown>): void;
        };
      };
    };
  }
}

const SCRIPT_GOOGLE = 'https://accounts.google.com/gsi/client';

/**
 * Entrada con Google.
 *
 * Google le da al navegador un ID token firmado y la API lo verifica: aquí no
 * se guarda ninguna contraseña ni se envía ningún correo, así que tampoco hay
 * alta separada. La primera vez que alguien entra, su cuenta se crea sola.
 *
 * El botón lo dibuja el propio script de Google y no una imitación nuestra: es
 * lo que exigen sus condiciones de marca, y además es lo que la gente reconoce.
 */
@Component({
  selector: 'pi-entrar',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="marca marca-clara">
      <svg width="22" height="24" viewBox="0 0 22 24" fill="currentColor" aria-hidden="true">
        <rect x="0" y="0" width="5" height="24" rx="1.5" />
        <path d="M5 0h8a7 7 0 0 1 0 14H5z" />
      </svg>
      PlazaInterinos
      <span class="ambito">Profesorado</span>
    </div>

    <section class="tarjeta">
      <h1>Entra en tu cuenta</h1>

      <!-- Google dibuja su botón aquí dentro. -->
      <div class="boton-google"></div>

      @if (cargando()) { <p role="status" class="estado"><span class="spinner"></span> Entrando…</p> }
      @if (error()) { <p class="error">{{ error() }}</p> }
      @if (sinConfigurar()) {
        <p class="error">La entrada con Google todavía no está configurada en el servidor.</p>
      }

      <p class="nota-acceso">
        Al entrar aceptas el <a routerLink="/aviso-legal">aviso legal</a> y el tratamiento
        de tus datos que explica la <a routerLink="/privacidad">política de privacidad</a>.
      </p>
    </section>

    <footer class="pie-legal pie-claro">
      <a routerLink="/privacidad">Privacidad</a>
      <a routerLink="/aviso-legal">Aviso legal</a>
    </footer>
  `,
  styles: [`
    /* La pantalla de acceso se apropia de la ventana entera: el verde de marca
       pasa a ser el fondo en vez de quedarse en los detalles. Va en el :host y
       no en \`main.acceso\` porque ese contenedor lo comparten las paginas
       legales, que se leen sobre el fondo claro de siempre. */
    :host {
      position: fixed;
      inset: 0;
      overflow: auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 26px;
      background: var(--pizarra-oscura);
      padding: 40px 20px;
    }

    /* Marca en negativo; el distintivo se invierte para no perderse en el verde. */
    .marca-clara { color: var(--tiza); }
    .marca-clara .ambito { background: var(--tiza); color: var(--pizarra-oscura); }

    .tarjeta {
      width: min(100%, 420px);
      background: #fff;
      border: 1px solid var(--linea);
      border-radius: var(--radio);
      padding: 32px 34px 26px;
      box-shadow: 0 18px 40px rgba(0, 0, 0, 0.22);
    }

    .boton-google { display: flex; justify-content: center; min-height: 44px; margin: 24px 0 0; }
    .estado { display: flex; align-items: center; gap: 8px; font-size: 14px; margin: 12px 0 0; }
    .error { margin: 12px 0 0; }
    .nota-acceso a { color: var(--pizarra); }

    .pie-claro a { color: rgba(246, 245, 240, 0.62); }
    .pie-claro a:hover { color: var(--tiza); }
  `]
})
export class EntrarComponent {
  private readonly estado = inject(EstadoService);
  private readonly router = inject(Router);

  readonly cargando = signal(false);
  readonly error = signal('');
  readonly sinConfigurar = signal(false);

  private montado = false;

  /**
   * `ngAfterViewChecked` y no `ngAfterViewInit` porque el contenedor del botón
   * está dentro de un bloque que puede no existir en el primer render. El
   * `montado` evita que Google dibuje dos botones.
   */
  async ngAfterViewChecked(): Promise<void> {
    if (this.montado) return;
    const contenedor = document.querySelector<HTMLElement>('.boton-google');
    if (!contenedor) return;
    this.montado = true;
    try {
      await this.montarBoton(contenedor);
    } catch {
      this.sinConfigurar.set(true);
    }
  }

  private async montarBoton(contenedor: HTMLElement): Promise<void> {
    const { clientId } = await this.estado.configuracionGoogle();
    if (!clientId) { this.sinConfigurar.set(true); return; }

    await cargarScript(SCRIPT_GOOGLE);
    const google = window.google;
    if (!google) { this.sinConfigurar.set(true); return; }

    google.accounts.id.initialize({
      client_id: clientId,
      callback: respuesta => void this.entrar(respuesta?.credential)
    });
    google.accounts.id.renderButton(contenedor, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'pill',
      locale: 'es',
      width: 280
    });
  }

  private async entrar(idToken?: string): Promise<void> {
    if (!idToken) { this.error.set('Google no ha devuelto ninguna credencial.'); return; }
    this.cargando.set(true);
    this.error.set('');
    try {
      await this.estado.entrarConGoogle(idToken);
      this.router.navigateByUrl('/importar');
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No hemos podido entrar. Inténtalo de nuevo.');
    } finally {
      this.cargando.set(false);
    }
  }
}

/** Un solo <script> por página, aunque se vuelva a la pantalla de entrada. */
function cargarScript(src: string): Promise<void> {
  const existente = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
  if (existente?.dataset['cargado'] === 'si') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = existente ?? document.createElement('script');
    script.addEventListener('load', () => { script.dataset['cargado'] = 'si'; resolve(); });
    script.addEventListener('error', () => reject(new Error('No se ha podido cargar Google.')));
    if (!existente) {
      script.src = src;
      script.async = true;
      document.head.appendChild(script);
    }
  });
}
