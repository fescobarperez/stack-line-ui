// Stackline — Posición del lanzador de Tino (lógica pura, sin React).
//
// El lanzador se arrastra libremente y, al soltarlo, se pega al borde más
// cercano de la ventana. La posición se guarda como un ANCLA —qué borde y en
// qué fracción de ese borde— y no como píxeles: así sobrevive a un cambio de
// tamaño de la ventana sin quedar fuera de ella.

export const MARGEN = 20;       // separación del borde, como en el handoff
export const LADO = 60;         // diámetro del lanzador
export const SEPARACION = 16;   // entre el lanzador y el widget
export const UMBRAL_ARRASTRE = 5; // px antes de considerar que es arrastre y no clic
export const ALTO_WIDGET = 660;
export const ALTO_MINIMO = 320;

/** Abajo a la derecha, donde vive por defecto. */
export const ANCLA_INICIAL = { borde: 'right', t: 1 };

const acotar = (v, min, max) => Math.min(Math.max(v, min), max);

/** Esquina superior izquierda del lanzador para un ancla y una ventana. */
export function coordsDesdeAncla({ borde, t }, { ancho, alto }) {
  const rangoX = Math.max(ancho - 2 * MARGEN - LADO, 0);
  const rangoY = Math.max(alto - 2 * MARGEN - LADO, 0);
  const f = acotar(Number.isFinite(t) ? t : 1, 0, 1);
  switch (borde) {
    case 'left':   return { x: MARGEN, y: MARGEN + f * rangoY };
    case 'top':    return { x: MARGEN + f * rangoX, y: MARGEN };
    case 'bottom': return { x: MARGEN + f * rangoX, y: alto - MARGEN - LADO };
    default:       return { x: ancho - MARGEN - LADO, y: MARGEN + f * rangoY };
  }
}

/** Mantiene el lanzador dentro de la ventana mientras se arrastra. */
export function acotarAVentana({ x, y }, { ancho, alto }) {
  return {
    x: acotar(x, 0, Math.max(ancho - LADO, 0)),
    y: acotar(y, 0, Math.max(alto - LADO, 0)),
  };
}

/** Al soltar: el borde más cercano, y dónde cae a lo largo de ese borde. */
export function anclaMasCercana({ x, y }, { ancho, alto }) {
  const distancias = {
    left: x,
    right: ancho - (x + LADO),
    top: y,
    bottom: alto - (y + LADO),
  };
  const borde = Object.entries(distancias).sort((a, b) => a[1] - b[1])[0][0];
  const rangoX = Math.max(ancho - 2 * MARGEN - LADO, 1);
  const rangoY = Math.max(alto - 2 * MARGEN - LADO, 1);
  const t = borde === 'left' || borde === 'right'
    ? acotar((y - MARGEN) / rangoY, 0, 1)
    : acotar((x - MARGEN) / rangoX, 0, 1);
  return { borde, t };
}

/**
 * Dónde se abre el widget respecto del lanzador: alineado al lado del
 * lanzador y hacia donde haya más espacio vertical.
 * Devuelve estilos de posición (fixed) y el alto disponible.
 */
export function colocacionWidget({ x, y }, { ancho, alto }) {
  const estilo = { left: 'auto', right: 'auto', top: 'auto', bottom: 'auto' };

  if (x + LADO / 2 > ancho / 2) estilo.right = Math.max(ancho - (x + LADO), MARGEN);
  else estilo.left = Math.max(x, MARGEN);

  const arriba = y - SEPARACION - MARGEN;
  const abajo = alto - (y + LADO + SEPARACION) - MARGEN;
  let disponible;
  if (arriba >= abajo) {
    estilo.bottom = alto - y + SEPARACION;
    disponible = arriba;
  } else {
    estilo.top = y + LADO + SEPARACION;
    disponible = abajo;
  }
  estilo.height = Math.max(Math.min(ALTO_WIDGET, disponible), ALTO_MINIMO);
  return estilo;
}
