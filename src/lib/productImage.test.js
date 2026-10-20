import { describe, it, expect } from 'vitest';
import { encajar, recorteCuadrado, validarArchivo, MAX_INPUT_BYTES } from './productImage.js';

describe('encajar', () => {
  it('reduce al lado mayor sin deformar', () => {
    expect(encajar(4000, 3000, 1000)).toEqual({ w: 1000, h: 750 });
    expect(encajar(3000, 4000, 1000)).toEqual({ w: 750, h: 1000 });
  });
  it('no agranda una imagen chica', () => {
    expect(encajar(400, 300, 1000)).toEqual({ w: 400, h: 300 });
  });
  it('medidas inválidas', () => {
    expect(encajar(0, 300, 1000)).toEqual({ w: 0, h: 0 });
  });
});

describe('recorteCuadrado', () => {
  it('centra el recorte', () => {
    expect(recorteCuadrado(400, 300)).toEqual({ sx: 50, sy: 0, lado: 300 });
    expect(recorteCuadrado(300, 500)).toEqual({ sx: 0, sy: 100, lado: 300 });
  });
});

describe('validarArchivo', () => {
  it('acepta jpg, png y webp', () => {
    expect(validarArchivo({ type: 'image/jpeg', size: 1000 })).toBeNull();
    expect(validarArchivo({ type: 'image/webp', size: 1000 })).toBeNull();
  });
  it('rechaza otros tipos, archivos enormes y nada', () => {
    expect(validarArchivo({ type: 'image/gif', size: 10 })).toBe('productImage.err.type');
    expect(validarArchivo({ type: 'application/pdf', size: 10 })).toBe('productImage.err.type');
    expect(validarArchivo({ type: 'image/png', size: MAX_INPUT_BYTES + 1 })).toBe('productImage.err.size');
    expect(validarArchivo(null)).toBe('productImage.err.none');
  });
});
