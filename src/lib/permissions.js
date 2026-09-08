// Stackline — Lógica de permisos compartida

export const MODULES_PERM = [
  'Punto de venta', 'Facturación', 'Inventario', 'Compras',
  'Reportes', 'Clientes', 'Contabilidad', 'Mantenimientos',
  'Cierre de caja', 'Configuración',
];

export const ACTIONS = ['ver', 'crear', 'editar', 'eliminar'];

export const initPerms = () =>
  Object.fromEntries(MODULES_PERM.map(m => [m, { ver: false, crear: false, editar: false, eliminar: false }]));

export const PERM_MAP = {
  'pos':     [['Punto de venta', ['ver', 'crear']]],
  'pos:r':   [['Punto de venta', ['ver']]],
  'inv':     [['Inventario',     ['ver', 'crear', 'editar']]],
  'inv:r':   [['Inventario',     ['ver']]],
  'rpt':     [['Reportes',       ['ver']]],
  'rpt:com': [['Reportes',       ['ver']], ['Compras', ['ver']]],
  'tkt':     [['Facturación',    ['ver', 'crear']]],
  'tkt:r':   [['Facturación',    ['ver']]],
};

export const permsToMatrix = (perms = []) => {
  const m = initPerms();
  if (perms.includes('*')) {
    MODULES_PERM.forEach(mod => ACTIONS.forEach(acc => { m[mod][acc] = true; }));
    return m;
  }
  perms.forEach(p => {
    // Formato canónico persistido en el backend: "Módulo|acción".
    if (typeof p === 'string' && p.includes('|')) {
      const [mod, acc] = p.split('|');
      if (m[mod] && acc in m[mod]) m[mod][acc] = true;
      return;
    }
    // Compatibilidad con los códigos cortos del mock (pos, inv:r, …).
    (PERM_MAP[p] || []).forEach(([mod, accs]) =>
      accs.forEach(acc => { if (m[mod]) m[mod][acc] = true; })
    );
  });
  return m;
};

// Convierte la matriz del editor de roles a la lista canónica "Módulo|acción"
// que persiste el backend (Role.permissions es List<String>). Si todo está
// activado, colapsa a ['*'] (acceso total).
export const matrixToPerms = (matrix) => {
  const allOn = MODULES_PERM.every(mod => ACTIONS.every(acc => matrix[mod]?.[acc]));
  if (allOn) return ['*'];
  const out = [];
  MODULES_PERM.forEach(mod => ACTIONS.forEach(acc => {
    if (matrix[mod]?.[acc]) out.push(`${mod}|${acc}`);
  }));
  return out;
};

// Mapeo de id de módulo (NAV) → nombre en MODULES_PERM
// null = siempre visible (no requiere permiso)
export const NAV_PERM = {
  dashboard:    null,
  pos:          'Punto de venta',
  billing:      'Facturación',
  fel:          'Facturación',
  returns:      'Facturación',
  cash:         'Cierre de caja',
  inventory:   'Inventario',
  catalog:     'Inventario',
  variants:    'Inventario',
  stockcount:  'Inventario',
  uom:          'Inventario',
  purchases:    'Compras',
  transfers:    'Inventario',
  reports:      'Reportes',
  quotes:       'Reportes',
  promotions:   'Punto de venta',
  clients:      'Clientes',
  loyalty:      'Clientes',
  cxc:          'Clientes',
  cxp:          'Compras',
  accounting:   'Contabilidad',
  costcenters:  'Contabilidad',
  presupuestos: 'Contabilidad',
  ledger:       'Contabilidad',
  financials:   'Contabilidad',
  banks:        'Contabilidad',
  bankrec:      'Contabilidad',
  maintenance:  'Mantenimientos',
  users:        'Mantenimientos',
  payroll:      'Mantenimientos',
  fixedassets:  'Mantenimientos',
  audit:        'Mantenimientos',
  config:       'Configuración',
};

export const canView = (moduleId, perms = []) => {
  if (perms.includes('*')) return true;
  const moduleName = NAV_PERM[moduleId];
  if (moduleName == null) return true;
  return permsToMatrix(perms)[moduleName]?.ver === true;
};
