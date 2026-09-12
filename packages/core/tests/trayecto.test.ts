import { describe, expect, it } from 'vitest';
import {
  AVISO_TRAYECTO_APROXIMADO,
  claveCentroTrayecto,
  corregirMinutosRuta,
  formatearTrayecto,
  ordenarEnCascada,
  type FilaOrdenable
} from '../src/index.js';

describe('trayectos en todas las vistas', () => {
  it('distingue ausentes, parciales y cero; usa decimales españoles', () => {
    expect(formatearTrayecto({})).toBe('Trayecto sin calcular');
    expect(formatearTrayecto({ distanceKm: 123.5, travelMinutes: 76 })).toBe('76 min · 123,5 km');
    expect(formatearTrayecto({ distanceKm: 0, travelMinutes: 0 })).toBe('0 min · 0 km');
    expect(formatearTrayecto({ distanceKm: 10 })).toBe('10 km');
    expect(formatearTrayecto({ travelMinutes: 12 })).toBe('12 min');
    expect(formatearTrayecto({ distanceKm: NaN, travelMinutes: -1 })).toBe('Trayecto sin calcular');
  });

  it('ordena según minutos o kilómetros y deja ausentes al final en ambos sentidos', () => {
    const corta: FilaOrdenable = { vacancy: { voluntary: false }, distanceKm: 30, travelMinutes: 50 };
    const rapida: FilaOrdenable = { vacancy: { voluntary: false }, distanceKm: 45, travelMinutes: 30 };
    const desconocida: FilaOrdenable = { vacancy: { voluntary: false } };
    const filas = [desconocida, corta, rapida];
    const cerca = [{ criterio: 'distance', direccion: 'cerca-primero' }] as const;
    expect(ordenarEnCascada(filas, [...cerca], {}, [], [], 'km')).toEqual([corta, rapida, desconocida]);
    expect(ordenarEnCascada(filas, [...cerca], {}, [], [], 'minutes')).toEqual([rapida, corta, desconocida]);
    expect(ordenarEnCascada(filas, [{ criterio: 'distance', direccion: 'lejos-primero' }], {}, [], [], 'minutes'))
      .toEqual([corta, rapida, desconocida]);
  });

  it('corrige el tiempo a velocidad libre del router', () => {
    // 4 + 0,90·t. Ni el arranque ni el aparcar dependen de lo lejos que esté.
    expect(corregirMinutosRuta(10)).toBeCloseTo(13, 6);
    expect(corregirMinutosRuta(60)).toBeCloseTo(58, 6);
    // Sin ruta no hay nada que corregir: 4 minutos de la nada serían mentira.
    expect(corregirMinutosRuta(0)).toBe(0);
    expect(corregirMinutosRuta(-5)).toBe(0);
    expect(corregirMinutosRuta(NaN)).toBe(0);
  });

  it('acerca los minutos a los reales en toda la escala, no solo en un tramo', () => {
    // Pares [OSRM, referencia] de centros reales de Aragón, repartidos de 1,4 a
    // 136 km. Congela la calibración: si alguien toca los coeficientes y empeora
    // el ajuste, esto se cae. Los datos y el método están en `trayecto.ts`.
    const muestra: [number, number][] = [
      [4, 6], [7, 12], [8, 14], [10, 15], [10, 12], [10, 16], [13, 15], [13, 15],
      [14, 17], [18, 19], [18, 22], [26, 24], [27, 28], [29, 26], [38, 38],
      [44, 44], [56, 56], [61, 57], [90, 82], [96, 88]
    ];
    const error = (f: (t: number) => number) =>
      muestra.reduce((s, [osrm, real]) => s + Math.abs(f(osrm) - real), 0) / muestra.length;

    const sinCorregir = error(t => t);
    const corregido = error(corregirMinutosRuta);
    expect(corregido).toBeLessThan(sinCorregir / 1.5);
    expect(corregido).toBeLessThan(2);

    // El sesgo por tramo también se va, que es lo que se notaba en las vistas:
    // corto en ciudad, largo en carretera.
    const sesgo = (desde: number, hasta: number) => {
      const t = muestra.filter(([osrm]) => osrm >= desde && osrm < hasta);
      return t.reduce((s, [osrm, real]) => s + corregirMinutosRuta(osrm) / real, 0) / t.length;
    };
    expect(sesgo(0, 15)).toBeGreaterThan(0.85);
    expect(sesgo(0, 15)).toBeLessThan(1.15);
    expect(sesgo(40, 999)).toBeGreaterThan(0.85);
    expect(sesgo(40, 999)).toBeLessThan(1.15);
  });

  it('avisa de que los minutos son aproximados y los kilómetros no', () => {
    expect(AVISO_TRAYECTO_APROXIMADO).toMatch(/aproximados/);
    expect(AVISO_TRAYECTO_APROXIMADO).toMatch(/kil[óo]metros/i);
  });

  it('cruza los trayectos por centro, que es lo que navegador y API nombran igual', () => {
    // El navegador saca las vacantes del PDF (`ara-7671`) y la API las tiene con
    // su cuid: por id no casa ninguna y todo sale "sin calcular". El centro sí.
    expect(claveCentroTrayecto('50019986')).toBe('50019986');
    expect(claveCentroTrayecto(' 50019986 ')).toBe('50019986');
    // Un cero perdido a la izquierda no puede romper el cruce.
    expect(claveCentroTrayecto('9986')).toBe('00009986');
    // Sin centro no hay ruta que cruzar, y '' no debe colisionar con nada.
    expect(claveCentroTrayecto('')).toBeUndefined();
    expect(claveCentroTrayecto(undefined)).toBeUndefined();
    expect(claveCentroTrayecto(null)).toBeUndefined();

    // Dos vacantes del mismo instituto comparten trayecto.
    expect(claveCentroTrayecto('44005177')).toBe(claveCentroTrayecto(' 44005177'));
  });
});
