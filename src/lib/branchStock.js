// Existencias de un producto por sucursal a partir de GET /api/stock?productId=
// (una fila por sucursal y lote). Todas las sucursales activas aparecen, aunque
// no tengan existencias; las que solo vienen en el stock (inactivas) también.

/** filas: StockRow[]; sucursales: [{ id, name }] → [{ branchId, branchName, quantity, lots: [{ batch, expiry }] }]. */
export function stockPorSucursal(filas = [], sucursales = []) {
  const porId = new Map();
  for (const b of sucursales) {
    porId.set(b.id, { branchId: b.id, branchName: b.name, quantity: 0, lots: [] });
  }
  for (const f of filas) {
    const clave = f.branchId ?? f.branchName;
    if (!porId.has(clave)) porId.set(clave, { branchId: f.branchId, branchName: f.branchName || '—', quantity: 0, lots: [] });
    const fila = porId.get(clave);
    const cantidad = Number(f.quantity ?? 0);
    fila.quantity += cantidad;
    if (f.batch && cantidad > 0) fila.lots.push({ batch: f.batch, expiry: f.expiry || null });
  }
  return [...porId.values()];
}
