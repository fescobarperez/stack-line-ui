// Stackline — Hook: estado de Tino con sus gestos temporales.
import { useEffect, useRef, useState } from 'react';
import { DURACION_CONTENTO_MS, DURACION_RESPONDIENDO_MS, estadoTino } from './tinoState.js';

export function useTinoState(state, escribiendo) {
  const [gesto, setGesto] = useState(null);
  const turnoAnterior = useRef(state.pending);
  const cotizacionAnterior = useRef(state.panel.quote);
  const enviadaAnterior = useRef(state.panel.sent);

  useEffect(() => {
    const termino = turnoAnterior.current && !state.pending;
    turnoAnterior.current = state.pending;
    if (!termino || state.error) return undefined;

    // Una cotización nueva o recién enviada merece el gesto de contento.
    const cotizacionLista = state.panel.quote !== cotizacionAnterior.current
      || (state.panel.sent && state.panel.sent !== enviadaAnterior.current);
    cotizacionAnterior.current = state.panel.quote;
    enviadaAnterior.current = state.panel.sent;

    setGesto('responding');
    const relojes = [setTimeout(() => setGesto(cotizacionLista ? 'happy' : null), DURACION_RESPONDIENDO_MS)];
    if (cotizacionLista) {
      relojes.push(setTimeout(() => setGesto(null), DURACION_RESPONDIENDO_MS + DURACION_CONTENTO_MS));
    }
    return () => { relojes.forEach(clearTimeout); setGesto(null); };
  }, [state.pending, state.error, state.panel.quote, state.panel.sent]);

  return estadoTino({ state, escribiendo, gesto });
}
