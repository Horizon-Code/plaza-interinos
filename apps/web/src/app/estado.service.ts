import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import type { CandidateMatch, DetectedCondition, VacanteImportada, TravelEstimate } from '@plazainterinos/core';
import { ConfiguracionService } from './configuracion.service';

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
  /** Provincia del centro; '' si la convocatoria guardada es anterior a este campo. */
  province: string;
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
    province?: string;
    durationType?: 'full_course' | 'long_term' | 'substitution' | 'unknown';
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
const CLAVE_SESION = 'pi_token';
const CLAVE_EMAIL = 'pi_email';
const VERSION_CONVOCATORIA = 1;

@Injectable({ providedIn: 'root' })
export class EstadoService {
  readonly resumen = signal<Resumen | null>(null);
  readonly resultado = signal<Resultado | null>(null);
  readonly comprobacion = signal<Comprobacion | null>(null);
  readonly seleccion = signal<Set<string>>(new Set());
  readonly perfilGuardado = signal(false);
  readonly error = signal('');
  readonly sesionIniciada = signal(localStorage.getItem(CLAVE_SESION) !== null);
  readonly emailSesion = signal(localStorage.getItem(CLAVE_EMAIL) ?? '');

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
  /** Provincias presentes en la convocatoria, para el filtro por provincia. */
  readonly provinciasDeConvocatoria = signal<string[]>([]);
  /**
   * Las vacantes que se enviaron a importar, es decir las de los cuerpos y
   * especialidades del aspirante. Son las que el paso 3 desglosa una a una, así
   * que sí se persisten: son un subconjunto pequeño (las tuyas), no las 4600.
   */
  readonly vacantesDelUsuario = signal<VacanteImportada[]>([]);

  readonly hayConvocatoria = computed(() => this.resumen() !== null);

  private readonly config = inject(ConfiguracionService);
  private token: string | null = localStorage.getItem(CLAVE_SESION);
  private convocatoriaId: string | null = null;

  readonly calculandoTrayectos = signal(false);
  readonly errorTrayectos = signal('');
  private readonly rutasCargadas = signal<{ clave: string; rutas: Record<string, TravelEstimate | null> } | null>(null);
  private peticionTrayectos = 0;
  private claveTrayectos(): string {
    const origen = this.config.ubicacion();
    return JSON.stringify([this.convocatoriaId, origen?.lat, origen?.lng]);
  }
  readonly trayectos = computed(() => {
    const datos = this.rutasCargadas();
    return datos?.clave === this.claveTrayectos() ? datos.rutas : {};
  });

  constructor() {
    this.rehidratarConvocatoria();
    effect(() => this.persistirConvocatoria());
    effect(() => {
      // Cambiar domicilio o límites invalida la lista y su comprobación.
      this.config.construirPerfil(this.especialidadesUsuario(), this.condicionesDetectadas());
      untracked(() => {
        this.resultado.set(null);
        this.comprobacion.set(null);
        this.perfilGuardado.set(false);
      });
    });
  }

  async cargarTrayectos(): Promise<void> {
    const peticion = ++this.peticionTrayectos;
    const clave = this.claveTrayectos();
    const origen = this.config.ubicacion();
    this.errorTrayectos.set('');
    this.calculandoTrayectos.set(false);
    if (!origen || !this.convocatoriaId) return;
    this.calculandoTrayectos.set(true);
    try {
      const rutas = await this.req<Record<string, TravelEstimate | null>>(
        `/api/evaluacion/${this.convocatoriaId}/trayectos`, { lat: origen.lat, lng: origen.lng }
      );
      if (peticion !== this.peticionTrayectos || clave !== this.claveTrayectos()) return;
      this.rutasCargadas.set({ clave, rutas });
      if (Object.values(rutas).some(r => r === null)) {
        this.errorTrayectos.set('Hay trayectos sin calcular. Esas plazas no se descartan por kilómetros ni minutos. Puedes reintentarlo.');
      }
    } catch (error) {
      if (peticion === this.peticionTrayectos) {
        this.rutasCargadas.set(null);
        this.errorTrayectos.set(error instanceof Error ? error.message : String(error));
      }
    } finally {
      if (peticion === this.peticionTrayectos) this.calculandoTrayectos.set(false);
    }
  }

  /**
   * El catálogo de la convocatoria (localidades, centros y provincias) sí se
   * guarda, porque sin él la pantalla de filtros se queda sin opciones tras un
   * refresco; y con él las vacantes tuyas, que son las que esa pantalla desglosa
   * una a una. Las 4600 en crudo no: no caben en localStorage y ya están en la API.
   */
  private persistirConvocatoria(): void {
    const data = {
      convocatoriaId: this.convocatoriaId,
      resumen: this.resumen(),
      condicionesDetectadas: this.condicionesDetectadas(),
      especialidadesUsuario: this.especialidadesUsuario(),
      municipios: this.municipiosDeConvocatoria(),
      centros: this.centrosDeConvocatoria(),
      provincias: this.provinciasDeConvocatoria(),
      vacantesDelUsuario: this.vacantesDelUsuario()
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
    if (d.provincias) this.provinciasDeConvocatoria.set(d.provincias);
    if (d.vacantesDelUsuario) this.vacantesDelUsuario.set(d.vacantesDelUsuario);
  }

  private apiUrl(path: string): string {
    const normalizedPath = path.startsWith('/api/') ? path.slice(4) : path;
    return `/api${normalizedPath}`;
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
   * El identificador público de la aplicación en Google.
   *
   * Lo sirve la API en vez de venir compilado en el frontend: así cambiarlo no
   * obliga a reconstruir la web, y local y producción comparten la misma build.
   */
  async configuracionGoogle(): Promise<{ clientId: string | null }> {
    const r = await fetch(this.apiUrl('/auth/google/config'));
    if (!r.ok) throw new Error('No se ha podido consultar la configuración de acceso.');
    return r.json();
  }

  /**
   * Cambia el identificador que ha dado Google por una sesión nuestra. La
   * cuenta se crea aquí si es la primera vez, y se reconoce por el correo si ya
   * existía de antes.
   */
  async entrarConGoogle(idToken: string): Promise<void> {
    this.error.set('');
    const data = await this.post('/auth/google', { idToken });
    this.token = data.token;
    localStorage.setItem(CLAVE_SESION, data.token);
    localStorage.setItem(CLAVE_EMAIL, data.user?.email ?? '');
    this.emailSesion.set(data.user?.email ?? '');
    this.sesionIniciada.set(true);
  }

  /** Derecho de acceso: la copia de todo lo que la API guarda de ti. */
  async misDatos(): Promise<unknown> {
    return this.req('/auth/mis-datos');
  }

  /**
   * Derecho de supresión. Al volver, la sesión local se limpia igual que al
   * salir: la cuenta ya no existe, así que quedarse con el token y la
   * convocatoria en este navegador no tendría ningún sentido.
   */
  async borrarCuenta(): Promise<void> {
    this.asegurarSesion();
    const r = await fetch(this.apiUrl('/auth/cuenta'), {
      method: 'DELETE',
      headers: { authorization: `Bearer ${this.token}` }
    });
    if (!r.ok) throw new Error('No se ha podido borrar la cuenta. Inténtalo de nuevo.');
    for (const clave of [CLAVE_SESION, CLAVE_EMAIL, CLAVE_CONVOCATORIA, 'pi_configuracion', 'pi_lista']) {
      localStorage.removeItem(clave);
    }
    this.token = null;
    this.sesionIniciada.set(false);
    this.emailSesion.set('');
  }

  /**
   * Salir borra también la convocatoria y la configuración guardadas: en un
   * ordenador compartido, el siguiente en entrar no debe encontrarse el perfil
   * ni el domicilio de quien estuvo antes.
   */
  cerrarSesion(): void {
    for (const clave of [CLAVE_SESION, CLAVE_EMAIL, CLAVE_CONVOCATORIA, 'pi_configuracion', 'pi_lista']) {
      localStorage.removeItem(clave);
    }
    this.token = null;
    this.sesionIniciada.set(false);
    this.emailSesion.set('');
    location.href = '/entrar';
  }

  /**
   * La sesión ya no se fabrica sola: o hay token o hay que entrar. Un token
   * caducado se detecta en la primera respuesta 401 y lleva a la misma puerta.
   */
  private asegurarSesion(): void {
    if (!this.token) {
      this.expulsar();
      throw new Error('Entra en tu cuenta para continuar.');
    }
  }

  /** Token no válido o caducado: se limpia la sesión y se vuelve a la entrada. */
  private expulsar(): void {
    localStorage.removeItem(CLAVE_SESION);
    this.token = null;
    this.sesionIniciada.set(false);
    if (!location.pathname.startsWith('/entrar')) location.href = '/entrar';
  }

  private async req<T>(url: string, body?: unknown): Promise<T> {
    this.asegurarSesion();
    const response = await fetch(this.apiUrl(url), {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.token}`
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    if (response.status === 401) {
      this.expulsar();
      throw new Error('Tu sesión ha caducado. Entra otra vez.');
    }
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
    this.rutasCargadas.set(null);
    this.resumen.set(data.summary);
    this.condicionesDetectadas.set(data.detectedConditions ?? []);
    this.vacantesDelUsuario.set(vacancies as VacanteImportada[]);
    this.catalogarConvocatoria(vacancies as Record<string, string | undefined>[]);
    this.resultado.set(null);
    this.comprobacion.set(null);
  }

  /**
   * Localidades, centros y provincias de la convocatoria, para los desplegables
   * de Filtrar. Se catalogan sobre TODAS las vacantes leídas del PDF, no sobre
   * las que se importan (que son solo las de tus especialidades): al excluir una
   * localidad o un centro quieres verlos todos los de la convocatoria, no los
   * pocos en los que casualmente hay plaza de lo tuyo.
   */
  private catalogarConvocatoria(vacancies: Record<string, string | undefined>[]): void {
    const todas = this.vacantesParseadas().length
      ? (this.vacantesParseadas() as unknown as Record<string, string | undefined>[])
      : vacancies;
    const municipios = new Set<string>();
    const provincias = new Set<string>();
    const centros = new Map<string, CentroDeConvocatoria>();
    for (const v of todas) {
      const municipio = v['municipality'];
      const provincia = v['province'] ?? '';
      if (municipio) municipios.add(municipio);
      if (provincia) provincias.add(provincia);
      const code = v['centerCode'];
      if (code && !centros.has(code)) {
        centros.set(code, {
          code,
          name: v['centerName'] ?? code,
          municipality: municipio ?? '',
          province: provincia
        });
      }
    }
    const porNombre = (a: string, b: string) => a.localeCompare(b, 'es');
    this.municipiosDeConvocatoria.set([...municipios].sort(porNombre));
    this.provinciasDeConvocatoria.set([...provincias].sort(porNombre));
    this.centrosDeConvocatoria.set([...centros.values()].sort((a, b) => porNombre(a.name, b.name)));
  }

  /** Coordenadas del GPS → dirección legible, para "Usar ubicación actual". */
  geocodificarInverso(lat: number, lng: number): Promise<Geocodificado> {
    return this.req<Geocodificado>(`/api/geo/reverse?lat=${lat}&lng=${lng}`);
  }

  /** Descarga un PDF por URL a través del proxy de la API. */
  async descargarPdf(url: string): Promise<ArrayBuffer> {
    this.asegurarSesion();
    const response = await fetch(this.apiUrl('/pdf/fetch'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.token}` },
      body: JSON.stringify({ url })
    });
    if (response.status === 401) {
      this.expulsar();
      throw new Error('Tu sesión ha caducado. Entra otra vez.');
    }
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
    const perfil = this.config.construirPerfil(this.especialidadesUsuario(), this.condicionesDetectadas());
    await this.guardarPerfil(perfil);
    const resultado = await this.req<Resultado>(`/api/evaluacion/${this.convocatoriaId}`, {});
    if (JSON.stringify(perfil) !== JSON.stringify(
      this.config.construirPerfil(this.especialidadesUsuario(), this.condicionesDetectadas())
    )) throw new Error('El perfil ha cambiado durante el cálculo. Vuelve a calcular la lista.');
    this.resultado.set(resultado);
    // Lo que el paso 3 dejó fuera vacante a vacante no vuelve a entrar aquí: la
    // selección inicial son las recomendadas menos las que descartaste tú.
    const descartadas = new Set(this.config.vacantesDescartadas());
    this.seleccion.set(
      new Set(resultado.recommended.map(e => e.vacancyId).filter(id => !descartadas.has(id)))
    );
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
