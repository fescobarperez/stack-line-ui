import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import TinoMark, { TINO_STATES } from './TinoMark.jsx';
import TinoCharacter, { TINO_POSES } from './TinoCharacter.jsx';
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

describe('TinoCharacter', () => {
  it('dibuja cada pose con la cabeza del símbolo', () => {
    for (const pose of TINO_POSES) {
      const { container, unmount } = render(<TinoCharacter pose={pose} animated={false} />);
      const svg = container.querySelector('svg');
      expect(svg.dataset.pose).toBe(pose);
      expect(container.querySelector('path[d="M32 6a20 20 0 1 1-20 20V6z"]')).not.toBeNull();
      unmount();
    }
  });

  it('cada pose agrega lo suyo: lupa, documento, destellos', () => {
    const lupa = render(<TinoCharacter pose="thinking" animated={false} />).container;
    expect(lupa.querySelectorAll('circle').length).toBeGreaterThan(3);
    const doc = render(<TinoCharacter pose="quoting" animated={false} />).container;
    expect(doc.querySelector('rect[width="18"]')).not.toBeNull();
    const listo = render(<TinoCharacter pose="done" animated={false} />).container;
    expect(listo.querySelectorAll('path[d^="M0-3.2"]').length).toBe(3);
  });

  it('es decorativo sin título y una imagen con título', () => {
    const deco = render(<TinoCharacter />).container.querySelector('svg');
    expect(deco.getAttribute('aria-hidden')).toBe('true');
    const img = render(<TinoCharacter title="Tino saluda" />).container.querySelector('svg');
    expect(img.getAttribute('role')).toBe('img');
    expect(img.getAttribute('aria-label')).toBe('Tino saluda');
  });

  it('quieto no lleva clases de animación', () => {
    const { container } = render(<TinoCharacter pose="done" animated={false} />);
    expect(container.querySelector('[class*="tino-c-"]')).toBeNull();
  });

  it('con halo usa un filtro propio', () => {
    const { container } = render(<TinoCharacter halo />);
    const id = container.querySelector('filter').id;
    expect(container.querySelector(`g[filter="url(#${id})"]`)).not.toBeNull();
  });

  it('una pose desconocida cae en reposo', () => {
    const { container } = render(<TinoCharacter pose="bailando" animated={false} />);
    expect(container.querySelector('circle[r="3.6"]')).not.toBeNull();
  });
});
