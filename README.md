# ERP MAYA · Sistema Retail

ERP modular para retail (Inventario · POS · Facturación · Compras · Reportería)
construido como un **proyecto compilado** Vite + React 18 con backend Node.js +
Express + SQLite. Diseñado para tiendas con múltiples sucursales en Guatemala
(GTQ, IVA 12%, DTE-FEL).

> Este repositorio incluye **dos** áreas:
> - **`/`** (raíz del proyecto) — prototipo HTML servido sin build (Babel en
>   navegador). Útil para iterar diseño rápido.
> - **`compiled/`** — versión compilada lista para producción.
>
> Este README documenta la versión compilada.

---

## Requisitos

| Herramienta | Versión |
|---|---|
| Node.js | ≥ 20 |
| npm     | ≥ 10 |

> `better-sqlite3` necesita compilarse de forma nativa en la primera instalación.
> Si no quieres tocar SQLite, eliminá los routers del backend y dejá la app
> contra los mocks de `src/data/mock.js`.

---

## Estructura

```
compiled/
├── index.html              ← entry HTML (Vite)
├── vite.config.js          ← build + dev proxy a /api
├── package.json
├── .env.example
├── .eslintrc.cjs
├── src/
│   ├── main.jsx            ← bootstrap React
│   ├── App.jsx             ← shell (sidebar + topbar + ruteo)
│   ├── components/
│   │   ├── Icon.jsx        ← set Lucide-style
│   │   └── TweaksPanel.jsx ← panel de tweaks (dev only)
│   ├── modules/
│   │   ├── Dashboard.jsx
│   │   ├── POS.jsx         ← punto de venta touch + ticket 80mm
│   │   ├── Inventory.jsx   ← productos, stock, kardex, lotes
│   │   ├── Billing.jsx     ← tickets/facturas DTE-FEL
│   │   ├── Reports.jsx     ← reportería ventas + compras
│   │   └── Maintenance.jsx ← catálogos (categorías, proveedores, usuarios)
│   ├── data/mock.js        ← datos demo en memoria
│   ├── lib/api.js          ← cliente fetch del backend
│   └── styles/global.css   ← tokens de diseño + estilos
└── server/
    ├── index.js            ← Express bootstrap
    ├── db.js               ← esquema SQLite (idempotente)
    ├── seed.js             ← `npm run server:seed`
    ├── data/               ← archivo .db (ignorado por git)
    └── routes/
        ├── products.js
        ├── sales.js
        ├── purchases.js
        ├── reports.js
        ├── cash.js
        └── _catalogs.js    ← categorías, sucursales, proveedores, usuarios, auth
```

---

## Setup

```bash
cd compiled
cp .env.example .env
npm install
npm run server:seed     # crea SQLite + datos demo
npm start               # arranca Vite (5173) + API (4000) en paralelo
```

- Frontend: <http://localhost:5173>
- API:      <http://localhost:4000/api/health>

> Usuario demo seed: `ana@erpmaya.gt` / `demo123`

### Scripts

| Script | Descripción |
|---|---|
| `npm run dev`         | Sólo Vite (frontend) |
| `npm run server`      | Sólo Express (backend) |
| `npm start`           | Ambos en paralelo (concurrently) |
| `npm run server:seed` | Aplica esquema + poblado demo |
| `npm run build`       | Build de producción (`dist/`) |
| `npm run preview`     | Sirve `dist/` |
| `npm run lint`        | ESLint |

---

## Módulos

| Módulo | Ruta sidebar | Responsabilidades |
|---|---|---|
| **Dashboard**     | `/dashboard`  | KPIs, ventas por día, top productos, alertas |
| **POS**           | `/pos`        | Carrito, cobro multi-método, ticket 80mm |
| **Facturación**   | `/billing`    | Tickets DTE-FEL, devoluciones, reimpresión |
| **Inventario**    | `/inventory`  | Productos, stock por sucursal, kardex, lotes, alertas |
| **Compras**       | `/purchases`  | OCs, recepciones parciales, kardex de entradas |
| **Reportería**    | `/reports`    | Ventas y compras (por día/cat/producto/cajero/proveedor) |
| **Mantenimientos**| `/maintenance`| CRUD de categorías, sucursales, proveedores, promos |
| **Usuarios**      | `/users`      | Usuarios, roles y permisos |

---

## API

Base URL: `/api` (proxied desde Vite en dev; servido directo en prod).

### Productos
- `GET    /products?cat=&q=&branch=&low=`
- `GET    /products/:sku`
- `POST   /products`
- `PUT    /products/:sku`
- `DELETE /products/:sku`
- `POST   /products/:sku/adjust`         → ajuste de stock

### Ventas
- `GET    /sales?from=&to=&branch=&pay=&status=`
- `GET    /sales/:id`
- `POST   /sales`                         → registra venta + descuenta stock (transacción)
- `POST   /sales/:id/refund`              → devolución

### Compras
- `GET    /purchases?...`
- `GET    /purchases/:id`
- `POST   /purchases`
- `POST   /purchases/:id/receive`         → recepción parcial/total + ingreso stock

### Caja
- `POST   /cash/open`
- `POST   /cash/:id/close`
- `GET    /cash/:id`

### Reportes
- `GET    /reports/sales?from=&to=&branch=&group=day|cat|product|cashier`
- `GET    /reports/purchases?from=&to=&supplier=&group=day|supplier`
- `GET    /reports/inventory?branch=`

### Catálogos / Auth
- `GET  /categories`, `/branches`, `/suppliers`, `/users`
- `POST /auth/login`, `GET /auth/me`

---

## Enrutamiento a microservicios (registro en el front)

El front resuelve la URL del backend **por prefijo de ruta**, en un único punto:
`src/api/services.js`. Todas las llamadas pasan por `client.js`, que antepone la
URL base que corresponda vía `resolveBaseUrl(path)`. Como todos los endpoints ya
usan `/api/*`, hoy **todo va al servicio `core`** sin tocar los módulos.

**Piezas:**

| Archivo | Rol |
|---|---|
| `src/api/services.js` | `SERVICES` (URL por servicio) + `ROUTES` (prefijo → servicio) + `resolveBaseUrl()` |
| `src/api/client.js`   | Cliente `fetch`; usa `resolveBaseUrl(path)` para armar la URL final |
| `vite.config.js`      | Proxy de **dev** como espejo del registro (targets configurables por env) |

**Grupos ya definidos.** Los ~46 prefijos están agrupados en **7 servicios
lógicos**. Hoy todos apuntan al mismo backend local (`:8080`); cada uno tiene su
propia env var para repuntarlo cuando se separe, sin tocar el resto.

| Servicio | Dominio | Prefijos (ejemplos) |
|---|---|---|
| `core`    | Catálogo + inventario | `/api/products` `/api/categories` `/api/product-variants` `/api/uom` `/api/stock` `/api/inventory` `/api/stock-counts` `/api/transfers` |
| `ventas`  | POS + comercial | `/api/pos` `/api/sales` `/api/cash-registers` `/api/quotes` `/api/promotions` `/api/loyalty` `/api/credit-notes` `/api/clients` |
| `compras` | Compras + proveedores | `/api/purchase-orders` `/api/purchase-invoices` `/api/supplier-payments` `/api/suppliers` |
| `conta`   | Contabilidad + tesorería + activos | `/api/accounts` `/api/journal-entries` `/api/accounting-periods` `/api/budgets` `/api/cost-centers` `/api/bank-accounts` `/api/receivables` `/api/payments` `/api/fixed-assets` |
| `fel`     | Facturación electrónica | `/api/fel` |
| `rrhh`    | Empleados + planilla | `/api/employees` `/api/payroll-periods` |
| `admin`   | Seguridad + organización + plataforma | `/api/auth` `/api/users` `/api/roles` `/api/company` `/api/branches` `/api/settings` `/api/dashboard` `/api/notifications` `/api/search` `/api/reports` `/api/audit-log` |

**Variables de entorno** (ver `.env.example`) — una por servicio:

| Var | Default | Descripción |
|---|---|---|
| `VITE_SVC_<GRUPO>`        | `''` (mismo origen) | URL base del servicio en **runtime**. Vacío → proxy de Vite (dev) / gateway (prod). Ej. prod: `https://ventas.tudominio.com` |
| `VITE_DEV_<GRUPO>_TARGET` | `http://localhost:8080` | Target del proxy de Vite para ese servicio en **dev** |

> `<GRUPO>` ∈ `CORE`, `VENTAS`, `COMPRAS`, `CONTA`, `FEL`, `RRHH`, `ADMIN`.

### Separar un microservicio (ej. FEL)

Como las rutas ya están cableadas, separar un servicio es solo **configuración**:

1. **`.env`** → dar URL de runtime y (para dev) su target de proxy:
   ```bash
   VITE_SVC_FEL=https://fel.tudominio.com   # prod / runtime
   VITE_DEV_FEL_TARGET=http://localhost:4010 # dev
   ```

No hay que tocar `services.js`, `vite.config.js` ni ningún módulo: la regla
`'/api/fel' → fel` ya existe en ambos lados.

> ⚠️ **Dominios sin prefijo común.** Algunos servicios abarcan varios prefijos
> (contabilidad = `/api/accounts` + `/api/journal-entries` + `/api/budgets` + …),
> por eso se enrutan por *lista* de prefijos y no por uno solo. Si más adelante
> quieres simplificar, agrupá esos endpoints bajo un prefijo común en el backend
> (p.ej. `/api/accounting/...`) y colapsá las reglas.
>
> El orden importa en `ROUTES` (services.js) y en `ROUTE_MAP` (vite.config.js):
> **los prefijos más específicos van primero** (gana la primera coincidencia).

---

## Conectar el frontend al backend

Cada módulo importa hoy desde `src/data/mock.js`. Para conectarlos al backend:

```jsx
// Antes:
import * as MAYA from '../data/mock.js';
const { PRODUCTS } = MAYA;

// Después:
import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

function POSModule() {
  const [products, setProducts] = useState([]);
  useEffect(() => { api.listProducts().then(setProducts); }, []);
  // ...
}
```

El cliente `api` ya cubre todos los endpoints — ver `src/lib/api.js`.

---

## Build & Deploy

```bash
npm run build           # genera dist/
npm run preview         # sirve dist/ en :5173 para verificar
```

Despliegue típico:
- **Frontend** (`dist/`) → cualquier static host (Vercel, Netlify, S3+CloudFront, Nginx).
- **Backend** (`server/`) → Node 20 en VPS / Railway / Fly.io.
- **DB** → SQLite (1 sucursal) o migración a Postgres (multi-sucursal con réplica).
- **Proxy**: el static host reescribe `/api/*` al backend; o servís ambos
  desde el mismo dominio.

Variables de entorno (ver `.env.example`):

| Var | Default | Descripción |
|---|---|---|
| `PORT`                 | 4000 | Puerto del backend |
| `DB_PATH`              | `./server/data/erp_maya.db` | Ruta del archivo SQLite |
| `CORS_ORIGIN`          | `http://localhost:5173` | Origen permitido para CORS |
| `VITE_SVC_CORE`        | `''` (mismo origen) | URL base del backend `core` del front — ver [Enrutamiento a microservicios](#enrutamiento-a-microservicios-registro-en-el-front) |
| `VITE_DEV_CORE_TARGET` | `http://localhost:8080` | Target del proxy de Vite para `/api` en dev |

---

## Roadmap sugerido

- [ ] Autenticación JWT real (refresh tokens) + middleware de permisos
- [ ] Migrar a Postgres + Drizzle/Prisma para producción multi-sucursal
- [ ] Cliente de impresoras térmicas vía ESC/POS (paquete `node-thermal-printer`)
- [ ] Integración real con SAT-FEL (proveedor certificador)
- [ ] Sincronización offline-first (Service Worker + IndexedDB para POS)
- [ ] Reportes PDF (puppeteer) y export Excel (xlsx)
- [ ] Tests: Vitest (front) + node:test (back)
- [ ] CI/CD: GitHub Actions con build + lint + tests

---

## Licencia

MIT — Para uso interno de la organización propietaria.
