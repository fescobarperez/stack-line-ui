// Hooks del módulo Catálogo. 100% datos reales del backend (sin fallback a mock):
// si el backend no responde → lista vacía + error.
import { useState, useEffect, useCallback, useRef } from 'react';
import { listProducts, listCategories, createProduct, updateProduct, deleteProduct } from '../api/catalog.js';
import { listStock } from '../api/inventory.js';

// Mapea un ProductResponse del backend a la forma que usan los componentes.
/**
 * Medidas para el PUT/POST de producto. Siempre se mandan: el backend toma
 * vacío como «sin medida», así que un formulario que no las enviara las
 * borraría al guardar.
 */
export function dimensionsPayload(src) {
  const num = (v) => (v === '' || v == null || !(Number(v) > 0) ? null : Number(v));
  // Bajo pedido = no controla existencias. Se manda siempre: sin el campo el
  // backend lo reactivaba al guardar (vendible ⇒ controla stock).
  const tracksStock = src?.madeToOrder !== undefined ? !src.madeToOrder : (src?.tracksStock ?? null);
  return {
    height: num(src?.height),
    width: num(src?.width),
    depth: num(src?.depth),
    dimensionUnit: src?.dimensionUnit || null,
    tracksStock,
  };
}

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
    purchaseUnit: p.purchaseUnit,
    purchaseFactor: p.purchaseFactor,
    // Medida estándar (opcional): base para cotizar muebles a medida.
    height: p.height ?? null,
    width: p.width ?? null,
    depth: p.depth ?? null,
    dimensionUnit: p.dimensionUnit ?? null,
    itemType: p.itemType ?? 'sellable',
    tracksStock: p.tracksStock ?? true,
    status: p.status,
    // Versión de la foto (null = sin foto). Ver components/ProductThumb.jsx.
    imageVersion: p.imageVersion ?? null,
    suppliers: (p.suppliers ?? []).map((supplier) => ({
      supplierId: supplier.supplierId,
      supplierName: supplier.supplierName,
      unitCost: supplier.unitCost,
      preferred: supplier.preferred,
    })),
  };
}

// El backend limita `size` a 100 (micronaut.data.pageable.max-page-size), así que se
// pide por páginas de ese tamaño. `loadMore` agrega la siguiente; `reload` vuelve a
// pedir todas las páginas ya cargadas para no perder el scroll tras una mutación.
export const PRODUCTS_PAGE_SIZE = 100;

export function useProducts({ search = '', itemType = '', size = 50 } = {}) {
  const pageSize = Math.min(size, PRODUCTS_PAGE_SIZE);
  const [state, setState] = useState({ items: [], loading: true, loadingMore: false, error: null, total: 0, hasMore: false });
  const pagesLoaded = useRef(1);
  const stockRef = useRef({});
  const requestId = useRef(0);
  const nextPage = useRef(1);

  const toItems = (rows) => rows.map((p) => ({ ...mapProduct(p), stock: stockRef.current[p.id] ?? 0 }));

  const reload = useCallback(async () => {
    const id = ++requestId.current;
    setState((s) => ({ ...s, loading: true }));
    try {
      // Existencias reales: suma de product_stock por producto (todas las sucursales/lotes).
      const stockByProduct = {};
      try {
        const stock = await listStock();
        for (const s of stock) {
          stockByProduct[s.productId] = (stockByProduct[s.productId] ?? 0) + Number(s.quantity ?? 0);
        }
      } catch { /* sin stock → queda en 0 */ }
      stockRef.current = stockByProduct;
      const rows = [];
      let total = 0;
      let page = 0;
      for (; page < pagesLoaded.current; page += 1) {
        const result = await listProducts({ search, itemType, size: pageSize, page });
        const content = Array.isArray(result) ? result : (result.content ?? []);
        rows.push(...content);
        total = Array.isArray(result) ? rows.length : (result.totalSize ?? rows.length);
        if (content.length < pageSize || rows.length >= total) { page += 1; break; }
      }
      if (id !== requestId.current) return;
      nextPage.current = page;
      setState({ items: toItems(rows), loading: false, loadingMore: false, error: null, total, hasMore: rows.length < total });
    } catch (err) {
      if (id !== requestId.current) return;
      setState({ items: [], loading: false, loadingMore: false, error: err, total: 0, hasMore: false });
    }
  }, [search, itemType, pageSize]);

  const loadMore = useCallback(async () => {
    if (state.loading || state.loadingMore || !state.hasMore) return;
    const id = requestId.current;
    setState((s) => ({ ...s, loadingMore: true }));
    try {
      const result = await listProducts({ search, itemType, size: pageSize, page: nextPage.current });
      if (id !== requestId.current) return;
      const content = Array.isArray(result) ? result : (result.content ?? []);
      nextPage.current += 1;
      pagesLoaded.current = nextPage.current;
      setState((s) => {
        const items = [...s.items, ...toItems(content)];
        const total = Array.isArray(result) ? items.length : (result.totalSize ?? items.length);
        return { ...s, items, total, loadingMore: false, hasMore: content.length > 0 && items.length < total };
      });
    } catch (err) {
      if (id !== requestId.current) return;
      setState((s) => ({ ...s, loadingMore: false, error: err }));
    }
  }, [state.loading, state.loadingMore, state.hasMore, search, itemType, pageSize]);

  // Una búsqueda o tipo nuevo empieza otra vez desde la primera página.
  useEffect(() => { pagesLoaded.current = 1; }, [search, itemType, pageSize]);
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

  return { ...state, reload, loadMore, create, update, remove };
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

// Catálogo jerárquico: expone reload para que crear/mover categorías refresque el árbol.
export function useCategoryTree() {
  const [state, setState] = useState({ items: [], loading: true, error: null });
  const reload = useCallback(async () => {
    setState((current) => ({ ...current, loading: true }));
    try {
      const rows = await listCategories();
      setState({ items: Array.isArray(rows) ? rows : (rows?.content ?? []), loading: false, error: null });
    } catch (error) {
      setState({ items: [], loading: false, error });
    }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { ...state, reload };
}
