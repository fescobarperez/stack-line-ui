// Registro de microservicios del ERP (enrutamiento del lado del front).
//
// Punto ÚNICO de configuración para decidir a qué backend va cada petición.
// El cliente HTTP (client.js) llama a resolveBaseUrl(path) y antepone la URL
// base que corresponda según el prefijo de la ruta.
//
// HOY todos los servicios corren en el MISMO backend (Micronaut, :8080), así que
// todas las URLs quedan vacías → mismo origen → el proxy de Vite (dev) o el
// gateway (prod) resuelven. Cuando se separe un microservicio basta con:
//   1. Definir su URL en la env var VITE_SVC_<GRUPO> (ver SERVICES).
//   2. (dev) Apuntar su VITE_DEV_<GRUPO>_TARGET en vite.config.js.
// Las reglas de ROUTES ya están puestas, así que no hay que tocar los módulos.

const env = import.meta.env;

// URL base de cada microservicio.
//   ''            → mismo origen (proxy de Vite en dev / gateway en prod).
//   'https://...' → apunta directo a ese host.
export const SERVICES = {
  core:    env.VITE_SVC_CORE    || '', // catálogo + inventario
  ventas:  env.VITE_SVC_VENTAS  || '', // POS + comercial
  compras: env.VITE_SVC_COMPRAS || '', // compras + proveedores
  conta:   env.VITE_SVC_CONTA   || '', // contabilidad + tesorería + activos
  fel:     env.VITE_SVC_FEL     || '', // facturación electrónica DTE-FEL
  rrhh:    env.VITE_SVC_RRHH    || '', // empleados + planilla
  admin:   env.VITE_SVC_ADMIN   || '', // seguridad + organización + plataforma
};

// Reglas de enrutamiento por prefijo de ruta. Gana la PRIMERA coincidencia, así
// que los prefijos más específicos van primero. Lo que no matchee cae al 'core'.
// ⚠️ El proxy de dev (vite.config.js) espeja este mismo mapeo.
export const ROUTES = [
  // ── core · catálogo + inventario ──────────────────────────────────
  { prefix: '/api/product-variants', service: 'core' },
  { prefix: '/api/products',         service: 'core' },
  { prefix: '/api/categories',       service: 'core' },
  { prefix: '/api/uom',              service: 'core' },
  { prefix: '/api/inventory',        service: 'core' },
  { prefix: '/api/stock-counts',     service: 'core' },
  { prefix: '/api/stock',            service: 'core' },
  { prefix: '/api/transfers',        service: 'core' },

  // ── ventas · POS + comercial ──────────────────────────────────────
  { prefix: '/api/pos',              service: 'ventas' },
  { prefix: '/api/sales',            service: 'ventas' },
  { prefix: '/api/cash-registers',   service: 'ventas' },
  { prefix: '/api/quotes',           service: 'ventas' },
  { prefix: '/api/promotions',       service: 'ventas' },
  { prefix: '/api/loyalty',          service: 'ventas' },
  { prefix: '/api/credit-notes',     service: 'ventas' },
  { prefix: '/api/clients',          service: 'ventas' },

  // ── compras · compras + proveedores ───────────────────────────────
  { prefix: '/api/purchase-orders',   service: 'compras' },
  { prefix: '/api/purchase-invoices', service: 'compras' },
  { prefix: '/api/supplier-payments', service: 'compras' },
  { prefix: '/api/suppliers',         service: 'compras' },

  // ── conta · contabilidad + tesorería + activos ────────────────────
  { prefix: '/api/accounting-periods', service: 'conta' },
  { prefix: '/api/accounting',         service: 'conta' },
  { prefix: '/api/accounts',           service: 'conta' },
  { prefix: '/api/journal-entries',    service: 'conta' },
  { prefix: '/api/budgets',            service: 'conta' },
  { prefix: '/api/cost-centers',       service: 'conta' },
  { prefix: '/api/bank-accounts',      service: 'conta' },
  { prefix: '/api/receivables',        service: 'conta' },
  { prefix: '/api/payments',           service: 'conta' },
  { prefix: '/api/fixed-assets',       service: 'conta' },

  // ── fel · facturación electrónica ─────────────────────────────────
  { prefix: '/api/fel',              service: 'fel' },

  // ── rrhh · empleados + planilla ───────────────────────────────────
  { prefix: '/api/employees',        service: 'rrhh' },
  { prefix: '/api/payroll-periods',  service: 'rrhh' },

  // ── admin · seguridad + organización + plataforma ─────────────────
  { prefix: '/api/auth',             service: 'admin' },
  { prefix: '/api/users',            service: 'admin' },
  { prefix: '/api/roles',            service: 'admin' },
  { prefix: '/api/security',         service: 'admin' },
  { prefix: '/api/company',          service: 'admin' },
  { prefix: '/api/branches',         service: 'admin' },
  { prefix: '/api/establishments',   service: 'admin' },
  { prefix: '/api/settings',         service: 'admin' },
  { prefix: '/api/audit-log',        service: 'admin' },
  { prefix: '/api/dashboard',        service: 'admin' },
  { prefix: '/api/notifications',    service: 'admin' },
  { prefix: '/api/search',           service: 'admin' },
  { prefix: '/api/reports',          service: 'admin' },
];

// Resuelve la URL base para una ruta dada (p.ej. '/api/fel/certify').
export function resolveBaseUrl(path) {
  const rule = ROUTES.find((r) => path.startsWith(r.prefix));
  const service = rule ? rule.service : 'core';
  // Si el servicio configurado no tiene URL, cae al core (y este a mismo origen).
  return SERVICES[service] || SERVICES.core || '';
}
