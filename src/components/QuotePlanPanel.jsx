// Plan de pagos y cobros de la cotización (modelo cotización-céntrico).
// Muestra las cuotas del plan (monto + fecha límite), permite agregarlas y
// eliminarlas, lista los cobros reales imputados a la cotización y permite
// registrar un cobro contra ella (payments.quote_id).
//
// El plan se arma en dos modos. Manual es el de siempre: una cuota a la vez.
// Automático reparte el total en N cuotas con sus fechas y reemplaza lo que
// hubiera. Automático se cierra en cuanto hay un cobro: regenerar borraría las
// cuotas contra las que alguien ya pagó.
import React, { useEffect, useState, useCallback } from 'react';
import Autocomplete from './Autocomplete.jsx';
import DatePicker from './DatePicker.jsx';
import Button from './Button.jsx';
import Icon from './Icon.jsx';
import { getQuotePlan, getQuoteCharges, addQuotePaymentTerm, deleteQuotePaymentTerm, generateQuotePlan } from '../api/wave2.js';
import { createPayment } from '../api/receivables.js';
import { useTranslation } from 'react-i18next';
import { useTaxRate } from '../hooks/useOperations.js';

const Q = (n) => `Q ${Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function QuotePlanPanel({ quote, canEdit = true, pushToast, onPlanBalanceChange, chargesVersion = 0 }) {
  const { t } = useTranslation();
  const tasaEmpresa = useTaxRate();
  const quoteId = quote.backendId;
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [term, setTerm] = useState({ amount: '', dueDate: '', notes: '' });
  const [modo, setModo] = useState(null);   // null hasta saber si ya hay cuotas
  const [auto, setAuto] = useState({
    installments: '3',
    frequency: 'mensual',
    everyDays: '30',
    startDate: new Date().toISOString().slice(0, 10),
    advanceCalcType: 'percent',
    advanceValue: '',
  });
  const setA = (k, v) => setAuto((f) => ({ ...f, [k]: v }));
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
  const taxRate = Number(quote.taxRate ?? tasaEmpresa);
  const fallbackQuoteTotal = taxableSubtotal * (1 + taxRate / 100);
  const quoteTotal = apiQuoteTotal > 0 ? apiQuoteTotal : fallbackQuoteTotal;
  const planTotal = Number(plan?.planTotal || 0);
  // Con un cobro imputado ya no se regenera: el backend también lo rechaza.
  const hayCobros = Number(plan?.collected || 0) > 0;
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

  // Una cotización nueva no tiene cuotas y el modo útil es el automático; si ya
  // hay plan, se respeta lo que haya sin ofrecer borrarlo de entrada.
  useEffect(() => {
    if (!plan) return;
    if (modo === null) { setModo((plan.terms || []).length ? 'manual' : 'auto'); return; }
    // Si se registra un cobro con el modo automático abierto, el formulario se
    // queda ofreciendo un botón que el backend ya va a rechazar.
    if (hayCobros && modo === 'auto') setModo('manual');
  }, [plan, modo, hayCobros]);

  const generar = async () => {
    const cuotas = parseInt(auto.installments, 10);
    if (!(cuotas >= 1)) { pushToast?.(t('quotes.autoCountRequired', 'Indica cuántas cuotas quieres generar'), 'danger'); return; }
    setBusy(true);
    try {
      const next = await generateQuotePlan(quoteId, {
        installments: cuotas,
        frequency: auto.startDate ? auto.frequency : null,
        everyDays: auto.frequency === 'dias' ? parseInt(auto.everyDays, 10) || null : null,
        startDate: auto.startDate || null,
        advanceCalcType: auto.advanceCalcType,
        advanceValue: parseFloat(auto.advanceValue) > 0 ? parseFloat(auto.advanceValue) : null,
      });
      setPlan({ ...next, manualChargesTotal });
      pushToast?.(t('quotes.planGenerated', 'Plan de cobro generado'), 'success');
    } catch (err) {
      pushToast?.(t('quotes.planGenerateFailed', 'No se pudo generar el plan: ') + err.message, 'danger');
    } finally { setBusy(false); }
  };

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
          <div>
            <div className="quote-subsection-title">{t('quotes.paymentPlan', 'Plan de pagos')}</div>
            <div className="quote-subsection-description">{t('quotes.paymentPlanHint', 'Define las cuotas y sus fechas límite')}</div>
          </div>
          {canEdit && (
            <div className="segmented plan-modo">
              <button type="button" className={`seg ${modo === 'manual' ? 'sel' : ''}`} onClick={() => setModo('manual')}>
                {t('quotes.planManual', 'Manual')}
              </button>
              <button type="button"
                className={`seg ${modo === 'auto' ? 'sel' : ''}`}
                onClick={() => setModo('auto')}
                disabled={hayCobros}
                title={hayCobros ? t('quotes.planAutoBlocked', 'La cotización ya tiene cobros: el plan no se puede regenerar') : undefined}>
                {t('quotes.planAuto', 'Automático')}
              </button>
            </div>
          )}
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
          {canEdit && hayCobros && (
            <div className="cfg-hint" style={{ marginBottom: 12 }}>
              {t('quotes.planAutoBlockedHint', 'Esta cotización ya tiene cobros registrados, así que el plan solo se puede ajustar a mano: regenerarlo borraría las cuotas contra las que ya se pagó.')}
            </div>
          )}

          {canEdit && modo === 'auto' && (
            <div className="plan-auto">
              <div className="plan-auto-row">
                <div className="field-group" style={{ width: 110 }}>
                  <label className="field-label">{t('quotes.autoCount', 'Cuotas')}</label>
                  <input className="field-input mono" type="number" min="1" step="1"
                    value={auto.installments} onChange={(e) => setA('installments', e.target.value)} />
                </div>
                <div className="field-group" style={{ width: 150 }}>
                  <label className="field-label">{t('quotes.autoStart', 'Primera fecha')}</label>
                  <DatePicker value={auto.startDate} onChange={(iso) => setA('startDate', iso)}
                    aria-label={t('quotes.autoStart', 'Primera fecha')} />
                </div>
                <div className="field-group" style={{ width: 150 }}>
                  <label className="field-label">{t('quotes.autoFrequency', 'Frecuencia')}</label>
                  <Autocomplete value={auto.frequency}
                    onChange={(id) => setA('frequency', id == null ? '' : String(id))}
                    options={[{ id: 'mensual', name: t('quotes.freqMonthly', 'Mensual') }, { id: 'quincenal', name: t('quotes.freqBiweekly', 'Quincenal') }, { id: 'semanal', name: t('quotes.freqWeekly', 'Semanal') }, { id: 'dias', name: t('quotes.freqDays', 'Cada N días') }]}
                    allowClear={false}
                    emptyText="Sin coincidencias"
                    aria-label="Frecuencia" />
                </div>
                {auto.frequency === 'dias' && (
                  <div className="field-group" style={{ width: 100 }}>
                    <label className="field-label">{t('quotes.autoEveryDays', 'Días')}</label>
                    <input className="field-input mono" type="number" min="1" step="1"
                      disabled={!auto.startDate}
                      value={auto.everyDays} onChange={(e) => setA('everyDays', e.target.value)} />
                  </div>
                )}
              </div>

              <div className="plan-auto-row">
                <div className="field-group" style={{ width: 150 }}>
                  <label className="field-label">{t('quotes.autoAdvanceType', 'Anticipo (opcional)')}</label>
                  <Autocomplete value={auto.advanceCalcType}
                    onChange={(id) => setA('advanceCalcType', id == null ? '' : String(id))}
                    options={[{ id: 'percent', name: t('quotes.advancePercent', 'Porcentaje') }, { id: 'fixed', name: t('quotes.advanceFixed', 'Monto fijo') }]}
                    allowClear={false}
                    emptyText="Sin coincidencias"
                    aria-label="Anticipo" />
                </div>
                <div className="field-group" style={{ width: 120 }}>
                  <label className="field-label">{auto.advanceCalcType === 'percent' ? '%' : 'Q'}</label>
                  <input className="field-input mono" type="number" min="0" step="0.01"
                    placeholder={auto.advanceCalcType === 'percent' ? '50' : '0.00'}
                    value={auto.advanceValue} onChange={(e) => setA('advanceValue', e.target.value)} />
                </div>
                <Button icon="check" variant="accent" onClick={generar} disabled={busy}>
                  {t('quotes.generatePlan', 'Generar plan')}
                </Button>
              </div>

              <div className="cfg-hint">
                {(plan.terms || []).length > 0 && (
                  <b>{t('quotes.autoReplaces', 'Se reemplazarán las cuotas actuales. ')}</b>
                )}
                {!auto.startDate
                  ? t('quotes.autoNoDates', 'Sin primera fecha las cuotas se generan sin fecha límite.')
                  : t('quotes.autoWithDates', 'La primera fecha es la del anticipo si lo hay; si no, la de la primera cuota.')}
                {' '}
                {t('quotes.autoRounding', 'El residuo del redondeo se carga a la primera cuota para que el plan cuadre exacto con el total.')}
              </div>
            </div>
          )}

          {canEdit && modo === 'manual' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap' }}>
              <div className="field-group" style={{ width: 120 }}>
            <label className="field-label">{t('projects.amount', 'Monto')}</label>
            <input className="field-input mono" type="number" min="0" max={Math.max(remaining, 0)} step="0.01" value={term.amount} onChange={(e) => setT('amount', e.target.value)} />
          </div>
          <div className="field-group" style={{ width: 150 }}>
            <label className="field-label">{t('quotes.dueDate', 'Fecha límite')}</label>
            <DatePicker value={term.dueDate} onChange={(iso) => setT('dueDate', iso)}
              aria-label={t('quotes.dueDate', 'Fecha límite')} />
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
            <Autocomplete value={pay.method}
              onChange={(id) => setP('method', id == null ? '' : String(id))}
              options={[{ id: 'efectivo', name: 'Efectivo' }, { id: 'transferencia', name: 'Transferencia' }, { id: 'deposito', name: 'Depósito' }, { id: 'cheque', name: 'Cheque' }, { id: 'tarjeta', name: 'Tarjeta' }]}
              allowClear={false}
              emptyText="Sin coincidencias"
              aria-label="Método" />
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
