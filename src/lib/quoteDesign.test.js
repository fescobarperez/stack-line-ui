import { describe, expect, it } from 'vitest';
import { designRows, measuresText } from './quoteDesign.js';

describe('diseño aprobado en la cotización', () => {
  it('medidas con las que existan', () => {
    expect(measuresText({ alto: 2.5, ancho: 3, profundidad: 4.5 })).toBe('2.5 × 3 × 4.5 m (alto × ancho × prof.)');
    expect(measuresText({ ancho: '3.00' })).toBe('3 m (ancho)');
    expect(measuresText({})).toBeNull();
  });

  it('filas solo con valor y detalles al final', () => {
    const filas = designRows({ tipo: 'Pérgola', material: '', acabado: 'caoba', alto: 2.5, detalles: { aguas: '1', deck: '' } });
    expect(filas.map((f) => f[2])).toEqual(['Pérgola', 'caoba', '2.5 m (alto)', '1']);
    expect(filas[3][1]).toBe('Aguas');
    expect(designRows(null)).toEqual([]);
  });
});
