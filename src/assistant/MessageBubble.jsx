// Stackline — Asistente: un elemento de la conversación.
import React from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../components/Button.jsx';

function Avatar() {
  return <div className="assistant-mini-avatar label-small" aria-hidden="true">IA</div>;
}

/** Mensaje del usuario, del asistente o confirmación de una acción. */
export default function MessageBubble({ mensaje }) {
  const { t } = useTranslation();

  if (mensaje.role === 'user') {
    return (
      <div className="assistant-msg user">
        <div className="assistant-bubble body-medium">{mensaje.text}</div>
      </div>
    );
  }

  if (mensaje.role === 'notice') {
    const d = mensaje.data ?? {};
    return (
      <div className="assistant-msg assistant-notice body-medium">
        {t('assistant.sentNotice', 'Cotización {{number}} enviada por {{channels}}. Estado', { number: d.number, channels: d.channels })}{' '}
        <strong>{d.status}</strong>{' '}
        {t('assistant.sentNoticeModule', 'en el módulo Cotizaciones.')}
      </div>
    );
  }

  return (
    <div className="assistant-msg bot">
      <Avatar />
      <div className="assistant-bubble body-medium">{mensaje.text}</div>
    </div>
  );
}

export function TypingBubble() {
  const { t } = useTranslation();
  return (
    <div className="assistant-msg bot">
      <Avatar />
      <div className="assistant-typing" role="status" aria-label={t('assistant.typing', 'El asistente está escribiendo')}>
        <span /><span /><span />
      </div>
    </div>
  );
}

/** Error del turno: red o tiempo agotado (con reintento) o sin permiso (sin él). */
export function ErrorBubble({ tipo, onReintentar }) {
  const { t } = useTranslation();
  if (tipo === 'forbidden') {
    return (
      <div className="assistant-msg assistant-notice error body-medium" role="alert">
        {t('assistant.forbidden', 'No tiene permiso para esta acción.')}
      </div>
    );
  }
  return (
    <div className="assistant-msg assistant-notice error body-medium" role="alert">
      <span>{t('assistant.error', 'No pude completar la consulta. Intente de nuevo.')}</span>
      <div>
        <Button size="sm" icon="refresh" onClick={onReintentar}>{t('assistant.retry', 'Reintentar')}</Button>
      </div>
    </div>
  );
}
