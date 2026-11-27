import { describe, expect, it } from 'vitest';
import { margenPct, sobre, pctTexto } from './margen.js';

describe('margen', () => {
  it('calcula el margen sobre el precio', () => {
    expect(margenPct(100, 60)).toBe(40);
    expect(margenPct('950', '0')).toBe(100);
    expect(margenPct(50, 80)).toBe(-60);
  });

  it('sin precio no hay margen (no NaN ni Infinity)', () => {
    expect(margenPct(0, 0)).toBeNull();
    expect(margenPct(0, 25)).toBeNull();
    expect(margenPct(null, 10)).toBeNull();
    expect(margenPct(undefined, undefined)).toBeNull();
  });

  it('porcentaje sobre una base, sin base no hay', () => {
    expect(sobre(25, 100)).toBe(25);
    expect(sobre(10, 0)).toBeNull();
    expect(sobre(0, 0)).toBeNull();
  });

  it('muestra «—» cuando no hay porcentaje', () => {
    expect(pctTexto(12.345)).toBe('12.3%');
    expect(pctTexto(null)).toBe('—');
    expect(pctTexto(NaN)).toBe('—');
    expect(pctTexto(Infinity)).toBe('—');
  });
});
