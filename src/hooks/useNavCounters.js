import { useCallback, useEffect, useRef, useState } from 'react';
import { getNavCounters } from '../api/nav.js';

const CADA_MS = 60_000;

/**
 * Contadores del menú. Se piden al entrar, al cambiar de pantalla (lo que se
 * hizo ahí suele mover un número) y cada minuto. Si una consulta falla se
 * conservan los últimos valores: el menú no debe parpadear por un error.
 */
export function useNavCounters(route) {
  const [counters, setCounters] = useState(null);
  const vivo = useRef(true);

  const reload = useCallback(async () => {
    try {
      const data = await getNavCounters();
      if (vivo.current && data) setCounters(data);
    } catch {
      // se quedan los últimos valores
    }
  }, []);

  useEffect(() => {
    vivo.current = true;
    const id = setInterval(reload, CADA_MS);
    return () => { vivo.current = false; clearInterval(id); };
  }, [reload]);

  useEffect(() => { reload(); }, [route, reload]);

  return { counters, reload };
}
