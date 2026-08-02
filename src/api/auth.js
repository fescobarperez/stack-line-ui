// Autenticación real contra el backend. Hace login, guarda el token JWT y arma
// el objeto de sesión que consume la UI (App.jsx / main.jsx).
import { api } from './client.js';

const TOKEN_KEY = 'maya_token';

// Iniciales a partir del nombre para el avatar (máx 2 letras).
function initialsFrom(name) {
  return (name || '')
    .split(/\s+/)
    .filter(Boolean)
    .map(p => p[0]?.toUpperCase() || '')
    .join('')
    .slice(0, 2) || 'US';
}

// Traduce la respuesta del backend al shape de sesión que espera la UI.
function toSession({ token, user }, companyCode) {
  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      initials: initialsFrom(user.name),
      email: user.email,
      role: user.roleName || 'Usuario',
      perms: user.permissions || [],
      branch: '',
    },
    company: {
      id: user.companyId,
      code: companyCode,
      name: user.companyName,
      tier: '',
    },
  };
}

export async function login({ companyCode, email, password }) {
  const code = companyCode.trim().toUpperCase();
  const res = await api.post('/api/auth/login', { companyCode: code, email: email.trim(), password });
  sessionStorage.setItem(TOKEN_KEY, res.token);
  sessionStorage.setItem('companyId', String(res.user.companyId));
  return toSession(res, code);
}

export function logout() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem('companyId');
  sessionStorage.removeItem('maya_session');
}
