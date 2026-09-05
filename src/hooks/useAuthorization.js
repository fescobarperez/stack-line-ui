// Stackline — Hook de autorizaciones
//
// Punto único de entrada para cualquier módulo que necesite una aprobación.
// El llamador no sabe si se resolverá con PIN en sitio o por bandeja: eso lo
// decide el tipo configurado en el backend.
//
//   const { require: requireAuth, dialog } = useAuthorization();
//
//   const auth = await requireAuth({
//     type: 'pos_discount', branchId,
//     amount: descManual, percent: descManualPct,
//     payload: { items },
//   });
//   if (!auth.granted) return;      // rechazada o cancelada
//   // ...continuar; auth.id es la autorización para adjuntar al documento
//
// `dialog` es el nodo del diálogo de PIN: se monta una vez en el módulo.
import { useCallback, useState } from 'react';
import { evaluateAuthorization, createAuthorization } from '../api/authorizations.js';
import { usePendingAuthorizations } from './useOperations.js';

export function useAuthorization() {
  // Solicitud en curso pendiente de credencial, con su resolve() en espera.
  const [prompt, setPrompt] = useState(null);

  const require = useCallback(async (req) => {
    const { type, branchId, amount, currency, percent, payload, reference } = req;

    // 1. El consumidor nunca decide si hace falta: pregunta al motor.
    const check = await evaluateAuthorization({ type, branchId, amount, currency, percent });
    if (!check.required) return { granted: true, id: null, skipped: true };

    const body = {
      type, branchId, amount, currency, percent, reference,
      payload: payload ? JSON.stringify(payload) : '{}',
    };

    // 2. Modo bandeja: queda pendiente y el módulo no puede continuar ahora.
    if (check.resolutionMode === 'tray') {
      const created = await createAuthorization(body);
      // Sube el contador del escudo en cuanto entra a la bandeja.
      usePendingAuthorizations.refresh();
      return { granted: false, pending: true, id: created.id, level: check.levelName };
    }

    // 3. Modo PIN (o 'both'): se pide credencial de un superior aquí mismo.
    return new Promise((resolve) => {
      setPrompt({
        level: check.levelName,
        onSubmit: async (email, password) => {
          const created = await createAuthorization({
            ...body, approverEmail: email, approverPassword: password,
          });
          setPrompt(null);
          resolve({ granted: created.status === 'approved', id: created.id, request: created });
        },
        onCancel: () => { setPrompt(null); resolve({ granted: false, cancelled: true }); },
      });
    });
  }, []);

  return { require, prompt };
}

export default useAuthorization;
