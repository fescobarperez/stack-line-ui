// Endpoints de compras: órdenes de compra y recepción.
import { api } from './client.js';

export function listPurchaseOrders({ page = 0, size = 50 } = {}) {
  const q = new URLSearchParams({ page: String(page), size: String(size) });
  return api.get(`/api/purchase-orders?${q.toString()}`);
}
export const getPurchaseOrder = (id) => api.get(`/api/purchase-orders/${id}`);
export const createPurchaseOrder = (data) => api.post('/api/purchase-orders', data);
// receive: body { items: [{ itemId, quantity }] } o null para recibir todo lo pendiente.
export const receivePurchaseOrder = (id, data = null) => api.post(`/api/purchase-orders/${id}/receive`, data);
// cancel: sólo para órdenes sin recepciones (el backend responde 409 si ya entró mercancía).
export const cancelPurchaseOrder = (id) => api.post(`/api/purchase-orders/${id}/cancel`);
