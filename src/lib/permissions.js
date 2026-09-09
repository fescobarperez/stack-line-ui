// Stackline — Permisos
//
// Un permiso por OPCIÓN de menú, no por sección. Antes había diez grupos
// —'Inventario' cubría productos, catálogo, variantes, conteo, unidades y
// traslados— y eso obligaba a dar de más: quien pudiera ver un informe podía
// crear cotizaciones, porque ambas colgaban de 'Reportes'.
//
// El formato persistido no cambia: sigue siendo "clave|acción" en
// Role.permissions. Lo que cambia es que la clave ahora es el id del módulo.

export const ACTIONS = ['ver', 'crear', 'editar', 'eliminar'];

/**
 * Las opciones del menú agrupadas por sección, en el mismo orden.
 *
 * `exento: true` = visible siempre, sin permiso. Solo el Dashboard: sin él un
 * usuario entra a una pantalla vacía y no sabe qué hacer.
 *
 * ⚠️ Debe reflejar NAV de App.jsx. Una opción de menú que no esté aquí queda
 * SIN control: `canView` la deja pasar para todos, que es como Proyectos
 * estuvo visible para cualquier rol.
 */
export const PERM_SECTIONS = [
  { section: 'OPERACIÓN', items: [
    { id: 'dashboard', label: 'Dashboard',            exento: true },
    { id: 'pos',       label: 'Punto de venta' },
    { id: 'billing',   label: 'Facturación' },
    { id: 'fel',       label: 'FEL · SAT' },
    { id: 'returns',   label: 'Devoluciones' },
    { id: 'cash',      label: 'Caja y Cortes' },
  ]},
  { section: 'INVENTARIO', items: [
    { id: 'inventory',  label: 'Productos y stock' },
    { id: 'catalog',    label: 'Catálogo de productos' },
    { id: 'variants',   label: 'Variantes' },
    { id: 'stockcount', label: 'Conteo físico' },
    { id: 'uom',        label: 'Unidades de Medida' },
    { id: 'purchases',  label: 'Compras y OCs' },
    { id: 'transfers',  label: 'Transferencias' },
  ]},
  { section: 'ANÁLISIS', items: [
    { id: 'reports',    label: 'Reportería' },
    { id: 'quotes',     label: 'Cotizaciones' },
    { id: 'projects',   label: 'Proyectos' },
    { id: 'promotions', label: 'Promociones' },
  ]},
  { section: 'CRM', items: [
    { id: 'clients', label: 'Clientes' },
    { id: 'loyalty', label: 'Fidelización' },
    { id: 'cxc',     label: 'Cuentas por Cobrar' },
    { id: 'cxp',     label: 'Cuentas por Pagar' },
  ]},
  { section: 'CONTABILIDAD', items: [
    { id: 'accounting',   label: 'Contabilidad' },
    { id: 'costcenters',  label: 'Centros de Costo' },
    { id: 'presupuestos', label: 'Presupuestos' },
    { id: 'ledger',       label: 'Mayor General' },
    { id: 'financials',   label: 'Estados Financieros' },
    { id: 'banks',        label: 'Bancos y Cuentas' },
    { id: 'bankrec',      label: 'Conciliación Bancaria' },
  ]},
  { section: 'ADMINISTRACIÓN', items: [
    { id: 'maintenance', label: 'Mantenimientos' },
    { id: 'users',       label: 'Usuarios y roles' },
    { id: 'payroll',     label: 'Planilla' },
    { id: 'fixedassets', label: 'Activos Fijos' },
    { id: 'audit',       label: 'Auditoría' },
    { id: 'config',      label: 'Configuración' },
  ]},
];

/** Los ids que se controlan, sin los exentos. */
export const PERM_ITEMS = PERM_SECTIONS.flatMap(s => s.items.filter(i => !i.exento));
export const PERM_IDS = PERM_ITEMS.map(i => i.id);

export const labelOf = (id) =>
  PERM_SECTIONS.flatMap(s => s.items).find(i => i.id === id)?.label || id;

export const initPerms = () =>
  Object.fromEntries(PERM_IDS.map(id => [id, { ver: false, crear: false, editar: false, eliminar: false }]));

/**
 * Nombres del esquema anterior y las opciones que cubría cada uno.
 *
 * Los roles guardados dicen "Inventario|ver", y si se ignoraran esos permisos
 * el usuario perdería el acceso de golpe. Aquí se expanden al leer, así que
 * los roles viejos siguen funcionando sin migrar la base. Al guardar el rol
 * queda escrito en el formato nuevo.
 */
const GRUPOS_ANTIGUOS = {
  'Punto de venta': ['pos', 'promotions'],
  'Facturación':    ['billing', 'fel', 'returns'],
  'Cierre de caja': ['cash'],
  'Inventario':     ['inventory', 'catalog', 'variants', 'stockcount', 'uom', 'transfers'],
  'Compras':        ['purchases', 'cxp'],
  'Reportes':       ['reports', 'quotes'],
  'Clientes':       ['clients', 'loyalty', 'cxc'],
  'Contabilidad':   ['accounting', 'costcenters', 'presupuestos', 'ledger', 'financials', 'banks', 'bankrec'],
  'Mantenimientos': ['maintenance', 'users', 'payroll', 'fixedassets', 'audit'],
  'Configuración':  ['config'],
};

/** Códigos cortos del mock original (pos, inv:r, …). */
const CODIGOS_CORTOS = {
  'pos':     [['pos', ['ver', 'crear']]],
  'pos:r':   [['pos', ['ver']]],
  'inv':     [['inventory', ['ver', 'crear', 'editar']]],
  'inv:r':   [['inventory', ['ver']]],
  'rpt':     [['reports', ['ver']]],
  'rpt:com': [['reports', ['ver']], ['purchases', ['ver']]],
  'tkt':     [['billing', ['ver', 'crear']]],
  'tkt:r':   [['billing', ['ver']]],
};

export const permsToMatrix = (perms = []) => {
  const m = initPerms();
  if (perms.includes('*')) {
    PERM_IDS.forEach(id => ACTIONS.forEach(a => { m[id][a] = true; }));
    return m;
  }
  perms.forEach(p => {
    if (typeof p === 'string' && p.includes('|')) {
      const [clave, accion] = p.split('|');
      if (!ACTIONS.includes(accion)) return;
      if (m[clave]) { m[clave][accion] = true; return; }          // formato nuevo
      (GRUPOS_ANTIGUOS[clave] || []).forEach(id => {              // formato viejo
        if (m[id]) m[id][accion] = true;
      });
      return;
    }
    (CODIGOS_CORTOS[p] || []).forEach(([id, accs]) =>
      accs.forEach(a => { if (m[id]) m[id][a] = true; }));
  });
  return m;
};

export const matrixToPerms = (matrix) => {
  const todo = PERM_IDS.every(id => ACTIONS.every(a => matrix[id]?.[a]));
  if (todo) return ['*'];
  const out = [];
  PERM_IDS.forEach(id => ACTIONS.forEach(a => {
    if (matrix[id]?.[a]) out.push(`${id}|${a}`);
  }));
  return out;
};

/**
 * Sin `ver`, el módulo no aparece y las demás acciones no significan nada.
 * Se limpian al guardar para no dejar roles con «crear factura pero no ver
 * Facturación», que no se puede cumplir y confunde a quien lo lea después.
 */
export const normalizarMatriz = (matrix) => {
  const out = {};
  PERM_IDS.forEach(id => {
    const p = matrix[id] || {};
    out[id] = p.ver
      ? { ver: true, crear: !!p.crear, editar: !!p.editar, eliminar: !!p.eliminar }
      : { ver: false, crear: false, editar: false, eliminar: false };
  });
  return out;
};

/** Puntos de partida. No son roles fijos: rellenan y quedan editables. */
export const PRESETS = [
  { id: 'cajero', label: 'Cajero',
    total: ['pos', 'cash', 'returns'], ver: ['billing', 'fel', 'clients'] },
  { id: 'contador', label: 'Contador',
    total: ['accounting', 'costcenters', 'presupuestos', 'ledger', 'financials', 'banks', 'bankrec'],
    ver: ['reports', 'billing', 'cxc', 'cxp', 'fixedassets'] },
  { id: 'gerente', label: 'Gerente',
    total: PERM_IDS.filter(id => !['users', 'config', 'audit'].includes(id)),
    ver: ['users', 'audit'] },
  { id: 'lectura', label: 'Solo ver', total: [], ver: PERM_IDS },
];

export const aplicarPreset = (preset) => {
  const m = initPerms();
  preset.ver.forEach(id => { if (m[id]) m[id].ver = true; });
  preset.total.forEach(id => {
    if (m[id]) ACTIONS.forEach(a => { m[id][a] = true; });
  });
  return m;
};

export const canView = (moduleId, perms = []) => {
  if (perms.includes('*')) return true;
  const item = PERM_SECTIONS.flatMap(s => s.items).find(i => i.id === moduleId);
  if (!item) return true;          // fuera del menú: no se controla aquí
  if (item.exento) return true;
  return permsToMatrix(perms)[moduleId]?.ver === true;
};
