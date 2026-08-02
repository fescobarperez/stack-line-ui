// Notificaciones derivadas (alertas en tiempo real).
import { api } from './client.js';

export const getNotifications = () => api.get('/api/notifications');
