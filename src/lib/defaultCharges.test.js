import { describe, expect, it } from 'vitest';
import { parseDefaultCharges, serializeDefaultCharges, validateDefaultCharges, previewDefaultCharges, newDefaultCharge } from './defaultCharges.js';

describe('cargos por defecto', () => {
  it('ida y vuelta con el JSON guardado', () => {
    const { rows: filas, profit } = parseDefaultCharges('[{"kind":"profit","calcType":"percent","value":30},{"categoryId":3,"description":null,"calcType":"percent","value":10},{"categoryId":4,"calcType":"fixed","value":50}]');
    expect(profit).toEqual({ calcType: 'percent', value: '30' });
    expect(filas.map((f) => [f.categoryId, f.calcType, f.value])).toEqual([['3', 'percent', '10'], ['4', 'fixed', '50']]);
    expect(JSON.parse(serializeDefaultCharges(filas, profit))).toEqual([
      { kind: 'profit', calcType: 'percent', value: 30 },
      { categoryId: 3, description: null, calcType: 'percent', value: 10 },
      { categoryId: 4, description: null, calcType: 'fixed', value: 50 },
    ]);
    expect(parseDefaultCharges('roto').rows).toEqual([]);
    // Sin fila de ganancia toma la ganancia sugerida anterior.
    expect(parseDefaultCharges('', '25').profit).toEqual({ calcType: 'percent', value: '25' });
    // Ganancia vacía no se guarda.
    expect(JSON.parse(serializeDefaultCharges([], { calcType: 'percent', value: '' }))).toEqual([]);
  });

  it('valida concepto y valor', () => {
    const a = { ...newDefaultCharge(), categoryId: '', value: '10' };
    const b = { ...newDefaultCharge(), categoryId: '3', calcType: 'percent', value: '150' };
    const c = { ...newDefaultCharge(), categoryId: '3', calcType: 'fixed', value: '0' };
    const ok = { ...newDefaultCharge(), categoryId: '3', calcType: 'fixed', value: '25' };
    const e = validateDefaultCharges([a, b, c, ok]);
    expect(e[a.key].categoryId).toBeTruthy();
    expect(e[b.key].value).toBe('Máximo 100 %');
    expect(e[c.key].value).toBe('Mayor que cero');
    expect(e[ok.key]).toBeUndefined();
    expect(validateDefaultCharges([], { calcType: 'percent', value: '-1' }).profit).toBeTruthy();
  });

  it('cada porcentaje sobre los productos, sin encadenarse', () => {
    const filas = [{ calcType: 'percent', value: '10' }, { calcType: 'percent', value: '20' }, { calcType: 'fixed', value: '50' }];
    expect(previewDefaultCharges(filas, 100)).toMatchObject({ montos: [10, 20, 50], total: 80 });
    // Ganancia 10 %: sobre costo total (100 + 80) o directo (100).
    expect(previewDefaultCharges(filas, 100, { calcType: 'percent', value: '10' }, 'total_cost').ganancia).toBe(18);
    expect(previewDefaultCharges(filas, 100, { calcType: 'percent', value: '10' }, 'direct_cost').ganancia).toBe(10);
  });
});
