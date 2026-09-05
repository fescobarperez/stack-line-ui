// Stackline — Presupuestos
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import StatCard from '../components/StatCard.jsx';
import { useBudget } from '../hooks/useBudget.js';
import { createBudget, addBudgetLine } from '../api/wave3.js';

// Departamentos disponibles al crear una línea (define ingreso/gasto y agrupación).
const DEPT_OPTIONS = [
  { nombre: 'Ingresos', esIngreso: true },
  { nombre: 'Costo de Ventas', esIngreso: false },
  { nombre: 'Gastos Administrativos', esIngreso: false },
  { nombre: 'Gastos de Operación', esIngreso: false },
  { nombre: 'Marketing y Ventas', esIngreso: false },
];

const Q   = (n) => `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const Qs  = (n) => `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const sgn = (n) => `${n >= 0 ? '+' : ''}${Qs(n)}`;

const MESES   = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MES_ACT = new Date().getMonth();
const AÑO_ACT = new Date().getFullYear();

const sumTo  = (arr, m) => arr.slice(0, m + 1).reduce((s, v) => s + v, 0);
const sumAll = (arr)    => arr.reduce((s, v) => s + v, 0);
const clamp  = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
function dptStats(d) {
  const pptoYTD  = d.lineas.reduce((s, l) => s + sumTo(l.ppto, MES_ACT), 0);
  const realYTD  = d.lineas.reduce((s, l) => s + sumTo(l.real, MES_ACT), 0);
  const pptoAnual = d.lineas.reduce((s, l) => s + sumAll(l.ppto), 0);
  const varMonto  = realYTD - pptoYTD;
  const pctEjec   = pptoYTD > 0 ? (realYTD / pptoYTD) * 100 : 0;
  return { pptoYTD, realYTD, pptoAnual, varMonto, pctEjec };
}

// ── Componente principal ───────────────────────────────────────────────────
export default function Presupuestos({ pushToast }) {
  const { t } = useTranslation();
  const { depts: DPTOS, periods: PERIODOS, budgetId, year: budgetYear, reload } = useBudget();
  const [tab, setTab]           = useState('resumen');
  const [deptFiltro, setDeptFiltro] = useState('ingresos');
  const [vista, setVista]       = useState('ppto');
  const [showModal, setShowModal] = useState(false);
  const [drawer, setDrawer]     = useState(null);
  const [mDept, setMDept]       = useState('Ingresos');
  const [mCode, setMCode]       = useState('');
  const [mName, setMName]       = useState('');
  const [mAmount, setMAmount]   = useState('');

  async function handleAddLine() {
    const opt = DEPT_OPTIONS.find(d => d.nombre === mDept) || DEPT_OPTIONS[0];
    try {
      let bid = budgetId;
      if (!bid) {
        const yr = budgetYear || new Date().getFullYear();
        const created = await createBudget({ year: yr, name: `Presupuesto ${yr}`, status: 'vigente', lines: [] });
        bid = created.id;
      }
      await addBudgetLine(bid, {
        accountCode: mCode, name: mName, department: opt.nombre,
        isIncome: opt.esIngreso, periodMonth: null,
        budgetedAmount: Number(mAmount || 0), actualAmount: 0,
      });
      pushToast?.('Línea agregada', 'success');
      setShowModal(false); setMCode(''); setMName(''); setMAmount('');
      reload();
    } catch (err) { pushToast?.('No se pudo agregar la línea: ' + err.message, 'error'); }
  }

  const stats = useMemo(() => Object.fromEntries(DPTOS.map(d => [d.id, dptStats(d)])), [DPTOS]);

  const ingDpt        = DPTOS.find(d => d.esIngreso);
  const ingSt         = (ingDpt && stats[ingDpt.id]) || { pptoYTD: 0, realYTD: 0, pptoAnual: 0, varMonto: 0, pctEjec: 0 };
  const gastPptoYTD   = DPTOS.filter(d => !d.esIngreso).reduce((s, d) => s + (stats[d.id]?.pptoYTD || 0), 0);
  const gastRealYTD   = DPTOS.filter(d => !d.esIngreso).reduce((s, d) => s + (stats[d.id]?.realYTD || 0), 0);
  const utilPptoYTD   = ingSt.pptoYTD - gastPptoYTD;
  const utilRealYTD   = ingSt.realYTD - gastRealYTD;
  const pctEjecGlob   = ingSt.pptoYTD > 0 ? (ingSt.realYTD / ingSt.pptoYTD) * 100 : 0;

  const monthly = useMemo(() => MESES.map((mes, m) => {
    const ing = DPTOS.filter(d => d.esIngreso);
    const ingPpto  = ing.reduce((s, d) => s + d.lineas.reduce((ss, l) => ss + l.ppto[m], 0), 0);
    const ingReal  = m <= MES_ACT ? ing.reduce((s, d) => s + d.lineas.reduce((ss, l) => ss + l.real[m], 0), 0) : null;
    const gastPpto = DPTOS.filter(d => !d.esIngreso).reduce((s, d) => s + d.lineas.reduce((ss, l) => ss + l.ppto[m], 0), 0);
    const gastReal = m <= MES_ACT ? DPTOS.filter(d => !d.esIngreso).reduce((s, d) => s + d.lineas.reduce((ss, l) => ss + l.real[m], 0), 0) : null;
    return { mes, m, ingPpto, ingReal, gastPpto, gastReal,
      utilPpto: ingPpto - gastPpto,
      utilReal: ingReal != null && gastReal != null ? ingReal - gastReal : null };
  }), [DPTOS]);

  const dptSelec = DPTOS.find(d => d.id === deptFiltro) ?? DPTOS[0] ?? { id: '', nombre: '', esIngreso: false, lineas: [] };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-title">{t('presupuestos.title', 'Presupuestos')} {AÑO_ACT}</div>
          <div className="muted" style={{fontSize:12}}>{t('presupuestos.fiscalYear', 'Año fiscal ene–dic · Ejecutado hasta')} {MESES[MES_ACT]}</div>
        </div>
        <div className="row gap-8">
          <Button icon="download" onClick={() => pushToast?.('Exportando a Excel…', '')}>{t('common.export', 'Exportar')}
          </Button>
          <Button icon="plus" variant="accent" onClick={() => setShowModal(true)}>{t('presupuestos.newLine', 'Nueva línea')}
          </Button>
        </div>
      </div>

      <div className="tabs" style={{marginBottom:20}}>
        {[
          { id:'resumen',     label: t('presupuestos.tabSummary', 'Resumen ejecutivo') },
          { id:'detalle',     label: t('presupuestos.tabDetail', 'Detalle por departamento') },
          { id:'comparativo', label: t('presupuestos.tabComparison', 'Comparativo mensual') },
          { id:'periodos',    label: t('presupuestos.tabPeriods', 'Períodos') },
        ].map(tab_ => (
          <button key={tab_.id} className={`tab ${tab === tab_.id ? 'active' : ''}`} onClick={() => setTab(tab_.id)}>
            {tab_.label}
          </button>
        ))}
      </div>

      {/* ── RESUMEN ──────────────────────────────────────────────────────── */}
      {tab === 'resumen' && (
        <div>
          <div className="stat-grid" style={{marginBottom:20}}>
            <StatCard
              tone="pri"
              label={<>{t('presupuestos.revenueYTD', 'Ingresos YTD')} (ene–{MESES[MES_ACT]})</>}
              value={Qs(ingSt.realYTD)}
              trend={{ dir: ingSt.realYTD >= ingSt.pptoYTD ? 'up' : 'down', label: <>{((ingSt.realYTD/ingSt.pptoYTD-1)*100).toFixed(1)}% vs ppto · {Qs(ingSt.pptoYTD)}</> }}
            />
            <StatCard
              tone="ter"
              label={t('presupuestos.totalExpensesYTD', 'Gastos totales YTD')}
              value={Qs(gastRealYTD)}
              trend={{ dir: gastRealYTD <= gastPptoYTD ? 'up' : 'down', label: <>{((gastRealYTD/gastPptoYTD-1)*100).toFixed(1)}% vs ppto · {Qs(gastPptoYTD)}</> }}
            />
            <StatCard
              tone="sec"
              label={t('presupuestos.operatingProfitYTD', 'Utilidad operativa YTD')}
              value={Qs(utilRealYTD)}
              trend={{ dir: utilRealYTD >= utilPptoYTD ? 'up' : 'down', label: <>{sgn(utilRealYTD - utilPptoYTD)} vs ppto</> }}
            />
            <StatCard
              tone="err"
              label={t('presupuestos.revenueExecution', '% Ejecución ingresos')}
              value={<>{pctEjecGlob.toFixed(1)}%</>}
              trend={{ dir: pctEjecGlob >= (MES_ACT+1)/12*100 ? 'up' : 'down', label: <>{t('presupuestos.target', 'Objetivo')} {(((MES_ACT+1)/12)*100).toFixed(0)}% · {MES_ACT+1} {t('presupuestos.of12months', 'de 12 meses')}</> }}
            />
          </div>

          <div className="card" style={{padding:0, overflow:'hidden'}}>
            <div style={{padding:'12px 16px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <span style={{fontWeight: 500, fontSize: 14}}>{t('presupuestos.byDeptYTD', 'Por departamento — YTD')} ene–{MESES[MES_ACT]}</span>
              <span className="badge-m3">{AÑO_ACT}</span>
            </div>
            <table className="mtable">
              <thead>
                <tr>
                  <th>{t('presupuestos.department', 'Departamento')}</th>
                  <th className="num">{t('presupuestos.budgetYTD', 'Presupuesto YTD')}</th>
                  <th className="num">{t('presupuestos.realYTD', 'Real YTD')}</th>
                  <th className="num">{t('presupuestos.variation', 'Variación')}</th>
                  <th className="num">{t('presupuestos.execution', '% Ejec.')}</th>
                  <th style={{width:130}}>{t('presupuestos.progress', 'Progreso')}</th>
                </tr>
              </thead>
              <tbody>
                {DPTOS.map(d => {
                  const st   = stats[d.id];
                  const good = d.esIngreso ? st.realYTD >= st.pptoYTD : st.realYTD <= st.pptoYTD;
                  const bar  = clamp((st.realYTD / st.pptoYTD) * 100, 0, 100);
                  return (
                    <tr key={d.id} className="clickable" onClick={() => setDrawer(d)}>
                      <td>
                        <div style={{fontWeight:500}}>{d.nombre}</div>
                        <div style={{fontSize: 11, color:'var(--muted)'}}>{d.lineas.length} {t('presupuestos.lines', 'líneas')}</div>
                      </td>
                      <td className="num">{Qs(st.pptoYTD)}</td>
                      <td className="num">{Qs(st.realYTD)}</td>
                      <td className="num" style={{color: good ? 'var(--success)' : 'var(--danger)'}}>
                        {st.varMonto >= 0 ? '+' : ''}{Qs(st.varMonto)}
                      </td>
                      <td className="num" style={{ color: good ? 'var(--success)' : 'var(--danger)', fontWeight:500 }}>
                        {st.pctEjec.toFixed(1)}%
                      </td>
                      <td>
                        <div style={{height:6, background:'var(--border)', borderRadius:3}}>
                          <div style={{height:'100%', width:`${bar}%`, background: good ? 'var(--success)' : 'var(--danger)', borderRadius:3}}/>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{fontWeight: 500, borderTop:'2px solid var(--border)'}}>
                  <td>{t('presupuestos.operatingProfit', 'Utilidad operativa')}</td>
                  <td className="num">{Qs(utilPptoYTD)}</td>
                  <td className="num">{Qs(utilRealYTD)}</td>
                  <td className="num" style={{color: utilRealYTD>= utilPptoYTD ? 'var(--success)' : 'var(--danger)'}}>
                    {sgn(utilRealYTD - utilPptoYTD)}
                  </td>
                  <td className="num" style={{color: utilRealYTD>= utilPptoYTD ? 'var(--success)' : 'var(--danger)'}}>
                    {utilPptoYTD > 0 ? `${((utilRealYTD/utilPptoYTD)*100).toFixed(1)}%` : '—'}
                  </td>
                  <td/>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── DETALLE ──────────────────────────────────────────────────────── */}
      {tab === 'detalle' && (
        <div>
          <div style={{display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center'}}>
            <div style={{display:'flex', gap:6, flex:1, flexWrap:'wrap'}}>
              {DPTOS.map(d => (
                <Button size="sm" variant={deptFiltro === d.id ? 'accent' : 'outlined'} key={d.id} onClick={() => setDeptFiltro(d.id)}>{d.nombre}</Button>
              ))}
            </div>
            <div style={{display:'flex', gap:4}}>
              {[
                {v:'ppto', l: t('presupuestos.viewBudget', 'Presupuesto')},
                {v:'real', l: t('presupuestos.viewReal', 'Real')},
                {v:'var',  l: t('presupuestos.viewVariation', 'Variación')},
              ].map(o => (
                <Button size="sm" variant={vista===o.v ? 'accent':'outlined'} key={o.v} onClick={() => setVista(o.v)}>{o.l}</Button>
              ))}
            </div>
          </div>

          <div className="card" style={{padding:0, overflowX:'auto'}}>
            <div style={{padding:'12px 16px', borderBottom:'1px solid var(--border)', fontWeight: 500, fontSize: 14}}>
              {dptSelec.nombre} — {vista==='ppto' ? t('presupuestos.viewBudget', 'Presupuesto') : vista==='real' ? t('presupuestos.realExecuted', 'Real ejecutado') : t('presupuestos.variationFormula', 'Variación (real − ppto)')}
            </div>
            <table className="mtable" style={{minWidth:900}}>
              <thead>
                <tr>
                  <th style={{minWidth:220}}>{t('presupuestos.budgetLine', 'Línea presupuestaria')}</th>
                  {MESES.map((mes, m) => (
                    <th key={m} className="num" style={{ padding:'8px 6px',
                      color: m > MES_ACT ? 'var(--muted)' : m === MES_ACT ? 'var(--accent)' : 'inherit' }}>
                      {mes}{m === MES_ACT ? ' ▲' : ''}
                    </th>
                  ))}
                  <th className="num">{t('common.total', 'Total')}</th>
                </tr>
              </thead>
              <tbody>
                {dptSelec.lineas.map(l => (
                  <tr key={l.cuenta}>
                    <td>
                      <div style={{fontWeight:500, fontSize:12}}>{l.nombre}</div>
                      <div className="code">{l.cuenta}</div>
                    </td>
                    {MESES.map((_, m) => {
                      const future = m > MES_ACT;
                      let val, color;
                      if (vista === 'ppto') {
                        val = l.ppto[m]; color = 'inherit';
                      } else if (vista === 'real') {
                        val = future ? null : l.real[m]; color = 'inherit';
                      } else {
                        if (future) { val = null; color = 'inherit'; }
                        else {
                          val = l.real[m] - l.ppto[m];
                          const good = dptSelec.esIngreso ? val >= 0 : val <= 0;
                          color = val === 0 ? 'var(--muted)' : good ? 'var(--success)' : 'var(--danger)';
                        }
                      }
                      return (
                        <td key={m} className="num" style={{ padding:'7px 6px',
                          color: future ? 'var(--muted)' : color,
                          fontStyle: future ? 'italic' : 'normal' }}>
                          {val == null ? '—' : Qs(val)}
                        </td>
                      );
                    })}
                    <td className="num" style={{ fontWeight:500 }}>
                      {vista==='ppto' ? Qs(sumAll(l.ppto))
                        : vista==='real' ? Qs(sumTo(l.real, MES_ACT))
                        : (() => {
                            const v = sumTo(l.real,MES_ACT) - sumTo(l.ppto,MES_ACT);
                            const good = dptSelec.esIngreso ? v >= 0 : v <= 0;
                            return <span style={{color: good?'var(--success)':'var(--danger)'}}>{sgn(v)}</span>;
                          })()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{fontWeight: 500, borderTop:'2px solid var(--border)'}}>
                  <td>{t('presupuestos.total', 'Total')} {dptSelec.nombre}</td>
                  {MESES.map((_, m) => {
                    const future = m > MES_ACT;
                    let val, color;
                    const totPpto = dptSelec.lineas.reduce((s,l) => s + l.ppto[m], 0);
                    const totReal = dptSelec.lineas.reduce((s,l) => s + l.real[m], 0);
                    if (vista==='ppto') { val = totPpto; color = 'inherit'; }
                    else if (vista==='real') { val = future ? null : totReal; color = 'inherit'; }
                    else {
                      if (future) { val = null; color = 'inherit'; }
                      else {
                        val = totReal - totPpto;
                        const good = dptSelec.esIngreso ? val >= 0 : val <= 0;
                        color = val===0?'var(--muted)':good?'var(--success)':'var(--danger)';
                      }
                    }
                    return (
                      <td key={m} className="num" style={{ padding:'7px 6px', color: future?'var(--muted)':color, fontStyle:future?'italic':'normal' }}>
                        {val==null ? '—' : Qs(val)}
                      </td>
                    );
                  })}
                  <td className="num">
                    {vista==='ppto' ? Qs(dptSelec.lineas.reduce((s,l)=>s+sumAll(l.ppto),0))
                      : vista==='real' ? Qs(dptSelec.lineas.reduce((s,l)=>s+sumTo(l.real,MES_ACT),0))
                      : (() => {
                          const v = dptSelec.lineas.reduce((s,l)=>s+sumTo(l.real,MES_ACT)-sumTo(l.ppto,MES_ACT),0);
                          const good = dptSelec.esIngreso ? v>=0 : v<=0;
                          return <span style={{color:good?'var(--success)':'var(--danger)'}}>{sgn(v)}</span>;
                        })()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── COMPARATIVO ──────────────────────────────────────────────────── */}
      {tab === 'comparativo' && (
        <div className="card" style={{padding:0, overflowX:'auto'}}>
          <div style={{padding:'12px 16px', borderBottom:'1px solid var(--border)', fontWeight: 500, fontSize: 14}}>
            {t('presupuestos.comparisonTitle', 'Ingresos · Gastos · Utilidad — mes a mes')} {AÑO_ACT}
          </div>
          <table className="mtable" style={{minWidth:960}}>
            <thead>
              <tr>
                <th style={{width:54}}>{t('presupuestos.month', 'Mes')}</th>
                <th className="num">{t('presupuestos.revBudget', 'Ing. Ppto')}</th>
                <th className="num">{t('presupuestos.revReal', 'Ing. Real')}</th>
                <th className="num">{t('presupuestos.revVar', 'Var. ing.')}</th>
                <th className="num">{t('presupuestos.expBudget', 'Gasto Ppto')}</th>
                <th className="num">{t('presupuestos.expReal', 'Gasto Real')}</th>
                <th className="num">{t('presupuestos.expVar', 'Var. gasto')}</th>
                <th className="num">{t('presupuestos.profitBudget', 'Util. Ppto')}</th>
                <th className="num">{t('presupuestos.profitReal', 'Util. Real')}</th>
                <th className="num">{t('presupuestos.profitVar', 'Var. util.')}</th>
                <th style={{width:90}}>{t('presupuestos.exec', 'Ejec.')}</th>
              </tr>
            </thead>
            <tbody>
              {monthly.map(({ mes, m, ingPpto, ingReal, gastPpto, gastReal, utilPpto, utilReal }) => {
                const future  = m > MES_ACT;
                const varIng  = ingReal  != null ? ingReal  - ingPpto  : null;
                const varGast = gastReal != null ? gastReal - gastPpto : null;
                const varUtil = utilReal != null ? utilReal - utilPpto : null;
                const pctIng  = ingPpto > 0 && ingReal != null ? (ingReal / ingPpto) * 100 : null;
                return (
                  <tr key={m} style={{
                    opacity: future ? 0.45 : 1,
                    background: m === MES_ACT ? 'var(--accent-soft)' : ''}}>
                    <td style={{ fontWeight:500 }}>{mes}{m===MES_ACT?' ▲':''}</td>
                    <td className="num">{Qs(ingPpto)}</td>
                    <td className="num">{ingReal!=null ? Qs(ingReal) : '—'}</td>
                    <td className="num" style={{color: varIng==null?'var(--muted)':varIng>=0?'var(--success)':'var(--danger)'}}>
                      {varIng!=null ? sgn(varIng) : '—'}
                    </td>
                    <td className="num">{Qs(gastPpto)}</td>
                    <td className="num">{gastReal!=null ? Qs(gastReal) : '—'}</td>
                    <td className="num" style={{color: varGast==null?'var(--muted)':varGast<=0?'var(--success)':'var(--danger)'}}>
                      {varGast!=null ? sgn(varGast) : '—'}
                    </td>
                    <td className="num">{Qs(utilPpto)}</td>
                    <td className="num" style={{fontWeight: utilReal!=null?600:400}}>
                      {utilReal!=null ? Qs(utilReal) : '—'}
                    </td>
                    <td className="num" style={{color: varUtil==null?'var(--muted)':varUtil>=0?'var(--success)':'var(--danger)'}}>
                      {varUtil!=null ? sgn(varUtil) : '—'}
                    </td>
                    <td>
                      {pctIng != null ? (
                        <>
                          <div style={{height:5, background:'var(--border)', borderRadius:3, marginBottom:2}}>
                            <div style={{height:'100%', width:`${clamp(pctIng,0,100)}%`,
                              background: pctIng>=100?'var(--success)':'var(--accent)', borderRadius:3}}/>
                          </div>
                          <div className="code" style={{fontSize: 11}}>{pctIng.toFixed(0)}%</div>
                        </>
                      ) : <span className="muted" style={{fontSize: 11}}>{t('presupuestos.pending', 'pdte.')}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{fontWeight: 500, borderTop:'2px solid var(--border)'}}>
                <td>{t('common.total', 'Total')}</td>
                <td className="num">{Qs(monthly.reduce((s,r)=>s+r.ingPpto,0))}</td>
                <td className="num">{Qs(monthly.filter(r=>r.ingReal!=null).reduce((s,r)=>s+r.ingReal,0))}</td>
                <td/>
                <td className="num">{Qs(monthly.reduce((s,r)=>s+r.gastPpto,0))}</td>
                <td className="num">{Qs(monthly.filter(r=>r.gastReal!=null).reduce((s,r)=>s+r.gastReal,0))}</td>
                <td/>
                <td className="num">{Qs(monthly.reduce((s,r)=>s+r.utilPpto,0))}</td>
                <td className="num">{Qs(monthly.filter(r=>r.utilReal!=null).reduce((s,r)=>s+r.utilReal,0))}</td>
                <td colSpan={2}/>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ── PERÍODOS ─────────────────────────────────────────────────────── */}
      {tab === 'periodos' && (
        <div className="card" style={{padding:0, overflow:'hidden'}}>
          <div style={{padding:'12px 16px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <span style={{fontWeight: 500, fontSize: 14}}>{t('presupuestos.budgetPeriods', 'Períodos presupuestarios')}</span>
            <Button size="sm" icon="plus" variant="accent" onClick={() => pushToast?.('Nuevo período creado', 'success')}>{t('presupuestos.newPeriod', 'Nuevo período')}
            </Button>
          </div>
          <table className="mtable">
            <thead>
              <tr>
                <th>{t('presupuestos.fiscalYearCol', 'Año fiscal')}</th>
                <th>{t('common.status', 'Estado')}</th>
                <th className="num">{t('presupuestos.totalBudgeted', 'Total presupuestado')}</th>
                <th className="num">{t('presupuestos.executionPct', '% Ejecución')}</th>
                <th style={{width:120}}>{t('presupuestos.progress', 'Progreso')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {PERIODOS.map(p => (
                <tr key={p.año}>
                  <td style={{ fontWeight:500 }}>{p.año}</td>
                  <td>
                    <span className={`badge-m3 ${p.estado==='vigente'?'success':''}`}>
                      {p.estado==='vigente' ? t('presupuestos.active', '● Vigente') : t('presupuestos.closed', '✓ Cerrado')}
                    </span>
                  </td>
                  <td className="num">{Qs(p.pptoTotal)}</td>
                  <td className="num" style={{ fontWeight:500, color: p.ejec>100?'var(--danger)':'var(--success)' }}>
                    {p.ejec.toFixed(1)}%
                  </td>
                  <td>
                    <div style={{height:6, background:'var(--border)', borderRadius:3}}>
                      <div style={{height:'100%', width:`${clamp(p.ejec,0,100)}%`,
                        background: p.ejec>100?'var(--danger)':'var(--success)', borderRadius:3}}/>
                    </div>
                  </td>
                  <td>
                    <Button variant="ghost" size="sm" onClick={() => pushToast?.(`Período ${p.año}`, '')}>
                      {t('common.viewDetail', 'Ver detalle')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── DRAWER ───────────────────────────────────────────────────────── */}
      {drawer && (
        <div className="drawer-overlay" onClick={() => setDrawer(null)}>
          <div className="drawer" onClick={e => e.stopPropagation()} style={{width:460}}>
            <div className="drawer-head">
              <div>
                <div style={{fontWeight: 500, fontSize: 16}}>{drawer.nombre}</div>
                <div className="muted" style={{fontSize:11}}>{drawer.lineas.length} {t('presupuestos.lines', 'líneas')} · ene–{MESES[MES_ACT]}</div>
              </div>
              <button className="icon-btn" onClick={() => setDrawer(null)}><Icon name="x"/></button>
            </div>
            <div className="drawer-body" style={{padding:20}}>
              {(() => {
                const st   = stats[drawer.id];
                const good = drawer.esIngreso ? st.realYTD >= st.pptoYTD : st.realYTD <= st.pptoYTD;
                const bar  = clamp(st.pctEjec, 0, 100);
                return (
                  <>
                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16}}>
                      <div className="card" style={{padding:12}}>
                        <div style={{fontSize: 11, color:'var(--muted)', marginBottom:4}}>{t('presupuestos.budgetYTD', 'Presupuesto YTD')}</div>
                        <div style={{fontFamily:'var(--font-mono)', fontWeight: 500, fontSize: 16}}>{Qs(st.pptoYTD)}</div>
                      </div>
                      <div className="card" style={{padding:12, background: good?'var(--success-soft)':'var(--surface-2)'}}>
                        <div style={{fontSize: 11, color:'var(--muted)', marginBottom:4}}>{t('presupuestos.realYTD', 'Real YTD')}</div>
                        <div style={{fontFamily:'var(--font-mono)', fontWeight: 500, fontSize: 16, color: good?'var(--success)':'var(--danger)'}}>{Qs(st.realYTD)}</div>
                      </div>
                    </div>
                    <div style={{marginBottom:18}}>
                      <div style={{display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:5}}>
                        <span>{t('presupuestos.execution', 'Ejecución')} <strong>{st.pctEjec.toFixed(1)}%</strong></span>
                        <span style={{color: good?'var(--success)':'var(--danger)', fontWeight: 500}}>
                          {sgn(st.varMonto)} vs ppto
                        </span>
                      </div>
                      <div style={{height:7, background:'var(--border)', borderRadius:4}}>
                        <div style={{height:'100%', width:`${bar}%`, background: good?'var(--success)':'var(--danger)', borderRadius:4}}/>
                      </div>
                    </div>

                    <div style={{fontSize:11, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8, fontFamily:'var(--font-mono)'}}>
                      {t('presupuestos.lines', 'Líneas')}
                    </div>
                    <table className="mtable">
                      <thead>
                        <tr>
                          <th>{t('accounting.account', 'Cuenta')}</th>
                          <th className="num">{t('presupuestos.budgetYTD', 'Ppto YTD')}</th>
                          <th className="num">{t('presupuestos.realYTD', 'Real YTD')}</th>
                          <th className="num">{t('presupuestos.variationShort', 'Var.')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {drawer.lineas.map(l => {
                          const lP = sumTo(l.ppto, MES_ACT);
                          const lR = sumTo(l.real, MES_ACT);
                          const lV = lR - lP;
                          const ok = drawer.esIngreso ? lV >= 0 : lV <= 0;
                          return (
                            <tr key={l.cuenta}>
                              <td>
                                <div style={{fontSize:12}}>{l.nombre}</div>
                                <div className="code">{l.cuenta}</div>
                              </td>
                              <td className="num">{Qs(lP)}</td>
                              <td className="num">{Qs(lR)}</td>
                              <td className="num" style={{ color: ok?'var(--success)':'var(--danger)', fontWeight:500 }}>
                                {sgn(lV)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: nueva línea ───────────────────────────────────────────── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{width:460}} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{t('presupuestos.newBudgetLine', 'Nueva línea presupuestaria')}</h3>
              <button className="icon-btn" onClick={() => setShowModal(false)}><Icon name="x"/></button>
            </div>
            <div className="modal-body">
              <div className="field">
                <label>{t('presupuestos.department', 'Departamento')}</label>
                <select value={mDept} onChange={e => setMDept(e.target.value)}>
                  {DEPT_OPTIONS.map(d => <option key={d.nombre} value={d.nombre}>{d.nombre}</option>)}
                </select>
              </div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
                <div className="field">
                  <label>{t('presupuestos.accountCode', 'Código de cuenta')}</label>
                  <input type="text" placeholder="Ej. 6-030" className="mono" value={mCode} onChange={e => setMCode(e.target.value)}/>
                </div>
                <div className="field">
                  <label>{t('common.name', 'Nombre')}</label>
                  <input type="text" placeholder={t('common.description', 'Descripción')} value={mName} onChange={e => setMName(e.target.value)}/>
                </div>
              </div>
              <div className="field">
                <label>{t('presupuestos.monthlyAmount', 'Monto mensual (Q) — igual para los 12 meses')}</label>
                <input type="number" placeholder="0.00" style={{fontFamily:'var(--font-mono)'}} value={mAmount} onChange={e => setMAmount(e.target.value)}/>
              </div>
            </div>
            <div className="modal-foot">
              <Button onClick={() => setShowModal(false)}>{t('common.cancel', 'Cancelar')}</Button>
              <Button icon="check" variant="accent" disabled={!mName || !mAmount} onClick={handleAddLine}>{t('common.save', 'Guardar')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
