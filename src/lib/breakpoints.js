// Puntos de corte de la interfaz. Son los mismos números que usan los
// @media de global.css (las variables CSS no funcionan dentro de @media):
//
//   teléfono  ≤ 599 px
//   tablet    600 – 1024 px
//   escritorio ≥ 1025 px
//
// Si se cambian aquí, se cambian también en la sección «Responsive» de
// global.css y en AGENTS.md.

export const PHONE_MAX = 599;
export const TABLET_MAX = 1024;

export const MEDIA_PHONE = `(max-width: ${PHONE_MAX}px)`;
export const MEDIA_COMPACT = `(max-width: ${TABLET_MAX}px)`;

/** 'phone' | 'tablet' | 'desktop' según el ancho de la ventana. */
export function layoutFor(width) {
  if (width <= PHONE_MAX) return 'phone';
  if (width <= TABLET_MAX) return 'tablet';
  return 'desktop';
}

/**
 * Cómo se presenta el menú lateral:
 * - escritorio: 'expanded' o 'collapsed' (riel de iconos), a elección del usuario;
 * - tablet: riel de iconos ('collapsed'); al abrirlo flota encima ('drawer');
 * - teléfono: oculto ('hidden'); al abrirlo flota encima ('drawer').
 */
export function sidebarMode(layout, { collapsed = false, drawerOpen = false } = {}) {
  if (layout === 'desktop') return collapsed ? 'collapsed' : 'expanded';
  if (drawerOpen) return 'drawer';
  return layout === 'tablet' ? 'collapsed' : 'hidden';
}
