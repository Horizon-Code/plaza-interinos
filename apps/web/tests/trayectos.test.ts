import '@angular/compiler';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { ConfiguracionService } from '../src/app/configuracion.service';
import { EstadoService } from '../src/app/estado.service';

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
const domicilio = { lat: 41.6, lng: -0.9, displayName: 'Origen de prueba' };
const respuesta = (data: unknown) => ({ ok: true, json: async () => data });

beforeEach(() => {
  const datos = new Map<string, string>([
    ['pi_token', 'sesion-de-prueba'],
    ['pi_convocatoria', JSON.stringify({ version: 1, data: { convocatoriaId: 'convocatoria', resumen: { total: 1 } } })]
  ]);
  vi.stubGlobal('localStorage', { getItem: (k: string) => datos.get(k) ?? null, setItem: (k: string, v: string) => datos.set(k, v) });
  TestBed.configureTestingModule({ providers: [
    provideZonelessChangeDetection(),
    { provide: DOCUMENT, useValue: { body: { querySelector: () => null }, head: {}, querySelectorAll: () => [], defaultView: null } }
  ] });
});
afterEach(() => { TestBed.resetTestingModule(); vi.unstubAllGlobals(); });

describe('ubicación, rutas y unidades', () => {
  it('conserva límites separados por unidad al guardar y recargar', () => {
    let config = TestBed.inject(ConfiguracionService);
    config.fijarLimitesGrupo({ grupo: 40 });
    config.modo.set('km');
    expect(config.limitesGrupo()).toEqual({});
    config.fijarLimitesGrupo({ grupo: 80 });
    TestBed.tick();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), { provide: DOCUMENT, useValue: { body: { querySelector: () => null }, head: {}, querySelectorAll: () => [], defaultView: null } }] });
    config = TestBed.inject(ConfiguracionService);
    expect(config.limitesGrupo()).toEqual({ grupo: 80 });
    config.modo.set('minutes');
    expect(config.limitesGrupo()).toEqual({ grupo: 40 });
  });

  it('oculta rutas antiguas inmediatamente y descarta una respuesta de otro domicilio', async () => {
    const estado = TestBed.inject(EstadoService);
    const config = TestBed.inject(ConfiguracionService);
    config.ubicacion.set(domicilio);
    vi.stubGlobal('fetch', vi.fn(async () => respuesta({ v1: { distanceKm: 100, travelMinutes: 60 } })));
    await estado.cargarTrayectos();
    expect(estado.trayectos()['v1']?.distanceKm).toBe(100);
    let resolver!: (v: unknown) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => { resolver = resolve; })));
    const pendiente = estado.cargarTrayectos();
    config.ubicacion.set({ ...domicilio, lat: 41.7 });
    expect(estado.trayectos()).toEqual({});
    resolver(respuesta({ v1: { distanceKm: 100, travelMinutes: 60 } }));
    await pendiente;
    expect(estado.trayectos()).toEqual({});
    expect(estado.calculandoTrayectos()).toBe(false);
  });

  it('guarda el perfil actual antes de evaluar e invalida resultados al cambiar domicilio', async () => {
    const estado = TestBed.inject(EstadoService);
    const config = TestBed.inject(ConfiguracionService);
    config.ubicacion.set(domicilio);
    TestBed.tick();
    const peticiones: { url: string; body: any }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
      peticiones.push({ url, body: JSON.parse(init.body) });
      return respuesta(url === '/api/profile' ? {} : { recommended: [], withWarnings: [], excluded: [] });
    }));
    await estado.evaluar();
    expect(peticiones[0].url).toBe('/api/profile');
    expect(peticiones[0].body.homeLocation.latitude).toBe(domicilio.lat);
    expect(estado.resultado()).not.toBeNull();
    config.ubicacion.set(null);
    TestBed.tick();
    expect(estado.resultado()).toBeNull();
    expect(estado.comprobacion()).toBeNull();
    expect(estado.perfilGuardado()).toBe(false);
  });
});
