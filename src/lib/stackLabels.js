// Etiquetas para tablas hechas a mano que en el teléfono se apilan
// (clase .tbl-stack en global.css): copia el texto de cada <th> al
// data-label de las celdas de su columna, así no hay que escribirlo celda
// por celda ni puede quedar desalineado.
//
// App.jsx arranca vigilarTablasApiladas() una vez: basta con la clase.
//
//   <table className="tbl tbl-stack" data-title-col="1">…
//
// - La columna de data-title-col (por defecto la 0) va arriba como título.
// - Las columnas sin encabezado (acciones, casillas) van abajo a la derecha.
// - Una celda que ya trae data-label o clase stack-* se respeta.
// - Las celdas con colspan (avisos, filas vacías) se dejan como están.
// - En el pie, una fila con más de dos valores también se etiqueta.
import { useCallback } from 'react';

export function etiquetarTabla(tabla) {
  if (!tabla) return;
  const fila = tabla.querySelector(':scope > thead > tr:last-child');
  const encabezados = fila ? [...fila.children].map((th) => th.textContent.trim()) : [];
  const titulo = Number(tabla.dataset.titleCol || 0);
  tabla.querySelectorAll(':scope > tbody > tr').forEach((tr) => etiquetarFila(tr, encabezados, titulo));
  // Totales con varios montos (p. ej. planilla): se etiquetan igual y se
  // muestran como tarjeta. Los de etiqueta + un monto quedan en una línea.
  tabla.querySelectorAll(':scope > tfoot > tr').forEach((tr) => {
    const conValor = [...tr.children].filter((td) => td.textContent.trim() !== '').length;
    if (conValor <= 2) return;
    tr.classList.add('stack-card');
    etiquetarFila(tr, encabezados, 0);
  });
}

function etiquetarFila(tr, encabezados, titulo) {
  let col = 0;
  [...tr.children].forEach((td) => {
    const span = td.colSpan || 1;
    const propia = td.hasAttribute('data-label') || /\bstack-(title|actions)\b/.test(td.className);
    if (span === 1 && !propia) {
      if (col === titulo) td.classList.add('stack-title');
      else if (encabezados[col]) td.setAttribute('data-label', encabezados[col]);
      else if (titulo >= 0) td.classList.add('stack-actions');
    }
    col += span;
  });
}

/** Ref para la <table>: etiqueta al montar y cada vez que cambian sus filas. */
export function useStackLabels() {
  return useCallback((tabla) => {
    if (!tabla) return;
    etiquetarTabla(tabla);
    tabla.__stackObserver?.disconnect();
    // Solo childList: poner atributos no vuelve a disparar el observador.
    const obs = new MutationObserver(() => etiquetarTabla(tabla));
    obs.observe(tabla, { childList: true, subtree: true });
    tabla.__stackObserver = obs;
  }, []);
}

/**
 * Etiqueta toda tabla .tbl-stack dentro de `raiz`, ahora y cada vez que
 * cambia el DOM (un cuadro por cambio, no uno por mutación). Devuelve la
 * función para dejar de vigilar.
 */
export function vigilarTablasApiladas(raiz = document.body) {
  const todas = () => raiz.querySelectorAll('table.tbl-stack').forEach(etiquetarTabla);
  todas();
  let pendiente = false;
  const obs = new MutationObserver(() => {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(() => { pendiente = false; todas(); });
  });
  obs.observe(raiz, { childList: true, subtree: true });
  return () => obs.disconnect();
}
