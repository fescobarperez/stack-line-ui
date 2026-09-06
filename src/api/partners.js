// Endpoints de socios de negocio: clientes y proveedores.
import { api } from './client.js';

function pagedQuery({ search = '', page = 0, size = 50 } = {}) {
  const q = new URLSearchParams({ page: String(page), size: String(size) });
  if (search) q.set('search', search);
  return q.toString();
}

// Clientes
export const listClients = (opts) => api.get(`/api/clients?${pagedQuery(opts)}`);
export const getClient = (id) => api.get(`/api/clients/${id}`);
export const createClient = (data) => api.post('/api/clients', data);
export const updateClient = (id, data) => api.put(`/api/clients/${id}`, data);
export const deleteClient = (id) => api.del(`/api/clients/${id}`);

// Proveedores
export const listSuppliers = (opts) => api.get(`/api/suppliers?${pagedQuery(opts)}`);
export const getSupplier = (id) => api.get(`/api/suppliers/${id}`);
export const createSupplier = (data) => api.post('/api/suppliers', data);
export const updateSupplier = (id, data) => api.put(`/api/suppliers/${id}`, data);
export const deleteSupplier = (id) => api.del(`/api/suppliers/${id}`);

/** Busca un cliente por NIT para autocompletar. Lanza 404 si no existe. */
export const getClientByNit = (nit) => api.get(`/api/clients/by-nit/${encodeURIComponent(nit)}`);
