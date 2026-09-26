// Sitios web y cargas de catálogo de proveedores.
import { api } from './client.js';

export const listSupplierWebsites = (supplierId) =>
  api.get(`/api/supplier-websites${supplierId != null ? `?supplierId=${encodeURIComponent(supplierId)}` : ''}`);
export const getSupplierWebsite = (id) => api.get(`/api/supplier-websites/${id}`);
export const createSupplierWebsite = (data) => api.post('/api/supplier-websites', data);
export const updateSupplierWebsite = (id, data) => api.put(`/api/supplier-websites/${id}`, data);

export const getIngestionSop = (siteKey) => api.get(`/api/ingestion/sops/${encodeURIComponent(siteKey)}`);
export const listCatalogImportBatches = () => api.get('/api/catalog-imports');
export const getCatalogImportBatch = (id) => api.get(`/api/catalog-imports/${id}`);
export const previewCatalogImport = (data) => api.post('/api/catalog-imports/preview', data);
export const approveCatalogImport = (id, itemIds = []) =>
  api.post(`/api/catalog-imports/${id}/approve`, { itemIds });
export const rejectCatalogImport = (id, itemIds = []) =>
  api.post(`/api/catalog-imports/${id}/reject`, { itemIds });
export const applyCatalogImport = (id) => api.post(`/api/catalog-imports/${id}/apply`, {});
export const updateCatalogImportDecision = (batchId, itemId, data) =>
  api.put(`/api/catalog-imports/${batchId}/items/${itemId}/decision`, data);
export const excludeCatalogImportItem = (batchId, itemId) =>
  api.del(`/api/catalog-imports/${batchId}/items/${itemId}`);
