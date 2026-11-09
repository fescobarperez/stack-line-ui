// Caja y seguimiento de Salud (fase 7): reparto del cobro, etiquetas, cuerpos
// para la API y periodos de reportes. Sin React, para probarlo solo. El
// backend vuelve a validar y calcular todo; esto es para que la pantalla
// muestre lo mismo antes de guardar.

export const PAYMENT_METHODS = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'tarjeta', label: 'Tarjeta' },
  { id: 'transferencia', label: 'Transferencia' },
  { id: 'cheque', label: 'Cheque' },
];

/** Métodos de cobro (salud_charges.method): etiqueta e insignia. */
export const CHARGE_METHODS = {
  venta: { label: 'Factura', badge: 'success' },
  paquete: { label: 'Paquete', badge: 'info' },
  anticipo: { label: 'Anticipo', badge: 'info' },
  mixto: { label: 'Anticipo + factura', badge: 'success' },
  cortesia: { label: 'Cortesía', badge: 'neutral' },
};

export const FEELINGS = {
  mejor: { label: 'Mejor', badge: 'success' },
  igual: { label: 'Igual', badge: 'neutral' },
  peor: { label: 'Peor', badge: 'danger' },
};

export const PLAN_STATUS = {
  activo: { label: 'Activo', badge: 'info' },
  completado: { label: 'Completado', badge: 'success' },
  cancelado: { label: 'Cancelado', badge: 'neutral' },
};

/** Citas que no se cobran: no se atendieron. */
export const NOT_CHARGEABLE = ['cancelada', 'no_asistio'];

export const Q = (n) => `Q ${Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const cents = (v) => Math.round(Number(v || 0) * 100);
const fromCents = (c) => Math.round(c) / 100;

/** Texto del campo → número (acepta coma decimal); NaN si no es un número; null si está vacío. */
export function parseAmount(v) {
  const s = String(v ?? '').trim().replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Lo mismo que CajaRules.repartir: total = precio − descuento; si se usa el
 * anticipo, sale de ahí lo que alcance y el resto se factura.
 */
export function split(price, discount, balance, useCredit) {
  const p = cents(price);
  const d = cents(discount);
  const total = Math.max(0, p - d);
  const credit = useCredit ? Math.min(total, Math.max(0, cents(balance))) : 0;
  const cash = total - credit;
  const method = credit > 0 ? (cash > 0 ? 'mixto' : 'anticipo') : 'venta';
  return { total: fromCents(total), credit: fromCents(credit), cash: fromCents(cash), method };
}

/** Errores del formulario de cobro, en orden; vacío = se puede cobrar. */
export function chargeErrors(f, opts) {
  const errs = [];
  if (f.mode === 'paquete') {
    if (!f.patientPackageId) errs.push('Elige el paquete.');
    return errs;
  }
  if (f.mode === 'cortesia') {
    if (!String(f.notes || '').trim()) errs.push('Indica el motivo de la cortesía.');
    return errs;
  }
  const price = parseAmount(f.price);
  const discount = parseAmount(f.discount) ?? 0;
  if (price == null) errs.push('Indica el precio.');
  else if (Number.isNaN(price) || price < 0) errs.push('El precio no es válido.');
  if (Number.isNaN(discount) || discount < 0) errs.push('El descuento no es válido.');
  else if (price != null && !Number.isNaN(price) && discount > price) errs.push('El descuento no puede ser mayor que el precio.');
  if (!errs.length) {
    const r = split(price, discount, opts?.creditBalance, f.useCredit);
    if (r.total === 0) errs.push('El total es cero: si no se cobra, regístralo como cortesía.');
    else if (r.cash > 0 && opts && !opts.cashRegisterOpen) errs.push('Para facturar abre tu turno en Caja y Cortes.');
  }
  return errs;
}

/** Formulario → cuerpo de POST /appointments/{id}/charge. */
export function chargePayload(f) {
  if (f.mode === 'paquete') return { patientPackageId: Number(f.patientPackageId), notes: f.notes?.trim() || null };
  if (f.mode === 'cortesia') {
    const p = parseAmount(f.price);
    return { courtesy: true, price: p == null || Number.isNaN(p) ? null : p, notes: f.notes.trim() };
  }
  const discount = parseAmount(f.discount);
  return {
    price: parseAmount(f.price),
    discount: discount == null || Number.isNaN(discount) ? null : discount,
    useCredit: !!f.useCredit,
    paymentMethod: f.paymentMethod || 'efectivo',
    notes: f.notes?.trim() || null,
  };
}

/** Formulario inicial según lo que ofrece la cita: paquete si hay uno que sirve, si no factura. */
export function initialCharge(opts) {
  const pk = opts?.packages?.[0];
  return {
    mode: pk ? 'paquete' : 'venta',
    patientPackageId: pk ? pk.id : '',
    price: opts?.price != null ? String(opts.price) : '',
    discount: '',
    useCredit: Number(opts?.creditBalance || 0) > 0,
    paymentMethod: 'efectivo',
    notes: '',
  };
}

/** «3 de 10 sesiones» / «vence el 30/11/2026». */
export function packageSummary(p) {
  const partes = [`${p.sessionsLeft} de ${p.sessionsTotal} sesiones disponibles`];
  if (p.expiresOn) {
    const [a, m, d] = p.expiresOn.split('-');
    partes.push(`vence el ${d}/${m}/${a}`);
  }
  return partes.join(' · ');
}

/** Progreso de un plan, de 0 a 100. */
export const planProgress = (p) => (p?.sessions ? Math.round((p.done / p.sessions) * 100) : 0);

// ── Reportes ─────────────────────────────────────────────────────────

const iso = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
const parse = (s) => { const [a, m, d] = s.split('-').map(Number); return new Date(Date.UTC(a, m - 1, d)); };

/** Periodos rápidos a partir de hoy (fecha de Guatemala, «YYYY-MM-DD»). */
export function reportRange(preset, todayIso) {
  const hoy = parse(todayIso);
  const y = hoy.getUTCFullYear();
  const m = hoy.getUTCMonth();
  switch (preset) {
    case 'today': return { from: todayIso, to: todayIso };
    case 'week': {
      // Domingo a sábado, como la agenda.
      const ini = new Date(hoy); ini.setUTCDate(hoy.getUTCDate() - hoy.getUTCDay());
      const fin = new Date(ini); fin.setUTCDate(ini.getUTCDate() + 6);
      return { from: iso(ini), to: iso(fin) };
    }
    case 'lastMonth': return { from: iso(new Date(Date.UTC(y, m - 1, 1))), to: iso(new Date(Date.UTC(y, m, 0))) };
    case 'last30': { const ini = new Date(hoy); ini.setUTCDate(hoy.getUTCDate() - 29); return { from: iso(ini), to: todayIso }; }
    case 'month':
    default: return { from: iso(new Date(Date.UTC(y, m, 1))), to: iso(new Date(Date.UTC(y, m + 1, 0))) };
  }
}

/** «12.5 %» o «—» si no hay base. */
export const pct = (v) => (v == null ? '—' : `${Number(v).toLocaleString('es-GT', { maximumFractionDigits: 1 })} %`);

/** Agrupa la bandeja de controles: vencidos, esta semana (≤ 7 días) y después. */
export function followUpBuckets(items) {
  const out = { overdue: [], week: [], later: [] };
  (items || []).forEach((f) => {
    if (f.daysLeft < 0) out.overdue.push(f);
    else if (f.daysLeft <= 7) out.week.push(f);
    else out.later.push(f);
  });
  return out;
}
