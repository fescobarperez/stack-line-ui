// Plan de pagos y cobros de la cotización (modelo cotización-céntrico).
// Muestra las cuotas del plan (monto + fecha límite), permite agregarlas y
// eliminarlas, lista los cobros reales imputados a la cotización y permite
// registrar un cobro contra ella (payments.quote_id).
import React, { useEffect, useState, useCallback } from 'react';
import Button from './Button.jsx';
import Icon from './Icon.jsx';
import { getQuotePlan, getQuoteCharges, addQuotePaymentTerm, deleteQuotePaymentTerm } from '../api/wave2.js';
import { createPayment } from '../api/receivables.js';
import { useTranslation } from 'react-i18next';

const Q = (n) => `Q ${Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function QuotePlanPanel({ quote, canEdit = true, pushToast, onPlanBalanceChange, chargesVersion = 0 }) {
  const { t } = useTranslation();
  const quoteId = quote.backendId;
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [term, setTerm] = useState({ amount: '', dueDate: '', notes: '' });
  const [pay, setPay] = useState({ amount: '', method: 'efectivo', reference: '' });
  const setT = (k, v) => setTerm((f) => ({ ...f, [k]: v }));
  const setP = (k, v) => setPay((f) => ({ ...f, [k]: v }));

  // El total persistido es la fuente principal. Como respaldo para cotizaciones
  // creadas con versiones anteriores del backend, reconstruimos el total desde
  // sus líneas comerciales para no mostrar un falso "excede Q 0.00".
  const lineTotal = (quote.items || []).reduce((sum, item) => {
    const qty = Number(item.qty || 0);
    const unitPrice = Number(item.unitPrice || 0);
    const discount = Number(item.discount || 0);
    return sum + qty * unitPrice * (1 - discount / 100);
  }, 0);
  const persistedQuoteTotal = Number(quote.total || 0);
  const apiQuoteTotal = Number(plan?.quoteTotal || 0);
  const baseQuoteTotal = persistedQuoteTotal > 0 ? persistedQuoteTotal : lineTotal;
  const manualChargesTotal = Number(plan?.manualChargesTotal || 0);
  const taxableSubtotal = baseQuoteTotal + manualChargesTotal + Number(quote.profitAmount || 0);
  const taxRate = Number(quote.taxRate || 12);
  const fallbackQuoteTotal = taxableSubtotal * (1 + taxRate / 100);
  const quoteTotal = apiQuoteTotal > 0 ? apiQuoteTotal : fallbackQuoteTotal;
  const planTotal = Number(plan?.planTotal || 0);
  const remaining = quoteTotal - planTotal;
  const balanced = plan != null && Math.abs(remaining) < 0.005;

  useEffect(() => {
    if (plan) onPlanBalanceChange?.(balanced);
  }, [balanced, onPlanBalanceChange, plan]);

  const load = useCallback(async () => {
    void chargesVersion;
    void chargesVersion;
    setLoading(true);
    try {
      const [next, chargeSummary] = await Promise.all([
        getQuotePlan(quoteId),
        getQuoteCharges(quoteId),
      ]);
      const manualChargesTotal = Number(chargeSummary?.fixedTotal || 0) + Number(chargeSummary?.percentTotal || 0);
      setPlan({ ...next, manualChargesTotal });
    } catch (err) {
      onPlanBalanceChange?.(false);
      pushToast?.(t('quotes.planError', 'No se pudo cargar el plan: ') + err.message, 'danger');
    }
    finally { setLoading(false); }
  }, [chargesVersion, quoteId, onPlanBalanceChange, pushToast, t]);

  useEffect(() => { load(); }, [load]);

  const addTerm = async () => {
    const amount = parseFloat(term.amount);
    if (!(amount > 0)) { pushToast?.(t('quotes.termAmountRequired', 'Indica un monto mayor a cero'), 'danger'); return; }
    if (amount > remaining + 0.001) {
      pushToast?.(t('quotes.termExceedsTotal', 'La cuota excede el saldo disponible de la cotización: ') + Q(Math.max(remaining, 0)), 'danger');
      return;
    }
    setBusy(true);
    try {
      const next = await addQuotePaymentTerm(quoteId, { amount, dueDate: term.dueDate || null, notes: term.notes.trim() || null });
      setPlan({ ...next, manualChargesTotal });
      setTerm({ amount: '', dueDate: '', notes: '' });
    } catch (err) {
      pushToast?.(t('quotes.termAddFailed', 'No se pudo agregar la cuota: ') + err.message, 'danger');
    } finally { setBusy(false); }
  };

  const removeTerm = async (termId) => {
    setBusy(true);
    try {
      const next = await deleteQuotePaymentTerm(quoteId, termId);
      setPlan({ ...next, manualChargesTotal });
    }
    catch (err) { pushToast?.(t('quotes.termDelFailed', 'No se pudo eliminar la cuota: ') + err.message, 'danger'); }
    finally { setBusy(false); }
  };

  const registerPayment = async () => {
    const amount = parseFloat(pay.amount);
    if (!(amount > 0)) { pushToast?.(t('quotes.payAmountRequired', 'Indica un monto mayor a cero'), 'danger'); return; }
    if (!quote.clientId) { pushToast?.(t('quotes.payNoClient', 'La cotización no tiene cliente asociado'), 'danger'); return; }
    setBusy(true);
    try {
      await createPayment({
        clientId: quote.clientId,
        projectId: quote.projectId || null,
        quoteId,
        amount,
        paymentDate: new Date().toISOString().slice(0, 10),
        method: pay.method,
        reference: pay.reference || null,
      });
      pushToast?.(t('quotes.paymentAdded', 'Cobro registrado'), 'success');
      setPay({ amount: '', method: 'efectivo', reference: '' });
      await load();
    } catch (err) {
      pushToast?.(t('quotes.payFailed', 'No se pudo registrar el cobro: ') + err.message, 'danger');
    } finally { setBusy(false); }
  };

  if (loading) return <div className="muted" style={{ fontSize: 12, padding: '8px 0' }}>{t('common.loading', 'Cargando…')}</div>;
  if (!plan) return null;
  const balanceMessage = balanced
    ? t('quotes.planBalanced', 'Plan cuadrado con el total de la cotización')
    : remaining > 0.005
      ? t('quotes.planIncomplete', 'Al plan de pago le faltan ') + Q(remaining) + t('quotes.planIncompleteSuffix', ' para completar la cotización')
      : t('quotes.planOverTotal', 'El plan excede el total de la cotización por: ') + Q(Math.abs(remaining));

  return (
    <section className="quote-section quote-section--plan" style={{ marginTop: 24 }}>
      <div className="quote-section-heading">
        <div>
          <div className="quote-section-title">{t('quotes.paymentSection', 'Plan de cobro')}</div>
          <div className="quote-section-description">{t('quotes.paymentSectionHint', 'Cuotas, saldo pendiente y cobros registrados')}</div>
        </div>
      </div>

      <div className="quote-section-card quote-section-card--summary">
        <div className="quote-plan-summary">
          <span>{t('quotes.quoteTotal', 'Total cotización')}: <b>{Q(quoteTotal)}</b></span>
          <span>{t('quotes.planTotal', 'Plan')}: <b>{Q(planTotal)}</b></span>
          <span>{t('quotes.collected', 'Cobrado')}: <b style={{ color: 'var(--success)' }}>{Q(plan.collected)}</b></span>
          <span>{t('quotes.pending', 'Pendiente')}: <b style={{ color: plan.pending > 0 ? 'var(--danger)' : 'inherit' }}>{Q(plan.pending)}</b></span>
        </div>
        <div className="quote-plan-balance" style={{
          color: balanced ? 'var(--success)' : 'var(--danger)',
          background: balanced ? 'color-mix(in srgb, var(--success) 10%, transparent)' : 'color-mix(in srgb, var(--danger) 10%, transparent)' }}>
          {balanceMessage}
        </div>
      </div>

      <div className="quote-subsection quote-subsection--plan">
        <div className="quote-subsection-heading">
          <div className="quote-subsection-title">{t('quotes.paymentPlan', 'Plan de pagos')}</div>
          <div className="quote-subsection-description">{t('quotes.paymentPlanHint', 'Define las cuotas y sus fechas límite')}</div>
        </div>
        <div className="quote-subsection-card">
          <table className="data-table" style={{ width: '100%', fontSize: 12, marginBottom: 10 }}>
        <thead><tr>
          <th style={{ textAlign: 'left' }}>#</th>
          <th style={{ textAlign: 'right' }}>{t('projects.amount', 'Monto')}</th>
          <th style={{ textAlign: 'left' }}>{t('quotes.dueDate', 'Fecha límite')}</th>
          <th style={{ textAlign: 'left' }}>{t('common.notes', 'Notas')}</th>
          <th />
        </tr></thead>
        <tbody>
          {(plan.terms || []).length === 0 && <tr><td colSpan={5} className="muted">{t('quotes.noTerms', 'Sin cuotas todavía')}</td></tr>}
          {(plan.terms || []).map((tm) => (
            <tr key={tm.id}>
              <td>{tm.sequence}</td>
              <td className="num" style={{ textAlign: 'right' }}>{Q(tm.amount)}</td>
              <td>{tm.dueDate || <span className="muted">—</span>}</td>
              <td>{tm.notes || <span className="muted">—</span>}</td>
              <td style={{ textAlign: 'right' }}>{canEdit && <button className="icon-btn" onClick={() => removeTerm(tm.id)} disabled={busy}><Icon name="close" size={12} /></button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
          {canEdit && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap' }}>
              <div className="field-group" style={{ width: 120 }}>
            <label className="field-label">{t('projects.amount', 'Monto')}</label>
            <input className="field-input mono" type="number" min="0" max={Math.max(remaining, 0)} step="0.01" value={term.amount} onChange={(e) => setT('amount', e.target.value)} />
          </div>
          <div className="field-group" style={{ width: 150 }}>
            <label className="field-label">{t('quotes.dueDate', 'Fecha límite')}</label>
            <input className="field-input" type="date" value={term.dueDate} onChange={(e) => setT('dueDate', e.target.value)} />
          </div>
          <div className="field-group" style={{ flex: 1, minWidth: 140 }}>
            <label className="field-label">{t('common.notes', 'Notas')}</label>
            <input className="field-input" value={term.notes} placeholder={t('quotes.termNotesPh', 'Anticipo, contra entrega…')} onChange={(e) => setT('notes', e.target.value)} />
          </div>
          <Button icon="plus" onClick={addTerm} disabled={busy || balanced}>{t('quotes.addTerm', 'Agregar cuota')}</Button>
            </div>
          )}
        </div>
      </div>

      <div className="quote-subsection quote-subsection--payments">
        <div className="quote-subsection-heading">
          <div className="quote-subsection-title">{t('quotes.payments', 'Cobros')}</div>
          <div className="quote-subsection-description">{t('quotes.paymentsHint', 'Registra los pagos recibidos de este cliente')}</div>
        </div>
        <div className="quote-subsection-card">
          <table className="data-table" style={{ width: '100%', fontSize: 12, marginBottom: 10 }}>
        <thead><tr>
          <th style={{ textAlign: 'left' }}>{t('common.date', 'Fecha')}</th>
          <th style={{ textAlign: 'left' }}>{t('projects.method', 'Método')}</th>
          <th style={{ textAlign: 'left' }}>{t('quotes.reference', 'Referencia')}</th>
          <th style={{ textAlign: 'right' }}>{t('projects.amount', 'Monto')}</th>
        </tr></thead>
        <tbody>
          {(plan.payments || []).length === 0 && <tr><td colSpan={4} className="muted">{t('quotes.noPayments', 'Sin cobros todavía')}</td></tr>}
          {(plan.payments || []).map((p) => (
            <tr key={p.id}>
              <td>{p.paymentDate}</td>
              <td>{p.method || '—'}</td>
              <td>{p.reference || p.receiptNumber || '—'}</td>
              <td className="num" style={{ textAlign: 'right' }}>{Q(p.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
          {canEdit && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="field-group" style={{ width: 120 }}>
            <label className="field-label">{t('projects.amount', 'Monto')}</label>
            <input className="field-input mono" type="number" min="0" step="0.01" value={pay.amount} onChange={(e) => setP('amount', e.target.value)} />
          </div>
          <div className="field-group" style={{ width: 140 }}>
            <label className="field-label">{t('projects.method', 'Método')}</label>
            <select className="field-input" value={pay.method} onChange={(e) => setP('method', e.target.value)}>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="deposito">Depósito</option>
              <option value="cheque">Cheque</option>
              <option value="tarjeta">Tarjeta</option>
            </select>
          </div>
          <div className="field-group" style={{ flex: 1, minWidth: 140 }}>
            <label className="field-label">{t('quotes.reference', 'Referencia')}</label>
            <input className="field-input" value={pay.reference} onChange={(e) => setP('reference', e.target.value)} />
          </div>
          <Button icon="card" variant="accent" onClick={registerPayment} disabled={busy}>{t('quotes.registerPayment', 'Registrar cobro')}</Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
