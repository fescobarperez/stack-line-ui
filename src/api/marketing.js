// Endpoints de marketing: promociones.
import { api } from './client.js';

export const listPromotions = () => api.get('/api/promotions');
export const getPromotion = (id) => api.get(`/api/promotions/${id}`);
export const createPromotion = (data) => api.post('/api/promotions', data);
export const updatePromotion = (id, data) => api.put(`/api/promotions/${id}`, data);
export const deletePromotion = (id) => api.del(`/api/promotions/${id}`);
export const registerPromotionUsage = (id, data) => api.post(`/api/promotions/${id}/usage`, data);
