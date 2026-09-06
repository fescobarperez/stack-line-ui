// Hooks de cotizaciones a cliente y RFQ a proveedor. 100% backend (sin mock).
import { useState, useEffect, useCallback } from 'react';
import { listQuotes } from '../api/wave2.js';

function mapItems(items) {
  return (items ?? []).map((i, idx) => ({
    id: i.id ?? idx + 1,
    productId: i.productId ?? null,
    name: i.productName || '',
    qty: Number(i.quantity || 0),
    uom: i.uom || '',
    unitPrice: Number(i.unitPrice || 0),
    discount: Number(i.discount || 0),
  }));
}

function mapHistory(history) {
  return (history ?? []).map((h) => ({
    ts: h.timestamp ? String(h.timestamp).replace('T', ' ').slice(0, 16) : '',
    user: h.actor || 'Sistema',
    action: h.action,
  }));
}

// Cotización a cliente → shape del componente.
export function mapQuote(q) {
  return {
    backendId: q.id,
    projectId: q.projectId ?? null,
    id: q.docNumber,
    date: q.quoteDate,
    validUntil: q.validUntil,
    client: { name: q.clientName || '', nit: q.clientNit || '', email: q.clientEmail || '', contact: q.clientContact || '' },
    createdBy: q.createdBy || '',
    status: q.status,
    notes: q.notes || '',
    items: mapItems(q.items),
    history: mapHistory(q.history),
  };
}

// RFQ a proveedor → shape del componente.
export function mapRfq(q) {
  return {
    backendId: q.id,
    projectId: q.projectId ?? null,
    id: q.docNumber,
    date: q.quoteDate,
    deadline: q.deadline,
    supplier: { name: q.supplierName || '', nit: q.supplierNit || '', email: q.supplierEmail || '', contact: q.supplierContact || '' },
    createdBy: q.createdBy || '',
    status: q.status,
    leadTime: q.leadTime || 'Por confirmar',
    paymentTerms: q.paymentTerms || 'Por confirmar',
    notes: q.notes || '',
    items: mapItems(q.items),
    history: mapHistory(q.history),
  };
}

function rows(page) {
  return Array.isArray(page) ? page : (page?.content ?? []);
}

function makeQuoteHook(partyType, mapper) {
  return function useQuoteList() {
    const [state, setState] = useState({ items: [], loading: true, error: null });
    const reload = useCallback(async () => {
      setState((s) => ({ ...s, loading: true }));
      try {
        setState({ items: rows(await listQuotes({ partyType, size: 200 })).map(mapper), loading: false, error: null });
      } catch (err) {
        setState({ items: [], loading: false, error: err });
      }
    }, []);
    useEffect(() => { reload(); }, [reload]);
    return { ...state, reload };
  };
}

export const useClientQuotes = makeQuoteHook('client', mapQuote);
export const useSupplierRfqs = makeQuoteHook('supplier', mapRfq);
