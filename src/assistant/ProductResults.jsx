// Stackline — Asistente: resultados del catálogo en el panel.
import React from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../components/Button.jsx';

export default function ProductResults({ productos, deshabilitado, onAgregar }) {
  const { t } = useTranslation();
  return (
    <ul className="assistant-list">
      {productos.map((p) => (
        <li key={p.sku} className="assistant-card assistant-product">
          <div className="assistant-row">
            <div className="assistant-grow">
              <div className="title-small">{p.name}</div>
              <div className="assistant-code">{[p.sku, p.warehouse].filter(Boolean).join(' · ')}</div>
            </div>
            <div className="assistant-amount strong" aria-label={p.price_label || undefined}>{p.price}</div>
          </div>
          <div className="assistant-row center">
            {p.stock_label && <span className="badge-m3 success">{p.stock_label}</span>}
            <Button size="sm" icon="add" disabled={deshabilitado} onClick={() => onAgregar(p)}>
              {t('assistant.addToQuote', 'Añadir a cotización')}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
