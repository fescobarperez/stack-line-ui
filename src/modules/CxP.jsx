// Stackline — Cuentas por Pagar (CxP)
// Data-driven: /api/purchase-invoices + /api/supplier-payments (aging client-side).
import React, { useState, useMemo } from 'react';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import StatCard from '../components/StatCard.jsx';
import { usePurchaseInvoices, useSupplierPayments } from '../hooks/useOperations.js';
import { useSuppliers } from '../hooks/useMasters.js';
import { createSupplierPayment } from '../api/wave2.js';
import { useTranslation } from 'react-i18next';

const Q = v => `Q ${Number(v || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const TODAY = new Date();

// Backend InvoiceResponse → forma de la UI.
function mapInvoice(r) {
  return {
    id: r.docNumber || String(r.id),
    apiId: r.id,
    supplierId: r.supplierId,
    supplierName: r.supplierName || '—',
    ocId: r.purchaseOrderId ? `OC-${r.purchaseOrderId}` : null,
    date: r.invoiceDate,
    dueDate: r.dueDate,
    amount: Number(r.amount || 0),
    paid: Number(r.paidAmount || 0),
  };
}

// Backend PaymentResponse → forma de la UI.
function mapPayment(r) {
  return {
    id: r.id, supplierId: r.supplierId, supplierName: r.supplierName || '—',
    billId: r.purchaseInvoiceId, amount: Number(r.amount || 0), date: r.paymentDate,
    method: r.method, reference: r.reference, notes: r.notes,
  };
}

function daysDue(dueDateStr) {
  if (!dueDateStr) return 0;
  return Math.floor((TODAY - new Date(dueDateStr)) / 86400000);
}

function agingBucket(bill) {
  const balance = bill.amount - bill.paid;
  if (balance <= 0) return 'paid';
  const d = daysDue(bill.dueDate);
  if (d <= 0)  return 'current';
  if (d <= 30) return '1-30';
  if (d <= 60) return '31-60';
  if (d <= 90) return '61-90';
  return '90+';
}

const BUCKET_ORDER = ['current', '1-30', '31-60', '61-90', '90+'];
const BUCKET_LABEL = { current: 'Por vencer', '1-30': '1-30 días', '31-60': '31-60 días', '61-90': '61-90 días', '90+': '+90 días' };
const BUCKET_CLASS = { current: 'success', '1-30': 'warning', '31-60': 'warning', '61-90': 'danger', '90+': 'danger' };
const STATUS_LABEL = { open: 'Abierta', partial: 'Parcial', paid: 'Pagada' };
const STATUS_CLASS = { open: 'info', partial: 'warning', paid: 'success' };
const PAY_METHODS  = ['efectivo', 'transferencia', 'cheque', 'tarjeta'];

export default function CxP({ pushToast }) {
  const { t } = useTranslation();
  const [tab, setTab]               = useState('aging');
  const [search, setSearch]         = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const { items: invoicesRaw, reload: reloadBills } = usePurchaseInvoices();
  const { items: paymentsRaw, reload: reloadPays } = useSupplierPayments();
  const { items: suppliersList } = useSuppliers();
  const [payModal, setPayModal]     = useState(null);
  const [selectedBill, setSelectedBill] = useState(null);

  const bills = useMemo(() => invoicesRaw.map(mapInvoice), [invoicesRaw]);
  const payments = useMemo(() => paymentsRaw.map(mapPayment), [paymentsRaw]);
  const suppliers = useMemo(() => {
    const map = {};
    suppliersList.forEach(s => { map[s.id] = s; });
    return map;
  }, [suppliersList]);

  const enriched = useMemo(() => bills.map(b => {
    const balance = +(b.amount - b.paid).toFixed(2);
    return {
      ...b,
      balance,
      status: balance <= 0.005 ? 'paid' : (b.paid > 0 ? 'partial' : 'open'),
      daysOverdue: daysDue(b.dueDate),
      bucket: agingBucket(b),
    };
  }), [bills]);

  // Stats
  const totalCxP   = enriched.reduce((s, b) => s + b.balance, 0);
  const overdueAmt  = enriched.filter(b => b.daysOverdue > 0 && b.balance > 0).reduce((s, b) => s + b.balance, 0);
  const openCount   = enriched.filter(b => b.balance > 0).length;
  const criticalCount = enriched.filter(b => b.daysOverdue > 60 && b.balance > 0).length;
  const paidMayo    = payments.reduce((s, p) => s + p.amount, 0);

  const agingSummary = useMemo(() => {
    const buckets = {};
    BUCKET_ORDER.forEach(b => { buckets[b] = { count: 0, total: 0 }; });
    enriched.forEach(b => {
      if (b.balance <= 0) return;
      const bk = b.bucket;
      if (!buckets[bk]) buckets[bk] = { count: 0, total: 0 };
      buckets[bk].count++;
      buckets[bk].total += b.balance;
    });
    return buckets;
  }, [enriched]);

  const filtered = useMemo(() => enriched.filter(b => {
    if (filterStatus !== 'all' && b.status !== filterStatus) return false;
    if (filterStatus === 'all' && b.balance <= 0) return false;
    if (search && !b.supplierName.toLowerCase().includes(search.toLowerCase()) && !b.id.includes(search)) return false;
    return true;
  }), [enriched, search, filterStatus]);

  const supplierAging = useMemo(() => {
    const map = {};
    enriched.forEach(b => {
      if (b.balance <= 0) return;
      if (!map[b.supplierId]) map[b.supplierId] = { supplier: suppliers[b.supplierId], buckets: {}, total: 0 };
      map[b.supplierId].buckets[b.bucket] = (map[b.supplierId].buckets[b.bucket] || 0) + b.balance;
      map[b.supplierId].total += b.balance;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [enriched, suppliers]);

  async function handlePayment({ amount, method, reference }) {
    const amt = parseFloat(amount);
    try {
      await createSupplierPayment({
        supplierId: payModal.supplierId,
        purchaseInvoiceId: payModal.apiId,
        amount: amt,
        paymentDate: new Date().toISOString().slice(0, 10),
        method,
        reference: reference || null,
        notes: `Pago a ${payModal.id}`,
      });
      await Promise.all([reloadBills(), reloadPays()]);
      setPayModal(null);
      pushToast(`Pago de ${Q(amt)} registrado — ${payModal.id}`, 'success');
    } catch (err) {
      pushToast('No se pudo registrar el pago: ' + err.message, 'error');
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('cxp.title', 'Cuentas por Pagar')}</h1>
          <div className="page-subtitle">Obligaciones con proveedores · antigüedad · pagos</div>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <StatCard
          icon="receipt" tone="pri"
          label="Total CxP"
          value={Q(totalCxP)}
          foot={<>{openCount} documentos pendientes</>}
        />
        <StatCard
          icon="alert" tone="ter"
          label="Obligaciones vencidas"
          valueColor={'var(--danger)'}
          value={Q(overdueAmt)}
          foot="Saldo con plazo expirado"
        />
        <StatCard
          icon="clock" tone="sec"
          label="Crítico (+60 días)"
          valueColor={criticalCount > 0 ? 'var(--danger)' : undefined}
          value={criticalCount}
          foot="Facturas en mora crítica"
        />
        <StatCard
          icon="cash" tone="err"
          label="Pagado"
          valueColor={'var(--success)'}
          value={Q(paidMayo)}
          foot="Pagos a proveedores"
        />
      </div>

      {/* Tabs */}
      <div className="tabs">
        {[['aging', 'Antigüedad por proveedor'], ['bills', 'Documentos'], ['payments', 'Pagos realizados']].map(([id, label]) => (
          <button key={id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === 'aging' && (
        <>
          {/* Aging bucket summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 24 }}>
            {BUCKET_ORDER.map(b => (
              <div key={b} className="card" style={{ padding: '14px 16px', borderTop: `3px solid var(--${BUCKET_CLASS[b]})` }}>
                <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>{BUCKET_LABEL[b]}</div>
                <div style={{ fontWeight: 400, fontSize: 22 }}>{Q(agingSummary[b]?.total || 0)}</div>
                <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{agingSummary[b]?.count || 0} doc.</div>
              </div>
            ))}
          </div>

          {/* Aging by supplier table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="tbl-wrap"><table className="mtable">
              <thead>
                <tr>
                  <th>{t('common.supplier', 'Proveedor')}</th>
                  <th style={{ textAlign: 'right' }}>Por vencer</th>
                  <th style={{ textAlign: 'right' }}>1–30 días</th>
                  <th style={{ textAlign: 'right' }}>31–60 días</th>
                  <th style={{ textAlign: 'right' }}>61–90 días</th>
                  <th style={{ textAlign: 'right' }}>+90 días</th>
                  <th style={{ textAlign: 'right' }}>{t('common.total', 'Total')}</th>
                  <th>Plazo</th>
                </tr>
              </thead>
              <tbody>
                {supplierAging.length === 0 ? (
                  <tr><td colSpan={8} className="empty">Sin obligaciones pendientes</td></tr>
                ) : supplierAging.map(row => {
                  const s = row.supplier;
                  const hasOverdue = BUCKET_ORDER.slice(1).some(b => row.buckets[b] > 0);
                  return (
                    <tr key={s?.id}>
                      <td>
                        <div style={{ fontWeight: 500, fontSize: 14 }}>{s?.name}</div>
                        <div className="muted mono" style={{ fontSize: 11 }}>{s?.nit}</div>
                      </td>
                      {BUCKET_ORDER.map(b => (
                        <td key={b} style={{ textAlign: 'right' }}>
                          {row.buckets[b] ? (
                            <span style={{ color: b === 'current' ? 'inherit' : `var(--${BUCKET_CLASS[b]})`, fontWeight: b !== 'current' ? 600 : 400 }}>
                              {Q(row.buckets[b])}
                            </span>
                          ) : <span className="muted">—</span>}
                        </td>
                      ))}
                      <td style={{ textAlign: 'right', fontWeight: 500, color: hasOverdue ? 'var(--danger)' : 'inherit' }}>
                        {Q(row.total)}
                      </td>
                      <td>
                        <span className={`badge-m3 ${hasOverdue ? 'danger' : 'success'}`}>
                          {s?.terms || '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          </div>
        </>
      )}

      {tab === 'bills' && (
        <>
          <div className="filterbar">
            <div className="search-wrap" style={{ flex: 1, maxWidth: 320 }}>
              <Icon name="search" className="icon" size={13} />
              <input className="search-input" placeholder={t('cxp.searchPlaceholder', 'Buscar proveedor o documento…')} value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="input" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">{t('common.all', 'Todos')} los estados</option>
              <option value="open">Abiertos</option>
              <option value="partial">Parciales</option>
              <option value="paid">{t('common.completed', 'Pagados')}</option>
            </select>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="tbl-wrap"><table className="mtable">
              <thead>
                <tr>
                  <th>Documento</th>
                  <th>{t('common.supplier', 'Proveedor')}</th>
                  <th>OC</th>
                  <th>Emisión</th>
                  <th>Vencimiento</th>
                  <th style={{ textAlign: 'right' }}>{t('common.amount', 'Monto')}</th>
                  <th style={{ textAlign: 'right' }}>Pendiente</th>
                  <th>Antigüedad</th>
                  <th>{t('common.status', 'Estado')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={10} className="empty">Sin documentos</td></tr>
                ) : filtered.map(b => (
                  <tr key={b.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedBill(b)}>
                    <td><span className="mono" style={{ fontSize: 12 }}>{b.id}</span></td>
                    <td>{b.supplierName}</td>
                    <td><span className="mono muted" style={{ fontSize: 11 }}>{b.ocId || '—'}</span></td>
                    <td className="muted">{b.date}</td>
                    <td style={{ color: b.daysOverdue> 0 ? 'var(--danger)' : 'inherit' }}>{b.dueDate}</td>
                    <td style={{ textAlign: 'right' }}>{Q(b.amount)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 500 }}>{Q(b.balance)}</td>
                    <td>
                      {b.balance > 0 && (
                        <span className={`badge-m3 ${BUCKET_CLASS[b.bucket]}`}>
                          {b.bucket === 'current' ? 'Al día' : `${b.bucket} días`}
                        </span>
                      )}
                    </td>
                    <td><span className={`badge-m3 ${STATUS_CLASS[b.status]}`}>{STATUS_LABEL[b.status]}</span></td>
                    <td onClick={e => e.stopPropagation()}>
                      {b.balance > 0 && (
                        <Button size="sm" onClick={() => setPayModal(b)}>
                          Pagar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
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
                <th>{t('common.date', 'Fecha')}</th>
                <th>{t('common.supplier', 'Proveedor')}</th>
                <th>Documento</th>
                <th>{t('common.reference', 'Referencia')}</th>
                <th>Método</th>
                <th style={{ textAlign: 'right' }}>{t('common.amount', 'Monto')}</th>
                <th>{t('common.notes', 'Notas')}</th>
              </tr>
            </thead>
            <tbody>
              {[...payments].sort((a, b) => b.date?.localeCompare(a.date)).map(p => (
                <tr key={p.id}>
                  <td className="muted">{p.date}</td>
                  <td>{p.supplierName || suppliers[p.supplierId]?.name || '—'}</td>
                  <td><span className="mono" style={{ fontSize: 11 }}>{p.billId}</span></td>
                  <td><span className="mono" style={{ fontSize: 11 }}>{p.reference || '—'}</span></td>
                  <td><span className="badge-m3 info" style={{ textTransform: 'capitalize' }}>{p.method}</span></td>
                  <td style={{ textAlign: 'right', fontWeight: 500, color: 'var(--danger)' }}>{Q(p.amount)}</td>
                  <td className="muted">{p.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      {/* Drawer detalle de factura */}
      {selectedBill && (
        <div className="drawer-overlay" onClick={() => setSelectedBill(null)}>
          <div className="drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-head">
              <div>
                <div className="drawer-title">{selectedBill.id}</div>
                <div className="muted" style={{ fontSize: 12 }}>{selectedBill.supplierName}</div>
              </div>
              <button className="icon-btn" onClick={() => setSelectedBill(null)}><Icon name="close" /></button>
            </div>
            <div className="drawer-body detail-grid">
              <Row label={t('common.supplier', 'Proveedor')}     value={selectedBill.supplierName} />
              <Row label="OC relacionada" value={selectedBill.ocId || '—'} mono />
              <Row label="Fecha emisión"  value={selectedBill.date} />
              <Row label="Vencimiento"    value={selectedBill.dueDate} />
              <Row label={t('common.amount', 'Monto total')}    value={Q(selectedBill.amount)} />
              <Row label="Pagado"         value={Q(selectedBill.paid)} />
              <Row label="Saldo pendiente" value={Q(selectedBill.balance)} bold />
              <Row label="Antigüedad"
                value={selectedBill.daysOverdue > 0
                  ? `${selectedBill.daysOverdue} días vencida`
                  : `Vence en ${Math.abs(selectedBill.daysOverdue)} días`}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 }}>
                <span className={`badge-m3 ${STATUS_CLASS[selectedBill.status]}`}>{STATUS_LABEL[selectedBill.status]}</span>
                {selectedBill.balance > 0 && (
                  <Button icon="cash" onClick={() => { setSelectedBill(null); setPayModal(selectedBill); }}>Registrar pago
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de pago */}
      {payModal && (
        <PayModal
          bill={payModal}
          onClose={() => setPayModal(null)}
          onSave={handlePayment}
        />
      )}
    </div>
  );
}

function Row({ label, value, mono, bold }) {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className={mono ? 'mono' : ''} style={{ fontSize: 14, fontWeight: bold ? 700 : 400, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function PayModal({ bill, onClose, onSave }) {
  const { t } = useTranslation();
  const [amount, setAmount]       = useState(bill.balance.toString());
  const [method, setMethod]       = useState('efectivo');
  const [reference, setReference] = useState('');

  const valid = parseFloat(amount) > 0 && parseFloat(amount) <= bill.balance;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Registrar pago</h3>
          <button className="icon-btn" onClick={onClose}><Icon name="close" /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="field">
            <label className="field-label">Documento</label>
            <div className="mono" style={{ fontSize: 14, padding: '6px 0' }}>{bill.id} — {bill.supplierName}</div>
          </div>
          <div className="field">
            <label className="field-label">{t('clients.payment.pendingBalance', 'Saldo pendiente')}</label>
            <div style={{ fontWeight: 500, color: 'var(--danger)', padding: '6px 0' }}>{Q(bill.balance)}</div>
          </div>
          <div className="field">
            <label className="field-label">Monto a pagar (Q)</label>
            <input type="number" className="field-input mono" value={amount}
              min="0.01" max={bill.balance} step="0.01"
              onChange={e => setAmount(e.target.value)} />
          </div>
          <div className="field">
            <label className="field-label">{t('clients.payment.method', 'Método de pago')}</label>
            <select className="field-input" value={method} onChange={e => setMethod(e.target.value)}>
              {PAY_METHODS.map(m => (
                <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
              ))}
            </select>
          </div>
          {method !== 'efectivo' && (
            <div className="field">
              <label className="field-label">{t('clients.payment.reference', 'Referencia / No. cheque / transferencia')}</label>
              <input className="field-input" value={reference} onChange={e => setReference(e.target.value)} placeholder="Ej. TRF-49102" />
            </div>
          )}
        </div>
        <div className="modal-foot">
          <Button variant="ghost" onClick={onClose}>{t('common.cancel', 'Cancelar')}</Button>
          <Button icon="check" disabled={!valid} onClick={() => onSave({ billId: bill.id, amount, method, reference })}>Registrar pago
          </Button>
        </div>
      </div>
    </div>
  );
}
