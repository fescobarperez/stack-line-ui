// Búsqueda global (⌘K): productos y clientes.
import { api } from './client.js';

// Silenciosa: se dispara mientras el usuario escribe. Bloquear la pantalla
// en cada tecla sería peor que no avisar nada.
export const getSearch = (q) =>
  api.get(`/api/search?q=${encodeURIComponent(q)}`, { silent: true });
