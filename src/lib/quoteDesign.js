// Diseño que el cliente aprobó con el asistente de WhatsApp (ficha + render).
// Funciones puras para armar lo que se muestra en el detalle de la cotización.

const num = (v) => (v == null || v === '' ? null : Number(v).toString());

/** "2.5 × 3 × 4.5 m (alto × ancho × prof.)" con las que existan; null si ninguna. */
export function measuresText(spec) {
  const partes = [['alto', spec?.alto], ['ancho', spec?.ancho], ['prof.', spec?.profundidad]]
    .filter(([, v]) => num(v) != null);
  if (!partes.length) return null;
  return `${partes.map(([, v]) => num(v)).join(' × ')} m (${partes.map(([k]) => k).join(' × ')})`;
}

/**
 * Filas [clave i18n, texto por defecto, valor] de la ficha, solo las que
 * tienen valor. Los detalles (aguas, cubierta…) van al final con su nombre.
 */
export function designRows(spec) {
  if (!spec) return [];
  const filas = [
    ['quoteDesign.type', 'Qué es', spec.tipo],
    ['quoteDesign.description', 'Descripción', spec.descripcion],
    ['quoteDesign.material', 'Material', spec.material],
    ['quoteDesign.finish', 'Acabado', spec.acabado],
    ['quoteDesign.measures', 'Medidas', measuresText(spec)],
  ].filter(([, , v]) => v != null && String(v).trim() !== '');
  Object.entries(spec.detalles || {}).forEach(([k, v]) => {
    if (v != null && String(v).trim() !== '') filas.push([null, k.charAt(0).toUpperCase() + k.slice(1), String(v)]);
  });
  return filas;
}
