// Stackline — Asistente comercial: estado de la conversación.
//
// Reductor PURO: recibe los eventos neutrales que devuelve el agente
// (POST /v1/agent/turn → { conversation_id, turn_id, events, state, usage }) y
// los convierte en lo que pinta el widget. Aquí no se calcula nada de negocio:
// precios, impuestos y totales llegan ya resueltos y formateados en el evento.
//
// Regla del panel: refleja la ÚLTIMA tarjeta recibida de cada tipo. La
// cotización no se reconstruye sumando líneas en el cliente.

/** Tarjetas que alimentan el panel de trabajo. */
export const CARDS = {
  PRODUCTOS: 'product_results',
  CLIENTE: 'customer',
  COTIZACION: 'quote_preview',
  ENVIADA: 'quote_sent',
};

const panelVacio = () => ({ products: null, customer: null, quote: null, sent: null, pdfUrl: null });

/**
 * @param {object} opts
 * @param {string} opts.saludo       primer mensaje del asistente (ya traducido)
 * @param {Array}  opts.sugerencias  pastillas iniciales [{ id, label }]
 */
export function estadoInicial({ saludo = '', sugerencias = [], conversationKey = null } = {}) {
  return {
    conversationKey,
    conversationId: null,
    seq: saludo ? 1 : 0,
    messages: saludo ? [{ id: 1, role: 'bot', text: saludo }] : [],
    choices: sugerencias,
    pending: false,
    /** null | 'retry' | 'forbidden' */
    error: null,
    /** El último cuerpo enviado: el reintento lo reenvía con la MISMA idempotency_key. */
    lastRequest: null,
    panel: panelVacio(),
    /** Primer clic de "Enviar al cliente": pide confirmación antes del turno. */
    confirmSend: false,
  };
}

function agregarMensaje(s, mensaje) {
  const seq = s.seq + 1;
  return { ...s, seq, messages: [...s.messages, { id: seq, ...mensaje }] };
}

/** Aplica los eventos de un turno. Un tipo o una tarjeta desconocidos se ignoran. */
export function aplicarEventos(state, events = [], avisar = avisoDesconocido) {
  let s = { ...state, panel: { ...state.panel }, choices: [] };
  for (const ev of events) {
    switch (ev?.type) {
      case 'text':
        if (ev.text) s = agregarMensaje(s, { role: 'bot', text: ev.text });
        break;
      case 'choices':
        s.choices = Array.isArray(ev.items) ? ev.items : [];
        break;
      case 'document':
        s.panel = { ...s.panel, pdfUrl: ev.document?.url ?? ev.url ?? null };
        break;
      case 'card':
        s = aplicarTarjeta(s, ev, avisar);
        break;
      default:
        avisar('evento', ev?.type);
    }
  }
  return s;
}

function aplicarTarjeta(s, ev, avisar) {
  const data = ev.data ?? {};
  switch (ev.card) {
    case CARDS.PRODUCTOS:
      return { ...s, panel: { ...s.panel, products: data.items ?? [] } };
    case CARDS.CLIENTE:
      return { ...s, panel: { ...s.panel, customer: data } };
    case CARDS.COTIZACION:
      // Reemplaza la anterior, y una cotización nueva todavía no está enviada.
      return { ...s, panel: { ...s.panel, quote: data, sent: null } };
    case CARDS.ENVIADA:
      return agregarMensaje({ ...s, panel: { ...s.panel, sent: data } }, { role: 'notice', data });
    default:
      avisar('tarjeta', ev.card);
      return s;
  }
}

function avisoDesconocido(clase, nombre) {
  // El contrato va a crecer: lo desconocido no rompe la UI, solo se registra.
  if (import.meta.env?.DEV) console.debug(`[asistente] ${clase} desconocido:`, nombre);
}

/**
 * Acciones:
 *   { type: 'enviar', request, textoUsuario? }
 *   { type: 'respuesta', response }
 *   { type: 'fallo', status }
 *   { type: 'pedirConfirmacion' } · { type: 'cancelarConfirmacion' }
 *   { type: 'restaurar', estado }
 *   { type: 'nueva', inicial }
 */
export function agentReducer(state, action) {
  switch (action.type) {
    case 'enviar': {
      if (state.pending) return state; // nunca dos turnos a la vez
      let s = { ...state, pending: true, error: null, choices: [], confirmSend: false, lastRequest: action.request };
      if (action.textoUsuario) s = agregarMensaje(s, { role: 'user', text: action.textoUsuario });
      return s;
    }
    case 'respuesta': {
      const r = action.response ?? {};
      const base = { ...state, pending: false, error: null, conversationId: r.conversation_id ?? state.conversationId };
      return aplicarEventos(base, r.events, action.avisar);
    }
    case 'fallo':
      return { ...state, pending: false, error: action.status === 403 ? 'forbidden' : 'retry' };
    case 'pedirConfirmacion':
      return { ...state, confirmSend: true };
    case 'cancelarConfirmacion':
      return { ...state, confirmSend: false };
    case 'restaurar':
      return { ...action.estado, pending: false };
    case 'nueva':
      return action.inicial;
    default:
      return state;
  }
}

/** Qué muestra el panel de trabajo, derivado del estado. */
export function vistaPanel(panel) {
  if (panel.quote) return 'cotizacion';
  if (panel.customer) return 'cliente';
  if (panel.products) return 'productos';
  return 'vacio';
}

/** Hay una cotización armada que todavía no se envió. */
export const hayBorradorSinEnviar = (state) => Boolean(state.panel.quote && !state.panel.sent);
