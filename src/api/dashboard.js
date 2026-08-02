// Endpoint del Dashboard general (métricas y series agregadas).
import { api } from './client.js';

export const getDashboard = (days = 14) => api.get(`/api/dashboard?days=${days}`);
