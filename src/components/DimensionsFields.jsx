// Medida estándar del producto (alto × ancho × profundidad, en metros). Es
// opcional: el asistente la ofrece como medida estándar y marca como «medida
// especial» la que pida el cliente. Lo usan los dos formularios de producto
// (Inventario y Catálogo).
import React from 'react';
import { useTranslation } from 'react-i18next';

const CAMPOS = [
  ['height', 'dimensions.height', 'Alto'],
  ['width', 'dimensions.width', 'Ancho'],
  ['depth', 'dimensions.depth', 'Profundidad'],
];

export default function DimensionsFields({ value, onChange, className = 'field span-2' }) {
  const { t } = useTranslation();
  return (
    <div className={className}>
      <label className="field-label">{t('dimensions.standard', 'Medida estándar (m) · opcional')}</label>
      <div className="field-row">
        {CAMPOS.map(([k, key, def]) => (
          <input key={k} className="field-input mono" type="number" min="0" step="0.01"
            placeholder={t(key, def)} aria-label={t(key, def)}
            value={value?.[k] ?? ''} onChange={(e) => onChange(k, e.target.value)} />
        ))}
      </div>
      <div className="body-small muted">
        {t('dimensions.hint', 'Para muebles: el asistente la ofrece como medida estándar y marca como «medida especial» la que pida el cliente.')}
      </div>
      <label className="body-small" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
        <input type="checkbox" checked={Boolean(value?.madeToOrder)} onChange={(e) => onChange('madeToOrder', e.target.checked)} />
        {t('dimensions.madeToOrder', 'Se fabrica bajo pedido (no controla existencias)')}
      </label>
    </div>
  );
}
