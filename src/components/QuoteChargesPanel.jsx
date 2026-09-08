// Gastos / cargos de la cotización (modelo cotización-céntrico).
// Muestra el gasto de materiales (auto, derivado de las líneas) + los cargos
// manuales (fixed / percent sobre el subtotal de costo), y permite agregarlos
// y eliminarlos. Cada operación devuelve el resumen recalculado del backend.
import React, { useEffect, useState, useCallback } from 'react';
import Button from './Button.jsx';
import Icon from './Icon.jsx';
import { getQuoteCharges, addQuoteCharge, deleteQuoteCharge } from '../api/wave2.js';
import { useTranslation } from 'react-i18next';

const Q = (n) => `Q ${Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function QuoteChargesPanel({ quoteId, canEdit = true, pushToast, onChargesChange, onSummaryChange }) {
  const { t } = useTranslation();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ calcType: 'fixed', category: '', description: '', value: '' });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await getQuoteCharges(quoteId);
      setSummary(next);
      onSummaryChange?.(next);
    }
    catch (err) { pushToast?.(t('quotes.chargesError', 'No se pudieron cargar los gastos: ') + err.message, 'danger'); }
    finally { setLoading(false); }
  }, [onSummaryChange, quoteId, pushToast, t]);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    const value = parseFloat(form.value);
    if (!form.description.trim()) { pushToast?.(t('quotes.chargeDescRequired', 'Indica una descripción'), 'danger'); return; }
    if (!(value >= 0)) { pushToast?.(t('quotes.chargeValueRequired', 'Indica un valor válido'), 'danger'); return; }
    setBusy(true);
    try {
      const res = await addQuoteCharge(quoteId, {
        calcType: form.calcType,
        category: form.category.trim() || null,
        description: form.description.trim(),
        value,
      });
      setSummary(res);
      onChargesChange?.();
      onSummaryChange?.(res);
      setForm({ calcType: 'fixed', category: '', description: '', value: '' });
    } catch (err) {
      pushToast?.(t('quotes.chargeAddFailed', 'No se pudo agregar el gasto: ') + err.message, 'danger');
    } finally { setBusy(false); }
  };

  const remove = async (chargeId) => {
    setBusy(true);
    try {
      const next = await deleteQuoteCharge(quoteId, chargeId);
      setSummary(next);
      onSummaryChange?.(next);
      onChargesChange?.();
    }
    catch (err) { pushToast?.(t('quotes.chargeDelFailed', 'No se pudo eliminar el gasto: ') + err.message, 'danger'); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="muted" style={{ fontSize: 12, padding: '8px 0' }}>{t('common.loading', 'Cargando…')}</div>;
  if (!summary) return null;

  return (
    <div className="quote-subsection quote-subsection--charges" style={{ marginTop: 16 }}>
      <div className="quote-subsection-heading">
        <div className="quote-subsection-title">{t('quotes.charges', 'Gastos / cargos')}</div>
        <div className="quote-subsection-description">{t('quotes.chargesHint', 'Materiales derivados y cargos adicionales')}</div>
      </div>
      <div className="quote-subsection-card">
        <table className="data-table" style={{ width: '100%', fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>{t('quotes.chargeType', 'Tipo')}</th>
            <th style={{ textAlign: 'left' }}>{t('common.description', 'Descripción')}</th>
            <th style={{ textAlign: 'left' }}>{t('quotes.chargeCalc', 'Cálculo')}</th>
            <th style={{ textAlign: 'right' }}>{t('projects.amount', 'Monto')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {/* Gasto de materiales: derivado, no editable ni eliminable. */}
          <tr>
            <td><span className="badge-m3 success"><Icon name="box" size={13} /> {t('quotes.materials', 'Materiales')}</span></td>
            <td className="muted">{t('quotes.materialsAuto', 'Auto desde líneas')}</td>
            <td className="muted">{t('quotes.derived', 'derivado')}</td>
            <td className="num" style={{ textAlign: 'right' }}>{Q(summary.materialsCost)}</td>
            <td />
          </tr>
          {(summary.charges || []).map((c) => (
            <tr key={c.id}>
              <td>{c.category || <span className="muted">{t('quotes.manual', 'Manual')}</span>}</td>
              <td>{c.description}</td>
              <td>{c.calcType === 'percent'
                ? <span>{Number(c.value)}% <span className="muted">/ {t('quotes.overSubtotal', 'subtotal')}</span></span>
                : <span className="muted">{t('quotes.fixed', 'fijo')}</span>}</td>
              <td className="num" style={{ textAlign: 'right' }}>{Q(c.computedAmount)}</td>
              <td style={{ textAlign: 'right' }}>
                {canEdit && <button className="icon-btn" onClick={() => remove(c.id)} disabled={busy} aria-label="Eliminar gasto"><Icon name="close" size={12} /></button>}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: '1px solid var(--border)' }}>
            <td colSpan={3} className="muted">{t('quotes.subtotalCost', 'Subtotal de costo')}</td>
            <td className="num" style={{ textAlign: 'right' }}>{Q(summary.subtotalCost)}</td>
            <td />
          </tr>
          <tr style={{ fontWeight: 600 }}>
            <td colSpan={3}>{t('common.total', 'Total')}</td>
            <td className="num" style={{ textAlign: 'right' }}>{Q(summary.total)}</td>
            <td />
          </tr>
        </tfoot>
      </table>

        {canEdit && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 10, flexWrap: 'wrap' }}>
            <div className="field-group" style={{ width: 120 }}>
            <label className="field-label">{t('quotes.chargeType', 'Tipo')}</label>
            <select className="field-input" value={form.calcType} onChange={(e) => set('calcType', e.target.value)}>
              <option value="fixed">{t('quotes.fixed', 'Fijo')}</option>
              <option value="percent">{t('quotes.percent', 'Porcentaje')}</option>
            </select>
          </div>
          <div className="field-group" style={{ width: 140 }}>
            <label className="field-label">{t('quotes.category', 'Categoría')}</label>
            <input className="field-input" value={form.category} placeholder={t('quotes.categoryPh', 'Mano de obra…')}
              onChange={(e) => set('category', e.target.value)} />
          </div>
          <div className="field-group" style={{ flex: 1, minWidth: 160 }}>
            <label className="field-label">{t('common.description', 'Descripción')}</label>
            <input className="field-input" value={form.description} placeholder={t('quotes.chargeDescPh', 'Descripción del gasto')}
              onChange={(e) => set('description', e.target.value)} />
          </div>
          <div className="field-group" style={{ width: 110 }}>
            <label className="field-label">{form.calcType === 'percent' ? '%' : t('quotes.value', 'Valor')}</label>
            <input className="field-input mono" type="number" min="0" step="0.01" value={form.value}
              onChange={(e) => set('value', e.target.value)} />
          </div>
            <Button icon="plus" variant="accent" onClick={add} disabled={busy}>{t('quotes.addCharge', 'Agregar gasto')}</Button>
          </div>
        )}
      </div>
    </div>
  );
}
