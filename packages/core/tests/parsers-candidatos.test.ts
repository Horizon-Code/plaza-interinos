import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findCandidateSpecialties, normalizeName, type CandidatosPage } from '../src/index.js';

const pages: CandidatosPage[] = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/candidatos-paginas.json'), 'utf-8')
);

describe('findCandidateSpecialties (fixtures de páginas reales)', () => {
  it('encuentra a un candidato y extrae cuerpo, especialidad y orden', () => {
    const matches = findCandidateSpecialties(pages, 'MARTINEZ GONZALEZ, ROSA');
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      bodyCode: '0590',
      bodyName: 'PROFESORES DE ENSEÑANZA SECUNDARIA',
      specialtyCode: '001',
      specialtyName: 'FILOSOFIA',
      page: 1
    });
    expect(matches[0].orden).toBe(1);
  });

  it('la búsqueda ignora acentos y mayúsculas', () => {
    const matches = findCandidateSpecialties(pages, 'martínez gonzález, rosa');
    expect(matches).toHaveLength(1);
  });

  it('deduplica por cuerpo+especialidad aunque aparezca en varias páginas', () => {
    // ROYO BORRUEL, BEATRIZ está en la página 2 de la misma especialidad.
    const matches = findCandidateSpecialties(pages, 'ROYO BORRUEL, BEATRIZ');
    expect(matches).toHaveLength(1);
    expect(matches[0].page).toBe(2);
  });

  it('nombre inexistente → sin resultados', () => {
    expect(findCandidateSpecialties(pages, 'INVENTADO PERSONA, NADIE')).toEqual([]);
  });

  it('normalizeName colapsa espacios y quita diacríticos', () => {
    expect(normalizeName('  Gárcía   López,  Ána ')).toBe('GARCIA LOPEZ, ANA');
  });
});
