// Visor de imagen a pantalla completa: el mismo del planificador (agents-services,
// planner.js), con zoom por rueda, pellizco, doble clic/toque o botones, y
// arrastre para moverse. Va en un portal sobre el body para que no lo recorte
// ni lo mueva el cajón o el modal desde donde se abre.
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

const MAX = 6;

export default function ImageViewer({ src, title, onClose }) {
  const { t } = useTranslation();
  const stageRef = useRef(null);
  const imgRef = useRef(null);
  const pctRef = useRef(null);
  const closeRef = useRef(null);
  const barRef = useRef(null);
  const api = useRef({});
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const stage = stageRef.current;
    const img = imgRef.current;
    const pct = pctRef.current;
    // Escala, desplazamiento y tamaño ajustado de la imagen.
    let s = 1, tx = 0, ty = 0, fw = 0, fh = 0;

    /** No se puede arrastrar la imagen fuera de la vista. */
    const aplicar = () => {
      const mx = Math.max(0, (fw * s - stage.clientWidth) / 2);
      const my = Math.max(0, (fh * s - stage.clientHeight) / 2);
      tx = Math.min(mx, Math.max(-mx, tx));
      ty = Math.min(my, Math.max(-my, ty));
      img.style.transform = `translate(${tx}px,${ty}px) scale(${s})`;
      pct.textContent = `${Math.round(s * 100)}%`;
      stage.classList.toggle('z', s > 1.01);
    };
    /** La imagen entera dentro de la pantalla (puede crecer); el zoom va encima. */
    const medir = () => {
      const W = Math.max(stage.clientWidth - 24, 50);
      const H = Math.max(stage.clientHeight - 24, 50);
      const nw = img.naturalWidth || W;
      const nh = img.naturalHeight || H;
      const k = Math.min(W / nw, H / nh);
      fw = nw * k; fh = nh * k;
      img.style.width = `${fw}px`;
      img.style.height = `${fh}px`;
      img.style.marginLeft = `${-fw / 2}px`;
      img.style.marginTop = `${-fh / 2}px`;
      aplicar();
    };
    /** Acerca o aleja manteniendo fijo el punto (px, py), medido desde el centro. */
    const zoomEn = (factor, px, py) => {
      const n = Math.min(MAX, Math.max(1, s * factor));
      tx = px - (px - tx) * n / s;
      ty = py - (py - ty) * n / s;
      s = n;
      aplicar();
    };
    const ajustar = () => { s = 1; tx = 0; ty = 0; aplicar(); };
    const suave = () => {
      stage.classList.add('anim');
      setTimeout(() => stage.classList.remove('anim'), 220);
    };
    const punto = (x, y) => {
      const r = stage.getBoundingClientRect();
      return [x - r.left - r.width / 2, y - r.top - r.height / 2];
    };
    const alternar = (x, y) => {
      suave();
      if (s > 1.01) ajustar();
      else { const c = punto(x, y); zoomEn(2.5, c[0], c[1]); }
    };
    api.current = {
      acercar: () => { suave(); zoomEn(1.5, 0, 0); },
      alejar: () => { suave(); zoomEn(1 / 1.5, 0, 0); },
      ajustar: () => { suave(); ajustar(); },
    };

    const rueda = (e) => {
      e.preventDefault();
      const c = punto(e.clientX, e.clientY);
      zoomEn(Math.exp(-Math.max(-60, Math.min(60, e.deltaY)) * 0.004), c[0], c[1]);
    };

    const punteros = {};
    let arrastre = null, pellizco = null, ultimoToque = 0, tocando = false;
    const distancia = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
    const bajar = (e) => {
      tocando = e.pointerType !== 'mouse';
      try { stage.setPointerCapture(e.pointerId); } catch { /* sin captura */ }
      punteros[e.pointerId] = [e.clientX, e.clientY];
      const ids = Object.keys(punteros);
      if (ids.length === 2) {
        pellizco = { d: distancia(punteros[ids[0]], punteros[ids[1]]), s };
        arrastre = null;
      } else if (ids.length === 1) {
        arrastre = { x: e.clientX, y: e.clientY, tx, ty, movio: false };
        if (tocando) {
          // Doble toque: alterna entre ajustada y 2.5×.
          const ahora = Date.now();
          if (ahora - ultimoToque < 300) { alternar(e.clientX, e.clientY); arrastre = null; ultimoToque = 0; } else ultimoToque = ahora;
        }
      }
    };
    const mover = (e) => {
      if (!punteros[e.pointerId]) return;
      punteros[e.pointerId] = [e.clientX, e.clientY];
      const ids = Object.keys(punteros);
      if (pellizco && ids.length === 2) {
        const a = punteros[ids[0]], b = punteros[ids[1]];
        const c = punto((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
        zoomEn(pellizco.s * distancia(a, b) / pellizco.d / s, c[0], c[1]);
      } else if (arrastre) {
        const dx = e.clientX - arrastre.x, dy = e.clientY - arrastre.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) arrastre.movio = true;
        if (s > 1.01) {
          tx = arrastre.tx + dx;
          ty = arrastre.ty + dy;
          stage.classList.add('drag');
          aplicar();
        }
      }
    };
    const soltar = (e) => {
      delete punteros[e.pointerId];
      if (Object.keys(punteros).length < 2) pellizco = null;
      if (!Object.keys(punteros).length) stage.classList.remove('drag');
    };
    const subir = (e) => {
      // Un clic suelto fuera de la imagen (sin zoom ni arrastre) cierra el visor.
      if (arrastre && !arrastre.movio && e.target === stage && s <= 1.01 && !tocando) { soltar(e); onCloseRef.current?.(); return; }
      soltar(e);
    };
    const doble = (e) => { if (!tocando) alternar(e.clientX, e.clientY); };

    const tecla = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCloseRef.current?.(); }
      else if (e.key === '+' || e.key === '=') api.current.acercar();
      else if (e.key === '-' || e.key === '_') api.current.alejar();
      else if (e.key === '0') api.current.ajustar();
      else if (e.key === 'Tab') {
        // El foco no sale del visor mientras está abierto.
        const botones = [...barRef.current.querySelectorAll('button')];
        const i = botones.indexOf(document.activeElement);
        e.preventDefault();
        botones[(i + (e.shiftKey ? botones.length - 1 : 1) + botones.length) % botones.length].focus();
      }
    };

    stage.addEventListener('wheel', rueda, { passive: false });
    stage.addEventListener('pointerdown', bajar);
    stage.addEventListener('pointermove', mover);
    stage.addEventListener('pointerup', subir);
    stage.addEventListener('pointercancel', soltar);
    stage.addEventListener('dblclick', doble);
    document.addEventListener('keydown', tecla, true);
    window.addEventListener('resize', medir);
    img.addEventListener('load', medir);
    if (img.complete) medir();

    // Sin scroll de la página mientras está abierto; el foco vuelve a quien lo abrió.
    const origen = document.activeElement;
    const overflowPrevio = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    closeRef.current?.focus();

    return () => {
      stage.removeEventListener('wheel', rueda);
      stage.removeEventListener('pointerdown', bajar);
      stage.removeEventListener('pointermove', mover);
      stage.removeEventListener('pointerup', subir);
      stage.removeEventListener('pointercancel', soltar);
      stage.removeEventListener('dblclick', doble);
      document.removeEventListener('keydown', tecla, true);
      window.removeEventListener('resize', medir);
      img.removeEventListener('load', medir);
      document.documentElement.style.overflow = overflowPrevio;
      if (origen && origen.isConnected && typeof origen.focus === 'function') {
        try { origen.focus(); } catch { /* nada */ }
      }
    };
  }, [src]);

  const etiqueta = title || t('imageViewer.title', 'Imagen');
  return createPortal(
    <div className="img-viewer" role="dialog" aria-modal="true" aria-label={etiqueta}>
      <div className="img-viewer-bar" ref={barRef}>
        <span className="img-viewer-title">{title || ''}</span>
        <div className="img-viewer-tools">
          <button type="button" title={t('imageViewer.zoomOut', 'Alejar')} aria-label={t('imageViewer.zoomOut', 'Alejar')}
            onClick={() => api.current.alejar()}>−</button>
          <button type="button" className="pct" ref={pctRef} title={t('imageViewer.fit', 'Ajustar a la pantalla')}
            aria-label={t('imageViewer.fit', 'Ajustar a la pantalla')} onClick={() => api.current.ajustar()}>100%</button>
          <button type="button" title={t('imageViewer.zoomIn', 'Acercar')} aria-label={t('imageViewer.zoomIn', 'Acercar')}
            onClick={() => api.current.acercar()}>+</button>
          <button type="button" ref={closeRef} title={t('imageViewer.close', 'Cerrar')} aria-label={t('imageViewer.close', 'Cerrar')}
            onClick={() => onCloseRef.current?.()}>✕</button>
        </div>
      </div>
      <div className="img-viewer-stage" ref={stageRef}>
        <img ref={imgRef} src={src} alt={title || ''} draggable="false" />
      </div>
      <div className="img-viewer-hint">
        {t('imageViewer.hint', 'Rueda, pellizca o doble clic para acercar · arrastra para moverte · Esc para cerrar')}
      </div>
    </div>,
    document.body,
  );
}
