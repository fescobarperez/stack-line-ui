// Stackline — Cliente del asistente comercial.
//
// El front NO habla directo con maya-agent-service: ese servicio autentica con
// una api-key que no puede vivir en el navegador. Llama a /api/agent/turn del
// backend del ERP, que valida el JWT de la sesión, agrega la credencial y el
// usuario, y reenvía a POST /v1/agent/turn.
import { api } from './client.js';

export const RUTA_TURNO = '/api/agent/turn';
export const TIEMPO_LIMITE_MS = 50000;

/** Lo que este canal sabe pintar; el agente adapta la respuesta a esto. */
export const CAPACIDADES = { buttons: 6, markdown: true, max_chars: 20000, streaming: false, panel: true };

/**
 * @param {object}  opts
 * @param {object}  opts.http  cliente con post(path, body, opts) — inyectable en tests
 */
export function crearAgentClient({ http = api, tiempoLimiteMs = TIEMPO_LIMITE_MS } = {}) {
  return {
    async turn(body) {
      const control = new AbortController();
      const reloj = setTimeout(() => control.abort(), tiempoLimiteMs);
      try {
        // silent: el widget tiene su propio indicador; el velo global de
        // carga taparía la pantalla en cada pregunta.
        return await http.post(RUTA_TURNO, body, { silent: true, signal: control.signal });
      } finally {
        clearTimeout(reloj);
      }
    },

    /** El estado de la conversación vive en el servidor; aquí no hay nada que limpiar. */
    reset() {},
  };
}

/**
 * Arma el cuerpo de un turno. La llave se genera UNA vez por intento.
 * conversationKey identifica la conversación en este navegador; el ERP le
 * antepone el usuario de la sesión antes de reenviarla al agente.
 */
export function armarTurno({ conversationKey, input, nuevaLlave = () => crypto.randomUUID() }) {
  return {
    channel: 'erp',
    conversation_ref: { external_id: conversationKey ?? null },
    input,
    capabilities: CAPACIDADES,
    idempotency_key: nuevaLlave(),
  };
}

export const agentClient = crearAgentClient();
