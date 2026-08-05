import { Injectable, computed, effect, signal } from '@angular/core';
import type { CandidateMatch, DetectedCondition, VacanteImportada } from '@plazainterinos/core';

export interface Resumen {
  total: number;
  voluntary: number;
  languageRequirement: number;
  afternoon: number;
  ambiguous: number;
  /** Vacantes cuyo centro no está en el catálogo geolocalizado. */
  sinCoordenadas?: number;
}

/** Un centro de la convocatoria importada, para poder excluirlo por código. */
export interface CentroDeConvocatoria {
  code: string;
  name: string;
  municipality: string;
}

export interface PreciosCombustible {
  diesel: number;
  gasolina: number;
  fallback: boolean;
}

export interface Geocodificado {
  lat: number;
  lng: number;
  displayName: string;
}

export interface Razon {
  ruleId: string;
  reasonCode: string;
  message: string;
  sourceText?: string;
}

export interface VacanteEvaluada {
  vacancyId: string;
  included: boolean;
  score: number;
  hardExclusionReasons: Razon[];
  warnings: Razon[];
  positiveReasons: Razon[];
  distanceKm?: number;
  travelMinutes?: number;
  dailyCostEur?: number;
  requiresManualReview: boolean;
  vacancy: {
    id: string;
    bodyCode?: string;
    specialtyCode?: string;
    centerCode?: string;
    centerName?: string;
    municipality?: string;
    specialtyName?: string;
    workload?: number;
    additionalInfoRaw?: string;
    voluntary: boolean;
  };
}

export interface Resultado {
  recommended: VacanteEvaluada[];
  withWarnings: VacanteEvaluada[];
  excluded: VacanteEvaluada[];
}

export interface Comprobacion {
  missingCompatible: VacanteEvaluada[];
  selectedButExcluded: VacanteEvaluada[];
  selectedNeedsReview: VacanteEvaluada[];
}

/** Bloque persistido de la convocatoria activa (punto 4). */
const CLAVE_CONVOCATORIA = 'pi_convocatoria';
const VERSION_CONVOCATORIA = 1;

@Injectable({ providedIn: 'root' })
export class EstadoService {
  readonly resumen = signal<Resumen | null>(null);
  readonly resultado = signal<Resultado | null>(null);
  readonly comprobacion = signal<Comprobacion | null>(null);
  readonly seleccion = signal<Set<string>>(new Set());
  readonly perfilGuardado = signal(false);
  readonly error = signal('');
  readonly accesoAutorizado = signal(localStorage.getItem('pi_access_code') !== null);

  /** Vacantes leídas del PDF (antes de filtrar por aspirante). Solo en memoria. */
  readonly vacantesParseadas = signal<VacanteImportada[]>([]);
  /** Cuerpos/especialidades del aspirante (del PDF de candidatos o manual). */
  readonly especialidadesUsuario = signal<CandidateMatch[]>([]);
  /** Condiciones detectadas en la convocatoria importada (para filtrar). */
  readonly condicionesDetectadas = signal<DetectedCondition[]>([]);
  /** Localidades presentes en la convocatoria, para el desplegable de filtros. */
  readonly municipiosDeConvocatoria = signal<string[]>([]);
  /** Centros presentes en la convocatoria, únicos por código. */
  readonly centrosDeConvocatoria = signal<CentroDeConvocatoria[]>([]);

  readonly hayConvocatoria = computed(() => this.resumen() !== null);

  private token: string | null = null;
  private convocatoriaId: string | null = null;
  private accessCode: string | null = localStorage.getItem('pi_access_code');

  constructor() {
    this.rehidratarConvocatoria();
    effect(() => this.persistirConvocatoria());
  }

  /**
   * El catálogo de la convocatoria (localidades y centros) sí se guarda, porque
   * sin él la pantalla de filtros se queda sin opciones tras un refresco. Las
   * 4600 vacantes en crudo no: no caben en localStorage y ya están en la API.
   */
  private persistirConvocatoria(): void {
    const data = {
      convocatoriaId: this.convocatoriaId,
      resumen: this.resumen(),
      condicionesDetectadas: this.condicionesDetectadas(),
      especialidadesUsuario: this.especialidadesUsuario(),
      municipios: this.municipiosDeConvocatoria(),
      centros: this.centrosDeConvocatoria()
    };
    try {
      localStorage.setItem(
        CLAVE_CONVOCATORIA,
        JSON.stringify({ version: VERSION_CONVOCATORIA, data })
      );
    } catch {
      // Sin persistencia la app sigue funcionando; solo se pierde al refrescar.
    }
  }

  private rehidratarConvocatoria(): void {
    let guardado: { version: number; data: any } | null = null;
    try {
      guardado = JSON.parse(localStorage.getItem(CLAVE_CONVOCATORIA) ?? 'null');
    } catch {
      guardado = null;
    }
    if (!guardado || guardado.version !== VERSION_CONVOCATORIA) return;
    const d = guardado.data ?? {};
    this.convocatoriaId = d.convocatoriaId ?? null;
    if (d.resumen) this.resumen.set(d.resumen);
    if (d.condicionesDetectadas) this.condicionesDetectadas.set(d.condicionesDetectadas);
    if (d.especialidadesUsuario) this.especialidadesUsuario.set(d.especialidadesUsuario);
    if (d.municipios) this.municipiosDeConvocatoria.set(d.municipios);
    if (d.centros) this.centrosDeConvocatoria.set(d.centros);
  }

  private apiUrl(path: string): string {
    const base =
      location.hostname === 'localhost' || location.hostname === '127.0.0.1'
        ? '/api'
        : 'https://plazainterinos-api.fly.dev/api';
    const normalizedPath = path.startsWith('/api/') ? path.slice(4) : path;
    return `${base}${normalizedPath}`;
  }

  private async leerRespuesta(response: Response): Promise<any> {
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.message ?? data?.error ?? `Error ${response.status}`);
    }
    return data;
  }

  private async post(url: string, body: unknown): Promise<any> {
    const r = await fetch(this.apiUrl(url), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    return this.leerRespuesta(r);
  }

  /**
   * Reutiliza siempre la misma cuenta demo. Registrar una nueva en cada carga
   * dejaría huérfanas la convocatoria y el perfil guardados: la persistencia
   * del punto 4 solo vale si al volver eres el mismo usuario.
   */
  private async asegurarSesion(): Promise<void> {
    if (this.token) return;
    const password = 'demo12345';
    const guardado = localStorage.getItem('pi_demo_email');
    if (guardado) {
      try {
        this.token = (await this.post('/auth/login', { email: guardado, password })).token;
        return;
      } catch {
        // Cuenta perdida (base reiniciada): se crea una nueva más abajo.
      }
    }
    const email = `demo+${Date.now()}@plazainterinos.es`;
    const data = await this.post('/auth/register', {
      email,
      password,
      name: 'Demo',
      accessCode: this.accessCode
    });
    this.token = data.token;
    localStorage.setItem('pi_demo_email', email);
  }

  async desbloquear(accessCode: string): Promise<void> {
    this.error.set('');
    this.token = null;
    this.accessCode = accessCode.trim();
    await this.asegurarSesion();
    localStorage.setItem('pi_access_code', this.accessCode);
    this.accesoAutorizado.set(true);
  }

  private async req<T>(url: string, body?: unknown): Promise<T> {
    await this.asegurarSesion();
    const response = await fetch(this.apiUrl(url), {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.token}`
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return this.leerRespuesta(response) as Promise<T>;
  }

  async importar(vacancies: unknown[]): Promise<void> {
    this.error.set('');
    const data = await this.req<{
      convocatoriaId: string;
      summary: Resumen;
      detectedConditions: DetectedCondition[];
    }>('/api/convocatoria/import', { vacancies });
    this.convocatoriaId = data.convocatoriaId;
    this.resumen.set(data.summary);
    this.condicionesDetectadas.set(data.detectedConditions ?? []);
    this.catalogarConvocatoria(vacancies as Record<string, string | undefined>[]);
    this.resultado.set(null);
    this.comprobacion.set(null);
  }

  /** Localidades y centros de la convocatoria, para los desplegables de Filtrar. */
  private catalogarConvocatoria(vacancies: Record<string, string | undefined>[]): void {
    const municipios = new Set<string>();
    const centros = new Map<string, CentroDeConvocatoria>();
    for (const v of vacancies) {
      if (v['municipality']) municipios.add(v['municipality']);
      const code = v['centerCode'];
      if (code && !centros.has(code)) {
        centros.set(code, {
          code,
          name: v['centerName'] ?? code,
          municipality: v['municipality'] ?? ''
        });
      }
    }
    const porNombre = (a: string, b: string) => a.localeCompare(b, 'es');
    this.municipiosDeConvocatoria.set([...municipios].sort(porNombre));
    this.centrosDeConvocatoria.set([...centros.values()].sort((a, b) => porNombre(a.name, b.name)));
  }

  /** Descarga un PDF por URL a través del proxy de la API. */
  async descargarPdf(url: string): Promise<ArrayBuffer> {
    await this.asegurarSesion();
    const response = await fetch(this.apiUrl('/pdf/fetch'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.token}` },
      body: JSON.stringify({ url })
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.message ?? 'No se ha podido descargar el PDF.');
    }
    return response.arrayBuffer();
  }

  geocodificar(q: string): Promise<Geocodificado> {
    return this.req<Geocodificado>(`/api/geo/geocode?q=${encodeURIComponent(q)}`);
  }

  preciosCombustible(): Promise<PreciosCombustible> {
    return this.req<PreciosCombustible>('/api/fuel/prices');
  }

  async guardarPerfil(perfil: unknown): Promise<void> {
    this.error.set('');
    await this.req('/api/profile', perfil);
    this.perfilGuardado.set(true);
  }

  async evaluar(): Promise<void> {
    this.error.set('');
    if (!this.convocatoriaId) throw new Error('Importa primero una convocatoria.');
    const resultado = await this.req<Resultado>(`/api/evaluacion/${this.convocatoriaId}`, {});
    this.resultado.set(resultado);
    this.seleccion.set(new Set(resultado.recommended.map(e => e.vacancyId)));
  }

  alternarSeleccion(id: string): void {
    const nueva = new Set(this.seleccion());
    nueva.has(id) ? nueva.delete(id) : nueva.add(id);
    this.seleccion.set(nueva);
  }

  async comprobar(): Promise<void> {
    this.error.set('');
    if (!this.convocatoriaId) throw new Error('Evalúa primero la convocatoria.');
    const comprobacion = await this.req<Comprobacion>(
      `/api/evaluacion/${this.convocatoriaId}/check`,
      { selectedIds: Array.from(this.seleccion()) }
    );
    this.comprobacion.set(comprobacion);
  }
}
