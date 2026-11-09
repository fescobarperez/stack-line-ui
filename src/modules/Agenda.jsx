// Stackline Salud — Agenda.
//
// Día: una columna por profesional. Semana: una columna por día para un
// profesional. En el teléfono, la lista de citas del día (una cuadrícula de
// varias columnas no cabe). Un clic en un hueco agenda a esa hora; un clic
// en una cita abre su detalle con los cambios de estado.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import DataTable from '../components/DataTable.jsx';
import Autocomplete from '../components/Autocomplete.jsx';
import DatePicker from '../components/DatePicker.jsx';
import StatCard from '../components/StatCard.jsx';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import AgendaGrid from '../components/salud/AgendaGrid.jsx';
import MonthGrid from '../components/salud/MonthGrid.jsx';
import AppointmentDialog from '../components/salud/AppointmentDialog.jsx';
import AppointmentDrawer from '../components/salud/AppointmentDrawer.jsx';
import BlockDialog from '../components/salud/BlockDialog.jsx';
import AgendaConfig from '../components/salud/AgendaConfig.jsx';
import EncounterEditor from '../components/salud/EncounterEditor.jsx';
import ChargeDialog from '../components/salud/ChargeDialog.jsx';
import { useLayout } from '../hooks/useLayout.js';
import { sessionUser } from '../api/auth.js';
import {
  listProfessionals, listResources, listAppointmentTypes, listAppointments, listBlocks, deleteBlock, openEncounter, getAppointment,
} from '../api/salud.js';
import { hasPerm } from '../lib/patients.js';
import {
  STATUS, WEEKDAYS, addDays, addMonths, colorFor, daysOf, gtDate, gtTime, isActive, minToHhmm, monthOf, rangeOf, todayGt,
  visibleHours, weekdayOf,
} from '../lib/agenda.js';

function usePerms() {
  return useMemo(() => {
    const perms = sessionUser()?.perms || ['*'];
    return {
      crear: hasPerm(perms, 'agenda', 'crear'),
      editar: hasPerm(perms, 'agenda', 'editar'),
      config: hasPerm(perms, 'agenda_config', 'ver'),
      configEditar: hasPerm(perms, 'agenda_config', 'editar'),
      pacientes: hasPerm(perms, 'patients', 'ver'),
      clinicoVer: hasPerm(perms, 'clinical_record', 'ver'),
      clinicoCrear: hasPerm(perms, 'clinical_record', 'crear'),
      cobroVer: hasPerm(perms, 'salud_billing', 'ver'),
      cobroCrear: hasPerm(perms, 'salud_billing', 'crear'),
      cobroEditar: hasPerm(perms, 'salud_billing', 'editar'),
    };
  }, []);
}

export default function Agenda({ pushToast }) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const perms = usePerms();
  const layout = useLayout();
  const telefono = layout === 'phone';
  const hoy = todayGt();

  const [tab, setTab] = useState('agenda');
  // Se abre en el mes: la vista general; el día se abre desde su número.
  const [view, setView] = useState('month');
  const [date, setDate] = useState(hoy);
  const [professionalId, setProfessionalId] = useState('');
  const [showCancelled, setShowCancelled] = useState(false);
  const [catalogs, setCatalogs] = useState({ professionals: [], resources: [], types: [], loaded: false });
  const [data, setData] = useState({ appointments: [], blocks: [] });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  // De Pacientes con «Agendar cita» o «Agendar» un control (lleva el control para ligar la cita a su caso).
  const [newDialog, setNewDialog] = useState(() => {
    const st = location.state;
    if (!st?.newForPatient) return null;
    const fu = st.followUp;
    const plan = st.plan;
    if (plan) {
      return { patient: st.newForPatient, planId: plan.id, planTitle: plan.title, typeId: plan.typeId ?? undefined,
        professionalId: plan.professionalId ?? undefined, date: plan.date };
    }
    return fu
      ? { patient: st.newForPatient, followUpId: fu.id, caseTitle: fu.caseTitle, typeId: fu.typeId ?? undefined,
        professionalId: fu.professionalId ?? undefined, date: fu.date }
      : { patient: st.newForPatient };
  });
  const [encuentro, setEncuentro] = useState(null); // { id } o { initial }
  const [cobro, setCobro] = useState(null); // id de la cita que se cobra
  const [blockDialog, setBlockDialog] = useState(false);

  // Llega de Pacientes con «Agendar cita»: se consume una sola vez.
  useEffect(() => {
    if (location.state?.newForPatient) navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargarCatalogos = useCallback(async () => {
    try {
      const [professionals, resources, types] = await Promise.all([listProfessionals(), listResources(), listAppointmentTypes()]);
      setCatalogs({ professionals, resources, types, loaded: true });
    } catch (err) {
      setCatalogs((c) => ({ ...c, loaded: true }));
      pushToast?.(t('agenda.loadFailed', 'No se pudo cargar la agenda: ') + err.message, 'danger');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { cargarCatalogos(); }, [cargarCatalogos]);

  const activos = useMemo(() => catalogs.professionals.filter((p) => p.configured && p.active), [catalogs.professionals]);
  // En semana (y en el teléfono) se ve un profesional a la vez: el elegido o el primero.
  const unProfesional = view === 'week';
  // En mes, como en día: todos los profesionales o el elegido.
  const enMes = view === 'month';
  const profSemana = activos.find((p) => String(p.userId) === String(professionalId)) || activos[0];
  const dias = daysOf(view, date);
  const rango = rangeOf(dias);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const filtroProf = unProfesional ? profSemana?.userId : (professionalId || undefined);
      const [appointments, blocks] = await Promise.all([
        listAppointments({ from: rango.from, to: rango.to, professionalId: filtroProf }),
        listBlocks(rango.from, rango.to),
      ]);
      setData({ appointments, blocks });
    } catch (err) {
      setData({ appointments: [], blocks: [] });
      pushToast?.(t('agenda.loadFailed', 'No se pudo cargar la agenda: ') + err.message, 'danger');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rango.from, rango.to, professionalId, unProfesional, profSemana?.userId]);
  useEffect(() => { if (catalogs.loaded) cargar(); }, [cargar, catalogs.loaded]);

  const visibles = useMemo(
    () => data.appointments.filter((a) => showCancelled || isActive(a.status)),
    [data.appointments, showCancelled],
  );

  const diaLargo = (iso) => {
    const [a, m, d] = iso.split('-');
    return `${t(`agenda.weekdays.${weekdayOf(iso)}`, WEEKDAYS[weekdayOf(iso) - 1].label)} ${d}/${m}/${a}`;
  };
  const diaCorto = (iso) => {
    const [, m, d] = iso.split('-');
    return `${t(`agenda.weekdaysShort.${weekdayOf(iso)}`, WEEKDAYS[weekdayOf(iso) - 1].short)} ${d}/${m}`;
  };

  const columnas = unProfesional
    ? dias.map((d) => ({ key: d, label: diaCorto(d), date: d, professional: profSemana, color: null }))
    : (professionalId ? activos.filter((p) => String(p.userId) === String(professionalId)) : activos)
      .map((p) => ({ key: p.userId, label: p.name, sub: p.specialty, date, professional: p, color: colorFor(p.userId, p.color) }));
  const horas = visibleHours(columnas.map((c) => c.professional).filter(Boolean), visibles);

  const citasDe = (c) => visibles.filter((a) => (unProfesional ? gtDate(a.startsAt) === c.date : a.professionalId === c.professional?.userId));
  const bloqueosDe = (c) => data.blocks.filter((b) => b.professionalId === c.professional?.userId);

  const mover = (n) => setDate((d) => (enMes ? addMonths(d, n) : addDays(d, unProfesional ? 7 * n : n)));
  const nombreMes = (iso) => {
    const [a, m] = iso.split('-').map(Number);
    const txt = new Intl.DateTimeFormat(i18n.language || 'es', { month: 'long', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(Date.UTC(a, m - 1, 1)));
    return txt.charAt(0).toUpperCase() + txt.slice(1);
  };
  const abrirDia = (d) => { setDate(d); setView('day'); };
  const delDia = visibles.filter((a) => gtDate(a.startsAt) === date);
  const resumen = {
    total: delDia.length,
    porConfirmar: delDia.filter((a) => a.status === 'solicitada').length,
    enSala: delDia.filter((a) => a.status === 'en_sala' || a.status === 'en_atencion').length,
    noAsistio: data.appointments.filter((a) => gtDate(a.startsAt) === date && a.status === 'no_asistio').length,
    // Atendidas o en curso sin cobro: lo que caja tiene pendiente hoy.
    porCobrar: delDia.filter((a) => !a.chargeId && ['en_sala', 'en_atencion', 'completada'].includes(a.status)).length,
  };

  const actualizar = (cita) => {
    setSelected(cita);
    setData((d) => ({ ...d, appointments: d.appointments.map((x) => (x.id === cita.id ? cita : x)) }));
    cargar();
  };

  const sinConfigurar = catalogs.loaded && (activos.length === 0 || catalogs.types.filter((x) => x.active).length === 0);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('agenda.title', 'Agenda')}</h1>
          <div className="page-subtitle">{enMes ? nombreMes(date) : unProfesional ? `${diaCorto(dias[0])} – ${diaCorto(dias[6])}` : diaLargo(date)}</div>
        </div>
        {tab === 'agenda' && (
          <div className="page-head-actions">
            {perms.editar && (
              <Button icon="lock" variant="ghost" onClick={() => setBlockDialog(true)}>{t('agenda.block.button', 'Bloquear horario')}</Button>
            )}
            {perms.crear && (
              <Button icon="plus" variant="accent" disabled={sinConfigurar} onClick={() => setNewDialog({ date })}>
                {t('agenda.newAppointment', 'Nueva cita')}
              </Button>
            )}
          </div>
        )}
      </div>

      {perms.config && (
        <div className="tabs">
          <button type="button" className={`tab ag-tab${tab === 'agenda' ? ' active' : ''}`} onClick={() => setTab('agenda')}>{t('agenda.tabs.agenda', 'Agenda')}</button>
          <button type="button" className={`tab ag-tab${tab === 'config' ? ' active' : ''}`} onClick={() => setTab('config')}>{t('agenda.tabs.config', 'Configuración')}</button>
        </div>
      )}

      {tab === 'config' && (
        <AgendaConfig professionals={catalogs.professionals} resources={catalogs.resources} types={catalogs.types}
          canEdit={perms.configEditar} onChanged={cargarCatalogos} pushToast={pushToast} />
      )}

      {tab === 'agenda' && (
        <>
          {sinConfigurar && (
            <div className="alert ag-setup" role="note">
              <Icon name="info" size={16} />
              <span>
                {t('agenda.setup', 'Para agendar hace falta al menos un profesional con horario y un tipo de cita.')}
                {perms.config && <> <button type="button" className="ag-link" onClick={() => setTab('config')}>{t('agenda.setupLink', 'Configurar la agenda')}</button></>}
              </span>
            </div>
          )}

          <div className="stat-grid">
            <StatCard icon="calendar" tone="pri" label={t('agenda.kpis.today', 'Citas del día')} value={resumen.total} />
            <StatCard icon="clock" tone="ter" label={t('agenda.kpis.toConfirm', 'Por confirmar')} value={resumen.porConfirmar}
              valueColor={resumen.porConfirmar ? 'var(--warning)' : undefined} />
            <StatCard icon="user" tone="sec" label={t('agenda.kpis.inClinic', 'En sala o en atención')} value={resumen.enSala} />
            <StatCard icon="alert" tone="err" label={t('agenda.kpis.noShow', 'No asistieron')} value={resumen.noAsistio} />
            {perms.cobroVer && (
              <StatCard icon="cash" tone="pri" label={t('agenda.kpis.toCharge', 'Por cobrar')} value={resumen.porCobrar}
                valueColor={resumen.porCobrar ? 'var(--warning)' : undefined} />
            )}
          </div>

          <div className="toolbar ag-toolbar">
            <div className="salud-inline-actions ag-start">
              <Button variant="icon" icon="chevronLeft" title={t('agenda.prev', 'Anterior')} onClick={() => mover(-1)} />
              <Button variant="ghost" onClick={() => setDate(hoy)}>{t('agenda.today', 'Hoy')}</Button>
              <Button variant="icon" icon="chevronRight" title={t('agenda.next', 'Siguiente')} onClick={() => mover(1)} />
              <div className="ag-date"><DatePicker value={date} onChange={(iso) => iso && setDate(iso)} /></div>
            </div>
            {!telefono && (
              <div className="ag-segment" role="radiogroup" aria-label={t('agenda.view', 'Vista')}>
                {['day', 'week', 'month'].map((v) => (
                  <button key={v} type="button" role="radio" aria-checked={view === v}
                    className={`chip${view === v ? ' active' : ''}`} onClick={() => setView(v)}>
                    {t(`agenda.views.${v}`, { day: 'Día', week: 'Semana', month: 'Mes' }[v])}
                  </button>
                ))}
              </div>
            )}
            <div className="ag-filter">
              <Autocomplete value={unProfesional ? (profSemana?.userId ?? '') : (professionalId || 'all')}
                allowClear={false}
                onChange={(id) => setProfessionalId(!id || id === 'all' ? '' : String(id))}
                options={[...(unProfesional ? [] : [{ id: 'all', name: t('agenda.allProfessionals', 'Todos los profesionales') }]),
                  ...activos.map((p) => ({ id: p.userId, name: p.name }))]}
                aria-label={t('agenda.filterProfessional', 'Filtrar por profesional')} />
            </div>
            <label className="salud-check">
              <input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} />
              {t('agenda.showCancelled', 'Ver canceladas')}
            </label>
          </div>

          {telefono ? (
            <DataTable
              columns={[
                { key: 'time', header: t('agenda.detail.time', 'Hora'), mono: true, card: 'subtitle',
                  render: (a) => `${gtTime(a.startsAt)}–${gtTime(a.endsAt)} · ${a.professionalName}` },
                { key: 'patientName', header: t('agenda.detail.patient', 'Paciente'), card: 'title' },
                { key: 'typeName', header: t('agenda.detail.type', 'Tipo') },
                { key: 'status', header: t('common.status', 'Estado'), card: 'badge',
                  render: (a) => <span className={`badge-m3 ${STATUS[a.status]?.badge}`}>{t(`agenda.status.${a.status}`, STATUS[a.status]?.label)}</span> },
              ]}
              rows={delDia} rowKey={(a) => a.id} loading={loading} onRowClick={setSelected}
              empty={t('agenda.emptyDay', 'Sin citas este día')} emptyIcon="calendar"
            />
          ) : columnas.length === 0 ? (
            <div className="empty">{catalogs.loaded ? t('agenda.noProfessionals', 'No hay profesionales configurados') : t('agenda.loading', 'Cargando agenda…')}</div>
          ) : enMes ? (
            <MonthGrid days={dias} month={monthOf(date)} today={hoy} appointments={visibles}
              showProfessional={!professionalId} onOpen={setSelected} onDay={abrirDia}
              onNew={perms.crear ? (d) => setNewDialog({ date: d, professionalId: professionalId || undefined }) : undefined} />
          ) : (
            <AgendaGrid columns={columnas} hours={horas} today={hoy} showProfessional={false}
              appointmentsFor={citasDe} blocksFor={bloqueosDe}
              onOpen={setSelected}
              onSlot={perms.crear ? (c, min) => setNewDialog({
                date: c.date, time: minToHhmm(min), professionalId: c.professional?.userId,
              }) : undefined} />
          )}

          {data.blocks.length > 0 && perms.editar && (
            <section className="card ag-blocks">
              <div className="card-head"><h3>{t('agenda.block.list', 'Bloqueos en este periodo')}</h3></div>
              <DataTable
                columns={[
                  { key: 'who', header: t('agenda.block.who', 'Profesional o recurso'), card: 'title',
                    render: (b) => (b.professionalId
                      ? catalogs.professionals.find((p) => p.userId === b.professionalId)?.name
                      : catalogs.resources.find((r) => r.id === b.resourceId)?.name) || '—' },
                  { key: 'range', header: t('agenda.block.range', 'Desde – hasta'), mono: true, card: 'subtitle',
                    render: (b) => `${diaCorto(gtDate(b.startsAt))} ${gtTime(b.startsAt)} – ${diaCorto(gtDate(b.endsAt))} ${gtTime(b.endsAt)}` },
                  { key: 'reason', header: t('agenda.block.reason', 'Motivo'), render: (b) => b.reason || '—' },
                ]}
                rows={data.blocks} rowKey={(b) => b.id} density="compact"
                actions={(b) => (
                  <Button variant="icon" icon="trash" title={t('agenda.block.remove', 'Quitar bloqueo')} onClick={async () => {
                    const ok = await confirm({ title: t('agenda.block.removeTitle', '¿Quitar el bloqueo?'),
                      message: t('agenda.block.removeMsg', 'El horario vuelve a quedar disponible para agendar.'),
                      confirmLabel: t('agenda.block.remove', 'Quitar bloqueo') });
                    if (!ok) return;
                    try { await deleteBlock(b.id); cargar(); } catch (err) { pushToast?.(err.message, 'danger'); }
                  }} />
                )}
              />
            </section>
          )}
        </>
      )}

      {selected && (
        <div className="drawer-overlay" onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }}>
          <AppointmentDrawer key={`${selected.id}-${selected.status}-${selected.startsAt}`} appointment={selected}
            professionals={catalogs.professionals} perms={perms} canSeePatients={perms.pacientes}
            pushToast={pushToast} onClose={() => setSelected(null)} onChanged={actualizar}
            onCharge={(cita) => setCobro(cita.id)}
            onAttend={async (cita) => {
              if (cita.encounterId) { setSelected(null); setEncuentro({ id: cita.encounterId }); return; }
              try {
                const e = await openEncounter(cita.id);
                setSelected(null);
                setEncuentro({ initial: e });
                cargar();
              } catch (err) {
                pushToast?.(err.message, 'danger');
              }
            }} />
        </div>
      )}

      {cobro && (
        <ChargeDialog appointmentId={cobro} canVoid={perms.cobroEditar} canCourtesy={perms.cobroEditar} pushToast={pushToast}
          onClose={() => setCobro(null)}
          onDone={async () => {
            setCobro(null);
            try { actualizar(await getAppointment(cobro)); } catch { cargar(); }
          }} />
      )}

      {encuentro && (
        <EncounterEditor encounterId={encuentro.id} initial={encuentro.initial} types={catalogs.types} pushToast={pushToast}
          onClose={() => { setEncuentro(null); cargar(); }} />
      )}

      {newDialog && (
        <AppointmentDialog initial={newDialog} professionals={catalogs.professionals} types={catalogs.types}
          resources={catalogs.resources} pushToast={pushToast} onClose={() => setNewDialog(null)}
          onCreated={(cita) => {
            setNewDialog(null);
            pushToast?.(t('agenda.created', 'Cita agendada: {{when}}', { when: `${diaCorto(gtDate(cita.startsAt))} ${gtTime(cita.startsAt)}` }), 'success');
            if (gtDate(cita.startsAt) !== date && !dias.includes(gtDate(cita.startsAt))) setDate(gtDate(cita.startsAt));
            else cargar();
          }} />
      )}

      {blockDialog && (
        <BlockDialog professionals={catalogs.professionals} resources={catalogs.resources}
          initial={{ date, professionalId: professionalId || undefined }} pushToast={pushToast}
          onClose={() => setBlockDialog(false)}
          onCreated={() => { setBlockDialog(false); pushToast?.(t('agenda.block.saved', 'Horario bloqueado'), 'success'); cargar(); }} />
      )}
    </div>
  );
}
