// Módulos del plan de la empresa. El login trae `enabledModules` (lo que el
// plan incluye más sus excepciones); la app oculta las pantallas del resto y
// el backend las rechaza con 403 MODULE_NOT_ENABLED.
//
// ⚠️ Debe reflejar ModuleCatalog.java de stack-line-services (qué rutas son
// de qué módulo). Una pantalla que no esté aquí es de `base`: siempre visible.

export const SCREEN_MODULE = {
  pos: 'pos', returns: 'pos', cash: 'pos',
  fel: 'fel',
  rawmaterials: 'inventory_plus', variants: 'inventory_plus', stockcount: 'inventory_plus', transfers: 'inventory_plus',
  purchases: 'purchases', cxp: 'purchases',
  quotes: 'quotes', projects: 'quotes',
  promotions: 'commercial', loyalty: 'commercial', cxc: 'commercial',
  accounting: 'accounting', costcenters: 'accounting', presupuestos: 'accounting', ledger: 'accounting',
  financials: 'accounting', banks: 'accounting', bankrec: 'accounting', fixedassets: 'accounting',
  payroll: 'payroll',
};

/** Módulos de la sesión activa; null si la sesión es anterior a los planes (no se oculta nada). */
export function sessionModules() {
  try {
    const m = JSON.parse(sessionStorage.getItem('maya_session'))?.enabledModules;
    return Array.isArray(m) ? m : null;
  } catch { return null; }
}

export function moduleEnabled(code, modules = sessionModules()) {
  return !modules || code === 'base' || modules.includes(code);
}

/** La pantalla `id` (id del menú) está en el plan. */
export function screenEnabled(id, modules = sessionModules()) {
  return moduleEnabled(SCREEN_MODULE[id] || 'base', modules);
}

/** Secciones del menú/permisos solo con las pantallas del plan; sin secciones vacías. */
export function sectionsInPlan(sections, modules = sessionModules()) {
  return sections
    .map((s) => ({ ...s, items: s.items.filter((i) => screenEnabled(i.id, modules)) }))
    .filter((s) => s.items.length > 0);
}
