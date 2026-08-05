import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  DIRECCIONES,
  ORDEN_POR_DEFECTO,
  moverCriterio,
  type CriterioOrden,
  type DireccionOrden
} from '@plazainterinos/core';
import { ConfiguracionService } from './configuracion.service';
import { EstadoService } from './estado.service';

const ICONO: Record<CriterioOrden, string> = {
  distance: '📍',
  specialty: '🎓',
  workload: '🕑',
  voluntary: '⚖️'
};

const NOMBRE: Record<CriterioOrden, string> = {
  distance: 'Distancia',
  specialty: 'Especialidad',
  workload: 'Jornada',
  voluntary: 'Voluntaria u obligatoria'
};

const DESCRIPCION: Record<DireccionOrden, string> = {
  'cerca-primero': 'Primero las más cerca de casa',
  'lejos-primero': 'Primero las más lejos de casa',
  'mi-orden-bajo-primero': 'Primero las de tu número de orden más bajo',
  'mi-orden-alto-primero': 'Primero las de tu número de orden más alto',
  'completa-primero': 'Primero la jornada completa',
  'parcial-primero': 'Primero la jornada parcial',
  'obligatoria-primero': 'Primero las obligatorias',
  'voluntaria-primero': 'Primero las voluntarias'
};

/**
 * Paso 4 · Ordenar (opcional). No quita nada: solo recoloca.
 *
 * La cascada es una lista estricta de 1 a 4 sin empates. Sin prioridad única no
 * habría forma de saber qué desempata primero, así que escribir un número mueve
 * la fila a esa posición y corre a las demás.
 */
@Component({
  selector: 'tp-ordenar',
  standalone: true,
  template: `
    <h1>Ordenar <span class="etiqueta-opcional">opcional</span></h1>
    <p class="lead">
      Este paso no descarta ninguna plaza: solo cambia en qué orden las ves.
      Si no tocas nada, la lista sale por cercanía.
    </p>

    <div class="card">
      <p class="fuente" style="border:none; padding:0; font-style:normal;">
        El orden de arriba a abajo es la prioridad: el criterio de abajo solo desempata
        cuando el de arriba da igual. Arrastra la fila, o escribe el número y pulsa Intro.
      </p>

      <ol class="criterios">
        @for (c of config.cascada(); track c.criterio; let i = $index) {
          <li
            class="criterio"
            draggable="true"
            [class.arrastrando]="arrastrando() === i"
            (dragstart)="empezarArrastre(i)"
            (dragover)="$event.preventDefault()"
            (drop)="soltar($event, i)"
            (dragend)="arrastrando.set(null)"
          >
            <span class="asa" aria-hidden="true">⠿</span>
            <input
              class="posicion"
              type="number"
              min="1"
              [max]="config.cascada().length"
              [value]="i + 1"
              (keydown.enter)="fijarPosicion(i, $any($event.target).value); $any($event.target).blur()"
              (blur)="$any($event.target).value = i + 1"
              [attr.aria-label]="'Prioridad de ' + nombre(c.criterio)"
            />
            <span class="icono" aria-hidden="true">{{ icono(c.criterio) }}</span>
            <span class="texto">
              <strong>{{ nombre(c.criterio) }}</strong>
              <span class="direccion">{{ descripcion(c.direccion) }}</span>
            </span>
            <button
              type="button"
              class="secundario invertir"
              (click)="ciclarDireccion(i)"
              [attr.aria-label]="'Cambiar el sentido de ' + nombre(c.criterio)"
              title="Cambiar el sentido"
            >↕</button>
          </li>
        }
      </ol>
    </div>

    <div class="fila-botones" style="justify-content:flex-start;">
      <button (click)="continuar()" [disabled]="calculando()">
        @if (calculando()) { <span class="spinner"></span> Calculando tu lista… }
        @else if (porDefecto()) { Saltar este paso · ordenar por cercanía }
        @else { Guardar orden y ver mi lista }
      </button>
      @if (!porDefecto() && !calculando()) {
        <button class="secundario" (click)="restaurar()">Volver al orden por defecto</button>
      }
    </div>
    @if (estado.error()) { <p class="error">{{ estado.error() }}</p> }
  `
})
export class OrdenarComponent {
  readonly config = inject(ConfiguracionService);
  readonly estado = inject(EstadoService);
  private readonly router = inject(Router);

  readonly arrastrando = signal<number | null>(null);
  readonly calculando = signal(false);

  readonly porDefecto = computed(() =>
    this.config.cascada().every(
      (c, i) => c.criterio === ORDEN_POR_DEFECTO[i].criterio && c.direccion === ORDEN_POR_DEFECTO[i].direccion
    )
  );

  icono(criterio: CriterioOrden): string {
    return ICONO[criterio];
  }

  nombre(criterio: CriterioOrden): string {
    return NOMBRE[criterio];
  }

  descripcion(direccion: DireccionOrden): string {
    return DESCRIPCION[direccion];
  }

  empezarArrastre(i: number): void {
    this.arrastrando.set(i);
  }

  soltar(evento: DragEvent, destino: number): void {
    evento.preventDefault();
    const origen = this.arrastrando();
    if (origen != null) this.config.cascada.set(moverCriterio(this.config.cascada(), origen, destino));
    this.arrastrando.set(null);
  }

  /** Escribir un número mueve la fila a esa posición; las demás se corren. */
  fijarPosicion(desde: number, valor: string): void {
    const destino = Number(valor) - 1;
    if (Number.isNaN(destino)) return;
    this.config.cascada.set(moverCriterio(this.config.cascada(), desde, destino));
  }

  ciclarDireccion(i: number): void {
    const cascada = [...this.config.cascada()];
    const actual = cascada[i];
    const opciones = DIRECCIONES[actual.criterio];
    const siguiente = opciones[(opciones.indexOf(actual.direccion) + 1) % opciones.length];
    cascada[i] = { ...actual, direccion: siguiente };
    this.config.cascada.set(cascada);
  }

  restaurar(): void {
    this.config.cascada.set([...ORDEN_POR_DEFECTO]);
  }

  /**
   * Aquí es donde el perfil viaja a la API y se calcula la lista: es el último
   * paso configurable, así que recoge todo lo decidido en los pasos 2, 3 y 4.
   */
  async continuar(): Promise<void> {
    this.calculando.set(true);
    this.estado.error.set('');
    try {
      const perfil = this.config.construirPerfil(
        this.estado.especialidadesUsuario(),
        this.estado.condicionesDetectadas()
      );
      await this.estado.guardarPerfil(perfil);
      await this.estado.evaluar();
      await this.router.navigate(['/resultado']);
    } catch (error) {
      this.estado.error.set(String(error instanceof Error ? error.message : error));
    } finally {
      this.calculando.set(false);
    }
  }
}
