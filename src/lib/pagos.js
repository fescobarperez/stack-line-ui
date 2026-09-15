// Stackline — Métodos de pago
//
// En la base de datos el método viaja como código (`tarjeta_credito`), que es
// lo correcto para comparar y agrupar, pero no es lo que debe leer un cajero.
// Aquí se traduce a etiqueta. La búsqueda es insensible a mayúsculas porque en
// `sales` conviven filas con 'efectivo' y con 'Efectivo'.
//
// Un código desconocido no se oculta ni rompe la vista: se muestra legible
// (guiones bajos a espacios, primera letra en mayúscula), así que si mañana
// aparece un método nuevo la tabla sigue siendo entendible sin tocar esto.

/** código en BD → clave i18n bajo `pos.paymentMethods`. */
const CLAVES = {
  efectivo:        'cash',
  tarjeta:         'card',
  tarjeta_credito: 'creditCard',
  tarjeta_debito:  'debitCard',
  transferencia:   'transfer',
  deposito:        'deposit',
  cheque:          'check',
  credito:         'credit',
  mixto:           'mixed',
};

/** Texto por defecto cuando el idioma activo no trae la clave. */
const ES = {
  cash:       'Efectivo',
  card:       'Tarjeta',
  creditCard: 'Tarjeta de crédito',
  debitCard:  'Tarjeta de débito',
  transfer:   'Transferencia',
  deposit:    'Depósito',
  check:      'Cheque',
  credit:     'Crédito',
  mixed:      'Mixto',
};

function legible(codigo) {
  const s = String(codigo).replace(/_/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Etiqueta del método de pago.
 * @param {string} codigo  el valor tal como viene del backend
 * @param {function} [t]   `t` de i18next; sin ella se devuelve el texto en español
 */
export function etiquetaMetodoPago(codigo, t) {
  if (!codigo) return '—';
  const clave = CLAVES[String(codigo).trim().toLowerCase()];
  if (!clave) return legible(codigo);
  return t ? t(`pos.paymentMethods.${clave}`, ES[clave]) : ES[clave];
}
