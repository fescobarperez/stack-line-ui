// Stackline — Conciliación Bancaria
// Data-driven contra el modelo real del backend: cuentas + movimientos (con flag
// reconciled) + registros de conciliación (fecha extracto + saldo banco → diferencia).
import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../components/Icon.jsx';
import { useBankAccounts } from '../hooks/useOperations.js';
import { bankMovements, bankReconciliations, reconcileBank } from '../api/wave3.js';
import { useTranslation } from 'react-i18next';

const Q = (v) => `Q ${Number(v || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function BankReconciliation({ pushToast }) {
  const { t } = useTranslation();
  const { items: accounts, source } = useBankAccounts();
  const [accountId, setAccountId] = useState(null);
  const [movements, setMovements] = useState([]);
  const [recs, setRecs] = useState([]);
  const [showRec, setShowRec] = useState(false);
  const [recForm, setRecForm] = useState({ statementDate: new Date().toISOString().slice(0, 10), bankBalance: '', notes: '' });

  useEffect(() => { if (accountId == null && accounts.length) setAccountId(accounts[0].id); }, [accounts, accountId]);

  const loadDetail = useCallback(async () => {
    if (accountId == null) { setMovements([]); setRecs([]); return; }
    try {
      const [m, r] = await Promise.all([bankMovements(accountId), bankReconciliations(accountId)]);
      setMovements(Array.isArray(m) ? m : (m?.content ?? []));
      const rows = Array.isArray(r) ? r : (r?.content ?? []);
      setRecs([...rows].sort((a, b) => (b.statementDate || '').localeCompare(a.statementDate || '')));
    } catch {
      setMovements([]); setRecs([]);
    }
  }, [accountId]);
  useEffect(() => { loadDetail(); }, [loadDetail]);

  const account = accounts.find((a) => a.id === accountId);
  const lastRec = recs[0];
  const reconciledCount = movements.filter((m) => m.reconciled).length;

  async function submitRec() {
    const bal = parseFloat(recForm.bankBalance);
    if (Number.isNaN(bal)) { pushToast?.('Ingresa el saldo del extracto', 'error'); return; }
    try {
      await reconcileBank(accountId, { statementDate: recForm.statementDate, bankBalance: bal, notes: recForm.notes || null });
      await loadDetail();
      setShowRec(false);
      setRecForm({ statementDate: new Date().toISOString().slice(0, 10), bankBalance: '', notes: '' });
      pushToast?.('Conciliación registrada', 'success');
    } catch (err) {
      pushToast?.('No se pudo conciliar: ' + err.message, 'error');
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-title">{t('bankrec.title', 'Conciliación Bancaria')}</div>
          <div className="page-sub">
            {account ? `${account.bankName || account.alias || account.accountCode}` : t('bankrec.noAccounts', 'Sin cuentas bancarias')}
            {source === 'mock' && <span className="pill" style={{ marginLeft: 8, fontSize: 10 }}>demo</span>}
          </div>
        </div>
        <div className="page-head-actions">
          <select className="field-input" value={accountId ?? ''} onChange={(e) => setAccountId(e.target.value ? Number(e.target.value) : null)}>
            {accounts.length === 0 && <option value="">—</option>}
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.bankName || a.alias || a.accountCode} · {a.accountNumber || a.accountCode}</option>)}
          </select>
          <button className="btn" disabled={accountId == null} onClick={() => setShowRec(true)}>
            <Icon name="check" size={13} /> {t('bankrec.reconcile', 'Conciliar')}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="label">{t('bankrec.bookBalance', 'Saldo en libros')}</div>
          <div className="value">{Q(account?.bookBalance)}</div>
          <div className="sub muted">{account?.accountCode || '—'}</div>
        </div>
        <div className="stat-card">
          <div className="label">{t('bankrec.bankBalance', 'Saldo bancario')}</div>
          <div className="value">{Q(account?.balance)}</div>
          <div className="sub muted">{t('bankrec.perSystem', 'Registrado en el sistema')}</div>
        </div>
        <div className="stat-card">
          <div className="label">{t('bankrec.lastDiff', 'Última diferencia')}</div>
          <div className={`value ${lastRec ? (Math.abs(Number(lastRec.difference)) < 0.01 ? 'success' : 'danger') : ''}`}>
            {lastRec ? Q(lastRec.difference) : '—'}
          </div>
          <div className="sub muted">{lastRec ? lastRec.statementDate : t('bankrec.noReconciliations', 'Sin conciliaciones')}</div>
        </div>
        <div className="stat-card">
          <div className="label">{t('bankrec.reconciledItems', 'Movimientos conciliados')}</div>
          <div className="value">{reconciledCount} / {movements.length}</div>
          <div className="sub muted">{t('bankrec.movements', 'movimientos')}</div>
        </div>
      </div>

      {/* Movimientos en libros */}
      <div className="card" style={{ marginBottom: 16, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 13 }}>
          {t('bankrec.bookMovements', 'Movimientos en libros')}
        </div>
        <div className="table-wrap" style={{ border: 'none', margin: 0, borderRadius: 0 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>{t('common.date', 'Fecha')}</th><th>{t('bankrec.descRef', 'Descripción / Ref.')}</th>
                <th>{t('common.type', 'Tipo')}</th><th style={{ textAlign: 'right' }}>{t('common.amount', 'Monto')}</th>
                <th style={{ textAlign: 'right' }}>{t('bankrec.balance', 'Saldo')}</th><th className="center">Conciliado</th>
              </tr>
            </thead>
            <tbody>
              {movements.length === 0 && <tr><td colSpan={6}><div className="empty" style={{ padding: 24 }}>Sin movimientos bancarios</div></td></tr>}
              {movements.map((m) => (
                <tr key={m.id}>
                  <td className="mono muted" style={{ fontSize: 11 }}>{m.movementDate}</td>
                  <td style={{ fontSize: 12.5 }}>{m.description}<div className="mono muted" style={{ fontSize: 10 }}>{m.reference || '—'}</div></td>
                  <td><span className="pill" style={{ fontSize: 9 }}>{m.movementType || '—'}</span></td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{Q(m.amount)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{Q(m.runningBalance)}</td>
                  <td className="center">
                    {m.reconciled
                      ? <Icon name="check" size={13} style={{ color: 'var(--success)' }} />
                      : <span className="muted">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Historial de conciliaciones */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 13 }}>
          {t('bankrec.history', 'Historial de conciliaciones')}
        </div>
        <div className="table-wrap" style={{ border: 'none', margin: 0, borderRadius: 0 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>{t('bankrec.statementDate', 'Fecha extracto')}</th>
                <th style={{ textAlign: 'right' }}>{t('bankrec.bookBalance', 'Saldo libros')}</th>
                <th style={{ textAlign: 'right' }}>{t('bankrec.bankBalance', 'Saldo banco')}</th>
                <th style={{ textAlign: 'right' }}>{t('bankrec.difference', 'Diferencia')}</th>
                <th>{t('common.status', 'Estado')}</th><th>{t('common.notes', 'Notas')}</th>
              </tr>
            </thead>
            <tbody>
              {recs.length === 0 && <tr><td colSpan={6}><div className="empty" style={{ padding: 20 }}>Sin conciliaciones registradas</div></td></tr>}
              {recs.map((r) => (
                <tr key={r.id}>
                  <td className="mono" style={{ fontSize: 12 }}>{r.statementDate}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{Q(r.bookBalance)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{Q(r.bankBalance)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: Math.abs(Number(r.difference)) < 0.01 ? 'var(--success)' : 'var(--danger)' }}>{Q(r.difference)}</td>
                  <td><span className={`pill ${Math.abs(Number(r.difference)) < 0.01 ? 'success' : 'warning'}`} style={{ fontSize: 9 }}>{r.status}</span></td>
                  <td className="muted" style={{ fontSize: 12 }}>{r.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal conciliar */}
      {showRec && (
        <div className="modal-overlay" onClick={() => setShowRec(false)}>
          <div className="modal" style={{ width: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{t('bankrec.reconcile', 'Conciliar')} · {account?.accountCode}</h3>
              <button className="icon-btn" onClick={() => setShowRec(false)}><Icon name="x" /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="muted" style={{ fontSize: 12 }}>Saldo en libros actual: <strong>{Q(account?.bookBalance)}</strong></div>
              <div className="field">
                <label>{t('bankrec.statementDate', 'Fecha del extracto')}</label>
                <input type="date" value={recForm.statementDate} onChange={(e) => setRecForm((f) => ({ ...f, statementDate: e.target.value }))} />
              </div>
              <div className="field">
                <label>{t('bankrec.bankBalance', 'Saldo según extracto bancario')}</label>
                <input type="number" step="0.01" placeholder="0.00" value={recForm.bankBalance} onChange={(e) => setRecForm((f) => ({ ...f, bankBalance: e.target.value }))} autoFocus />
              </div>
              <div className="field">
                <label>{t('common.notes', 'Notas')} ({t('common.optional', 'opcional')})</label>
                <input value={recForm.notes} onChange={(e) => setRecForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setShowRec(false)}>{t('common.cancel', 'Cancelar')}</button>
              <button className="btn accent" onClick={submitRec}><Icon name="check" size={13} /> {t('bankrec.reconcile', 'Conciliar')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
