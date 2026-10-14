import React, { useMemo, useState } from 'react';
import Autocomplete from './Autocomplete.jsx';
import DatePicker from './DatePicker.jsx';
import Button from './Button.jsx';
import Icon from './Icon.jsx';
import { updateQuote } from '../api/wave2.js';
import { useTranslation } from 'react-i18next';
import { formatDimensions } from '../hooks/useQuotes.js';

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Cómo ve el cliente los precios en el PDF. */
export const PRICE_DISPLAY_OPTIONS = [
  { id: 'detailed', key: 'quotes.priceDetailed', label: 'Detallado (precio por línea)' },
  { id: 'global', key: 'quotes.priceGlobal', label: 'Precio global (solo el total)' },
];

const medida = (v) => (v === '' || v == null || !(Number(v) > 0) ? null : Number(v));

/** Medidas de la línea para el PUT; null si no se escribió ninguna. */
export function lineDimensions(item) {
  const d = { height: medida(item.height), width: medida(item.width), depth: medida(item.depth) };
  return d.height == null && d.width == null && d.depth == null ? null : d;
}

/** Difiere de la medida del catálogo (solo si el catálogo tiene medida). */
export function isCustomSize(item) {
  const b = item.base;
  if (!b || (b.height == null && b.width == null && b.depth == null)) return false;
  return ['height', 'width', 'depth'].some((k) => {
    const a = medida(item[k]);
    const base = b[k] == null ? null : Number(b[k]);
    return a !== base;
  });
}

export default function QuoteDraftEditModal({ quote, onClose, onSaved, pushToast }) {
  const { t } = useTranslation();
  const [validUntil, setValidUntil] = useState(quote.validUntil || '');
  const [notes, setNotes] = useState(quote.notes || '');
  const [deliveryAddress, setDeliveryAddress] = useState(quote.deliveryAddress || '');
  const [profitCalcType, setProfitCalcType] = useState(quote.profitCalcType || 'fixed');
  const [profitValue, setProfitValue] = useState(String(quote.profitValue ?? 0));
  const [priceDisplay, setPriceDisplay] = useState(quote.priceDisplay || 'detailed');
  const global = priceDisplay === 'global';
  const [items, setItems] = useState(() => (quote.items || []).map((item) => ({
    id: item.id,
    description: item.name || '',
    quantity: String(item.qty ?? 1),
    unitPrice: String(item.unitPrice ?? 0),
    discount: String(item.discount ?? 0),
    height: item.dimensions?.height ?? '',
    width: item.dimensions?.width ?? '',
    depth: item.dimensions?.depth ?? '',
    base: item.baseDimensions,
    unit: item.dimensionUnit || 'm',
    showToClient: item.showToClient !== false,
  })));
  const [busy, setBusy] = useState(false);
  const today = useMemo(localToday, []);
  const setItem = (id, key, value) => setItems((current) => current.map((item) => item.id === id ? { ...item, [key]: value } : item));
  const removeItem = (id) => setItems((current) => current.length > 1 ? current.filter((item) => item.id !== id) : current);
  const valid = Boolean(validUntil)
    && validUntil >= (quote.date || today)
    && items.length > 0
    && items.every((item) => Number(item.quantity) > 0 && Number(item.unitPrice) >= 0 && Number(item.discount) >= 0 && Number(item.discount) <= 100);

  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      const updated = await updateQuote(quote.backendId, {
        validUntil,
        notes: notes.trim() || null,
        // Vacía = se borra (el backend toma null como «conservar»).
        deliveryAddress: deliveryAddress.trim(),
        profitCalcType,
        priceDisplay,
        profitValue: Number(profitValue) || 0,
        items: items.map((item) => ({
          id: item.id,
          description: item.description.trim() || null,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice) || 0,
          discount: Number(item.discount) || 0,
          // Vacías = se conservan las que tenga la línea.
          dimensions: lineDimensions(item),
          showToClient: item.showToClient,
        })),
      });
      onSaved?.(updated);
      pushToast?.(t('quotes.draftUpdated', 'Borrador actualizado'), 'success');
    } catch (err) {
      pushToast?.(t('quotes.draftUpdateFailed', 'No se pudo actualizar el borrador: ') + err.message, 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h3>{t('quotes.editDraftTitle', 'Editar cotización')}</h3>
            <div className="muted" style={{ fontSize: 12 }}>{quote.id} · {t('quotes.editDraftHint', 'Los cambios aplican mientras permanezca en borrador')}</div>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="close" /></button>
        </div>

        <div className="modal-body" style={{ flex: 1, overflowY: 'auto' }}>
          <div className="form-grid" style={{ marginBottom: 18 }}>
            <div className="field-group">
              <label className="field-label">{t('quotes.validUntil', 'Fecha de expiración')} *</label>
              <DatePicker value={validUntil} onChange={(iso) => setValidUntil(iso)} min={quote.date || today}
                aria-label={t('quotes.validUntil', 'Fecha de expiración')} />
            </div>
            <div className="field-group">
              <label className="field-label">{t('quotes.companyProfit', 'Ganancia de la empresa')}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <Autocomplete value={profitCalcType}
                  onChange={(id) => setProfitCalcType(id == null ? '' : String(id))}
                  options={[{ id: 'fixed', name: t('quotes.fixed', 'Fijo') }, { id: 'percent', name: '%' }]}
                  allowClear={false}
                  emptyText="Sin coincidencias"
                  aria-label="Estado" />
                <input className="field-input mono" type="number" min="0" step="0.01" value={profitValue} onChange={(e) => setProfitValue(e.target.value)} placeholder={profitCalcType === 'percent' ? '%' : 'Q'} />
              </div>
            </div>
            <div className="field-group">
              <label className="field-label">{t('quotes.priceDisplay', 'Presentación al cliente')}</label>
              <Autocomplete value={priceDisplay}
                onChange={(id) => id && setPriceDisplay(String(id))}
                options={PRICE_DISPLAY_OPTIONS.map((o) => ({ id: o.id, name: t(o.key, o.label) }))}
                allowClear={false}
                aria-label={t('quotes.priceDisplay', 'Presentación al cliente')} />
              {global && (
                <div className="body-small muted" style={{ marginTop: 4 }}>
                  {t('quotes.globalHint', 'El PDF muestra las líneas marcadas como «Incluido» y solo el total. Desmarca las líneas internas (p. ej. materiales).')}
                </div>
              )}
            </div>
          </div>

          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', color: 'var(--muted)', marginBottom: 8 }}>
            {t('quotes.lines', 'LÍNEAS DE LA COTIZACIÓN')}
          </div>
          <div className="table-wrap" style={{ marginBottom: 16 }}>
            <table className="tbl tbl-stack">
              <thead>
                <tr>
                  <th>{t('common.description', 'Descripción')}</th>
                  <th style={{ width: 90, textAlign: 'right' }}>{t('quotes.qty', 'Cant.')}</th>
                  <th style={{ width: 130, textAlign: 'right' }}>{t('quotes.unitPriceShort', 'P. Unit.')}</th>
                  <th style={{ width: 100, textAlign: 'right' }}>{t('common.discount', 'Desc. %')}</th>
                  <th style={{ width: 210 }}>{t('quotes.dimensions', 'Medidas (alto × ancho × prof.)')}</th>
                  {global && <th style={{ width: 64, textAlign: 'center' }} title={t('quotes.showToClientHint', 'Sale en el PDF del cliente')}>{t('quotes.showToClient', 'Cliente')}</th>}
                  <th style={{ width: 36 }} />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="stack-title"><input className="field-input" value={item.description} onChange={(e) => setItem(item.id, 'description', e.target.value)} /></td>
                    <td data-label={t('quotes.qty', 'Cant.')}><input className="field-input mono" type="number" min="0.001" step="0.001" style={{ textAlign: 'right' }} value={item.quantity} onChange={(e) => setItem(item.id, 'quantity', e.target.value)} /></td>
                    <td data-label={t('quotes.unitPriceShort', 'P. Unit.')}><input className="field-input mono" type="number" min="0" step="0.01" style={{ textAlign: 'right' }} value={item.unitPrice} onChange={(e) => setItem(item.id, 'unitPrice', e.target.value)} /></td>
                    <td data-label={t('common.discount', 'Desc. %')}><input className="field-input mono" type="number" min="0" max="100" step="0.01" style={{ textAlign: 'right' }} value={item.discount} onChange={(e) => setItem(item.id, 'discount', e.target.value)} /></td>
                    <td data-label={t('quotes.dimensionsShort', 'Medidas')} className="stack-wrap">
                      <div className="dims-inputs">
                        {['height', 'width', 'depth'].map((k) => (
                          <input key={k} className="field-input mono" type="number" min="0" step="0.01" style={{ padding: '3px 4px' }}
                            placeholder={item.base?.[k] != null ? String(item.base[k]) : '—'}
                            value={item[k]} onChange={(e) => setItem(item.id, k, e.target.value)} />
                        ))}
                      </div>
                      {isCustomSize(item) && (
                        <div className="body-small" style={{ color: 'var(--warning, #b26b00)', marginTop: 2 }}>
                          {t('quotes.customSize', 'Medida especial')} · {t('quotes.catalogSize', 'catálogo')} {formatDimensions(item.base, item.unit)}
                        </div>
                      )}
                    </td>
                    {global && (
                      <td data-label={t('quotes.showToClient', 'Cliente')} style={{ textAlign: 'center' }}>
                        <input type="checkbox" checked={item.showToClient}
                          aria-label={t('quotes.showToClientHint', 'Sale en el PDF del cliente')}
                          onChange={(e) => setItem(item.id, 'showToClient', e.target.checked)} />
                      </td>
                    )}
                    <td className="stack-actions" style={{ textAlign: 'right' }}>
                      <button className="icon-btn" type="button" onClick={() => removeItem(item.id)} disabled={items.length === 1 || busy} aria-label={t('quotes.removeLine', 'Eliminar línea')}>
                        <Icon name="close" size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="field-group">
            <label className="field-label">{t('quotes.deliveryAddress', 'Dirección de entrega / instalación')}</label>
            <input className="field-input" maxLength={300} value={deliveryAddress}
              placeholder={t('quotes.deliveryAddressPlaceholder', 'Zona, colonia o dirección completa')}
              onChange={(e) => setDeliveryAddress(e.target.value)} />
          </div>

          <div className="field-group">
            <label className="field-label">{t('common.notes', 'Notas')}</label>
            <textarea className="field-input" rows={3} style={{ resize: 'vertical' }} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="modal-foot">
          <Button variant="ghost" onClick={onClose}>{t('common.cancel', 'Cancelar')}</Button>
          <Button icon="check" variant="accent" disabled={!valid || busy} onClick={save}>{busy ? t('common.saving', 'Guardando…') : t('common.save', 'Guardar cambios')}</Button>
        </div>
      </div>
    </div>
  );
}
