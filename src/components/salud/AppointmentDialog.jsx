// Cita nueva. Se elige paciente, profesional, tipo y día; los horarios
// libres aparecen solos (los calcula el backend con el horario, las citas y
// los bloqueos) y un clic los toma. También se puede escribir otra hora: el
// backend igual rechaza lo que se cruce.
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../Button.jsx';
import Icon from '../Icon.jsx';
import Autocomplete from '../Autocomplete.jsx';
import DatePicker from '../DatePicker.jsx';
import TimeSelect from './TimeSelect.jsx';
import PatientPicker from './PatientPicker.jsx';
import { createAppointment, getAvailability, listPlans } from '../../api/salud.js';
import { gtTime, toInstant, todayGt } from '../../lib/agenda.js';

/** Horarios libres como fichas; `value` es la hora elegida (HH:mm). */
export function FreeSlots({ professionalId, typeId, date, value, onPick }) {
  const { t } = useTranslation();
  const [state, setState] = useState({ loading: false, slots: null });
  useEffect(() => {
    if (!professionalId || !typeId || !date) { setState({ loading: false, slots: null }); return undefined; }
    let vigente = true;
    setState({ loading: true, slots: null });
    getAvailability(professionalId, date, typeId)
      .then((r) => { if (vigente) setState({ loading: false, slots: r?.slots || [] }); })
      .catch(() => { if (vigente) setState({ loading: false, slots: [] }); });
    return () => { vigente = false; };
  }, [professionalId, typeId, date]);

  if (!professionalId || !typeId || !date) {
    return <div className="muted salud-help">{t('agenda.form.pickToSeeSlots', 'Elige profesional, tipo de cita y día para ver los horarios libres.')}</div>;
  }
  if (state.loading) return <div className="muted salud-help">{t('agenda.form.loadingSlots', 'Buscando horarios libres…')}</div>;
  if (!state.slots?.length) {
    return <div className="muted salud-help">{t('agenda.form.noSlots', 'No hay horarios libres ese día. Prueba otro día o escribe la hora.')}</div>;
  }
  return (
    <div className="ag-slots" role="listbox" aria-label={t('agenda.form.freeSlots', 'Horarios libres')}>
      {state.slots.map((s) => {
        const h = gtTime(s.startsAt);
        return (
          <button key={s.startsAt} type="button" role="option" aria-selected={value === h}
            className={`chip${value === h ? ' active' : ''}`} onClick={() => onPick(h, s.resourceId)}>
            {h}
          </button>
        );
      })}
    </div>
  );
}

export default function AppointmentDialog({ initial = {}, professionals, types, resources, onCreated, onClose, pushToast }) {
  const { t } = useTranslation();
  const [patient, setPatient] = useState(initial.patient || null);
  const [professionalId, setProfessionalId] = useState(initial.professionalId ?? '');
  const [typeId, setTypeId] = useState(initial.typeId ?? (types.find((x) => x.active)?.id ?? ''));
  const [date, setDate] = useState(initial.date || todayGt());
  const [time, setTime] = useState(initial.time || '');
  const [resourceId, setResourceId] = useState(initial.resourceId ?? '');
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [saving, setSaving] = useState(false);
  // Fase 7: la cita puede ser una sesión de un plan de tratamiento activo del paciente.
  const [planId, setPlanId] = useState(initial.planId ?? '');
  const [plans, setPlans] = useState([]);

  useEffect(() => {
    if (!patient?.id) { setPlans([]); return undefined; }
    let vigente = true;
    listPlans(patient.id)
      .then((r) => { if (vigente) setPlans((r || []).filter((p) => p.status === 'activo')); })
      .catch(() => { if (vigente) setPlans([]); });
    return () => { vigente = false; };
  }, [patient?.id]);

  const elegirPlan = (id) => {
    setPlanId(id ?? '');
    const p = plans.find((x) => String(x.id) === String(id));
    if (!p) return;
    if (p.typeId) setTypeId(p.typeId);
    if (p.professionalId && !professionalId) setProfessionalId(p.professionalId);
    setTime('');
  };
  const planOptions = plans.map((p) => ({ id: p.id, name: `${p.title} · ${p.done}/${p.sessions}` }));

  const tipo = types.find((x) => String(x.id) === String(typeId));
  const profOptions = useMemo(() => professionals.filter((p) => p.configured && p.active)
    .map((p) => ({ id: p.userId, name: p.specialty ? `${p.name} · ${p.specialty}` : p.name })), [professionals]);
  const typeOptions = useMemo(() => types.filter((x) => x.active)
    .map((x) => ({ id: x.id, name: `${x.name} · ${x.durationMinutes} min` })), [types]);
  const resOptions = useMemo(() => resources.filter((r) => r.active).map((r) => ({ id: r.id, name: r.name })), [resources]);

  const listo = patient && professionalId && typeId && date && time && (!tipo?.requiresResource || resourceId);

  const guardar = async () => {
    if (!listo) return;
    setSaving(true);
    try {
      const cita = await createAppointment({
        patientId: patient.id, professionalId: Number(professionalId), typeId: Number(typeId),
        resourceId: resourceId === '' ? null : Number(resourceId),
        startsAt: toInstant(date, time), reason: reason.trim() || null,
        status: pending ? 'solicitada' : 'confirmada',
        followUpId: initial.followUpId ?? null,
        planId: planId === '' ? null : Number(planId),
      });
      onCreated(cita);
    } catch (err) {
      pushToast?.(err.message, 'danger');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{t('agenda.form.title', 'Nueva cita')}</h3>
          <button className="icon-btn" type="button" onClick={onClose} aria-label={t('common.close', 'Cerrar')}><Icon name="close" /></button>
        </div>
        <div className="modal-body salud-stack">
          {initial.followUpId && (
            <div className="alert ag-followup" role="note">
              <Icon name="calendar" size={16} />
              <span>{t('agenda.form.followUp', 'Control del caso «{{title}}»: la cita quedará ligada al caso.', { title: initial.caseTitle || '' })}</span>
            </div>
          )}
          {initial.planId && (
            <div className="alert ag-followup" role="note">
              <Icon name="calendar" size={16} />
              <span>{t('agenda.form.plan', 'Sesión del plan «{{title}}»: la cita cuenta para su avance.', { title: initial.planTitle || '' })}</span>
            </div>
          )}
          <div className="field-group">
            <span className="field-label">{t('agenda.form.patient', 'Paciente *')}</span>
            <PatientPicker value={patient} onChange={(p) => { setPatient(p); setPlanId(''); }} />
          </div>
          {planOptions.length > 0 && !initial.followUpId && (
            <div className="field-group">
              <label className="field-label">{t('agenda.form.planField', 'Plan de tratamiento')}</label>
              <Autocomplete value={planId} onChange={elegirPlan} options={planOptions}
                placeholder={t('agenda.form.planNone', 'No es parte de un plan')}
                aria-label={t('agenda.form.planField', 'Plan de tratamiento')} />
            </div>
          )}
          <div className="form-grid">
            <div className="field-group">
              <label className="field-label">{t('agenda.form.professional', 'Profesional *')}</label>
              <Autocomplete value={professionalId} onChange={(id) => { setProfessionalId(id ?? ''); setTime(''); }}
                options={profOptions} emptyText={t('agenda.noProfessionals', 'No hay profesionales configurados')}
                aria-label={t('agenda.form.professional', 'Profesional *')} />
            </div>
            <div className="field-group">
              <label className="field-label">{t('agenda.form.type', 'Tipo de cita *')}</label>
              <Autocomplete value={typeId} onChange={(id) => { setTypeId(id ?? ''); setTime(''); }}
                options={typeOptions} allowClear={false} emptyText={t('agenda.noTypes', 'No hay tipos de cita')}
                aria-label={t('agenda.form.type', 'Tipo de cita *')} />
            </div>
            <div className="field-group">
              <label className="field-label">{t('agenda.form.date', 'Día *')}</label>
              <DatePicker value={date} onChange={(iso) => { setDate(iso); setTime(''); }} />
            </div>
            <div className="field-group">
              <label className="field-label">{t('agenda.form.time', 'Hora *')}</label>
              <TimeSelect value={time} onChange={setTime} aria-label={t('agenda.form.time', 'Hora *')} />
            </div>
            <div className="field-group span-2">
              <span className="field-label">{t('agenda.form.freeSlots', 'Horarios libres')}</span>
              <FreeSlots professionalId={professionalId} typeId={typeId} date={date} value={time}
                onPick={(h, r) => { setTime(h); if (r != null) setResourceId(r); }} />
            </div>
            <div className="field-group">
              <label className="field-label">
                {tipo?.requiresResource ? t('agenda.form.resourceRequired', 'Consultorio o recurso *') : t('agenda.form.resource', 'Consultorio o recurso')}
              </label>
              <Autocomplete value={resourceId} onChange={(id) => setResourceId(id ?? '')} options={resOptions}
                emptyText={t('agenda.noResources', 'No hay recursos')} aria-label={t('agenda.form.resource', 'Consultorio o recurso')} />
            </div>
            <div className="field-group">
              <label className="field-label">{t('agenda.form.reason', 'Motivo')}</label>
              <input className="field-input" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
            </div>
            <label className="salud-check span-2">
              <input type="checkbox" checked={pending} onChange={(e) => setPending(e.target.checked)} />
              {t('agenda.form.pending', 'Queda pendiente de confirmar con el paciente')}
            </label>
          </div>
        </div>
        <div className="modal-foot">
          <Button type="button" variant="ghost" onClick={onClose}>{t('common.cancel', 'Cancelar')}</Button>
          <Button type="button" variant="accent" icon="check" disabled={!listo || saving} onClick={guardar}>
            {t('agenda.form.save', 'Agendar')}
          </Button>
        </div>
      </div>
    </div>
  );
}
