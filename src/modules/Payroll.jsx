// Stackline — Payroll / Planilla module (Guatemala)
import React, { useState, useMemo } from 'react';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import StatCard from '../components/StatCard.jsx';
import { useTranslation } from 'react-i18next';
import { useEmployees, usePayrollPeriods } from '../hooks/usePayroll.js';
import { generatePayroll, closePayroll, payrollIgssReport, payrollIsrReport, createEmployee } from '../api/wave3.js';

const Q = (n) => `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── Constantes Guatemala ────────────────────────────────────────────────────
const IGSS_EMP   = 0.0483;   // Decreto 295 — cuota empleado
const IGSS_PAT   = 0.1067;   // Decreto 295 — cuota patronal
const BON_INC    = 250;      // Decreto 78-89 — bonificación incentivo mensual
const EXENTO_ISR = 48000;    // Q48,000 anuales exentos
const DED_GMED   = 12000;    // Gastos médicos deducibles anuales
const TASA_ISR_1 = 0.05;     // 5% hasta Q300,000
const TASA_ISR_2 = 0.07;     // 7% sobre exceso de Q300,000
const UMBRAL_ISR = 300000;

const DEPARTAMENTOS = ['Operaciones', 'Administración', 'Bodega', 'Ventas', 'Contabilidad'];
const PUESTOS_BY_DEPT = {
  Operaciones:   ['Cajero', 'Supervisor de caja', 'Asistente operativo'],
  Administración:['Gerente administrativo', 'Asistente administrativo', 'Recepcionista'],
  Bodega:        ['Bodeguero', 'Auxiliar de bodega', 'Jefe de bodega'],
  Ventas:        ['Vendedor', 'Supervisor de ventas', 'Ejecutivo de cuenta'],
  Contabilidad:  ['Contador', 'Auxiliar contable', 'Jefe de finanzas'],
};

const EMPLOYEES = [
  { id:'EMP-001', name:'Carlos Méndez López',     dept:'Operaciones',    pos:'Cajero',               salary:4500,  status:'active', hired:'2023-01-15', dpi:'2456789012345', nit:'1234567-8', banco:'Industrial',  cuenta:'4120-xxxxx' },
  { id:'EMP-002', name:'María García Pérez',       dept:'Operaciones',    pos:'Supervisor de caja',   salary:6800,  status:'active', hired:'2021-06-01', dpi:'3456789012346', nit:'2345678-9', banco:'BAC',         cuenta:'0102-xxxxx' },
  { id:'EMP-003', name:'José Ramírez Fuentes',     dept:'Bodega',         pos:'Jefe de bodega',       salary:5200,  status:'active', hired:'2022-03-10', dpi:'1234567890123', nit:'3456789-0', banco:'Industrial',  cuenta:'4131-xxxxx' },
  { id:'EMP-004', name:'Ana López Castillo',       dept:'Administración', pos:'Asistente administrativo', salary:5500, status:'active', hired:'2020-08-22', dpi:'9876543210987', nit:'4567890-1', banco:'G&T',      cuenta:'0201-xxxxx' },
  { id:'EMP-005', name:'Pedro Morales Cifuentes',  dept:'Ventas',         pos:'Ejecutivo de cuenta',  salary:4800,  status:'active', hired:'2023-04-05', dpi:'5678901234567', nit:'5678901-2', banco:'Banrural',    cuenta:'1301-xxxxx' },
  { id:'EMP-006', name:'Lucía Herrera Vásquez',    dept:'Contabilidad',   pos:'Auxiliar contable',    salary:5000,  status:'active', hired:'2022-11-01', dpi:'6789012345678', nit:'6789012-3', banco:'BAC',         cuenta:'0108-xxxxx' },
  { id:'EMP-007', name:'Roberto Juárez Pérez',     dept:'Bodega',         pos:'Auxiliar de bodega',   salary:3500,  status:'active', hired:'2024-01-08', dpi:'7890123456789', nit:'7890123-4', banco:'Industrial',  cuenta:'4145-xxxxx' },
  { id:'EMP-008', name:'Carmen Solís Armas',       dept:'Ventas',         pos:'Vendedor',             salary:4200,  status:'inactive', hired:'2021-09-14', dpi:'8901234567890', nit:'8901234-5', banco:'G&T',       cuenta:'0215-xxxxx' },
];

// ── Cálculo de planilla Guatemala ──────────────────────────────────────────
function calcPayroll(emp) {
  const base   = emp.salary;
  const bon    = BON_INC;
  const igssE  = base * IGSS_EMP;
  const igssP  = base * IGSS_PAT;

  // ISR en relación de dependencia (régimen general)
  const salAnual   = base * 12;
  const igssAnual  = igssE * 12;
  const rentaGraba = Math.max(0, salAnual - EXENTO_ISR - igssAnual - DED_GMED);
  let isrAnual = 0;
  if (rentaGraba <= UMBRAL_ISR) {
    isrAnual = rentaGraba * TASA_ISR_1;
  } else {
    isrAnual = UMBRAL_ISR * TASA_ISR_1 + (rentaGraba - UMBRAL_ISR) * TASA_ISR_2;
  }
  const isrM = isrAnual / 12;

  const deducc  = igssE + isrM;
  const neto    = base + bon - deducc;
  const totalEmp = base + bon + igssP;

  return { base, bon, igssE, igssP, isrM, deducc, neto, totalEmp,
           isrAnual, rentaGraba };
}

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// Abre una ventana nueva con SOLO el contenido indicado y dispara la impresión
// (evita imprimir toda la app como un screenshot).
function printHTML(title, innerHTML) {
  const w = window.open('', '_blank', 'width=980,height=680');
  if (!w) { alert('Permite las ventanas emergentes para imprimir.'); return; }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
    <style>
      *{box-sizing:border-box;} body{font-family:system-ui,-apple-system,Arial,sans-serif;color:#111;padding:26px;font-size:12px;margin:0;}
      h1{font-size:16px;margin:0 0 2px;} .sub{color:#666;font-size:11px;margin-bottom:18px;}
      table{width:100%;border-collapse:collapse;} caption{caption-side:top;text-align:left;}
      th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;font-size:11px;}
      th{background:#f2f2f2;font-size:10px;text-transform:uppercase;letter-spacing:.04em;}
      td.num,th.num{text-align:right;font-variant-numeric:tabular-nums;font-family:ui-monospace,monospace;}
      tfoot td{font-weight:700;background:#fafafa;}
      @media print{body{padding:0;}}
    </style></head><body>${innerHTML}<script>window.onload=function(){window.print();}</script></body></html>`);
  w.document.close();
}

const PAYROLL_HISTORY = [
  { id:'PL-2026-04', month:3,  year:2026, period:'Abril 2026',     status:'cerrada', total:45820.50, employees:7 },
  { id:'PL-2026-03', month:2,  year:2026, period:'Marzo 2026',     status:'cerrada', total:45820.50, employees:7 },
  { id:'PL-2026-02', month:1,  year:2026, period:'Febrero 2026',   status:'cerrada', total:45820.50, employees:7 },
  { id:'PL-2026-01', month:0,  year:2026, period:'Enero 2026',     status:'cerrada', total:45820.50, employees:7 },
];

// ══════════════════════════════════════════════════════════════════════════════
export default function Payroll({ pushToast }) {
  const { t } = useTranslation();
  const { items: EMPLOYEES, reload: reloadEmployees } = useEmployees();
  const { items: PAYROLL_HISTORY, reload: reloadHistory } = usePayrollPeriods();
  const [tab, setTab] = useState('planilla');
  const [selEmp, setSelEmp] = useState(null);
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [showRecibo, setShowRecibo] = useState(null);
  const [showGenModal, setShowGenModal] = useState(false);
  const [genPeriod, setGenPeriod] = useState(null);   // período generado (procesado)
  const [genBusy, setGenBusy] = useState(false);
  const [report, setReport] = useState(null);         // { type:'igss'|'isr', data }
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('todos');

  const now = new Date();
  const curMonth = now.getMonth();
  const curYear  = now.getFullYear();
  const periodLabel = `${MONTHS[curMonth]} ${curYear}`;

  const activeEmps = EMPLOYEES.filter(e => e.status === 'active');

  const rows = useMemo(() =>
    activeEmps.map(e => ({ ...e, calc: calcPayroll(e) })),
    [EMPLOYEES] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const summary = useMemo(() => ({
    totalBase:    rows.reduce((s, r) => s + r.calc.base,    0),
    totalBon:     rows.reduce((s, r) => s + r.calc.bon,     0),
    totalIgssE:   rows.reduce((s, r) => s + r.calc.igssE,   0),
    totalIgssP:   rows.reduce((s, r) => s + r.calc.igssP,   0),
    totalIsr:     rows.reduce((s, r) => s + r.calc.isrM,    0),
    totalNeto:    rows.reduce((s, r) => s + r.calc.neto,    0),
    totalEmpresa: rows.reduce((s, r) => s + r.calc.totalEmp,0),
  }), [rows]);

  const filteredEmps = EMPLOYEES.filter(e => {
    if (search && !e.name.toLowerCase().includes(search.toLowerCase()) &&
        !e.id.toLowerCase().includes(search.toLowerCase())) return false;
    if (deptFilter !== 'todos' && e.dept !== deptFilter) return false;
    return true;
  });

  const periodCode = `PL-${curYear}-${String(curMonth + 1).padStart(2, '0')}`;

  // Genera y procesa la planilla del mes (idempotente en backend). Deja el
  // período disponible para consultar IGSS/SAT o cerrarlo.
  const handleGenerar = async () => {
    setGenBusy(true);
    try {
      const period = await generatePayroll({ periodCode, name: periodLabel, month: curMonth + 1, year: curYear });
      setGenPeriod(period);
      pushToast && pushToast(`Planilla ${periodLabel} generada — ${period.employeeCount} empleados procesados`, 'success');
      reloadHistory();
    } catch (err) {
      pushToast && pushToast('No se pudo generar la planilla: ' + err.message, 'error');
    } finally { setGenBusy(false); }
  };

  const handleCerrarPlanilla = async () => {
    if (!genPeriod) { pushToast && pushToast('Primero genera la planilla', 'danger'); return; }
    setGenBusy(true);
    try {
      await closePayroll(genPeriod.id);
      pushToast && pushToast(`Planilla ${periodLabel} cerrada y enviada a contabilidad`, 'success');
      setShowGenModal(false);
      setGenPeriod(null);
      reloadHistory();
    } catch (err) {
      pushToast && pushToast('No se pudo cerrar la planilla: ' + err.message, 'error');
    } finally { setGenBusy(false); }
  };

  // Reportes IGSS / SAT-ISR de un período ya procesado.
  const openReport = async (periodId, type) => {
    try {
      const data = type === 'igss' ? await payrollIgssReport(periodId) : await payrollIsrReport(periodId);
      setReport({ type, data });
    } catch (err) {
      pushToast && pushToast('No se pudo obtener el reporte: ' + err.message, 'error');
    }
  };

  const handleCreateEmployee = async (emp) => {
    try {
      await createEmployee({
        employeeCode: emp.code, name: emp.name, department: emp.dept, position: emp.pos,
        salary: Number(emp.salary || 0), status: 'active', hiredDate: emp.hired || null,
        dpi: emp.dpi, nit: emp.nit, bankName: emp.banco, bankAccount: emp.cuenta,
      });
      pushToast && pushToast(`Empleado ${emp.name} creado`, 'success');
      setShowEmpModal(false);
      reloadEmployees();
    } catch (err) {
      pushToast && pushToast('No se pudo crear el empleado: ' + err.message, 'error');
    }
  };

  // Imprime SOLO la tabla de la planilla del período actual.
  const printPlanilla = () => {
    const head = ['Empleado', 'Puesto', 'Salario base', 'Bon. incentivo', 'IGSS emp.', 'ISR mensual',
      'Total deducc.', 'Neto a pagar', 'IGSS patronal', 'Costo empresa'];
    const body = rows.map(r => `<tr>
      <td>${r.name}<br><span style="color:#888;font-size:9px">${r.id}</span></td>
      <td>${r.pos}</td>
      <td class="num">${Q(r.calc.base)}</td>
      <td class="num">${Q(r.calc.bon)}</td>
      <td class="num">-${Q(r.calc.igssE)}</td>
      <td class="num">-${Q(r.calc.isrM)}</td>
      <td class="num">-${Q(r.calc.deducc)}</td>
      <td class="num">${Q(r.calc.neto)}</td>
      <td class="num">${Q(r.calc.igssP)}</td>
      <td class="num">${Q(r.calc.totalEmp)}</td></tr>`).join('');
    const foot = `<tr>
      <td colspan="2">Totales (${activeEmps.length} empleados)</td>
      <td class="num">${Q(summary.totalBase)}</td>
      <td class="num">${Q(summary.totalBon)}</td>
      <td class="num">-${Q(summary.totalIgssE)}</td>
      <td class="num">-${Q(summary.totalIsr)}</td>
      <td class="num">-${Q(summary.totalIgssE + summary.totalIsr)}</td>
      <td class="num">${Q(summary.totalNeto)}</td>
      <td class="num">${Q(summary.totalIgssP)}</td>
      <td class="num">${Q(summary.totalEmpresa)}</td></tr>`;
    printHTML(`Planilla ${periodLabel}`, `
      <h1>Planilla de sueldos — ${periodLabel}</h1>
      <div class="sub">Cálculos según Decreto 295 (IGSS) y Ley del ISR de Guatemala</div>
      <table><thead><tr>${head.map((h, i) => `<th class="${i>= 2 ? 'num' : ''}">${h}</th>`).join('')}</tr></thead>
      <tbody>${body}</tbody><tfoot>${foot}</tfoot></table>`);
  };

  // Exporta la planilla actual (preview) a CSV abrible en Excel.
  const exportPlanillaCsv = () => {
    const headers = ['Codigo', 'Empleado', 'Puesto', 'Departamento', 'Salario base', 'Bonificacion',
      'IGSS empleado', 'ISR mensual', 'Total deducciones', 'Neto a pagar', 'IGSS patronal', 'Costo empresa'];
    const lines = rows.map(r => [
      r.id, r.name, r.pos, r.dept,
      r.calc.base.toFixed(2), r.calc.bon.toFixed(2), r.calc.igssE.toFixed(2), r.calc.isrM.toFixed(2),
      r.calc.deducc.toFixed(2), r.calc.neto.toFixed(2), r.calc.igssP.toFixed(2), r.calc.totalEmp.toFixed(2),
    ]);
    const csv = [headers, ...lines]
      .map(row => row.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `planilla-${periodCode}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast && pushToast('Planilla exportada a CSV', 'success');
  };

  // Desde "Planilla actual" (preview): asegura que el período del mes exista
  // y esté procesado en el backend, y luego abre el reporte IGSS o SAT.
  const openReportForCurrent = async (type) => {
    setGenBusy(true);
    try {
      let period = genPeriod;
      if (!period) {
        period = await generatePayroll({ periodCode, name: periodLabel, month: curMonth + 1, year: curYear });
        setGenPeriod(period);
        reloadHistory();
      }
      await openReport(period.id, type);
    } catch (err) {
      pushToast && pushToast('No se pudo generar el reporte: ' + err.message, 'error');
    } finally { setGenBusy(false); }
  };

  return (
    <div className="page">
      {/* Header */}
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('payroll.title', 'Planilla')} · {t('payroll.nomina', 'Nómina')}</h1>
          <div className="page-subtitle">
            {t('payroll.currentPeriod', 'Período actual')}: {periodLabel} · {activeEmps.length} {t('payroll.activeEmployees', 'empleados activos')} · IGSS · ISR · {t('payroll.incentiveBonus', 'Bonificación incentivo')}
          </div>
        </div>
        <div className="page-head-actions">
          <Button icon="plus" variant="accent" onClick={() => setShowEmpModal(true)}>{t('payroll.newEmployee', 'Nuevo empleado')}
          </Button>
          <Button icon="receipt" variant="accent" onClick={() => { setGenPeriod(null); setShowGenModal(true); }}>{t('payroll.generatePayroll', 'Generar planilla')}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {[
          { id:'planilla',   label: t('payroll.tabs.current', 'Planilla actual') },
          { id:'empleados',  label: `${t('payroll.tabs.employees', 'Empleados')} (${EMPLOYEES.length})` },
          { id:'historial',  label: t('payroll.tabs.history', 'Historial') },
          { id:'calculo',    label: t('payroll.tabs.calc', 'Tabla ISR / IGSS') },
        ].map(t2 => (
          <button key={t2.id} className={`tab ${tab === t2.id ? 'active' : ''}`}
            onClick={() => setTab(t2.id)}>{t2.label}</button>
        ))}
      </div>

      {/* ── TAB: PLANILLA ACTUAL ── */}
      {tab === 'planilla' && (
        <>
          {/* KPIs */}
          <div className="stat-grid" style={{ gridTemplateColumns:'repeat(4,1fr)', marginBottom:16 }}>
            <StatCard
              icon="cash" tone="pri"
              label={t('payroll.baseSalaries', 'Salarios base')}
              value={Q(summary.totalBase)}
              trend={{ dir: 'up', label: <>{activeEmps.length} {t('payroll.employees', 'empleados')}</>, icon: 'users' }}
            />
            <StatCard
              icon="shield" tone="ter"
              label={t('payroll.igssEmployer', 'IGSS patronal')}
              value={Q(summary.totalIgssP)}
              foot={<>10.67% · {t('payroll.companyShare', 'cuota empresa')}</>}
            />
            <StatCard
              icon="receipt" tone="sec"
              label={t('payroll.isrRetention', 'ISR retención')}
              value={Q(summary.totalIsr)}
              foot={t('payroll.monthlyRetention', 'Retención mensual empleados')}
            />
            <StatCard
              icon="cash" tone="err"
              label={t('payroll.totalCompanyCost', 'Costo total empresa')}
              valueColor={'var(--accent)'}
              value={Q(summary.totalEmpresa)}
              foot={t('payroll.baseBonIgss', 'Base + Bon + IGSS pat.')}
            />
          </div>

          {/* Tabla planilla */}
          <div className="card">
            <div className="card-head">
              <div>
                <h3>{t('payroll.payrollDetail', 'Detalle de planilla')} — {periodLabel}</h3>
                <div className="meta">{t('payroll.calculationsNote', 'Todos los cálculos según Decreto 295 (IGSS) y Ley ISR Guatemala')}</div>
              </div>
              <div className="row gap-6">
                <Button icon="download" size="sm" disabled={rows.length === 0} onClick={exportPlanillaCsv}>Excel
                </Button>
                <Button icon="print" size="sm" disabled={rows.length === 0} onClick={printPlanilla}>{t('common.print', 'Imprimir')}
                </Button>
              </div>
            </div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>{t('payroll.headers.employee', 'Empleado')}</th>
                    <th>{t('payroll.headers.position', 'Puesto')}</th>
                    <th className="num">{t('payroll.headers.baseSalary', 'Salario base')}</th>
                    <th className="num">{t('payroll.headers.bonIncentive', 'Bon. incentivo')}</th>
                    <th className="num">{t('payroll.headers.igssEmployee', 'IGSS emp. (4.83%)')}</th>
                    <th className="num">{t('payroll.headers.monthlyIsr', 'ISR mensual')}</th>
                    <th className="num">{t('payroll.headers.totalDeductions', 'Total deducc.')}</th>
                    <th className="num" style={{color:'var(--success)'}}>{t('payroll.headers.netPay', 'Neto a pagar')}</th>
                    <th className="num" style={{color:'var(--muted)'}}>{t('payroll.headers.igssEmployer', 'IGSS pat. (10.67%)')}</th>
                    <th className="num" style={{color:'var(--accent)'}}>{t('payroll.headers.companyCost', 'Costo empresa')}</th>
                    <th className="center">{t('payroll.headers.receipt', 'Recibo')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id}>
                      <td>
                        <div style={{fontWeight:500}}>{r.name}</div>
                        <div className="code muted" style={{fontSize: 11}}>{r.id}</div>
                      </td>
                      <td>
                        <div>{r.pos}</div>
                        <div className="muted" style={{fontSize: 11}}>{r.dept}</div>
                      </td>
                      <td className="num">{Q(r.calc.base)}</td>
                      <td className="num" style={{color:'var(--success)'}}>{Q(r.calc.bon)}</td>
                      <td className="num" style={{color:'var(--danger)'}}>−{Q(r.calc.igssE)}</td>
                      <td className="num" style={{color:'var(--danger)'}}>−{Q(r.calc.isrM)}</td>
                      <td className="num" style={{ color:'var(--danger)', fontWeight:500 }}>−{Q(r.calc.deducc)}</td>
                      <td className="num" style={{ color:'var(--success)', fontWeight:500 }}>{Q(r.calc.neto)}</td>
                      <td className="num" style={{color:'var(--muted)'}}>{Q(r.calc.igssP)}</td>
                      <td className="num" style={{ color:'var(--accent)', fontWeight:500 }}>{Q(r.calc.totalEmp)}</td>
                      <td className="center">
                        <Button icon="receipt" variant="ghost" size="sm" onClick={() => setShowRecibo(r)}>{t('common.view', 'Ver')}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{background:'var(--surface-2)', fontWeight: 500}}>
                    <td colSpan={2} style={{ padding:'8px 12px' }}>{t('payroll.totals', 'TOTALES')}</td>
                    <td className="num" style={{padding:'8px 12px'}}>{Q(summary.totalBase)}</td>
                    <td className="num" style={{padding:'8px 12px', color:'var(--success)'}}>{Q(summary.totalBon)}</td>
                    <td className="num" style={{padding:'8px 12px', color:'var(--danger)'}}>−{Q(summary.totalIgssE)}</td>
                    <td className="num" style={{padding:'8px 12px', color:'var(--danger)'}}>−{Q(summary.totalIsr)}</td>
                    <td className="num" style={{padding:'8px 12px', color:'var(--danger)'}}>−{Q(summary.totalIgssE + summary.totalIsr)}</td>
                    <td className="num" style={{padding:'8px 12px', color:'var(--success)'}}>{Q(summary.totalNeto)}</td>
                    <td className="num" style={{padding:'8px 12px', color:'var(--muted)'}}>{Q(summary.totalIgssP)}</td>
                    <td className="num" style={{padding:'8px 12px', color:'var(--accent)'}}>{Q(summary.totalEmpresa)}</td>
                    <td/>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Resumen cuotas IGSS para pagar al estado */}
          <div className="grid-2 mt-12" style={{gridTemplateColumns:'1fr 1fr'}}>
            <div className="card">
              <div className="card-head"><h3>{t('payroll.igssLiquidation', 'Liquidación IGSS del período')}</h3></div>
              <div className="card-body">
                <div className="detail-grid">
                  <div className="detail-row">
                    <span className="detail-label">{t('payroll.employeeShare483', 'Cuota empleados (4.83%)')}</span>
                    <span className="mono">{Q(summary.totalIgssE)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">{t('payroll.employerShare1067', 'Cuota patronal (10.67%)')}</span>
                    <span className="mono">{Q(summary.totalIgssP)}</span>
                  </div>
                  <div className="detail-row" style={{fontWeight: 500}}>
                    <span className="detail-label">{t('payroll.totalToIgss', 'Total a pagar al IGSS')}</span>
                    <span className="mono" style={{color:'var(--accent)'}}>{Q(summary.totalIgssE + summary.totalIgssP)}</span>
                  </div>
                </div>
                <Button icon="receipt" variant="accent" style={{marginTop:12, width:'100%' }} disabled={genBusy || activeEmps.length === 0} onClick={() => openReportForCurrent('igss')}>{t('payroll.generateIgssPayroll', 'Generar planilla IGSS')}
                </Button>
              </div>
            </div>
            <div className="card">
              <div className="card-head"><h3>{t('payroll.isrRetentionPeriod', 'Retención ISR del período')}</h3></div>
              <div className="card-body">
                <div className="detail-grid">
                  <div className="detail-row">
                    <span className="detail-label">{t('payroll.isrRetainedEmployees', 'ISR retenido empleados')}</span>
                    <span className="mono">{Q(summary.totalIsr)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">{t('payroll.declarationDue', 'Vencimiento declaración')}</span>
                    <span className="mono">{t('payroll.tenthNextMonth', '10 del mes siguiente')}</span>
                  </div>
                  <div className="detail-row" style={{fontWeight: 500}}>
                    <span className="detail-label">{t('payroll.totalToSat', 'Total a pagar a la SAT')}</span>
                    <span className="mono" style={{color:'var(--accent)'}}>{Q(summary.totalIsr)}</span>
                  </div>
                </div>
                <Button icon="receipt" variant="accent" style={{marginTop:12, width:'100%' }} disabled={genBusy || activeEmps.length === 0} onClick={() => openReportForCurrent('isr')}>{t('payroll.generateSatForm', 'Generar formulario SAT')}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── TAB: EMPLEADOS ── */}
      {tab === 'empleados' && (
        <>
          <div className="toolbar">
            <div className="search-wrap" style={{flex:1, maxWidth:320}}>
              <Icon name="search" size={13} className="icon"/>
              <input className="search-input" placeholder={t('payroll.searchEmployee', 'Buscar empleado…')}
                value={search} onChange={e => setSearch(e.target.value)}/>
            </div>
            <select className="field-input" value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)} style={{width:'auto'}}>
              <option value="todos">{t('payroll.allDepartments', 'Todos los departamentos')}</option>
              {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <span className="muted" style={{fontSize:11, marginLeft:'auto'}}>
              {filteredEmps.length} {t('payroll.employees', 'empleados')}
            </span>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>{t('common.name', 'Nombre')}</th>
                  <th>{t('payroll.headers.department', 'Departamento')}</th>
                  <th>{t('payroll.headers.position', 'Puesto')}</th>
                  <th className="num">{t('payroll.headers.baseSalary', 'Salario base')}</th>
                  <th className="num">{t('payroll.headers.estimatedNet', 'Neto estimado')}</th>
                  <th>{t('payroll.headers.bank', 'Banco')}</th>
                  <th>{t('common.status', 'Estado')}</th>
                  <th>{t('payroll.headers.hireDate', 'Ingreso')}</th>
                  <th/>
                </tr>
              </thead>
              <tbody>
                {filteredEmps.map(e => {
                  const c = calcPayroll(e);
                  return (
                    <tr key={e.id} className="clickable" onClick={() => setSelEmp(e)}>
                      <td className="mono">{e.id}</td>
                      <td style={{fontWeight:500}}>{e.name}</td>
                      <td>{e.dept}</td>
                      <td className="muted">{e.pos}</td>
                      <td className="num">{Q(e.salary)}</td>
                      <td className="num" style={{ color:'var(--success)', fontWeight:500 }}>{Q(c.neto)}</td>
                      <td className="muted">{e.banco}</td>
                      <td>
                        <span className={`badge-m3 ${e.status === 'active' ? 'success' : 'warning'}`}>
                          <span className="dot"/>
                          {e.status === 'active' ? t('common.active', 'Activo') : t('common.inactive', 'Inactivo')}
                        </span>
                      </td>
                      <td className="mono muted">{e.hired}</td>
                      <td>
                        <Button icon="edit" variant="ghost" size="sm" onClick={ev => { ev.stopPropagation(); setSelEmp(e); }} />
                      </td>
                    </tr>
                  );
                })}
                {filteredEmps.length === 0 && (
                  <tr><td colSpan={10} className="empty">{t('payroll.noEmployees', 'Sin empleados')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── TAB: HISTORIAL ── */}
      {tab === 'historial' && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('payroll.headers.payrollNo', 'No. Planilla')}</th>
                <th>{t('payroll.headers.period', 'Período')}</th>
                <th className="num">{t('payroll.headers.employees', 'Empleados')}</th>
                <th className="num">{t('payroll.headers.totalPayroll', 'Total nómina')}</th>
                <th>{t('common.status', 'Estado')}</th>
                <th/>
              </tr>
            </thead>
            <tbody>
              {PAYROLL_HISTORY.map(p => (
                <tr key={p.id}>
                  <td className="mono">{p.id}</td>
                  <td style={{fontWeight:500}}>{p.period}</td>
                  <td className="num">{p.employees}</td>
                  <td className="num" style={{ fontWeight:500 }}>{Q(p.total)}</td>
                  <td><span className="badge-m3 success"><span className="dot"/>{t('payroll.closed', 'Cerrada')}</span></td>
                  <td>
                    <div className="row gap-6">
                      <Button icon="shield" variant="ghost" size="sm" onClick={() => openReport(p.backendId, 'igss')}>IGSS
                      </Button>
                      <Button icon="receipt" variant="ghost" size="sm" onClick={() => openReport(p.backendId, 'isr')}>SAT
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── TAB: TABLA CÁLCULOS ── */}
      {tab === 'calculo' && (
        <div className="grid-2 mt-12" style={{gridTemplateColumns:'1fr 1fr', gap:16}}>
          <div className="card">
            <div className="card-head"><h3>{t('payroll.igssRates', 'Tasas IGSS vigentes · Decreto 295')}</h3></div>
            <div className="card-body">
              <table className="tbl">
                <thead><tr><th>{t('payroll.concept', 'Concepto')}</th><th className="num">{t('payroll.rate', 'Tasa')}</th><th>{t('payroll.chargedTo', 'Cargo a')}</th></tr></thead>
                <tbody>
                  <tr><td>{t('payroll.employeeShareIvs', 'Cuota empleado (IVS)')}</td><td className="num">4.83%</td><td>{t('payroll.employee', 'Empleado')}</td></tr>
                  <tr><td>{t('payroll.employerShareIvs', 'Cuota patronal (IVS)')}</td><td className="num">10.67%</td><td>{t('payroll.company', 'Empresa')}</td></tr>
                  <tr><td>{t('payroll.incentiveBonus', 'Bonificación incentivo')}</td><td className="num">Q 250.00/mes</td><td>{t('payroll.companyDecree', 'Empresa · Decreto 78-89')}</td></tr>
                </tbody>
              </table>
              <div className="alert" style={{marginTop:12}}>
                <Icon name="alert" size={13}/>
                {t('payroll.calcBaseNote', 'Base de cálculo: salario ordinario mensual. Excluye horas extra y bonificaciones variables.')}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3>{t('payroll.isrRates', 'ISR en relación de dependencia · Ley ISR')}</h3></div>
            <div className="card-body">
              <table className="tbl">
                <thead><tr><th>{t('payroll.concept', 'Concepto')}</th><th className="num">{t('payroll.annualValue', 'Valor anual')}</th></tr></thead>
                <tbody>
                  <tr><td>{t('payroll.exemptIncome', 'Renta exenta')}</td><td className="num">Q 48,000</td></tr>
                  <tr><td>{t('payroll.medicalDeduction', 'Ded. gastos médicos')}</td><td className="num">Q 12,000</td></tr>
                  <tr><td>{t('payroll.igssPaid', 'Cuotas IGSS pagadas')}</td><td className="num">{t('payroll.variable', 'Variable')}</td></tr>
                  <tr><td style={{borderTop:'2px solid var(--border)', paddingTop:8}}>{t('payroll.rate1', 'Tasa 1 (hasta Q300,000)')}</td><td className="num" style={{borderTop:'2px solid var(--border)', paddingTop:8}}>5%</td></tr>
                  <tr><td>{t('payroll.rate2', 'Tasa 2 (sobre Q300,000)')}</td><td className="num">7%</td></tr>
                </tbody>
              </table>
              <div className="detail-row" style={{marginTop:12, padding:'8px 0', borderTop:'1px solid var(--border)'}}>
                <span className="detail-label">{t('payroll.netFormula', 'Fórmula neta mensual')}</span>
                <span style={{fontSize:11, fontFamily:'var(--font-mono)', color:'var(--text-2)'}}>
                  Base + Bon − IGSS emp − ISR
                </span>
              </div>
            </div>
          </div>

          {/* Simulador por empleado */}
          <div className="card" style={{gridColumn:'1 / -1'}}>
            <div className="card-head"><h3>{t('payroll.salarySimulator', 'Simulador de cálculo por salario')}</h3></div>
            <div className="card-body">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>{t('payroll.headers.baseSalary', 'Salario base')}</th>
                    <th className="num">{t('payroll.headers.bonIncentiveShort', 'Bon. inc.')}</th>
                    <th className="num">{t('payroll.headers.igssEmpShort', 'IGSS emp.')}</th>
                    <th className="num">{t('payroll.headers.monthlyIsr', 'ISR mensual')}</th>
                    <th className="num">{t('payroll.headers.netEmployee', 'Neto empleado')}</th>
                    <th className="num">{t('payroll.headers.igssEmployer', 'IGSS patronal')}</th>
                    <th className="num">{t('payroll.headers.companyCost', 'Costo empresa')}</th>
                  </tr>
                </thead>
                <tbody>
                  {[3000,3500,4000,4500,5000,6000,7000,8000,10000,15000].map(sal => {
                    const c = calcPayroll({ salary: sal });
                    return (
                      <tr key={sal}>
                        <td className="num mono">{Q(sal)}</td>
                        <td className="num" style={{color:'var(--success)'}}>{Q(c.bon)}</td>
                        <td className="num" style={{color:'var(--danger)'}}>−{Q(c.igssE)}</td>
                        <td className="num" style={{color:'var(--danger)'}}>−{Q(c.isrM)}</td>
                        <td className="num" style={{ color:'var(--success)', fontWeight:500 }}>{Q(c.neto)}</td>
                        <td className="num" style={{color:'var(--muted)'}}>{Q(c.igssP)}</td>
                        <td className="num" style={{ color:'var(--accent)', fontWeight:500 }}>{Q(c.totalEmp)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── DRAWER: Detalle empleado ── */}
      {selEmp && (
        <>
          <div className="drawer-overlay" onClick={() => setSelEmp(null)}/>
          <div className="drawer" style={{width:520}}>
            <div className="drawer-head">
              <div>
                <div className="drawer-title">{selEmp.name}</div>
                <div className="muted" style={{fontSize:11, marginTop:2}}>{selEmp.id} · {selEmp.pos}</div>
              </div>
              <button className="icon-btn" onClick={() => setSelEmp(null)}><Icon name="x"/></button>
            </div>
            <div className="drawer-body">
              {/* Status */}
              <div className="row" style={{marginBottom:16, gap:8}}>
                <span className={`badge-m3 ${selEmp.status === 'active' ? 'success' : 'warning'}`}>
                  <span className="dot"/>{selEmp.status === 'active' ? t('common.active', 'Activo') : t('common.inactive', 'Inactivo')}
                </span>
                <span className="badge-m3">{selEmp.dept}</span>
              </div>

              {/* Datos personales */}
              <div style={{fontFamily:'var(--font-mono)', fontSize: 11, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8}}>{t('payroll.personalData', 'Datos personales')}</div>
              <div className="detail-grid" style={{marginBottom:20}}>
                {[
                  ['DPI', selEmp.dpi],
                  ['NIT', selEmp.nit],
                  [t('payroll.hireDate', 'Fecha de ingreso'), selEmp.hired],
                  [t('payroll.bank', 'Banco'), selEmp.banco],
                  [t('payroll.accountNo', 'No. cuenta'), selEmp.cuenta],
                ].map(([l,v]) => (
                  <div className="detail-row" key={l}>
                    <span className="detail-label">{l}</span>
                    <span className="mono" style={{fontSize:12}}>{v}</span>
                  </div>
                ))}
              </div>

              {/* Cálculo salarial */}
              {(() => {
                const c = calcPayroll(selEmp);
                return (
                  <>
                    <div style={{fontFamily:'var(--font-mono)', fontSize: 11, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8}}>{t('payroll.monthlySalaryBreakdown', 'Desglose salarial mensual')}</div>
                    <div className="card" style={{marginBottom:16}}>
                      <div className="card-body" style={{padding:0}}>
                        <table className="tbl">
                          <tbody>
                            <tr><td>{t('payroll.headers.baseSalary', 'Salario base')}</td><td className="num">{Q(c.base)}</td></tr>
                            <tr><td style={{color:'var(--success)'}}>+ {t('payroll.incentiveBonus', 'Bonificación incentivo')}</td><td className="num" style={{color:'var(--success)'}}>{Q(c.bon)}</td></tr>
                            <tr><td style={{color:'var(--danger)'}}>− {t('payroll.igssEmployee483', 'IGSS empleado (4.83%)')}</td><td className="num" style={{color:'var(--danger)'}}>−{Q(c.igssE)}</td></tr>
                            <tr><td style={{color:'var(--danger)'}}>− {t('payroll.isrMonthlyRetained', 'ISR mensual retenido')}</td><td className="num" style={{color:'var(--danger)'}}>−{Q(c.isrM)}</td></tr>
                            <tr style={{background:'var(--surface-2)', fontWeight: 500}}>
                              <td style={{padding:'9px 12px'}}>{t('payroll.headers.netPay', 'Neto a pagar')}</td>
                              <td className="num" style={{ padding:'9px 12px', color:'var(--success)' }}>{Q(c.neto)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div style={{fontFamily:'var(--font-mono)', fontSize: 11, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8}}>{t('payroll.companyCostSection', 'Costo para la empresa')}</div>
                    <div className="detail-grid">
                      <div className="detail-row">
                        <span className="detail-label">{t('payroll.salaryPlusBonus', 'Salario + bonificación')}</span>
                        <span className="mono">{Q(c.base + c.bon)}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">{t('payroll.igssEmployer1067', 'IGSS patronal (10.67%)')}</span>
                        <span className="mono">{Q(c.igssP)}</span>
                      </div>
                      <div className="detail-row" style={{fontWeight: 500}}>
                        <span className="detail-label">{t('payroll.totalMonthlyCost', 'Costo total mensual')}</span>
                        <span className="mono" style={{color:'var(--accent)'}}>{Q(c.totalEmp)}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">{t('payroll.estimatedAnnualCost', 'Costo anual estimado')}</span>
                        <span className="mono">{Q(c.totalEmp * 14)}</span>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
            <div className="drawer-foot">
              <Button variant="ghost" onClick={() => setSelEmp(null)}>{t('common.close', 'Cerrar')}</Button>
              <Button icon="receipt" onClick={() => { setShowRecibo({...selEmp, calc: calcPayroll(selEmp)}); setSelEmp(null); }}>{t('payroll.viewReceipt', 'Ver recibo')}
              </Button>
              <Button icon="edit" variant="accent">{t('common.edit', 'Editar')}</Button>
            </div>
          </div>
        </>
      )}

      {/* ── MODAL: Generar planilla ── */}
      {showGenModal && (
        <div className="modal-overlay" onClick={() => setShowGenModal(false)}>
          <div className="modal" style={{width:480}} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{t('payroll.generatePayroll', 'Generar planilla')} — {periodLabel}</h3>
              <button className="icon-btn" onClick={() => setShowGenModal(false)}><Icon name="x"/></button>
            </div>
            <div className="modal-body">
              <div className="alert" style={{marginBottom:16}}>
                <Icon name="alert" size={13}/>
                {t('payroll.closePayrollNote', 'Al cerrar la planilla se registrarán las partidas contables automáticamente.')}
              </div>
              <div className="detail-grid">
                <div className="detail-row">
                  <span className="detail-label">{t('payroll.headers.period', 'Período')}</span>
                  <span className="mono">{periodLabel}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t('payroll.includedEmployees', 'Empleados incluidos')}</span>
                  <span className="mono">{activeEmps.length}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t('payroll.totalBaseSalaries', 'Total salarios base')}</span>
                  <span className="mono">{Q(summary.totalBase)}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t('payroll.totalBonuses', 'Total bonificaciones')}</span>
                  <span className="mono" style={{color:'var(--success)'}}>{Q(summary.totalBon)}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t('payroll.igssEmployees', 'IGSS empleados')}</span>
                  <span className="mono" style={{color:'var(--danger)'}}>−{Q(summary.totalIgssE)}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t('payroll.isrRetainedLabel', 'ISR retenido')}</span>
                  <span className="mono" style={{color:'var(--danger)'}}>−{Q(summary.totalIsr)}</span>
                </div>
                <div className="detail-row" style={{fontWeight: 500, fontSize: 14}}>
                  <span className="detail-label">{t('payroll.totalNetToPay', 'Total neto a pagar')}</span>
                  <span className="mono" style={{color:'var(--success)'}}>{Q(summary.totalNeto)}</span>
                </div>
                <div className="detail-row" style={{fontWeight: 500, fontSize: 14}}>
                  <span className="detail-label">{t('payroll.totalCompanyCost', 'Costo total empresa')}</span>
                  <span className="mono" style={{color:'var(--accent)'}}>{Q(summary.totalEmpresa)}</span>
                </div>
              </div>
            </div>
            {genPeriod && (
              <div style={{ padding: '0 16px 8px' }}>
                <div className="alert" style={{ background: 'var(--success-soft)', color: 'var(--success)', borderColor: 'var(--success)' }}>
                  <Icon name="check" size={13} />
                  {t('payroll.generatedNote', 'Planilla generada y procesada. Ya puedes consultar la planilla de IGSS y el formulario de ISR (SAT), o cerrarla.')}
                </div>
              </div>
            )}
            <div className="modal-foot" style={{ flexWrap: 'wrap', gap: 8 }}>
              <Button variant="ghost" onClick={() => { setShowGenModal(false); setGenPeriod(null); }}>{t('common.cancel', 'Cancelar')}</Button>
              {!genPeriod ? (
                <Button icon="receipt" variant="accent" disabled={genBusy} onClick={handleGenerar}>{t('payroll.generateProcess', 'Generar y procesar')}
                </Button>
              ) : (
                <>
                  <Button icon="shield" onClick={() => openReport(genPeriod.id, 'igss')}>{t('payroll.igssPayroll', 'Planilla IGSS')}
                  </Button>
                  <Button icon="receipt" onClick={() => openReport(genPeriod.id, 'isr')}>{t('payroll.satForm', 'Formulario SAT (ISR)')}
                  </Button>
                  <Button icon="check" variant="accent" disabled={genBusy} onClick={handleCerrarPlanilla}>{t('payroll.closePayroll', 'Cerrar planilla')}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Recibo de sueldo ── */}
      {showRecibo && (
        <div className="modal-overlay" onClick={() => setShowRecibo(null)}>
          <div style={{display:'flex', gap:20, alignItems:'flex-start'}} onClick={e => e.stopPropagation()}>
            <ReciboSueldo emp={showRecibo} period={periodLabel}/>
            <div style={{display:'flex', flexDirection:'column', gap:8, paddingTop:16}}>
              <Button icon="print" variant="tonal">{t('common.print', 'Imprimir')}</Button>
              <Button icon="download">PDF</Button>
              <Button icon="x" variant="ghost" onClick={() => setShowRecibo(null)}>{t('common.close', 'Cerrar')}</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Reporte IGSS / SAT (ISR) ── */}
      {report && (
        <ReportModal report={report} Q={Q} onClose={() => setReport(null)} />
      )}

      {/* ── MODAL: Nuevo empleado ── */}
      {showEmpModal && (
        <NewEmployeeModal onClose={() => setShowEmpModal(false)} onSave={handleCreateEmployee} />
      )}
    </div>
  );
}

// ── Nuevo empleado ────────────────────────────────────────────────────────────
function NewEmployeeModal({ onClose, onSave }) {
  const { t } = useTranslation();
  const [code, setCode]     = useState('');
  const [name, setName]     = useState('');
  const [dept, setDept]     = useState(DEPARTAMENTOS[0]);
  const [pos, setPos]       = useState(PUESTOS_BY_DEPT[DEPARTAMENTOS[0]][0]);
  const [salary, setSalary] = useState('');
  const [hired, setHired]   = useState(new Date().toISOString().slice(0, 10));
  const [dpi, setDpi]       = useState('');
  const [nit, setNit]       = useState('');
  const [banco, setBanco]   = useState('');
  const [cuenta, setCuenta] = useState('');
  const [saving, setSaving] = useState(false);

  const puestos = PUESTOS_BY_DEPT[dept] || [];
  const valid = code.trim() && name.trim() && Number(salary) > 0;

  const submit = async () => {
    setSaving(true);
    await onSave({ code: code.trim(), name: name.trim(), dept, pos, salary, hired, dpi, nit, banco, cuenta });
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 560, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{t('payroll.newEmployee', 'Nuevo empleado')}</h3>
          <button className="icon-btn" onClick={onClose}><Icon name="x" /></button>
        </div>
        <div className="modal-body" style={{ overflow: 'auto', flex: 1 }}>
          <div className="form-grid">
            <div className="field">
              <label className="field-label">{t('payroll.employeeCode', 'Código *')}</label>
              <input className="field-input mono" placeholder="EMP-009" value={code} onChange={e => setCode(e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label">{t('payroll.headers.baseSalary', 'Salario base (Q) *')}</label>
              <input className="field-input mono" type="number" min="0" step="0.01" placeholder="4500.00" value={salary} onChange={e => setSalary(e.target.value)} />
            </div>
            <div className="field span-2">
              <label className="field-label">{t('common.name', 'Nombre completo *')}</label>
              <input className="field-input" placeholder="Nombre y apellidos" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label">{t('payroll.headers.department', 'Departamento')}</label>
              <select className="field-input" value={dept} onChange={e => { setDept(e.target.value); setPos((PUESTOS_BY_DEPT[e.target.value] || [''])[0]); }}>
                {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field-label">{t('payroll.headers.position', 'Puesto')}</label>
              <select className="field-input" value={pos} onChange={e => setPos(e.target.value)}>
                {puestos.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field-label">{t('payroll.hiredDate', 'Fecha de ingreso')}</label>
              <input className="field-input" type="date" value={hired} onChange={e => setHired(e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label">DPI</label>
              <input className="field-input mono" placeholder="0000000000000" value={dpi} onChange={e => setDpi(e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label">NIT</label>
              <input className="field-input mono" placeholder="0000000-0" value={nit} onChange={e => setNit(e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label">{t('payroll.bank', 'Banco')}</label>
              <input className="field-input" placeholder="Industrial" value={banco} onChange={e => setBanco(e.target.value)} />
            </div>
            <div className="field span-2">
              <label className="field-label">{t('payroll.bankAccount', 'Cuenta bancaria')}</label>
              <input className="field-input mono" placeholder="0000-000000" value={cuenta} onChange={e => setCuenta(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <Button variant="ghost" onClick={onClose}>{t('common.cancel', 'Cancelar')}</Button>
          <Button icon="check" variant="accent" disabled={!valid || saving} onClick={submit}>{t('payroll.createEmployee', 'Crear empleado')}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Reporte de IGSS / SAT-ISR ────────────────────────────────────────────────
function ReportModal({ report, Q, onClose }) {
  const { data, type } = report;
  const isIgss = type === 'igss';
  const title = isIgss ? 'Planilla de IGSS' : 'Formulario SAT — Retención ISR';
  const subtitle = isIgss
    ? 'Cuota laboral (4.83%) y patronal (10.67%) · Decreto 295'
    : 'Retención de ISR en relación de dependencia · régimen general';

  // Imprime SOLO la tabla del reporte.
  const onPrint = () => {
    const rowsHtml = (data.lines || []).map(l => isIgss
      ? `<tr><td>${l.name || ''}</td><td>${l.dpi || '—'}</td><td>${l.nit || '—'}</td>
         <td class="num">${Q(l.baseSalary)}</td><td class="num">${Q(l.igssLaboral)}</td><td class="num">${Q(l.igssPatronal)}</td></tr>`
      : `<tr><td>${l.name || ''}</td><td>${l.nit || '—'}</td>
         <td class="num">${Q(l.annualSalary)}</td><td class="num">${Q(l.taxableIncome)}</td>
         <td class="num">${Q(l.isrAnnual)}</td><td class="num">${Q(l.isrMonthly)}</td></tr>`).join('');
    const head = isIgss
      ? '<th>Empleado</th><th>DPI</th><th>NIT</th><th class="num">Salario base</th><th class="num">IGSS laboral</th><th class="num">IGSS patronal</th>'
      : '<th>Empleado</th><th>NIT</th><th class="num">Salario anual</th><th class="num">Renta gravable</th><th class="num">ISR anual</th><th class="num">ISR mensual</th>';
    const foot = isIgss
      ? `<tr><td colspan="3">Totales (${data.employeeCount || 0})</td><td class="num">${Q(data.totalBase)}</td><td class="num">${Q(data.totalLaboral)}</td><td class="num">${Q(data.totalPatronal)}</td></tr>`
      : `<tr><td colspan="4">Totales (${data.employeeCount || 0})</td><td class="num">${Q(data.totalIsrAnnual)}</td><td class="num">${Q(data.totalIsrMonthly)}</td></tr>`;
    printHTML(`${title} ${data.periodName || ''}`, `
      <h1>${title} — ${data.periodName || ''}</h1><div class="sub">${subtitle}</div>
      <table><thead><tr>${head}</tr></thead><tbody>${rowsHtml}</tbody><tfoot>${foot}</tfoot></table>
      ${isIgss ? `<p style="margin-top:14px"><strong>Total a enterar al IGSS:</strong> ${Q(data.totalIgss)}</p>` : ''}`);
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 720, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h3>{title} — {data.periodName || ''}</h3>
            <div className="meta" style={{ fontSize: 11, color: 'var(--muted)' }}>{subtitle}</div>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" /></button>
        </div>
        <div className="modal-body" style={{ overflow: 'auto', flex: 1 }}>
          <table className="tbl">
            <thead>
              {isIgss ? (
                <tr>
                  <th>Empleado</th><th>DPI</th><th>NIT</th>
                  <th className="num">Salario base</th>
                  <th className="num">IGSS laboral</th>
                  <th className="num">IGSS patronal</th>
                </tr>
              ) : (
                <tr>
                  <th>Empleado</th><th>NIT</th>
                  <th className="num">Salario anual</th>
                  <th className="num">Renta gravable</th>
                  <th className="num">ISR anual</th>
                  <th className="num">ISR mensual</th>
                </tr>
              )}
            </thead>
            <tbody>
              {(data.lines || []).map((l, i) => isIgss ? (
                <tr key={i}>
                  <td>{l.name}</td>
                  <td className="code muted">{l.dpi || '—'}</td>
                  <td className="code muted">{l.nit || '—'}</td>
                  <td className="num">{Q(l.baseSalary)}</td>
                  <td className="num" style={{ color: 'var(--danger)' }}>{Q(l.igssLaboral)}</td>
                  <td className="num" style={{ color: 'var(--muted)' }}>{Q(l.igssPatronal)}</td>
                </tr>
              ) : (
                <tr key={i}>
                  <td>{l.name}</td>
                  <td className="code muted">{l.nit || '—'}</td>
                  <td className="num">{Q(l.annualSalary)}</td>
                  <td className="num">{Q(l.taxableIncome)}</td>
                  <td className="num">{Q(l.isrAnnual)}</td>
                  <td className="num" style={{ color: 'var(--danger)', fontWeight: 500 }}>{Q(l.isrMonthly)}</td>
                </tr>
              ))}
              {(data.lines || []).length === 0 && (
                <tr><td colSpan={6} className="empty">Sin empleados en el período. Genera/procesa la planilla primero.</td></tr>
              )}
            </tbody>
            <tfoot>
              {isIgss ? (
                <tr style={{ fontWeight: 500, borderTop: '2px solid var(--border)' }}>
                  <td colSpan={3}>Totales ({data.employeeCount || 0} empleados)</td>
                  <td className="num">{Q(data.totalBase)}</td>
                  <td className="num" style={{ color: 'var(--danger)' }}>{Q(data.totalLaboral)}</td>
                  <td className="num" style={{ color: 'var(--muted)' }}>{Q(data.totalPatronal)}</td>
                </tr>
              ) : (
                <tr style={{ fontWeight: 500, borderTop: '2px solid var(--border)' }}>
                  <td colSpan={4}>Totales ({data.employeeCount || 0} empleados)</td>
                  <td className="num">{Q(data.totalIsrAnnual)}</td>
                  <td className="num" style={{ color: 'var(--danger)' }}>{Q(data.totalIsrMonthly)}</td>
                </tr>
              )}
            </tfoot>
          </table>
          {isIgss && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 'var(--r-md)', fontSize: 12 }}>
              Total a enterar al IGSS (laboral + patronal): <strong className="mono">{Q(data.totalIgss)}</strong>
            </div>
          )}
        </div>
        <div className="modal-foot">
          <Button variant="ghost" onClick={onClose}>Cerrar</Button>
          <Button icon="print" onClick={onPrint}>Imprimir</Button>
        </div>
      </div>
    </div>
  );
}

// ── Recibo de sueldo ────────────────────────────────────────────────────────
function ReciboSueldo({ emp, period }) {
  const c = emp.calc || calcPayroll(emp);
  return (
    <div style={{
      width:360, background:'white', color:'#111',
      fontFamily:'var(--font-mono)', fontSize:11,
      padding:'20px 18px', borderRadius:8,
      boxShadow:'0 10px 40px rgba(0,0,0,0.18)',
    }}>
      <div style={{textAlign:'center', marginBottom:14}}>
        <div style={{fontWeight: 500, fontSize:14, letterSpacing:'0.06em'}}>Stackline · TIENDA</div>
        <div style={{fontSize: 11, color:'#555', marginTop:2, lineHeight:1.5}}>
          NIT 8745619-2 · Guatemala<br/>
          RECIBO DE SUELDO
        </div>
      </div>
      <div style={{borderTop:'1px dashed #bbb', margin:'10px 0'}}/>
      <div style={{display:'flex', justifyContent:'space-between', marginBottom:4}}>
        <span style={{color:'#666'}}>Período</span><span style={{fontWeight: 500}}>{period}</span>
      </div>
      <div style={{display:'flex', justifyContent:'space-between', marginBottom:4}}>
        <span style={{color:'#666'}}>Empleado</span><span style={{fontWeight: 500, maxWidth:200, textAlign:'right'}}>{emp.name}</span>
      </div>
      <div style={{display:'flex', justifyContent:'space-between', marginBottom:4}}>
        <span style={{color:'#666'}}>Puesto</span><span>{emp.pos}</span>
      </div>
      <div style={{display:'flex', justifyContent:'space-between', marginBottom:4}}>
        <span style={{color:'#666'}}>DPI</span><span>{emp.dpi}</span>
      </div>
      <div style={{borderTop:'1px dashed #bbb', margin:'10px 0'}}/>

      {/* Devengado */}
      <div style={{fontWeight: 500, fontSize: 11, letterSpacing:'0.08em', marginBottom:6}}>DEVENGADO</div>
      {[
        ['Salario base', c.base],
        ['Bonificación incentivo', c.bon],
      ].map(([l,v]) => (
        <div key={l} style={{display:'flex', justifyContent:'space-between', marginBottom:3}}>
          <span style={{color:'#444'}}>{l}</span>
          <span>{Q(v)}</span>
        </div>
      ))}
      <div style={{display:'flex', justifyContent:'space-between', fontWeight: 500, borderTop:'1px solid #ddd', paddingTop:4, marginTop:4, marginBottom:10}}>
        <span>Total devengado</span><span>{Q(c.base + c.bon)}</span>
      </div>

      {/* Deducciones */}
      <div style={{fontWeight: 500, fontSize: 11, letterSpacing:'0.08em', marginBottom:6}}>DEDUCCIONES</div>
      {[
        [`IGSS empleado (4.83%)`, c.igssE],
        [`ISR mensual retenido`, c.isrM],
      ].map(([l,v]) => (
        <div key={l} style={{display:'flex', justifyContent:'space-between', marginBottom:3}}>
          <span style={{color:'#444'}}>{l}</span>
          <span style={{color:'#c00'}}>−{Q(v)}</span>
        </div>
      ))}
      <div style={{display:'flex', justifyContent:'space-between', fontWeight: 500, borderTop:'1px solid #ddd', paddingTop:4, marginTop:4, marginBottom:10}}>
        <span>Total deducciones</span><span style={{color:'#c00'}}>−{Q(c.deducc)}</span>
      </div>

      <div style={{borderTop:'2px solid #111', margin:'10px 0'}}/>
      <div style={{display:'flex', justifyContent:'space-between', fontWeight: 500, fontSize: 16}}>
        <span>LÍQUIDO A PAGAR</span><span style={{color:'#15803d'}}>{Q(c.neto)}</span>
      </div>
      <div style={{borderTop:'2px solid #111', margin:'10px 0'}}/>

      <div style={{fontSize: 11, color:'#888', marginTop:10, lineHeight:1.6}}>
        Cuota patronal IGSS (10.67%): {Q(c.igssP)}<br/>
        Renta gravable anual estimada: {Q(c.rentaGraba)}<br/>
        ISR anual estimado: {Q(c.isrAnual)}<br/>
        <br/>
        Firma empleado: _________________________
      </div>
    </div>
  );
}
