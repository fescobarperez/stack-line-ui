// Hook de toma física (conteo). 100% backend (sin mock).
import { useState, useEffect, useCallback } from 'react';
import { listStockCounts } from '../api/wave2.js';

// Backend Response → shape del componente StockCount.
export function mapSession(s) {
  return {
    backendId: s.id,
    id: s.docNumber,
    date: s.countDate || '',
    branch: s.branchName || '',
    branchId: s.branchId,
    category: s.category || 'all',
    categoryLabel: s.categoryLabel || 'Todas las categorías',
    responsible: s.responsible || '',
    status: s.status || 'in_progress',
    notes: s.notes || '',
    discrepancies: s.discrepancies ?? 0,
    adjustedQty: s.adjustedQty ?? 0,
    lines: (s.items ?? []).map((i) => ({
      itemId: i.id,
      sku: i.sku || String(i.productId || ''),
      name: i.productName || '',
      cat: i.category || '',
      unit: i.unit || 'unid',
      cost: Number(i.unitCost || 0),
      systemQty: Number(i.systemQty || 0),
      countedQty: i.countedQty == null ? null : Number(i.countedQty),
      notes: i.lineNotes || '',
    })),
  };
}

function rows(page) {
  return Array.isArray(page) ? page : (page?.content ?? []);
}

export function useStockCounts() {
  const [state, setState] = useState({ items: [], loading: true, error: null });
  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      setState({ items: rows(await listStockCounts({ size: 200 })).map(mapSession), loading: false, error: null });
    } catch (err) {
      setState({ items: [], loading: false, error: err });
    }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { ...state, reload };
}
