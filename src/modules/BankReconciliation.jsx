// Stackline — Conciliación Bancaria
// Data-driven contra el modelo real del backend: cuentas + movimientos (con flag
// reconciled) + registros de conciliación (fecha extracto + saldo banco → diferencia).
import React, { useState, useEffect, useCallback } from 'react';
import StatCard from '../components/StatCard.jsx';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
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
            {source === 'mock' && <span className="badge-m3" style={{ marginLeft: 8 }}>demo</span>}
          </div>
        </div>
        <div className="page-head-actions">
          <select className="field-input" value={accountId ?? ''} onChange={(e) => setAccountId(e.target.value ? Number(e.target.value) : null)}>
            {accounts.length === 0 && <option value="">—</option>}
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.bankName || a.alias || a.accountCode} · {a.accountNumber || a.accountCode}</option>)}
          </select>
          <Button icon="check" disabled={accountId == null} onClick={() => setShowRec(true)}>{t('bankrec.reconcile', 'Conciliar')}
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <StatCard
          label={t('bankrec.bookBalance', 'Saldo en libros')}
          value={Q(account?.bookBalance)}
          foot={account?.accountCode || '—'}
        />
        <StatCard
          label={t('bankrec.bankBalance', 'Saldo bancario')}
          value={Q(account?.balance)}
          foot={t('bankrec.perSystem', 'Registrado en el sistema')}
        />
        <StatCard
          label={t('bankrec.lastDiff', 'Última diferencia')}
          valueColor={lastRec ? (Math.abs(Number(lastRec.difference)) < 0.01 ? 'var(--success)' : 'var(--danger)') : undefined}
          value={lastRec ? Q(lastRec.difference) : '—'}
          foot={lastRec ? lastRec.statementDate : t('bankrec.noReconciliations', 'Sin conciliaciones')}
        />
        <StatCard
          label={t('bankrec.reconciledItems', 'Movimientos conciliados')}
          value={<>{reconciledCount} / {movements.length}</>}
          foot={t('bankrec.movements', 'movimientos')}
        />
      </div>

      {/* Movimientos en libros */}
      <div className="card" style={{ marginBottom: 16, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 500, fontSize: 14 }}>
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
                  <td className="mono muted">{m.movementDate}</td>
                  <td>{m.description}<div className="mono muted" style={{ fontSize: 11 }}>{m.reference || '—'}</div></td>
                  <td><span className="badge-m3">{m.movementType || '—'}</span></td>
                  <td className="num">{Q(m.amount)}</td>
                  <td className="num">{Q(m.runningBalance)}</td>
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
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 500, fontSize: 14 }}>
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
                  <td className="mono">{r.statementDate}</td>
                  <td className="num">{Q(r.bookBalance)}</td>
                  <td className="num">{Q(r.bankBalance)}</td>
                  <td className="num" style={{ fontWeight: 500, color: Math.abs(Number(r.difference)) < 0.01 ? 'var(--success)' : 'var(--danger)' }}>{Q(r.difference)}</td>
                  <td><span className={`badge-m3 ${Math.abs(Number(r.difference)) < 0.01 ? 'success' : 'warning'}`}>{r.status}</span></td>
                  <td className="muted">{r.notes || '—'}</td>
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
              <Button onClick={() => setShowRec(false)}>{t('common.cancel', 'Cancelar')}</Button>
              <Button icon="check" variant="accent" onClick={submitRec}>{t('bankrec.reconcile', 'Conciliar')}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
