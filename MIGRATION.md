# Migración a Material Design 3 — Stackline

Migración **exclusivamente visual** (sin cambios de lógica, props ni datos).
Source color: `#00696B` (paleta tonal teal base de M3).

## Estrategia: 4 capas globales (sin editar componente por componente)

1. **Roles M3** en `:root` (`--md-sys-color-*`), shape scale, elevación, motion.
2. **Aliases de compatibilidad**: los tokens legacy apuntan a roles M3, de modo
   que los ~1.900 estilos inline y todas las clases existentes adoptan M3 sin tocar
   los módulos.
3. **Clases compartidas** reescritas con **state layers M3** (`::after`,
   `currentColor` a 8% hover / 10% press) en vez de `filter:brightness`.
4. **Defaults de elemento** (pendiente en fases siguientes para tags crudos).

## Tabla de tokens legacy → roles M3

| Token legacy      | Rol M3                                   |
|-------------------|------------------------------------------|
| `--bg`            | `surface-container-low`                  |
| `--surface`       | `surface-container-lowest`               |
| `--surface-2`     | `surface-container`                      |
| `--surface-3`     | `surface-container-high`                 |
| `--border`        | `outline-variant`                        |
| `--border-strong` | `outline`                                |
| `--text`          | `on-surface`                             |
| `--text-2`        | `on-surface-variant`                     |
| `--muted`         | `on-surface-variant`                     |
| `--accent`        | `primary`                                |
| `--accent-soft`   | `primary-container`                      |
| `--accent-ink`    | `on-primary-container`                   |
| `--accent-2`      | `tertiary`                               |
| `--success`       | `success` (extendido)                    |
| `--success-soft`  | `success-container` (extendido)          |
| `--warning`       | `warning` (extendido)                    |
| `--warning-soft`  | `warning-container` (extendido)          |
| `--danger`        | `error`                                  |
| `--danger-soft`   | `error-container`                        |
| `--info`          | `tertiary`                               |
| `--info-soft`     | `tertiary-container`                     |
| `--r-sm`          | `--shape-xs` (4px)                        |
| `--r-md`          | `--shape-sm` (8px)                        |
| `--r-lg`          | `--shape-md` (12px)                       |
| `--r-xl`          | `--shape-lg` (16px)                       |
| `--shadow-sm`     | `--elev-1`                               |
| `--shadow-md`     | `--elev-2`                               |
| `--shadow-lg`     | `--elev-3`                               |

> `success` y `warning` no existen en M3 base; se agregaron como roles extendidos
> con sus pares `container` / `on-container`.

## Mapa de iconos (legacy → Material Symbols Outlined)

| Legacy        | Material Symbols   | Legacy       | Material Symbols  |
|---------------|--------------------|--------------|-------------------|
| dashboard     | space_dashboard    | download     | download          |
| pos           | point_of_sale      | upload       | upload            |
| box           | inventory_2        | edit         | edit              |
| receipt       | receipt_long       | trash        | delete            |
| chart         | monitoring         | alert        | warning           |
| settings      | tune               | barcode      | barcode           |
| user          | person             | calendar     | calendar_month    |
| users         | group              | clock        | schedule          |
| supplier      | local_shipping     | arrowUp      | arrow_upward      |
| search        | search             | arrowDown    | arrow_downward    |
| plus          | add                | refresh      | refresh           |
| minus         | remove             | filter       | filter_list       |
| x / close     | close              | branch       | account_tree      |
| check         | check              | shield       | shield            |
| chevronDown   | expand_more        | return       | undo              |
| chevronRight  | chevron_right      | tag          | sell              |
| chevronLeft   | chevron_left       | moon         | dark_mode         |
| bell          | notifications      | menu         | menu              |
| cash          | payments           | dots         | more_vert         |
| card          | credit_card        | lock         | lock              |
| transfer      | swap_horiz         | eye          | visibility        |
| print         | print              | truck / bolt | local_shipping / bolt |

Nombres no mapeados pasan tal cual (permite usar cualquier Material Symbol nuevo
directamente por su nombre M3).

## Cableado de la escala tipográfica a elementos compartidos

Además de las 15 clases utilitarias, las clases compartidas heredan los valores
exactos de la escala (propaga a los 33 módulos sin editarlos):

| Elemento (clase)          | Escala M3       |
|---------------------------|-----------------|
| `.page-title`             | headline-large  |
| `.page-subtitle`          | body-medium     |
| `.card-head h3`           | title-medium (16px, ajustado) |
| `.card-head .meta`        | body-small (mono) |
| `.stat .val` (KPI)        | display-small   |
| `table.tbl` (celdas)      | 13px (ajustado, base body-medium) |
| `table.tbl thead th`      | label-medium    |
| `.btn` / `.nav-item` / `.chip` | label-large |
| `.tab`                    | label-large     |
| `.field label`            | label-medium    |
| `.field input/select`     | body-large      |
| `.sidebar-brand .name`    | title-large     |
| `.sidebar-brand .tier`    | label-small     |
| `.sidebar-org-name`       | title-small     |
| `.user-info .nm`          | title-small     |
| `.user-info .rl`          | label-small     |

Roboto se carga con pesos **300/400/500/700**.

## Clases nuevas disponibles

- **Tipografía**: `display/headline/title/body/label` × `large/medium/small` (15).
- **Componentes M3**: `.card-elevated/-filled/-outlined`, `.segmented`/`.seg`,
  `.fab`, `.badge-m3` (+`.success/.warning/.error/.primary/.tertiary`), `.prog`,
  `.snackbar`, `.list-item`, `.search-bar`.
- **Iconos**: `.msi` (Material Symbols), `.msi.fill` (eje FILL 1).

## Estado

- **Fase 1 — Fundaciones**: ✅ tokens, tipografía, iconos, clases base con state layers.
- **Fase 2 — Shell (`App.jsx`)**: ✅ nav drawer 296px (surface-container-low),
  top app bar 64px (surface), search bar docked 48px pill, selector de sucursal
  outlined (shape-md), avatar 32px, section headers label-medium, `&amp;` → `&`,
  toggle de tema mostrando `light_mode`/`dark_mode`.
- **Fase 3 — Módulos (33)**: ✅ 0 hex de UI en todos los módulos (24 restantes en
  Payroll son documentos de impresión, excluidos por diseño como el ticket 80mm).
  Paleta de gráficos tokenizada (`--chart-1..7`), badges `.pill` con par
  container/on-container, tabs primary M3 48px. POS conserva selectable cards para
  método de pago (targets ≥48px) en vez de segmented estricto.
- Fase 4 — Tema oscuro: roles ya definidos y **toggle conectado** (App.jsx aplica
  `data-theme` al `<html>`); dark funcional. Queda auditar contraste en vivo.

## Auditoría de cumplimiento M3 (estilos internos)

Barrido de patrones no-M3 en clases `.pos-*`, login y módulos:

- **`filter: brightness()` en hover** → reemplazado por **state layers** (`::after`
  currentColor 8%/10%) en `.pos-charge` y `.login-submit`.
- **`color: white` / `background: var(--accent)` con texto blanco** → par correcto
  `on-primary` / `on-success` / `on-error` en `.pos-charge`, `.login-submit`,
  `.pos-touch-cart-badge`, `.pos-cat.active` (dark), `.toast.success/.danger`,
  `.login-spinner`.
- **State layers añadidos** a `.pay-btn` y `.pos-prod` (antes: hover por cambio de fondo).
- **Sombras/radios hardcodeados** → tokens: `boxShadow` inline de Quotes (toggle →
  segmented M3 con `secondary-container`), `borderRadius: 6` de los dropdowns de
  Purchases/Transfers → `--shape-sm`.
- **Excluidos por diseño** (documentos de impresión, negro sobre blanco): `.ticket`
  80mm y la boleta/reporte de Payroll.

## Tabla genérica (Data table M3)

Dos capas:

1. **CSS sobre `.tbl`** (opt-in, no rompe tablas existentes): modificadores
   `.comfortable` / `.compact` (densidad), `.sticky-1` (1ª columna sticky),
   `.zebra`; headers `.sortable`/`.sorted` con flecha; columna `.check`
   (selección) y fila `.selected` (primary 8%); `.row-actions` (icon-buttons al
   hover); `tfoot` de totales sticky; contenedor `.datatable` con estados
   `.tbl-empty` / `.tbl-loading` / `.tbl-skel` y `.tbl-pagination`. El hover de
   fila ya usa state layer M3 (8% on-surface).

2. **Componente `src/components/DataTable.jsx`** (opt-in) que renderiza ese markup
   y añade lógica: orden por columna (asc/desc/limpiar), selección (controlada o
   interna, con “seleccionar todo” indeterminado), paginación, densidad, loading
   (skeleton), empty state y fila de totales.

   ```jsx
   <DataTable
     rowKey={(r) => r.sku}
     columns={[
       { key: 'sku',   header: 'SKU',      sortable: true, mono: true },
       { key: 'name',  header: 'Producto', sortable: true },
       { key: 'stock', header: 'Stock',    sortable: true, align: 'right' },
       { key: 'status', header: 'Estado', align: 'center',
         render: (r) => <span className="pill success">Activo</span> },
     ]}
     rows={productos}
     selectable pageSize={20} density="compact"
     totals={{ stock: 1234 }}
     actions={(r) => <button className="icon-btn"><Icon name="edit" size={18}/></button>}
   />
   ```

   Props de columna: `key`, `header`, `align` (`left|right|center`), `sortable`,
   `sortValue`, `render`, `mono`, `width`, `className`. Props de tabla: `rows`,
   `rowKey`, `density`, `sortable`, `defaultSort`, `selectable`, `selected` +
   `onSelectedChange`, `pageSize` (valor inicial), `pageSizeOptions`
   (default `[12,25,50,100]`), `loading`, `empty`, `totals`, `stickyFirst`,
   `zebra`, `actions`, `onRowClick`.

   **Acciones**: `onView(row)` (ojito), `onEdit(row)` y `onDelete(row)` generan
   botones ver/editar/eliminar por fila automáticamente (o `actions` para custom).
   `onRefresh()` agrega un botón de refrescar en una **toolbar** superior (junto con
   `title` y `toolbar` para nodos extra).

   Paginación: selector de **filas por página** + botones **primera / anterior /
   siguiente / última** (al cambiar el tamaño mantiene visible la primera fila actual).

## Confirm dialog M3 (`ConfirmDialog` / `useConfirm`)

Reemplazo de `window.confirm` por un diálogo M3 reutilizable, con patrón
**promise-based**. La app se envuelve una vez con `<ConfirmProvider>` (en `main.jsx`)
y cualquier componente lo usa:

```jsx
const confirm = useConfirm();
const ok = await confirm({
  title: 'Eliminar producto',
  message: '¿Seguro? Esta acción no se puede deshacer.',
  confirmLabel: 'Eliminar', danger: true, icon: 'trash',
});
if (!ok) return;
```

Opciones: `title`, `message`, `confirmLabel`, `cancelLabel`, `danger` (botón
error-filled + icono rojo), `icon`. Diálogo M3 (`surface-container-high`,
`--shape-xl` 28px, elevación 3, scrim), Escape = cancelar, Enter = confirmar.
Ya aplicado en el borrado de Inventory.

## Ajustes V2 (delta sobre la migración)

**A. Tokens/visual**
- Roles de color alineados a los hex exactos de la referencia final (claro y oscuro):
  `on-surface`, `surface-container-low/base/high`, `outline-variant`, `inverse-*`,
  y todo el set oscuro (dark `primary #80D5D4`, etc.).
- `color-scheme: light|dark` en cada bloque de tema.
- En oscuro: `.card-elevated` sin sombra (elevación tonal) y `.fab` a `--elev-1`.
- Transición de tema 350ms (`background/border/color`), con override corto para el
  hover de tablas/botones.

**B. Data-viz** — `--chart-1..5` con valores M3 (redefinidos en oscuro); Dashboard
actualizado a 5 colores.

**C. Copy**
- Dashboard: título = saludo contextual ("Buenos días, {nombre}") + línea de apoyo
  `body-large` ("Resumen operativo · {fecha} · {hora}"); KPIs "Ventas del día" /
  "Tickets emitidos" / "Alertas de stock"; card "Requiere atención"; subtítulos de
  card ("Últimos 14 días · todas las sucursales", "Por categoría · mes actual");
  porcentajes con espacio ("8.4 %").
- Nav: "&" → "y" ("Productos y stock", "Usuarios y roles", "Bancos y Cuentas",
  "Caja y Cortes"), en `translation.json` y en los defaults de `App.jsx`.
- Moneda ya usa "Q " con espacio (helper `Q`).
- Pendiente: revisión fina de strings del resto de módulos (POS/Inventory/Billing/
  Reports/Maintenance) — se hace por módulo a pedido.

**Deviaciones de la V2 NO aplicadas (serían regresiones acá):** `eye → light_mode`
(en este código `eye` es el botón Ver → sigue `visibility`); `lock → logout` global
(rompería Users); key `stackline-theme` (el tema ya se persiste vía `useTweaks`).

## Réplica de Claude Design (Dashboard + menú)

- **Tokens**: alias cortos `--md-*` → `--md-sys-color-*` (permiten portar el CSS del
  mockup casi literal). `success` armonizado a teal (`#00696E` claro / `#82D5D0`
  oscuro).
- **Menú (drawer)**: logo 40px `--shape-md` primary; avatar 40px `tertiary-container`;
  nav items con padding `0 24px 0 16px`, state layer neutro (`on-surface`) y badges
  de **texto plano** (no pill); active con FILL 1.
- **Dashboard** (`.dash`, scopeado para no afectar otros módulos): page-head con
  saludo + **segmented** de rango; **KPI cards** elevated con icono en container
  tonal (pri/ter/sec/err), cifra `display-small`, trend chip; **card-head** con
  título `title-large` + supporting `body-medium`; charts (área + dona con leyenda);
  tabla outlined de más vendidos con `cell-stack` + linear progress; **card-filled
  "Requiere atención"** con `list-item`/`list-lead`; métodos de pago (derivados de
  tickets reales) + tickets recientes con badges; **FAB extendido** "Nueva venta".
  Datos 100% reales del hook `useDashboard`.
- **Cambio de layout a señalar**: se reemplazó la card "Sucursales en vivo"
  (branchSales) y las filas de "vence pronto"/acciones por la estructura del mockup.
  Si querés conservar sucursales, se re-agrega como card extra.

## Notas

- `npm run lint` está roto de forma preexistente (ESLint 9 requiere `eslint.config.js`
  flat; el repo tiene `.eslintrc.cjs`). No relacionado con esta migración.
- `npm run build` pasa sin errores.
