// Plantillas de cálculo por producto (ERP: /api/product-templates).
import { api } from './client.js';

export const listTemplates = () => api.get('/api/product-templates');
export const getTemplate = (id) => api.get(`/api/product-templates/${id}`);
export const createTemplate = (data) => api.post('/api/product-templates', data);
export const updateTemplate = (id, data) => api.put(`/api/product-templates/${id}`, data);
export const setTemplateActive = (id, active) => api.post(`/api/product-templates/${id}/active`, { active });
// { params: {ancho: 3}, choices: {techo: 'shingle'}, preset } → desglose sin guardar nada.
export const calculateTemplate = (id, data) => api.post(`/api/product-templates/${id}/calculate`, data);
// Línea de cotización calculada con plantilla: { templateId, params, choices, preset, quantity }.
export const addTemplateItem = (quoteId, data) => api.post(`/api/quotes/${quoteId}/template-items`, data);
export const recalcTemplateItem = (quoteId, itemId, data) => api.put(`/api/quotes/${quoteId}/template-items/${itemId}`, data);
