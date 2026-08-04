import { bootstrapApplication } from '@angular/platform-browser';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { provideRouter, RouterLink, RouterLinkActive, RouterOutlet, Routes } from '@angular/router';
import { provideZonelessChangeDetection, provideBrowserGlobalErrorListeners } from '@angular/core';
import { ImportarComponent } from './app/importar.component';
import { PerfilComponent } from './app/perfil.component';
import { ResultadoComponent } from './app/resultado.component';
import { ComprobarComponent } from './app/comprobar.component';
import { ExtensionComponent } from './app/extension.component';
import { ExtensionService } from './app/extension.service';
import { EstadoService } from './app/estado.service';

const routes: Routes = [
  { path: '', redirectTo: 'importar', pathMatch: 'full' },
  { path: 'importar', component: ImportarComponent },
  { path: 'perfil', component: PerfilComponent },
  { path: 'resultado', component: ResultadoComponent },
  { path: 'comprobar', component: ComprobarComponent },
  { path: 'extension', component: ExtensionComponent }
];

@Component({
  selector: 'pi-root',
  standalone: true,
  imports: [FormsModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    @if (!estado.accesoAutorizado()) {
      <main class="acceso">
        <section class="card acceso-card">
          <div class="marca acceso-marca">PlazaInterinos</div>
          <h1>Acceso privado</h1>
          <p class="lead">Estamos preparando la apertura. Entra solo con la clave de acceso.</p>
          <form (ngSubmit)="entrar()">
            <label for="access-code">Clave de acceso</label>
            <input
              id="access-code"
              type="password"
              name="accessCode"
              autocomplete="off"
              [(ngModel)]="codigo"
              [disabled]="cargando()"
            />
            @if (error()) {
              <p class="error">{{ error() }}</p>
            }
            <button type="submit" [disabled]="cargando() || !codigo.trim()">
              @if (cargando()) { <span class="spinner"></span> Entrando… }
              @else { Entrar }
            </button>
          </form>
        </section>
      </main>
    } @else {
      <main>
        <div class="cabecera">
          <div class="marca">PlazaInterinos<span>Elige destino con datos, no con agotamiento</span></div>
          @switch (ext.estado()) {
            @case ('paddoc_activo') { <span class="conn ok"><span class="punto"></span> PADDOC conectado</span> }
            @case ('extension_lista') { <span class="conn media"><span class="punto"></span> Extensión lista</span> }
            @default { <a routerLink="/extension" class="conn off"><span class="punto"></span> Conectar extensión</a> }
          }
        </div>
        <nav class="pasos">
          <a routerLink="/importar" routerLinkActive="activo">1 · Convocatoria</a>
          <a routerLink="/perfil" routerLinkActive="activo">2 · Perfil</a>
          <a routerLink="/resultado" routerLinkActive="activo">3 · Lista</a>
          <a routerLink="/comprobar" routerLinkActive="activo">4 · Comprobación</a>
        </nav>
        <router-outlet />
      </main>
    }
  `
})
class AppComponent {
  readonly ext = inject(ExtensionService);
  readonly estado = inject(EstadoService);
  readonly cargando = signal(false);
  readonly error = signal('');
  codigo = '';

  constructor() {
    this.ext.iniciar();
  }

  async entrar(): Promise<void> {
    this.error.set('');
    this.cargando.set(true);
    try {
      await this.estado.desbloquear(this.codigo);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se ha podido validar la clave.');
    } finally {
      this.cargando.set(false);
    }
  }
}

bootstrapApplication(AppComponent, {
  providers: [
    provideZonelessChangeDetection(),
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes)
  ]
});
