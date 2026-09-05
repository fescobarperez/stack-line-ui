// Stackline — Cuentas por Cobrar (CxC) · antigüedad de saldos
// Data-driven: /api/receivables/aging (hook useAging) + /api/payments (usePayments).
import React, { useState } from 'react';
import Icon from '../components/Icon.jsx';
import { useAging, usePayments } from '../hooks/useOperations.js';
import { createPayment } from '../api/receivables.js';
import { useTranslation } from 'react-i18next';

const Q = (v) => `Q ${Number(v || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const BUCKET_ORDER = ['current', '1-30', '31-60', '61-90', '90+'];
const BUCKET_CLASS = { current: 'success', '1-30': 'warning', '31-60': 'warning', '61-90': 'danger', '90+': 'danger' };
const BUCKET_LABEL = { current: 'Por vencer', '1-30': '1–30 días', '31-60': '31–60 días', '61-90': '61–90 días', '90+': '90+ días' };
const STATUS_LABEL = { open: 'Abierta', partial: 'Parcial', overdue: 'Vencida' };
const STATUS_CLASS = { open: 'info', partial: 'warning', overdue: 'danger' };

const invStatus = (i) => (i.daysOverdue > 0 ? 'overdue' : Number(i.paid) > 0 ? 'partial' : 'open');

export default function CxC({ pushToast }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState('aging');
  const [search, setSearch] = useState('');
  const [payModal, setPayModal] = useState(null); // invoice
  const [payForm, setPayForm] = useState({ amount: '', method: 'efectivo', reference: '' });

  const { data: aging, source, reload: reloadAging } = useAging();
  const { items: payments, reload: reloadPayments } = usePayments();

  const summary = {};
  (aging.summary || []).forEach((b) => { summary[b.bucket] = b; });
  const invoices = aging.invoices || [];
  const clientAging = aging.byClient || [];

  const filtered = invoices.filter((i) =>
    !search || i.clientName?.toLowerCase().includes(search.toLowerCase()) || (i.docNumber || '').includes(search));

  const cobrado = payments.reduce((s, p) => s + Number(p.amount || 0), 0);

  async function submitPayment() {
    const amt = parseFloat(payForm.amount);
    if (!amt || amt <= 0) { pushToast('Ingresa un monto válido', 'error'); return; }
    try {
      await createPayment({
        clientId: payModal.clientId, saleId: payModal.saleId, amount: amt,
        method: payForm.method, reference: payForm.reference || null,
        paymentDate: new Date().toISOString().slice(0, 10),
      });
      await Promise.all([reloadAging(), reloadPayments()]);
      pushToast(`Abono de ${Q(amt)} registrado`, 'success');
      setPayModal(null);
      setPayForm({ amount: '', method: 'efectivo', reference: '' });
    } catch (err) {
      pushToast('No se pudo registrar el abono: ' + err.message, 'error');
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('cxc.title', 'Cuentas por Cobrar')}</h1>
          <div className="page-subtitle">
            Cartera de crédito · antigüedad · cobros
            {source === 'mock' && <span className="pill" style={{ marginLeft: 8, fontSize: 10 }}>demo</span>}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <div className="stat">
          <div className="label"><Icon name="card" size={11} />Total CxC</div>
          <div className="val mono">{Q(aging.totalReceivable)}</div>
          <div className="delta muted">{aging.openCount} documentos abiertos</div>
        </div>
        <div className="stat">
          <div className="label"><Icon name="alert" size={11} />Cartera vencida</div>
          <div className="val mono" style={{ color: 'var(--danger)' }}>{Q(aging.overdue)}</div>
          <div className="delta muted">Saldo con plazo expirado</div>
        </div>
        <div className="stat">
          <div className="label"><Icon name="clock" size={11} />Crítico (+60 días)</div>
          <div className="val mono" style={{ color: aging.criticalCount > 0 ? 'var(--danger)' : undefined }}>{aging.criticalCount}</div>
          <div className="delta muted">Documentos en riesgo</div>
        </div>
        <div className="stat">
          <div className="label"><Icon name="cash" size={11} />Cobrado</div>
          <div className="val mono" style={{ color: 'var(--success)' }}>{Q(cobrado)}</div>
          <div className="delta muted">Abonos registrados</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {[['aging', 'Antigüedad por cliente'], ['invoices', 'Documentos'], ['payments', 'Cobros registrados']].map(([id, label]) => (
          <button key={id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === 'aging' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 24 }}>
            {BUCKET_ORDER.map((b) => (
              <div key={b} className="card" style={{ padding: '14px 16px', borderTop: `3px solid var(--${BUCKET_CLASS[b]})` }}>
                <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>{BUCKET_LABEL[b]}</div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{Q(summary[b]?.total || 0)}</div>
                <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{summary[b]?.count || 0} doc.</div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="tbl-wrap"><table className="mtable">
              <thead>
                <tr>
                  <th>{t('common.client', 'Cliente')}</th>
                  {BUCKET_ORDER.map((b) => <th key={b} style={{ textAlign: 'right' }}>{BUCKET_LABEL[b]}</th>)}
                  <th style={{ textAlign: 'right' }}>{t('common.total', 'Total')}</th>
                </tr>
              </thead>
              <tbody>
                {clientAging.length === 0 && <tr><td colSpan={7}><div className="empty" style={{ padding: 24 }}>Sin saldos por cobrar</div></td></tr>}
                {clientAging.map((row) => (
                  <tr key={row.clientId}>
                    <td style={{ fontWeight: 600, fontSize: 13 }}>{row.clientName}</td>
                    {BUCKET_ORDER.map((b) => (
                      <td key={b} style={{ textAlign: 'right', fontSize: 13 }}>
                        {row.buckets?.[b]
                          ? <span style={{ color: b === 'current' ? 'inherit' : `var(--${BUCKET_CLASS[b]})`, fontWeight: b !== 'current' ? 600 : 400 }}>{Q(row.buckets[b])}</span>
                          : <span className="muted">—</span>}
                      </td>
                    ))}
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{Q(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        </>
      )}

      {tab === 'invoices' && (
        <>
          <div className="filterbar">
            <div className="search-wrap" style={{ flex: 1, maxWidth: 320 }}>
              <Icon name="search" className="icon" size={13} />
              <input className="search-input" placeholder={t('cxc.searchPlaceholder', 'Buscar cliente o documento…')} value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="tbl-wrap"><table className="mtable">
              <thead>
                <tr>
                  <th>Documento</th><th>{t('common.client', 'Cliente')}</th><th>{t('common.date', 'Fecha')}</th>
                  <th>Vencimiento</th><th style={{ textAlign: 'right' }}>{t('common.amount', 'Monto')}</th>
                  <th style={{ textAlign: 'right' }}>Pendiente</th><th>Antigüedad</th><th>{t('common.status', 'Estado')}</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0
                  ? <tr><td colSpan={9}><div className="empty" style={{ padding: 24 }}>Sin documentos</div></td></tr>
                  : filtered.map((inv) => {
                    const st = invStatus(inv);
                    return (
                      <tr key={inv.saleId}>
                        <td><span className="mono" style={{ fontSize: 12 }}>{inv.docNumber}</span></td>
                        <td style={{ fontSize: 13 }}>{inv.clientName}</td>
                        <td className="muted" style={{ fontSize: 12 }}>{inv.saleDate}</td>
                        <td style={{ fontSize: 12, color: inv.daysOverdue > 0 ? 'var(--danger)' : 'inherit' }}>{inv.dueDate}</td>
                        <td style={{ textAlign: 'right', fontSize: 13 }}>{Q(inv.amount)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 13 }}>{Q(inv.outstanding)}</td>
                        <td><span className={`pill ${BUCKET_CLASS[inv.bucket]}`} style={{ fontSize: 9 }}>{inv.bucket === 'current' ? 'Al día' : `${inv.bucket} días`}</span></td>
                        <td><span className={`pill ${STATUS_CLASS[st]}`} style={{ fontSize: 9 }}>{STATUS_LABEL[st]}</span></td>
                        <td>
                          <button className="btn" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => setPayModal(inv)}>Cobrar</button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table></div>
          </div>
        </>
      )}

      {tab === 'payments' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="tbl-wrap"><table className="mtable">
            <thead>
              <tr>
                <th>{t('common.date', 'Fecha')}</th><th>{t('common.client', 'Cliente')}</th>
                <th>Método</th><th>Referencia</th><th style={{ textAlign: 'right' }}>{t('common.amount', 'Monto')}</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 && <tr><td colSpan={5}><div className="empty" style={{ padding: 24 }}>Sin cobros registrados</div></td></tr>}
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="mono" style={{ fontSize: 12 }}>{p.paymentDate || p.date}</td>
                  <td style={{ fontSize: 13 }}>{p.clientName || p.clientId}</td>
                  <td><span className="pill">{p.method || p.paymentMethod}</span></td>
                  <td className="muted" style={{ fontSize: 12 }}>{p.reference || '—'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{Q(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      {/* Modal de abono */}
      {payModal && (
        <div className="modal-overlay" onClick={() => setPayModal(null)}>
          <div className="modal" style={{ width: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Registrar cobro · {payModal.docNumber}</h3>
              <button className="icon-btn" onClick={() => setPayModal(null)}><Icon name="x" /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="muted" style={{ fontSize: 12 }}>
                {payModal.clientName} · pendiente <strong>{Q(payModal.outstanding)}</strong>
              </div>
              <div className="field">
                <label>Monto del abono</label>
                <input type="number" min="0" step="0.01" placeholder="0.00" value={payForm.amount}
                  onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))} autoFocus />
              </div>
              <div className="field">
                <label>Método</label>
                <select value={payForm.method} onChange={(e) => setPayForm((f) => ({ ...f, method: e.target.value }))}>
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="cheque">Cheque</option>
                  <option value="tarjeta">Tarjeta</option>
                </select>
              </div>
              <div className="field">
                <label>Referencia (opcional)</label>
                <input value={payForm.reference} onChange={(e) => setPayForm((f) => ({ ...f, reference: e.target.value }))} />
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setPayModal(null)}>{t('common.cancel', 'Cancelar')}</button>
              <button className="btn accent" onClick={submitPayment}><Icon name="check" size={13} />Registrar abono</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
