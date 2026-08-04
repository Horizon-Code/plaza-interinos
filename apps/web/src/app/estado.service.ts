import { Injectable, signal } from '@angular/core';
import type { CandidateMatch, DetectedCondition, VacanteImportada } from '@plazainterinos/core';

export interface Resumen {
  total: number;
  voluntary: number;
  languageRequirement: number;
  afternoon: number;
  ambiguous: number;
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

@Injectable({ providedIn: 'root' })
export class EstadoService {
  readonly resumen = signal<Resumen | null>(null);
  readonly resultado = signal<Resultado | null>(null);
  readonly comprobacion = signal<Comprobacion | null>(null);
  readonly seleccion = signal<Set<string>>(new Set());
  readonly perfilGuardado = signal(false);
  readonly error = signal('');

  /** Vacantes leídas del PDF (antes de filtrar por aspirante). */
  readonly vacantesParseadas = signal<VacanteImportada[]>([]);
  /** Cuerpos/especialidades del aspirante (del PDF de candidatos o manual). */
  readonly especialidadesUsuario = signal<CandidateMatch[]>([]);
  /** Condiciones detectadas en la convocatoria importada (para el perfil). */
  readonly condicionesDetectadas = signal<DetectedCondition[]>([]);

  private token: string | null = null;
  private convocatoriaId: string | null = null;

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

  private async asegurarSesion(): Promise<void> {
    if (this.token) return;
    const email = `demo+${Date.now()}@plazainterinos.es`;
    const body = { email, password: 'demo12345', name: 'Demo' };
    const r = await fetch(this.apiUrl('/auth/register'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await this.leerRespuesta(r);
    this.token = data.token;
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
    this.resultado.set(null);
    this.comprobacion.set(null);
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
