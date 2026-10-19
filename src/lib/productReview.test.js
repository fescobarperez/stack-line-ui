import { describe, expect, it } from 'vitest';
import { approvalPayload, dimensionsText, parsePrice, validateApproval } from './productReview.js';

describe('revisión de productos propuestos', () => {
  it('el precio debe ser un número mayor que cero, con hasta dos decimales', () => {
    expect(parsePrice('1,500.50')).toBe(1500.5);
    expect(parsePrice('2000')).toBe(2000);
    expect(parsePrice('0')).toBeNull();
    expect(parsePrice('')).toBeNull();
    expect(parsePrice('-5')).toBeNull();
    expect(parsePrice('1.234')).toBeNull();
    expect(parsePrice('abc')).toBeNull();
  });

  it('sin precio no se puede aprobar', () => {
    expect(validateApproval({ price: '', sku: '' })).toEqual({ price: 'productReview.errors.price' });
    expect(validateApproval({ price: '1500', sku: 'PER-01' })).toEqual({});
    expect(validateApproval({ price: '1500', sku: 'x'.repeat(41) }).sku).toBeDefined();
  });

  it('el SKU solo se manda si cambió', () => {
    expect(approvalPayload({ price: '1500', categoryId: '3', sku: 'ASIS-1' }, 'ASIS-1'))
      .toEqual({ action: 'approve', price: 1500, categoryId: 3, sku: null });
    expect(approvalPayload({ price: '1500', categoryId: '', sku: ' PER-01 ' }, 'ASIS-1'))
      .toEqual({ action: 'approve', price: 1500, categoryId: null, sku: 'PER-01' });
  });

  it('medidas en texto', () => {
    expect(dimensionsText({ height: 2.5, width: 3, depth: 4.5, dimensionUnit: 'm' })).toBe('2.5 × 3 × 4.5 m');
    expect(dimensionsText({ height: null, width: 3, depth: null })).toBe('3 m');
    expect(dimensionsText({})).toBeNull();
  });
});
