// Stackline — Asistente: cotización en construcción.
//
// Pinta la ÚLTIMA quote_preview tal como llega: líneas, subtotal, impuesto y
// total vienen resueltos y formateados por el backend. Aquí no se suma nada
// ni se escribe una etiqueta de impuesto o un símbolo de moneda.
import React from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../components/Button.jsx';

export default function QuotePreview({ cotizacion, enviada, pdfUrl, pendiente, confirmando, onEditar, onEnviar, onCancelarEnvio }) {
  const { t } = useTranslation();
  const lineas = cotizacion.lines ?? [];

  return (
    <>
      <section className="assistant-card assistant-quote" aria-label={t('assistant.quote', 'Cotización')}>
        <header className="assistant-quote-head">
          <span className="assistant-amount strong">{cotizacion.number}</span>
          <span className="badge-m3">{enviada ? enviada.status : cotizacion.status}</span>
        </header>

        <ul className="assistant-lines">
          {lineas.map((l) => (
            <li key={l.id} className="assistant-line">
              <div className="assistant-grow">
                <div className="body-medium">{l.name}</div>
                <div className="assistant-code">{l.qty} × {l.unit}</div>
              </div>
              <span className="assistant-amount">{l.total}</span>
              {!enviada && (
                <Button
                  variant="icon"
                  size="sm"
                  icon="edit"
                  title={t('assistant.editLine', 'Editar {{name}}', { name: l.name })}
                  disabled={pendiente}
                  onClick={() => onEditar(l)}
                />
              )}
            </li>
          ))}
        </ul>

        <dl className="assistant-totals">
          <dt>{t('assistant.subtotal', 'Subtotal')}</dt>
          <dd className="assistant-amount">{cotizacion.subtotal}</dd>
          {cotizacion.tax_label && (
            <>
              <dt>{cotizacion.tax_label}</dt>
              <dd className="assistant-amount">{cotizacion.tax}</dd>
            </>
          )}
          <dt className="grand">{t('assistant.total', 'Total')}</dt>
          <dd className="assistant-amount grand">{cotizacion.total}</dd>
        </dl>
        {cotizacion.estimated && !enviada && (
          <p className="assistant-estimate body-small">
            {t('assistant.estimated', 'Precio estimado: pasa a revisión antes de ser definitivo.')}
          </p>
        )}
      </section>

      {enviada ? (
        <div className="assistant-notice flush body-medium" role="status">
          {t('assistant.sentPanel', 'Enviada el {{date}} · {{channels}} · estado', { date: enviada.sent_at, channels: enviada.channels })}{' '}
          <strong>{enviada.status}</strong>{' '}
          {t('assistant.sentNoticeModule', 'en el módulo Cotizaciones.')}
        </div>
      ) : (
        <div className="assistant-actions">
          {/* Escritura: el primer clic pide confirmación en el propio botón. */}
          <Button variant="accent" icon={confirmando ? 'check' : 'send'} full disabled={pendiente} onClick={onEnviar}>
            {confirmando ? t('assistant.confirmSend', 'Confirmar envío') : t('assistant.sendQuote', 'Enviar al cliente')}
          </Button>
          {confirmando ? (
            <Button variant="ghost" onClick={onCancelarEnvio}>{t('common.cancel', 'Cancelar')}</Button>
          ) : (
            <Button
              icon="picture_as_pdf"
              disabled={!pdfUrl}
              onClick={() => window.open(pdfUrl, '_blank', 'noopener')}
            >
              {t('assistant.viewPdf', 'Ver PDF')}
            </Button>
          )}
        </div>
      )}
    </>
  );
}
