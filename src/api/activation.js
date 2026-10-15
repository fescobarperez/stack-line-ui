// Activación de cuenta con el enlace de invitación que genera la consola de
// Stackline. Sin sesión: el token del enlace es la credencial, y sirve una vez.
import { api } from './client.js';

const P = '/api/auth/activation';

export const getActivation = (token) => api.get(`${P}?t=${encodeURIComponent(token)}`);
export const activateAccount = (token, password) => api.post(P, { token, password });

/** La misma regla que el backend: 8+ caracteres, con letras y números. */
export function passwordOk(p) {
  return typeof p === 'string' && p.length >= 8 && /[A-Za-zÀ-ÿ]/.test(p) && /\d/.test(p);
}
