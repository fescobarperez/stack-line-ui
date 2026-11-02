import { describe, expect, it } from 'vitest';
import {
  addDiagnosis, bmi, dueLabel, encounterPayload, encounterToForm, followUpDate, painTrend, removeDiagnosis,
  setPrimary, signErrors, vitalsErrors, vitalsSummary,
} from './clinical.js';

const CONSULTA = {
  id: 7, status: 'borrador', caseId: null, newCaseTitle: null, openCases: [{ id: 3, title: 'Migraña' }],
  subjective: 'Dolor de cabeza', vitals: { bpSystolic: 120, bpDiastolic: 80, temperature: 36.8, weightKg: 70, heightCm: 170, painScore: 7 },
  diagnoses: [{ code: 'G43.9', description: 'Migraña', primary: true }],
  prescriptions: [{ medication: 'Ibuprofeno 400 mg', dose: '1 tableta', route: 'oral', frequency: 'cada 8 h', durationDays: 5 }],
  followUpDays: 15, followUpTypeId: 2, followUpNotes: 'Ver dolor',
};

describe('clínica · formulario de la consulta', () => {
  it('ida y vuelta: lo que llega del backend sale igual en el cuerpo', () => {
    const f = encounterToForm(CONSULTA);
    expect(f.caseMode).toBe('existing'); // tiene casos abiertos para elegir
    expect(f.vitals.temperature).toBe('36.8');
    const p = encounterPayload({ ...f, caseId: 3 });
    expect(p.caseId).toBe(3);
    expect(p.newCaseTitle).toBeNull();
    expect(p.vitals).toMatchObject({ bpSystolic: 120, temperature: 36.8, painScore: 7, spo2: null });
    expect(p.prescriptions[0]).toMatchObject({ medication: 'Ibuprofeno 400 mg', durationDays: 5, quantity: null });
    expect(p).toMatchObject({ followUpDays: 15, followUpTypeId: 2, followUpNotes: 'Ver dolor' });
  });

  it('acepta coma decimal, descarta recetas vacías y sin control no manda el plan', () => {
    const f = encounterToForm({ ...CONSULTA, openCases: [] });
    expect(f.caseMode).toBe('new');
    const p = encounterPayload({
      ...f, newCaseTitle: '  Migraña ', followUp: false,
      vitals: { ...f.vitals, temperature: '37,5' },
      prescriptions: [...f.prescriptions, { medication: '  ', dose: '' }],
    });
    expect(p.newCaseTitle).toBe('Migraña');
    expect(p.vitals.temperature).toBe(37.5);
    expect(p.prescriptions).toHaveLength(1);
    expect(p.followUpDays).toBeNull();
    expect(p.followUpTypeId).toBeNull();
  });

  it('dice qué falta para firmar', () => {
    const f = encounterToForm({ ...CONSULTA, subjective: '', diagnoses: [], openCases: [] });
    expect(signErrors(f)).toEqual([
      'Escribe el motivo de consulta.',
      'Agrega un diagnóstico o escribe el análisis.',
      'Indica a qué caso pertenece la consulta.',
    ]);
    const ok = encounterToForm({ ...CONSULTA, openCases: [] });
    expect(signErrors({ ...ok, newCaseTitle: 'Migraña' })).toEqual([]);
    expect(signErrors({ ...ok, newCaseTitle: 'Migraña', followUpDays: '0' })).toEqual(['El control va de 1 a 365 días.']);
  });

  it('marca los signos vitales fuera de rango', () => {
    expect(vitalsErrors({ bpSystolic: '120', bpDiastolic: '80', temperature: '36.5' })).toEqual({});
    expect(Object.keys(vitalsErrors({ temperature: '365', spo2: 'x' }))).toEqual(['temperature', 'spo2']);
    expect(vitalsErrors({ bpSystolic: '90', bpDiastolic: '95' }).bpDiastolic).toMatch(/menor/);
  });

  it('calcula el IMC y resume los signos', () => {
    expect(bmi('70', '170')).toBe(24.2);
    expect(bmi('', '170')).toBeNull();
    expect(vitalsSummary({ bpSystolic: 120, bpDiastolic: 80, temperature: 36.8, weightKg: 70, bmi: 24.2 }))
      .toBe('120/80 mmHg · 36.8 °C · 70 kg · IMC 24.2');
  });
});

describe('clínica · diagnósticos', () => {
  it('el primero es el principal, no se repiten y el principal se pasa al quitarlo', () => {
    let l = addDiagnosis([], { code: 'g43.9', description: 'Migraña' });
    l = addDiagnosis(l, { code: 'G43.9', description: 'Migraña otra vez' });
    l = addDiagnosis(l, { code: '', description: 'Gastritis' });
    expect(l.map((d) => [d.code, d.primary])).toEqual([['G43.9', true], ['', false]]);
    l = setPrimary(l, 1);
    expect(l.map((d) => d.primary)).toEqual([false, true]);
    l = removeDiagnosis(l, 1);
    expect(l).toEqual([{ code: 'G43.9', description: 'Migraña', primary: true }]);
  });
});

describe('clínica · seguimiento', () => {
  it('la evolución del dolor va de la consulta más vieja a la más nueva', () => {
    expect(painTrend([
      { status: 'firmada', signedAt: '2026-11-20T10:00:00Z', vitals: { painScore: 2 } },
      { status: 'firmada', signedAt: '2026-11-01T10:00:00Z', vitals: { painScore: 7 } },
      { status: 'borrador', createdAt: '2026-11-25T10:00:00Z', vitals: { painScore: 0 } },
      { status: 'firmada', signedAt: '2026-11-10T10:00:00Z', vitals: { painScore: 4 } },
    ])).toBe('7 → 4 → 2');
    expect(painTrend([{ status: 'firmada', vitals: { painScore: 5 } }])).toBe('');
  });

  it('describe el vencimiento del control y elige la fecha para agendarlo', () => {
    expect(dueLabel(0)).toBe('Vence hoy');
    expect(dueLabel(1)).toBe('Vence en 1 día');
    expect(dueLabel(-3)).toBe('Venció hace 3 días');
    expect(followUpDate('2026-11-20', '2026-11-01')).toBe('2026-11-20');
    expect(followUpDate('2026-10-20', '2026-11-01')).toBe('2026-11-01');
  });
});
