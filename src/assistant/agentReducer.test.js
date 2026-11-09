import { describe, it, expect, vi } from 'vitest';
import { agentReducer, aplicarEventos, estadoInicial, vistaPanel, hayBorradorSinEnviar } from './agentReducer.js';

const inicial = () => estadoInicial({ saludo: 'Buen día', sugerencias: [{ id: 'c0', label: 'Consultar stock' }] });
const req = (llave = 'k1') => ({ idempotency_key: llave });
const responder = (s, events, avisar) => agentReducer(s, { type: 'respuesta', response: { conversation_id: 'cnv_1', events }, avisar });

describe('estado inicial', () => {
  it('trae el saludo y las sugerencias, y el panel vacío', () => {
    const s = inicial();
    expect(s.messages).toEqual([{ id: 1, role: 'bot', text: 'Buen día' }]);
    expect(s.choices).toHaveLength(1);
    expect(vistaPanel(s.panel)).toBe('vacio');
  });
});

describe('enviar', () => {
  it('agrega el mensaje del usuario, marca el turno en curso y limpia las sugerencias', () => {
    const s = agentReducer(inicial(), { type: 'enviar', request: req(), textoUsuario: 'Hola' });
    expect(s.pending).toBe(true);
    expect(s.choices).toEqual([]);
    expect(s.messages.at(-1)).toMatchObject({ role: 'user', text: 'Hola' });
    expect(s.lastRequest).toEqual(req());
  });

  it('no permite un segundo envío mientras hay un turno en curso', () => {
    const s1 = agentReducer(inicial(), { type: 'enviar', request: req('a'), textoUsuario: 'uno' });
    const s2 = agentReducer(s1, { type: 'enviar', request: req('b'), textoUsuario: 'dos' });
    expect(s2).toBe(s1);
  });

  it('una acción del panel no agrega burbuja de usuario', () => {
    const s = agentReducer(inicial(), { type: 'enviar', request: req() });
    expect(s.messages).toHaveLength(1);
  });
});

describe('eventos', () => {
  it('text agrega una burbuja del asistente y guarda el id de conversación', () => {
    const s = responder(agentReducer(inicial(), { type: 'enviar', request: req() }), [{ type: 'text', text: 'Hola' }]);
    expect(s.pending).toBe(false);
    expect(s.conversationId).toBe('cnv_1');
    expect(s.messages.at(-1)).toMatchObject({ role: 'bot', text: 'Hola' });
  });

  it('choices reemplaza las sugerencias', () => {
    const s = responder(inicial(), [{ type: 'choices', items: [{ id: 'x', label: 'Sí' }] }]);
    expect(s.choices).toEqual([{ id: 'x', label: 'Sí' }]);
  });

  it('product_results lleva el panel a productos', () => {
    const s = responder(inicial(), [{ type: 'card', card: 'product_results', data: { items: [{ sku: 'A' }] } }]);
    expect(s.panel.products).toEqual([{ sku: 'A' }]);
    expect(vistaPanel(s.panel)).toBe('productos');
  });

  it('customer llena la tarjeta de cliente', () => {
    const s = responder(inicial(), [{ type: 'card', card: 'customer', data: { name: 'La Ceiba' } }]);
    expect(s.panel.customer).toEqual({ name: 'La Ceiba' });
    expect(vistaPanel(s.panel)).toBe('cliente');
  });

  it('quote_preview reemplaza la cotización anterior entera, sin mezclar líneas', () => {
    let s = responder(inicial(), [{ type: 'card', card: 'quote_preview', data: { number: 'C1', lines: [{ id: 'a' }, { id: 'b' }] } }]);
    s = responder(s, [{ type: 'card', card: 'quote_preview', data: { number: 'C1', lines: [{ id: 'a' }] } }]);
    expect(s.panel.quote.lines).toEqual([{ id: 'a' }]);
    expect(vistaPanel(s.panel)).toBe('cotizacion');
    expect(hayBorradorSinEnviar(s)).toBe(true);
  });

  it('quote_sent confirma en el chat y en el panel', () => {
    let s = responder(inicial(), [{ type: 'card', card: 'quote_preview', data: { number: 'C1', lines: [] } }]);
    s = responder(s, [{ type: 'card', card: 'quote_sent', data: { number: 'C1', status: 'Enviada' } }]);
    expect(s.panel.sent).toEqual({ number: 'C1', status: 'Enviada' });
    expect(s.messages.at(-1)).toMatchObject({ role: 'notice', data: { number: 'C1' } });
    expect(hayBorradorSinEnviar(s)).toBe(false);
  });

  it('una cotización nueva después de enviada vuelve a estar sin enviar', () => {
    let s = responder(inicial(), [{ type: 'card', card: 'quote_sent', data: { number: 'C1' } }]);
    s = responder(s, [{ type: 'card', card: 'quote_preview', data: { number: 'C2', lines: [] } }]);
    expect(s.panel.sent).toBeNull();
  });

  it('document habilita el PDF', () => {
    const s = responder(inicial(), [{ type: 'document', document: { url: '/cot.pdf' } }]);
    expect(s.panel.pdfUrl).toBe('/cot.pdf');
  });

  it('un evento o una tarjeta desconocidos no rompen nada y se avisan', () => {
    const avisar = vi.fn();
    const antes = inicial();
    const s = responder(antes, [
      { type: 'video', url: 'x' },
      { type: 'card', card: 'invoice', data: {} },
      { type: 'text', text: 'sigue' },
    ], avisar);
    expect(avisar).toHaveBeenCalledWith('evento', 'video');
    expect(avisar).toHaveBeenCalledWith('tarjeta', 'invoice');
    expect(s.messages.at(-1)).toMatchObject({ text: 'sigue' });
    expect(s.panel).toEqual(antes.panel);
  });
});

describe('errores y reintento', () => {
  it('un error de red deja el reintento con la misma petición', () => {
    let s = agentReducer(inicial(), { type: 'enviar', request: req('llave-1'), textoUsuario: 'hola' });
    s = agentReducer(s, { type: 'fallo', status: 0 });
    expect(s.error).toBe('retry');
    expect(s.pending).toBe(false);
    expect(s.lastRequest.idempotency_key).toBe('llave-1');

    // El reintento reenvía la misma petición y no duplica la burbuja.
    const mensajes = s.messages.length;
    s = agentReducer(s, { type: 'enviar', request: s.lastRequest });
    expect(s.lastRequest.idempotency_key).toBe('llave-1');
    expect(s.messages).toHaveLength(mensajes);
    expect(s.error).toBeNull();
  });

  it('403 es sin permiso, no reintento', () => {
    const s = agentReducer(agentReducer(inicial(), { type: 'enviar', request: req() }), { type: 'fallo', status: 403 });
    expect(s.error).toBe('forbidden');
  });
});

describe('confirmación y nueva conversación', () => {
  it('pedir y cancelar la confirmación del envío', () => {
    let s = agentReducer(inicial(), { type: 'pedirConfirmacion' });
    expect(s.confirmSend).toBe(true);
    s = agentReducer(s, { type: 'cancelarConfirmacion' });
    expect(s.confirmSend).toBe(false);
  });

  it('enviar limpia la confirmación pendiente', () => {
    let s = agentReducer(inicial(), { type: 'pedirConfirmacion' });
    s = agentReducer(s, { type: 'enviar', request: req() });
    expect(s.confirmSend).toBe(false);
  });

  it('nueva conversación descarta todo', () => {
    let s = responder(inicial(), [{ type: 'card', card: 'quote_preview', data: { number: 'C1', lines: [] } }]);
    s = agentReducer(s, { type: 'nueva', inicial: inicial() });
    expect(s.conversationId).toBeNull();
    expect(vistaPanel(s.panel)).toBe('vacio');
  });

  it('restaurar nunca deja un turno colgado en curso', () => {
    const s = agentReducer(inicial(), { type: 'restaurar', estado: { ...inicial(), pending: true } });
    expect(s.pending).toBe(false);
  });
});

describe('aplicarEventos', () => {
  it('ignora eventos nulos', () => {
    expect(() => aplicarEventos(inicial(), [null, undefined], () => {})).not.toThrow();
  });
});
