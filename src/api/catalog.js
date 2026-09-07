// Endpoints del módulo Catálogo (products + categories).
import { api } from './client.js';


export const addProductSupplier = (productId, data) =>
  api.post(`/api/products/${productId}/suppliers`, data);
// Categorías
export const listCategories = () => api.get('/api/categories');
export const createCategory = (data) => api.post('/api/categories', data);
export const updateCategory = (id, data) => api.put(`/api/categories/${id}`, data);
export const copyCategory = (id) => api.post(`/api/categories/${id}/copy`, {});
export const deleteCategory = (id) => api.del(`/api/categories/${id}`);

// Productos (paginado: el backend devuelve { content, totalSize, ... })
// `itemType`: 'sellable' | 'raw_material' | 'service'. Sin él devuelve todo.
// El POS pide solo 'sellable': la materia prima se consume y no se vende.
export function listProducts({ search = '', itemType = '', page = 0, size = 50 } = {}) {
  const q = new URLSearchParams({ page: String(page), size: String(size) });
  if (search) q.set('search', search);
  if (itemType) q.set('itemType', itemType);
  return api.get(`/api/products?${q.toString()}`);
}
export const getProduct = (id) => api.get(`/api/products/${id}`);
export const createProduct = (data) => api.post('/api/products', data);
export const updateProduct = (id, data) => api.put(`/api/products/${id}`, data);
export const moveProduct = (id, categoryId) => api.put(`/api/products/${id}/category`, { categoryId });
export const deleteProduct = (id) => api.del(`/api/products/${id}`);
