// Hooks del módulo Catálogo. 100% datos reales del backend (sin fallback a mock):
// si el backend no responde → lista vacía + error.
import { useState, useEffect, useCallback } from 'react';
import { listProducts, listCategories, createProduct, updateProduct, deleteProduct } from '../api/catalog.js';
import { listStock } from '../api/inventory.js';

// Mapea un ProductResponse del backend a la forma que usan los componentes.
function mapProduct(p) {
  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    cat: p.categoryId,
    catName: p.categoryName,
    price: p.price,
    cost: p.cost,
    avgCost: p.avgCost,
    stock: p.stock ?? 0,
    min: p.minStock ?? 0,
    unit: p.unit,
    status: p.status,
  };
}

export function useProducts({ search = '' } = {}) {
  const [state, setState] = useState({ items: [], loading: true, error: null });

  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const page = await listProducts({ search });
      const rows = Array.isArray(page) ? page : (page.content ?? []);
      // Existencias reales: suma de product_stock por producto (todas las sucursales/lotes).
      const stockByProduct = {};
      try {
        const stock = await listStock();
        for (const s of stock) {
          stockByProduct[s.productId] = (stockByProduct[s.productId] ?? 0) + Number(s.quantity ?? 0);
        }
      } catch { /* sin stock → queda en 0 */ }
      const items = rows.map((p) => ({ ...mapProduct(p), stock: stockByProduct[p.id] ?? 0 }));
      setState({ items, loading: false, error: null });
    } catch (err) {
      setState({ items: [], loading: false, error: err });
    }
  }, [search]);

  useEffect(() => { reload(); }, [reload]);

  // Mutaciones reales contra el backend; recargan la lista al terminar.
  const create = useCallback(async (data) => {
    const r = await createProduct(data);
    await reload();
    return r;
  }, [reload]);
  const update = useCallback(async (id, data) => {
    const r = await updateProduct(id, data);
    await reload();
    return r;
  }, [reload]);
  const remove = useCallback(async (id) => {
    await deleteProduct(id);
    await reload();
  }, [reload]);

  return { ...state, reload, create, update, remove };
}

export function useCategories() {
  const [categories, setCategories] = useState([]);
  useEffect(() => {
    listCategories()
      .then((rows) => setCategories(Array.isArray(rows) ? rows : (rows?.content ?? [])))
      .catch(() => setCategories([]));
  }, []);
  return categories;
}
