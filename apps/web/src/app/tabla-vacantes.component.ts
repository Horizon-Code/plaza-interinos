import { Component, ElementRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { formatearTrayecto, provinciaDeCentro } from '@plazainterinos/core';
import { EstadoService, VacanteEvaluada } from './estado.service';
import { COLUMNAS, IdColumna, ListaService } from './lista.service';

/**
 * Colores por especialidad. Los dos primeros son los de la maqueta; el resto se
 * reparten de forma estable por código, para que una especialidad tenga siempre
 * el mismo color aunque cambie la convocatoria.
 */
const PALETA = [
  { fondo: '#efe7fa', texto: '#69419a' },
  { fondo: '#e7f0f7', texto: '#3b6d8c' },
  { fondo: '#e6f4ed', texto: '#276749' },
  { fondo: '#fff3d8', texto: '#8a6116' },
  { fondo: '#fde8e6', texto: '#9b3d33' }
];
const FIJOS: Record<string, number> = { '006': 0, '107': 1 };

/**
 * Tabla del paso 5 (SCRUM-25). Configurable como una hoja de cálculo: se
 * ocultan columnas, se ajustan anchos y se abrevian por separado.
 *
 * Abreviar no es lo mismo que ocultar: una columna abreviada sigue estando,
 * recortada y con el texto completo en el `title`. Es lo que permite meter diez
 * columnas en un móvil sin obligar a scroll horizontal.
 */
@Component({
  selector: 'tp-tabla-vacantes',
  standalone: true,
  template: `
    <div class="controles-tabla">
      <details>
        <summary>Columnas</summary>
        <div class="rejilla-columnas">
          @for (c of columnas; track c.id) {
            <label class="control-col">
              <input type="checkbox" [checked]="lista.visible(c.id)"
                     (change)="lista.alternarColumna(c.id)" />
              <span>{{ c.nombre }}</span>
              @if (c.abreviable) {
                <button type="button" class="mini" [class.activa]="lista.abreviada(c.id)"
                        [disabled]="!lista.visible(c.id)"
                        (click)="lista.alternarAbreviada(c.id); $event.preventDefault()"
                        [title]="'Abreviar ' + c.nombre">abrev.</button>
              }
            </label>
          }
        </div>
      </details>
    </div>

    <div class="tabla-scroll">
      <table class="tabla-vacantes" [style.width.px]="anchoTotal()">
        <thead>
          <tr>
            @for (c of visibles(); track c.id) {
              <th scope="col" [style.width.px]="lista.ancho(c.id)">
                {{ c.nombre }}
                <span class="tirador" (pointerdown)="empezarAncho($event, c.id)"
                      (pointermove)="moverAncho($event)" (pointerup)="terminarAncho($event)"
                      [attr.aria-label]="'Ajustar el ancho de ' + c.nombre"></span>
              </th>
            }
            <th scope="col" class="col-acciones">Acciones</th>
          </tr>
        </thead>
        <tbody #cuerpo>
          @for (e of filas(); track e.vacancyId; let i = $index) {
            <tr [class.con-aviso]="lista.tieneAviso(e.vacancyId)"
                [class.arrastrando]="arrastrando() === i"
                [class.destacada]="destacada() === e.vacancyId">
              @for (c of visibles(); track c.id) {
                <td [style.width.px]="lista.ancho(c.id)"
                    [class.abreviada]="lista.abreviada(c.id)"
                    [title]="valor(e, c.id, i)">
                  <span class="recorte">
                  @switch (c.id) {
                    @case ('orden') {
                      <span class="celda-orden">
                        <span class="asa" (pointerdown)="empezarArrastre($event, i)"
                              (pointermove)="moverArrastre($event)"
                              (pointerup)="terminarArrastre($event)"
                              (pointercancel)="terminarArrastre($event)"
                              [attr.aria-label]="'Arrastrar ' + (e.vacancy.centerName ?? '')">⠿</span>
                        <input class="posicion" type="number" inputmode="numeric" min="1"
                               [max]="filas().length" [value]="i + 1"
                               (keydown.enter)="fijarPosicion(i, $any($event.target).value); $any($event.target).blur()"
                               (blur)="$any($event.target).value = i + 1"
                               [attr.aria-label]="'Posición de ' + (e.vacancy.centerName ?? '')" />
                      </span>
                    }
                    @case ('especialidad') {
                      <span class="chip-esp"
                            [style.background]="color(e).fondo" [style.color]="color(e).texto">
                        {{ valor(e, 'especialidad', i) }}
                      </span>
                    }
                    @default { {{ valor(e, c.id, i) }} }
                  }
                  </span>
                </td>
              }
              <td class="col-acciones">
                <button type="button" class="accion" [class.activa]="lista.tieneAviso(e.vacancyId)"
                        (click)="lista.alternarAviso(e.vacancyId)"
                        [attr.aria-pressed]="lista.tieneAviso(e.vacancyId)"
                        title="Marcar aviso">⚠</button>
                @if (telefono(e); as tel) {
                  <a class="accion" [href]="'tel:' + tel" [title]="'Llamar a ' + tel">☎</a>
                }
                <button type="button" class="accion" [class.activa]="!!lista.anotacion(e.vacancyId)"
                        (click)="editando.set(editando() === e.vacancyId ? null : e.vacancyId)"
                        title="Anotación">✎</button>
                <button type="button" class="accion peligro"
                        (click)="excluir(e, i)" title="Quitar de la lista">✕</button>
              </td>
            </tr>
            @if (editando() === e.vacancyId) {
              <tr class="fila-nota">
                <td [attr.colspan]="visibles().length + 1">
                  <textarea rows="2" [value]="lista.anotacion(e.vacancyId)"
                            placeholder="Tu nota sobre esta plaza"
                            (input)="lista.anotar(e.vacancyId, $any($event.target).value)"
                            [attr.aria-label]="'Anotación de ' + (e.vacancy.centerName ?? '')"></textarea>
                </td>
              </tr>
            } @else if (lista.anotacion(e.vacancyId); as nota) {
              <tr class="fila-nota">
                <td [attr.colspan]="visibles().length + 1"><span class="nota">✎ {{ nota }}</span></td>
              </tr>
            }
          }
        </tbody>
      </table>
    </div>

    @if (lista.ultimaExclusion(); as ex) {
      <div class="deshacer" role="status">
        <span>Quitada <strong>{{ ex.centro }}</strong> de la lista.</span>
        <button type="button" class="secundario" (click)="lista.deshacerExclusion()">Deshacer</button>
        <button type="button" class="mini" (click)="lista.descartarDeshacer()"
                aria-label="Descartar el aviso">✕</button>
      </div>
    }
  `,
  styles: [`
    .controles-tabla { margin:10px 0; }
    .controles-tabla summary { cursor:pointer; font-weight:600; font-size:14px; }
    .rejilla-columnas { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr));
      gap:6px; padding:10px 0; }
    .control-col { display:flex; align-items:center; gap:6px; font-size:13px; }
    .mini { padding:1px 6px; font-size:11px; border:1px solid var(--linea);
      background:#fff; border-radius:5px; cursor:pointer; }
    .mini.activa { background:var(--acierto-bg); border-color:var(--acierto); }
    .tabla-scroll { overflow-x:auto; }
    .tabla-vacantes { border-collapse:collapse; min-width:100%; table-layout:fixed; }
    .tabla-vacantes th, .tabla-vacantes td { border-bottom:1px solid var(--linea);
      padding:6px 8px; text-align:left; font-size:13px; vertical-align:top; }
    .tabla-vacantes th { position:relative; background:var(--acierto-bg); font-size:12px; }
    .tirador { position:absolute; top:0; right:0; width:8px; height:100%;
      cursor:col-resize; touch-action:none; }
    /* El recorte va en un bloque dentro de la celda: text-overflow sobre un
       <td> no lo respetan los navegadores. Y el chip de especialidad necesita
       el suyo, porque su texto no es hijo directo de la celda. */
    .recorte { display:block; min-width:0; }
    td.abreviada .recorte { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    td.abreviada .chip-esp { display:block; max-width:100%; white-space:nowrap;
      overflow:hidden; text-overflow:ellipsis; }
    tr.con-aviso { background:var(--aviso-bg); }
    tr.arrastrando { opacity:.5; }
    tr.destacada { background:var(--acierto-bg); box-shadow:inset 3px 0 0 var(--acierto); }
    .celda-orden { display:flex; align-items:center; gap:4px; }
    .celda-orden .asa { cursor:grab; touch-action:none; user-select:none; color:var(--tinta-suave); }
    .posicion { width:38px; text-align:center; padding:2px; border:1px solid var(--linea); border-radius:5px; }
    .chip-esp { display:inline-block; padding:1px 8px; border-radius:12px; font-weight:600; font-size:12px; }
    .col-acciones { white-space:nowrap; width:132px; }
    .accion { border:1px solid var(--linea); background:#fff; border-radius:6px;
      padding:2px 6px; cursor:pointer; text-decoration:none; color:inherit; font-size:14px; }
    .accion.activa { background:var(--aviso-bg); border-color:var(--aviso); }
    .accion.peligro:hover { background:var(--descarte-bg); border-color:var(--descarte); }
    .fila-nota td { padding-top:0; border-bottom:1px solid var(--linea); }
    .fila-nota textarea { width:100%; font-size:13px; }
    .nota { font-size:12px; color:var(--tinta-suave); font-style:italic; }
    /* Flotante y no en el flujo: el clic en ✕ puede estar en la fila 200, y un
       aviso pintado detrás de la tabla queda a tres pantallas de scroll de
       donde el usuario está mirando. Deshacer solo sirve si se ve al instante. */
    .deshacer { position:fixed; z-index:20; left:50%; transform:translateX(-50%);
      bottom:18px; display:flex; align-items:center; gap:10px;
      background:var(--tinta); color:var(--tiza); border-radius:var(--radio);
      padding:10px 16px; font-size:14px; box-shadow:0 8px 28px rgba(0,0,0,.28);
      max-width:min(92vw,520px); }
    .deshacer strong { color:#fff; }
    .deshacer .secundario { background:transparent; color:var(--tiza);
      border-color:rgba(255,255,255,.5); }
    .deshacer .mini { background:transparent; color:var(--tiza); border-color:transparent; }
    @media (max-width: 620px) {
      .tabla-vacantes, .tabla-vacantes tbody, .tabla-vacantes tr, .tabla-vacantes td { display:block; width:auto !important; }
      .tabla-vacantes thead { display:none; }
      .tabla-vacantes tr { border:1px solid var(--linea); border-radius:var(--radio);
        margin-bottom:8px; padding:6px 8px; display:grid;
        grid-template-columns:1fr auto; align-items:start; }
      .tabla-vacantes td { border:none; padding:2px 0; }
      /* Trayecto y acciones a la derecha; el resto de datos a la izquierda. */
      .tabla-vacantes td.col-acciones { grid-column:2; grid-row:1 / span 2; text-align:right; }
      .fila-nota td { grid-column:1 / -1; }
    }
  `]
})
export class TablaVacantesComponent {
  readonly estado = inject(EstadoService);
  readonly lista = inject(ListaService);

  readonly filas = input.required<VacanteEvaluada[]>();
  readonly reordenada = output<string[]>();
  /** Fila recién insertada: se señala un momento para que se vea dónde cayó. */
  readonly destacada = input<string | null>(null);

  readonly columnas = COLUMNAS;
  readonly editando = signal<string | null>(null);
  readonly arrastrando = signal<number | null>(null);
  private readonly cuerpo = viewChild<ElementRef<HTMLElement>>('cuerpo');
  private ajustando: { id: IdColumna; x: number; ancho: number } | null = null;

  readonly visibles = computed(() => this.columnas.filter(c => this.lista.visible(c.id)));

  /** Suma de anchos + la columna de acciones: es lo que hace que el arrastre
   *  ensanche de verdad en vez de robarle sitio a la columna vecina. */
  readonly anchoTotal = computed(
    () => this.visibles().reduce((n, c) => n + this.lista.ancho(c.id), 0) + 132
  );

  color(e: VacanteEvaluada): { fondo: string; texto: string } {
    const codigo = e.vacancy.specialtyCode ?? '';
    const fijo = FIJOS[codigo];
    if (fijo != null) return PALETA[fijo];
    let suma = 0;
    for (const ch of codigo) suma += ch.charCodeAt(0);
    return PALETA[suma % PALETA.length];
  }

  /** El modelo todavía no trae teléfono. Devuelve null, nunca "pendiente". */
  telefono(_e: VacanteEvaluada): string | null {
    return null;
  }

  valor(e: VacanteEvaluada, columna: IdColumna, indice: number): string {
    const v = e.vacancy;
    const corto = this.lista.abreviada(columna);
    switch (columna) {
      case 'orden': return String(indice + 1);
      case 'centro': return v.centerName ?? '';
      case 'localidad': return v.municipality ?? '';
      case 'provincia': return v.province?.trim() || provinciaDeCentro(v.centerCode, v.municipality);
      case 'tipo': return v.voluntary ? (corto ? 'Volunt.' : 'Voluntaria') : (corto ? 'Oblig.' : 'Obligatoria');
      case 'especialidad': return v.specialtyName ?? '';
      case 'jornada': return v.workload != null ? `${Math.round(v.workload * 100)}${corto ? '' : ' %'}` : '';
      case 'informacion': return v.additionalInfoRaw ?? '';
      case 'trayecto': return formatearTrayecto(e);
      case 'telefono': return this.telefono(e) ?? '';
    }
  }

  // ── Reordenar ─────────────────────────────────────────────────────────
  private ids(): string[] { return this.filas().map(f => f.vacancyId); }

  fijarPosicion(desde: number, valor: string): void {
    const destino = Number(valor) - 1;
    if (Number.isNaN(destino)) return;
    this.lista.mover(this.ids(), desde, destino);
    this.reordenada.emit(this.lista.ordenManual());
  }

  empezarArrastre(evento: PointerEvent, i: number): void {
    evento.preventDefault();
    (evento.target as HTMLElement).setPointerCapture(evento.pointerId);
    this.arrastrando.set(i);
  }

  moverArrastre(evento: PointerEvent): void {
    const desde = this.arrastrando();
    if (desde == null) return;
    const destino = this.filaEn(evento.clientY);
    if (destino == null || destino === desde) return;
    this.lista.mover(this.ids(), desde, destino);
    this.arrastrando.set(destino);
  }

  terminarArrastre(evento: PointerEvent): void {
    const asa = evento.target as HTMLElement;
    if (asa.hasPointerCapture?.(evento.pointerId)) asa.releasePointerCapture(evento.pointerId);
    if (this.arrastrando() != null) this.reordenada.emit(this.lista.ordenManual());
    this.arrastrando.set(null);
  }

  /** Solo cuentan las filas de datos: las de nota no son posiciones. */
  private filaEn(y: number): number | null {
    const cuerpo = this.cuerpo()?.nativeElement;
    if (!cuerpo) return null;
    const filas = Array.from(cuerpo.children).filter(
      f => !f.classList.contains('fila-nota')
    ) as HTMLElement[];
    for (let i = 0; i < filas.length; i++) {
      const caja = filas[i].getBoundingClientRect();
      if (y >= caja.top && y <= caja.bottom) return i;
    }
    return null;
  }

  excluir(e: VacanteEvaluada, indice: number): void {
    this.lista.excluir(e.vacancyId, indice, e.vacancy.centerName ?? 'esa plaza');
  }

  // ── Anchos de columna ─────────────────────────────────────────────────
  empezarAncho(evento: PointerEvent, id: IdColumna): void {
    evento.preventDefault();
    (evento.target as HTMLElement).setPointerCapture(evento.pointerId);
    this.ajustando = { id, x: evento.clientX, ancho: this.lista.ancho(id) };
  }

  moverAncho(evento: PointerEvent): void {
    if (!this.ajustando) return;
    const { id, x, ancho } = this.ajustando;
    this.lista.fijarAncho(id, ancho + (evento.clientX - x));
  }

  terminarAncho(evento: PointerEvent): void {
    const tirador = evento.target as HTMLElement;
    if (tirador.hasPointerCapture?.(evento.pointerId)) tirador.releasePointerCapture(evento.pointerId);
    this.ajustando = null;
  }
}
