import { Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import {
  catalogoEtiquetas,
  DIRECCIONES,
  ORDEN_POR_DEFECTO,
  moverCriterio,
  utilidadCriterios,
  type CriterioOrden,
  type EtiquetaContada,
  type DireccionOrden
} from '@plazainterinos/core';
import { ConfiguracionService } from './configuracion.service';
import { EstadoService } from './estado.service';

const ICONO: Record<CriterioOrden, string> = {
  distance: '📍',
  specialty: '🎓',
  workload: '🕑',
  voluntary: '⚖️',
  province: '🗺️',
  duration: '📅',
  volGroup: '🧩'
};

const NOMBRE: Record<CriterioOrden, string> = {
  distance: 'Distancia',
  specialty: 'Especialidad',
  workload: 'Jornada',
  voluntary: 'Obligatorias / voluntarias',
  province: 'Provincias',
  duration: 'Duración',
  volGroup: 'Voluntarias'
};

/**
 * Etiqueta corta de cada sentido, para el toggle de la fila. La larga sigue
 * usándose donde hay sitio; aquí caben dos palabras.
 */
const CORTO: Record<DireccionOrden, string> = {
  'cerca-primero': 'las cercanas',
  'lejos-primero': 'las lejanas',
  'mi-orden-bajo-primero': 'orden bajo',
  'mi-orden-alto-primero': 'orden alto',
  'completa-primero': 'completa',
  'parcial-primero': 'parcial',
  'obligatoria-primero': 'obligatorias',
  'voluntaria-primero': 'voluntarias',
  'provincia-az': 'A → Z',
  'provincia-za': 'Z → A',
  'provincia-mi-orden': 'mi orden',
  'vol-mi-orden': 'mi orden',
  'larga-primero': 'larga',
  'corta-primero': 'corta'
};

/**
 * Lo que promete el control. Sin esta palabra, un par de botones se lee como un
 * filtro —elijo esta y descarto la otra— y aquí no se descarta nada: se decide
 * cuál va antes. Provincia es la excepción: A→Z no es una precedencia sino un
 * modo de ordenar, y por eso lleva otro rótulo.
 */
const ROTULO: Record<CriterioOrden, string> = {
  distance: 'Primero:',
  specialty: 'Primero:',
  workload: 'Primero:',
  voluntary: 'Primero:',
  province: 'Orden:',
  volGroup: 'Orden:',
  duration: 'Primero:'
};

const DESCRIPCION: Record<DireccionOrden, string> = {
  'cerca-primero': 'Primero las más cerca de casa',
  'lejos-primero': 'Primero las más lejos de casa',
  'mi-orden-bajo-primero': 'Primero las de tu número de orden más bajo',
  'mi-orden-alto-primero': 'Primero las de tu número de orden más alto',
  'completa-primero': 'Primero la jornada completa',
  'parcial-primero': 'Primero la jornada parcial',
  'obligatoria-primero': 'Primero las obligatorias',
  'voluntaria-primero': 'Primero las voluntarias',
  'provincia-az': 'Por provincia, de la A a la Z',
  'provincia-za': 'Por provincia, de la Z a la A',
  'provincia-mi-orden': 'En el orden que fijes abajo',
  'vol-mi-orden': 'En el orden que fijes abajo',
  'larga-primero': 'Primero las de más duración',
  'corta-primero': 'Primero las sustituciones cortas'
};

/**
 * Paso 4 · Primera ordenación general (SCRUM-24). No quita nada: solo recoloca.
 *
 * Tres formas de reordenar, porque ninguna sirve sola: el número para saltar
 * lejos, las flechas para el ajuste fino con teclado, y el arrastre para el
 * gesto natural. El arrastre usa Pointer Events y no la API de drag de HTML5,
 * que sencillamente no se dispara en táctil.
 */
@Component({
  selector: 'tp-ordenar',
  standalone: true,
  template: `
    <h1>Primera ordenación general <span class="etiqueta-opcional">opcional</span></h1>
    <p class="lead">
      Número, flechas o arrastre. Solo aparecen los criterios que tengan sentido
      con tus plazas. Este paso no descarta ninguna: solo cambia en qué orden las ves.
    </p>

    <div class="card">
      <p class="fuente" style="border:none; padding:0; font-style:normal;">
        El orden de arriba a abajo es la prioridad: el criterio de abajo solo desempata
        cuando el de arriba da igual.
      </p>

      <ol class="criterios" #lista>
        @for (c of visibles(); track c.criterio; let i = $index, ultimo = $last) {
          <li class="criterio" [class.arrastrando]="arrastrando() === i">
            <div class="fila-criterio">
            <input
              type="checkbox"
              class="activo"
              [checked]="c.activo !== false"
              (change)="alternarActivo(i)"
              [attr.aria-label]="'Usar ' + nombre(c.criterio) + ' para ordenar'"
            />

            <span class="posicion-caja">
              @if (cuenta(i); as n) {
                <input
                  class="posicion"
                  type="number"
                  inputmode="numeric"
                  min="1"
                  [max]="config.cascada().length"
                  [value]="n"
                  (keydown.enter)="fijarPosicion(i, $any($event.target).value); $any($event.target).blur()"
                  (blur)="$any($event.target).value = n"
                  [attr.aria-label]="'Prioridad de ' + nombre(c.criterio)"
                />
              } @else {
                <span class="sin-posicion" aria-hidden="true">—</span>
              }
            </span>

            <!-- touch-action:none SOLO aquí: arrastrar desde el asa no hace scroll,
                 y tocar el resto de la fila sí, que es lo que pide la tarea. -->
            <span
              class="asa"
              role="button"
              tabindex="0"
              [attr.aria-label]="'Arrastrar ' + nombre(c.criterio)"
              (pointerdown)="empezarArrastre($event, i)"
              (pointermove)="moverArrastre($event)"
              (pointerup)="terminarArrastre($event)"
              (pointercancel)="terminarArrastre($event)"
            >⠿</span>

            <span class="flechas">
              <button type="button" class="secundario" [disabled]="i === 0"
                      (click)="subir(i)" [attr.aria-label]="'Subir ' + nombre(c.criterio)">↑</button>
              <button type="button" class="secundario" [disabled]="ultimo"
                      (click)="bajar(i)" [attr.aria-label]="'Bajar ' + nombre(c.criterio)">↓</button>
            </span>

            <span class="icono" aria-hidden="true">{{ icono(c.criterio) }}</span>

            @if (conDesplegable(c)) {
              <!-- Los que despliegan abren desde toda la banda del nombre, no
                   solo desde la flecha. Los que no, se quedan como texto: un
                   nombre pulsable que no hace nada es peor que uno que no lo
                   parece. -->
              <button type="button" class="texto banda" (click)="alternarAbierto(c.criterio)"
                      [attr.aria-expanded]="abierto(c.criterio)">
                <strong>{{ nombre(c.criterio) }}</strong>
              </button>
            } @else {
              <span class="texto">
                <strong>{{ nombre(c.criterio) }}</strong>
              </span>
            }

            @if (direcciones(c.criterio).length > 1) {
            <span class="sentido">
              <span class="rotulo">{{ rotulo(c.criterio) }}</span>
              <span class="par">
                @for (d of direcciones(c.criterio); track d) {
                  <button type="button" [class.elegido]="c.direccion === d"
                          (click)="fijarDireccion(i, d)"
                          [attr.aria-pressed]="c.direccion === d"
                          [attr.aria-label]="rotulo(c.criterio) + ' ' + corto(d)">{{ corto(d) }}</button>
                }
              </span>
            </span>
            }
            @if (conDesplegable(c)) {
              <button type="button" class="icono-flecha" [class.cerrado]="!abierto(c.criterio)"
                      (click)="alternarAbierto(c.criterio)"
                      [attr.aria-expanded]="abierto(c.criterio)"
                      [attr.aria-label]="'Desplegar ' + nombre(c.criterio)">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6" /></svg>
              </button>
            }
          </div>

          <!-- Solo despliegan los criterios que de verdad tienen contenido: hoy
               Provincias cuando la ordenas a mano. Un desplegable vacío es una
               promesa que no se cumple. -->
          @if (conDesplegable(c) && abierto(c.criterio)) {
            <div class="sublista">
              @if (c.criterio === 'volGroup') {
                <p class="pista">Solo salen los subgrupos que has dejado activos en Filtrar.
                  Las condiciones sueltas van juntas en «Otras condiciones».</p>
              }
              @for (e of sublista(c.criterio); track e.etiqueta; let j = $index, primero = $first, ultimo = $last) {
                <div class="sub-fila">
                  <span class="n-sub">{{ j + 1 }}</span>
                  <span class="etiqueta-sub">{{ e.etiqueta }}</span>
                  @if (e.cuantas) {
                    <span class="cuantas-sub">{{ e.cuantas }}</span>
                  }
                  <button type="button" class="secundario mini" [disabled]="primero"
                          (click)="moverEnSublista(c.criterio, j, -1)"
                          [attr.aria-label]="'Subir ' + e.etiqueta">↑</button>
                  <button type="button" class="secundario mini" [disabled]="ultimo"
                          (click)="moverEnSublista(c.criterio, j, 1)"
                          [attr.aria-label]="'Bajar ' + e.etiqueta">↓</button>
                </div>
              }
            </div>
          }
          </li>
        }
      </ol>
      @if (!visibles().length) {
        <p class="fuente">
          Con las plazas que te han quedado no hay nada que ordenar: todas coinciden
          en jornada, trayecto, provincia y tipo. Pasa directamente a tu lista.
        </p>
      }
    </div>

    <div class="fila-botones" style="justify-content:flex-start;">
      <button (click)="continuar()" [disabled]="calculando()">
        @if (calculando()) { <span class="spinner"></span> Calculando tu lista… }
        @else if (porDefecto()) { Saltar este paso · orden por defecto }
        @else { Ordenar lista → }
      </button>
      @if (!porDefecto() && !calculando()) {
        <button class="secundario" (click)="restaurar()">Volver al orden por defecto</button>
      }
    </div>
    @if (estado.error()) { <p class="error">{{ estado.error() }}</p> }
  `,
  styles: [`
    .criterios { list-style:none; margin:14px 0 0; padding:0; }
    /* La tarjeta ya no es la fila: dentro caben la fila y, debajo, su sublista. */
    .criterio { background:#fff; border:1px solid var(--linea);
      border-radius:var(--radio); margin-bottom:8px; }
    .criterio.arrastrando { opacity:.55; border-color:var(--pizarra); }
    .fila-criterio { display:flex; align-items:center; gap:10px; padding:8px 12px; }
    .criterio .activo { width:18px; height:18px; flex-shrink:0; }
    .posicion-caja { width:44px; flex-shrink:0; text-align:center; }
    .posicion { width:44px; text-align:center; padding:4px; border:1px solid var(--linea); border-radius:6px; }
    .sin-posicion { color:var(--tinta-suave); }
    .asa { cursor:grab; touch-action:none; user-select:none; flex-shrink:0;
      color:var(--tinta-suave); font-size:18px; padding:4px 2px; }
    .asa:active { cursor:grabbing; }
    .icono { flex-shrink:0; }
    /* Sin flex-grow: quien empuja el toggle al final es su margen automático,
       y con los dos mecanismos a la vez el resultado depende del orden. */
    .texto { min-width:0; font-size:15px; font-weight:600; }
    .banda { border:none; background:transparent; font:inherit; color:inherit; text-align:left;
      cursor:pointer; min-height:44px; padding:0 8px; margin:0 -8px; border-radius:8px;
      display:inline-flex; align-items:center; box-shadow:none; }
    .banda:hover { background:#f2f1ec; box-shadow:none; }
    .banda:focus-visible { outline:2px solid var(--pizarra); outline-offset:1px; }
    .flechas { display:flex; flex-direction:column; gap:2px; flex-shrink:0; }
    .flechas + .icono { margin-left:2px; }
    .flechas button { padding:1px 7px; line-height:1.2; font-size:12px; }

    /* El sentido, en la propia fila. La palabra de delante es lo que convierte
       un par de botones en una precedencia y no en una elección excluyente. */
    /* Pegado al final de la fila: no depende de que el nombre crezca, que es
       justo lo que fallaba. */
    .sentido { display:inline-flex; align-items:center; gap:8px; flex-shrink:0; margin-left:auto; }
    .sentido .rotulo { font-size:12.5px; color:var(--tinta-suave); white-space:nowrap; }
    .par { display:inline-flex; border:1px solid var(--linea); border-radius:999px;
      padding:2px; background:#faf9f5; }
    .par button { border:none; background:transparent; font:inherit; font-size:12.5px;
      font-weight:600; color:var(--tinta-suave); padding:5px 13px; border-radius:999px;
      min-height:32px; white-space:nowrap; box-shadow:none; }
    .par button:hover { background:transparent; color:var(--tinta); box-shadow:none; }
    .par button.elegido { background:var(--pizarra); color:var(--tiza); }

    .sublista { border-top:1px solid var(--linea); padding:6px 12px 10px 46px;
      display:flex; flex-direction:column; gap:4px; }
    .sub-fila { display:flex; align-items:center; gap:9px; background:#faf9f5;
      border-radius:8px; padding:5px 10px; min-height:40px; }
    .n-sub { flex:none; width:20px; text-align:center; font-weight:700;
      font-size:13px; color:var(--pizarra); }
    .etiqueta-sub { flex:1; min-width:0; font-size:14.5px; }
    .cuantas-sub { flex:none; font-size:12.5px; color:var(--tinta-suave); white-space:nowrap; }
    .pista { font-size:12.5px; color:var(--tinta-suave); margin:0 0 4px; text-wrap:pretty; }
    .mini { padding:2px 9px; font-size:12px; line-height:1.3; }
    /* El chevrón del desplegable: sin borde, para no sumar otro botón cuadrado
       a una fila que ya tiene tres. */
    .icono-flecha { flex:none; width:30px; height:30px; padding:0; border:none;
      background:transparent; color:var(--tinta-suave); border-radius:50%;
      display:inline-flex; align-items:center; justify-content:center; box-shadow:none; }
    .icono-flecha:hover { background:#f0efe9; color:var(--tinta); box-shadow:none; }
    .icono-flecha svg { transition:transform .16s ease; }
    .icono-flecha.cerrado svg { transform:rotate(-90deg); }

    @media (max-width: 620px) {
      .fila-criterio { flex-wrap:wrap; gap:8px; }
      .texto { flex-basis:100%; order:5; }
      .sentido { order:6; margin-left:0; }
      .sublista { padding-left:12px; }
    }
  `]
})
export class OrdenarComponent {
  readonly config = inject(ConfiguracionService);
  readonly estado = inject(EstadoService);
  private readonly router = inject(Router);
  private readonly lista = viewChild<ElementRef<HTMLElement>>('lista');

  readonly arrastrando = signal<number | null>(null);
  readonly calculando = signal(false);

  /** Los sentidos posibles de un criterio, para pintar una opción por cada uno. */
  direcciones(criterio: CriterioOrden): readonly DireccionOrden[] {
    return DIRECCIONES[criterio];
  }

  corto(direccion: DireccionOrden): string { return CORTO[direccion]; }

  /** Qué criterio tiene la sublista abierta. */
  private readonly desplegado = signal<CriterioOrden | null>(null);
  abierto(criterio: CriterioOrden): boolean { return this.desplegado() === criterio; }
  alternarAbierto(criterio: CriterioOrden): void {
    this.desplegado.set(this.desplegado() === criterio ? null : criterio);
  }

  /**
   * Provincias es el único criterio cuyo control no cabe en la fila: un orden
   * de tres no se expresa con un interruptor de dos. Su desplegable no es un
   * extra, es su único ajuste, así que está siempre.
   */
  conDesplegable(c: { criterio: CriterioOrden }): boolean {
    return c.criterio === 'province' || c.criterio === 'volGroup';
  }

  /**
   * Las vacantes que siguen vivas al llegar aquí: las del aspirante menos las
   * que descartó en Filtrar. No se puede usar `resultado()`, que es lo que
   * devuelve la evaluación y todavía no existe en este paso.
   */
  private readonly vacantesVivas = computed(() => {
    const fuera = new Set(this.config.vacantesDescartadas());
    return this.estado.vacantesDelUsuario().filter(v => !fuera.has(v.id));
  });

  /** Las filas de la sublista de un criterio, ya en el orden guardado. */
  sublista(criterio: CriterioOrden): { etiqueta: string; cuantas: string }[] {
    if (criterio === 'province') {
      return this.provinciasOrdenadas().map(p => ({ etiqueta: p, cuantas: '' }));
    }
    return this.voluntariasOrdenadas().map(e => ({
      etiqueta: e.etiqueta,
      cuantas: e.cuantas === 1 ? '1 plaza' : `${e.cuantas} plazas`
    }));
  }

  /**
   * Subgrupos de voluntarias, domados por el core: variantes de la misma
   * condición fundidas, restos de texto libre fuera y lo que pesa poco en
   * "Otras condiciones". Sin eso salían más de veinte y no se podían ordenar.
   */
  readonly voluntariasOrdenadas = computed(() => {
    const catalogo = catalogoEtiquetas(this.vacantesVivas().filter(v => v.voluntary));
    const guardado = this.config.ordenVoluntarias();
    const porNombre = new Map(catalogo.map(e => [e.etiqueta, e]));
    const enOrden = guardado.map(n => porNombre.get(n)).filter((e): e is EtiquetaContada => !!e);
    const nuevas = catalogo.filter(e => !guardado.includes(e.etiqueta));
    return [...enOrden, ...nuevas];
  });

  moverEnSublista(criterio: CriterioOrden, desde: number, salto: -1 | 1): void {
    if (criterio === 'province') { this.moverProvincia(desde, salto); return; }
    const lista = this.voluntariasOrdenadas().map(e => e.etiqueta);
    const destino = desde + salto;
    if (destino < 0 || destino >= lista.length) return;
    [lista[desde], lista[destino]] = [lista[destino], lista[desde]];
    this.config.ordenVoluntarias.set(lista);
  }

  /**
   * Las provincias que siguen en la lista, en el orden guardado. Las que aparezcan
   * y no estuvieran guardadas se añaden al final: si importas otra convocatoria
   * con una provincia nueva, no desaparece por no estar en tu orden anterior.
   */
  readonly provinciasOrdenadas = computed(() => {
    const presentes = new Set(
      this.vacantesVivas().map(v => v.province ?? '').filter(Boolean)
    );
    const guardadas = this.config.ordenProvincias().filter(p => presentes.has(p));
    const nuevas = [...presentes].filter(p => !guardadas.includes(p)).sort((a, b) => a.localeCompare(b, 'es'));
    return [...guardadas, ...nuevas];
  });

  moverProvincia(desde: number, salto: -1 | 1): void {
    const lista = [...this.provinciasOrdenadas()];
    const destino = desde + salto;
    if (destino < 0 || destino >= lista.length) return;
    [lista[desde], lista[destino]] = [lista[destino], lista[desde]];
    this.config.ordenProvincias.set(lista);
    // Una configuración guardada de antes puede traer 'provincia-az'. En cuanto
    // tocas la lista, manda la lista.
    const cascada = this.config.cascada();
    const indice = cascada.findIndex(c => c.criterio === 'province');
    if (indice >= 0 && cascada[indice].direccion !== 'provincia-mi-orden') {
      const copia = [...cascada];
      copia[indice] = { ...copia[indice], direccion: 'provincia-mi-orden' };
      this.config.cascada.set(copia);
    }
  }
  rotulo(criterio: CriterioOrden): string { return criterio === 'distance' && this.config.modo() === 'minutes' ? 'Tiempo de trayecto' : ROTULO[criterio]; }

  /** Fija el sentido elegido en el panel, sin tener que adivinar alternando. */
  fijarDireccion(posicion: number, direccion: DireccionOrden): void {
    const indice = this.indiceEnCascada(posicion);
    if (indice == null) return;
    const cascada = [...this.config.cascada()];
    cascada[indice] = { ...cascada[indice], direccion };
    this.config.cascada.set(cascada);
  }

  /**
   * Qué criterios distinguen algo con las plazas que han quedado. Se calcula
   * sobre la lista ya evaluada; si todavía no hay, todos valen.
   */
  private readonly utilidades = computed(() => {
    const resultado = this.estado.resultado();
    const filas = resultado ? [...resultado.recommended, ...resultado.withWarnings] : [];
    if (!filas.length) {
      return Object.fromEntries(
        this.config.cascada().map(c => [c.criterio, { util: true }])
      ) as ReturnType<typeof utilidadCriterios>;
    }
    return utilidadCriterios(filas, this.config.ordenPorEspecialidad(this.estado.especialidadesUsuario()));
  });

  readonly porDefecto = computed(() =>
    this.config.cascada().every(
      (c, i) => c.criterio === ORDEN_POR_DEFECTO[i]?.criterio && c.direccion === ORDEN_POR_DEFECTO[i]?.direccion
    )
  );

  utilidad(criterio: CriterioOrden): { util: boolean; motivo?: string } {
    return this.utilidades()[criterio] ?? { util: true };
  }

  /**
   * Los criterios que se pintan: solo los que todavía distinguen algo.
   *
   * Si quitaste provincias en Filtrar hasta dejar una, ordenar por provincia no
   * mueve una sola fila, y lo quitaste tú un paso antes: no hace falta enseñarlo
   * en gris explicando algo que ya sabes.
   *
   * Se filtra al pintar y NO se borra de la cascada: si vuelves a Filtrar y
   * deshaces la exclusión, el criterio reaparece en la posición que tenía, con
   * su sentido. Borrarlo perdería el orden que hubieras montado.
   *
   * Cada fila lleva su `indice` en la cascada porque la pantalla numera por
   * filas visibles y la cascada guarda también las ocultas: todo lo que modifica
   * el orden traduce de una numeración a la otra.
   */
  readonly visibles = computed(() =>
    this.config.cascada()
      .map((c, indice) => ({ ...c, indice }))
      .filter(c => this.utilidad(c.criterio).util)
  );

  /** Posición de la pantalla → posición en la cascada guardada. */
  private indiceEnCascada(posicion: number): number | null {
    return this.visibles()[posicion]?.indice ?? null;
  }

  /** Mueve la fila visible `desde` al hueco de la fila visible `destino`. */
  private moverVisible(desde: number, destino: number): void {
    const a = this.indiceEnCascada(desde);
    const b = this.indiceEnCascada(destino);
    if (a == null || b == null) return;
    this.config.cascada.set(moverCriterio(this.config.cascada(), a, b));
  }

  icono(criterio: CriterioOrden): string { return ICONO[criterio]; }
  nombre(criterio: CriterioOrden): string { return NOMBRE[criterio]; }
  descripcion(direccion: DireccionOrden): string { return DESCRIPCION[direccion]; }

  /**
   * Número que ve el usuario: solo cuentan los criterios activos, así que un
   * criterio apagado muestra "—" y no deja un hueco en la numeración. Se cuenta
   * sobre las filas visibles, que es lo único que hay en pantalla.
   */
  cuenta(posicion: number): number | null {
    const visibles = this.visibles();
    if (visibles[posicion]?.activo === false) return null;
    return visibles.slice(0, posicion + 1).filter(c => c.activo !== false).length;
  }

  alternarActivo(posicion: number): void {
    const indice = this.indiceEnCascada(posicion);
    if (indice == null) return;
    const cascada = [...this.config.cascada()];
    cascada[indice] = { ...cascada[indice], activo: cascada[indice].activo === false };
    this.config.cascada.set(cascada);
  }

  // --- Reordenar: número, flechas y arrastre ---

  fijarPosicion(desde: number, valor: string): void {
    const destino = Number(valor) - 1;
    if (Number.isNaN(destino)) return;
    this.moverVisible(desde, destino);
  }

  subir(posicion: number): void { this.moverVisible(posicion, posicion - 1); }
  bajar(posicion: number): void { this.moverVisible(posicion, posicion + 1); }

  empezarArrastre(evento: PointerEvent, i: number): void {
    // Sin preventDefault el navegador puede quedarse con el gesto y cancelarlo.
    evento.preventDefault();
    (evento.target as HTMLElement).setPointerCapture(evento.pointerId);
    this.arrastrando.set(i);
  }

  /**
   * Reordena en vivo al cruzar la mitad de otra fila. Con captura de puntero el
   * dedo puede salirse del asa sin que se pierda el gesto.
   */
  moverArrastre(evento: PointerEvent): void {
    const desde = this.arrastrando();
    if (desde == null) return;
    const destino = this.filaEn(evento.clientY);
    if (destino == null || destino === desde) return;
    this.moverVisible(desde, destino);
    this.arrastrando.set(destino);
  }

  terminarArrastre(evento: PointerEvent): void {
    const asa = evento.target as HTMLElement;
    if (asa.hasPointerCapture?.(evento.pointerId)) asa.releasePointerCapture(evento.pointerId);
    this.arrastrando.set(null);
  }

  /** Índice de la fila cuyo alto contiene esa Y de pantalla. */
  private filaEn(y: number): number | null {
    const ol = this.lista()?.nativeElement;
    if (!ol) return null;
    const filas = Array.from(ol.children) as HTMLElement[];
    for (let i = 0; i < filas.length; i++) {
      const caja = filas[i].getBoundingClientRect();
      if (y >= caja.top && y <= caja.bottom) return i;
    }
    return null;
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
      await this.estado.evaluar();
      await this.router.navigate(['/resultado']);
    } catch (error) {
      this.estado.error.set(String(error instanceof Error ? error.message : error));
    } finally {
      this.calculando.set(false);
    }
  }
}
