// Stackline — Estados Financieros (Estado de Resultados + Balance General)
// Data-driven: consume /api/accounting/{balance-sheet,income-statement} con
// fallback calculado del mock (hook useFinancialStatements).
import React, { useState } from 'react';
import StatCard from '../components/StatCard.jsx';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import { useFinancialStatements, usePeriods } from '../hooks/useAccounting.js';
import { useTranslation } from 'react-i18next';

const Q  = (v) => `Q ${Math.abs(Number(v) || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const Qn = (v) => (Number(v) === 0 ? '—' : Q(v));

function SectionHdr({ label }) {
  return <tr className="fs-section-hdr"><td colSpan={2}>{label}</td></tr>;
}
function Spacer() {
  return <tr><td colSpan={2} style={{ height: 10 }}/></tr>;
}

function Row({ label, value, indent = 0, bold, total, grand }) {
  const emphasized = bold || total || grand;
  const neg = value != null && Number(value) < 0;
  return (
    <tr className={grand ? 'fs-grand' : total ? 'fs-total' : 'fs-row'}>
      <td style={{ paddingLeft: 16 + indent * 18 }}>{emphasized ? <strong>{label}</strong> : label}</td>
      <td className={`fs-amt ${neg ? 'danger' : ''}`}>
        {value == null ? '' : emphasized
          ? <strong>{neg ? '(' : ''}{Qn(value)}{neg ? ')' : ''}</strong>
          : <>{neg ? '(' : ''}{Qn(value)}{neg ? ')' : ''}</>}
      </td>
    </tr>
  );
}

export default function FinancialStatements() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('income');
  const periods = usePeriods();
  const [periodId, setPeriodId] = useState(null);

  const { balanceSheet: bs, incomeStatement: inc, loading, source } = useFinancialStatements(periodId);

  const period = periods.find((p) => p.id === periodId);
  const balanced = bs && Math.abs((bs.totalAssets || 0) - (bs.totalLiabilitiesAndEquity || 0)) < 0.05;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-title">{t('financials.title', 'Estados Financieros')}</div>
          <div className="page-sub">
            {period?.name || t('financials.allPeriods', 'Todos los períodos')}
            {source === 'mock' && <span className="badge-m3" style={{ marginLeft: 8 }}>demo</span>}
          </div>
        </div>
        <div className="page-head-actions">
          <select className="field-input" value={periodId ?? ''} onChange={(e) => setPeriodId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">{t('financials.allPeriods', 'Todos los períodos')}</option>
            {periods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <Button icon="receipt" onClick={() => window.print()}>{t('common.print', 'Imprimir')}
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <StatCard
          label={t('financials.periodRevenue', 'Ingresos del período')}
          value={Q(inc?.totalIncome)}
          foot={period?.name || '—'}
        />
        <StatCard
          label={t('financials.totalExpenses', 'Total Gastos')}
          value={Q(inc?.totalExpenses)}
          foot={t('financials.ofPeriod', 'del período')}
        />
        <StatCard
          label={t('financials.netProfitLoss', 'Utilidad / Pérdida Neta')}
          valueColor={(inc?.netIncome || 0) < 0 ? 'var(--danger)' : 'var(--success)'}
          value={<>{(inc?.netIncome || 0) < 0 ? '(' : ''}{Q(inc?.netIncome)}{(inc?.netIncome || 0) < 0 ? ')' : ''}</>}
          foot={(inc?.netIncome || 0) < 0 ? t('financials.loss', 'Pérdida') : t('financials.profit', 'Utilidad')}
        />
        <StatCard
          label={t('financials.totalAssets', 'Total Activo')}
          value={Q(bs?.totalAssets)}
          foot={balanced ? t('financials.balanceOk', '✓ Balance cuadra') : t('financials.balanceReview', '⚠ Revisar balance')}
        />
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 0 }}>
        <button className={`tab ${tab === 'income' ? 'active' : ''}`} onClick={() => setTab('income')}>
          {t('financials.tabs.income', 'Estado de Resultados')}
        </button>
        <button className={`tab ${tab === 'bs' ? 'active' : ''}`} onClick={() => setTab('bs')}>
          {t('financials.tabs.balance', 'Balance General')}
        </button>
      </div>

      <div className="card" style={{ borderTopLeftRadius: 0, overflow: 'hidden' }}>
        <div className="table-wrap" style={{ border: 'none', borderRadius: 0, margin: 0 }}>
          {loading && <div className="empty" style={{ padding: 24 }}>{t('common.loading', 'Cargando…')}</div>}

          {!loading && tab === 'income' && inc && (
            <table className="tbl">
              <colgroup><col /><col style={{ width: 200 }} /></colgroup>
              <tbody>
                <SectionHdr label={t('financials.operationalRevenue', 'INGRESOS')} />
                {(inc.income || []).length === 0
                  ? <Row label={t('financials.noMovements', 'Sin movimientos')} value={0} indent={1} />
                  : (inc.income || []).map((l) => <Row key={l.code} label={`${l.code} · ${l.name}`} value={l.amount} indent={1} />)}
                <Row label={t('financials.totalRevenue', 'Total Ingresos')} value={inc.totalIncome} bold total />
                <Spacer />

                <SectionHdr label={t('financials.operatingExpenses', 'COSTOS Y GASTOS')} />
                {(inc.expenses || []).length === 0
                  ? <Row label={t('financials.noMovements', 'Sin movimientos')} value={0} indent={1} />
                  : (inc.expenses || []).map((l) => <Row key={l.code} label={`${l.code} · ${l.name}`} value={l.amount} indent={1} />)}
                <Row label={t('financials.totalOperatingExpenses', 'Total Costos y Gastos')} value={inc.totalExpenses} bold total />
                <Spacer />

                <tr className={`fs-net ${(inc.netIncome || 0) < 0 ? 'loss' : 'profit'}`}>
                  <td><strong>{t('financials.netProfitLossLine', 'UTILIDAD (PÉRDIDA) NETA DEL PERÍODO')}</strong></td>
                  <td className="fs-amt"><strong>{(inc.netIncome || 0) < 0 ? '(' : ''}{Q(inc.netIncome)}{(inc.netIncome || 0) < 0 ? ')' : ''}</strong></td>
                </tr>
              </tbody>
            </table>
          )}

          {!loading && tab === 'bs' && bs && (
            <table className="tbl">
              <colgroup><col /><col style={{ width: 200 }} /></colgroup>
              <tbody>
                <SectionHdr label={t('financials.assets', 'ACTIVO')} />
                {(bs.assets || []).map((l) => <Row key={l.code} label={`${l.code} · ${l.name}`} value={l.amount} indent={1} />)}
                <Row label={t('financials.totalAssets', 'TOTAL ACTIVO')} value={bs.totalAssets} grand />
                <Spacer /><Spacer />

                <SectionHdr label={t('financials.liabilities', 'PASIVO')} />
                {(bs.liabilities || []).map((l) => <Row key={l.code} label={`${l.code} · ${l.name}`} value={l.amount} indent={1} />)}
                <Row label={t('financials.totalLiabilities', 'TOTAL PASIVO')} value={bs.totalLiabilities} bold total />
                <Spacer />

                <SectionHdr label={t('financials.equity', 'CAPITAL Y RESERVAS')} />
                {(bs.equity || []).map((l) => <Row key={l.code} label={`${l.code} · ${l.name}`} value={l.amount} indent={1} />)}
                <Row label={t('financials.totalEquity', 'Total Capital y Reservas')} value={bs.totalEquity} bold total />
                <Spacer />

                <Row label={t('financials.totalLiabilitiesEquity', 'TOTAL PASIVO + CAPITAL')} value={bs.totalLiabilitiesAndEquity} grand />
                {!balanced && (
                  <tr><td colSpan={2} style={{ paddingTop: 12 }}>
                    <span className="badge-m3 danger">{t('financials.balanceReviewWarning', '⚠ El balance no cuadra — verificar partidas')}</span>
                  </td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
