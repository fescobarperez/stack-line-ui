// Hook de promociones. 100% datos reales del backend (motor de reglas + métricas).
import { useState, useEffect, useCallback } from 'react';
import { listPromotions } from '../api/marketing.js';

// Backend Response → shape del componente Promotions.
export function mapPromo(p) {
  return {
    backendId: p.id,
    id: String(p.id),
    name: p.name || '',
    type: p.promoType || 'pct_desc',
    value: p.value != null ? Number(p.value) : null,
    status: p.status || 'active',
    category: p.category || null,
    product: p.product || null,
    clientType: p.clientType || 'Todos',
    branches: p.branches || 'Todas',
    dias: p.days ? p.days.split(',').filter(Boolean).map(Number) : [0, 1, 2, 3, 4, 5, 6],
    horaInicio: p.horaInicio || '',
    horaFin: p.horaFin || '',
    minCompra: Number(p.minCompra || 0),
    nxm_n: p.nxmN ?? null,
    nxm_m: p.nxmM ?? null,
    dateStart: p.dateStart || '',
    dateEnd: p.dateEnd || '',
    desc: p.description || '',
    uses: Number(p.uses || 0),
    savings: Number(p.savings || 0),
    tickets: Number(p.tickets || 0),
  };
}

export function usePromotions() {
  const [state, setState] = useState({ items: [], loading: true, error: null });

  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const rows = await listPromotions();
      const list = Array.isArray(rows) ? rows : (rows?.content ?? []);
      setState({ items: list.map(mapPromo), loading: false, error: null });
    } catch (err) {
      setState({ items: [], loading: false, error: err });
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);
  return { ...state, reload };
}
