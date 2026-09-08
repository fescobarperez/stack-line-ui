// Endpoints del Bloque 5 (resto de Wave 2): CxP, devoluciones, cotizaciones,
// toma física, UOM, variantes, centros de costo, auditoría y configuración.
import { api } from './client.js';

function paged({ page = 0, size = 50 } = {}) {
  return new URLSearchParams({ page: String(page), size: String(size) }).toString();
}

// ── CxP: facturas de proveedor y pagos ────────────────────────────────
export const listPurchaseInvoices = (opts) => api.get(`/api/purchase-invoices?${paged(opts)}`);
export const createPurchaseInvoice = (data) => api.post('/api/purchase-invoices', data);
export const listSupplierPayments = (opts) => api.get(`/api/supplier-payments?${paged(opts)}`);
export const createSupplierPayment = (data) => api.post('/api/supplier-payments', data);

// ── Devoluciones: notas de crédito ────────────────────────────────────
export const listCreditNotes = (opts) => api.get(`/api/credit-notes?${paged(opts)}`);
export const getCreditNote = (id) => api.get(`/api/credit-notes/${id}`);
export const createCreditNote = (data) => api.post('/api/credit-notes', data);
export const retryCreditNoteFel = (id, data) => api.put(`/api/credit-notes/${id}/fel`, data || {});

// ── Cotizaciones (a cliente) y RFQ (a proveedor) vía partyType ────────
export const listQuotes = ({ partyType, ...opts } = {}) =>
  api.get(`/api/quotes?${paged(opts)}${partyType ? `&partyType=${partyType}` : ''}`);
export const getQuote = (id) => api.get(`/api/quotes/${id}`);
export const createQuote = (data) => api.post('/api/quotes', data);
export const updateQuote = (id, data) => api.put(`/api/quotes/${id}`, data);
export const updateQuoteStatus = (id, data) => api.put(`/api/quotes/${id}/status`, data);

// Gastos/cargos de la cotización (fixed/percent). Cada llamada devuelve el
// resumen recalculado { materialsCost, fixedTotal, subtotalCost, percentTotal, total, charges[] }.
export const getQuoteCharges = (id) => api.get(`/api/quotes/${id}/charges`);
export const addQuoteCharge = (id, data) => api.post(`/api/quotes/${id}/charges`, data);
export const deleteQuoteCharge = (id, chargeId) => api.del(`/api/quotes/${id}/charges/${chargeId}`);

// Plan de pagos y cobros de la cotización. quoteTotal es el total operativo
// con IVA (subtotal + cargos manuales + impuesto); devuelve { quoteTotal, planTotal, remaining, balanced, collected, pending, terms[], payments[] }.
export const getQuotePlan = (id) => api.get(`/api/quotes/${id}/plan`);
export const addQuotePaymentTerm = (id, data) => api.post(`/api/quotes/${id}/plan/terms`, data);
export const deleteQuotePaymentTerm = (id, termId) => api.del(`/api/quotes/${id}/plan/terms/${termId}`);

// ── Toma física ───────────────────────────────────────────────────────
export const listStockCounts = (opts) => api.get(`/api/stock-counts?${paged(opts)}`);
export const getStockCount = (id) => api.get(`/api/stock-counts/${id}`);
export const createStockCount = (data) => api.post('/api/stock-counts', data);
export const saveStockCountCounts = (id, data) => api.put(`/api/stock-counts/${id}/counts`, data);
export const closeStockCount = (id) => api.post(`/api/stock-counts/${id}/close`);

// ── Unidades de medida ────────────────────────────────────────────────
export const listUnits = () => api.get('/api/uom/units');
export const createUnit = (data) => api.post('/api/uom/units', data);
export const updateUnit = (id, data) => api.put(`/api/uom/units/${id}`, data);
export const deleteUnit = (id) => api.del(`/api/uom/units/${id}`);
export const listUomConversions = () => api.get('/api/uom/conversions');
export const createUomConversion = (data) => api.post('/api/uom/conversions', data);

// ── Variantes de producto ─────────────────────────────────────────────
export const listVariants = (productId) =>
  api.get(`/api/product-variants${productId ? `?productId=${productId}` : ''}`);
export const createVariant = (data) => api.post('/api/product-variants', data);
export const updateVariant = (id, data) => api.put(`/api/product-variants/${id}`, data);
export const deleteVariant = (id) => api.del(`/api/product-variants/${id}`);

// ── Centros de costo ──────────────────────────────────────────────────
export const listCostCenters = () => api.get('/api/cost-centers');
export const createCostCenter = (data) => api.post('/api/cost-centers', data);
export const updateCostCenter = (id, data) => api.put(`/api/cost-centers/${id}`, data);
export const deleteCostCenter = (id) => api.del(`/api/cost-centers/${id}`);

// ── Auditoría ─────────────────────────────────────────────────────────
export function listAuditLog({ module, page = 0, size = 50 } = {}) {
  const q = new URLSearchParams({ page: String(page), size: String(size) });
  if (module) q.set('module', module);
  return api.get(`/api/audit-log?${q.toString()}`);
}
export const createAuditLog = (data) => api.post('/api/audit-log', data);

// ── Configuración (clave-valor por empresa) ───────────────────────────
export const listSettings = () => api.get('/api/settings');
export const getSetting = (key) => api.get(`/api/settings/${encodeURIComponent(key)}`);
export const putSetting = (key, data) => api.put(`/api/settings/${encodeURIComponent(key)}`, data);
export const deleteSetting = (key) => api.del(`/api/settings/${encodeURIComponent(key)}`);

// ── Subida de logo a S3 (URL prefirmada) ──────────────────────────────
// 1) pide al backend una URL prefirmada; 2) hace PUT del archivo directo a S3;
// 3) devuelve la URL pública final para guardar en company.logo_url.
export async function uploadCompanyLogo(file) {
  const presign = await api.post('/api/uploads/logo-url', {
    fileName: file.name,
    contentType: file.type,
  });
  const putRes = await fetch(presign.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': presign.contentType },
    body: file,
  });
  if (!putRes.ok) {
    throw new Error(`La subida a S3 falló (HTTP ${putRes.status})`);
  }
  return presign.publicUrl;
}
