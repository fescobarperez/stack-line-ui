// Hooks de contabilidad y FEL. 100% datos reales del backend (sin fallback a mock).
import { useState, useEffect, useCallback } from 'react';
import {
  listAccounts, listJournalEntries, listPeriods,
  getBalanceSheet, getIncomeStatement,
  getLedgerTrialBalance, getAccountLedger,
} from '../api/accounting.js';
import { listFelDocuments } from '../api/fel.js';

function rows(page) {
  return Array.isArray(page) ? page : (page?.content ?? []);
}

function makeHook(fetcher) {
  return function useList() {
    const [state, setState] = useState({ items: [], loading: true, error: null });
    const reload = useCallback(async () => {
      setState((s) => ({ ...s, loading: true }));
      try {
        setState({ items: rows(await fetcher()), loading: false, error: null });
      } catch (err) {
        setState({ items: [], loading: false, error: err });
      }
    }, []);
    useEffect(() => { reload(); }, [reload]);
    return { ...state, reload };
  };
}

export const useAccounts = makeHook(listAccounts);
export const useJournalEntries = makeHook(listJournalEntries);
export const useFelDocuments = makeHook(listFelDocuments);

// Períodos contables (para selectores).
export function usePeriods() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    listPeriods()
      .then((r) => setItems(rows(r)))
      .catch(() => setItems([]));
  }, []);
  return items;
}

// Estados financieros del período (balance general + estado de resultados) del backend.
export function useFinancialStatements(periodId) {
  const [state, setState] = useState({ balanceSheet: null, incomeStatement: null, loading: true, error: null });

  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const [balanceSheet, incomeStatement] = await Promise.all([
        getBalanceSheet(periodId), getIncomeStatement(periodId),
      ]);
      setState({ balanceSheet, incomeStatement, loading: false, error: null });
    } catch (err) {
      setState({ balanceSheet: null, incomeStatement: null, loading: false, error: err });
    }
  }, [periodId]);

  useEffect(() => { reload(); }, [reload]);
  return { ...state, reload };
}

// Balance de comprobación (con apertura) del backend.
export function useLedgerTrialBalance(periodId) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      setState({ data: await getLedgerTrialBalance(periodId), loading: false, error: null });
    } catch (err) {
      setState({ data: null, loading: false, error: err });
    }
  }, [periodId]);
  useEffect(() => { reload(); }, [reload]);
  return { ...state, reload };
}

// Mayor (movimientos con saldo corrido) de una cuenta, del backend.
export function useAccountLedger(accountId, periodId) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const reload = useCallback(async () => {
    if (accountId == null) { setState({ data: null, loading: false, error: null }); return; }
    setState((s) => ({ ...s, loading: true }));
    try {
      setState({ data: await getAccountLedger(accountId, periodId), loading: false, error: null });
    } catch (err) {
      setState({ data: null, loading: false, error: err });
    }
  }, [accountId, periodId]);
  useEffect(() => { reload(); }, [reload]);
  return { ...state, reload };
}
