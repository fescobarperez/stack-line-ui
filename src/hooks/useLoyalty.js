// Hook de fidelización: cuentas (miembros) + movimientos de puntos. 100% backend.
import { useState, useEffect, useCallback } from 'react';
import { listLoyaltyAccounts, loyaltyMovements } from '../api/wave3.js';

function mapMember(a) {
  return {
    backendId: a.id,
    id: a.memberCode || String(a.id),
    nombre: a.name || '',
    nit: a.nit || '',
    tel: a.phone || '',
    email: a.email || '',
    points: Number(a.pointsBalance || 0),
    totalSpent: Number(a.totalSpent || 0),
    joinDate: a.joinDate || '',
    lastPurchase: a.lastPurchaseDate || '',
    earned: Number(a.pointsEarned || 0),
    redeemed: Number(a.pointsRedeemed || 0),
  };
}

function mapTxn(m, member) {
  return {
    id: 'TX-' + m.id,
    memberId: member.id,
    nombre: member.nombre,
    type: m.movementType || 'ajuste',
    points: Number(m.points || 0),
    ref: m.reference || '',
    date: m.movementDate || '',
    monto: Number(m.amount || 0),
  };
}

function rows(page) {
  return Array.isArray(page) ? page : (page?.content ?? []);
}

export function useLoyalty() {
  const [state, setState] = useState({ members: [], txns: [], loading: true, error: null });
  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const members = rows(await listLoyaltyAccounts()).map(mapMember);
      const lists = await Promise.all(members.map((m) =>
        loyaltyMovements(m.backendId)
          .then((r) => rows(r).map((mv) => mapTxn(mv, m)))
          .catch(() => [])
      ));
      const txns = lists.flat().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      setState({ members, txns, loading: false, error: null });
    } catch (err) {
      setState({ members: [], txns: [], loading: false, error: err });
    }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { ...state, reload };
}
