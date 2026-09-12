import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { formatearTrayecto, ordenarEnCascada } from '@plazainterinos/core';
import { ConfiguracionService } from './configuracion.service';
import { EstadoService, VacanteEvaluada } from './estado.service';
import { ListaService } from './lista.service';
import { AvisoTrayectoComponent } from './aviso-trayecto.component';
import { TablaVacantesComponent } from './tabla-vacantes.component';

/**
 * Paso 6 · Comprobación (SCRUM-26). El último vistazo antes de enviar.
 *
 * No es una pantalla aparte con sus propios datos: la tabla, las anotaciones,
 * los avisos y el orden son exactamente los del paso 5, leídos del mismo
 * ListaService. Editar aquí se ve allí porque es el mismo sitio, no porque haya
 * una sincronización que pueda fallar.
 */
@Component({
  selector: 'tp-comprobar',
  standalone: true,
  imports: [RouterLink, TablaVacantesComponent, AvisoTrayectoComponent],
  template: `
    <h1>Comprobación</h1>
    <p class="lead">El último vistazo que evita el error que se paga todo el curso.</p>

    @if (obligatoriasFuera().length) {
      <details class="aviso-bloque" open>
        <summary>
          <strong>{{ obligatoriasFuera().length }} obligatoria(s) fuera de tu selección</strong>
        </summary>
        <div class="acciones-bloque">
          <button type="button" class="secundario"
                  (click)="ponerTodasAlFinal(obligatoriasFuera())">Poner todas al final</button>
          <button type="button" class="secundario"
                  (click)="lista.descartarTodos(ids(obligatoriasFuera()))">Descartar todos</button>
        </div>
        @for (e of obligatoriasFuera(); track e.vacancyId) {
          <div class="plaza">
            <span class="datos">
              <strong>{{ e.vacancy.centerName }}</strong> — {{ e.vacancy.municipality }}
              <span class="menor">{{ e.vacancy.specialtyName }} · {{ trayecto(e) }}</span>
            </span>
            <span class="mandos">
              <span class="fuera">No está en tu lista</span>
              <label class="donde">
                Añadir en la
                <input type="number" min="1" [max]="listaFinal().length + 1"
                       class="posicion" #pos [value]="listaFinal().length + 1"
                       [attr.aria-label]="'Posición en la que añadir ' + e.vacancy.centerName" />
                de {{ listaFinal().length + 1 }}
              </label>
              <button type="button" class="secundario"
                      (click)="anadir(e, pos.value)">Añadir</button>
              <button type="button" class="mini" (click)="lista.descartarAviso(e.vacancyId)"
                      [attr.aria-label]="'Descartar el aviso de ' + e.vacancy.centerName">✕</button>
            </span>
          </div>
        }
      </details>
    }

    @if (voluntariasNoElegidas().length) {
      <details class="aviso-bloque" open>
        <summary>
          <strong>{{ voluntariasNoElegidas().length }} voluntaria(s) compatible(s) que no elegiste</strong>
        </summary>
        <div class="acciones-bloque">
          <button type="button" class="secundario"
                  (click)="ponerTodasAlFinal(voluntariasNoElegidas())">Poner todas al final</button>
          <button type="button" class="secundario"
                  (click)="lista.descartarTodos(ids(voluntariasNoElegidas()))">Descartar todos</button>
        </div>
        @for (e of voluntariasNoElegidas(); track e.vacancyId) {
          <div class="plaza">
            <span class="datos">
              <strong>{{ e.vacancy.centerName }}</strong> — {{ e.vacancy.municipality }}
              <span class="menor">{{ e.vacancy.specialtyName }} · {{ trayecto(e) }}</span>
            </span>
            <span class="mandos">
              <span class="fuera">No está en tu lista</span>
              <label class="donde">
                Añadir en la
                <input type="number" min="1" [max]="listaFinal().length + 1"
                       class="posicion" #posv [value]="listaFinal().length + 1"
                       [attr.aria-label]="'Posición en la que añadir ' + e.vacancy.centerName" />
                de {{ listaFinal().length + 1 }}
              </label>
              <button type="button" class="secundario"
                      (click)="anadir(e, posv.value)">Añadir</button>
              <button type="button" class="mini" (click)="lista.descartarAviso(e.vacancyId)"
                      [attr.aria-label]="'Descartar el aviso de ' + e.vacancy.centerName">✕</button>
            </span>
          </div>
        }
      </details>
    }

    @if (!obligatoriasFuera().length && !voluntariasNoElegidas().length) {
      <div class="card" style="border-color:var(--acierto);">
        <strong style="color:var(--acierto)">Todo en orden.</strong>
        <p style="margin:8px 0 0;">No falta ninguna plaza compatible y no queda ninguna obligatoria fuera.</p>
      </div>
    }

    <div class="fila-aviso">
      <h2>Tu lista, tal como quedará</h2>
      @if (listaFinal().length) { <tp-aviso-trayecto /> }
    </div>
    @if (listaFinal().length) {
      <div #tabla>
        <tp-tabla-vacantes [filas]="listaFinal()" [destacada]="recienAnadida()"
                           (reordenada)="ordenCambiado()" />
      </div>
    } @else {
      <p>Tu lista está vacía. Vuelve a <a routerLink="/resultado">Ordenar lista</a>.</p>
    }

    <div class="fila-botones" style="margin-top:22px;">
      <button (click)="guardarYVolver()">Guardar y volver a ordenar</button>
      <button class="secundario" (click)="lista.borrarAnotaciones()"
              [disabled]="!cuantasNotas()">Borrar anotaciones</button>
      <button class="secundario" (click)="lista.borrarAvisos()"
              [disabled]="!cuantosAvisos()">Borrar avisos ⚠</button>
      <a routerLink="/final" class="btn" style="text-decoration:none;">Ir a la lista final →</a>
    </div>
  `,
  styles: [`
    .aviso-bloque { background:#fff; border:1px solid var(--aviso); border-radius:var(--radio);
      padding:12px 16px; margin-bottom:12px; }
    .aviso-bloque summary { cursor:pointer; color:var(--aviso); }
    .acciones-bloque { display:flex; gap:8px; flex-wrap:wrap; margin:10px 0; }
    .plaza { display:flex; justify-content:space-between; align-items:center; gap:10px;
      flex-wrap:wrap; padding:8px 0; border-top:1px solid var(--linea); }
    .plaza .datos { display:flex; flex-direction:column; min-width:0; }
    .plaza .menor { font-size:13px; color:var(--tinta-suave); }
    .plaza .mandos { display:flex; gap:6px; align-items:center; flex-shrink:0; }
    .posicion { width:56px; text-align:center; padding:4px; border:1px solid var(--linea); border-radius:6px; }
    .fuera { font-size:12px; color:var(--tinta-suave); font-style:italic; }
    .donde { display:inline-flex; align-items:center; gap:5px; font-size:13px; }
    .mini { padding:2px 8px; border:1px solid var(--linea); background:#fff;
      border-radius:6px; cursor:pointer; }
    .mini:hover { background:var(--descarte-bg); border-color:var(--descarte); }
  `]
})
export class ComprobarComponent {
  readonly estado = inject(EstadoService);
  readonly config = inject(ConfiguracionService);
  readonly lista = inject(ListaService);
  private readonly router = inject(Router);
  private readonly tabla = viewChild<ElementRef<HTMLElement>>('tabla');

  /** Última plaza insertada: la tabla la señala unos segundos. */
  readonly recienAnadida = signal<string | null>(null);

  /** Idéntica a la del paso 5: misma cascada y mismo orden manual. */
  readonly listaFinal = computed<VacanteEvaluada[]>(() => {
    const resultado = this.estado.resultado();
    if (!resultado) return [];
    const orden = this.config.ordenPorEspecialidad(this.estado.especialidadesUsuario());
    const enCascada = ordenarEnCascada(
      [...resultado.recommended, ...resultado.withWarnings],
      this.config.cascada(),
      orden,
      this.config.ordenProvincias(),
      this.config.ordenVoluntarias(),
      this.config.modo()
    );
    return this.lista.componer(enCascada, resultado.excluded);
  });

  private readonly enLista = computed(() => new Set(this.listaFinal().map(e => e.vacancyId)));

  /**
   * Obligatorias que no están en la lista. Se miran todas las evaluadas, no solo
   * las recomendadas: una obligatoria que quedó excluida o que quitaste a mano
   * sigue siendo una obligatoria fuera, y eso es justo lo que hay que avisar.
   */
  readonly obligatoriasFuera = computed(() => {
    const r = this.estado.resultado();
    if (!r) return [];
    const dentro = this.enLista();
    // Sin deduplicar: una vacante puede venir en más de un grupo de la API, y
    // dos filas con la misma clave rompen el @for entero (NG0955), dejando el
    // bloque pintado a medias y sin plazas.
    return unicas(
      [...r.recommended, ...r.withWarnings, ...r.excluded].filter(
        e => !e.vacancy.voluntary && !dentro.has(e.vacancyId) && !this.lista.descartado(e.vacancyId)
      )
    );
  });

  readonly voluntariasNoElegidas = computed(() => {
    const dentro = this.enLista();
    const compatibles = this.estado.comprobacion()?.missingCompatible ?? [];
    return unicas(
      compatibles.filter(
        e => e.vacancy.voluntary && !dentro.has(e.vacancyId) && !this.lista.descartado(e.vacancyId)
      )
    );
  });

  readonly cuantasNotas = computed(() =>
    this.listaFinal().filter(e => !!this.lista.anotacion(e.vacancyId)).length
  );
  readonly cuantosAvisos = computed(() =>
    this.listaFinal().filter(e => this.lista.tieneAviso(e.vacancyId)).length
  );

  ids(filas: readonly VacanteEvaluada[]): string[] {
    return filas.map(e => e.vacancyId);
  }

  trayecto(e: VacanteEvaluada): string {
    return formatearTrayecto(e);
  }

  /**
   * Inserta la plaza y te lleva a verla.
   *
   * Sin esto la acción era invisible: la plaza desaparecía del desplegable y no
   * había forma de saber dónde había caído ni cómo quedaba la numeración.
   */
  anadir(e: VacanteEvaluada, posicion: string): void {
    const n = Number(posicion);
    const indice = posicion.trim() && !Number.isNaN(n) ? n - 1 : undefined;
    this.lista.insertar(this.ids(this.listaFinal()), e.vacancyId, indice);

    this.recienAnadida.set(e.vacancyId);
    this.tabla()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => this.recienAnadida.set(null), 4000);
  }

  ponerTodasAlFinal(filas: readonly VacanteEvaluada[]): void {
    this.lista.añadirTodasAlFinal(this.ids(this.listaFinal()), this.ids(filas));
  }

  ordenCambiado(): void {
    this.lista.fijarOrden(this.ids(this.listaFinal()));
  }

  /** Todo está ya guardado al momento: esto solo devuelve a la pantalla 5. */
  guardarYVolver(): void {
    void this.router.navigate(['/resultado']);
  }
}

/**
 * Una fila por vacante y solo las que traen ficha.
 *
 * Lo segundo no es paranoia: el endpoint de comprobación devolvía las filas sin
 * `vacancy`, y un solo `undefined` tumbaba la pantalla entera. Ya está
 * arreglado en la API, pero una pantalla de repaso no puede quedarse en blanco
 * por un campo que falte.
 */
function unicas(filas: VacanteEvaluada[]): VacanteEvaluada[] {
  const vistas = new Set<string>();
  return filas.filter(
    e => e?.vacancy && !vistas.has(e.vacancyId) && vistas.add(e.vacancyId)
  );
}
