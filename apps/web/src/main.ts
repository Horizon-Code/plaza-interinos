import { bootstrapApplication } from '@angular/platform-browser';
import { Component, inject } from '@angular/core';
import { provideRouter, RouterLink, RouterLinkActive, RouterOutlet, Routes } from '@angular/router';
import { provideZonelessChangeDetection, provideBrowserGlobalErrorListeners } from '@angular/core';
import { ImportarComponent } from './app/importar.component';
import { PerfilComponent } from './app/perfil.component';
import { ResultadoComponent } from './app/resultado.component';
import { ComprobarComponent } from './app/comprobar.component';
import { ExtensionComponent } from './app/extension.component';
import { ExtensionService } from './app/extension.service';

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
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
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
  `
})
class AppComponent {
  readonly ext = inject(ExtensionService);
  constructor() {
    this.ext.iniciar();
  }
}

bootstrapApplication(AppComponent, {
  providers: [
    provideZonelessChangeDetection(),
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes)
  ]
});
