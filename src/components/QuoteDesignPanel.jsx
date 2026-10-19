// Diseño del cliente en el detalle de una cotización.
//
// Cuando el cliente aprueba una imagen de ejemplo con el asistente de
// WhatsApp, el asistente guarda aquí la ficha (qué quiere, medidas, material,
// detalles) y el render. Es para el asesor: no sale en el PDF. Si la
// cotización no tiene diseño (lo normal), no se muestra nada.
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from './Icon.jsx';
import { getQuoteDesign, getQuoteDesignImage } from '../api/wave2.js';
import { designRows } from '../lib/quoteDesign.js';

export default function QuoteDesignPanel({ quoteId }) {
  const { t } = useTranslation();
  const [diseno, setDiseno] = useState(null);
  const [imagen, setImagen] = useState(null);
  const [ampliada, setAmpliada] = useState(false);

  useEffect(() => {
    let vigente = true;
    let url = null;
    setDiseno(null);
    setImagen(null);
    if (quoteId == null) return undefined;
    getQuoteDesign(quoteId)
      .then((d) => {
        if (!vigente || !d) return;
        setDiseno(d);
        if (d.hasImage) {
          return getQuoteDesignImage(quoteId).then((blob) => {
            if (!vigente || !blob) return;
            url = URL.createObjectURL(blob);
            setImagen(url);
          });
        }
        return null;
      })
      // 404 = la cotización no tiene diseño: no hay nada que mostrar.
      .catch(() => {});
    return () => { vigente = false; if (url) URL.revokeObjectURL(url); };
  }, [quoteId]);

  if (!diseno) return null;
  const filas = designRows(diseno.spec);
  const conteo = diseno.renderNumber
    ? t('quoteDesign.renderOf', 'imagen {{n}} de {{max}}', { n: diseno.renderNumber, max: diseno.renderMax ?? diseno.renderNumber })
    : null;

  return (
    <div className="quote-subsection">
      <div className="quote-subsection-heading">
        <div>
          <div className="quote-subsection-title">{t('quoteDesign.title', 'Diseño del cliente')}</div>
          <div className="quote-subsection-description">
            {t('quoteDesign.hint', 'Lo aprobó el cliente con el asistente de WhatsApp')}{conteo ? ` · ${conteo}` : ''}
          </div>
        </div>
      </div>
      <div className="quote-subsection-card quote-design">
        {imagen && (
          <button type="button" className="quote-design-image" onClick={() => setAmpliada(true)}
            aria-label={t('quoteDesign.enlarge', 'Ampliar imagen')}>
            <img src={imagen} alt={t('quoteDesign.alt', 'Imagen de ejemplo aprobada por el cliente')} />
            <span className="quote-design-tag">{t('quoteDesign.illustrative', 'Imagen ilustrativa')}</span>
          </button>
        )}
        <div className="detail-grid">
          {filas.map(([clave, porDefecto, valor]) => (
            <div className="detail-row" key={`${clave ?? porDefecto}`}>
              <span className="detail-label">{clave ? t(clave, porDefecto) : porDefecto}</span>
              <span className="detail-value">{valor}</span>
            </div>
          ))}
          {diseno.spec?.medidasConfirmadas === false && (
            <div className="cfg-hint">{t('quoteDesign.unconfirmed', 'Medidas estimadas de una foto: el cliente aún no las confirmó.')}</div>
          )}
        </div>
      </div>

      {ampliada && imagen && (
        <div className="modal-overlay" onClick={() => setAmpliada(false)}>
          <div className="modal quote-design-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{t('quoteDesign.title', 'Diseño del cliente')}</h3>
              <button className="icon-btn" onClick={() => setAmpliada(false)} aria-label={t('common.close', 'Cerrar')}><Icon name="x" /></button>
            </div>
            <div className="modal-body">
              <img className="quote-design-full" src={imagen} alt={t('quoteDesign.alt', 'Imagen de ejemplo aprobada por el cliente')} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
