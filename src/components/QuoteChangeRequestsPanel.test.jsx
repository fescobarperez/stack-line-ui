import { describe, it, expect } from 'vitest';
import { faltante } from './QuoteChangeRequestsPanel.jsx';

const MOTIVOS = [
  { code: 'politica_descuentos', label: 'Política de descuentos', clientText: 'Ese descuento supera lo autorizado.' },
  { code: 'otro', label: 'Otro motivo', clientText: null },
];

describe('faltante: lo que bloquea «Aplicar»', () => {
  const descuento = { kind: 'descuento' };
  const agregar = { kind: 'agregar' };
  const consulta = { kind: 'consulta' };

  it('sin decisión no bloquea: la solicitud queda pendiente', () => {
    expect(faltante(agregar, {}, MOTIVOS)).toBeNull();
  });
  it('rechazar exige un motivo del catálogo', () => {
    expect(faltante(agregar, { decision: 'rechazar' }, MOTIVOS)).toMatch(/motivo/);
    expect(faltante(agregar, { decision: 'rechazar', reasonCode: 'politica_descuentos' }, MOTIVOS)).toBeNull();
  });
  it('con «otro» el comentario es obligatorio y no puede ser un «no»', () => {
    expect(faltante(agregar, { decision: 'rechazar', reasonCode: 'otro', response: 'no' }, MOTIVOS)).toMatch(/15/);
    expect(faltante(agregar, { decision: 'rechazar', reasonCode: 'otro', response: 'El proveedor subió el precio' }, MOTIVOS)).toBeNull();
  });
  it('ajustar un descuento exige motivo y porcentaje', () => {
    expect(faltante(descuento, { decision: 'ajustar', reasonCode: 'politica_descuentos' }, MOTIVOS)).toMatch(/descuento/);
    expect(faltante(descuento, { decision: 'ajustar', reasonCode: 'politica_descuentos', adjustedDiscountPct: '5' }, MOTIVOS)).toBeNull();
  });
  it('ajustar una cantidad exige cantidad mayor que cero', () => {
    expect(faltante(agregar, { decision: 'ajustar', reasonCode: 'politica_descuentos', adjustedQuantity: '0' }, MOTIVOS)).toMatch(/cantidad/);
  });
  it('una consulta se responde con texto', () => {
    expect(faltante(consulta, { decision: 'responder' }, MOTIVOS)).toMatch(/respuesta/);
    expect(faltante(consulta, { decision: 'responder', response: 'El 5 % es el tope de la política' }, MOTIVOS)).toBeNull();
  });
  it('aceptar no exige mensaje', () => {
    expect(faltante(agregar, { decision: 'aceptar' }, MOTIVOS)).toBeNull();
  });
});
