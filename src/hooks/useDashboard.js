// Hook del Dashboard general. 100% datos reales del backend (sin fallback a mock):
// si no responde → estructura vacía + error.
import { useState, useEffect, useCallback } from 'react';
import { getDashboard } from '../api/dashboard.js';

const EMPTY = {
  kpis: { salesToday: 0, ticketsToday: 0, avgTicket: 0, lowStockCount: 0 },
  salesTrend: [], salesByCat: [], topProducts: [], branchSales: [], lowStock: [], recentTickets: [],
};

// Normaliza la respuesta del backend a la forma de los componentes.
function fromApi(d) {
  const cats = d.salesByCategory ?? [];
  const catTotal = cats.reduce((s, c) => s + Number(c.total || 0), 0) || 1;
  return {
    kpis: d.kpis ?? EMPTY.kpis,
    salesTrend: (d.salesTrend ?? []).map((p) => ({ d: p.date, total: Number(p.total || 0), tickets: Number(p.tickets || 0) })),
    salesByCat: cats.map((c) => ({ cat: c.category, total: Number(c.total || 0), pct: Math.round((Number(c.total || 0) / catTotal) * 100) })),
    topProducts: (d.topProducts ?? []).map((p) => ({ sku: p.sku, name: p.name, qty: Number(p.quantity || 0), total: Number(p.total || 0), trend: '' })),
    branchSales: (d.branchSales ?? []).map((b) => ({ id: b.branchId, name: b.name, addr: '', sales: Number(b.total || 0), status: 'active' })),
    lowStock: (d.lowStock ?? []).map((p) => ({ sku: p.sku, name: p.name, stock: Number(p.stock || 0), min: Number(p.minStock || 0) })),
    recentTickets: (d.recentTickets ?? []).map((t) => ({ id: t.docNumber, date: t.saleDate, branch: t.branch, pay: t.paymentMethod, total: Number(t.total || 0) })),
  };
}

export function useDashboard(days = 14) {
  const [state, setState] = useState({ data: EMPTY, loading: true, error: null });

  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      setState({ data: fromApi(await getDashboard(days)), loading: false, error: null });
    } catch (err) {
      setState({ data: EMPTY, loading: false, error: err });
    }
  }, [days]);

  useEffect(() => { reload(); }, [reload]);
  return { ...state, reload };
}
