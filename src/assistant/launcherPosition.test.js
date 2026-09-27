import { describe, it, expect } from 'vitest';
import {
  ANCLA_INICIAL, LADO, MARGEN, SEPARACION,
  acotarAVentana, anclaMasCercana, colocacionWidget, coordsDesdeAncla,
} from './launcherPosition.js';

const vista = { ancho: 1280, alto: 800 };

describe('posición del lanzador', () => {
  it('por defecto vive abajo a la derecha, a 20 px de los bordes', () => {
    expect(coordsDesdeAncla(ANCLA_INICIAL, vista)).toEqual({ x: 1280 - MARGEN - LADO, y: 800 - MARGEN - LADO });
  });

  it('al soltarlo se pega al borde más cercano', () => {
    expect(anclaMasCercana({ x: 30, y: 400 }, vista).borde).toBe('left');
    expect(anclaMasCercana({ x: 1200, y: 400 }, vista).borde).toBe('right');
    expect(anclaMasCercana({ x: 600, y: 5 }, vista).borde).toBe('top');
    expect(anclaMasCercana({ x: 600, y: 730 }, vista).borde).toBe('bottom');
  });

  it('conserva dónde se soltó a lo largo del borde', () => {
    const ancla = anclaMasCercana({ x: 10, y: 370 }, vista);
    const { x, y } = coordsDesdeAncla(ancla, vista);
    expect(x).toBe(MARGEN);
    expect(y).toBeCloseTo(370, 0);
  });

  it('el ancla sobrevive a un cambio de tamaño sin salirse de la ventana', () => {
    const ancla = anclaMasCercana({ x: 1210, y: 720 }, vista);
    const chica = { ancho: 800, alto: 600 };
    const { x, y } = coordsDesdeAncla(ancla, chica);
    expect(x + LADO + MARGEN).toBe(800);
    expect(y + LADO).toBeLessThanOrEqual(600 - MARGEN);
  });

  it('mientras se arrastra no sale de la ventana', () => {
    expect(acotarAVentana({ x: -50, y: 2000 }, vista)).toEqual({ x: 0, y: 800 - LADO });
  });
});

describe('colocación del widget', () => {
  it('abajo a la derecha: se abre arriba del lanzador, alineado a la derecha', () => {
    const e = colocacionWidget({ x: 1200, y: 720 }, vista);
    expect(e.right).toBe(20);
    expect(e.left).toBe('auto');
    expect(e.bottom).toBe(800 - 720 + SEPARACION);
    expect(e.top).toBe('auto');
  });

  it('arriba a la izquierda: se abre debajo, alineado a la izquierda', () => {
    const e = colocacionWidget({ x: 20, y: 20 }, vista);
    expect(e.left).toBe(20);
    expect(e.top).toBe(20 + LADO + SEPARACION);
    expect(e.bottom).toBe('auto');
  });

  it('el alto se ajusta al espacio disponible, con un mínimo', () => {
    expect(colocacionWidget({ x: 20, y: 20 }, { ancho: 1280, alto: 600 }).height).toBe(600 - (20 + LADO + SEPARACION) - MARGEN);
    expect(colocacionWidget({ x: 20, y: 20 }, { ancho: 1280, alto: 2000 }).height).toBe(660);
    expect(colocacionWidget({ x: 20, y: 300 }, { ancho: 1280, alto: 500 }).height).toBe(320);
  });
});
