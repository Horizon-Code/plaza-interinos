import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import type { DetectedCondition } from '@plazainterinos/core';
import { ConfiguracionService } from './configuracion.service';
import { EstadoService } from './estado.service';

interface GrupoCondiciones {
  titulo: string;
  condiciones: DetectedCondition[];
}

/**
 * Paso 3 · Filtrar (opcional). Lo único que quita plazas de la lista.
 *
 * Y solo quita voluntarias: una obligatoria filtrada seguiría pudiendo serte
 * adjudicada sin que la hubieras visto, así que el core la mantiene dentro
 * pase lo que pase (punto 1). Aquí eso se dice en voz alta, no en letra pequeña.
 */
@Component({
  selector: 'tp-filtrar',
  standalone: true,
  imports: [FormsModule],
  template: `
    <h1>Filtrar <span class="etiqueta-opcional">opcional</span></h1>
    <p class="lead">
      Este es el único paso que <strong>elimina</strong> plazas de tu lista.
      Si no tocas nada, no se descarta ninguna.
    </p>

    <p class="aviso-fuerte">
      Las plazas obligatorias nunca se filtran: siempre entran en tu lista.
    </p>

    <!-- ── 1 · Voluntarias y sus condiciones ──────────────────────────── -->
    <div class="card">
      <h2>Plazas voluntarias</h2>
      <span class="check">
        <input type="checkbox" [ngModel]="config.voluntarias()"
               (ngModelChange)="config.voluntarias.set($event)" />
        Quiero que entren plazas voluntarias
      </span>

      @if (config.voluntarias()) {
        @if (grupos().length === 0) {
          <p class="fuente">Importa una convocatoria en el paso 1 para ver aquí sus condiciones
            reales (programas, idiomas, FP…).</p>
        } @else {
          <p class="fuente">Detectadas en la información adicional de tus vacantes voluntarias.
            Marca las que aceptas; lo que dejes sin marcar se excluye. Puedes darle un trayecto
            máximo propio a cada una.</p>
          @for (grupo of grupos(); track grupo.titulo) {
            <label>{{ grupo.titulo }}</label>
            @for (c of grupo.condiciones; track c.tag) {
              <div class="condicion">
                <span class="check" style="margin:0;">
                  <input type="checkbox" [checked]="config.acepta()[c.tag] === true"
                         (change)="alternarCondicion(c.tag)" />
                  {{ c.label }}
                </span>
                <span class="badge">{{ c.count }} vacante{{ c.count === 1 ? '' : 's' }}</span>
                @if (config.acepta()[c.tag]) {
                  <input type="number" [ngModel]="config.trayectoCondicion()[c.tag]"
                         (ngModelChange)="editarTrayectoCondicion(c.tag, $event)"
                         placeholder="máx {{ config.unidad() }}" min="0"
                         title="Trayecto máximo solo para esta condición" />
                }
              </div>
            }
          }
        }
      } @else {
        <p class="fuente">Sin plazas voluntarias no hay nada más que filtrar: tu lista tendrá
          solo las obligatorias.</p>
      }
    </div>

    <!-- ── 2 · Localidades excluidas ──────────────────────────────────── -->
    <div class="card">
      <h2>Localidades excluidas</h2>
      @if (municipiosDisponibles().length || config.municipiosExcluidos().length) {
        <p class="fuente">Ninguna vacante voluntaria de estas localidades entrará en tu lista.</p>
        <select [ngModel]="''" (ngModelChange)="anadirMunicipio($event)"
                aria-label="Añadir localidad a excluir">
          <option value="">Añadir una localidad…</option>
          @for (m of municipiosDisponibles(); track m) {
            <option [value]="m">{{ m }}</option>
          }
        </select>
        @if (config.municipiosExcluidos().length) {
          <div class="chips">
            @for (m of config.municipiosExcluidos(); track m) {
              <span class="chip fuera">
                {{ m }}
                <button type="button" class="quitar" (click)="quitarMunicipio(m)"
                        [attr.aria-label]="'Dejar de excluir ' + m">✕</button>
              </span>
            }
          </div>
        }
      } @else {
        <p class="fuente">Importa una convocatoria en el paso 1 para elegir localidades.</p>
      }
    </div>

    <!-- ── 3 · Centros excluidos ──────────────────────────────────────── -->
    <div class="card">
      <h2>Centros excluidos (IES)</h2>
      @if (centrosDisponibles().length || config.centrosExcluidos().length) {
        <p class="fuente">Ninguna vacante de estos centros entrará en tu lista.</p>
        <select [ngModel]="''" (ngModelChange)="anadirCentro($event)"
                aria-label="Añadir centro a excluir">
          <option value="">Añadir un IES…</option>
          @for (c of centrosDisponibles(); track c.code) {
            <option [value]="c.code">{{ c.name }} — {{ c.municipality }}</option>
          }
        </select>
        @if (config.centrosExcluidos().length) {
          <div class="chips">
            @for (code of config.centrosExcluidos(); track code) {
              <span class="chip fuera">
                {{ nombreCentro(code) }}
                <button type="button" class="quitar" (click)="quitarCentro(code)"
                        [attr.aria-label]="'Dejar de excluir ' + nombreCentro(code)">✕</button>
              </span>
            }
          </div>
        }
      } @else {
        <p class="fuente">Importa una convocatoria en el paso 1 para elegir centros.</p>
      }
    </div>

    <div class="fila-botones" style="justify-content:flex-start;">
      @if (hayFiltros()) {
        <button (click)="continuar()">Guardar filtros y continuar</button>
        <button class="secundario" (click)="quitarFiltros()">Quitar todos los filtros</button>
      } @else {
        <button (click)="continuar()">Saltar este paso · no descartar nada</button>
      }
    </div>
  `
})
export class FiltrarComponent {
  readonly estado = inject(EstadoService);
  readonly config = inject(ConfiguracionService);
  private readonly router = inject(Router);

  readonly municipiosDisponibles = computed(() => {
    const ya = new Set(this.config.municipiosExcluidos());
    return this.estado.municipiosDeConvocatoria().filter(m => !ya.has(m));
  });

  readonly centrosDisponibles = computed(() => {
    const ya = new Set(this.config.centrosExcluidos());
    return this.estado.centrosDeConvocatoria().filter(c => !ya.has(c.code));
  });

  readonly grupos = computed<GrupoCondiciones[]>(() => {
    const detectadas = this.estado.condicionesDetectadas();
    const grupo = (titulo: string, filtro: (c: DetectedCondition) => boolean): GrupoCondiciones => ({
      titulo,
      condiciones: detectadas.filter(filtro)
    });
    // Orden pedido: programas, idiomas, FP, condiciones, asignaturas.
    return [
      grupo('Programas', c => c.category === 'program'),
      grupo('Idiomas', c => c.category === 'language'),
      grupo('FP', c => c.category === 'fp'),
      grupo('Condiciones', c => !['asignatura', 'program', 'fp', 'language'].includes(c.category)),
      grupo('Asignaturas', c => c.category === 'asignatura')
    ].filter(g => g.condiciones.length > 0);
  });

  alternarCondicion(tag: string): void {
    this.config.acepta.set({ ...this.config.acepta(), [tag]: !this.config.acepta()[tag] });
  }

  editarTrayectoCondicion(tag: string, valor: number | null): void {
    this.config.trayectoCondicion.set({ ...this.config.trayectoCondicion(), [tag]: valor });
  }

  anadirMunicipio(municipio: string): void {
    if (!municipio || this.config.municipiosExcluidos().includes(municipio)) return;
    this.config.municipiosExcluidos.set(
      [...this.config.municipiosExcluidos(), municipio].sort((a, b) => a.localeCompare(b, 'es'))
    );
  }

  quitarMunicipio(municipio: string): void {
    this.config.municipiosExcluidos.set(
      this.config.municipiosExcluidos().filter(m => m !== municipio)
    );
  }

  /** Se guarda el código, no el nombre: es lo único que no cambia de escritura. */
  anadirCentro(code: string): void {
    if (!code || this.config.centrosExcluidos().includes(code)) return;
    this.config.centrosExcluidos.set([...this.config.centrosExcluidos(), code]);
  }

  quitarCentro(code: string): void {
    this.config.centrosExcluidos.set(this.config.centrosExcluidos().filter(c => c !== code));
  }

  nombreCentro(code: string): string {
    return this.estado.centrosDeConvocatoria().find(c => c.code === code)?.name ?? code;
  }

  /** Sin voluntarias, o con localidades o centros fuera: hay algo que descarta. */
  hayFiltros(): boolean {
    return (
      !this.config.voluntarias() ||
      this.config.municipiosExcluidos().length > 0 ||
      this.config.centrosExcluidos().length > 0
    );
  }

  quitarFiltros(): void {
    this.config.voluntarias.set(true);
    this.config.municipiosExcluidos.set([]);
    this.config.centrosExcluidos.set([]);
  }

  continuar(): void {
    this.router.navigate(['/ordenar']);
  }
}
