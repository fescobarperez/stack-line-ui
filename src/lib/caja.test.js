import { describe, expect, it } from 'vitest';
import {
  chargeErrors, chargePayload, followUpBuckets, initialCharge, packageSummary, parseAmount, planProgress, reportRange, split,
} from './caja.js';

describe('reparto del cobro', () => {
  it('sin anticipo se factura todo', () => {
    expect(split(350, 50, 500, false)).toEqual({ total: 300, credit: 0, cash: 300, method: 'venta' });
  });
  it('el anticipo cubre lo que alcance y el resto se factura', () => {
    expect(split(300, 0, 120.5, true)).toEqual({ total: 300, credit: 120.5, cash: 179.5, method: 'mixto' });
    expect(split(300, 0, 500, true)).toEqual({ total: 300, credit: 300, cash: 0, method: 'anticipo' });
  });
  it('sin decimales flotantes raros', () => {
    expect(split(0.3, 0.1, 0, false).total).toBe(0.2);
  });
});

describe('formulario de cobro', () => {
  const opts = { price: 350, creditBalance: 0, cashRegisterOpen: true, packages: [] };

  it('arranca en paquete si hay uno que sirve, si no en factura', () => {
    expect(initialCharge({ ...opts, packages: [{ id: 4 }] })).toMatchObject({ mode: 'paquete', patientPackageId: 4 });
    expect(initialCharge(opts)).toMatchObject({ mode: 'venta', price: '350', useCredit: false });
    expect(initialCharge({ ...opts, creditBalance: 100 }).useCredit).toBe(true);
  });

  it('valida precio, descuento, caja abierta y cortesía', () => {
    const f = initialCharge(opts);
    expect(chargeErrors(f, opts)).toEqual([]);
    expect(chargeErrors({ ...f, price: '' }, opts)).toEqual(['Indica el precio.']);
    expect(chargeErrors({ ...f, discount: '400' }, opts)).toEqual(['El descuento no puede ser mayor que el precio.']);
    expect(chargeErrors({ ...f, discount: '350' }, opts)[0]).toMatch(/cortesía/);
    expect(chargeErrors(f, { ...opts, cashRegisterOpen: false })[0]).toMatch(/Caja y Cortes/);
    // con anticipo suficiente no hace falta caja
    expect(chargeErrors({ ...f, useCredit: true }, { ...opts, creditBalance: 500, cashRegisterOpen: false })).toEqual([]);
    expect(chargeErrors({ ...f, mode: 'cortesia', notes: ' ' }, opts)).toEqual(['Indica el motivo de la cortesía.']);
    expect(chargeErrors({ ...f, mode: 'paquete', patientPackageId: '' }, opts)).toEqual(['Elige el paquete.']);
  });

  it('arma el cuerpo de cada modo', () => {
    expect(chargePayload({ mode: 'paquete', patientPackageId: '4', notes: '' })).toEqual({ patientPackageId: 4, notes: null });
    expect(chargePayload({ mode: 'cortesia', price: '350', notes: ' Familiar ' })).toEqual({ courtesy: true, price: 350, notes: 'Familiar' });
    expect(chargePayload({ mode: 'venta', price: '350,50', discount: '', useCredit: true, paymentMethod: 'tarjeta', notes: '' }))
      .toEqual({ price: 350.5, discount: null, useCredit: true, paymentMethod: 'tarjeta', notes: null });
  });

  it('lee montos con coma', () => {
    expect(parseAmount('1,5')).toBe(1.5);
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNaN();
  });
});

describe('paquetes y planes', () => {
  it('resume el paquete', () => {
    expect(packageSummary({ sessionsLeft: 7, sessionsTotal: 10, expiresOn: '2026-12-31' }))
      .toBe('7 de 10 sesiones disponibles · vence el 31/12/2026');
    expect(packageSummary({ sessionsLeft: 1, sessionsTotal: 5 })).toBe('1 de 5 sesiones disponibles');
  });
  it('progreso del plan', () => {
    expect(planProgress({ sessions: 10, done: 3 })).toBe(30);
    expect(planProgress(null)).toBe(0);
  });
});

describe('reportes y controles', () => {
  it('periodos rápidos', () => {
    expect(reportRange('month', '2026-11-18')).toEqual({ from: '2026-11-01', to: '2026-11-30' });
    expect(reportRange('lastMonth', '2026-03-05')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    // miércoles 18/11/2026: semana de domingo 15 a sábado 21
    expect(reportRange('week', '2026-11-18')).toEqual({ from: '2026-11-15', to: '2026-11-21' });
    expect(reportRange('last30', '2026-11-30')).toEqual({ from: '2026-11-01', to: '2026-11-30' });
    expect(reportRange('today', '2026-11-18')).toEqual({ from: '2026-11-18', to: '2026-11-18' });
  });
  it('agrupa la bandeja de controles', () => {
    const b = followUpBuckets([{ id: 1, daysLeft: -3 }, { id: 2, daysLeft: 0 }, { id: 3, daysLeft: 7 }, { id: 4, daysLeft: 12 }]);
    expect(b.overdue.map((x) => x.id)).toEqual([1]);
    expect(b.week.map((x) => x.id)).toEqual([2, 3]);
    expect(b.later.map((x) => x.id)).toEqual([4]);
  });
});
