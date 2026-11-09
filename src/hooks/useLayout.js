// Escucha el ancho de la ventana y devuelve el dispositivo: 'phone',
// 'tablet' o 'desktop' (ver lib/breakpoints.js).
import { useEffect, useState } from 'react';
import { layoutFor } from '../lib/breakpoints.js';

const ancho = () => (typeof window === 'undefined' ? 1440 : window.innerWidth);

export function useLayout() {
  const [layout, setLayout] = useState(() => layoutFor(ancho()));
  useEffect(() => {
    const medir = () => setLayout(layoutFor(ancho()));
    window.addEventListener('resize', medir);
    window.addEventListener('orientationchange', medir);
    return () => {
      window.removeEventListener('resize', medir);
      window.removeEventListener('orientationchange', medir);
    };
  }, []);
  return layout;
}

/**
 * true si la consulta de medios se cumple, p. ej. '(hover: hover)'.
 * Sin matchMedia (pruebas en jsdom) devuelve `porDefecto`.
 */
export function useMediaQuery(consulta, porDefecto = false) {
  const soporta = typeof window !== 'undefined' && typeof window.matchMedia === 'function';
  const [cumple, setCumple] = useState(() => (soporta ? window.matchMedia(consulta).matches : porDefecto));
  useEffect(() => {
    if (!soporta) return undefined;
    const mq = window.matchMedia(consulta);
    const cambio = () => setCumple(mq.matches);
    cambio();
    mq.addEventListener?.('change', cambio);
    return () => mq.removeEventListener?.('change', cambio);
  }, [consulta, soporta]);
  return cumple;
}
