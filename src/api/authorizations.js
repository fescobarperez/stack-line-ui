// Motor de autorizaciones. Genérico: el mismo endpoint sirve para un descuento
// de POS, una nota de crédito o un pago. Lo que cambia es `type` y `payload`.
import { api } from './client.js';

/** ¿Esta operación requiere autorización y de qué nivel? Preguntar siempre. */
export const evaluateAuthorization = (data) => api.post('/api/authorizations/evaluate', data);

/** Crea la solicitud. Con approverEmail/Password se resuelve en el acto (PIN). */
export const createAuthorization = (data) => api.post('/api/authorizations', data);

export const resolveAuthorization = (id, data) => api.post(`/api/authorizations/${id}/resolve`, data);
export const getAuthorization = (id) => api.get(`/api/authorizations/${id}`);
export const listPendingAuthorizations = () => api.get('/api/authorizations/pending');

// Catálogo (solo lectura por ahora)
export const listAuthLevels = () => api.get('/api/authorization-config/levels');
export const listAuthTypes  = () => api.get('/api/authorization-config/types');
export const listAuthRules  = () => api.get('/api/authorization-config/rules');
