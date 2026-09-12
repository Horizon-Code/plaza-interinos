import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ordenarEnCascada } from '@plazainterinos/core';
import { ConfiguracionService } from './configuracion.service';
import { EstadoService, VacanteEvaluada } from './estado.service';
import { ExcelService } from './excel.service';
import { ListaService } from './lista.service';

/**
 * Paso 7 · Final (SCRUM-27). Cierra el flujo: un resumen corto, el Excel y la
 * salida opcional a PADDOC.
 *
 * La lista se recompone aquí con la misma cascada que el paso 5 en vez de
 * recibirla por parámetro: así el Excel no puede desincronizarse del orden que
 * el usuario acaba de ver, aunque llegue por URL directa.
 */
@Component({
  selector: 'tp-final',
  standalone: true,
  imports: [RouterLink],
  template: `
    <h1>Lista final</h1>

    @if (listaFinal().length) {
      <div class="card cierre">
        <div class="tick" aria-hidden="true">✓</div>
        <strong class="titulo">Todo listo</strong>
        <p class="cuenta">{{ listaFinal().length }} vacantes en tu lista final</p>
        <p class="broma">{{ broma() }}</p>

        <div class="excel">
          <strong>Excel final</strong>
          <p>Orden, centro, localidad, provincia, tipo, especialidad, jornada,
             información, trayecto, notas y avisos.</p>
        </div>

        <button class="btn" (click)="descargar()" [disabled]="generando()">
          {{ generando() ? 'Generando Excel…' : 'Descargar Excel (.xlsx)' }}
        </button>

        <a routerLink="/extension" class="btn secundario" style="text-decoration:none;">
          Conectar extensión para PADDOC
        </a>

        @if (fallo()) {
          <p class="fallo" role="alert">{{ fallo() }}</p>
        }
      </div>

      <p class="lead" style="margin-top:20px;">
        El filtrado está hecho. Guarda el Excel o sigue a PADDOC: tu orden se mantiene igual.
      </p>
      <p><a routerLink="/resultado" style="color:var(--pizarra);">← Volver a la lista</a></p>
    } @else {
      <p class="lead">Tu lista final está vacía.</p>
      <p>Vuelve a <a routerLink="/resultado">tu lista</a> y elige al menos una plaza.</p>
    }
  `,
  styles: [`
    .cierre { text-align:center; padding:28px 22px; }
    .tick { font-size:48px; line-height:1; color:var(--acierto); }
    .titulo { display:block; font-size:21px; margin-top:10px; }
    .cuenta { margin:6px 0 0; color:var(--tinta-suave); font-size:14px; }
    .broma { margin:14px 0 0; color:var(--tinta-suave); font-size:14px; font-style:italic; }
    .excel { background:var(--acierto-bg); border-radius:12px; padding:14px 16px; margin:22px 0 16px; text-align:left; }
    .excel p { margin:4px 0 0; font-size:13px; color:var(--tinta-suave); }
    .cierre .btn { display:block; width:100%; margin-bottom:10px; }
    .fallo { margin:12px 0 0; color:var(--descarte); font-size:14px; }
  `]
})
export class FinalComponent {
  private readonly estado = inject(EstadoService);
  private readonly config = inject(ConfiguracionService);
  private readonly excel = inject(ExcelService);
  private readonly lista = inject(ListaService);

  readonly generando = signal(false);
  readonly fallo = signal('');

  /**
   * La misma lista que muestra el paso 5: cascada del paso 4 y encima el orden
   * manual y las exclusiones que el usuario hizo allí. El Excel tiene que
   * coincidir con lo que vio, no con lo que la cascada diría por su cuenta.
   */
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

  readonly broma = computed(() => {
    const n = this.listaFinal().length;
    if (n === 1) return 'Una sola plaza. O mucha fe, o mucha suerte.';
    if (n < 20) return 'Lista corta y con criterio. Da gusto.';
    if (n > 200) return `${n} plazas ordenadas a mano. Alguien merece una siesta.`;
    return 'Ordenar plazas no es un deporte olímpico, pero debería serlo.';
  });

  async descargar(): Promise<void> {
    this.generando.set(true);
    this.fallo.set('');
    try {
      await this.excel.descargar(this.listaFinal(), new Map(Object.entries(this.lista.anotaciones())));
    } catch (error) {
      this.fallo.set(
        'No se ha podido generar el Excel: ' +
        (error instanceof Error ? error.message : String(error))
      );
    } finally {
      this.generando.set(false);
    }
  }
}
