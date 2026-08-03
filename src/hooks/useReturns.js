// Hook de notas de crédito (devoluciones). 100% backend (sin mock).
import { useState, useEffect, useCallback } from 'react';
import { listCreditNotes } from '../api/wave2.js';

// Backend Response → shape del componente Returns.
export function mapNote(n) {
  return {
    backendId: n.id,
    id: n.docNumber,
    ticketId: n.ticketRef || '',
    clientName: n.clientName || '',
    clientNit: n.clientNit || '',
    date: n.returnDate || '',
    type: n.noteType || 'devolucion',
    reason: n.reason || '',
    amount: Number(n.total || 0),
    felStatus: n.felStatus || 'pendiente',
    felUuid: n.felUuid || null,
    felError: n.felError || null,
    cashier: n.cashier || '',
    branch: n.branchName || '',
    items: (n.items ?? []).map((i) => ({
      name: i.productName || '',
      qty: Number(i.quantity || 0),
      unitPrice: Number(i.unitPrice || 0),
    })),
  };
}

function rows(page) {
  return Array.isArray(page) ? page : (page?.content ?? []);
}

export function useCreditNotes() {
  const [state, setState] = useState({ items: [], loading: true, error: null });
  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      setState({ items: rows(await listCreditNotes({ size: 200 })).map(mapNote), loading: false, error: null });
    } catch (err) {
      setState({ items: [], loading: false, error: err });
    }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { ...state, reload };
}
