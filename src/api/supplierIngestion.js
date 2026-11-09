// Sitios web y cargas de catálogo de proveedores.
import { api } from './client.js';

export const listSupplierWebsites = (supplierId) =>
  api.get(`/api/supplier-websites${supplierId != null ? `?supplierId=${encodeURIComponent(supplierId)}` : ''}`);
export const getSupplierWebsite = (id) => api.get(`/api/supplier-websites/${id}`);
export const createSupplierWebsite = (data) => api.post('/api/supplier-websites', data);
export const updateSupplierWebsite = (id, data) => api.put(`/api/supplier-websites/${id}`, data);

export const getIngestionSop = (siteKey) => api.get(`/api/ingestion/sops/${encodeURIComponent(siteKey)}`);
export const getCrawlRun = (runId, opts) => api.get(`/api/supplier-websites/runs/${runId}`, opts);
export const listCatalogImportBatches = (opts) => api.get('/api/catalog-imports', opts);
export const listPendingCatalogImportBatches = (supplierWebsiteId, opts) =>
  api.get(`/api/catalog-imports/pending?supplierWebsiteId=${encodeURIComponent(supplierWebsiteId)}`, opts);
export const getCatalogImportBatch = (id, opts) => api.get(`/api/catalog-imports/${id}`, opts);
export const deleteCatalogImport = (id) => api.del(`/api/catalog-imports/${id}`);
export const previewCatalogImport = (data) => api.post('/api/catalog-imports/preview', data);
export const approveCatalogImport = (id, itemIds = []) =>
  api.post(`/api/catalog-imports/${id}/approve`, { itemIds });
export const rejectCatalogImport = (id, itemIds = []) =>
  api.post(`/api/catalog-imports/${id}/reject`, { itemIds });
export const applyCatalogImport = (id) => api.post(`/api/catalog-imports/${id}/apply`, {});
export const updateCatalogImportDecision = (batchId, itemId, data) =>
  api.put(`/api/catalog-imports/${batchId}/items/${itemId}/decision`, data, { silent: true });
export const saveCatalogImportProgress = (batchId, decisions) =>
  api.put(`/api/catalog-imports/${batchId}/progress`, { decisions }, { silent: true });
export const excludeCatalogImportItem = (batchId, itemId) =>
  api.del(`/api/catalog-imports/${batchId}/items/${itemId}`);

export const startSupplierWebsiteCrawl = (id, data = {}) =>
  api.post(`/api/supplier-websites/${id}/crawl`, {
    categoryUrls: data.categoryUrls?.length ? data.categoryUrls : null,
    userPrompt: data.userPrompt?.trim() || null,
    categoryScope: data.categoryScope?.length ? data.categoryScope : null,
    maxPages: data.maxPages == null || data.maxPages === '' ? null : Number(data.maxPages),
    idempotencyKey: data.idempotencyKey || crypto.randomUUID(),
  });

// Descubrimiento asíncrono del árbol de categorías externas (lo expone el crawler del sitio).
export const startCategoryDiscovery = (websiteId) =>
  api.post(`/api/supplier-websites/${websiteId}/categories/discover`, {}, { timeoutMs: 15000 });
export const getCategoryDiscovery = (websiteId, runId, opts) =>
  api.get(`/api/supplier-websites/${websiteId}/categories/discover/${encodeURIComponent(runId)}`, { ...opts, timeoutMs: 15000 });

export const saveCategorySelection = (websiteId, runId, categoryScope, categoryTree) =>
  api.post(`/api/supplier-websites/${websiteId}/categories/discover/${encodeURIComponent(runId)}/selection`,
    { categoryScope, categoryTree }, { silent: true, timeoutMs: 15000 });
