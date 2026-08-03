// Hooks de planilla: empleados + períodos de nómina. 100% backend.
import { useState, useEffect, useCallback } from 'react';
import { listEmployees, listPayrollPeriods } from '../api/wave3.js';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function mapEmployee(e) {
  return {
    backendId: e.id,
    id: e.employeeCode || String(e.id),
    name: e.name || '',
    dept: e.department || '',
    pos: e.position || '',
    salary: Number(e.salary || 0),
    status: e.status || 'active',
    hired: e.hiredDate || '',
    dpi: e.dpi || '',
    nit: e.nit || '',
    banco: e.bankName || '',
    cuenta: e.bankAccount || '',
  };
}

function mapPeriod(p) {
  const m = (p.month || 1) - 1;
  return {
    backendId: p.id,
    id: p.periodCode || String(p.id),
    month: m,
    year: p.year,
    period: p.name || `${MESES[m] || ''} ${p.year || ''}`.trim(),
    status: p.status || 'draft',
    total: Number(p.total || 0),
    employees: p.employeeCount ?? 0,
  };
}

function rows(page) {
  return Array.isArray(page) ? page : (page?.content ?? []);
}

function makeHook(fetcher, mapper) {
  return function useList() {
    const [state, setState] = useState({ items: [], loading: true, error: null });
    const reload = useCallback(async () => {
      setState((s) => ({ ...s, loading: true }));
      try {
        setState({ items: rows(await fetcher()).map(mapper), loading: false, error: null });
      } catch (err) {
        setState({ items: [], loading: false, error: err });
      }
    }, []);
    useEffect(() => { reload(); }, [reload]);
    return { ...state, reload };
  };
}

export const useEmployees = makeHook(listEmployees, mapEmployee);
export const usePayrollPeriods = makeHook(listPayrollPeriods, mapPeriod);
