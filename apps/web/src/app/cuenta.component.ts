import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { EstadoService } from './estado.service';

/**
 * Los dos derechos del RGPD que se pueden ejercer aquí mismo: descargar todo lo
 * que guardamos de ti, y borrar la cuenta.
 *
 * El borrado pide escribir el correo entero antes de habilitar el botón. No es
 * burocracia: no hay papelera ni copia de seguridad de la que rescatarlo, así
 * que el clic tiene que costar más que un descuido.
 */
@Component({
  selector: 'tp-cuenta',
  standalone: true,
  template: `
    <div class="card">
      <h2 style="margin-top:0;">Tu cuenta</h2>
      <p class="fuente" style="margin-bottom:14px;">
        Sesión iniciada como <strong>{{ estado.emailSesion() || 'tu cuenta' }}</strong>.
      </p>

      <h3>Descargar tus datos</h3>
      <p>
        Un fichero con todo lo que guardamos de ti: tu cuenta, tus perfiles y tus
        convocatorias con sus listas.
      </p>
      <button type="button" class="secundario" (click)="descargar()" [disabled]="descargando()">
        {{ descargando() ? 'Preparando…' : 'Descargar mis datos' }}
      </button>

      <hr style="border:none; border-top:1px solid var(--linea); margin:22px 0;" />

      <h3>Borrar la cuenta</h3>
      <p>
        Se borra todo: tu correo, la dirección que usas para los trayectos, tus
        preferencias y tus listas. <strong>No hay vuelta atrás</strong> y no guardamos copia.
      </p>

      @if (!confirmando()) {
        <button type="button" class="peligro" (click)="confirmando.set(true)">Borrar mi cuenta</button>
      } @else {
        <p class="aviso-fuerte">
          Para confirmar, escribe tu correo: <strong>{{ estado.emailSesion() }}</strong>
        </p>
        <input type="email" [value]="escrito()" (input)="escrito.set($any($event.target).value)"
               placeholder="tu@correo.es" autocomplete="off" style="width:100%; margin-bottom:10px;" />
        <div class="fila-botones" style="justify-content:flex-start;">
          <button type="button" class="peligro" [disabled]="!coincide() || borrando()" (click)="borrar()">
            {{ borrando() ? 'Borrando…' : 'Borrar definitivamente' }}
          </button>
          <button type="button" class="secundario" (click)="cancelar()">Cancelar</button>
        </div>
      }

      @if (error()) { <p class="error" style="margin-top:10px;">{{ error() }}</p> }
    </div>
  `,
  styles: [`
    h3 { font-size: 16px; margin: 0 0 4px; }
    p { font-size: 15px; margin: 0 0 12px; }
    .peligro { background: var(--descarte); color: #fff; }
    .peligro:disabled { opacity: 0.5; }
  `]
})
export class CuentaComponent {
  readonly estado = inject(EstadoService);
  private readonly router = inject(Router);

  readonly confirmando = signal(false);
  readonly escrito = signal('');
  readonly borrando = signal(false);
  readonly descargando = signal(false);
  readonly error = signal('');

  /** Sin distinguir mayúsculas ni espacios de más: se confirma, no se examina. */
  coincide(): boolean {
    const suyo = (this.estado.emailSesion() ?? '').trim().toLowerCase();
    return !!suyo && this.escrito().trim().toLowerCase() === suyo;
  }

  cancelar(): void {
    this.confirmando.set(false);
    this.escrito.set('');
    this.error.set('');
  }

  async descargar(): Promise<void> {
    this.descargando.set(true);
    this.error.set('');
    try {
      const datos = await this.estado.misDatos();
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' })
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mis-datos-plazainterinos.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se han podido descargar tus datos.');
    } finally {
      this.descargando.set(false);
    }
  }

  async borrar(): Promise<void> {
    if (!this.coincide()) return;
    this.borrando.set(true);
    this.error.set('');
    try {
      await this.estado.borrarCuenta();
      this.router.navigateByUrl('/entrar');
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se ha podido borrar la cuenta.');
      this.borrando.set(false);
    }
  }
}
