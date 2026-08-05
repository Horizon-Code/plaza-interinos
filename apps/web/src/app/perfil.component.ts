import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { claveEspecialidad } from '@plazainterinos/core';
import { ConfiguracionService, type Banda } from './configuracion.service';
import { EstadoService } from './estado.service';

/**
 * Paso 2 · Perfil. Solo captura datos: quién eres, dónde vives y hasta dónde
 * estás dispuesto a moverte.
 *
 * No filtra ni ordena (punto 3): eso son los pasos 3 y 4. Aquí ya no hay
 * localidades excluidas ni condiciones de vacantes.
 */
@Component({
  selector: 'tp-perfil',
  standalone: true,
  imports: [FormsModule],
  template: `
    <h1>Tu perfil</h1>
    <p class="lead">
      Quién eres y hasta dónde te mueves. Con esto se calculan distancias y costes.
      Nada se envía a la administración: solo se usa para construir tu lista.
    </p>

    <!-- ── 1 · Especialidades ─────────────────────────────────────────── -->
    <div class="card">
      <h2>Tus especialidades</h2>
      @if (estado.especialidadesUsuario().length) {
        @for (e of estado.especialidadesUsuario(); track e.bodyCode + e.specialtyCode) {
          <span class="check">
            <input type="checkbox"
              [checked]="incluida(e.bodyCode, e.specialtyCode)"
              (change)="alternarEspecialidad(e.bodyCode, e.specialtyCode)" />
            {{ e.bodyCode }} · {{ e.bodyName }} — {{ e.specialtyCode }} {{ e.specialtyName }}
            @if (e.orden != null) { <span class="badge">(tu orden: {{ e.orden }})</span> }
          </span>
        }
      } @else {
        <p class="fuente">Sin especialidades todavía: impórtalas en el paso 1 (candidatos o a mano).</p>
      }
    </div>

    <div class="card">
      <!-- ── 2 · Vivienda ─────────────────────────────────────────────── -->
      <h2>Tu vivienda actual</h2>
      <label>Dirección (calle y municipio, o solo el municipio)</label>
      <input type="text" [ngModel]="config.direccion()" (ngModelChange)="config.direccion.set($event)"
             placeholder="Calle Mayor 1, Zaragoza" (blur)="comprobarDireccion()" />
      <div class="fila-botones" style="justify-content:flex-start; margin:8px 0;">
        <button type="button" class="secundario" (click)="comprobarDireccion()"
                [disabled]="!config.direccion().trim() || comprobandoDireccion()">
          @if (comprobandoDireccion()) { <span class="spinner"></span> }
          Comprobar
        </button>
      </div>
      @if (config.ubicacion(); as u) {
        <p class="fuente">✓ Usaremos esta ubicación para calcular distancias:<br />{{ u.displayName }}</p>
      } @else if (errorDireccion()) {
        <p class="error">{{ errorDireccion() }}</p>
      }

      <!-- ── 3 · Trayecto ─────────────────────────────────────────────── -->
      <h2>Trayecto</h2>
      <div class="tabs" role="tablist" aria-label="Unidad del trayecto">
        <button type="button" role="tab" [attr.aria-selected]="config.modo() === 'minutes'"
                [class.activa]="config.modo() === 'minutes'" (click)="config.modo.set('minutes')">
          Por tiempo (min)
        </button>
        <button type="button" role="tab" [attr.aria-selected]="config.modo() === 'km'"
                [class.activa]="config.modo() === 'km'" (click)="config.modo.set('km')">
          Por distancia (km)
        </button>
      </div>

      <label>Máximo general ({{ config.unidad() }})</label>
      <input type="number" [ngModel]="config.maxActual()" (ngModelChange)="fijarMax($event)"
             [placeholder]="config.modo() === 'km' ? '60' : '45'" min="0" />

      @if (config.modo() === 'km') {
        <div style="margin-top:8px;">
          <button type="button" class="secundario" (click)="abrirCoche()">
            🚗 Datos de tu coche
            @if (config.coche()) { <span>· configurado</span> }
          </button>
          @if (config.coche(); as c) {
            <p class="fuente">{{ c.fuelType === 'diesel' ? 'Diésel' : 'Gasolina' }},
              {{ c.consumo }} l/100 km · ≈ {{ costePor100() }} € por cada 100 km.</p>
          }
        </div>
      }

      <!-- ── 4 · Trayecto según jornada ───────────────────────────────── -->
      <h3>Qué jornada te compensa según el trayecto</h3>
      <p class="fuente">
        Es la distancia la que decide: cuanto más lejos queda el centro, más jornada necesitas
        para que salga a cuenta. Cada banda cubre un tramo de trayecto y la jornada que aceptas en él.
        @if (config.modo() === 'km') { El coste es de ida y vuelta con los datos de tu coche. }
      </p>

      <div class="bandas">
        @for (b of config.bandas(); track $index; let i = $index) {
          <div class="banda">
            <div class="banda-cab">
              <strong>{{ b.desde }}–{{ b.hasta }} {{ config.unidad() }}</strong>
              <span class="badge">jornada {{ b.minJornada }}–{{ b.maxJornada }} %</span>
              <button type="button" class="secundario" (click)="quitarBanda(i)"
                      [attr.aria-label]="'Quitar la banda de ' + b.desde + ' a ' + b.hasta">✕</button>
            </div>

            <label [attr.for]="'desde-' + i">Trayecto ({{ config.unidad() }})</label>
            <div class="rango-doble">
              <div class="pista"></div>
              <div class="activo"
                   [style.left.%]="pct(b.desde, config.escala())"
                   [style.width.%]="pct(b.hasta - b.desde, config.escala())"></div>
              <input [id]="'desde-' + i" type="range" min="0" [max]="config.escala()" step="5"
                     [ngModel]="b.desde" (ngModelChange)="editar(i, 'desde', $event)"
                     [attr.aria-label]="'Trayecto mínimo, banda ' + (i + 1)" />
              <input type="range" min="0" [max]="config.escala()" step="5"
                     [ngModel]="b.hasta" (ngModelChange)="editar(i, 'hasta', $event)"
                     [attr.aria-label]="'Trayecto máximo, banda ' + (i + 1)" />
            </div>

            <label>Jornada que aceptas en ese tramo (%)</label>
            <div class="rango-doble">
              <div class="pista"></div>
              <div class="activo"
                   [style.left.%]="pct(b.minJornada, 100)"
                   [style.width.%]="pct(b.maxJornada - b.minJornada, 100)"></div>
              <input type="range" min="0" max="100" step="5"
                     [ngModel]="b.minJornada" (ngModelChange)="editar(i, 'minJornada', $event)"
                     [attr.aria-label]="'Jornada mínima, banda ' + (i + 1)" />
              <input type="range" min="0" max="100" step="5"
                     [ngModel]="b.maxJornada" (ngModelChange)="editar(i, 'maxJornada', $event)"
                     [attr.aria-label]="'Jornada máxima, banda ' + (i + 1)" />
            </div>

            @if (config.modo() === 'km') {
              @if (config.coche()) {
                <div class="costes">
                  <div>
                    <span class="l">{{ b.desde }} km</span>
                    <span class="n">{{ config.costeDiario(b.desde) }} €</span>
                  </div>
                  <div>
                    <span class="l">{{ medio(b) }} km · medio</span>
                    <span class="n">{{ config.costeDiario(medio(b)) }} €</span>
                  </div>
                  <div>
                    <span class="l">{{ b.hasta }} km</span>
                    <span class="n">{{ config.costeDiario(b.hasta) }} €</span>
                  </div>
                </div>
              } @else {
                <p class="fuente">Añade los datos de tu coche para ver aquí el coste diario.</p>
              }
            }
          </div>
        }
        <button type="button" class="secundario" (click)="anadirBanda()">+ Añadir banda</button>
      </div>
    </div>

    <div class="fila-botones" style="justify-content:flex-start;">
      <button (click)="continuar()">Continuar a los filtros</button>
    </div>
    @if (estado.error()) { <p class="error">{{ estado.error() }}</p> }

    <!-- ── Modal del coche ───────────────────────────────────────────── -->
    <dialog #dlgCoche class="card">
      <h2>Datos de tu coche</h2>
      <label>Combustible</label>
      <span class="check"><input type="radio" name="fuel" value="diesel" [(ngModel)]="fuelType" /> Diésel</span>
      <span class="check"><input type="radio" name="fuel" value="gasolina" [(ngModel)]="fuelType" /> Gasolina</span>
      <label>Consumo (litros / 100 km)</label>
      <input type="number" [(ngModel)]="consumo" step="0.1" min="1" placeholder="6.0" />
      <label>Precio del combustible (€/litro)</label>
      <input type="number" [(ngModel)]="precio" step="0.001" min="0.5" />
      @if (precios(); as p) {
        <p class="fuente">
          Precio medio hoy en Aragón: diésel {{ p.diesel }} €/l · gasolina {{ p.gasolina }} €/l
          @if (p.fallback) { (aproximado: la fuente oficial no responde) }
          — puedes ajustarlo.
        </p>
      }
      @if (consumo && precio) {
        <p><strong>≈ {{ costePreview() }} €</strong> por cada 100 km.</p>
      }
      <div class="fila-botones" style="justify-content:flex-end;">
        <button type="button" class="secundario" (click)="cerrarCoche(false)">Cancelar</button>
        <button type="button" (click)="cerrarCoche(true)" [disabled]="!consumo || !precio">Guardar coche</button>
      </div>
    </dialog>
  `
})
export class PerfilComponent {
  readonly estado = inject(EstadoService);
  readonly config = inject(ConfiguracionService);
  private readonly router = inject(Router);
  private readonly dlgCoche = viewChild.required<ElementRef<HTMLDialogElement>>('dlgCoche');

  readonly comprobandoDireccion = signal(false);
  readonly errorDireccion = signal('');
  readonly precios = signal<{ diesel: number; gasolina: number; fallback: boolean } | null>(null);

  fuelType: 'diesel' | 'gasolina' = 'diesel';
  consumo: number | null = null;
  precio: number | null = null;

  constructor() {
    // Primera visita: todas las especialidades del aspirante entran marcadas.
    if (!this.config.especialidadesIncluidas().length) {
      this.config.especialidadesIncluidas.set(
        this.estado.especialidadesUsuario().map(e => claveEspecialidad(e.bodyCode, e.specialtyCode))
      );
    }
  }

  incluida(cuerpo: string, especialidad: string): boolean {
    return this.config.especialidadesIncluidas().includes(claveEspecialidad(cuerpo, especialidad));
  }

  alternarEspecialidad(cuerpo: string, especialidad: string): void {
    const clave = claveEspecialidad(cuerpo, especialidad);
    const actuales = this.config.especialidadesIncluidas();
    this.config.especialidadesIncluidas.set(
      actuales.includes(clave) ? actuales.filter(c => c !== clave) : [...actuales, clave]
    );
  }

  pct(valor: number, sobre: number): number {
    return Math.max(0, Math.min(100, (valor / sobre) * 100));
  }

  medio(b: Banda): number {
    return Math.round((b.desde + b.hasta) / 2);
  }

  fijarMax(valor: number | null): void {
    this.config.maxPorModo.set({ ...this.config.maxPorModo(), [this.config.modo()]: valor });
  }

  /** Edita una banda manteniendo siempre desde ≤ hasta y min ≤ max. */
  editar(i: number, campo: keyof Banda, valor: number): void {
    const n = +valor;
    const lista = this.config.bandas().map((b, idx) => {
      if (idx !== i) return b;
      const s = { ...b, [campo]: n };
      if (campo === 'desde') s.hasta = Math.max(s.hasta, n);
      if (campo === 'hasta') s.desde = Math.min(s.desde, n);
      if (campo === 'minJornada') s.maxJornada = Math.max(s.maxJornada, n);
      if (campo === 'maxJornada') s.minJornada = Math.min(s.minJornada, n);
      return s;
    });
    this.guardarBandas(lista);
  }

  anadirBanda(): void {
    const previas = this.config.bandas();
    const desde = previas.length ? previas[previas.length - 1].hasta : 0;
    const hasta = Math.min(desde + (this.config.modo() === 'km' ? 40 : 25), this.config.escala());
    this.guardarBandas([...previas, { desde, hasta, minJornada: 75, maxJornada: 100 }]);
  }

  quitarBanda(i: number): void {
    this.guardarBandas(this.config.bandas().filter((_, idx) => idx !== i));
  }

  private guardarBandas(lista: Banda[]): void {
    this.config.bandasPorModo.set({ ...this.config.bandasPorModo(), [this.config.modo()]: lista });
  }

  async comprobarDireccion(): Promise<void> {
    const q = this.config.direccion().trim();
    if (!q || this.comprobandoDireccion()) return;
    this.comprobandoDireccion.set(true);
    this.errorDireccion.set('');
    try {
      this.config.ubicacion.set(await this.estado.geocodificar(q));
    } catch (error) {
      this.config.ubicacion.set(null);
      this.errorDireccion.set(String(error instanceof Error ? error.message : error));
    } finally {
      this.comprobandoDireccion.set(false);
    }
  }

  async abrirCoche(): Promise<void> {
    if (!this.precios()) {
      try {
        this.precios.set(await this.estado.preciosCombustible());
      } catch {
        this.precios.set(null);
      }
    }
    const actual = this.config.coche();
    if (actual) {
      this.fuelType = actual.fuelType;
      this.consumo = actual.consumo;
      this.precio = actual.precio;
    } else if (this.precios()) {
      this.precio = this.fuelType === 'diesel' ? this.precios()!.diesel : this.precios()!.gasolina;
    }
    this.dlgCoche().nativeElement.showModal();
  }

  cerrarCoche(guardar: boolean): void {
    if (guardar && this.consumo && this.precio) {
      const oficial = this.precios()
        ? this.fuelType === 'diesel'
          ? this.precios()!.diesel
          : this.precios()!.gasolina
        : null;
      this.config.coche.set({
        fuelType: this.fuelType,
        consumo: +this.consumo,
        precio: +this.precio,
        precioOficial: oficial
      });
    }
    this.dlgCoche().nativeElement.close();
  }

  costePor100(): string {
    const c = this.config.coche();
    return c ? (c.consumo * c.precio).toFixed(2) : '';
  }

  costePreview(): string {
    return ((this.consumo ?? 0) * (this.precio ?? 0)).toFixed(2);
  }

  async continuar(): Promise<void> {
    if (!this.config.especialidadesIncluidas().length) {
      this.estado.error.set('Marca al menos una especialidad.');
      return;
    }
    this.estado.error.set('');
    await this.router.navigate(['/filtrar']);
  }
}
