import { describe, expect, it } from 'vitest';
import { formatDimensions, mapQuote } from './useQuotes.js';

/**
 * Mapeo de la cotización del ERP a lo que usan las pantallas.
 * Lo nuevo de la medida especial: `customSize` (difiere del catálogo) y
 * `sizePricing` ('calculated' = precio por medida · 'review' = por cotizar).
 */
describe('mapQuote', () => {
  const erp = {
    id: 9,
    docNumber: 'COT-000009',
    total: '29120.00',
    priceDisplay: 'global',
    deliveryAddress: 'Zona 10',
    items: [
      {
        id: 1, productName: 'Pérgola', quantity: '1', unitPrice: '22406.25',
        dimensions: { height: 2.5, width: 3, depth: 4.5 }, baseDimensions: { height: 2.4, width: 3, depth: 4 },
        customSize: true, sizePricing: 'calculated',
      },
      { id: 2, productName: 'Pérgola grande', quantity: '1', unitPrice: '0', customSize: true, sizePricing: 'review' },
      { id: 3, productName: 'Mano de obra', quantity: '5', showToClient: false },
    ],
  };

  it('marca cómo se calculó el precio de cada medida especial', () => {
    const [calculada, porCotizar, normal] = mapQuote(erp).items;
    expect(calculada.sizePricing).toBe('calculated');
    expect(calculada.unitPrice).toBe(22406.25);
    expect(porCotizar.sizePricing).toBe('review');
    expect(normal.sizePricing).toBeNull();
    expect(normal.customSize).toBe(false);
  });

  it('respeta las líneas internas y la presentación global', () => {
    const q = mapQuote(erp);
    expect(q.priceDisplay).toBe('global');
    expect(q.deliveryAddress).toBe('Zona 10');
    expect(q.items.map((i) => i.showToClient)).toEqual([true, true, false]);
  });

  it('sin datos opcionales usa valores seguros', () => {
    const q = mapQuote({ id: 1, docNumber: 'COT-1', items: [{ productName: 'X' }] });
    expect(q.priceDisplay).toBe('detailed');
    expect(q.deliveryAddress).toBe('');
    expect(q.items[0]).toMatchObject({ qty: 0, unitPrice: 0, dimensionUnit: 'm', showToClient: true, sizePricing: null });
  });
});

describe('formatDimensions', () => {
  it('une las medidas presentes con su unidad', () => {
    expect(formatDimensions({ height: 2.5, width: 3, depth: 4.5 })).toBe('2.5 × 3 × 4.5 m');
    expect(formatDimensions({ height: 1.8 }, 'cm')).toBe('1.8 cm');
  });

  it('sin medidas devuelve vacío', () => {
    expect(formatDimensions(null)).toBe('');
    expect(formatDimensions({})).toBe('');
  });
});
