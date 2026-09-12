import { bootstrapApplication } from '@angular/platform-browser';
import { Component, inject, signal } from '@angular/core';
import { provideRouter, Router, RouterLink, RouterOutlet, Routes } from '@angular/router';
import { provideZonelessChangeDetection, provideBrowserGlobalErrorListeners } from '@angular/core';
import { ImportarComponent } from './app/importar.component';
import { PerfilComponent } from './app/perfil.component';
import { FiltrarComponent } from './app/filtrar.component';
import { OrdenarComponent } from './app/ordenar.component';
import { ResultadoComponent } from './app/resultado.component';
import { ComprobarComponent } from './app/comprobar.component';
import { FinalComponent } from './app/final.component';
import { ExtensionComponent } from './app/extension.component';
import { ExtensionService } from './app/extension.service';
import { EstadoService } from './app/estado.service';
import { ConfiguracionService } from './app/configuracion.service';
import { PasosComponent } from './app/pasos.component';
import { SelectorComunidadComponent } from './app/selector-comunidad.component';
import { EntrarComponent } from './app/entrar.component';
import { LegalComponent } from './app/legal.component';

/**
 * Sin sesión no se entra a ningún paso: se decidió pedir cuenta desde la puerta,
 * así que el guardián vive aquí y no repartido por cada componente.
 */
const conSesion = () => {
  if (inject(EstadoService).sesionIniciada()) return true;
  return inject(Router).createUrlTree(['/entrar']);
};

const routes: Routes = [
  { path: 'entrar', component: EntrarComponent },
  // Publicas a proposito: quien aun no ha entrado tiene derecho a leer que
  // vamos a hacer con sus datos ANTES de dar su correo.
  { path: 'privacidad', component: LegalComponent },
  { path: 'aviso-legal', component: LegalComponent },
  { path: '', redirectTo: 'importar', pathMatch: 'full' },
  { path: 'importar', component: ImportarComponent, canActivate: [conSesion] },
  { path: 'perfil', component: PerfilComponent, canActivate: [conSesion] },
  { path: 'filtrar', component: FiltrarComponent, canActivate: [conSesion] },
  { path: 'ordenar', component: OrdenarComponent, canActivate: [conSesion] },
  { path: 'resultado', component: ResultadoComponent, canActivate: [conSesion] },
  { path: 'comprobar', component: ComprobarComponent, canActivate: [conSesion] },
  { path: 'final', component: FinalComponent, canActivate: [conSesion] },
  { path: 'extension', component: ExtensionComponent, canActivate: [conSesion] }
];

@Component({
  selector: 'pi-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, PasosComponent, SelectorComunidadComponent],
  template: `
    @if (!estado.sesionIniciada()) {
      <main class="acceso">
        <router-outlet />
      </main>
    } @else {
      <main>
        <div class="cabecera">
          <div class="marca">
            <svg width="22" height="24" viewBox="0 0 22 24" fill="currentColor" aria-hidden="true">
              <rect x="0" y="0" width="5" height="24" rx="1.5" />
              <path d="M5 0h8a7 7 0 0 1 0 14H5z" />
            </svg>
            PlazaInterinos
            <span class="ambito">Profesorado</span>
          </div>
          <pi-selector-comunidad />
          <span class="sesion">
            <span class="correo" title="{{ estado.emailSesion() }}">{{ estado.emailSesion() }}</span>
            <button type="button" class="enlace" (click)="salir()">Salir</button>
          </span>
          <span class="proximamente">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6z" />
              <path d="M18.5 15l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z" />
            </svg>
            Próximamente: más comunidades
          </span>
        </div>
        <pi-pasos />
        <router-outlet />
        <p class="conexion-extension">
          @switch (ext.estado()) {
            @case ('paddoc_activo') { <span class="conn ok"><span class="punto"></span> PADDOC conectado</span> }
            @case ('extension_lista') { <span class="conn media"><span class="punto"></span> Extensión lista</span> }
            @default { <a routerLink="/extension" class="conn off"><span class="punto"></span> Conectar extensión</a> }
          }
        </p>
        <p class="empezar-de-cero">
          <button type="button" class="secundario" (click)="empezarDeCero()">
            <span class="titulo">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" /><path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" /><path d="M3 21v-5h5" />
              </svg>
              Empezar de cero
            </span>
            <span class="nota">Borra el perfil, los filtros y el orden guardados.</span>
          </button>
        </p>
        <footer class="pie-legal">
          <a routerLink="/privacidad">Privacidad</a>
          <a routerLink="/aviso-legal">Aviso legal</a>
        </footer>
      </main>
    }
  `
})
class AppComponent {
  readonly ext = inject(ExtensionService);
  readonly estado = inject(EstadoService);
  private readonly config = inject(ConfiguracionService);

  constructor() {
    this.ext.iniciar();
  }

  empezarDeCero(): void {
    if (confirm('¿Descartar el perfil, los filtros y el orden guardados?')) {
      this.config.empezarDeCero();
    }
  }

  salir(): void {
    if (confirm('¿Cerrar sesión? Se borrarán de este navegador la convocatoria y el perfil guardados.')) {
      this.estado.cerrarSesion();
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
