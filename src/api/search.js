// Búsqueda global (⌘K): productos y clientes.
import { api } from './client.js';

export const getSearch = (q) => api.get(`/api/search?q=${encodeURIComponent(q)}`);
