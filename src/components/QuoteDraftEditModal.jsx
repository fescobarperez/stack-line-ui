import React, { useMemo, useState } from 'react';
import Button from './Button.jsx';
import Icon from './Icon.jsx';
import { updateQuote } from '../api/wave2.js';
import { useTranslation } from 'react-i18next';

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function QuoteDraftEditModal({ quote, onClose, onSaved, pushToast }) {
  const { t } = useTranslation();
  const [validUntil, setValidUntil] = useState(quote.validUntil || '');
  const [notes, setNotes] = useState(quote.notes || '');
  const [profitCalcType, setProfitCalcType] = useState(quote.profitCalcType || 'fixed');
  const [profitValue, setProfitValue] = useState(String(quote.profitValue ?? 0));
  const [items, setItems] = useState(() => (quote.items || []).map((item) => ({
    id: item.id,
    description: item.name || '',
    quantity: String(item.qty ?? 1),
    unitPrice: String(item.unitPrice ?? 0),
    discount: String(item.discount ?? 0),
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
        profitCalcType,
        profitValue: Number(profitValue) || 0,
        items: items.map((item) => ({
          id: item.id,
          description: item.description.trim() || null,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice) || 0,
          discount: Number(item.discount) || 0,
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
      <div className="modal" style={{ width: 760, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h3>{t('quotes.editDraftTitle', 'Editar cotización')}</h3>
            <div className="muted" style={{ fontSize: 12 }}>{quote.id} · {t('quotes.editDraftHint', 'Los cambios aplican mientras permanezca en borrador')}</div>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="close" /></button>
        </div>

        <div className="modal-body" style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
            <div className="field-group">
              <label className="field-label">{t('quotes.validUntil', 'Fecha de expiración')} *</label>
              <input className="field-input" type="date" min={quote.date || today} value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>
            <div className="field-group">
              <label className="field-label">{t('quotes.companyProfit', 'Ganancia de la empresa')}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <select className="field-input" style={{ width: 110 }} value={profitCalcType} onChange={(e) => setProfitCalcType(e.target.value)}>
                  <option value="fixed">{t('quotes.fixed', 'Fijo')}</option>
                  <option value="percent">%</option>
                </select>
                <input className="field-input mono" type="number" min="0" step="0.01" value={profitValue} onChange={(e) => setProfitValue(e.target.value)} placeholder={profitCalcType === 'percent' ? '%' : 'Q'} />
              </div>
            </div>
          </div>

          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', color: 'var(--muted)', marginBottom: 8 }}>
            {t('quotes.lines', 'LÍNEAS DE LA COTIZACIÓN')}
          </div>
          <div className="table-wrap" style={{ marginBottom: 16 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t('common.description', 'Descripción')}</th>
                  <th style={{ width: 90, textAlign: 'right' }}>{t('quotes.qty', 'Cant.')}</th>
                  <th style={{ width: 130, textAlign: 'right' }}>{t('quotes.unitPriceShort', 'P. Unit.')}</th>
                  <th style={{ width: 100, textAlign: 'right' }}>{t('common.discount', 'Desc. %')}</th>
                  <th style={{ width: 36 }} />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td><input className="field-input" value={item.description} onChange={(e) => setItem(item.id, 'description', e.target.value)} /></td>
                    <td><input className="field-input mono" type="number" min="0.001" step="0.001" style={{ textAlign: 'right' }} value={item.quantity} onChange={(e) => setItem(item.id, 'quantity', e.target.value)} /></td>
                    <td><input className="field-input mono" type="number" min="0" step="0.01" style={{ textAlign: 'right' }} value={item.unitPrice} onChange={(e) => setItem(item.id, 'unitPrice', e.target.value)} /></td>
                    <td><input className="field-input mono" type="number" min="0" max="100" step="0.01" style={{ textAlign: 'right' }} value={item.discount} onChange={(e) => setItem(item.id, 'discount', e.target.value)} /></td>
                    <td style={{ textAlign: 'right' }}>
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
