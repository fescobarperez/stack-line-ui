// Revisión de productos que propuso el asistente de WhatsApp.
//
// El asistente crea el producto SIN precio y pendiente de revisión cuando el
// cliente pide algo que no está en el catálogo. Aquí un asesor lo aprueba
// (con precio) o lo descarta. Validación pura, sin React, para probarla sola.

/** Número > 0 a partir de lo que se escribió ("1,500.50" o "1500.5"); null si no sirve. */
export function parsePrice(raw) {
  const v = String(raw ?? '').trim().replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return null;
  const n = Number(v);
  return n > 0 ? n : null;
}

/** Errores del formulario de aprobación: { campo: clave i18n }. */
export function validateApproval({ price, sku }) {
  const errors = {};
  if (parsePrice(price) == null) errors.price = 'productReview.errors.price';
  if (sku != null && String(sku).trim().length > 40) errors.sku = 'productReview.errors.sku';
  return errors;
}

/** Cuerpo de POST /api/products/{id}/review para aprobar. */
export function approvalPayload({ price, categoryId, sku }, originalSku) {
  const limpio = String(sku ?? '').trim();
  return {
    action: 'approve',
    price: parsePrice(price),
    categoryId: categoryId === '' || categoryId == null ? null : Number(categoryId),
    // Solo se manda si cambió: así no choca con su propio SKU provisional.
    sku: limpio && limpio !== originalSku ? limpio : null,
  };
}

/** "2.5 × 3 × 4.5 m" con las medidas que existan; null si no hay ninguna. */
export function dimensionsText(p) {
  const partes = [p?.height, p?.width, p?.depth].filter((v) => v != null && v !== '');
  if (!partes.length) return null;
  return `${partes.map((v) => Number(v).toString()).join(' × ')} ${p.dimensionUnit || 'm'}`;
}
