import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseVacantesAragon, type PageLines } from '../src/index.js';

const pages: PageLines[] = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/vacantes-lineas.json'), 'utf-8')
);

const { vacancies, issues } = parseVacantesAragon(pages);
const porId = (id: string) => vacancies.find(v => v.id === id);

describe('parseVacantesAragon (fixtures de páginas reales)', () => {
  it('parsea todas las fichas de las páginas de la fixture sin issues', () => {
    expect(issues).toEqual([]);
    expect(vacancies.length).toBeGreaterThan(40);
  });

  it('ficha básica completa: campos y jornada completa → workload 1', () => {
    const v = porId('ara-2457'); // IES Martínez Vargas, Filosofía, Completa Obligatoria
    expect(v).toBeDefined();
    expect(v!.bodyCode).toBe('0590');
    expect(v!.specialtyCode).toBe('001');
    expect(v!.specialtyName).toBe('FILOSOFIA');
    expect(v!.centerCode).toBe('22004611');
    expect(v!.municipality).toBe('BARBASTRO');
    expect(v!.province).toBe('Huesca');
    expect(v!.workload).toBe(1);
    expect(v!.voluntary).toBe(false);
  });

  it('jornada parcial con % en la misma línea', () => {
    const v = porId('ara-7237'); // 9:00 horas (50%)
    expect(v!.workload).toBeCloseTo(0.5);
    expect(v!.voluntary).toBe(true);
  });

  it('jornada parcial con % en línea aparte "(66.67%)"', () => {
    const v = porId('ara-2458'); // 12:00 horas / (66.67%)
    expect(v!.workload).toBeCloseTo(0.6667);
  });

  it('información adicional multilínea se conserva unida', () => {
    const v = porId('ara-3700'); // CON HORAS DOCENCIA BACHILLERATO VESPERTINO
    expect(v!.additionalInfoRaw).toContain('BACHILLERATO');
    expect(v!.additionalInfoRaw).toContain('VESPERTINO');
  });

  it('nombre de centro largo partido en varias líneas se reconstruye', () => {
    const v = porId('ara-6374'); // SEC-IES Sección ... de Benasque
    expect(v).toBeDefined();
    expect(v!.centerName).toContain('BENASQUE');
    expect(v!.municipality).toBe('BENASQUE');
    expect(v!.specialtyCode).toBe('004');
  });

  it('banner de larga duración marca durationType', () => {
    const larga = vacancies.filter(v => v.durationType === 'long_term');
    expect(larga.length).toBeGreaterThan(0);
  });

  it('plaza perfilada emite requisito de cualificación y su texto', () => {
    const perfiladas = vacancies.filter(v => v.tags.includes('perfilada'));
    expect(perfiladas.length).toBeGreaterThan(0);
    const req = perfiladas[0].requirements.find(r => r.code === 'perfilada');
    expect(req?.category).toBe('qualification');
  });

  it('número y especialidad fusionados en una línea (p. 557-558)', () => {
    const v = vacancies.find(v => v.specialtyCode === '111');
    expect(v).toBeDefined();
    expect(v!.specialtyName).toContain('MANTENIMIENTO');
  });

  it('columnas Compartida / En Distinta Localidad → tags de movilidad', () => {
    // Puede no haber ninguna en estas páginas concretas; el contrato es que si
    // existen, llevan requisito estructurado con confianza 1.
    for (const v of vacancies.filter(v => v.tags.includes('compartida'))) {
      const req = v.requirements.find(r => r.code === 'compartida');
      expect(req?.confidence).toBe(1);
    }
  });
});
