// Stackline — Asistente: datos del cliente en el panel.
import React from 'react';
import { useTranslation } from 'react-i18next';

export default function CustomerCard({ cliente }) {
  const { t } = useTranslation();
  const contacto = [cliente.contact, cliente.email].filter(Boolean).join(' · ');
  return (
    <section className="assistant-card assistant-customer" aria-label={t('assistant.customer', 'Cliente')}>
      <div className="assistant-overline label-small">{t('assistant.customer', 'Cliente')}</div>
      <div className="title-small">{cliente.name}</div>
      {cliente.tax_id && (
        <div className="assistant-code">{[cliente.tax_id_label, cliente.tax_id].filter(Boolean).join(' ')}</div>
      )}
      {contacto && <div className="assistant-meta body-small">{contacto}</div>}
    </section>
  );
}
