import { describe, expect, it } from 'vitest';
import { buildDetectedConditions, extractFromAdditionalInfo } from '../src/index.js';

describe('extractFromAdditionalInfo — vocabulario real de Aragón', () => {
  it('"CON HORAS DE ECONOMÍA" → asignatura dinámica', () => {
    const r = extractFromAdditionalInfo('CON HORAS DE ECONOMÍA');
    expect(r.tags).toContain('asignatura:economia');
    const req = r.requirements.find(x => x.code === 'asignatura:economia');
    expect(req?.category).toBe('asignatura');
    expect(req?.label).toContain('Economía');
  });

  it('"CON HORAS DOCENCIA BACHILLERATO VESPERTINO" → horario de tarde, NO asignatura', () => {
    const r = extractFromAdditionalInfo('CON HORAS DOCENCIA BACHILLERATO VESPERTINO');
    expect(r.tags).toContain('afternoon');
    expect(r.tags.filter(t => t.startsWith('asignatura:'))).toEqual([]);
  });

  it('"CON HORAS EN CFGB" → FP, no asignatura', () => {
    const r = extractFromAdditionalInfo('CON HORAS EN CFGB');
    expect(r.tags).toContain('fp');
    expect(r.tags.filter(t => t.startsWith('asignatura:'))).toEqual([]);
  });

  it('"CULTURA CLÁSICA" suelta → asignatura con confianza baja (revisión)', () => {
    const r = extractFromAdditionalInfo('CULTURA CLÁSICA');
    expect(r.tags).toContain('asignatura:cultura_clasica');
    const req = r.requirements.find(x => x.code === 'asignatura:cultura_clasica');
    expect(req?.confidence).toBeLessThan(0.7);
  });

  it('"IMPARTE PROGRAMA DE APRENDIZAJE INCLUSIVO" → PAI', () => {
    expect(extractFromAdditionalInfo('IMPARTE PROGRAMA DE APRENDIZAJE INCLUSIVO').tags).toContain('pai');
  });

  it('"IMPARTE DIVERSIFICACIÓN CURRICULAR" → programa diversificación', () => {
    expect(extractFromAdditionalInfo('IMPARTE DIVERSIFICACIÓN CURRICULAR').tags).toContain('diversificacion');
  });

  it('"FPB", "FPGB", "CICLO FORMATIVO DE GRADO BÁSICO" → fp', () => {
    for (const texto of ['DOCENCIA EN FPB', 'FPGB', 'IMPARTE CICLO FORMATIVO DE GRADO BÁSICO']) {
      expect(extractFromAdditionalInfo(texto).tags).toContain('fp');
    }
  });

  it('"NECESARIO SUPERAR ENTREVISTA" → condición entrevista', () => {
    const r = extractFromAdditionalInfo('NECESARIO SUPERAR ENTREVISTA');
    expect(r.tags).toContain('entrevista');
    expect(r.tags.filter(t => t.startsWith('asignatura:'))).toEqual([]);
  });

  it('"REQUISITO C1 INGLÉS O TITULACIÓN EQUIVALENTE" → requisito de inglés', () => {
    const r = extractFromAdditionalInfo('Requisitos: REQUISITO C1 INGLÉS O TITULACIÓN EQUIVALENTE');
    expect(r.tags).toContain('bilingual_en');
  });

  it('"CATALÁN. TITULACIÓN NIVEL AVANZADO (C1)…" → requisito de catalán', () => {
    const r = extractFromAdditionalInfo(
      'CATALÁN. TITULACIÓN NIVEL AVANZADO (C1) EXPEDIDO POR LA E.O.I. O TÍTULO OFICIAL EQUIVALENTE'
    );
    expect(r.tags).toContain('bilingual_ca');
  });

  it('"CON B1 EN COMPETENCIA DIGITAL DOCENTE" → cualificación digital', () => {
    expect(extractFromAdditionalInfo('CON B1 EN COMPETENCIA DIGITAL DOCENTE').tags).toContain('competencia_digital');
  });

  it('"TURNO DIURNO/VESPERTINO/NOCTURNO" → afternoon y nada más raro', () => {
    const r = extractFromAdditionalInfo('TURNO DIURNO/VESPERTINO/NOCTURNO');
    expect(r.tags).toContain('afternoon');
    expect(r.tags.filter(t => t.startsWith('asignatura:'))).toEqual([]);
  });

  it('"DUAL/VIRTUAL/DISTANCIA" → fp_dual y virtual', () => {
    const r = extractFromAdditionalInfo('DUAL/VIRTUAL/DISTANCIA');
    expect(r.tags).toContain('fp_dual');
    expect(r.tags).toContain('virtual');
  });

  it('"TODO EL CURSO" no genera asignaturas fantasma', () => {
    const r = extractFromAdditionalInfo('DIURNO Y VESPERTINO. TODO EL CURSO.');
    expect(r.tags.filter(t => t.startsWith('asignatura:'))).toEqual([]);
  });
});

describe('buildDetectedConditions', () => {
  it('agrega y cuenta condiciones obligatorias por convocatoria', () => {
    const va = extractFromAdditionalInfo('CON HORAS DE ECONOMÍA. HORARIO VESPERTINO');
    const vb = extractFromAdditionalInfo('HORARIO VESPERTINO');
    const detected = buildDetectedConditions([
      { requirements: va.requirements },
      { requirements: vb.requirements }
    ]);
    const afternoon = detected.find(c => c.tag === 'afternoon');
    const economia = detected.find(c => c.tag === 'asignatura:economia');
    expect(afternoon?.count).toBe(2);
    expect(economia?.count).toBe(1);
    // Ordenado por frecuencia descendente.
    expect(detected[0].tag).toBe('afternoon');
  });
});
