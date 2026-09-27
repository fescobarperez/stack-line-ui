// Stackline — Asistente comercial: estado de la conversación y envío de turnos.
//
// Une el reductor (lógica pura) con el cliente del agente. La conversación
// sobrevive a la navegación entre módulos y a un refresco: se guarda en
// sessionStorage, igual que la sesión del ERP, y muere con la pestaña.
import { useCallback, useEffect, useReducer, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { agentClient, armarTurno } from '../api/agent.js';
import { agentReducer, estadoInicial, hayBorradorSinEnviar } from './agentReducer.js';

export const CLAVE_CONVERSACION = 'maya_assistant_conversation';

function leerGuardado() {
  try {
    const crudo = sessionStorage.getItem(CLAVE_CONVERSACION);
    return crudo ? JSON.parse(crudo) : null;
  } catch {
    return null;
  }
}

/**
 * @param {object} opts
 * @param {object} opts.cliente  agentClient; inyectable para tests
 */
export function useAgentConversation({ cliente = agentClient } = {}) {
  const { t } = useTranslation();

  const crearInicial = useCallback(() => estadoInicial({
    saludo: t('assistant.greeting', 'Buen día, soy Tino. Puedo consultar productos, stock y precios, registrar clientes y generar cotizaciones. ¿Qué le gustaría cotizar hoy?'),
    sugerencias: [
      { id: 'sug-stock', label: t('assistant.suggestStock', 'Consultar stock y precio de un producto') },
      { id: 'sug-cliente', label: t('assistant.suggestCustomer', 'Buscar un cliente') },
      { id: 'sug-cotizacion', label: t('assistant.suggestQuote', 'Preparar una cotización') },
    ],
  }), [t]);

  const [state, dispatch] = useReducer(agentReducer, undefined, () => {
    const guardado = leerGuardado();
    return guardado ? agentReducer(guardado, { type: 'restaurar', estado: guardado }) : crearInicial();
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(CLAVE_CONVERSACION, JSON.stringify({ ...state, pending: false }));
    } catch {
      // Sin almacenamiento (modo privado estricto): la conversación vive solo en memoria.
    }
  }, [state]);

  // El reductor ya rechaza un segundo envío, pero entre el clic y el render
  // hay una ventana: esta bandera la cierra.
  const enVuelo = useRef(false);
  const conversacion = useRef(state.conversationId);
  conversacion.current = state.conversationId;

  const ejecutar = useCallback(async (request, textoUsuario) => {
    if (enVuelo.current) return;
    enVuelo.current = true;
    dispatch({ type: 'enviar', request, textoUsuario });
    try {
      const response = await cliente.turn(request);
      dispatch({ type: 'respuesta', response });
    } catch (e) {
      dispatch({ type: 'fallo', status: e?.status ?? 0 });
    } finally {
      enVuelo.current = false;
    }
  }, [cliente]);

  const enviarTexto = useCallback((texto) => {
    const limpio = (texto ?? '').trim();
    if (!limpio) return;
    ejecutar(armarTurno({ conversationId: conversacion.current, input: { type: 'text', text: limpio } }), limpio);
  }, [ejecutar]);

  /** Acción del panel: viaja como acción, nunca como texto inventado. */
  const enviarAccion = useCallback((actionId, payload = {}) => {
    ejecutar(armarTurno({
      conversationId: conversacion.current,
      input: { type: 'action', action_id: actionId, payload },
    }));
  }, [ejecutar]);

  /** Reenvía la última petición con la MISMA idempotency_key. */
  const reintentar = useCallback(() => {
    if (state.lastRequest) ejecutar(state.lastRequest);
  }, [ejecutar, state.lastRequest]);

  const nueva = useCallback(() => {
    cliente.reset();
    dispatch({ type: 'nueva', inicial: crearInicial() });
  }, [cliente, crearInicial]);

  return {
    state,
    enviarTexto,
    enviarAccion,
    reintentar,
    nueva,
    pedirConfirmacion: () => dispatch({ type: 'pedirConfirmacion' }),
    cancelarConfirmacion: () => dispatch({ type: 'cancelarConfirmacion' }),
    hayBorrador: hayBorradorSinEnviar(state),
  };
}
