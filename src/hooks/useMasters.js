// Hooks de los catálogos maestros. 100% datos reales del backend (sin fallback a mock).
import { useState, useEffect, useCallback } from 'react';
import { listClients, listSuppliers } from '../api/partners.js';
import { listUsers, listRoles } from '../api/security.js';
import { listBranches } from '../api/org.js';
import { listCostCenters } from '../api/wave2.js';

function pageRows(page) {
  return Array.isArray(page) ? page : (page?.content ?? []);
}

// Fábrica de hooks de lista: trae del backend; si falla → lista vacía + error (nunca mock).
function makeMasterHook(fetcher, map = (x) => x) {
  return function useList(opts = {}) {
    const [state, setState] = useState({ items: [], loading: true, error: null });
    const reload = useCallback(async () => {
      setState((s) => ({ ...s, loading: true }));
      try {
        setState({ items: pageRows(await fetcher(opts)).map(map), loading: false, error: null });
      } catch (err) {
        setState({ items: [], loading: false, error: err });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(opts)]);
    useEffect(() => { reload(); }, [reload]);
    return { ...state, reload };
  };
}

function fmtLastSeen(iso) {
  if (!iso) return 'Nunca';
  try {
    return new Date(iso).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return 'Nunca';
  }
}

const mapUser = (u) => ({
  id: u.id, name: u.name, email: u.email || '',
  role: u.roleName || '', roleId: u.roleId ?? null,
  branch: u.branchName || '', branchId: u.branchId ?? null,
  status: u.status || 'active', last: fmtLastSeen(u.lastSeenAt),
});

const mapRole = (r) => ({ id: r.id, name: r.name, desc: r.description || '', perms: r.permissions || [], users: 0 });

const mapCostCenter = (c) => ({
  id: c.id, code: c.code, name: c.name,
  group: c.costGroup || 'General', type: c.centerType || 'cost',
  responsible: c.responsibleName || '', budget: Number(c.budget || 0), active: c.active !== false,
});

export const useClients = makeMasterHook(listClients);
export const useSuppliers = makeMasterHook(listSuppliers);
export const useBranches = makeMasterHook(listBranches);
export const useUsers = makeMasterHook(listUsers, mapUser);
export const useRoles = makeMasterHook(listRoles, mapRole);
export const useCostCenters = makeMasterHook(listCostCenters, mapCostCenter);
