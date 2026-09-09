// Velo de carga a pantalla completa.
//
// Se muestra mientras haya peticiones HTTP en vuelo y bloquea la interacción,
// para que el usuario no dispare una segunda acción sobre datos que todavía
// están cambiando.
//
// Los dos temporizadores son lo que separa un indicador útil de uno molesto:
//
//   RETARDO   La mayoría de las respuestas llegan en menos de 200 ms. Sin
//             espera, cada clic produciría un destello gris — más ruidoso que
//             no avisar nada.
//   MÍNIMO    Una vez visible se queda un momento. Si apareciera y
//             desapareciera en 50 ms el resultado sería el mismo parpadeo,
//             ahora por el otro lado.
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { suscribir, peticionesEnVuelo } from '../api/loading.js';

const RETARDO_MS = 250;
const MINIMO_MS = 400;

export default function GlobalLoading() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const temporizadorMostrar = useRef(null);
  const mostradoEn = useRef(0);
  const temporizadorOcultar = useRef(null);

  useEffect(() => {
    const limpiar = () => {
      clearTimeout(temporizadorMostrar.current);
      clearTimeout(temporizadorOcultar.current);
    };

    const alCambiar = (enVuelo) => {
      if (enVuelo > 0) {
        clearTimeout(temporizadorOcultar.current);
        if (visible || temporizadorMostrar.current) return;
        temporizadorMostrar.current = setTimeout(() => {
          temporizadorMostrar.current = null;
          mostradoEn.current = Date.now();
          setVisible(true);
        }, RETARDO_MS);
        return;
      }

      // Ya no queda ninguna en vuelo.
      if (temporizadorMostrar.current) {
        // Respondió antes del retardo: nunca llegó a verse y no debe verse.
        clearTimeout(temporizadorMostrar.current);
        temporizadorMostrar.current = null;
        return;
      }
      if (!visible) return;

      const restante = MINIMO_MS - (Date.now() - mostradoEn.current);
      temporizadorOcultar.current = setTimeout(
        () => setVisible(false), Math.max(0, restante));
    };

    // Puede haber peticiones en curso desde antes de montarse.
    alCambiar(peticionesEnVuelo());
    const desuscribir = suscribir(alCambiar);
    return () => { desuscribir(); limpiar(); };
  }, [visible]);

  if (!visible) return null;

  return (
    // Sin texto visible, pero con nombre accesible: un lector de pantalla
    // necesita saber que la aplicación está esperando, y un giro no se lee.
    <div className="loading-overlay" role="status" aria-busy="true"
         aria-label={t('common.loading', 'Cargando…')}>
      <div className="loading-overlay-spinner" />
    </div>
  );
}
