import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import TinoMark, { TINO_STATES } from './TinoMark.jsx';
import { estadoTino } from './tinoState.js';
import { estadoInicial } from './agentReducer.js';

const base = estadoInicial({ saludo: 'hola' });

describe('estadoTino · ciclo de la conversación', () => {
  it('reposo por defecto', () => {
    expect(estadoTino({ state: base })).toBe('idle');
  });
  it('escucha mientras el usuario escribe', () => {
    expect(estadoTino({ state: base, escribiendo: true })).toBe('listening');
  });
  it('piensa mientras espera al agente, aunque el usuario siga escribiendo', () => {
    expect(estadoTino({ state: { ...base, pending: true }, escribiendo: true })).toBe('thinking');
  });
  it('responde o se alegra según el gesto temporal', () => {
    expect(estadoTino({ state: base, gesto: 'responding' })).toBe('responding');
    expect(estadoTino({ state: base, gesto: 'happy' })).toBe('happy');
  });
  it('duda cuando el turno falló', () => {
    expect(estadoTino({ state: { ...base, error: 'retry' } })).toBe('confused');
  });
});

describe('TinoMark', () => {
  it('dibuja cada estado sobre la misma silueta', () => {
    for (const state of TINO_STATES) {
      const { container, unmount } = render(<TinoMark state={state} />);
      const svg = container.querySelector('svg');
      expect(svg.dataset.state).toBe(state);
      expect(svg.querySelector('path').getAttribute('d')).toBe('M12 4a8 8 0 1 1-8 8V4z');
      unmount();
    }
  });

  it('un estado desconocido cae en reposo', () => {
    const { container } = render(<TinoMark state="bailando" />);
    expect(container.querySelector('svg').dataset.state).toBe('idle');
  });

  it('sin animar no lleva clases de animación', () => {
    const { container } = render(<TinoMark state="thinking" animated={false} />);
    expect(container.querySelector('[class*="tino-look"]')).toBeNull();
  });

  it('en contenedor el símbolo ocupa ~60 % del diámetro', () => {
    const { container } = render(<TinoMark size={60} container />);
    expect(container.querySelector('.tino-container').style.width).toBe('60px');
    expect(container.querySelector('svg').getAttribute('width')).toBe('36');
  });

  it('el ojo crece en tamaños chicos para que se lea', () => {
    const { container } = render(<TinoMark size={16} animated={false} />);
    expect(container.querySelector('circle').getAttribute('r')).toBe('2.6');
  });
});
