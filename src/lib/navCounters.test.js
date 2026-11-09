import { describe, it, expect } from 'vitest';
import { navCounter, sectionCounter } from './navCounters.js';

describe('navCounter', () => {
  const c = { billing: 142, returns: 0, inventory: 5, quotes: 3, cxc: 2 };

  it('muestra el número del backend', () => {
    expect(navCounter('quotes', c)).toEqual({ text: '3', alert: false });
  });
  it('marca como alerta stock y cuentas vencidas', () => {
    expect(navCounter('inventory', c)).toEqual({ text: '5', alert: true });
    expect(navCounter('cxc', c)).toEqual({ text: '2', alert: true });
  });
  it('limita a 99+', () => {
    expect(navCounter('billing', c).text).toBe('99+');
  });
  it('oculta ceros, faltantes y opciones sin contador', () => {
    expect(navCounter('returns', c)).toBeNull();
    expect(navCounter('cxp', c)).toBeNull();
    expect(navCounter('dashboard', c)).toBeNull();
    expect(navCounter('quotes', null)).toBeNull();
  });
});

describe('sectionCounter', () => {
  it('suma los pendientes de la sección', () => {
    expect(sectionCounter(['purchases', 'transfers', 'uom'], { purchases: 2, transfers: 1 }))
      .toEqual({ text: '3', alert: false });
  });
  it('es alerta si alguna opción de alerta tiene pendientes', () => {
    expect(sectionCounter(['inventory', 'purchases'], { inventory: 4, purchases: 2 }))
      .toEqual({ text: '6', alert: true });
  });
  it('limita a 99+ y oculta secciones sin pendientes', () => {
    expect(sectionCounter(['billing', 'returns'], { billing: 142, returns: 1 }).text).toBe('99+');
    expect(sectionCounter(['dashboard', 'pos'], { billing: 3 })).toBeNull();
    expect(sectionCounter(['billing'], null)).toBeNull();
  });
});
