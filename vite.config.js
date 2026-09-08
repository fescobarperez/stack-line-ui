import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // Destino de cada microservicio en DESARROLLO. Hoy todos corren en el mismo
  // backend local (Micronaut, :8080); cada grupo tiene su env var para
  // repuntarlo cuando se separe, sin tocar el resto.
  const DEV_TARGET = (v) => env[v] || 'http://localhost:8080';
  const TARGETS = {
    core:    DEV_TARGET('VITE_DEV_CORE_TARGET'),
    ventas:  DEV_TARGET('VITE_DEV_VENTAS_TARGET'),
    compras: DEV_TARGET('VITE_DEV_COMPRAS_TARGET'),
    conta:   DEV_TARGET('VITE_DEV_CONTA_TARGET'),
    fel:     DEV_TARGET('VITE_DEV_FEL_TARGET'),
    rrhh:    DEV_TARGET('VITE_DEV_RRHH_TARGET'),
    admin:   DEV_TARGET('VITE_DEV_ADMIN_TARGET'),
  };

  // Prefijo de ruta → servicio. DEBE espejar ROUTES de src/api/services.js.
  // Los prefijos más específicos van primero (gana la primera coincidencia).
  const ROUTE_MAP = {
    // core · catálogo + inventario
    '/api/projects': 'core',
    '/api/product-variants': 'core',
    '/api/products': 'core',
    '/api/categories': 'core',
    '/api/uom': 'core',
    '/api/inventory': 'core',
    '/api/stock-counts': 'core',
    '/api/stock': 'core',
    '/api/transfers': 'core',
    // ventas · POS + comercial
    '/api/pos': 'ventas',
    '/api/sales': 'ventas',
    '/api/cash-registers': 'ventas',
    '/api/quotes': 'ventas',
    '/api/promotions': 'ventas',
    '/api/loyalty': 'ventas',
    '/api/credit-notes': 'ventas',
    '/api/clients': 'ventas',
    // compras · compras + proveedores
    '/api/purchase-orders': 'compras',
    '/api/purchase-invoices': 'compras',
    '/api/supplier-payments': 'compras',
    '/api/suppliers': 'compras',
    // conta · contabilidad + tesorería + activos
    '/api/accounting-periods': 'conta',
    '/api/accounting': 'conta',
    '/api/accounts': 'conta',
    '/api/journal-entries': 'conta',
    '/api/budgets': 'conta',
    '/api/cost-centers': 'conta',
    '/api/bank-accounts': 'conta',
    '/api/receivables': 'conta',
    '/api/payments': 'conta',
    '/api/fixed-assets': 'conta',
    // fel · facturación electrónica
    '/api/fel': 'fel',
    // rrhh · empleados + planilla
    '/api/employees': 'rrhh',
    '/api/payroll-periods': 'rrhh',
    // admin · seguridad + organización + plataforma
    '/api/auth': 'admin',
    '/api/users': 'admin',
    '/api/roles': 'admin',
    '/api/security': 'admin',
    '/api/company': 'admin',
    '/api/branches': 'admin',
    '/api/establishments': 'admin',
    '/api/settings': 'admin',
    '/api/audit-log': 'admin',
    '/api/dashboard': 'admin',
    '/api/notifications': 'admin',
    '/api/search': 'admin',
    '/api/reports': 'admin',
  };

  // Espejo del registro de servicios para el proxy de dev.
  const proxy = Object.fromEntries(
    Object.entries(ROUTE_MAP).map(([prefix, svc]) => [
      prefix,
      { target: TARGETS[svc], changeOrigin: true },
    ]),
  );
  // Fallback: cualquier /api que no matchee un prefijo va al 'core'.
  proxy['/api'] = { target: TARGETS.core, changeOrigin: true };

  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: false,
      open: true,
      proxy,
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      target: 'es2020',
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom'],
          },
        },
      },
    },
  };
});
