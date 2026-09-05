// Hooks de compras, traslados, CxC, caja, etc. 100% datos reales del backend
// (sin fallback a mock): si el backend no responde → estado de error y lista vacía.
import { useState, useEffect, useCallback } from 'react';
import { listPurchaseOrders } from '../api/purchasing.js';
import { listTransfers } from '../api/transfers.js';
import { listPayments, getAging } from '../api/receivables.js';
import { listPurchaseInvoices, listSupplierPayments, listUnits } from '../api/wave2.js';
import { listBankAccounts, listAssets } from '../api/wave3.js';
import { listCashRegisters, listSales, listCashPoints, listPendingRegisters } from '../api/pos.js';
import { listPendingAuthorizations, listAuthLevels } from '../api/authorizations.js';
import { listMovements } from '../api/inventory.js';

const EMPTY_AGING = {
  totalReceivable: 0, overdue: 0, openCount: 0, criticalCount: 0,
  summary: [], invoices: [], byClient: [],
};

function rows(page) {
  return Array.isArray(page) ? page : (page?.content ?? []);
}

function makeListHook(fetcher) {
  // Instancias montadas del hook. Sin esto cada componente tiene su copia y no
  // se entera de los cambios de los demás: el contador del navbar no bajaba al
  // resolver desde la bandeja porque eran dos instancias distintas.
  const listeners = new Set();

  const useList = function (opts = {}) {
    const [state, setState] = useState({ items: [], loading: true, error: null });
    const reload = useCallback(async () => {
      setState((s) => ({ ...s, loading: true }));
      try {
        setState({ items: rows(await fetcher(opts)), loading: false, error: null });
      } catch (err) {
        setState({ items: [], loading: false, error: err });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(opts)]);
    useEffect(() => {
      reload();
      listeners.add(reload);
      return () => listeners.delete(reload);
    }, [reload]);
    return { ...state, reload };
  };

  /** Refresca TODAS las instancias montadas: `useX.refresh()`. */
  useList.refresh = () => listeners.forEach((fn) => fn());
  return useList;
}

export const usePurchaseOrders = makeListHook(listPurchaseOrders);
export const useTransfers = makeListHook(listTransfers);
export const usePayments = makeListHook(listPayments);
export const usePurchaseInvoices = makeListHook(listPurchaseInvoices);
export const useSupplierPayments = makeListHook(listSupplierPayments);
export const useBankAccounts = makeListHook(listBankAccounts);
export const useCashRegisters = makeListHook(() => listCashRegisters());
// Cajas físicas: cada fila trae `openSessionId` si ya está ocupada.
export const useCashPoints = makeListHook(() => listCashPoints());
// Bandeja de autorizaciones pendientes.
export const usePendingAuthorizations = makeListHook(listPendingAuthorizations);
// Niveles de autoridad configurados por la empresa.
export const useAuthLevels = makeListHook(listAuthLevels);
// Turnos abiertos de días anteriores: bloquean abrir hasta cuadrarlos.
export const usePendingRegisters = makeListHook(listPendingRegisters);
export const useSales = makeListHook(listSales);
export const useStockMovements = makeListHook(listMovements);
export const useUomUnits = makeListHook(listUnits);
export const useAssets = makeListHook(listAssets);

// Antigüedad de saldos (CxC aging). Objeto (no lista); vacío real si no hay datos/errores.
export function useAging() {
  const [state, setState] = useState({ data: EMPTY_AGING, loading: true, error: null });
  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      setState({ data: await getAging(), loading: false, error: null });
    } catch (err) {
      setState({ data: EMPTY_AGING, loading: false, error: err });
    }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { ...state, reload };
}
