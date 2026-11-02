// Stackline Salud — Reportes de la clínica para un periodo: citas por día y
// por profesional, tasa de inasistencia, ingresos por servicio y pacientes
// con control vencido. Los números los arma el backend (SaludReportService).
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import DataTable from '../components/DataTable.jsx';
import DatePicker from '../components/DatePicker.jsx';
import StatCard from '../components/StatCard.jsx';
import Button from '../components/Button.jsx';
import { sessionUser } from '../api/auth.js';
import { getSaludReport } from '../api/salud.js';
import { hasPerm } from '../lib/patients.js';
import { dueLabel, followUpDate } from '../lib/clinical.js';
import { Q, pct, reportRange } from '../lib/caja.js';
import { todayGt } from '../lib/agenda.js';

const fecha = (iso) => { const [a, m, d] = String(iso).split('-'); return `${d}/${m}/${a}`; };
const PRESETS = [
  { id: 'today', label: 'Hoy' },
  { id: 'week', label: 'Esta semana' },
  { id: 'month', label: 'Este mes' },
  { id: 'lastMonth', label: 'Mes pasado' },
  { id: 'last30', label: 'Últimos 30 días' },
];

export default function SaludReports({ pushToast }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const agendar = useMemo(() => hasPerm(sessionUser()?.perms || ['*'], 'agenda', 'crear'), []);
  const hoy = todayGt();
  const [preset, setPreset] = useState('month');
  const [range, setRange] = useState(() => reportRange('month', hoy));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!range.from || !range.to) return undefined;
    let vigente = true;
    setLoading(true);
    getSaludReport(range.from, range.to)
      .then((r) => { if (vigente) setData(r); })
      .catch((err) => { if (vigente) { setData(null); pushToast?.(err.message, 'danger'); } })
      .finally(() => { if (vigente) setLoading(false); });
    return () => { vigente = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to]);

  const elegir = (p) => { setPreset(p); setRange(reportRange(p, hoy)); };
  const tot = data?.totals;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('saludReports.title', 'Reportes de salud')}</h1>
          <div className="page-subtitle">{`${fecha(range.from)} – ${fecha(range.to)}`}</div>
        </div>
      </div>

      <div className="toolbar ag-toolbar">
        <div className="ag-segment" role="radiogroup" aria-label={t('saludReports.period', 'Periodo')}>
          {PRESETS.map((p) => (
            <button key={p.id} type="button" role="radio" aria-checked={preset === p.id}
              className={`chip${preset === p.id ? ' active' : ''}`} onClick={() => elegir(p.id)}>
              {t(`saludReports.presets.${p.id}`, p.label)}
            </button>
          ))}
        </div>
        <div className="cj-range">
          <DatePicker value={range.from} onChange={(iso) => { if (iso) { setPreset(''); setRange((r) => ({ ...r, from: iso })); } }} />
          <span className="muted">–</span>
          <DatePicker value={range.to} onChange={(iso) => { if (iso) { setPreset(''); setRange((r) => ({ ...r, to: iso })); } }} />
        </div>
      </div>

      <div className="stat-grid">
        <StatCard icon="calendar" tone="pri" label={t('saludReports.kpis.appointments', 'Citas')} value={tot?.appointments ?? '—'}
          foot={tot ? t('saludReports.kpis.completedFoot', '{{n}} atendidas', { n: tot.completed }) : undefined} />
        <StatCard icon="alert" tone="err" label={t('saludReports.kpis.noShow', 'Tasa de inasistencia')} value={pct(tot?.noShowRate)}
          foot={tot ? t('saludReports.kpis.noShowFoot', '{{n}} no asistieron', { n: tot.noShow }) : undefined} />
        <StatCard icon="health" tone="sec" label={t('saludReports.kpis.serviceValue', 'Valor atendido')} value={tot ? Q(tot.serviceValue) : '—'}
          foot={tot ? t('saludReports.kpis.chargesFoot', '{{n}} cobros', { n: tot.charges }) : undefined} />
        <StatCard icon="cash" tone="ter" label={t('saludReports.kpis.cashIn', 'Entró en caja')} value={tot ? Q(tot.cashIn) : '—'}
          foot={tot ? t('saludReports.kpis.cashInFoot', 'Citas, paquetes y anticipos') : undefined} />
      </div>

      <div className="salud-stack">
        <section className="card">
          <div className="card-head">
            <h3>{t('saludReports.byService', 'Ingresos por servicio')}</h3>
          </div>
          <p className="muted cj-note">
            {t('saludReports.byServiceHelp', 'Valor atendido: lo cobrado por cita; con paquete, el precio del paquete entre sus sesiones. En caja: lo facturado al cobrar la cita.')}
          </p>
          <DataTable
            columns={[
              { key: 'name', header: t('saludReports.cols.service', 'Servicio'), card: 'title' },
              { key: 'charges', header: t('saludReports.cols.charges', 'Cobros'), align: 'right' },
              { key: 'packageSessions', header: t('saludReports.cols.packageSessions', 'Con paquete'), align: 'right', hideOnTablet: true },
              { key: 'courtesies', header: t('saludReports.cols.courtesies', 'Cortesías'), align: 'right', hideOnTablet: true },
              { key: 'serviceValue', header: t('saludReports.cols.value', 'Valor atendido'), align: 'right', card: 'amount', render: (r) => <span className="num">{Q(r.serviceValue)}</span> },
              { key: 'cash', header: t('saludReports.cols.cash', 'En caja'), align: 'right', render: (r) => <span className="num">{Q(r.cash)}</span> },
              { key: 'credit', header: t('saludReports.cols.credit', 'De anticipo'), align: 'right', hideOnTablet: true, render: (r) => <span className="num">{Q(r.credit)}</span> },
            ]}
            rows={data?.byService || []} rowKey={(r) => r.typeId} density="compact" loading={loading}
            empty={t('saludReports.noCharges', 'Sin cobros en el periodo')} emptyIcon="cash"
          />
          {tot && (
            <div className="cj-totals">
              <span>{t('saludReports.packagesSold', 'Paquetes vendidos')} <strong className="num">{Q(tot.packagesSold)}</strong></span>
              <span>{t('saludReports.deposits', 'Anticipos recibidos')} <strong className="num">{Q(tot.deposits)}</strong></span>
              <span>{t('saludReports.creditApplied', 'Anticipo aplicado a citas')} <strong className="num">{Q(tot.creditApplied)}</strong></span>
              <span>{t('saludReports.cashIn', 'Total en caja')} <strong className="num">{Q(tot.cashIn)}</strong></span>
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head"><h3>{t('saludReports.byProfessional', 'Citas por profesional')}</h3></div>
          <DataTable
            columns={[
              { key: 'name', header: t('saludReports.cols.professional', 'Profesional'), card: 'title' },
              { key: 'appointments', header: t('saludReports.cols.appointments', 'Citas'), align: 'right' },
              { key: 'completed', header: t('saludReports.cols.completed', 'Atendidas'), align: 'right' },
              { key: 'noShow', header: t('saludReports.cols.noShow', 'No asistió'), align: 'right' },
              { key: 'cancelled', header: t('saludReports.cols.cancelled', 'Canceladas'), align: 'right', hideOnTablet: true },
              { key: 'noShowRate', header: t('saludReports.cols.noShowRate', 'Inasistencia'), align: 'right', card: 'badge', render: (r) => pct(r.noShowRate) },
            ]}
            rows={data?.byProfessional || []} rowKey={(r) => r.professionalId} density="compact" loading={loading}
            empty={t('saludReports.noAppointments', 'Sin citas en el periodo')} emptyIcon="calendar"
          />
        </section>

        <section className="card">
          <div className="card-head"><h3>{t('saludReports.byDay', 'Citas por día')}</h3></div>
          <DataTable
            columns={[
              { key: 'date', header: t('saludReports.cols.date', 'Día'), mono: true, card: 'title', render: (r) => fecha(r.date) },
              { key: 'appointments', header: t('saludReports.cols.appointments', 'Citas'), align: 'right' },
              { key: 'completed', header: t('saludReports.cols.completed', 'Atendidas'), align: 'right' },
              { key: 'noShow', header: t('saludReports.cols.noShow', 'No asistió'), align: 'right' },
              { key: 'cancelled', header: t('saludReports.cols.cancelled', 'Canceladas'), align: 'right' },
            ]}
            rows={data?.byDay || []} rowKey={(r) => r.date} density="compact" loading={loading}
            empty={t('saludReports.noAppointments', 'Sin citas en el periodo')} emptyIcon="calendar"
          />
        </section>

        <section className="card">
          <div className="card-head">
            <h3>{t('saludReports.overdue', 'Pacientes con control vencido')} <span className="count">{data?.overdueFollowUps?.length ?? 0}</span></h3>
          </div>
          <DataTable
            columns={[
              { key: 'patientName', header: t('followups.cols.patient', 'Paciente'), card: 'title' },
              { key: 'due', header: t('followups.cols.due', 'Fecha límite'), card: 'subtitle', render: (f) => `${dueLabel(f.daysLeft)} (${fecha(f.dueOn)})` },
              { key: 'professionalName', header: t('followups.cols.professional', 'Con'), render: (f) => f.professionalName || '—' },
              { key: 'patientPhone', header: t('agenda.detail.phone', 'Teléfono'), mono: true, hideOnTablet: true, render: (f) => f.patientPhone || '—' },
            ]}
            rows={data?.overdueFollowUps || []} rowKey={(f) => f.id} density="compact" loading={loading}
            actions={agendar ? (f) => (
              <Button variant="tonal" icon="calendar" onClick={() => navigate('/agenda', {
                state: {
                  newForPatient: { id: f.patientId, name: f.patientName, recordNumber: f.recordNumber, phone: f.patientPhone },
                  followUp: { id: f.id, caseTitle: f.caseTitle || '', typeId: f.typeId, professionalId: f.professionalId, date: followUpDate(f.dueOn, hoy) },
                },
              })}>{t('followups.schedule', 'Agendar')}</Button>
            ) : undefined}
            empty={t('saludReports.noOverdue', 'Ningún control vencido. ¡Bien!')} emptyIcon="check"
          />
        </section>
      </div>
    </div>
  );
}
