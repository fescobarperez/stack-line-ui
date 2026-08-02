// Endpoint de reportería de ventas.
import { api } from './client.js';

export const getSalesReport = (days = 30) => api.get(`/api/reports/sales?days=${days}`);
