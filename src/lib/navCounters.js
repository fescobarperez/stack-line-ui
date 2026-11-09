// Qué contador del backend va en cada opción del menú y si se pinta como
// alerta (rojo). Las definiciones viven en el ERP (NavCounters.java):
//   billing    ventas sin FEL autorizada        returns    notas de crédito sin FEL
//   inventory  productos bajo el mínimo         purchases  OCs pendientes o parciales
//   transfers  traslados en borrador/tránsito   quotes     cotizaciones para el asesor
//   cxc        facturas por cobrar vencidas     cxp        facturas de proveedor vencidas
export const NAV_COUNTERS = {
  billing:   { alert: false },
  returns:   { alert: false },
  inventory: { alert: true },
  purchases: { alert: false },
  transfers: { alert: false },
  quotes:    { alert: false },
  cxc:       { alert: true },
  cxp:       { alert: true },
};

/** Contador de una opción: { text, alert } o null si no aplica o es 0. */
export function navCounter(id, counters) {
  const def = NAV_COUNTERS[id];
  if (!def || !counters) return null;
  const n = Number(counters[id]);
  if (!Number.isFinite(n) || n <= 0) return null;
  return { text: n > 99 ? '99+' : String(Math.trunc(n)), alert: def.alert };
}

/**
 * Resumen de una sección plegada: suma de los contadores de sus opciones.
 * Es alerta si alguna opción de alerta tiene pendientes. null si no hay nada.
 */
export function sectionCounter(ids, counters) {
  if (!counters) return null;
  let total = 0;
  let alert = false;
  for (const id of ids) {
    const def = NAV_COUNTERS[id];
    const n = Number(counters[id]);
    if (!def || !Number.isFinite(n) || n <= 0) continue;
    total += Math.trunc(n);
    if (def.alert) alert = true;
  }
  if (total <= 0) return null;
  return { text: total > 99 ? '99+' : String(total), alert };
}
