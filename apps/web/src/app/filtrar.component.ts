import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import {
  extractFromAdditionalInfo,
  type VacancyRequirement,
  type VacanteImportada,
  claveCentroTrayecto
} from '@plazainterinos/core';
import { AvisoTrayectoComponent } from './aviso-trayecto.component';
import { ConfiguracionService } from './configuracion.service';
import { EstadoService } from './estado.service';

/** Una vacante con todo lo que hay que enseñar de ella al desplegarla. */
interface VacanteFiltrar {
  id: string;
  centro: string;
  localidad: string;
  provincia: string;
  especialidad: string;
  jornada: string;
  /** Jornada en porcentaje (100 = completa); null si la ficha no lo dice. */
  jornadaPct: number | null;
  /** Número de vacante del PDF, para poder cotejar con la ficha oficial. */
  numero: string;
  /** Jornada en versión corta, para el badge: "Comp." o "12 h · 66.67%". */
  jornadaCorta: string;
  causa: string;
  info: string;
  /** Trayecto en la unidad del perfil (min o km); null si falta alguna coordenada. */
  trayecto: number | null;
}

interface Subgrupo {
  id: string;
  etiqueta: string;
  vacantes: VacanteFiltrar[];
}

interface Grupo {
  id: string;
  titulo: string;
  ayuda: string;
  subgrupos: Subgrupo[];
}

/** Bloque de provincias: son dos listas independientes, no una compartida. */
type Bloque = 'obligatorias' | 'voluntarias';

/**
 * Paso 3 · Filtrar (opcional). Lo único que quita plazas de la lista.
 *
 * Y solo quita voluntarias: una obligatoria filtrada seguiría pudiendo serte
 * adjudicada sin que la hubieras visto, así que el core la mantiene dentro
 * pase lo que pase (punto 1). Aquí eso se dice en voz alta, no en letra pequeña.
 *
 * Dos decisiones de estructura que sostienen toda la pantalla:
 *
 *  1. Lo que el usuario elige son VACANTES, no grupos. La selección vive en un
 *     único sitio, `config.vacantesDescartadas`, indexada por id de vacante. Los
 *     grupos y subgrupos son solo maneras de mirar la misma lista: por eso
 *     quitar una vacante en "Jornada completa" la quita también en "Cupo sin
 *     titular", sin sincronizar nada.
 *  2. Nada se recalcula solo. El límite "hasta N" y las provincias escriben en esa
 *     lista en el momento en que los tocas y ahí acaba su efecto; después mandan
 *     tus checks. Así ni reaparecen plazas ni se mueven los contadores solos.
 */
@Component({
  selector: 'tp-filtrar',
  standalone: true,
  imports: [AvisoTrayectoComponent],
  template: `
    <h1>Filtrar <span class="etiqueta-opcional">opcional</span></h1>
    <p class="lead">
      Este es el único paso que <strong>elimina</strong> plazas de tu lista.
      Si no tocas nada, no se descarta ninguna.
    </p>

    <p class="aviso-fuerte">
      Las plazas obligatorias nunca se filtran: siempre entran en tu lista.
    </p>
    <div class="fila-aviso">
      <p class="fuente" style="margin:0;">Trayectos de ida en coche.</p>
      @if (config.unidad() === 'min') { <tp-aviso-trayecto /> }
    </div>
    @if (estado.calculandoTrayectos()) {
      <p role="status">Calculando kilómetros y minutos por carretera…</p>
    } @else if (!config.ubicacion()) {
      <p class="fuente">Comprueba tu dirección en Perfil para calcular los trayectos.</p>
    } @else if (estado.errorTrayectos()) {
      <p role="status">{{ estado.errorTrayectos() }}</p>
      <button type="button" class="secundario" (click)="estado.cargarTrayectos()">Reintentar trayectos</button>
    }

    @if (!vacantes().length) {
      <div class="card">
        <p class="fuente">
          Todavía no hay vacantes tuyas que filtrar. Vuelve al paso 1, sube el PDF
          de vacantes y pulsa <strong>Descubrir</strong>: aquí verás entonces cada
          plaza con su centro, su jornada y su causa.
        </p>
      </div>
    }

    <!-- ── 1 · Plazas obligatorias ────────────────────────────────────── -->
    <div class="card">
      <div class="fila">
        <button type="button" class="banda" (click)="alternarAbierto('obligatorias')"
                [attr.aria-expanded]="abierto('obligatorias')">
          <strong class="titulo-seccion">Plazas obligatorias</strong>
          <span class="estado">{{ obligatoriasElegidas() }} de {{ obligatorias().length }}</span>
        </button>
        <span class="ayuda">
          <button type="button" class="icono-info" (click)="alternarAyuda('obligatorias')"
                  [attr.aria-expanded]="ayuda() === 'obligatorias'"
                  aria-label="Qué son las plazas obligatorias">i</button>
          <span class="globo" [class.abierto]="ayuda() === 'obligatorias'">
            Provincias en las que estás en lista. Las plazas de una provincia que
            desmarques no son tuyas y no entrarán. Son solo las obligatorias:
            marcar o desmarcar aquí no toca las voluntarias.
          </span>
        </span>
        <button type="button" class="icono-flecha" [class.cerrado]="!abierto('obligatorias')"
                (click)="alternarAbierto('obligatorias')"
                [attr.aria-expanded]="abierto('obligatorias')"
                aria-label="Desplegar las plazas obligatorias">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6" /></svg>
        </button>
      </div>
      @if (abierto('obligatorias')) {
      @if (provincias().length) {
        <div class="provincias">
          @for (p of provincias(); track p) {
            <label class="check">
              <input type="checkbox" [checked]="provinciaMarcada('obligatorias', p)"
                     (change)="alternarProvincia('obligatorias', p)" />
              {{ p }}
              <span class="badge">{{ cuantasEn(obligatorias(), p) }}</span>
            </label>
          }
        </div>
      } @else {
        <p class="fuente">Importa una convocatoria en el paso 1 para elegir provincias.</p>
      }
      }
    </div>

    <!-- ── 2 · Plazas voluntarias y sus grupos ────────────────────────── -->
    <div class="card">
      <div class="cab-grupo">
        <input type="checkbox" [checked]="config.voluntarias()"
               (change)="config.voluntarias.set(!config.voluntarias())"
               aria-label="Quiero que entren plazas voluntarias" />
        <button type="button" class="banda" (click)="alternarAbierto('voluntarias')"
                [attr.aria-expanded]="abierto('voluntarias')">
          <h2>Plazas voluntarias</h2>
        </button>
        <span class="ayuda">
          <button type="button" class="icono-info" (click)="alternarAyuda('voluntarias')"
                  [attr.aria-expanded]="ayuda() === 'voluntarias'"
                  aria-label="Qué son las plazas voluntarias">i</button>
          <span class="globo" [class.abierto]="ayuda() === 'voluntarias'">
            Las voluntarias son las que puedes rechazar. Lo que dejes sin marcar
            aquí no entrará en tu lista; las obligatorias siguen entrando siempre.
          </span>
        </span>
        <button type="button" class="icono-flecha" [class.cerrado]="!abierto('voluntarias')"
                (click)="alternarAbierto('voluntarias')"
                [attr.aria-expanded]="abierto('voluntarias')"
                aria-label="Desplegar las plazas voluntarias">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6" /></svg>
        </button>
      </div>

      @if (!config.voluntarias()) {
        <p class="fuente">Sin plazas voluntarias no hay nada más que filtrar: tu lista tendrá
          solo las obligatorias.</p>
      } @else if (abierto('voluntarias')) {
        @if (provincias().length) {
          <div class="provincias">
            @for (p of provincias(); track p) {
              <label class="check">
                <input type="checkbox" [checked]="provinciaMarcada('voluntarias', p)"
                       (change)="alternarProvincia('voluntarias', p)" />
                {{ p }}
                <span class="badge">{{ cuantasEn(voluntarias(), p) }}</span>
              </label>
            }
          </div>
        }

        @for (grupo of grupos(); track grupo.id) {
          <div class="grupo" [class.tocado]="tocado(grupo.id, grupo.subgrupos)">
            <span class="acento" aria-hidden="true"></span>
            <div class="cuerpo">
              <div class="fila">
                <input type="checkbox" [checked]="todasElegidas(grupo.subgrupos)"
                       [indeterminate]="algunaElegida(grupo.subgrupos) && !todasElegidas(grupo.subgrupos)"
                       (change)="alternarGrupo(grupo.subgrupos)"
                       [attr.aria-label]="'Marcar todo ' + grupo.titulo" />
                <button type="button" class="banda" (click)="alternarAbierto(grupo.id)"
                        [attr.aria-expanded]="abierto(grupo.id)">
                  <span class="titulo">
                    <strong>{{ grupo.titulo }}</strong>
                    <span class="medida">
                      <span class="barra" aria-hidden="true">
                        <span [style.width.%]="porcentaje(grupo.subgrupos)"></span>
                      </span>
                      <span class="cuenta">{{ elegidasDe(grupo.subgrupos) }} de {{ totalDe(grupo.subgrupos) }}</span>
                    </span>
                  </span>
                </button>
                <span class="limite" [class.puesto]="limiteTexto(grupo.id)">
                  hasta
                  <input #limiteGrupo type="number" min="0" placeholder="—"
                         [disabled]="estado.calculandoTrayectos() || !config.ubicacion()"
                         [value]="limiteTexto(grupo.id)"
                         (change)="aplicarLimite(grupo.id, vacantesDe(grupo.subgrupos), limiteGrupo.valueAsNumber)"
                         [attr.aria-label]="'Trayecto máximo para ' + grupo.titulo" />
                  {{ config.unidadLarga() }}
                </span>
                <span class="ayuda">
                  <button type="button" class="icono-info" (click)="alternarAyuda(grupo.id)"
                          [attr.aria-expanded]="ayuda() === grupo.id"
                          [attr.aria-label]="'Qué es ' + grupo.titulo">i</button>
                  <span class="globo" [class.abierto]="ayuda() === grupo.id">{{ grupo.ayuda }}</span>
                </span>
                <button type="button" class="icono-flecha" [class.cerrado]="!abierto(grupo.id)"
                        (click)="alternarAbierto(grupo.id)"
                        [attr.aria-expanded]="abierto(grupo.id)"
                        [attr.aria-label]="'Desplegar ' + grupo.titulo">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                </button>
              </div>

            @if (abierto(grupo.id)) {
              @if (grupo.id === 'jornada') {
                <div class="filtro-extra">
                  <label [attr.for]="'jornada-min'">Quedarme solo con jornadas de al menos</label>
                  <span class="campo" [class.puesto]="config.jornadaMinima() != null">
                    <input id="jornada-min" #jornadaMin type="number" min="0" max="100" step="5"
                           placeholder="—" [value]="config.jornadaMinima() ?? ''"
                           (change)="aplicarJornadaMinima(vacantesDe(grupo.subgrupos), jornadaMin.valueAsNumber)" />
                    %
                  </span>
                </div>
              }
              @for (sub of grupo.subgrupos; track sub.id) {
                <div class="subgrupo">
                  <div class="fila">
                    <input type="checkbox" [checked]="todasElegidas([sub])"
                           [indeterminate]="algunaElegida([sub]) && !todasElegidas([sub])"
                           (change)="alternarGrupo([sub])"
                           [attr.aria-label]="'Marcar todo ' + sub.etiqueta" />
                    <button type="button" class="banda" (click)="alternarAbierto(sub.id)"
                            [attr.aria-expanded]="abierto(sub.id)">
                      <span class="etiqueta-sub">{{ sub.etiqueta }}</span>
                      <span class="cuenta">{{ elegidasDe([sub]) }} de {{ sub.vacantes.length }}</span>
                    </button>
                    <span class="limite" [class.puesto]="limiteTexto(sub.id)">
                      hasta
                      <input #limiteSub type="number" min="0" placeholder="—"
                             [disabled]="estado.calculandoTrayectos() || !config.ubicacion()"
                             [value]="limiteTexto(sub.id)"
                             (change)="aplicarLimite(sub.id, sub.vacantes, limiteSub.valueAsNumber)"
                             [attr.aria-label]="'Trayecto máximo para ' + sub.etiqueta" />
                      {{ config.unidadLarga() }}
                    </span>
                    <button type="button" class="icono-flecha" [class.cerrado]="!abierto(sub.id)"
                            (click)="alternarAbierto(sub.id)"
                            [attr.aria-expanded]="abierto(sub.id)"
                            [attr.aria-label]="'Desplegar ' + sub.etiqueta">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                           stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                    </button>
                  </div>

                  @if (abierto(sub.id)) {
                    @for (v of sub.vacantes; track v.id) {
                      <div class="vacante">
                        <input type="checkbox" [checked]="elegida(v.id)"
                               (change)="alternarVacante(v.id)"
                               [attr.aria-label]="'Mantener ' + v.centro" />
                        <div class="datos">
                          <span class="identidad">
                            <strong>{{ v.centro }}</strong>
                            <span class="donde">{{ v.localidad }}@if (v.provincia) { · {{ v.provincia }} }</span>
                            <span class="num">vac. {{ v.numero }}</span>
                          </span>
                          <span class="badges">
                            <span class="badge esp">{{ v.especialidad }}</span>
                            <span class="badge jor">{{ v.jornadaCorta }}</span>
                            @for (e of etiquetas(v.id); track e) {
                              <span class="badge cond">{{ e }}</span>
                            }
                            @if (v.causa) { <span class="badge causa">{{ v.causa }}</span> }
                          </span>
                          @if (v.info) { <span class="info" [title]="v.info">{{ v.info }}</span> }
                        </div>
                        <span class="trayecto">
                          @if (v.trayecto == null) {
                            sin calcular
                          } @else {
                            {{ v.trayecto }} {{ config.unidad() }}
                          }
                        </span>
                      </div>
                    }
                  }
                </div>
              }
            }
            </div>
          </div>
        }

        @if (!grupos().length && vacantes().length) {
          <p class="fuente">Ninguna plaza voluntaria en las provincias que has marcado.</p>
        }
      }
    </div>

    <!-- ── 3 · Localidades y centros excluidos ────────────────────────────
         Un solo nivel y un solo buscador. Antes eran dos tarjetas gemelas con
         su desplegable, su párrafo y su lista completa: para excluir "Zaragoza"
         había que saber de antemano si era localidad o centro y abrir la caja
         correcta. Aquí se escribe y salen las dos cosas, agrupadas. Y lo
         excluido se ve como chips: la ausencia de chips ya es el estado vacío,
         no hace falta una frase que lo diga. -->
    <div class="card">
      <div class="fila">
        <button type="button" class="banda" (click)="alternarAbierto('excluidos')"
                [attr.aria-expanded]="abierto('excluidos')">
          <strong class="titulo-seccion">Localidades y centros excluidos</strong>
          <span class="estado" [class.puesto]="totalExcluidos()">{{ textoExcluidos() }}</span>
        </button>
        <button type="button" class="icono-flecha" [class.cerrado]="!abierto('excluidos')"
                (click)="alternarAbierto('excluidos')"
                [attr.aria-expanded]="abierto('excluidos')"
                aria-label="Desplegar localidades y centros excluidos">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6" /></svg>
        </button>
      </div>

      @if (abierto('excluidos')) {
        @if (municipiosDisponibles().length || centrosDisponibles().length || totalExcluidos()) {
          <div class="buscador">
            <span class="lupa" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            </span>
            <input type="text" [value]="busquedaExcluir()"
                   (input)="busquedaExcluir.set($any($event.target).value)"
                   placeholder="Excluir una localidad o un centro…"
                   aria-label="Buscar una localidad o un centro para excluir" />
            @if (busquedaExcluir()) {
              <button type="button" class="limpiar" (click)="busquedaExcluir.set('')"
                      aria-label="Borrar la búsqueda">✕</button>
            }
          </div>

          @if (busquedaExcluir()) {
            <div class="sugerencias">
              @if (municipiosSugeridos().length) {
                <p class="seccion">Localidades</p>
                @for (m of municipiosSugeridos(); track m) {
                  <button type="button" class="sug" (click)="anadirMunicipio(m); busquedaExcluir.set('')">
                    {{ m }}
                  </button>
                }
              }
              @if (centrosSugeridos().length) {
                <p class="seccion">Centros</p>
                @for (c of centrosSugeridos(); track c.code) {
                  <button type="button" class="sug" (click)="anadirCentro(c.code); busquedaExcluir.set('')">
                    {{ c.name }} <span class="donde">{{ c.municipality }}</span>
                  </button>
                }
              }
              @if (!municipiosSugeridos().length && !centrosSugeridos().length) {
                <p class="sin-resultados">Nada con ese nombre en esta convocatoria.</p>
              }
            </div>
          }

          @if (totalExcluidos()) {
            <div class="chips">
              @for (m of config.municipiosExcluidos(); track m) {
                <span class="chip fuera">
                  {{ m }} <span class="tipo">localidad</span>
                  <button type="button" class="quitar" (click)="quitarMunicipio(m)"
                          [attr.aria-label]="'Dejar de excluir ' + m">✕</button>
                </span>
              }
              @for (code of config.centrosExcluidos(); track code) {
                <span class="chip fuera">
                  {{ nombreCentro(code) }} <span class="tipo">centro</span>
                  <button type="button" class="quitar" (click)="quitarCentro(code)"
                          [attr.aria-label]="'Dejar de excluir ' + nombreCentro(code)">✕</button>
                </span>
              }
            </div>
          }

          <p class="fuente">Ninguna vacante de lo que excluyas entrará en tu lista, sea
            obligatoria o voluntaria. Están todas las de la convocatoria, no solo las que
            hoy tienen plaza de lo tuyo.</p>
        } @else {
          <p class="fuente">Importa una convocatoria en el paso 1 para poder excluir.</p>
        }
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
  `,
  styles: [
    `
      .cab-grupo { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .cab-grupo h2 { margin: 0; flex: 1; }
      .cuenta { font-size: 12.5px; color: var(--tinta-suave); white-space: nowrap; }

      /* Una tarjeta por grupo. La franja de la izquierda se tiñe cuando ya has
         recortado algo ahí dentro, para reconocerlo sin abrirlo. */
      .grupo { display: flex; background: #fff; border: 1px solid var(--linea);
               border-radius: var(--radio); margin: 9px 0 0; }
      .grupo .acento { flex: none; width: 4px; align-self: stretch;
                       border-radius: var(--radio) 0 0 var(--radio); background: var(--linea); }
      .grupo.tocado .acento { background: var(--acierto); }
      .grupo .cuerpo { flex: 1; min-width: 0; }
      .subgrupo { background: #faf9f5; border-radius: 8px; margin: 5px 12px 0 10px; padding: 2px 10px; }

      .fila { display: flex; align-items: center; gap: 8px; padding: 7px 12px 7px 10px; }
      .subgrupo .fila { padding: 0; }

      /* Toda la banda del título abre y cierra. Antes solo lo hacía la flecha:
         26 px de diana para una fila entera. La casilla, el límite y la "i"
         quedan FUERA de este botón; si estuvieran dentro serían botones dentro
         de un botón, y pulsarlos desplegaría el grupo sin querer. */
      .banda { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0;
               min-height: 44px; margin: 0 -8px; padding: 0 8px; border: none;
               background: transparent; border-radius: 8px; cursor: pointer;
               font: inherit; color: inherit; text-align: left; }
      .banda:hover { background: #f2f1ec; }
      .banda h2 { margin: 0; flex: 1; min-width: 0; }
      .banda .titulo { display: flex; flex-direction: column; flex: 1; min-width: 0; line-height: 1.3; }
      .banda strong { font-size: 15px; }
      .banda .medida { display: flex; align-items: center; gap: 7px; margin-top: 3px; }
      .banda .barra { flex: none; width: 44px; height: 4px; border-radius: 999px;
                      background: #eceae3; overflow: hidden; }
      .banda .barra > span { display: block; height: 4px; border-radius: 999px; background: var(--acierto); }
      .subgrupo .etiqueta-sub { flex: 1; min-width: 0; font-size: 14.5px; }

      /* El límite se enseña con su etiqueta y su unidad SIEMPRE, tenga valor o no:
         una pastilla con el valor dentro se lee como etiqueta de estado, algo que
         no se toca, y este es un campo. Y sin la unidad a la vista, un recuadro
         vacío no dice si espera minutos o kilómetros. */
      .limite { flex: none; display: inline-flex; align-items: center; gap: 5px;
                font-size: 12.5px; color: var(--tinta-suave); white-space: nowrap; }
      .limite input { width: 56px; padding: 4px 6px; font-size: 13px; text-align: center; }
      .limite.puesto { color: var(--acierto); font-weight: 600; }
      .limite.puesto input { border-color: var(--acierto); color: var(--acierto); font-weight: 600; }

      /* Filtro propio de un grupo (hoy solo Jornada). Va dentro del desplegable
         y no en la cabecera: allí ya hay cinco controles peleando por el ancho. */
      .filtro-extra { display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
                      background: #faf9f5; border: 1px solid #eceae3; border-radius: 8px;
                      margin: 5px 12px 0 10px; padding: 8px 11px;
                      font-size: 13.5px; color: var(--tinta-suave); }
      .filtro-extra label { margin: 0; font-size: 13.5px; font-weight: 400; }
      .filtro-extra .campo { display: inline-flex; align-items: center; gap: 5px; }
      .filtro-extra input { width: 62px; padding: 4px 6px; font-size: 13px; text-align: center; }
      .filtro-extra .campo.puesto { color: var(--acierto); font-weight: 600; }
      .filtro-extra .campo.puesto input { border-color: var(--acierto); color: var(--acierto); font-weight: 600; }

      /* Ayuda: globo al pasar el ratón donde hay ratón, y al tocar en móvil.
         Sin el @media, en táctil el :hover se queda pegado tras el toque. */
      .ayuda { position: relative; display: inline-flex; flex: none; }
      .globo { position: absolute; right: -4px; top: calc(100% + 9px); width: 236px; z-index: 5;
               background: var(--pizarra-oscura); color: var(--tiza); font-size: 12.5px;
               line-height: 1.5; border-radius: 9px; padding: 9px 12px; text-align: left;
               text-wrap: pretty; opacity: 0; visibility: hidden; transition: opacity 0.12s ease; }
      .globo::before { content: ""; position: absolute; right: 12px; top: -5px; width: 10px;
                       height: 10px; background: var(--pizarra-oscura); transform: rotate(45deg); }
      @media (hover: hover) { .ayuda:hover .globo { opacity: 1; visibility: visible; } }
      .globo.abierto { opacity: 1; visibility: visible; }

      .icono-info, .icono-flecha {
        flex: none; width: 26px; height: 26px; padding: 0; border-radius: 50%;
        background: transparent; color: var(--tinta-suave); border: 1px solid var(--linea);
        font-size: 13px; line-height: 1; display: inline-flex; align-items: center;
        justify-content: center;
      }
      .icono-info:hover, .icono-flecha:hover { background: #f0efe9; color: var(--tinta); }
      .icono-flecha { border: none; width: 30px; height: 30px; }
      .icono-flecha svg { transition: transform 0.16s ease; }
      .icono-flecha.cerrado svg { transform: rotate(-90deg); }
      .titulo-seccion { flex: 1; min-width: 0; font-size: 16px; }
      .estado { flex: none; font-size: 12px; font-weight: 600; border-radius: 999px;
                padding: 2px 10px; background: #f0efe9; color: var(--tinta-suave); white-space: nowrap; }
      .estado.puesto { background: var(--descarte-bg); color: var(--descarte); }

      /* Un solo buscador para localidades y centros. */
      .buscador { display: flex; align-items: center; gap: 8px; border: 1px solid var(--linea);
                  border-radius: 9px; background: #fff; padding: 0 11px; min-height: 42px; margin: 2px 0 8px; }
      .buscador:focus-within { border-color: var(--pizarra); box-shadow: 0 0 0 3px rgba(35,68,60,.10); }
      .buscador .lupa { flex: none; color: var(--tinta-suave); line-height: 0; }
      .buscador input { flex: 1; min-width: 0; border: none; outline: none; background: transparent;
                        font: inherit; font-size: 14.5px; padding: 9px 0; }
      .buscador .limpiar { flex: none; border: none; background: transparent; color: var(--tinta-suave);
                           font-size: 13px; cursor: pointer; padding: 4px; line-height: 1; }
      .sugerencias { border: 1px solid var(--linea); border-radius: 9px; padding: 5px; margin-bottom: 8px; }
      .sugerencias .seccion { font-size: 10.5px; font-weight: 700; letter-spacing: 0.07em;
                              text-transform: uppercase; color: #9a9d97; margin: 0; padding: 6px 9px 3px; }
      .sug { display: flex; align-items: center; gap: 9px; width: 100%; min-height: 38px;
             padding: 0 9px; border: none; background: transparent; border-radius: 7px;
             font: inherit; font-size: 14.5px; color: var(--tinta); text-align: left; cursor: pointer; }
      .sug:hover { background: #f2f1ec; }
      .sug .donde { color: var(--tinta-suave); font-size: 12.5px; }
      .sin-resultados { font-size: 13px; color: var(--tinta-suave); margin: 0; padding: 8px 9px; }
      .chip .tipo { font-weight: 500; opacity: .7; margin-left: 4px; }

      .provincias { display: flex; gap: 14px; flex-wrap: wrap; margin: 4px 0 2px; }
      /* Menos aire: se recorta el relleno de tarjeta y las separaciones, nunca la
         zona pulsable (la banda mantiene sus 44 px, que es el mínimo para el dedo). */
      .card { padding: 8px 16px; margin-bottom: 8px; }
      .provincias .check { margin: 0; }
      .badge { font-size: 12px; color: var(--tinta-suave); }
      /* Ficha de vacante: una línea de identidad y el resto en badges. Antes eran
         cinco líneas de texto apiladas y no se podía barrer la lista de un
         vistazo; lo que distingue a una plaza de otra son sus condiciones, y una
         condición se reconoce antes como etiqueta de color que como frase. */
      .vacante {
        display: flex; gap: 10px; align-items: flex-start;
        background: #fff; border-radius: 8px; padding: 9px 11px; margin: 5px 0;
      }
      .vacante .datos { display: flex; flex-direction: column; gap: 5px; min-width: 0; flex: 1; }
      .identidad { display: flex; align-items: baseline; gap: 7px; flex-wrap: wrap; line-height: 1.25; }
      .identidad strong { font-size: 13.5px; }
      .identidad .donde { font-size: 12.5px; color: var(--tinta-suave); }
      .identidad .num { font-size: 11px; color: #9a9d97; font-weight: 600; }
      .badges { display: flex; flex-wrap: wrap; gap: 5px; }
      .badge {
        font-size: 11.5px; font-weight: 600; line-height: 1.5;
        border-radius: 999px; padding: 1px 9px; white-space: nowrap;
      }
      .badge.esp { background: #ece7f7; color: #5b3e96; }
      .badge.jor { background: var(--acierto-bg); color: var(--acierto); }
      .badge.cond { background: #e8f0f6; color: #3d6a8a; }
      .badge.causa { background: #f0efe9; color: var(--tinta-suave); font-weight: 500; }
      /* El texto crudo del PDF se deja a dos líneas: sirve para confirmar, no
         para leerlo entero en la lista. El resto está en el title. */
      .vacante .info {
        font-size: 11.5px; color: var(--tinta-suave); font-style: italic; line-height: 1.35;
        display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
      }
      .vacante .trayecto {
        flex: none; font-size: 12px; font-weight: 600; color: var(--acierto);
        white-space: nowrap; padding-top: 1px;
      }
    `
  ]
})
export class FiltrarComponent {
  readonly estado = inject(EstadoService);
  readonly config = inject(ConfiguracionService);
  private readonly router = inject(Router);

  /** Qué grupos, subgrupos y tarjetas están desplegados. Nunca lo toca un check. */
  private readonly desplegados = signal<ReadonlySet<string>>(new Set(['voluntarias']));
  /** Lo escrito en el buscador de exclusiones. */
  readonly busquedaExcluir = signal('');

  /** Cuántas cosas hay excluidas, de los dos tipos juntos. */
  readonly totalExcluidos = computed(() =>
    this.config.municipiosExcluidos().length + this.config.centrosExcluidos().length
  );

  /** El badge de la cabecera: dice el número, no hace falta una frase debajo. */
  textoExcluidos(): string {
    const n = this.totalExcluidos();
    return n === 0 ? 'nada excluido' : n === 1 ? '1 excluido' : `${n} excluidos`;
  }

  /**
   * Sugerencias del buscador. Un solo campo para localidades y centros: quien
   * quiere quitarse "Zaragoza" de encima no tiene por qué saber antes si eso
   * es una localidad o un centro; escribe y elige de la lista agrupada.
   */
  readonly municipiosSugeridos = computed(() => {
    const q = this.normalizar(this.busquedaExcluir());
    if (!q) return [];
    return this.municipiosDisponibles().filter(m => this.normalizar(m).includes(q)).slice(0, 6);
  });

  readonly centrosSugeridos = computed(() => {
    const q = this.normalizar(this.busquedaExcluir());
    if (!q) return [];
    return this.centrosDisponibles()
      .filter(c => this.normalizar(`${c.name} ${c.municipality}`).includes(q))
      .slice(0, 6);
  });

  /** Sin tildes ni mayúsculas: "sariñena" tiene que encontrar "Sariñena". */
  private normalizar(texto: string): string {
    return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  /** Qué icono "i" está abierto; solo uno a la vez. */
  readonly ayuda = signal<string | null>(null);

  constructor() {
    effect(() => {
      this.config.ubicacion();
      this.estado.vacantesDelUsuario();
      untracked(() => void this.estado.cargarTrayectos());
    });
    // Las provincias arrancan todas marcadas: entrar en el paso no puede
    // descartar nada por su cuenta.
    const todas = this.estado.provinciasDeConvocatoria();
    if (todas.length) {
      if (this.config.provinciasObligatorias() === null) {
        this.config.provinciasObligatorias.set([...todas]);
      }
      if (this.config.provinciasVoluntarias() === null) {
        this.config.provinciasVoluntarias.set([...todas]);
      }
    }
    // Y las condiciones arrancan aceptadas, coherentes con "no has descartado
    // nada todavía": sin esto el core excluiría por condiciones sin decidir.
    this.sincronizarAcepta();
  }

  // ── Datos de partida ───────────────────────────────────────────────────
  /** Tus vacantes, con el trayecto ya resuelto en la unidad de tu perfil. */
  readonly vacantes = computed<VacanteFiltrar[]>(() => {
    const rutas = this.estado.trayectos();
    const km = this.config.modo() === 'km';
    return this.estado.vacantesDelUsuario().map(v => {
      // Por código de centro, no por id: estas vacantes salen del PDF en el
      // navegador (`ara-<numero>`) y la API las tiene con su propio id.
      const ruta = rutas[claveCentroTrayecto(v.centerCode) ?? ''];
      const trayecto = ruta ? (km ? ruta.distanceKm : ruta.travelMinutes) : null;
      return {
        id: v.id,
        centro: v.centerName,
        localidad: v.municipality,
        provincia: v.province ?? '',
        especialidad: v.specialtyName,
        jornada: this.textoJornada(v),
        jornadaPct: v.workload == null ? null : Math.round(v.workload * 100),
        numero: v.id.replace(/^ara-/, ''),
        jornadaCorta: v.workload != null && v.workload >= 1 ? 'Comp.' : this.etiquetaJornada(v),
        causa: v.causa ? this.etiquetaCausa(v.causa) : '',
        info: v.additionalInfoRaw ?? '',
        trayecto
      };
    });
  });

  /**
   * Condiciones de cada vacante como lista de etiquetas cortas. Son exactamente
   * las que la clasifican en los subgrupos, así que la ficha y el filtro dicen
   * lo mismo: si una plaza lleva el badge "PAI", está en el subgrupo PAI.
   */
  private readonly etiquetasPorId = computed(() => {
    const mapa = new Map<string, string[]>();
    const requisitos = this.requisitosPorId();
    for (const original of this.estado.vacantesDelUsuario()) {
      const etiquetas: string[] = [];
      const anadir = (e: string) => { if (e && !etiquetas.includes(e)) etiquetas.push(e); };
      if (this.esOrientacion(original.specialtyName)) anadir('Orientación');
      for (const req of requisitos.get(original.id) ?? []) {
        if (!req.required) continue;
        const etiqueta = this.etiquetaRequisito(req.label);
        if (req.category === 'asignatura' && !this.etiquetaUtil(etiqueta)) continue;
        anadir(etiqueta);
      }
      mapa.set(original.id, etiquetas);
    }
    return mapa;
  });

  /** Las etiquetas de una vacante, para pintar sus badges. */
  etiquetas(id: string): string[] {
    return this.etiquetasPorId().get(id) ?? [];
  }

  /** Índice id → vacante importada, para clasificar sin volver a buscar. */
  private readonly porId = computed(() => {
    const mapa = new Map<string, VacanteImportada>();
    for (const v of this.estado.vacantesDelUsuario()) mapa.set(v.id, v);
    return mapa;
  });

  /**
   * Requisitos reales de cada vacante: los que trae la ficha (compartida,
   * perfilada…) más los que salen de su información adicional. Se extraen igual
   * que en el import de la API, con la misma función del core, para que los
   * códigos de aquí sean los mismos que luego evalúa el motor de reglas.
   */
  private readonly requisitosPorId = computed(() => {
    const mapa = new Map<string, VacancyRequirement[]>();
    for (const v of this.estado.vacantesDelUsuario()) {
      const extra = extractFromAdditionalInfo(v.additionalInfoRaw).requirements;
      mapa.set(v.id, [...v.requirements, ...extra]);
    }
    return mapa;
  });

  readonly provincias = computed(() => this.estado.provinciasDeConvocatoria());

  readonly obligatorias = computed(() =>
    this.deBloque('obligatorias', false)
  );
  readonly voluntarias = computed(() => this.deBloque('voluntarias', true));

  /**
   * Vacantes de un bloque, ya sin las que el usuario ha descartado por
   * localidad o por centro.
   *
   * Excluir una localidad y seguir viendo sus plazas marcadas es contradictorio:
   * le has dicho al sistema que ahí no vas. Se filtran aquí, que es el único
   * sitio por el que pasan todas las vacantes de la pantalla, para que
   * contadores, subgrupos y límites cuadren sin tener que acordarse en cada uno.
   */
  private deBloque(bloque: Bloque, voluntary: boolean): VacanteFiltrar[] {
    const marcadas = this.provinciasDe(bloque);
    const porId = this.porId();
    const municipiosFuera = new Set(this.config.municipiosExcluidos());
    const centrosFuera = new Set(this.config.centrosExcluidos());
    return this.vacantes().filter(v => {
      const original = porId.get(v.id);
      if (!original || original.voluntary !== voluntary) return false;
      if (original.municipality && municipiosFuera.has(original.municipality)) return false;
      if (original.centerCode && centrosFuera.has(original.centerCode)) return false;
      return !v.provincia || marcadas === null || marcadas.includes(v.provincia);
    });
  }

  // ── Selección: una sola lista, indexada por id ─────────────────────────
  private readonly descartadas = computed(() => new Set(this.config.vacantesDescartadas()));

  elegida(id: string): boolean {
    return !this.descartadas().has(id);
  }

  elegidasDe(subgrupos: Subgrupo[]): number {
    const fuera = this.descartadas();
    return this.idsDe(subgrupos).filter(id => !fuera.has(id)).length;
  }

  totalDe(subgrupos: Subgrupo[]): number {
    return this.idsDe(subgrupos).length;
  }

  todasElegidas(subgrupos: Subgrupo[]): boolean {
    const total = this.totalDe(subgrupos);
    return total > 0 && this.elegidasDe(subgrupos) === total;
  }

  algunaElegida(subgrupos: Subgrupo[]): boolean {
    return this.elegidasDe(subgrupos) > 0;
  }

  obligatoriasElegidas(): number {
    const fuera = this.descartadas();
    return this.obligatorias().filter(v => !fuera.has(v.id)).length;
  }

  cuantasEn(vacantes: VacanteFiltrar[], provincia: string): number {
    return vacantes.filter(v => v.provincia === provincia).length;
  }

  vacantesDe(subgrupos: Subgrupo[]): VacanteFiltrar[] {
    const vistas = new Map<string, VacanteFiltrar>();
    for (const sub of subgrupos) for (const v of sub.vacantes) vistas.set(v.id, v);
    return [...vistas.values()];
  }

  /** Una vacante puede estar en varios subgrupos: se cuenta una sola vez. */
  private idsDe(subgrupos: Subgrupo[]): string[] {
    const ids = new Set<string>();
    for (const sub of subgrupos) for (const v of sub.vacantes) ids.add(v.id);
    return [...ids];
  }

  alternarVacante(id: string): void {
    const fuera = new Set(this.config.vacantesDescartadas());
    fuera.has(id) ? fuera.delete(id) : fuera.add(id);
    this.guardarDescartadas(fuera);
  }

  /** Todo dentro si falta alguna; todo fuera si ya estaban todas. */
  alternarGrupo(subgrupos: Subgrupo[]): void {
    const quitar = this.todasElegidas(subgrupos);
    const fuera = new Set(this.config.vacantesDescartadas());
    for (const id of this.idsDe(subgrupos)) quitar ? fuera.add(id) : fuera.delete(id);
    this.guardarDescartadas(fuera);
  }

  /** Lo escrito en la casilla del límite; vacío mientras no haya ninguno. */
  limiteTexto(grupoId: string): string {
    const valor = this.config.limitesGrupo()[grupoId];
    return valor == null ? '' : String(valor);
  }

  /**
   * Jornada mínima: reparte las vacantes de Jornada según sus horas reales, del
   * mismo modo que el límite de trayecto y con la misma filosofía — es una
   * acción que se ejecuta al escribirla, no un filtro permanente, así que
   * después puedes volver a marcar a mano lo que quieras.
   *
   * Las que no dicen su jornada no se tocan: no vamos a descartar una plaza por
   * un dato que la convocatoria no da.
   */
  aplicarJornadaMinima(vacantes: VacanteFiltrar[], valor: number | null): void {
    const minimo = valor == null || Number.isNaN(valor) ? null : Number(valor);
    this.config.jornadaMinima.set(minimo);
    if (minimo == null || minimo <= 0) return;
    const fuera = new Set(this.config.vacantesDescartadas());
    for (const v of vacantes) {
      if (v.jornadaPct == null) continue;
      v.jornadaPct >= minimo ? fuera.delete(v.id) : fuera.add(v.id);
    }
    this.guardarDescartadas(fuera);
  }

  /** Cuánto queda del grupo, para la barrita de la cabecera. */
  porcentaje(subgrupos: Subgrupo[]): number {
    const total = this.totalDe(subgrupos);
    return total === 0 ? 0 : Math.round((this.elegidasDe(subgrupos) / total) * 100);
  }

  /**
   * Si el usuario ya ha recortado algo en este grupo, por límite o a mano. Lo
   * dice la franja de color de la tarjeta, para no tener que abrir uno a uno
   * para saber cuáles tocaste.
   */
  tocado(grupoId: string, subgrupos: Subgrupo[]): boolean {
    return Boolean(this.limiteTexto(grupoId)) || this.elegidasDe(subgrupos) < this.totalDe(subgrupos);
  }

  /**
   * El límite es una acción, no un filtro permanente: en el momento de
   * escribirlo reparte las vacantes del grupo según su trayecto real y ahí
   * termina. Después el usuario puede volver a marcar lo que quiera sin que
   * nada se lo deshaga. Las de trayecto desconocido no se tocan: no vamos a
   * descartar por una distancia que no hemos podido calcular.
   *
   * Se aplica al salir de la casilla, no en cada tecla: escribir "40" pasando
   * por "4" no puede llevarse por delante lo que ya habías marcado.
   */
  aplicarLimite(grupoId: string, vacantes: VacanteFiltrar[], valor: number | null): void {
    const limite = valor == null || Number.isNaN(valor) ? null : Number(valor);
    this.config.fijarLimitesGrupo({ ...this.config.limitesGrupo(), [grupoId]: limite });
    if (limite == null || !Number.isFinite(limite) || limite < 0 || this.estado.calculandoTrayectos()) return;
    const fuera = new Set(this.config.vacantesDescartadas());
    for (const v of vacantes) {
      if (v.trayecto == null) continue;
      v.trayecto <= limite ? fuera.delete(v.id) : fuera.add(v.id);
    }
    this.guardarDescartadas(fuera);
  }

  // ── Provincias: dos listas independientes ──────────────────────────────
  private provinciasDe(bloque: Bloque): string[] | null {
    return bloque === 'obligatorias'
      ? this.config.provinciasObligatorias()
      : this.config.provinciasVoluntarias();
  }

  provinciaMarcada(bloque: Bloque, provincia: string): boolean {
    const lista = this.provinciasDe(bloque);
    return lista === null || lista.includes(provincia);
  }

  /**
   * Marcar o desmarcar una provincia solo escribe en la lista de SU bloque y en
   * las vacantes de ese bloque. La otra lista no se lee ni se toca.
   */
  alternarProvincia(bloque: Bloque, provincia: string): void {
    const actuales = this.provinciasDe(bloque) ?? [...this.provincias()];
    const quitar = actuales.includes(provincia);
    const nuevas = quitar ? actuales.filter(p => p !== provincia) : [...actuales, provincia];
    if (bloque === 'obligatorias') this.config.provinciasObligatorias.set(nuevas);
    else this.config.provinciasVoluntarias.set(nuevas);

    const esVoluntaria = bloque === 'voluntarias';
    const fuera = new Set(this.config.vacantesDescartadas());
    for (const v of this.estado.vacantesDelUsuario()) {
      if (v.voluntary !== esVoluntaria || v.province !== provincia) continue;
      quitar ? fuera.add(v.id) : fuera.delete(v.id);
    }
    this.guardarDescartadas(fuera);
  }

  // ── Grupos y subgrupos ─────────────────────────────────────────────────
  /**
   * Cada vacante cae en los subgrupos que le correspondan por lo que dice su
   * ficha: la jornada, las horas en otras asignaturas, orientación, programas,
   * idiomas, FP y la causa de la vacante. Un subgrupo sin vacantes no existe:
   * la lista se construye desde las vacantes, no desde un catálogo fijo.
   */
  readonly grupos = computed<Grupo[]>(() => {
    const porId = this.porId();
    const cubos = new Map<string, Map<string, Subgrupo>>();
    const meter = (grupoId: string, subId: string, etiqueta: string, v: VacanteFiltrar) => {
      const grupo = cubos.get(grupoId) ?? new Map<string, Subgrupo>();
      cubos.set(grupoId, grupo);
      const sub: Subgrupo = grupo.get(subId) ?? { id: subId, etiqueta, vacantes: [] };
      if (!sub.vacantes.some(x => x.id === v.id)) sub.vacantes.push(v);
      grupo.set(subId, sub);
    };

    for (const v of this.voluntarias()) {
      const original = porId.get(v.id);
      if (!original) continue;

      // Jornada: toda vacante tiene una, es el desglose más básico. Un subgrupo
      // por jornada REAL, no un "Completa / Parcial": entre una plaza de 16 h y
      // una de 6 h no hay nada en común, y agrupándolas no se podía elegir.
      meter('jornada', `jornada:${this.claveJornada(original)}`, this.etiquetaJornada(original), v);

      // Causa de la vacante: cupo sin titular, plantilla, comisión-reserva…
      if (original.causa) {
        const etiqueta = this.etiquetaCausa(original.causa);
        meter('causa', `causa:${this.slug(etiqueta)}`, etiqueta, v);
      }

      // Orientación por especialidad, aparte de cualquier asignatura.
      if (this.esOrientacion(original.specialtyName)) {
        meter('orientacion', 'orientacion:especialidad', 'Plazas de Orientación', v);
      }

      for (const req of this.requisitosPorId().get(v.id) ?? []) {
        if (!req.required) continue;
        const etiqueta = this.etiquetaRequisito(req.label);
        if (this.esOrientacion(req.label) || req.code === 'apoyo') {
          meter('orientacion', `orientacion:${req.code}`, etiqueta, v);
        } else if (req.category === 'asignatura') {
          // Los segmentos sueltos del texto libre dejan restos ("o", "i", "o
          // Título Oficial…"): no son asignaturas y no merecen un subgrupo. La
          // vacante no desaparece por eso, sigue en jornada y en su causa.
          if (this.etiquetaUtil(etiqueta)) {
            meter('asignaturas', `asignatura:${req.code}`, etiqueta, v);
          }
        } else if (req.category === 'program') {
          meter('programas', `programa:${req.code}`, etiqueta, v);
        } else if (req.category === 'language') {
          meter('idiomas', `idioma:${req.code}`, etiqueta, v);
        } else if (req.category === 'fp') {
          meter('fp', `fp:${req.code}`, etiqueta, v);
        } else {
          // Horario, movilidad, titulación, duración: cada una con su texto real.
          meter('otras', `otra:${req.code}`, etiqueta, v);
        }
      }
    }

    const orden: { id: string; titulo: string; ayuda: string }[] = [
      {
        id: 'jornada',
        titulo: 'Jornada',
        ayuda: 'Completa o parcial, tal y como viene en la ficha de la vacante.'
      },
      {
        id: 'asignaturas',
        titulo: 'Horas en otras asignaturas',
        ayuda: 'Plazas de tu especialidad que además llevan horas de otra materia.'
      },
      {
        id: 'orientacion',
        titulo: 'Orientación',
        ayuda: 'Orientación y apoyo van aparte: no son horas de otra asignatura.'
      },
      {
        id: 'programas',
        titulo: 'Programas',
        ayuda: 'PAI, PROA+, diversificación y demás programas del centro.'
      },
      {
        id: 'idiomas',
        titulo: 'Idiomas',
        ayuda: 'Plazas que piden una titulación de idioma o son de programa bilingüe.'
      },
      { id: 'fp', titulo: 'FP', ayuda: 'Ciclos formativos, FP básica y FP dual.' },
      {
        id: 'causa',
        titulo: 'Condición de la vacante',
        ayuda: 'Por qué existe la plaza: cupo sin titular, plantilla definitiva sin ' +
          'titular o comisión de servicio con reserva de titular.'
      },
      {
        id: 'otras',
        titulo: 'Otras condiciones',
        ayuda: 'Horario, itinerancia, plaza compartida, entrevista, larga duración…'
      }
    ];

    return orden
      .map(g => ({
        ...g,
        subgrupos: [...(cubos.get(g.id)?.values() ?? [])]
          .filter(s => s.vacantes.length > 0)
          // Jornada de más a menos, que es el orden en que se decide; el resto
          // por volumen, para que lo que más pesa quede arriba.
          .sort((a, b) => g.id === 'jornada'
            ? Number(b.id.slice(8)) - Number(a.id.slice(8))
            : b.vacantes.length - a.vacantes.length)
      }))
      .filter(g => g.subgrupos.length > 0);
  });

  // ── Desplegables y ayudas ──────────────────────────────────────────────
  abierto(id: string): boolean {
    return this.desplegados().has(id);
  }

  /** Solo la flecha abre y cierra: marcar una casilla nunca pasa por aquí. */
  alternarAbierto(id: string): void {
    const abiertos = new Set(this.desplegados());
    abiertos.has(id) ? abiertos.delete(id) : abiertos.add(id);
    this.desplegados.set(abiertos);
  }

  alternarAyuda(id: string): void {
    this.ayuda.set(this.ayuda() === id ? null : id);
  }

  // ── Localidades y centros ──────────────────────────────────────────────
  readonly municipiosDisponibles = computed(() => {
    const ya = new Set(this.config.municipiosExcluidos());
    return this.estado.municipiosDeConvocatoria().filter(m => !ya.has(m));
  });

  readonly centrosDisponibles = computed(() => {
    const ya = new Set(this.config.centrosExcluidos());
    return this.estado.centrosDeConvocatoria().filter(c => !ya.has(c.code));
  });

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

  // ── Salida ─────────────────────────────────────────────────────────────
  /** Sin voluntarias, con algo excluido o con vacantes quitadas: hay filtro. */
  hayFiltros(): boolean {
    return (
      !this.config.voluntarias() ||
      this.config.municipiosExcluidos().length > 0 ||
      this.config.centrosExcluidos().length > 0 ||
      this.config.vacantesDescartadas().length > 0
    );
  }

  quitarFiltros(): void {
    this.config.voluntarias.set(true);
    this.config.municipiosExcluidos.set([]);
    this.config.centrosExcluidos.set([]);
    this.config.vacantesDescartadas.set([]);
    this.config.fijarLimitesGrupo({});
    const todas = [...this.provincias()];
    this.config.provinciasObligatorias.set(todas);
    this.config.provinciasVoluntarias.set(todas);
    this.sincronizarAcepta();
  }

  continuar(): void {
    this.sincronizarAcepta();
    this.router.navigate(['/ordenar']);
  }

  // ── Interno ────────────────────────────────────────────────────────────
  private guardarDescartadas(fuera: Set<string>): void {
    this.config.vacantesDescartadas.set([...fuera]);
    this.sincronizarAcepta();
  }

  /**
   * Traduce la selección por vacante al `conditionAccepts` que entiende el core:
   * una condición sigue aceptada mientras te quede al menos una vacante suya.
   * Se hace aquí, en la misma acción que cambia la selección, y no en un efecto:
   * un efecto repintaría después del render y ahí es donde aparecen los parpadeos.
   */
  private sincronizarAcepta(): void {
    const fuera = new Set(this.config.vacantesDescartadas());
    const acepta: Record<string, boolean> = { ...this.config.acepta() };
    const vistos = new Set<string>();
    const requisitos = this.requisitosPorId();
    for (const v of this.estado.vacantesDelUsuario()) {
      if (!v.voluntary) continue;
      for (const req of requisitos.get(v.id) ?? []) {
        if (!req.required) continue;
        if (!vistos.has(req.code)) {
          vistos.add(req.code);
          acepta[req.code] = false;
        }
        if (!fuera.has(v.id)) acepta[req.code] = true;
      }
    }
    this.config.acepta.set(acepta);
  }

  /** Clave estable del subgrupo de jornada. */
  private claveJornada(v: VacanteImportada): string {
    return v.workload == null ? 'sin-datos' : v.workload.toFixed(4);
  }

  /**
   * "Completa" o "16 h · 88.89%". Se conservan los decimales que da la ficha
   * oficial en vez de redondear: son los que el docente ve en el PDF, y dos
   * jornadas de 88.89% y 89% no son la misma plaza.
   */
  private etiquetaJornada(v: VacanteImportada): string {
    if (v.workload == null) return 'Jornada sin especificar';
    if (v.workload >= 1) return 'Completa';
    const pct = `${Number((v.workload * 100).toFixed(2))}%`;
    return v.horas == null ? pct : `${v.horas} h · ${pct}`;
  }

  private textoJornada(v: VacanteImportada): string {
    if (v.workload == null) return 'Jornada sin especificar';
    if (v.workload >= 1) return 'Jornada completa';
    return `Jornada parcial (${Math.round(v.workload * 100)}%)`;
  }

  /**
   * La causa viene literal del PDF ("De Cupo Sin titular"). Se normaliza a las
   * tres condiciones reales de la convocatoria; cualquier otra se muestra con su
   * texto tal cual. Nunca "otra información adicional": el texto se conoce.
   */
  private etiquetaCausa(causa: string): string {
    const t = causa.toLowerCase();
    if (t.includes('cupo')) return 'Cupo sin titular';
    if (t.includes('plantilla')) return 'Plantilla definitiva sin titular';
    if (t.includes('comisi')) return 'Comisión de servicio · reserva de titular';
    if (t.includes('sustituci')) return 'Sustitución';
    return causa;
  }

  /** "Con horas de Física Y Química" → "Física Y Química". */
  private etiquetaRequisito(label: string): string {
    return label.replace(/^con\s+horas\s+de\s+/i, '');
  }

  /** Descarta como nombre de asignatura lo que solo es un resto de la frase. */
  private etiquetaUtil(etiqueta: string): boolean {
    const limpia = etiqueta.trim();
    return limpia.length >= 3 && !/^(o|y|u|de|del|la|el|en|con)\b/i.test(limpia);
  }

  private esOrientacion(texto: string | undefined): boolean {
    return /orientaci(ó|o)n/i.test(texto ?? '');
  }

  private slug(s: string): string {
    return s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }
}
