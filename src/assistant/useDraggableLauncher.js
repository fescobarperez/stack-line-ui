// Stackline — Hook: lanzador arrastrable que se pega al borde más cercano.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ANCLA_INICIAL, UMBRAL_ARRASTRE,
  acotarAVentana, anclaMasCercana, colocacionWidget, coordsDesdeAncla,
} from './launcherPosition.js';

const CLAVE = 'maya_assistant_anchor';

// La posición es una preferencia de la persona, no de la sesión: va en
// localStorage y sobrevive a cerrar la pestaña.
function leerAncla() {
  try {
    const a = JSON.parse(localStorage.getItem(CLAVE));
    return a && ['left', 'right', 'top', 'bottom'].includes(a.borde) ? a : ANCLA_INICIAL;
  } catch {
    return ANCLA_INICIAL;
  }
}

const ventana = () => ({ ancho: window.innerWidth, alto: window.innerHeight });

export function useDraggableLauncher() {
  const [ancla, setAncla] = useState(leerAncla);
  const [vista, setVista] = useState(ventana);
  const [arrastre, setArrastre] = useState(null); // { x, y } mientras se arrastra
  const inicio = useRef(null);
  const ultima = useRef(null);
  const huboArrastre = useRef(false);

  useEffect(() => {
    const alRedimensionar = () => setVista(ventana());
    window.addEventListener('resize', alRedimensionar);
    return () => window.removeEventListener('resize', alRedimensionar);
  }, []);

  useEffect(() => {
    try { localStorage.setItem(CLAVE, JSON.stringify(ancla)); } catch { /* sin almacenamiento */ }
  }, [ancla]);

  const reposo = coordsDesdeAncla(ancla, vista);
  const posicion = arrastre ?? reposo;

  const onPointerDown = useCallback((e) => {
    if (e.button !== undefined && e.button !== 0) return;
    inicio.current = { px: e.clientX, py: e.clientY, x: reposo.x, y: reposo.y, id: e.pointerId };
    huboArrastre.current = false;
  }, [reposo.x, reposo.y]);

  const onPointerMove = useCallback((e) => {
    const i = inicio.current;
    if (!i) return;
    const dx = e.clientX - i.px;
    const dy = e.clientY - i.py;
    if (!huboArrastre.current && Math.hypot(dx, dy) < UMBRAL_ARRASTRE) return;
    if (!huboArrastre.current) {
      huboArrastre.current = true;
      e.currentTarget.setPointerCapture?.(i.id);
    }
    ultima.current = acotarAVentana({ x: i.x + dx, y: i.y + dy }, vista);
    setArrastre(ultima.current);
  }, [vista]);

  const terminar = useCallback((e) => {
    const i = inicio.current;
    inicio.current = null;
    if (!i || !huboArrastre.current) return;
    e.currentTarget.releasePointerCapture?.(i.id);
    if (ultima.current) setAncla(anclaMasCercana(ultima.current, vista));
    ultima.current = null;
    setArrastre(null);
  }, [vista]);

  /** true si el último gesto fue un arrastre: el clic que lo cierra no cuenta. */
  const consumirArrastre = useCallback(() => {
    const fue = huboArrastre.current;
    huboArrastre.current = false;
    return fue;
  }, []);

  return {
    arrastrando: Boolean(arrastre),
    estiloLanzador: { left: posicion.x, top: posicion.y, right: 'auto', bottom: 'auto' },
    estiloWidget: colocacionWidget(posicion, vista),
    handlers: { onPointerDown, onPointerMove, onPointerUp: terminar, onPointerCancel: terminar },
    consumirArrastre,
    compacto: vista.ancho <= 480,
  };
}
