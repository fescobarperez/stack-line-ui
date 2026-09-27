import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '../i18n/index.js';
import i18n from 'i18next';
import { ConfirmProvider } from '../components/ConfirmDialog.jsx';
import AssistantWidget from './AssistantWidget.jsx';
import { crearAgentClient } from '../api/agent.js';
import { crearSimulador } from './simulator.js';

function montar() {
  const base = crearAgentClient({ simulado: true, simulador: crearSimulador({ demoraMs: 0 }) });
  const cliente = { ...base, turn: vi.fn((body) => base.turn(body)) };
  render(
    <ConfirmProvider>
      <AssistantWidget cliente={cliente} />
    </ConfirmProvider>,
  );
  return cliente;
}

const panel = () => screen.getByRole('complementary', { name: 'Panel de trabajo' });
const ultimoInput = (cliente) => cliente.turn.mock.calls.at(-1)[0].input;

async function abrirYPreguntar(user) {
  await user.click(screen.getByRole('button', { name: 'Abrir asistente comercial' }));
  await user.type(screen.getByRole('textbox', { name: 'Mensaje para el asistente' }), 'stock del mueble{Enter}');
  await screen.findByText(/Encontré 2 coincidencias/);
}

describe('AssistantWidget · panel de trabajo', () => {
  beforeEach(async () => {
    sessionStorage.clear();
    await i18n.changeLanguage('es');
  });

  it('sin tarjetas no hay panel', async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole('button', { name: 'Abrir asistente comercial' }));
    expect(screen.queryByRole('complementary', { name: 'Panel de trabajo' })).not.toBeInTheDocument();
  });

  it('recorre vacío → productos → cliente → cotización → enviada', async () => {
    const user = userEvent.setup();
    const cliente = montar();
    await abrirYPreguntar(user);

    // Productos: el panel se abre solo, con el conteo y los montos del evento.
    expect(within(panel()).getByText('Resultados del catálogo')).toBeInTheDocument();
    expect(within(panel()).getByText('2 coincidencias')).toBeInTheDocument();
    expect(within(panel()).getByText('Q 2,450.00')).toBeInTheDocument();

    // Añadir a cotización viaja como acción, no como texto.
    await user.click(within(panel()).getAllByRole('button', { name: /Añadir a cotización/ })[0]);
    expect(ultimoInput(cliente)).toEqual({ type: 'action', action_id: 'add_line', payload: { sku: 'MUE-TV-180' } });
    expect(await within(panel()).findByText('Datos del cliente')).toBeInTheDocument();
    expect(within(panel()).getByText('NIT 1234567-8')).toBeInTheDocument();

    // Cotización: número, líneas y totales tal como llegan.
    await user.click(screen.getByRole('button', { name: /Los datos son correctos/ }));
    expect(await within(panel()).findByText('Cotización en construcción')).toBeInTheDocument();
    expect(within(panel()).getByText('IVA 12 % incluido')).toBeInTheDocument();
    expect(within(panel()).getByText('Q 10,400.00')).toBeInTheDocument();
    expect(within(panel()).getByRole('button', { name: /Ver PDF/ })).toBeEnabled();

    // Enviar: el primer clic solo pide confirmación.
    const llamadas = cliente.turn.mock.calls.length;
    await user.click(within(panel()).getByRole('button', { name: /Enviar al cliente/ }));
    expect(cliente.turn.mock.calls.length).toBe(llamadas);
    await user.click(within(panel()).getByRole('button', { name: /Confirmar envío/ }));
    expect(ultimoInput(cliente)).toEqual({ type: 'action', action_id: 'send_quote', payload: { number: 'COT-2026-0418' } });

    // Enviada: confirmación en el panel y en el chat, sin acciones de edición.
    expect(await within(panel()).findByText(/Enviada el 27\/09\/2026/)).toBeInTheDocument();
    expect(within(screen.getByRole('log')).getByText(/Cotización COT-2026-0418 enviada por/)).toBeInTheDocument();
    expect(within(panel()).queryByRole('button', { name: /Editar/ })).not.toBeInTheDocument();
  });

  it('la confirmación del envío se puede cancelar', async () => {
    const user = userEvent.setup();
    montar();
    await abrirYPreguntar(user);
    await user.click(screen.getByRole('button', { name: /Cotice 4 unidades/ }));
    await user.click(await screen.findByRole('button', { name: /Los datos son correctos/ }));
    await within(panel()).findByText('Cotización en construcción');

    await user.click(within(panel()).getByRole('button', { name: /Enviar al cliente/ }));
    await user.click(within(panel()).getByRole('button', { name: 'Cancelar' }));
    expect(within(panel()).getByRole('button', { name: /Enviar al cliente/ })).toBeInTheDocument();
  });

  it('el panel se oculta y se vuelve a mostrar desde el chat', async () => {
    const user = userEvent.setup();
    montar();
    await abrirYPreguntar(user);
    await user.click(within(panel()).getByRole('button', { name: 'Ocultar panel' }));
    expect(screen.queryByRole('complementary', { name: 'Panel de trabajo' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mostrar panel de trabajo' }));
    expect(panel()).toBeInTheDocument();
  });
});
