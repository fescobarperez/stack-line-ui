import { describe, expect, it } from 'vitest';
import { screenEnabled, moduleEnabled, sectionsInPlan } from './modules.js';

const BASICO = ['base', 'pos', 'fel'];

describe('módulos del plan', () => {
  it('las pantallas de base siempre; las demás según el plan', () => {
    expect(screenEnabled('dashboard', BASICO)).toBe(true);
    expect(screenEnabled('clients', BASICO)).toBe(true);
    expect(screenEnabled('pos', BASICO)).toBe(true);
    expect(screenEnabled('quotes', BASICO)).toBe(false);
    expect(screenEnabled('ledger', BASICO)).toBe(false);
  });

  it('sin lista (sesión vieja) no se oculta nada', () => {
    expect(screenEnabled('payroll', null)).toBe(true);
    expect(moduleEnabled('ai', null)).toBe(true);
  });

  it('las secciones sin pantallas del plan desaparecen', () => {
    const secs = [
      { section: 'A', items: [{ id: 'dashboard' }, { id: 'quotes' }] },
      { section: 'C', items: [{ id: 'accounting' }, { id: 'ledger' }] },
    ];
    expect(sectionsInPlan(secs, BASICO)).toEqual([{ section: 'A', items: [{ id: 'dashboard' }] }]);
  });
});
