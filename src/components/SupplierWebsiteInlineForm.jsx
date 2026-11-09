import React, { useId, useState } from 'react';
import { createSupplierWebsite } from '../api/supplierIngestion.js';
import Button from './Button.jsx';
import styles from './SupplierWebsiteInlineForm.module.css';

export function suggestedWebsiteName(value) {
  try {
    const parsed = new URL(String(value || '').trim());
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) return '';
    return parsed.hostname.replace(/^www\./i, '');
  } catch {
    return '';
  }
}

export function isValidHttpWebsiteUrl(value) {
  return Boolean(suggestedWebsiteName(value));
}

export default function SupplierWebsiteInlineForm({ supplierId, onCreated, onCancel, pushToast }) {
  const fieldId = useId();
  const [baseUrl, setBaseUrl] = useState('');
  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const changeUrl = (value) => {
    setBaseUrl(value);
    setError('');
    if (!nameTouched) setName(suggestedWebsiteName(value));
  };

  const submit = async (event) => {
    event.preventDefault();
    const normalizedName = name.trim() || suggestedWebsiteName(baseUrl);
    if (!supplierId || !isValidHttpWebsiteUrl(baseUrl)) {
      setError('Ingresa una URL completa que empiece con http:// o https://.');
      return;
    }
    if (!normalizedName) {
      setError('Ingresa un nombre para identificar el sitio.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const website = await createSupplierWebsite({
        supplierId: Number(supplierId),
        name: normalizedName,
        baseUrl: baseUrl.trim(),
        websiteType: 'catalog',
        status: 'active',
        crawlEnabled: true,
      });
      onCreated(website);
      pushToast?.('Página web asignada al proveedor', 'success');
    } catch (requestError) {
      setError(requestError.message || 'No se pudo asignar la página web.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className={styles.root} onSubmit={submit}>
      <div className={styles.header}>
        <div>
          <strong>Asignar página web</strong>
          <div className="muted body-small">Se seleccionará automáticamente para continuar con el crawling.</div>
        </div>
      </div>
      <div className={styles.grid}>
        <div className="field">
          <label className="field-label" htmlFor={`${fieldId}-url`}>URL base *</label>
          <input id={`${fieldId}-url`} className="field-input" type="url" value={baseUrl}
            onChange={(event) => changeUrl(event.target.value)}
            placeholder="https://proveedor.com/catalogo" disabled={saving} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor={`${fieldId}-name`}>Nombre del sitio</label>
          <input id={`${fieldId}-name`} className="field-input" value={name}
            onChange={(event) => { setName(event.target.value); setNameTouched(true); setError(''); }}
            placeholder="Se sugiere desde el dominio" disabled={saving} />
        </div>
      </div>
      {error && <div className={styles.error} role="alert">{error}</div>}
      <div className={styles.actions}>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={saving}>Cancelar</Button>
        <Button type="submit" size="sm" variant="accent" icon="check"
          disabled={saving || !baseUrl.trim()}>{saving ? 'Asignando…' : 'Asignar página'}</Button>
      </div>
    </form>
  );
}
