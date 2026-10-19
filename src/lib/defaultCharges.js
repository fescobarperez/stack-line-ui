// Cargos por defecto de las cotizaciones (Configuración › Cotizaciones).
// Se guardan como JSON en company_settings «quotes.default_charges» y el
// backend los copia a cada cotización nueva (QuoteChargeService). La fila de
// ganancia ({ kind: 'profit' }) no es un cargo: llena la ganancia de la
// cotización, que se sigue calculando sobre la base configurada.

let seq = 0;
const uid = () => `c${Date.now().toString(36)}${(seq++).toString(36)}`;

export const newDefaultCharge = () => ({ key: uid(), categoryId: '', description: '', calcType: 'percent', value: '' });

export const emptyProfit = () => ({ calcType: 'percent', value: '' });

/**
 * JSON guardado → { rows, profit } del editor (tolera vacío o dañado).
 * `legacyPct` es la ganancia sugerida anterior (quotes.default_profit_pct):
 * se usa si la lista todavía no trae la fila de ganancia.
 */
export function parseDefaultCharges(json, legacyPct = '') {
  let lista = [];
  try { lista = JSON.parse(json || '[]'); } catch { lista = []; }
  if (!Array.isArray(lista)) lista = [];
  const g = lista.find((c) => c && c.kind === 'profit');
  const profit = g
    ? { calcType: g.calcType === 'fixed' ? 'fixed' : 'percent', value: g.value != null ? String(g.value) : '' }
    : { calcType: 'percent', value: legacyPct == null ? '' : String(legacyPct) };
  const rows = lista.filter((c) => c && c.kind !== 'profit').map((c) => ({
    key: uid(),
    categoryId: c.categoryId != null ? String(c.categoryId) : '',
    description: c.description || '',
    calcType: c.calcType === 'fixed' ? 'fixed' : 'percent',
    value: c.value != null ? String(c.value) : '',
  }));
  return { rows, profit };
}

/** Filas y ganancia del editor → JSON para guardar. Ganancia vacía = sin ganancia sugerida. */
export function serializeDefaultCharges(rows, profit = emptyProfit()) {
  const cargos = rows.map((r) => ({
    categoryId: r.categoryId ? Number(r.categoryId) : null,
    description: r.description.trim() || null,
    calcType: r.calcType,
    value: r.value === '' ? null : Number(r.value),
  }));
  const ganancia = String(profit.value ?? '').trim() === '' ? []
    : [{ kind: 'profit', calcType: profit.calcType, value: Number(profit.value) }];
  return JSON.stringify([...ganancia, ...cargos]);
}

/**
 * Errores por fila: { [key]: { categoryId?, value? }, profit?: '…' }; vacío = válido.
 */
export function validateDefaultCharges(rows, profit = emptyProfit()) {
  const e = {};
  const g = String(profit.value ?? '').trim();
  if (g !== '' && !(Number.isFinite(Number(g)) && Number(g) >= 0)) e.profit = 'Número mayor o igual a 0';
  rows.forEach((r) => {
    const f = {};
    if (!r.categoryId) f.categoryId = 'Elige el concepto';
    const v = Number(r.value);
    if (r.value === '' || !Number.isFinite(v) || v <= 0) f.value = 'Mayor que cero';
    else if (r.calcType === 'percent' && v > 100) f.value = 'Máximo 100 %';
    if (Object.keys(f).length) e[r.key] = f;
  });
  return e;
}

/**
 * Lo que sumaría cada cargo sobre un subtotal de productos de ejemplo. Cada
 * porcentaje se calcula sobre los productos, no sobre los otros cargos. La
 * ganancia en % va sobre los productos (costo directo) o sobre productos +
 * cargos (costo total), según la configuración.
 */
export function previewDefaultCharges(rows, subtotal, profit = emptyProfit(), profitBase = 'total_cost') {
  const montos = rows.map((r) => {
    const v = Number(r.value) || 0;
    return r.calcType === 'percent' ? Math.round(subtotal * v) / 100 : v;
  });
  const total = montos.reduce((a, b) => a + b, 0);
  const g = Number(profit.value) || 0;
  const base = profitBase === 'direct_cost' ? subtotal : subtotal + total;
  const ganancia = profit.calcType === 'fixed' ? g : Math.round(base * g) / 100;
  return { montos, total, ganancia };
}
