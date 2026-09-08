// Stackline — Cuentas por Cobrar (CxC) · antigüedad de saldos
// Data-driven: /api/receivables/aging (hook useAging) + /api/payments (usePayments).
import React, { useState, useEffect } from 'react';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import StatCard from '../components/StatCard.jsx';
import { useAging, usePayments, useBankAccounts } from '../hooks/useOperations.js';
import { useAccounts } from '../hooks/useAccounting.js';
import { createPayment } from '../api/receivables.js';
import { printReceipt } from '../lib/receipt.js';
import { useTranslation } from 'react-i18next';

const Q = (v) => `Q ${Number(v || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const BUCKET_ORDER = ['current', '1-30', '31-60', '61-90', '90+'];
// Debe coincidir con BANK_METHODS de PaymentService: efectivo va a la caja y
// la tarjeta liquida después, por una vía que este cobro no conoce.
const NEEDS_BANK = new Set(['transferencia', 'deposito']);
// Efectivo y cheque entran a una cuenta de caja (detalle, saldo débito).
const CASH_METHODS = new Set(['efectivo', 'cheque']);
const isCashAccount = (a) => a.allowsEntries && a.normalBalance === 'debit';
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
  const { items: BANK_ACCOUNTS } = useBankAccounts();
  const { items: ACCOUNTS } = useAccounts();
  const CASH_ACCOUNTS = (ACCOUNTS || []).filter(isCashAccount);
  const [payForm, setPayForm] = useState({ amount: '', method: 'efectivo', reference: '', bankAccountId: '', cashAccountId: '' });

  // Autoselección de la caja: 110101 (Caja) si existe, si no la primera cuenta
  // de detalle de activo. Funciona sin intervención pero deja cambiarla.
  useEffect(() => {
    if (!payModal || !CASH_METHODS.has(payForm.method)) return;
    if (payForm.cashAccountId) return;
    if (!CASH_ACCOUNTS.length) return;
    const preferida = CASH_ACCOUNTS.find((a) => a.code === '110101') || CASH_ACCOUNTS[0];
    setPayForm((f) => ({ ...f, cashAccountId: String(preferida.id) }));
  }, [payModal, payForm.method, payForm.cashAccountId, CASH_ACCOUNTS]);

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
    if (!amt || amt <= 0) { pushToast('Ingresa un monto válido', 'danger'); return; }
    try {
      await createPayment({
        clientId: payModal.clientId, saleId: payModal.saleId, amount: amt,
        method: payForm.method, reference: payForm.reference || null,
        bankAccountId: payForm.bankAccountId ? Number(payForm.bankAccountId) : null,
        cashAccountId: payForm.cashAccountId ? Number(payForm.cashAccountId) : null,
        paymentDate: new Date().toISOString().slice(0, 10),
      });
      await Promise.all([reloadAging(), reloadPayments()]);
      pushToast(`Abono de ${Q(amt)} registrado`, 'success');
      setPayModal(null);
      setPayForm({ amount: '', method: 'efectivo', reference: '', bankAccountId: '', cashAccountId: '' });
    } catch (err) {
      pushToast('No se pudo registrar el abono: ' + err.message, 'danger');
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('cxc.title', 'Cuentas por Cobrar')}</h1>
          <div className="page-subtitle">
            Cartera de crédito · antigüedad · cobros
            {source === 'mock' && <span className="badge-m3" style={{ marginLeft: 8 }}>demo</span>}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <StatCard
          icon="card" tone="pri"
          label="Total CxC"
          value={Q(aging.totalReceivable)}
          foot={<>{aging.openCount} documentos abiertos</>}
        />
        <StatCard
          icon="alert" tone="ter"
          label="Cartera vencida"
          valueColor={'var(--danger)'}
          value={Q(aging.overdue)}
          foot="Saldo con plazo expirado"
        />
        <StatCard
          icon="clock" tone="sec"
          label="Crítico (+60 días)"
          valueColor={aging.criticalCount > 0 ? 'var(--danger)' : undefined}
          value={aging.criticalCount}
          foot="Documentos en riesgo"
        />
        <StatCard
          icon="cash" tone="err"
          label="Cobrado"
          valueColor={'var(--success)'}
          value={Q(cobrado)}
          foot="Abonos registrados"
        />
        {/* Los anticipos NO se restan del total: uno es lo que te deben, el otro
            dinero del cliente que tienes. Netearlos en un solo número escondería
            las dos cosas. `netReceivable` es la diferencia y cuadra con el saldo
            de Clientes; se muestra al pie para que se vea de dónde sale. */}
        <StatCard
          icon="card" tone="sec"
          label="Anticipos a cuenta"
          value={Q(aging.unapplied)}
          foot={<>Neto por cobrar {Q(aging.netReceivable)}</>}
        />
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
                <div style={{ fontWeight: 400, fontSize: 22 }}>{Q(summary[b]?.total || 0)}</div>
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
                    <td style={{ fontWeight: 500 }}>{row.clientName}</td>
                    {BUCKET_ORDER.map((b) => (
                      <td key={b} style={{ textAlign: 'right' }}>
                        {row.buckets?.[b]
                          ? <span style={{ color: b === 'current' ? 'inherit' : `var(--${BUCKET_CLASS[b]})`, fontWeight: b !== 'current' ? 600 : 400 }}>{Q(row.buckets[b])}</span>
                          : <span className="muted">—</span>}
                      </td>
                    ))}
                    <td style={{ textAlign: 'right', fontWeight: 500 }}>{Q(row.total)}</td>
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
                        <td>{inv.clientName}</td>
                        <td className="muted">{inv.saleDate}</td>
                        <td style={{ color: inv.daysOverdue> 0 ? 'var(--danger)' : 'inherit' }}>{inv.dueDate}</td>
                        <td style={{ textAlign: 'right' }}>{Q(inv.amount)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 500 }}>{Q(inv.outstanding)}</td>
                        <td><span className={`badge-m3 ${BUCKET_CLASS[inv.bucket]}`}>{inv.bucket === 'current' ? 'Al día' : `${inv.bucket} días`}</span></td>
                        <td><span className={`badge-m3 ${STATUS_CLASS[st]}`}>{STATUS_LABEL[st]}</span></td>
                        <td>
                          <Button size="sm" onClick={() => setPayModal(inv)}>Cobrar</Button>
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
                <th>{t('cxc.receipt', 'Recibo')}</th>
                <th>{t('common.date', 'Fecha')}</th><th>{t('common.client', 'Cliente')}</th>
                <th>Método</th><th>Referencia</th><th style={{ textAlign: 'right' }}>{t('common.amount', 'Monto')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 && <tr><td colSpan={7}><div className="empty" style={{ padding: 24 }}>Sin cobros registrados</div></td></tr>}
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="mono">{p.receiptNumber || '—'}</td>
                  <td className="mono">{p.paymentDate || p.date}</td>
                  <td>{p.clientName || p.clientId}</td>
                  <td><span className="badge-m3">{p.method || p.paymentMethod}</span></td>
                  <td className="muted">{p.reference || '—'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 500 }}>{Q(p.amount)}</td>
                  {/* El reloj distingue el recibo ya entregado del que nunca se
                      imprimió: reimprimir se permite, pero conviene saberlo. */}
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {p.receiptPrintedAt && (
                      <Icon name="clock" size={14}
                        title={t('cxc.printedAt', 'Ya impreso')}
                        style={{ opacity: .45, marginRight: 4, verticalAlign: 'middle' }} />
                    )}
                    <Button variant="icon" icon="print"
                      title={t('cxc.printReceipt', 'Imprimir recibo')}
                      onClick={() => printReceipt(p)} />
                  </td>
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
                  <option value="deposito">Depósito</option>
                  <option value="cheque">Cheque</option>
                  <option value="tarjeta">Tarjeta</option>
                </select>
              </div>
              {/* Solo cuando el dinero entra a un banco. El backend lo exige
                  para esos métodos: sin cuenta, el cobro baja CxC pero no
                  aparece en ningún extracto y la conciliación no cuadra. */}
              {NEEDS_BANK.has(payForm.method) && (
                <div className="field">
                  <label>Cuenta bancaria *</label>
                  <select value={payForm.bankAccountId}
                    onChange={(e) => setPayForm((f) => ({ ...f, bankAccountId: e.target.value }))}>
                    <option value="">Seleccionar…</option>
                    {BANK_ACCOUNTS.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.bankName || a.accountCode} · {a.accountNumber || a.alias} ({a.currency})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {/* Efectivo y cheque entran a una cuenta de caja. Elegir cuál
                  resuelve el error 'posting.cash' sin ir a Configuración. */}
              {CASH_METHODS.has(payForm.method) && (
                <div className="field">
                  <label>Cuenta de caja</label>
                  {CASH_ACCOUNTS.length > 0 ? (
                    <select value={payForm.cashAccountId}
                      onChange={(e) => setPayForm((f) => ({ ...f, cashAccountId: e.target.value }))}>
                      {CASH_ACCOUNTS.map((a) => (
                        <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="muted" style={{ fontSize: 12, color: 'var(--danger)' }}>
                      No hay cuentas de caja de detalle. Crea una cuenta de activo (débito) en Contabilidad.
                    </div>
                  )}
                </div>
              )}
              <div className="field">
                <label>Referencia (opcional)</label>
                <input value={payForm.reference} onChange={(e) => setPayForm((f) => ({ ...f, reference: e.target.value }))} />
              </div>
            </div>
            <div className="modal-foot">
              <Button onClick={() => setPayModal(null)}>{t('common.cancel', 'Cancelar')}</Button>
              <Button icon="check" variant="accent" onClick={submitPayment}>Registrar abono</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
