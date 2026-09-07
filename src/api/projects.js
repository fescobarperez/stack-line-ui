// Proyectos: seguimiento de rentabilidad por trabajo.
import { api } from './client.js';

export const listProjects = () => api.get('/api/projects');
export const getProject = (id) => api.get(`/api/projects/${id}`);
export const createProject = (data) => api.post('/api/projects', data);

export const addProjectCost = (id, data) => api.post(`/api/projects/${id}/costs`, data);
export const deleteProjectCost = (id, costId) => api.del(`/api/projects/${id}/costs/${costId}`);
/** `note` justifica cerrar con costo sin facturar; en los demás casos sobra. */
export const setProjectStatus = (id, status, note) =>
  api.put(`/api/projects/${id}/status/${status}`
    + (note ? `?note=${encodeURIComponent(note)}` : ''));

/** Consume materia prima de bodega y la carga al proyecto al costo promedio. */
export const consumeMaterial = (id, data) => api.post(`/api/projects/${id}/consume`, data);
