// Plan de materiales de la Opción A: los grupos pertenecen al proyecto.
import { api } from './client.js';

export const getProjectMaterials = (projectId) =>
  api.get(`/api/projects/${projectId}/materials`);

export const createProjectMaterialGroup = (projectId, data) =>
  api.post(`/api/projects/${projectId}/material-groups`, data);

export const createProjectMaterial = (projectId, data) =>
  api.post(`/api/projects/${projectId}/materials`, data);

export const moveProjectMaterial = (projectId, materialId, groupId = null) =>
  api.put(`/api/projects/${projectId}/materials/${materialId}/group`, { groupId });

export const moveProjectMaterialGroup = (projectId, groupId, parentGroupId = null) =>
  api.put(`/api/projects/${projectId}/material-groups/${groupId}/parent`, { parentGroupId });

export const copyProjectMaterial = (projectId, materialId) =>
  api.post(`/api/projects/${projectId}/materials/${materialId}/copy`, {});

export const copyProjectMaterialGroup = (projectId, groupId) =>
  api.post(`/api/projects/${projectId}/material-groups/${groupId}/copy`, {});

export const renameProjectMaterialGroup = (projectId, groupId, name) =>
  api.put(`/api/projects/${projectId}/material-groups/${groupId}`, { name });

// Modelo cotización-céntrico (Fase 1): crea una cotización a partir de
// materiales del proyecto. `payload.lines[]` = { description, sourceGroupId,
// uom, sellPrice, materialIds[] }. Devuelve { quoteId }.
export const createProjectQuoteFromMaterials = (projectId, payload) =>
  api.post(`/api/projects/${projectId}/quotes`, payload);
