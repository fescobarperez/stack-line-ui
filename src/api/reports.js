// Endpoint de reportería de ventas.
import { api } from './client.js';

export const getSalesReport = (days = 30) => api.get(`/api/reports/sales?days=${days}`);

/**
 * Top K de proyectos por rentabilidad, mejores y peores en una sola respuesta.
 * `orderBy`: 'amount' | 'percent'. `status`: estados separados por coma o 'all'.
 */
export const getProjectProfitability = ({ limit = 5, orderBy = 'amount', status = 'closed' } = {}) =>
  api.get(`/api/reports/project-profitability?limit=${limit}&orderBy=${orderBy}&status=${encodeURIComponent(status)}`);
