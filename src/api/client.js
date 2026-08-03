// Cliente HTTP base del ERP. Centraliza el token de sesión (JWT Bearer), el
// header multi-empresa y el manejo de errores. La URL del backend se resuelve
// por ruta a través del registro de microservicios (services.js).
import { resolveBaseUrl } from './services.js';

const TOKEN_KEY = 'maya_token';
const LOGIN_PATH = '/api/auth/login';

// Token JWT de la sesión activa. Lo guarda auth.js al hacer login.
export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

// Empresa (inquilino) activa. El backend la deriva del token; esto solo la deja
// disponible al front. Se llena en el login desde la respuesta del servidor.
export function currentCompanyId() {
  return sessionStorage.getItem('companyId') || '';
}

// Limpia la sesión y manda al login (p.ej. cuando el token expira → 401).
function clearSessionAndRedirect() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem('companyId');
  sessionStorage.removeItem('maya_session');
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request(path, { method = 'GET', body, headers } = {}) {
  const token = getToken();
  const res = await fetch(`${resolveBaseUrl(path)}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let detail;
    try { detail = await res.json(); } catch { detail = null; }
    // Token inválido/expirado en cualquier endpoint que no sea el propio login:
    // cerramos sesión y volvemos al login.
    if (res.status === 401 && path !== LOGIN_PATH) {
      clearSessionAndRedirect();
    }
    throw new ApiError(res.status, detail?.message || res.statusText);
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  del: (path) => request(path, { method: 'DELETE' }),
};
