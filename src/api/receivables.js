// Endpoints de cuentas por cobrar: pagos/abonos de clientes.
import { api } from './client.js';

export function listPayments({ clientId, page = 0, size = 50 } = {}) {
  const q = new URLSearchParams({ page: String(page), size: String(size) });
  if (clientId) q.set('clientId', String(clientId));
  return api.get(`/api/payments?${q.toString()}`);
}
export const getPayment = (id) => api.get(`/api/payments/${id}`);
export const createPayment = (data) => api.post('/api/payments', data);

/** Deja constancia de que el recibo se imprimió. Reimprimir no lo cambia. */
export const markReceiptPrinted = (id) => api.post(`/api/payments/${id}/printed`);

// Antigüedad de saldos (CxC aging)
export const getAging = () => api.get('/api/receivables/aging');
