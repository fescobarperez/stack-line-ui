import { describe, expect, it } from 'vitest';
import { isCustomSize, lineDimensions } from './QuoteDraftEditModal.jsx';
import { formatDimensions } from '../hooks/useQuotes.js';

const base = { height: 1.8, width: 1.5, depth: 0.5 };

describe('medidas de la línea', () => {
  it('sin medidas escritas no manda nada (se conservan)', () => {
    expect(lineDimensions({ height: '', width: '', depth: '' })).toBeNull();
  });

  it('manda solo números positivos', () => {
    expect(lineDimensions({ height: '2', width: '1.5', depth: '' })).toEqual({ height: 2, width: 1.5, depth: null });
  });

  it('marca medida especial solo si difiere del catálogo', () => {
    expect(isCustomSize({ height: '1.8', width: '1.5', depth: '0.5', base })).toBe(false);
    expect(isCustomSize({ height: '2', width: '1.5', depth: '0.6', base })).toBe(true);
    expect(isCustomSize({ height: '2', width: '1', depth: '1', base: null })).toBe(false);
  });

  it('formatea alto × ancho × profundidad', () => {
    expect(formatDimensions({ height: 2, width: 1.5, depth: 0.6 })).toBe('2 × 1.5 × 0.6 m');
    expect(formatDimensions(null)).toBe('');
  });
});
