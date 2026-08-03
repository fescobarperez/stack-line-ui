// Hook de presupuestos. Transforma las líneas por mes del backend al modelo del
// UI (departamentos → líneas con arrays de 12 meses ppto/real). 100% backend.
import { useState, useEffect, useCallback } from 'react';
import { listBudgets } from '../api/wave3.js';

const slug = (s) => (s || 'dpto').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-');

// Un budget del backend → lista de departamentos con líneas (arrays de 12 meses).
export function toDepts(budget) {
  const deptMap = new Map();
  for (const l of budget?.lines ?? []) {
    const deptName = l.department || (l.isIncome ? 'Ingresos' : 'Gastos');
    if (!deptMap.has(deptName)) {
      deptMap.set(deptName, { id: slug(deptName), nombre: deptName, esIngreso: !!l.isIncome, lineMap: new Map() });
    }
    const dept = deptMap.get(deptName);
    const key = (l.accountCode || '') + '|' + (l.name || '');
    if (!dept.lineMap.has(key)) {
      dept.lineMap.set(key, { cuenta: l.accountCode || '', nombre: l.name || '', ppto: Array(12).fill(0), real: Array(12).fill(0) });
    }
    const line = dept.lineMap.get(key);
    const m = (l.periodMonth || 1) - 1;
    if (m >= 0 && m < 12) {
      line.ppto[m] += Number(l.budgetedAmount || 0);
      line.real[m] += Number(l.actualAmount || 0);
    }
  }
  return [...deptMap.values()]
    .map((d) => ({ id: d.id, nombre: d.nombre, esIngreso: d.esIngreso, lineas: [...d.lineMap.values()] }))
    .sort((a, b) => (b.esIngreso === a.esIngreso ? 0 : b.esIngreso ? 1 : -1));
}

export function useBudget() {
  const [state, setState] = useState({ depts: [], periods: [], budgetId: null, year: null, loading: true, error: null });
  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const budgets = await listBudgets();
      const list = Array.isArray(budgets) ? budgets : (budgets?.content ?? []);
      const currentYear = new Date().getFullYear();
      const current = list.find((b) => b.year === currentYear) || list[0] || null;
      const periods = list.map((b) => ({
        año: b.year,
        estado: b.status === 'closed' ? 'cerrado' : 'vigente',
        pptoTotal: Number(b.totalBudget || 0),
        ejec: Number(b.executionPct || 0),
      }));
      setState({
        depts: current ? toDepts(current) : [],
        periods,
        budgetId: current?.id ?? null,
        year: current?.year ?? currentYear,
        loading: false,
        error: null,
      });
    } catch (err) {
      setState({ depts: [], periods: [], budgetId: null, year: null, loading: false, error: err });
    }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { ...state, reload };
}
