// Contadores de pendientes del menú lateral (GET /api/nav/counters).
import { api } from './client.js';

export const getNavCounters = () => api.get('/api/nav/counters');
