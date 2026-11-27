// Márgenes en porcentaje sin dividir entre cero. Un producto sin precio (p. ej.
// «por confirmar», precio 0) o un inventario sin valor no tiene margen: se
// muestra «—», nunca «NaN%» ni «Infinity%».

/** Margen sobre el precio de venta: (precio − costo) / precio. null si no hay precio. */
export function margenPct(precio, costo) {
  const p = Number(precio);
  const c = Number(costo) || 0;
  if (!Number.isFinite(p) || p <= 0) return null;
  return ((p - c) / p) * 100;
}

/** Qué porcentaje es `parte` de `base` (p. ej. ganancia sobre costo). null si la base no es positiva. */
export function sobre(parte, base) {
  const b = Number(base);
  const x = Number(parte);
  if (!Number.isFinite(b) || b <= 0 || !Number.isFinite(x)) return null;
  return (x / b) * 100;
}

/** Un porcentaje para mostrar: «12.5%», o «—» si no hay. */
export function pctTexto(n, digitos = 1) {
  return n == null || !Number.isFinite(n) ? '—' : `${n.toFixed(digitos)}%`;
}
