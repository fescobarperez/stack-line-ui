// Búsqueda global (⌘K): productos y clientes.
import { api } from './client.js';

// La exención vive en RUTAS_EXENTAS de loading.js, no aquí: así no hay dos
// sitios donde mirar cuando alguien se pregunte por qué esta no muestra velo.
export const getSearch = (q) => api.get(`/api/search?q=${encodeURIComponent(q)}`);
