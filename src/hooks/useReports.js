// Hook de reportería de ventas. 100% datos reales del backend (sin fallback a mock).
import { useState, useEffect, useCallback } from 'react';
import { getSalesReport } from '../api/reports.js';

const pctOf = (v, total) => (total ? Math.round((v / total) * 100) : 0);

const EMPTY = {
  totalSales: 0, totalTickets: 0, avgTicket: 0,
  trend: [], byBranch: [], byPayment: [], topProducts: [], byCategory: [], salesBook: [],
};

function fromApi(d) {
  const branchTotal = (d.byBranch ?? []).reduce((s, b) => s + Number(b.total || 0), 0) || 1;
  const payTotal = (d.byPayment ?? []).reduce((s, p) => s + Number(p.total || 0), 0) || 1;
  return {
    totalSales: Number(d.totalSales || 0),
    totalTickets: Number(d.totalTickets || 0),
    avgTicket: Number(d.avgTicket || 0),
    trend: (d.trend ?? []).map((p) => ({ d: p.date, total: Number(p.total || 0), tickets: Number(p.tickets || 0) })),
    byBranch: (d.byBranch ?? []).map((b) => ({ id: b.branchId, name: b.name, tickets: Number(b.tickets || 0), total: Number(b.total || 0), pct: pctOf(Number(b.total || 0), branchTotal) })),
    byPayment: (d.byPayment ?? []).map((p) => ({ method: p.method || '—', total: Number(p.total || 0), pct: pctOf(Number(p.total || 0), payTotal) })),
    topProducts: (d.topProducts ?? []).map((p) => ({ sku: p.sku, name: p.name, qty: Number(p.quantity || 0), total: Number(p.total || 0), trend: '' })),
    byCategory: (d.byCategory ?? []).map((c) => ({ cat: c.category, sales: Number(c.sales || 0), cost: Number(c.cost || 0), profit: Number(c.profit || 0), marginPct: Number(c.marginPct || 0) })),
    salesBook: (d.salesBook ?? []).map((r) => ({ d: r.date, tickets: Number(r.tickets || 0), taxable: Number(r.taxable || 0), iva: Number(r.iva || 0), total: Number(r.total || 0) })),
  };
}

export function useReports(days = 30) {
  const [state, setState] = useState({ data: EMPTY, loading: true, error: null });

  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      setState({ data: fromApi(await getSalesReport(days)), loading: false, error: null });
    } catch (err) {
      setState({ data: EMPTY, loading: false, error: err });
    }
  }, [days]);

  useEffect(() => { reload(); }, [reload]);
  return { ...state, reload };
}
