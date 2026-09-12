import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CuentaComponent } from './cuenta.component';
import { Router } from '@angular/router';
import { claveEspecialidad, type CandidateMatch } from '@plazainterinos/core';
import { ConfiguracionService, type Banda } from './configuracion.service';
import { EstadoService } from './estado.service';

/** Palabras que en español no se capitalizan dentro de un nombre. */
const MENUDAS = new Set([
  'de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'en', 'a', 'al', 'o', 'u', 'con', 'para', 'por'
]);

/**
 * Paso 2 · Perfil. Solo captura datos: quién eres, dónde vives y hasta dónde
 * estás dispuesto a moverte.
 *
 * No filtra ni ordena (punto 3): eso son los pasos 3 y 4. Aquí ya no hay
 * localidades excluidas ni condiciones de vacantes.
 *
 * SCRUM-22: la pantalla se simplifica para el móvil. Las especialidades se ven
 * por su nombre ("Matematicas", "Informatica"), sin códigos ni número de orden;
 * la vivienda se comprueba con botón, con Enter o con el GPS del propio
 * navegador; y las bandas de jornada se rellenan con campos numéricos, porque
 * los sliders dobles eran imposibles de afinar con el dedo.
 */
@Component({
  selector: 'tp-perfil',
  standalone: true,
  imports: [FormsModule, CuentaComponent],
  template: `
    <h1>Tu perfil</h1>
    <p class="lead">
      Quién eres y hasta dónde te mueves. Con esto se calculan distancias y costes.
      Nada se envía a la administración: solo se usa para construir tu lista.
    </p>

    <!-- ── 1 · Especialidades ─────────────────────────────────────────── -->
    <div class="card" id="zona-especialidades" [class.resaltada]="resaltado() === 'zona-especialidades'">
      <h2>Tus especialidades</h2>
      @if (estado.especialidadesUsuario().length) {
        <p class="fuente">Toca una para dejarla fuera de esta selección.</p>
        <div class="especialidades">
          @for (e of estado.especialidadesUsuario(); track e.bodyCode + e.specialtyCode) {
            <button type="button" class="esp"
                    [class.activa]="incluida(e.bodyCode, e.specialtyCode)"
                    [attr.aria-pressed]="incluida(e.bodyCode, e.specialtyCode)"
                    [attr.title]="enBonito(e.bodyName)"
                    (click)="alternarEspecialidad(e.bodyCode, e.specialtyCode)">
              @if (incluida(e.bodyCode, e.specialtyCode)) { <span aria-hidden="true">✓</span> }
              {{ nombre(e) }}
            </button>
          }
        </div>
      } @else {
        <p class="fuente">Sin especialidades todavía: impórtalas en el paso 1 (candidatos o a mano).</p>
      }
    </div>

    <div class="card" id="zona-vivienda" [class.resaltada]="resaltado() === 'zona-vivienda'">
      <!-- ── 2 · Vivienda ─────────────────────────────────────────────── -->
      <h2>Tu vivienda habitual</h2>
      <label for="direccion">Dirección (calle y municipio, o solo el municipio)</label>
      <input id="direccion" type="text" autocomplete="street-address"
             [disabled]="localizando()"
             [ngModel]="config.direccion()" (ngModelChange)="escribirDireccion($event)"
             placeholder="Calle Mayor 1, Zaragoza"
             (keydown.enter)="comprobarDireccion()" />
      <div class="acciones-vivienda">
        <button type="button" class="secundario" (click)="comprobarDireccion()"
                [disabled]="!config.direccion().trim() || comprobandoDireccion() || localizando()">
          @if (comprobandoDireccion()) { <span class="spinner"></span> }
          Comprobar
        </button>
        <button type="button" class="secundario" (click)="usarUbicacionActual()"
                [disabled]="comprobandoDireccion() || localizando()">
          @if (localizando()) { <span class="spinner"></span> }
          Usar ubicación actual
        </button>
      </div>
      @if (config.ubicacion(); as u) {
        <p class="fuente">✓ Usaremos esta ubicación para calcular los trayectos:<br />{{ u.displayName }}</p>
      } @else if (errorDireccion()) {
        <p class="error">{{ errorDireccion() }}</p>
      } @else {
        <p class="fuente">Sin comprobar la dirección no se pueden calcular minutos ni kilómetros.</p>
      }
    </div>

    <!-- ── 3 · Trayecto y jornada ───────────────────────────────────────── -->
    <div class="card">
      <h2>Trayecto y jornada</h2>
      <p class="fuente">
        Trayectos de ida en coche desde tu vivienda hasta cada centro, por carretera.
        El tiempo es estimado, sin tráfico en tiempo real.
      </p>

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

      <label for="maximo">Máximo general ({{ config.unidad() }})</label>
      <div class="campo-unidad">
        <input id="maximo" type="number" inputmode="numeric"
               [ngModel]="config.maxActual()" (ngModelChange)="fijarMax($event)"
               [placeholder]="config.modo() === 'km' ? '60' : '45'" min="0" [max]="config.escala()" />
        <span class="unidad">{{ config.unidad() }}</span>
      </div>

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

            <div class="campos-banda">
              <div class="campo">
                <label [attr.for]="'desde-' + i">Desde ({{ config.unidad() }})</label>
                <input [id]="'desde-' + i" type="number" inputmode="numeric" min="0"
                       [max]="config.escala()" step="5"
                       [ngModel]="b.desde" (ngModelChange)="editar(i, 'desde', $event)"
                       (blur)="sincronizar($event, b.desde)" />
              </div>
              <div class="campo">
                <label [attr.for]="'hasta-' + i">Hasta ({{ config.unidad() }})</label>
                <input [id]="'hasta-' + i" type="number" inputmode="numeric" min="0"
                       [max]="config.escala()" step="5"
                       [ngModel]="b.hasta" (ngModelChange)="editar(i, 'hasta', $event)"
                       (blur)="sincronizar($event, b.hasta)" />
              </div>
              <div class="campo">
                <label [attr.for]="'jmin-' + i">Jornada mínima (%)</label>
                <input [id]="'jmin-' + i" type="number" inputmode="numeric" min="0" max="100" step="5"
                       [ngModel]="b.minJornada" (ngModelChange)="editar(i, 'minJornada', $event)"
                       (blur)="sincronizar($event, b.minJornada)" />
              </div>
              <div class="campo">
                <label [attr.for]="'jmax-' + i">Jornada máxima (%)</label>
                <input [id]="'jmax-' + i" type="number" inputmode="numeric" min="0" max="100" step="5"
                       [ngModel]="b.maxJornada" (ngModelChange)="editar(i, 'maxJornada', $event)"
                       (blur)="sincronizar($event, b.maxJornada)" />
              </div>
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
    @if (estado.error()) {
      @if (zonaDelError(); as zona) {
        <button type="button" class="error error-ir" (click)="irA(zona)">
          {{ estado.error() }} <span class="flecha" aria-hidden="true">↑</span>
          <span class="ir">Llévame ahí</span>
        </button>
      } @else {
        <p class="error">{{ estado.error() }}</p>
      }
    }

    <p class="borrar-perfil">
      <button type="button" class="secundario" (click)="borrarDatos()">Borrar datos del perfil</button>
      <span class="nota">Vacía dirección, especialidades marcadas y trayecto. No toca filtros ni orden.</span>
    </p>

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

    <tp-cuenta />
  `
})
export class PerfilComponent {
  readonly estado = inject(EstadoService);
  readonly config = inject(ConfiguracionService);
  private readonly router = inject(Router);
  private readonly dlgCoche = viewChild.required<ElementRef<HTMLDialogElement>>('dlgCoche');

  readonly comprobandoDireccion = signal(false);
  readonly localizando = signal(false);
  readonly resaltado = signal<string | null>(null);
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

  // ── Especialidades ──────────────────────────────────────────────────────
  /** Solo el nombre: ni código de cuerpo, ni de especialidad, ni número de orden. */
  nombre(e: CandidateMatch): string {
    return this.enBonito(e.specialtyName || e.bodyName || 'Especialidad');
  }

  /**
   * El catálogo oficial viene en mayúsculas ("MATEMATICAS"). Se pasa a
   * capitalización normal respetando preposiciones y siglas cortas. Las tildes
   * que no trae la fuente no se pueden inventar: "MATEMATICAS" queda
   * "Matematicas".
   */
  enBonito(texto: string): string {
    return texto
      .split(' ')
      .filter(t => t.length > 0)
      .map((token, i) => {
        const letras = token.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, '');
        const bajo = token.toLocaleLowerCase('es');
        // Siglas y abreviaturas cortas en mayúscula ("(LOE)", "FP") se respetan.
        if (letras.length > 0 && letras.length <= 3 && !MENUDAS.has(letras.toLocaleLowerCase('es'))) {
          if (token === token.toLocaleUpperCase('es')) return token;
        }
        if (i > 0 && MENUDAS.has(bajo)) return bajo;
        return bajo.replace(/[a-záéíóúüñ]/, c => c.toLocaleUpperCase('es'));
      })
      .join(' ');
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

  // ── Vivienda ────────────────────────────────────────────────────────────
  /**
   * Al reescribir la dirección se invalida la ubicación confirmada: mantener el
   * ✓ de una dirección anterior haría creer que los trayectos son de la nueva.
   */
  escribirDireccion(valor: string): void {
    this.config.direccion.set(valor);
    if (this.config.ubicacion()) this.config.ubicacion.set(null);
    this.errorDireccion.set('');
  }

  async comprobarDireccion(): Promise<void> {
    const q = this.config.direccion().trim();
    if (!q || this.comprobandoDireccion() || this.localizando()) return;
    this.comprobandoDireccion.set(true);
    this.errorDireccion.set('');
    try {
      const ubicacion = await this.estado.geocodificar(q);
      if (this.config.direccion().trim() === q) this.config.ubicacion.set(ubicacion);
    } catch (error) {
      if (this.config.direccion().trim() === q) {
        this.config.ubicacion.set(null);
        this.errorDireccion.set(String(error instanceof Error ? error.message : error));
      }
    } finally {
      this.comprobandoDireccion.set(false);
    }
  }

  /**
   * GPS del navegador. Permiso y error se tratan aquí, no se dejan colgando.
   *
   * Con vigilancia propia: si el usuario cierra el diálogo de permiso sin
   * contestar, el navegador no llama a NINGUNA de las dos devoluciones y su
   * `timeout` tampoco salta. Sin este temporizador `localizando` se quedaba en
   * `true` y el botón se deshabilitaba para siempre.
   */
  async usarUbicacionActual(): Promise<void> {
    if (this.localizando()) return;
    if (!('geolocation' in navigator)) {
      this.errorDireccion.set('Este navegador no puede darnos tu ubicación. Escribe la dirección a mano.');
      return;
    }

    // Si el permiso está bloqueado, pedirlo otra vez falla en silencio: más vale
    // decirlo que dejar al usuario pulsando un botón que nunca hará nada.
    if (await this.permisoBloqueado()) {
      this.errorDireccion.set(
        'Tu navegador tiene bloqueada la ubicación para esta página. Ábrelo en el candado de la barra de direcciones y permítela, o escribe la dirección a mano.'
      );
      return;
    }

    this.localizando.set(true);
    this.errorDireccion.set('');

    let resuelto = false;
    const rendirse = window.setTimeout(() => {
      if (resuelto) return;
      resuelto = true;
      this.localizando.set(false);
      this.errorDireccion.set('No hemos recibido respuesta a la petición de ubicación. Vuelve a intentarlo o escribe la dirección.');
    }, 20_000);

    const terminar = () => {
      if (resuelto) return true;
      resuelto = true;
      window.clearTimeout(rendirse);
      return false;
    };

    navigator.geolocation.getCurrentPosition(
      posicion => {
        if (terminar()) return;
        void this.resolverPosicion(posicion);
      },
      error => {
        if (terminar()) return;
        this.localizando.set(false);
        this.errorDireccion.set(this.mensajeGeolocalizacion(error));
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 }
    );
  }

  /** `permissions` no existe en todos los navegadores: si no está, se intenta igual. */
  private async permisoBloqueado(): Promise<boolean> {
    try {
      const estado = await navigator.permissions?.query({ name: 'geolocation' as PermissionName });
      return estado?.state === 'denied';
    } catch {
      return false;
    }
  }

  private async resolverPosicion(posicion: GeolocationPosition): Promise<void> {
    const { latitude, longitude } = posicion.coords;
    try {
      const sitio = await this.estado.geocodificarInverso(latitude, longitude);
      this.config.ubicacion.set(sitio);
      this.config.direccion.set(sitio.displayName);
    } catch {
      // Sin nombre, pero las coordenadas del GPS son válidas y son lo que de
      // verdad hace falta para calcular los trayectos: no se tiran.
      this.config.ubicacion.set({
        lat: latitude,
        lng: longitude,
        displayName: `Tu ubicación actual (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`
      });
      this.config.direccion.set(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
    } finally {
      this.localizando.set(false);
    }
  }

  private mensajeGeolocalizacion(error: GeolocationPositionError): string {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        return 'No nos has dado permiso para usar tu ubicación. Actívalo en el candado de la barra del navegador, o escribe la dirección a mano.';
      case error.POSITION_UNAVAILABLE:
        return 'Tu dispositivo no ha podido dar una posición. Escribe la dirección a mano.';
      case error.TIMEOUT:
        return 'Se ha agotado el tiempo esperando la ubicación. Vuelve a intentarlo o escribe la dirección.';
      default:
        return 'No se ha podido obtener tu ubicación. Escribe la dirección a mano.';
    }
  }

  // ── Trayecto y bandas ───────────────────────────────────────────────────
  medio(b: Banda): number {
    return Math.round((b.desde + b.hasta) / 2);
  }

  fijarMax(valor: number | null): void {
    this.config.maxPorModo.set({ ...this.config.maxPorModo(), [this.config.modo()]: valor });
  }

  /**
   * Edita una banda manteniendo siempre desde ≤ hasta y min ≤ max, y sin dejar
   * que ningún valor se salga de la escala.
   *
   * Un campo vacío no se toca: plantar un 0 en cuanto borras para reescribir es
   * justo lo que hace odiosos los formularios numéricos en el móvil. Al salir
   * del campo, `sincronizar` repinta el valor que sí está guardado.
   */
  editar(i: number, campo: keyof Banda, valor: number | null): void {
    if (valor == null || Number.isNaN(valor)) return;
    const tope = campo === 'desde' || campo === 'hasta' ? this.config.escala() : 100;
    const n = Math.max(0, Math.min(tope, Math.round(valor)));
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

  /** Al salir del campo, lo que se ve vuelve a ser lo que hay guardado. */
  sincronizar(evento: Event, valor: number): void {
    (evento.target as HTMLInputElement).value = String(valor);
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

  // ── Coche ───────────────────────────────────────────────────────────────
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

  // ── Cierre ──────────────────────────────────────────────────────────────
  /** Deja el paso 2 como recién estrenado. Los pasos 3 y 4 no se tocan. */
  borrarDatos(): void {
    if (!confirm('¿Borrar la dirección, las especialidades marcadas y el trayecto de este perfil?')) return;
    this.config.borrarPerfil();
    this.errorDireccion.set('');
    this.estado.error.set('');
    this.consumo = null;
    this.precio = null;
    this.fuelType = 'diesel';
  }

  /**
   * A qué zona de la pantalla corresponde el error actual.
   *
   * Un mensaje de error al pie no sirve de nada si el campo que falla está tres
   * pantallas más arriba: hay que poder saltar a él. Se resuelve por el texto
   * para que valga también para los errores que vengan de la API.
   */
  zonaDelError(): string | null {
    const mensaje = this.estado.error().toLowerCase();
    if (mensaje.includes('especialidad')) return 'zona-especialidades';
    if (mensaje.includes('direcci') || mensaje.includes('ubicaci')) return 'zona-vivienda';
    return null;
  }

  /** Lleva la vista al sitio del fallo y lo señala un momento. */
  irA(id: string): void {
    const destino = document.getElementById(id);
    if (!destino) return;
    destino.scrollIntoView({ behavior: 'smooth', block: 'center' });
    this.resaltado.set(id);
    const foco = destino.querySelector<HTMLElement>('button, input, select, textarea');
    foco?.focus({ preventScroll: true });
    window.setTimeout(() => this.resaltado.set(null), 2200);
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
