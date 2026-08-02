// Hook de promociones. 100% datos reales del backend (sin fallback a mock).
import { useState, useEffect, useCallback } from 'react';
import { listPromotions } from '../api/marketing.js';

// El backend expone `promoType`; los componentes usan `type`.
function mapPromo(p) {
  return { id: p.id, name: p.name, type: p.promoType, target: p.target, valid: p.valid, status: p.status };
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
