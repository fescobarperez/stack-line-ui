// Hook de variantes de producto. Un "grupo" = un producto del catálogo con sus
// variantes. Deriva los grupos de /api/product-variants + /api/products. Backend real.
import { useState, useEffect, useCallback } from 'react';
import { listVariants } from '../api/wave2.js';
import { listProducts } from '../api/catalog.js';

function mapVariant(v) {
  return {
    id: v.id,
    sku: v.sku || '',
    label: v.attributeValue || '',
    price: Number(v.price || 0),
    cost: Number(v.cost || 0),
    stock: Number(v.stock || 0),
    min: Number(v.minStock || 0),
    active: v.active !== false,
  };
}

function rows(page) {
  return Array.isArray(page) ? page : (page?.content ?? []);
}

export function useVariants() {
  const [state, setState] = useState({ groups: [], categories: [], loading: true, error: null });
  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const [variants, productsPage] = await Promise.all([listVariants(), listProducts({ size: 500 })]);
      const products = rows(productsPage);
      const prodById = Object.fromEntries(products.map((p) => [p.id, p]));

      const map = new Map();
      for (const v of rows(variants)) {
        const pid = v.productId;
        if (!map.has(pid)) {
          const p = prodById[pid];
          map.set(pid, {
            id: 'p' + pid,
            productId: pid,
            name: v.productName || p?.name || ('Producto ' + pid),
            brand: p?.categoryName || '',
            cat: (p?.categoryName || '').toLowerCase(),
            catLabel: p?.categoryName || '—',
            attrType: v.attributeType || 'tamaño',
            variants: [],
          });
        }
        map.get(pid).variants.push(mapVariant(v));
      }
      const groups = [...map.values()];
      const categories = [...new Set(groups.map((g) => g.cat).filter(Boolean))];
      setState({ groups, categories, loading: false, error: null });
    } catch (err) {
      setState({ groups: [], categories: [], loading: false, error: err });
    }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { ...state, reload };
}
