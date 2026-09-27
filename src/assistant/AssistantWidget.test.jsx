import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '../i18n/index.js';
import i18n from 'i18next';
import { ConfirmProvider } from '../components/ConfirmDialog.jsx';
import AssistantWidget from './AssistantWidget.jsx';
import { crearAgentClient } from '../api/agent.js';
import { crearSimulador } from './simulator.js';

function montar() {
  const cliente = crearAgentClient({ simulado: true, simulador: crearSimulador({ demoraMs: 0 }) });
  return render(
    <ConfirmProvider>
      <AssistantWidget cliente={cliente} />
    </ConfirmProvider>,
  );
}

describe('AssistantWidget · chat', () => {
  beforeEach(async () => {
    sessionStorage.clear();
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
