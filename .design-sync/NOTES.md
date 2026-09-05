# design-sync — notas de Stackline

Repo-específico. Léelo antes de cada re-sync.

## Contexto del repo
- `stackline` es una **app Vite + React (JS/JSX)**, no una librería de componentes.
  No hay `dist/` de librería, ni `.d.ts`, ni Storybook.
- Por eso corre en **modo synth-entry**: el converter sintetiza el entry desde
  `src/components` (fijado en `cfg.srcDir`). Invocación:
  ```
  node .ds-sync/package-build.mjs --config .design-sync/config.json \
    --node-modules ./node_modules --entry ./dist/index.es.js --out ./ds-bundle
  ```
  El `--entry ./dist/index.es.js` **no existe a propósito** — así `resolveDistEntry`
  cae a synth y `PKG_DIR` se resuelve a la raíz del repo (nombre `stackline`).
- Scope: solo `src/components`. Se excluyen 10 sub-componentes internos del panel
  de dev `TweaksPanel` (`Tweak*`) vía `componentSrcMap: null`.

## Componentes (4)
- `Icon` — preview autorado (`.design-sync/previews/Icon.tsx`), graded good.
- `GlobalSearch` — floor-card auto-render (muestra su paleta con mock interno).
- `NotificationsPanel` — floor card (necesita prop `notifications`).
- `TweaksPanel` — floor card (panel dev).

## Gotcha: default exports en synth-entry
El entry sintético usa `export * from`, que **NO reenvía default exports**. `Icon` y
`GlobalSearch` eran default-only y no llegaban a `window.Stackline` → `[BUNDLE_EXPORT]`.
**Fix aplicado en el código de la app:** se añadió un named export a cada uno
(`export { Icon }` en `Icon.jsx`; se convirtió `GlobalSearch` a named + `export default`).
Si alguien revierte esos named exports, el build vuelve a fallar `[BUNDLE_EXPORT]`.

## Fonts
`[FONT_MISSING]` para IBM Plex Sans/Mono y JetBrains Mono: la app las sirve por
Google Fonts (link en `index.html`), no hay `@font-face` en el CSS. Suprimido con
`cfg.runtimeFontPrefixes`. Los previews en Claude Design pueden verse con fuente de
sistema (fallback razonable definido en `--font-sans`/`--font-mono`).
- **Intentado y descartado:** un `cssEntry` envoltorio con `@import` a Google Fonts +
  `@import` a global.css **rompe el CSS** — el converter copia `cssEntry` como archivo
  único y no resuelve sus `@import` locales, así se perdían los 53KB de estilos.
  `cssEntry` debe apuntar directo a `src/styles/global.css`.

## Known render warns
- `[RENDER_BLANK]` en `Icon` **solo aparece si no está autorado** el preview; con
  `previews/Icon.tsx` presente, desaparece. No es un warn nuevo si vuelve tras borrar
  el preview.

## Re-sync risks
- El fix de default exports vive en el código de la app (`Icon.jsx`, `GlobalSearch.jsx`),
  no en config — es lo primero que se rompe si alguien refactoriza los componentes.
- Playwright/Chromium: la caché usa build **1223** → requiere **playwright@1.60.0**
  (instalado en `.ds-sync`). Otra versión falla con "Executable doesn't exist".
- Previews de `NotificationsPanel`/`TweaksPanel` quedaron en floor card; autorarlos es
  el siguiente paso incremental (necesitan props de datos / providers).
- Si se agregan componentes de diseño reutilizables, considerar sacarlos a una
  librería real (con build + tipos) para un import de alta fidelidad.
