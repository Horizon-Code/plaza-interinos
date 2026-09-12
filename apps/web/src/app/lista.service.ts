import { Injectable, effect, signal } from '@angular/core';

const CLAVE = 'pi_lista';
const VERSION = 1;

/** Columnas de la tabla del paso 5, en su orden de aparición. */
export const COLUMNAS = [
  { id: 'orden', nombre: 'Orden', abreviable: false, ancho: 64 },
  { id: 'centro', nombre: 'Centro', abreviable: false, ancho: 220 },
  { id: 'localidad', nombre: 'Localidad', abreviable: true, ancho: 130 },
  { id: 'provincia', nombre: 'Provincia', abreviable: true, ancho: 110 },
  { id: 'tipo', nombre: 'Tipo', abreviable: true, ancho: 110 },
  { id: 'especialidad', nombre: 'Especialidad', abreviable: true, ancho: 160 },
  { id: 'jornada', nombre: 'Jornada', abreviable: true, ancho: 90 },
  { id: 'informacion', nombre: 'Información', abreviable: true, ancho: 220 },
  { id: 'trayecto', nombre: 'Trayecto', abreviable: false, ancho: 150 },
  { id: 'telefono', nombre: 'Teléfono', abreviable: false, ancho: 120 }
] as const;

export type IdColumna = (typeof COLUMNAS)[number]['id'];

interface Datos {
  ordenManual: string[];
  anotaciones: Record<string, string>;
  avisos: string[];
  excluidas: string[];
  ocultas: string[];
  descartados: string[];
  abreviadas: string[];
  anchos: Record<string, number>;
}

/** Lo necesario para deshacer una exclusión: qué vacante y en qué posición estaba. */
interface Exclusion {
  id: string;
  posicion: number;
  centro: string;
}

/**
 * Estado del paso 5 · Ordenar lista (SCRUM-25).
 *
 * Vive aparte de ConfiguracionService a propósito: aquello configura *cómo* se
 * calcula la lista, y esto son decisiones del usuario *sobre* la lista ya
 * calculada. Mezclarlas haría que recalcular borrase las notas.
 *
 * Todo se guarda al momento — una anotación que se pierde al cambiar de pantalla
 * es peor que no poder anotar.
 */
@Injectable({ providedIn: 'root' })
export class ListaService {
  /** Ids en el orden que el usuario ha fijado a mano. Vacío = manda la cascada. */
  readonly ordenManual = signal<string[]>([]);
  readonly anotaciones = signal<Record<string, string>>({});
  /** Avisos ⚠ que marca el usuario, distintos de los `warnings` del motor. */
  readonly avisos = signal<string[]>([]);
  readonly excluidas = signal<string[]>([]);
  /** Avisos de Comprobación que el usuario ha descartado. No hace falta
   *  descartarlos para continuar: solo dejan de dar la lata. */
  readonly descartados = signal<string[]>([]);

  readonly ocultas = signal<IdColumna[]>([]);
  readonly abreviadas = signal<IdColumna[]>([]);
  readonly anchos = signal<Record<string, number>>({});

  /** Solo en memoria: deshacer es para el error de clic de hace un segundo. */
  readonly ultimaExclusion = signal<Exclusion | null>(null);

  constructor() {
    this.rehidratar();
    effect(() => this.guardar());
  }

  // ── Orden manual ──────────────────────────────────────────────────────
  /**
   * Aplica el orden del usuario sobre la lista calculada. Las vacantes que él
   * nunca tocó conservan su sitio relativo detrás de las que sí: reordenar una
   * fila no puede reorganizar el resto de la lista.
   */
  aplicarOrden<T extends { vacancyId: string }>(filas: readonly T[]): T[] {
    const manual = this.ordenManual();
    const excluidas = new Set(this.excluidas());
    const visibles = filas.filter(f => !excluidas.has(f.vacancyId));
    if (!manual.length) return [...visibles];

    const posicion = new Map(manual.map((id, i) => [id, i]));
    return [...visibles].sort((a, b) => {
      const pa = posicion.get(a.vacancyId);
      const pb = posicion.get(b.vacancyId);
      if (pa != null && pb != null) return pa - pb;
      if (pa != null) return -1;
      if (pb != null) return 1;
      return 0;
    });
  }

  /**
   * Compone la lista definitiva a partir de los grupos que devuelve la
   * evaluación.
   *
   * Las excluidas por el motor entran SOLO si el usuario las añadió a mano en
   * Comprobación: sin esto, añadir una obligatoria excluida no tendría ningún
   * efecto visible, porque nunca estuvo en el conjunto de partida.
   */
  componer<T extends { vacancyId: string }>(
    enCascada: readonly T[],
    excluidasPorElMotor: readonly T[]
  ): T[] {
    const manual = new Set(this.ordenManual());
    const rescatadas = excluidasPorElMotor.filter(e => manual.has(e.vacancyId));
    return this.aplicarOrden([...enCascada, ...rescatadas]);
  }

  /** Fija el orden completo actual: a partir de aquí manda el usuario. */
  fijarOrden(ids: string[]): void {
    this.ordenManual.set([...ids]);
  }

  mover(ids: string[], desde: number, destino: number): void {
    const limite = Math.max(0, Math.min(ids.length - 1, destino));
    if (desde === limite || desde < 0 || desde >= ids.length) return;
    const copia = [...ids];
    const [movido] = copia.splice(desde, 1);
    copia.splice(limite, 0, movido);
    this.fijarOrden(copia);
  }

  // ── Anotaciones y avisos ──────────────────────────────────────────────
  anotacion(id: string): string {
    return this.anotaciones()[id] ?? '';
  }

  anotar(id: string, texto: string): void {
    const copia = { ...this.anotaciones() };
    if (texto.trim()) copia[id] = texto.trim();
    else delete copia[id];
    this.anotaciones.set(copia);
  }

  tieneAviso(id: string): boolean {
    return this.avisos().includes(id);
  }

  alternarAviso(id: string): void {
    const actuales = this.avisos();
    this.avisos.set(
      actuales.includes(id) ? actuales.filter(x => x !== id) : [...actuales, id]
    );
  }

  borrarAnotaciones(): void { this.anotaciones.set({}); }
  borrarAvisos(): void { this.avisos.set([]); }

  // ── Excluir, con deshacer ─────────────────────────────────────────────
  excluir(id: string, posicion: number, centro: string): void {
    if (this.excluidas().includes(id)) return;
    this.excluidas.set([...this.excluidas(), id]);
    this.ultimaExclusion.set({ id, posicion, centro });
  }

  deshacerExclusion(): void {
    const ultima = this.ultimaExclusion();
    if (!ultima) return;
    this.excluidas.set(this.excluidas().filter(x => x !== ultima.id));
    this.ultimaExclusion.set(null);
  }

  descartarDeshacer(): void { this.ultimaExclusion.set(null); }

  // ── Comprobación (SCRUM-26) ───────────────────────────────────────────
  descartado(id: string): boolean { return this.descartados().includes(id); }

  descartarAviso(id: string): void {
    if (!this.descartado(id)) this.descartados.set([...this.descartados(), id]);
  }

  descartarTodos(ids: readonly string[]): void {
    this.descartados.set([...new Set([...this.descartados(), ...ids])]);
  }

  /**
   * Mete una plaza en la lista en la posición pedida (o al final si se omite).
   *
   * Si estaba excluida deja de estarlo. Fijar el orden completo es
   * responsabilidad de quien llama, que es el único que conoce la lista
   * visible; aquí solo se coloca el id.
   */
  insertar(ids: readonly string[], id: string, posicion?: number): void {
    this.excluidas.set(this.excluidas().filter(x => x !== id));
    const sinEl = ids.filter(x => x !== id);
    const donde = posicion == null ? sinEl.length : Math.max(0, Math.min(sinEl.length, posicion));
    sinEl.splice(donde, 0, id);
    this.fijarOrden(sinEl);
  }

  /** "Poner todo al final": respeta el orden en que se ofrecen. */
  añadirTodasAlFinal(ids: readonly string[], nuevas: readonly string[]): void {
    const pendientes = nuevas.filter(id => !ids.includes(id));
    this.excluidas.set(this.excluidas().filter(x => !pendientes.includes(x)));
    this.fijarOrden([...ids.filter(x => !pendientes.includes(x)), ...pendientes]);
  }

  // ── Columnas ──────────────────────────────────────────────────────────
  visible(id: IdColumna): boolean { return !this.ocultas().includes(id); }

  alternarColumna(id: IdColumna): void {
    const actuales = this.ocultas();
    this.ocultas.set(
      actuales.includes(id) ? actuales.filter(x => x !== id) : [...actuales, id]
    );
  }

  abreviada(id: IdColumna): boolean { return this.abreviadas().includes(id); }

  alternarAbreviada(id: IdColumna): void {
    const actuales = this.abreviadas();
    this.abreviadas.set(
      actuales.includes(id) ? actuales.filter(x => x !== id) : [...actuales, id]
    );
  }

  ancho(id: IdColumna): number {
    return this.anchos()[id] ?? COLUMNAS.find(c => c.id === id)!.ancho;
  }

  fijarAncho(id: IdColumna, px: number): void {
    this.anchos.set({ ...this.anchos(), [id]: Math.max(56, Math.round(px)) });
  }

  // ── Persistencia ──────────────────────────────────────────────────────
  private guardar(): void {
    const data: Datos = {
      ordenManual: this.ordenManual(),
      anotaciones: this.anotaciones(),
      avisos: this.avisos(),
      excluidas: this.excluidas(),
      ocultas: this.ocultas(),
      descartados: this.descartados(),
      abreviadas: this.abreviadas(),
      anchos: this.anchos()
    };
    try {
      localStorage.setItem(CLAVE, JSON.stringify({ version: VERSION, data }));
    } catch {
      // Cuota llena o almacenamiento bloqueado: la app sigue, solo pierde la persistencia.
    }
  }

  private rehidratar(): void {
    let guardado: { version: number; data: Partial<Datos> } | null = null;
    try {
      const crudo = localStorage.getItem(CLAVE);
      guardado = crudo ? JSON.parse(crudo) : null;
    } catch {
      guardado = null;
    }
    if (!guardado || guardado.version !== VERSION) return;
    const d = guardado.data;
    if (d.ordenManual) this.ordenManual.set(d.ordenManual);
    if (d.anotaciones) this.anotaciones.set(d.anotaciones);
    if (d.avisos) this.avisos.set(d.avisos);
    if (d.excluidas) this.excluidas.set(d.excluidas);
    if (d.ocultas) this.ocultas.set(d.ocultas as IdColumna[]);
    if (d.descartados) this.descartados.set(d.descartados);
    if (d.abreviadas) this.abreviadas.set(d.abreviadas as IdColumna[]);
    if (d.anchos) this.anchos.set(d.anchos);
  }
}
