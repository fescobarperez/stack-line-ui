// ERP MAYA — Mayor General + Balance de Comprobación
// Data-driven: consume /api/accounting/ledger/{trial-balance,account/:id} con
// fallback al mock (hooks useLedgerTrialBalance / useAccountLedger).
import React, { useState, useEffect, useMemo } from 'react';
import Icon from '../components/Icon.jsx';
import { usePeriods, useLedgerTrialBalance, useAccountLedger } from '../hooks/useAccounting.js';
import { useTranslation } from 'react-i18next';

const Q = (v) => `Q ${Math.abs(Number(v) || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ZERO_TOTALS = { openingDebit: 0, openingCredit: 0, periodDebit: 0, periodCredit: 0, closingDebit: 0, closingCredit: 0 };

export default function Ledger() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('trial');
  const [showZero, setShowZero] = useState(false);

  const periods = usePeriods();
  const [periodId, setPeriodId] = useState(null);
  useEffect(() => { if (periodId == null && periods.length) setPeriodId(periods[0].id); }, [periods, periodId]);

  const { data: tb, loading: tbLoading, source } = useLedgerTrialBalance(periodId);
  const rows = tb?.rows ?? [];
  const totals = tb?.totals ?? ZERO_TOTALS;
  const balanced = tb?.balanced ?? true;

  const [selectedAccountId, setSelectedAccountId] = useState(null);
  useEffect(() => {
    if ((selectedAccountId == null || !rows.some((r) => r.accountId === selectedAccountId)) && rows.length) {
      setSelectedAccountId(rows[0].accountId);
    }
  }, [rows, selectedAccountId]);

  const { data: acc } = useAccountLedger(tab === 'ledger' ? selectedAccountId : null, periodId);

  const period = periods.find((p) => p.id === periodId);
  const visibleRows = useMemo(
    () => rows.filter((r) => showZero || r.periodDebit > 0 || r.periodCredit > 0 || r.openingDebit > 0 || r.openingCredit > 0),
    [rows, showZero],
  );
  const accountsWithMovs = rows.filter((r) => r.periodDebit > 0 || r.periodCredit > 0).length;
  const diff = Math.abs((totals.closingDebit || 0) - (totals.closingCredit || 0));

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('ledger.title', 'Mayor General · Balance de Comprobación')}</h1>
          <div className="page-subtitle">
            {t('ledger.subtitle', 'Movimientos por cuenta · saldos · verificación contable')}
            {source === 'mock' && <span className="pill" style={{ marginLeft: 8, fontSize: 10 }}>demo</span>}
          </div>
        </div>
        <div className="page-head-actions">
          <select className="field-input" value={periodId ?? ''} onChange={(e) => setPeriodId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">{t('financials.allPeriods', 'Todos los períodos')}</option>
            {periods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="btn"><Icon name="download" size={12} /> {t('common.export', 'Exportar')}</button>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <div className="stat">
          <div className="label"><Icon name="receipt" size={11} />{t('ledger.period', 'Período')}</div>
          <div className="val" style={{ fontSize: 18 }}>{period?.name || t('financials.allPeriods', 'Todos')}</div>
        </div>
        <div className="stat">
          <div className="label"><Icon name="chart" size={11} />{t('ledger.accountsWithMovs', 'Cuentas con movimiento')}</div>
          <div className="val mono">{accountsWithMovs}</div>
        </div>
        <div className="stat">
          <div className="label"><Icon name="check" size={11} />{t('ledger.tabs.trial', 'Balance de Comprobación')}</div>
          <div className="val" style={{ fontSize: 16, color: balanced ? 'var(--success)' : 'var(--danger)' }}>
            {balanced ? t('ledger.balanced', '✓ Cuadrado') : t('ledger.unbalanced', '✗ Descuadre')}
          </div>
          <div className="delta muted">{balanced ? t('ledger.debitsEqCredits', 'Débitos = Créditos') : `${t('ledger.difference', 'Diferencia')} ${Q(diff)}`}</div>
        </div>
        <div className="stat">
          <div className="label"><Icon name="cash" size={11} />{t('ledger.totalMoved', 'Total movilizado')}</div>
          <div className="val mono">{Q(totals.periodDebit)}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${tab === 'trial' ? 'active' : ''}`} onClick={() => setTab('trial')}>{t('ledger.tabs.trial', 'Balance de Comprobación')}</button>
        <button className={`tab ${tab === 'ledger' ? 'active' : ''}`} onClick={() => setTab('ledger')}>{t('ledger.tabs.ledger', 'Mayor General')}</button>
      </div>

      {/* ── Balance de Comprobación ── */}
      {tab === 'trial' && (
        <>
          <div className="filterbar">
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={showZero} onChange={(e) => setShowZero(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
              {t('ledger.showZeroAccounts', 'Mostrar cuentas sin movimiento')}
            </label>
            <div style={{ marginLeft: 'auto' }}>
              <span className={`pill ${balanced ? 'success' : 'danger'}`} style={{ fontSize: 10 }}>{balanced ? t('ledger.balanced', '✓ Balanceado') : t('ledger.unbalanced', '✗ Descuadre')}</span>
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="tbl-wrap"><table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 90 }}>{t('common.code', 'Código')}</th>
                  <th>{t('ledger.account', 'Cuenta')}</th>
                  <th style={{ textAlign: 'right' }}>{t('ledger.openDb', 'Saldo Ini. Db')}</th>
                  <th style={{ textAlign: 'right' }}>{t('ledger.openCr', 'Saldo Ini. Cr')}</th>
                  <th style={{ textAlign: 'right' }}>{t('ledger.movDb', 'Movim. Db')}</th>
                  <th style={{ textAlign: 'right' }}>{t('ledger.movCr', 'Movim. Cr')}</th>
                  <th style={{ textAlign: 'right' }}>{t('ledger.finalDb', 'Saldo Final Db')}</th>
                  <th style={{ textAlign: 'right' }}>{t('ledger.finalCr', 'Saldo Final Cr')}</th>
                </tr>
              </thead>
              <tbody>
                {tbLoading && <tr><td colSpan={8}><div className="empty" style={{ padding: 24 }}>{t('common.loading', 'Cargando…')}</div></td></tr>}
                {!tbLoading && visibleRows.length === 0 && <tr><td colSpan={8}><div className="empty" style={{ padding: 24 }}>{t('ledger.noData', 'Sin movimientos en el período')}</div></td></tr>}
                {visibleRows.map((r) => {
                  const cell = (v, bold) => <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: bold && v > 0 ? 700 : 400 }}>{v > 0.005 ? Q(v) : <span className="muted">—</span>}</td>;
                  return (
                    <tr key={r.accountId ?? r.code} style={{ cursor: 'pointer' }} onClick={() => { setSelectedAccountId(r.accountId); setTab('ledger'); }} title={t('ledger.viewInLedger', 'Ver en Mayor General')}>
                      <td><span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{r.code}</span></td>
                      <td style={{ fontSize: 13 }}>{r.name}</td>
                      {cell(r.openingDebit)}{cell(r.openingCredit)}{cell(r.periodDebit)}{cell(r.periodCredit)}{cell(r.closingDebit, true)}{cell(r.closingCredit, true)}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--surface-2)', borderTop: '2px solid var(--border)' }}>
                  <td colSpan={2} style={{ padding: '10px 12px', fontWeight: 700, fontSize: 12 }}>{t('ledger.totals', 'TOTALES')}</td>
                  {[totals.openingDebit, totals.openingCredit, totals.periodDebit, totals.periodCredit, totals.closingDebit, totals.closingCredit].map((v, i) => (
                    <td key={i} style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12, padding: '10px 12px', color: i >= 4 ? (balanced ? 'var(--success)' : 'var(--danger)') : undefined }}>{Q(v)}</td>
                  ))}
                </tr>
              </tfoot>
            </table></div>
          </div>
        </>
      )}

      {/* ── Mayor General ── */}
      {tab === 'ledger' && (
        <>
          <div className="filterbar">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <label className="field-label">{t('ledger.account', 'Cuenta')}</label>
              <select className="input" value={selectedAccountId ?? ''} onChange={(e) => setSelectedAccountId(Number(e.target.value))} style={{ minWidth: 340 }}>
                {rows.map((r) => <option key={r.accountId ?? r.code} value={r.accountId}>{r.code} — {r.name}</option>)}
              </select>
            </div>
          </div>

          <div className="card" style={{ padding: '14px 18px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{acc?.name || '—'}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                {t('common.code', 'Código')}: <span className="mono">{acc?.code || '—'}</span> · {period?.name || t('financials.allPeriods', 'Todos')}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="muted" style={{ fontSize: 11 }}>{t('ledger.closingBalance', 'Saldo final')}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 18 }}>
                {Q(acc?.closingBalance)} <span className="muted" style={{ fontSize: 11 }}>{(acc?.closingBalance ?? 0) >= 0 ? 'Db' : 'Cr'}</span>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="tbl-wrap"><table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 110 }}>{t('common.date', 'Fecha')}</th>
                  <th style={{ width: 120 }}>{t('common.reference', 'Referencia')}</th>
                  <th>{t('common.description', 'Descripción')}</th>
                  <th style={{ textAlign: 'right' }}>{t('ledger.debitCol', 'Débito')}</th>
                  <th style={{ textAlign: 'right' }}>{t('ledger.creditCol', 'Crédito')}</th>
                  <th style={{ textAlign: 'right' }}>{t('ledger.balance', 'Saldo')}</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ background: 'var(--surface-2)' }}>
                  <td colSpan={3} style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600, color: 'var(--muted)', fontStyle: 'italic' }}>
                    — {t('ledger.openingBalance', 'Saldo inicial')} —
                  </td>
                  <td /><td />
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, padding: '8px 12px' }}>
                    {Q(acc?.openingBalance)} <span style={{ fontSize: 10, fontWeight: 400 }}>{(acc?.openingBalance ?? 0) >= 0 ? 'Db' : 'Cr'}</span>
                  </td>
                </tr>
                {(acc?.movements ?? []).map((m, i) => (
                  <tr key={i}>
                    <td className="mono" style={{ fontSize: 11 }}>{m.date}</td>
                    <td className="muted" style={{ fontSize: 11 }}>{m.reference || '—'}</td>
                    <td style={{ fontSize: 12.5 }}>{m.description}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{m.debit > 0 ? Q(m.debit) : <span className="muted">—</span>}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{m.credit > 0 ? Q(m.credit) : <span className="muted">—</span>}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600 }}>{Q(m.balance)}</td>
                  </tr>
                ))}
                {(acc?.movements ?? []).length === 0 && (
                  <tr><td colSpan={6}><div className="empty" style={{ padding: 20 }}>{t('ledger.noMovements', 'Sin movimientos en el período')}</div></td></tr>
                )}
              </tbody>
            </table></div>
          </div>
        </>
      )}
    </div>
  );
}
