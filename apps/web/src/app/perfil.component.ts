import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import type { DetectedCondition } from '@plazainterinos/core';
import { EstadoService, Geocodificado } from './estado.service';

type Modo = 'minutes' | 'km';

/** "De A a B de trayecto me compensa una jornada de entre C% y D%." */
interface Banda {
  desde: number;
  hasta: number;
  minJornada: number;
  maxJornada: number;
}

interface GrupoCondiciones {
  titulo: string;
  condiciones: DetectedCondition[];
}

/** Códigos de idioma reales (excluye el "bilingüe sin especificar"). */
const IDIOMAS = new Set(['en', 'fr', 'ca']);

/** Tope de cada escala: 2 h de coche, 200 km. */
const ESCALA: Record<Modo, number> = { minutes: 120, km: 200 };

@Component({
  selector: 'tp-perfil',
  standalone: true,
  imports: [FormsModule],
  template: `
    <h1>Tu perfil</h1>
    <p class="lead">Con esto ordenamos y filtramos. Nada se envía a la administración: solo se usa para tu lista.</p>

    <!-- ── 1 · Especialidades ─────────────────────────────────────────── -->
    <div class="card">
      <h2>Tus especialidades</h2>
      @if (estado.especialidadesUsuario().length) {
        @for (e of estado.especialidadesUsuario(); track e.bodyCode + e.specialtyCode) {
          <span class="check">
            <input type="checkbox"
              [checked]="incluidas().has(clave(e.bodyCode, e.specialtyCode))"
              (change)="alternarEspecialidad(e.bodyCode, e.specialtyCode)" />
            {{ e.bodyCode }} · {{ e.bodyName }} — {{ e.specialtyCode }} {{ e.specialtyName }}
            @if (e.orden != null) { <span class="badge">(tu orden: {{ e.orden }})</span> }
          </span>
        }
      } @else {
        <p class="fuente">Sin especialidades todavía: impórtalas en el paso 1 (candidatos o a mano).</p>
      }
    </div>

    <div class="card dosCol">
      <div>
        <!-- ── 2 · Vivienda ───────────────────────────────────────────── -->
        <h2>Tu vivienda actual</h2>
        <label>Dirección (calle y municipio, o solo el municipio)</label>
        <input type="text" [(ngModel)]="direccion" placeholder="Calle Mayor 1, Zaragoza"
               (blur)="comprobarDireccion()" />
        <div class="fila-botones" style="justify-content:flex-start; margin:8px 0;">
          <button type="button" class="secundario" (click)="comprobarDireccion()"
                  [disabled]="!direccion.trim() || comprobandoDireccion()">
            @if (comprobandoDireccion()) { <span class="spinner"></span> }
            Comprobar
          </button>
        </div>
        @if (ubicacion(); as u) {
          <p class="fuente">✓ Usaremos esta ubicación para calcular distancias:<br />{{ u.displayName }}</p>
        } @else if (errorDireccion()) {
          <p class="error">{{ errorDireccion() }}</p>
        }

        <!-- ── 3 · Trayecto ───────────────────────────────────────────── -->
        <h2>Trayecto</h2>
        <div class="tabs" role="tablist" aria-label="Unidad del trayecto">
          <button type="button" role="tab" [attr.aria-selected]="modo() === 'minutes'"
                  [class.activa]="modo() === 'minutes'" (click)="modo.set('minutes')">
            Por tiempo (min)
          </button>
          <button type="button" role="tab" [attr.aria-selected]="modo() === 'km'"
                  [class.activa]="modo() === 'km'" (click)="modo.set('km')">
            Por distancia (km)
          </button>
        </div>

        <label>Máximo general ({{ unidad() }})</label>
        <input type="number" [ngModel]="maxActual()" (ngModelChange)="fijarMax($event)"
               [placeholder]="modo() === 'km' ? '60' : '45'" min="0" />

        @if (modo() === 'km') {
          <div style="margin-top:8px;">
            <button type="button" class="secundario" (click)="abrirCoche()">
              🚗 Datos de tu coche
              @if (coche()) { <span>· configurado</span> }
            </button>
            @if (coche(); as c) {
              <p class="fuente">{{ c.fuelType === 'diesel' ? 'Diésel' : 'Gasolina' }},
                {{ c.consumo }} l/100 km · ≈ {{ costePor100() }} € por cada 100 km.</p>
            }
          </div>
        }

        <!-- ── 4 · Trayecto según jornada ─────────────────────────────── -->
        <h3>Qué jornada te compensa según el trayecto</h3>
        <p class="fuente">
          Es la distancia la que decide: cuanto más lejos queda el centro, más jornada necesitas
          para que salga a cuenta. Cada banda cubre un tramo de trayecto y la jornada que aceptas en él.
          @if (modo() === 'km') { El coste es de ida y vuelta con los datos de tu coche. }
        </p>

        <div class="bandas">
          @for (b of bandas(); track $index; let i = $index) {
            <div class="banda">
              <div class="banda-cab">
                <strong>{{ b.desde }}–{{ b.hasta }} {{ unidad() }}</strong>
                <span class="badge">jornada {{ b.minJornada }}–{{ b.maxJornada }} %</span>
                <button type="button" class="secundario" (click)="quitarBanda(i)"
                        [attr.aria-label]="'Quitar la banda de ' + b.desde + ' a ' + b.hasta">✕</button>
              </div>

              <label [attr.for]="'desde-' + i">Trayecto ({{ unidad() }})</label>
              <div class="rango-doble">
                <div class="pista"></div>
                <div class="activo"
                     [style.left.%]="pct(b.desde, escala())"
                     [style.width.%]="pct(b.hasta - b.desde, escala())"></div>
                <input [id]="'desde-' + i" type="range" min="0" [max]="escala()" step="5"
                       [ngModel]="b.desde" (ngModelChange)="editar(i, 'desde', $event)"
                       [attr.aria-label]="'Trayecto mínimo, banda ' + (i + 1)" />
                <input type="range" min="0" [max]="escala()" step="5"
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

              @if (modo() === 'km') {
                @if (coche()) {
                  <div class="costes">
                    <div>
                      <span class="l">{{ b.desde }} km</span>
                      <span class="n">{{ coste(b.desde) }} €</span>
                    </div>
                    <div>
                      <span class="l">{{ medio(b) }} km · medio</span>
                      <span class="n">{{ coste(medio(b)) }} €</span>
                    </div>
                    <div>
                      <span class="l">{{ b.hasta }} km</span>
                      <span class="n">{{ coste(b.hasta) }} €</span>
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

      <div>
        <!-- ── 5 · Condiciones ────────────────────────────────────────── -->
        <h2>Condiciones de las vacantes</h2>
        <p class="fuente">
          Las <strong>plazas obligatorias</strong> no se filtran: sus condiciones no descartan nada,
          solo pesan en el orden de tu lista. Lo único que puedes filtrar son las
          <strong>plazas voluntarias</strong>, así que empieza por decidir si las quieres.
        </p>

        <span class="check">
          <input type="checkbox" [ngModel]="voluntarias()" (ngModelChange)="voluntarias.set($event)" />
          Quiero que entren plazas voluntarias
        </span>

        @if (voluntarias()) {
          @if (grupos().length === 0) {
            <p class="fuente">Importa una convocatoria en el paso 1 para ver aquí sus condiciones reales
              (programas, idiomas, FP…).</p>
          } @else {
            <p class="fuente">Detectadas en la información adicional de tus vacantes voluntarias.
              Marca las que aceptas; lo que dejes sin marcar se excluye. Puedes darle un trayecto
              máximo propio a cada una.</p>
            @for (grupo of grupos(); track grupo.titulo) {
              <label>{{ grupo.titulo }}</label>
              @for (c of grupo.condiciones; track c.tag) {
                <div class="condicion">
                  <span class="check" style="margin:0;">
                    <input type="checkbox" [checked]="acepta()[c.tag] === true" (change)="alternarCondicion(c.tag)" />
                    {{ c.label }}
                  </span>
                  <span class="badge">{{ c.count }} vacante{{ c.count === 1 ? '' : 's' }}</span>
                  @if (acepta()[c.tag]) {
                    <input type="number" [ngModel]="trayectoCondicion()[c.tag]"
                           (ngModelChange)="editarTrayectoCondicion(c.tag, $event)"
                           placeholder="máx {{ unidad() }}" min="0" title="Trayecto máximo solo para esta condición" />
                  }
                </div>
              }
            }
          }
        } @else {
          <p class="fuente">Sin plazas voluntarias no hay nada que filtrar: tu lista tendrá
            solo las obligatorias.</p>
        }

        <!-- ── 6 · Localidades excluidas ──────────────────────────────── -->
        <h2>Localidades excluidas</h2>
        @if (municipiosDisponibles().length || excluidas().length) {
          <p class="fuente">Ninguna vacante de estas localidades entrará en tu lista.</p>
          <select [ngModel]="''" (ngModelChange)="anadirExcluida($event)"
                  aria-label="Añadir localidad a excluir">
            <option value="">Añadir una localidad…</option>
            @for (m of municipiosDisponibles(); track m) {
              <option [value]="m">{{ m }}</option>
            }
          </select>
          @if (excluidas().length) {
            <div class="chips">
              @for (m of excluidas(); track m) {
                <span class="chip neutro">
                  {{ m }}
                  <button type="button" class="quitar" (click)="quitarExcluida(m)"
                          [attr.aria-label]="'Dejar de excluir ' + m">✕</button>
                </span>
              }
            </div>
          }
        } @else {
          <p class="fuente">Importa una convocatoria en el paso 1 para elegir localidades.</p>
        }
      </div>
    </div>

    <button (click)="guardar()" [disabled]="guardando()">
      @if (guardando()) { <span class="spinner"></span> Calculando… }
      @else { Guardar y ver mi lista }
    </button>
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
  private readonly router = inject(Router);
  private readonly dlgCoche = viewChild.required<ElementRef<HTMLDialogElement>>('dlgCoche');

  readonly guardando = signal(false);
  readonly comprobandoDireccion = signal(false);
  readonly ubicacion = signal<Geocodificado | null>(null);
  readonly errorDireccion = signal('');
  readonly precios = signal<{ diesel: number; gasolina: number; fallback: boolean } | null>(null);
  readonly coche = signal<{ fuelType: 'diesel' | 'gasolina'; consumo: number; precio: number; precioOficial: number | null } | null>(null);

  /** Especialidades marcadas (por defecto, todas). */
  readonly incluidas = signal<Set<string>>(new Set());
  readonly acepta = signal<Record<string, boolean>>({});
  readonly trayectoCondicion = signal<Record<string, number | null>>({});

  readonly modo = signal<Modo>('minutes');
  readonly voluntarias = signal(true);
  readonly excluidas = signal<string[]>([]);

  /** Cada unidad guarda sus propias bandas: 30 min no es lo mismo que 30 km. */
  private readonly bandasPorModo = signal<Record<Modo, Banda[]>>({
    minutes: [
      { desde: 0, hasta: 20, minJornada: 0, maxJornada: 100 },
      { desde: 20, hasta: 45, minJornada: 50, maxJornada: 100 }
    ],
    km: [
      { desde: 0, hasta: 25, minJornada: 0, maxJornada: 100 },
      { desde: 25, hasta: 60, minJornada: 50, maxJornada: 100 }
    ]
  });
  private readonly maxPorModo = signal<Record<Modo, number | null>>({ minutes: 45, km: 60 });

  readonly bandas = computed(() => this.bandasPorModo()[this.modo()]);
  readonly escala = computed(() => ESCALA[this.modo()]);
  readonly maxActual = computed(() => this.maxPorModo()[this.modo()]);
  readonly unidad = computed(() => (this.modo() === 'km' ? 'km' : 'min'));

  readonly municipiosDisponibles = computed(() => {
    const ya = new Set(this.excluidas());
    const todos = new Set<string>();
    for (const v of this.estado.vacantesParseadas()) {
      const m = (v as { municipality?: string }).municipality;
      if (m && !ya.has(m)) todos.add(m);
    }
    return [...todos].sort((a, b) => a.localeCompare(b, 'es'));
  });

  direccion = '';
  fuelType: 'diesel' | 'gasolina' = 'diesel';
  consumo: number | null = null;
  precio: number | null = null;

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

  constructor() {
    // Todas las especialidades del aspirante entran marcadas por defecto.
    this.incluidas.set(
      new Set(this.estado.especialidadesUsuario().map(e => this.clave(e.bodyCode, e.specialtyCode)))
    );
  }

  clave(cuerpo: string, especialidad: string): string {
    return `${cuerpo}-${especialidad}`;
  }

  pct(valor: number, sobre: number): number {
    return Math.max(0, Math.min(100, (valor / sobre) * 100));
  }

  medio(b: Banda): number {
    return Math.round((b.desde + b.hasta) / 2);
  }

  /** Coste diario ida y vuelta, misma fórmula que `dailyTravelCostEur` del core. */
  coste(km: number): string {
    const c = this.coche();
    if (!c) return '—';
    return (Math.round(km * 2 * (c.consumo / 100) * c.precio * 100) / 100).toFixed(2);
  }

  fijarMax(valor: number | null): void {
    this.maxPorModo.set({ ...this.maxPorModo(), [this.modo()]: valor });
  }

  /** Edita una banda manteniendo siempre desde ≤ hasta y min ≤ max. */
  editar(i: number, campo: keyof Banda, valor: number): void {
    const n = +valor;
    const lista = this.bandas().map((b, idx) => {
      if (idx !== i) return b;
      const s = { ...b, [campo]: n };
      if (campo === 'desde') s.hasta = Math.max(s.hasta, n);
      if (campo === 'hasta') s.desde = Math.min(s.desde, n);
      if (campo === 'minJornada') s.maxJornada = Math.max(s.maxJornada, n);
      if (campo === 'maxJornada') s.minJornada = Math.min(s.minJornada, n);
      return s;
    });
    this.bandasPorModo.set({ ...this.bandasPorModo(), [this.modo()]: lista });
  }

  anadirBanda(): void {
    const previas = this.bandas();
    const desde = previas.length ? previas[previas.length - 1].hasta : 0;
    const hasta = Math.min(desde + (this.modo() === 'km' ? 40 : 25), this.escala());
    const nueva: Banda = { desde, hasta, minJornada: 75, maxJornada: 100 };
    this.bandasPorModo.set({ ...this.bandasPorModo(), [this.modo()]: [...previas, nueva] });
  }

  quitarBanda(i: number): void {
    const lista = this.bandas().filter((_, idx) => idx !== i);
    this.bandasPorModo.set({ ...this.bandasPorModo(), [this.modo()]: lista });
  }

  anadirExcluida(municipio: string): void {
    if (!municipio || this.excluidas().includes(municipio)) return;
    this.excluidas.set([...this.excluidas(), municipio].sort((a, b) => a.localeCompare(b, 'es')));
  }

  quitarExcluida(municipio: string): void {
    this.excluidas.set(this.excluidas().filter(m => m !== municipio));
  }

  alternarEspecialidad(cuerpo: string, especialidad: string): void {
    const nuevas = new Set(this.incluidas());
    const clave = this.clave(cuerpo, especialidad);
    nuevas.has(clave) ? nuevas.delete(clave) : nuevas.add(clave);
    this.incluidas.set(nuevas);
  }

  alternarCondicion(tag: string): void {
    this.acepta.set({ ...this.acepta(), [tag]: !this.acepta()[tag] });
  }

  editarTrayectoCondicion(tag: string, valor: number | null): void {
    this.trayectoCondicion.set({ ...this.trayectoCondicion(), [tag]: valor });
  }

  async comprobarDireccion(): Promise<void> {
    const q = this.direccion.trim();
    if (!q || this.comprobandoDireccion()) return;
    this.comprobandoDireccion.set(true);
    this.errorDireccion.set('');
    try {
      this.ubicacion.set(await this.estado.geocodificar(q));
    } catch (error) {
      this.ubicacion.set(null);
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
    const actual = this.coche();
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
      this.coche.set({
        fuelType: this.fuelType,
        consumo: +this.consumo,
        precio: +this.precio,
        precioOficial: oficial
      });
    }
    this.dlgCoche().nativeElement.close();
  }

  costePor100(): string {
    const c = this.coche();
    if (!c) return '';
    return (c.consumo * c.precio).toFixed(2);
  }

  costePreview(): string {
    return ((this.consumo ?? 0) * (this.precio ?? 0)).toFixed(2);
  }

  async guardar(): Promise<void> {
    const detectadas = this.estado.condicionesDetectadas();
    const acepta = this.acepta();
    const modo = this.modo();

    // Sin plazas voluntarias no queda nada que filtrar: solo entran obligatorias,
    // y sus condiciones no descartan (las acepta todas el core).
    const conditionAccepts: Record<string, boolean> = {};
    for (const c of detectadas) {
      conditionAccepts[c.tag] = this.voluntarias() ? acepta[c.tag] === true : true;
    }

    const limite = (n: number): { maxMinutes?: number; maxKm?: number } =>
      modo === 'km' ? { maxKm: n } : { maxMinutes: n };

    const conditionTravelLimits: Record<string, { maxMinutes?: number; maxKm?: number }> = {};
    for (const [tag, n] of Object.entries(this.trayectoCondicion())) {
      if (conditionAccepts[tag] && n != null && n > 0) conditionTravelLimits[tag] = limite(+n);
    }

    const travelWorkloadBands = this.bandas()
      .filter(b => b.hasta > b.desde)
      .map(b => ({
        fromTravel: b.desde,
        toTravel: b.hasta,
        minWorkload: b.minJornada / 100,
        maxWorkload: b.maxJornada / 100
      }));

    // Campos legados derivados de las decisiones dinámicas (reglas existentes).
    const acceptedLanguages = detectadas
      .filter(c => c.category === 'language' && IDIOMAS.has(c.tag) && conditionAccepts[c.tag])
      .map(c => c.tag);
    const excludedPrograms = detectadas
      .filter(c => c.category === 'program' && !conditionAccepts[c.tag])
      .map(c => c.tag);

    const especialidades = this.estado
      .especialidadesUsuario()
      .filter(e => this.incluidas().has(this.clave(e.bodyCode, e.specialtyCode)))
      .map(e => ({ bodyCode: e.bodyCode, specialtyCode: e.specialtyCode, blockOrder: e.orden }));

    if (!especialidades.length) {
      this.estado.error.set('Marca al menos una especialidad.');
      return;
    }

    const maximo = this.maxActual();
    const coche = this.coche();
    const perfil = {
      id: 'perfil-local',
      name: 'Mi perfil',
      homeLocation: {
        address: this.direccion || undefined,
        latitude: this.ubicacion()?.lat,
        longitude: this.ubicacion()?.lng
      },
      specialties: especialidades,
      travelMode: modo,
      maxDistanceKm: modo === 'km' ? maximo ?? undefined : undefined,
      maxTravelMinutes: modo === 'minutes' ? maximo ?? undefined : undefined,
      // Las bandas sustituyen a los tramos: la distancia decide la jornada.
      workloadTravelTiers: [],
      travelWorkloadBands,
      conditionAccepts,
      conditionTravelLimits,
      car: coche
        ? {
            fuelType: coche.fuelType,
            consumptionLper100: coche.consumo,
            // Solo fijamos el precio si el usuario cambió el oficial del día.
            fuelPricePerLiter: coche.precio !== coche.precioOficial ? coche.precio : undefined
          }
        : undefined,
      // La jornada ya no tiene un mínimo global: siempre depende del trayecto.
      acceptsPartialWorkload: true,
      minimumWorkload: undefined,
      acceptsVoluntary: this.voluntarias(),
      acceptsAfternoon: conditionAccepts['afternoon'] ?? false,
      acceptsItinerant: conditionAccepts['itinerant'] ?? false,
      acceptsBilingual: acceptedLanguages.length > 0,
      acceptsLongTerm: conditionAccepts['long_term'] ?? true,
      acceptedLanguages,
      excludedPrograms,
      excludedTags: [],
      preferredMunicipalities: [],
      excludedMunicipalities: this.excluidas(),
      preferredCenters: [],
      excludedCenters: []
    };

    this.guardando.set(true);
    try {
      await this.estado.guardarPerfil(perfil);
      await this.estado.evaluar();
      await this.router.navigate(['/resultado']);
    } catch (error) {
      this.estado.error.set(String(error instanceof Error ? error.message : error));
    } finally {
      this.guardando.set(false);
    }
  }
}
