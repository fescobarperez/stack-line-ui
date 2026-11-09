import { describe, expect, it } from 'vitest';
import { stockPorSucursal } from './branchStock.js';

describe('stockPorSucursal', () => {
  it('suma los lotes de cada sucursal y muestra las que no tienen existencias', () => {
    const filas = [
      { branchId: 1, branchName: 'Central', quantity: 10, batch: 'L1', expiry: '2026-12-01' },
      { branchId: 1, branchName: 'Central', quantity: 2.5, batch: null },
      { branchId: 3, branchName: 'Bodega vieja', quantity: 4, batch: 'L9' },
    ];
    const r = stockPorSucursal(filas, [{ id: 1, name: 'Central' }, { id: 2, name: 'Zona 10' }]);
    expect(r).toEqual([
      { branchId: 1, branchName: 'Central', quantity: 12.5, lots: [{ batch: 'L1', expiry: '2026-12-01' }] },
      { branchId: 2, branchName: 'Zona 10', quantity: 0, lots: [] },
      { branchId: 3, branchName: 'Bodega vieja', quantity: 4, lots: [{ batch: 'L9', expiry: null }] },
    ]);
  });
});
