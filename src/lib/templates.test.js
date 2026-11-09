import { describe, expect, it } from 'vitest';
import {
  slug, formulaVars, skuFromName, emptyTemplate, toForm, toPayload, validateTemplate, whenOptions, paramsPayload, parseConfig,
} from './templates.js';

const respuesta = {
  id: 7, productId: 3, productName: 'Pérgola', name: 'Pérgola a la medida', description: null, active: true, version: 2,
  params: [{ code: 'ancho', label: 'Ancho', unit: 'm', min: 1, max: 10, defaultValue: null, required: true },
    { code: 'profundidad', label: 'Profundidad', unit: 'm', min: 1, max: 10, defaultValue: 3, required: true }],
  options: [{ code: 'techo', label: 'Techo', required: true, choices: [
    { code: 'policarbonato', label: 'Policarbonato', renderText: null, benefit: null, isDefault: true },
    { code: 'shingle', label: 'Shingle', renderText: 'techo de shingle', benefit: 'más fresco', isDefault: false }] }],
  components: [{ productId: 40, productName: 'Poste', unit: 'unid', option: null, choice: null, formula: '(ceil(ancho/1.5)+1)*2', wastePct: 0, roundUp: true, group: 'Estructura' },
    { productId: 41, productName: 'Shingle', unit: 'm2', option: 'techo', choice: 'shingle', formula: 'ancho*profundidad', wastePct: 10, roundUp: false, group: 'Techo' }],
  presets: [{ code: 'premium', label: 'Premium', choices: { techo: 'shingle' } }],
};

describe('plantillas de cálculo', () => {
  it('código desde la etiqueta y variables de una fórmula', () => {
    expect(slug('Profundidad (m)')).toBe('profundidad_m');
    expect(slug('Ñandú 2')).toBe('nandu_2');
    expect(formulaVars('(ceil(ancho/1.5)+1)*2 + max(alto, x)')).toEqual(['ancho', 'alto', 'x']);
  });

  it('ida y vuelta: respuesta → formulario → cuerpo', () => {
    const f = toForm(respuesta);
    expect(f.components[1].when).toBe('techo:shingle');
    const p = toPayload(f);
    expect(p.components[1]).toMatchObject({ productId: 41, option: 'techo', choice: 'shingle', wastePct: 10 });
    expect(p.components[0]).toMatchObject({ option: null, choice: null, roundUp: true });
    expect(p.params[1]).toMatchObject({ code: 'profundidad', defaultValue: 3, min: 1 });
    expect(p.presets[0].choices).toEqual({ techo: 'shingle' });
    expect(validateTemplate(f)).toEqual({});
  });

  it('marca la fila exacta que está mal', () => {
    const f = toForm(respuesta);
    f.components[0].formula = 'ancho * largo';
    f.params[1].code = 'ancho';
    f.options[0].choices[1].isDefault = true;
    const e = validateTemplate(f);
    expect(e[`components.${f.components[0].key}.formula`]).toMatch('largo');
    expect(e[`params.${f.params[1].key}.code`]).toBe('Repetido');
    expect(e[`options.${f.options[0].key}.choices`]).toBe('Solo una por defecto');
  });

  it('plantilla nueva vacía no se puede guardar', () => {
    const e = validateTemplate(emptyTemplate());
    expect(e.productId).toBeTruthy();
    expect(e.name).toBeTruthy();
  });

  it('opciones de «solo si», parámetros y configuración', () => {
    expect(whenOptions(toForm(respuesta))).toEqual([
      { id: 'techo:policarbonato', name: 'Techo: Policarbonato' }, { id: 'techo:shingle', name: 'Techo: Shingle' }]);
    expect(paramsPayload({ ancho: '3', profundidad: '', alto: '2.5' })).toEqual({ ancho: 3, alto: 2.5 });
    expect(parseConfig('{"params":{"ancho":3}}')).toEqual({ params: { ancho: 3 } });
    expect(parseConfig('x')).toBeNull();
  });

  it('SKU sugerido para materia prima', () => {
    expect(skuFromName('Poste pino 4×4')).toBe('MP-POSTE-PINO-4X4');
    expect(skuFromName('')).toBe('');
  });
});
