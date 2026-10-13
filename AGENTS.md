# Stackline · Interfaz

Front del ERP **Stackline**, para comercio y servicios en Guatemala.
React con Vite, en español.

El backend vive en un repositorio aparte: `stack-line-services`. Los dos se
clonan como hermanos; el despliegue lo orquesta `deploy/` de aquel.

## Lo que hay que saber antes de tocar nada

**Todo —código, comentarios, mensajes de commit y textos de pantalla— va en
español.** Los identificadores en inglés, como ya está.

**Es un ERP contable.** Una cifra mal formateada o un campo que no guarda no es
un detalle estético: es una factura equivocada. Los toast de éxito solo se
muestran cuando el backend confirmó.

## Arranque

```bash
npm install
npm run dev      # Vite en :5173, con proxy al backend en :8080
```

## Cómo llega al backend

`src/api/services.js` es el **punto único** que decide a qué URL va cada
petición, por prefijo de ruta. Hoy todo apunta al mismo backend, así que las
URLs base están vacías = mismo origen: en desarrollo lo resuelve el proxy de
Vite, en producción Caddy, que sirve el estático y pasa `/api` al backend.

Por eso **no hay CORS que configurar**. Si algún día se separa un microservicio,
se define su URL en `VITE_SVC_<GRUPO>` y las reglas de `ROUTES` ya están puestas.

`src/api/client.js` centraliza el JWT, el header de empresa y los errores; un
401 limpia la sesión y manda al login.

## Estructura

- `src/modules/` — una pantalla por archivo: `POS`, `Billing`, `Projects`,
  `Inventory`, `Accounting`, `CxC`, `Quotes`, `Purchases`…
- `src/components/` — lo reutilizable: `DataTable`, `Button`, `StatCard`,
  `Icon`, `AuthorizationDialog`, `ConfirmDialog`
- `src/hooks/` — acceso a datos por dominio (`useOperations`, `useCatalog`,
  `useAccounting`…), con recarga difundida entre instancias montadas
- `src/lib/` — utilidades sin React, como la impresión de recibos
- `src/styles/global.css` — **una sola hoja de estilos** con todo

## Reglas que cuestan caro romper

**Usar los componentes reutilizables, no reinventarlos.** `DataTable` para toda
tabla, `Button` para todo botón, `StatCard` para las tarjetas de indicador.
Existen precisamente para que no haya cinco estilos de lo mismo; una tabla
escrita a mano se nota de inmediato.

**Botones**: `variant` gobierna la apariencia (`accent`, `tonal`, `ghost`,
`danger`, `icon`…). `className` es solo para posicionamiento puntual, nunca para
variantes. `variant="icon"` da el botón redondo sin borde de las filas de tabla;
`iconOnly` es otra cosa — un botón con borde que solo lleva icono.

**Tipografía Material Design 3.** Los tamaños y pesos salen de las utilidades y
los tokens de `global.css` (`--md-sys-color-*`, `--font-sans`, `--shape-*`). No
poner `font-size` a mano en JSX.

**Nada de datos quemados.** Todo sale de la API. Los arreglos de ejemplo se
fueron uno por uno y no deben volver.

**Los toast de error usan `'danger'`**, no `'error'` — solo `.toast.success` y
`.toast.danger` existen en el CSS.

**Textos por i18n** (`react-i18next`, español e inglés), con el texto en español
como valor por defecto: `t('clave', 'Texto')`.

## Responsive: escritorio, tablet y teléfono

Tres anchos, definidos en `src/lib/breakpoints.js` y repetidos en los `@media`
de `global.css` (las variables CSS no funcionan dentro de `@media`):

| Dispositivo | Ancho | En CSS |
|---|---|---|
| Teléfono | ≤ 599 px | `@media (max-width: 599px)` |
| Tablet | 600–1024 px | `@media (max-width: 1024px)` (incluye teléfono) |
| Escritorio | ≥ 1025 px | sin `@media` |

- La estructura (menú lateral, barra superior, márgenes) la decide `App.jsx`
  con `useLayout()` y la expone en `.app[data-layout][data-sidebar]`. En tablet
  el menú es un riel de iconos y en teléfono un cajón; los dos se abren encima
  del contenido.
- **Código nuevo sin estilos inline de layout.** Grillas, anchos fijos y filas
  flex van en clases de `global.css` con su versión para tablet y teléfono. Un
  `style={{ width: 600 }}` no se puede adaptar desde un `@media`.
- La sección «Responsive» al final de `global.css` tiene una red de seguridad
  para los estilos inline que aún quedan (reglas sobre `[style*=…]`). Es para
  que nada se rompa mientras se migran los módulos, no para apoyarse en ella.
- Lo que en escritorio aparece al pasar el mouse tiene que estar visible en
  pantallas táctiles (`@media (hover: none)`).
- Al tocar una pantalla, revisarla a 375, 768 y 1280 px.

## Verificar antes de dar algo por hecho

`npx vite build` **no detecta identificadores indefinidos**: un componente sin
importar compila y revienta al renderizar, con pantalla en blanco. Después de
tocar un módulo, abrirlo en el navegador.

## Dominio

Guatemala: facturación electrónica **FEL/SAT**, IVA del 12% **incluido en el
precio**, quetzales.

Conceptos que conviene entender antes de tocar sus pantallas:

- **Turnos de caja** — una caja abierta se cierra con su arqueo antes de operar
  al día siguiente
- **Autorizaciones** — descuentos y sobrecostos que exigen aprobación de un
  superior, por PIN o por bandeja
- **Proyectos** — rentabilidad por trabajo: contratado, ejecutado, comprometido,
  facturado y cobrado, que son cinco cosas distintas
- **Tipo de artículo** — decide si algo se vende en POS, se consume en un
  proyecto o es mano de obra. La categoría es solo agrupación.

## Despliegue

Publicación **manual** desde Actions → Deploy. El servidor trae ambos
repositorios y reconstruye solo lo que cambió.
