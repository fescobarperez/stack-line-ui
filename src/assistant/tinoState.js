// Stackline — Estado de Tino a partir del ciclo de la conversación.
//
//   idle → listening (el usuario escribe) → thinking (esperando al agente)
//        → responding (llega el texto) → happy (cotización lista, 2 s) → idle
//   confused: el turno falló o falta un dato.
//
// Función pura: el hook del widget le pasa lo que es momentáneo (si el usuario
// escribe, si hay un gesto temporal en curso).

export const DURACION_RESPONDIENDO_MS = 1200;
export const DURACION_CONTENTO_MS = 2000;

/**
 * @param {object} p
 * @param {object} p.state       estado del reductor del asistente
 * @param {boolean} p.escribiendo el usuario tiene texto en el campo
 * @param {null|'responding'|'happy'} p.gesto  gesto temporal tras una respuesta
 */
export function estadoTino({ state, escribiendo = false, gesto = null }) {
  if (state.pending) return 'thinking';
  if (state.error) return 'confused';
  if (gesto) return gesto;
  if (escribiendo) return 'listening';
  return 'idle';
}
