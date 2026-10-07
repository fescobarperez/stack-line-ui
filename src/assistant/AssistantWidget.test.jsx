import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '../i18n/index.js';
import i18n from 'i18next';
import { ConfirmProvider } from '../components/ConfirmDialog.jsx';
import AssistantWidget from './AssistantWidget.jsx';
import { crearSimulador } from '../test/guionAgente.js';

function montar() {
  const cliente = crearSimulador({ demoraMs: 0 });
  return render(
    <ConfirmProvider>
      <AssistantWidget cliente={cliente} />
    </ConfirmProvider>,
  );
}

describe('AssistantWidget · lanzador', () => {
  beforeEach(async () => {
    sessionStorage.clear();
    localStorage.clear();
    await i18n.changeLanguage('es');
  });

  it('Tino se asoma en reposo y saluda al pasar el puntero', async () => {
    const user = userEvent.setup();
    montar();
    const lanzador = screen.getByRole('button', { name: 'Abrir asistente comercial' });
    expect(lanzador.querySelector('svg[data-pose]').dataset.pose).toBe('idle');
    await user.hover(lanzador);
    expect(lanzador.querySelector('svg[data-pose]').dataset.pose).toBe('hello');
    await user.unhover(lanzador);
    expect(lanzador.querySelector('svg[data-pose]').dataset.pose).toBe('idle');
  });
});

describe('AssistantWidget · chat', () => {
  beforeEach(async () => {
    sessionStorage.clear();
    localStorage.clear();
    await i18n.changeLanguage('es');
  });

  it('arranca colapsado y el lanzador lo abre con el saludo', async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole('button', { name: 'Abrir asistente comercial' }));
    const log = screen.getByRole('log');
    expect(within(log).getByText(/Puedo consultar productos/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Mensaje para el asistente' })).toHaveFocus();
  });

  it('Enter envía, muestra la respuesta y trae nuevas sugerencias', async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole('button', { name: 'Abrir asistente comercial' }));
    await user.type(screen.getByRole('textbox', { name: 'Mensaje para el asistente' }), '¿Hay stock del mueble de TV?{Enter}');

    expect(screen.getByText('¿Hay stock del mueble de TV?')).toBeInTheDocument();
    expect(await screen.findByText(/Encontré 2 coincidencias/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cotice 4 unidades/ })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Mensaje para el asistente' })).toHaveValue('');
  });

  it('Shift+Enter hace salto de línea sin enviar', async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole('button', { name: 'Abrir asistente comercial' }));
    const campo = screen.getByRole('textbox', { name: 'Mensaje para el asistente' });
    await user.type(campo, 'línea uno{Shift>}{Enter}{/Shift}línea dos');
    expect(campo).toHaveValue('línea uno\nlínea dos');
  });

  it('una sugerencia es un turno', async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole('button', { name: 'Abrir asistente comercial' }));
    await user.click(screen.getByRole('button', { name: 'Consultar stock y precio de un producto' }));
    expect(await screen.findByText(/Encontré 2 coincidencias/)).toBeInTheDocument();
  });

  it('Esc lo colapsa y el foco vuelve al lanzador', async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole('button', { name: 'Abrir asistente comercial' }));
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Abrir asistente comercial' })).toHaveFocus();
  });

  it('un clic fuera del widget lo cierra, sin robar el foco', async () => {
    const user = userEvent.setup();
    const { container } = montar();
    const fuera = document.createElement('button');
    fuera.textContent = 'Otro módulo';
    document.body.appendChild(fuera);

    await user.click(screen.getByRole('button', { name: 'Abrir asistente comercial' }));
    await user.click(fuera);

    expect(screen.queryByRole('log')).not.toBeInTheDocument();
    expect(fuera).toHaveFocus();
    fuera.remove();
    expect(container).toBeTruthy();
  });

  it('un clic dentro del widget no lo cierra', async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole('button', { name: 'Abrir asistente comercial' }));
    await user.click(screen.getByRole('log'));
    expect(screen.getByRole('log')).toBeInTheDocument();
  });

  it('el lanzador abierto cierra con un solo clic', async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole('button', { name: 'Abrir asistente comercial' }));
    await user.click(screen.getByRole('button', { name: 'Cerrar asistente' }));
    expect(screen.queryByRole('log')).not.toBeInTheDocument();
  });

  it('arrastrar el lanzador lo mueve y al soltarlo se pega al borde, sin abrirse', () => {
    montar();
    const lanzador = screen.getByRole('button', { name: 'Abrir asistente comercial' });
    fireEvent.pointerDown(lanzador, { clientX: 1000, clientY: 700, button: 0, pointerId: 1 });
    fireEvent.pointerMove(lanzador, { clientX: 30, clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(lanzador, { clientX: 30, clientY: 300, pointerId: 1 });
    fireEvent.click(lanzador);

    // Soltar no es un clic: sigue cerrado, y quedó pegado al borde izquierdo.
    expect(screen.queryByRole('log')).not.toBeInTheDocument();
    expect(lanzador.style.left).toBe('20px');
    expect(JSON.parse(localStorage.getItem('maya_assistant_anchor')).borde).toBe('left');

    // El siguiente clic, sin arrastre, sí abre.
    fireEvent.click(lanzador);
    expect(screen.getByRole('log')).toBeInTheDocument();
  });

  it('la conversación sobrevive a desmontar y volver a montar', async () => {
    const user = userEvent.setup();
    const { unmount } = montar();
    await user.click(screen.getByRole('button', { name: 'Abrir asistente comercial' }));
    await user.type(screen.getByRole('textbox', { name: 'Mensaje para el asistente' }), 'hola{Enter}');
    await screen.findByText(/Encontré 2 coincidencias/);
    unmount();

    montar();
    // Sigue abierto y con la conversación, como al cambiar de módulo.
    expect(screen.getByText(/Encontré 2 coincidencias/)).toBeInTheDocument();
  });
});
