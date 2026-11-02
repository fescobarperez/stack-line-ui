// Detalle de una cita: datos, cambios de estado (los que el backend permite
// según el diagrama), reprogramación y notas. El backend vuelve a validar
// todo; los botones solo muestran lo que tiene sentido ahora.
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Button from '../Button.jsx';
import Icon from '../Icon.jsx';
import Autocomplete from '../Autocomplete.jsx';
import DatePicker from '../DatePicker.jsx';
import TimeSelect from './TimeSelect.jsx';
import { FreeSlots } from './AppointmentDialog.jsx';
import { useConfirm } from '../ConfirmDialog.jsx';
import { changeAppointmentStatus, rescheduleAppointment, updateAppointmentNotes } from '../../api/salud.js';
import { ACTION, STATUS, canReschedule, gtDate, gtTime, reminderInfo, toInstant } from '../../lib/agenda.js';
import { CHARGE_METHODS, NOT_CHARGEABLE, Q } from '../../lib/caja.js';

const fecha = (iso) => { const [a, m, d] = gtDate(iso).split('-'); return `${d}/${m}/${a}`; };

function Row({ label, children }) {
  if (children == null || children === '') return null;
  return <div className="detail-row"><span className="detail-label">{label}</span><span>{children}</span></div>;
}

export default function AppointmentDrawer({ appointment: a, professionals, perms, canSeePatients, onChanged, onClose, onAttend, onCharge, pushToast }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [mode, setMode] = useState(null); // 'reschedule' | 'cancel' | 'notes'
  const [busy, setBusy] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [mover, setMover] = useState({ date: gtDate(a.startsAt), time: gtTime(a.startsAt), professionalId: a.professionalId, resourceId: a.resourceId });
  const [notas, setNotas] = useState({ reason: a.reason || '', notes: a.notes || '' });

  const correr = async (fn, okMsg) => {
    setBusy(true);
    try {
      const cita = await fn();
      setMode(null);
      onChanged(cita);
      pushToast?.(okMsg, 'success');
    } catch (err) {
      pushToast?.(err.message, 'danger');
    } finally {
      setBusy(false);
    }
  };

  const cambiar = async (status) => {
    if (status === 'cancelada') { setMode('cancel'); return; }
    if (status === 'no_asistio') {
      const ok = await confirm({
        title: t('agenda.noShowTitle', '¿Marcar que no asistió?'),
        message: t('agenda.noShowMsg', 'La cita se cierra y el horario queda libre. Cuenta para la tasa de inasistencia.'),
        confirmLabel: t('agenda.actions.no_asistio', 'No asistió'), danger: true,
      });
      if (!ok) return;
    }
    await correr(() => changeAppointmentStatus(a.id, status), t('agenda.statusSaved', 'Cita actualizada'));
  };

  const profOptions = professionals.filter((p) => p.configured && p.active).map((p) => ({ id: p.userId, name: p.name }));
  const st = STATUS[a.status] || {};
  const recordatorio = reminderInfo(a);
  // La consulta se abre con el paciente en sala, en atención o ya atendido.
  const atendible = ['en_sala', 'en_atencion', 'completada'].includes(a.status);
  const isPendiente = a.status === 'solicitada' || a.status === 'confirmada';
  // Caja (fase 7): cobrada, o pendiente de cobro si se atendió o va a atenderse.
  const cobrable = !NOT_CHARGEABLE.includes(a.status);
  const verCobro = onCharge && perms.cobroVer && (a.chargeId || (cobrable && perms.cobroCrear));

  return (
    <div className="drawer">
      <div className="drawer-head">
        <div className="salud-drawer-title">
          <div className="drawer-title">{a.patientName}</div>
          <div className="muted mono salud-badges">
            <span>{a.recordNumber}</span>
            <span className={`badge-m3 ${st.badge || 'neutral'}`}>{t(`agenda.status.${a.status}`, st.label)}</span>
            {a.source === 'tino' && <span className="badge-m3 neutral">{t('agenda.byTino', 'Agendada por TINO')}</span>}
            {a.caseId && <span className="badge-m3 info">{t('agenda.control', 'Control')}</span>}
            {a.planId && <span className="badge-m3 info">{t('agenda.plan', 'Plan de tratamiento')}</span>}
          </div>
        </div>
        <button className="icon-btn" type="button" onClick={onClose} aria-label={t('common.close', 'Cerrar')}><Icon name="x" /></button>
      </div>

      <div className="drawer-body salud-stack">
        {onAttend && atendible && (a.encounterId ? perms.clinicoVer : perms.clinicoCrear) && (
          <div className="ag-attend">
            <div>
              <strong>{a.encounterId
                ? (a.encounterStatus === 'firmada' ? t('agenda.encounter.signed', 'Consulta firmada') : t('agenda.encounter.draft', 'Consulta en borrador'))
                : t('agenda.encounter.ready', 'El paciente está listo para la consulta')}</strong>
              <div className="muted">{a.encounterId
                ? t('agenda.encounter.openHint', 'Ábrela para ver o seguir la nota.')
                : t('agenda.encounter.attendHint', 'Abre la nota clínica; la cita pasa a «en atención».')}</div>
            </div>
            <Button type="button" variant="accent" icon={a.encounterId ? 'folder' : 'health'} onClick={() => onAttend(a)}>
              {a.encounterId ? t('agenda.encounter.open', 'Ver consulta') : t('agenda.encounter.attend', 'Atender')}
            </Button>
          </div>
        )}
        <div className="detail-grid">
          <Row label={t('agenda.detail.when', 'Fecha')}>{`${fecha(a.startsAt)} · ${gtTime(a.startsAt)}–${gtTime(a.endsAt)}`}</Row>
          <Row label={t('agenda.detail.professional', 'Profesional')}>{a.professionalName}</Row>
          <Row label={t('agenda.detail.type', 'Tipo')}>{a.typeName}</Row>
          <Row label={t('agenda.detail.resource', 'Recurso')}>{a.resourceName}</Row>
          <Row label={t('agenda.detail.phone', 'Teléfono')}>{a.patientPhone}</Row>
          <Row label={t('agenda.detail.reason', 'Motivo')}>{a.reason}</Row>
          <Row label={t('agenda.detail.notes', 'Notas')}>{a.notes}</Row>
          <Row label={t('agenda.detail.cancelReason', 'Motivo de cancelación')}>{a.cancelReason}</Row>
          {recordatorio && (
            <Row label={t('agenda.reminder.label', 'Recordatorio')}>
              <span className="salud-badges">
                <span className={`badge-m3 ${recordatorio.badge}`}>{t(`agenda.reminder.${recordatorio.key}`)}</span>
                {recordatorio.at && <span className="muted">{`${fecha(recordatorio.at)} ${gtTime(recordatorio.at)}`}</span>}
              </span>
            </Row>
          )}
        </div>
        {verCobro && (
          <div className={`ag-charge${a.chargeId ? ' is-paid' : ''}`}>
            <Icon name="cash" size={18} />
            <div className="ag-grow">
              <strong>{a.chargeId ? t('caja.paid', 'Cobrada') : t('caja.pending', 'Pendiente de cobro')}</strong>
              <div className="muted">
                {a.chargeId
                  ? `${t(`caja.method.${a.chargeMethod}`, CHARGE_METHODS[a.chargeMethod]?.label || a.chargeMethod)}${a.chargeMethod === 'paquete' ? '' : ` · ${Q(a.chargeTotal)}`}`
                  : a.price != null ? Q(a.price) : t('caja.noPrice', 'El tipo de cita no tiene precio')}
              </div>
            </div>
            <Button type="button" variant={a.chargeId ? 'ghost' : 'tonal'} icon={a.chargeId ? 'receipt' : 'cash'} onClick={() => onCharge(a)}>
              {a.chargeId ? t('caja.view', 'Ver cobro') : t('caja.charge', 'Cobrar')}
            </Button>
          </div>
        )}

        {recordatorio?.key === 'failed' && isPendiente && (
          <p className="muted ag-hint">{t('agenda.reminder.failedHint', 'No se pudo enviar por WhatsApp. Conviene llamar al paciente para confirmar.')}</p>
        )}

        {perms.editar && a.nextStatuses?.length > 0 && !mode && (
          <div className="salud-inline-actions ag-actions">
            {a.nextStatuses.map((s) => (
              <Button key={s} type="button" disabled={busy}
                variant={ACTION[s]?.danger ? 'ghost' : 'tonal'} icon={ACTION[s]?.icon}
                onClick={() => cambiar(s)}>
                {t(`agenda.actions.${s}`, ACTION[s]?.label || s)}
              </Button>
            ))}
          </div>
        )}

        {mode === 'cancel' && (
          <div className="salud-row">
            <div className="field-group ag-grow">
              <label className="field-label">{t('agenda.cancelReason', 'Motivo de la cancelación *')}</label>
              <input className="field-input" autoFocus value={cancelReason} maxLength={300}
                aria-label={t('agenda.cancelReason', 'Motivo de la cancelación *')} onChange={(e) => setCancelReason(e.target.value)} />
            </div>
            <div className="salud-inline-actions">
              <Button type="button" variant="ghost" onClick={() => setMode(null)}>{t('common.back', 'Volver')}</Button>
              <Button type="button" variant="danger" icon="x" disabled={busy || !cancelReason.trim()}
                onClick={() => correr(() => changeAppointmentStatus(a.id, 'cancelada', cancelReason.trim()), t('agenda.cancelled', 'Cita cancelada'))}>
                {t('agenda.actions.cancelada', 'Cancelar cita')}
              </Button>
            </div>
          </div>
        )}

        {mode === 'reschedule' && (
          <div className="salud-row">
            <div className="form-grid salud-row-fields ag-move-fields ag-grow">
              <div className="field-group">
                <label className="field-label">{t('agenda.form.date', 'Día *')}</label>
                <DatePicker value={mover.date} onChange={(iso) => setMover((m) => ({ ...m, date: iso }))} />
              </div>
              <div className="field-group">
                <label className="field-label">{t('agenda.form.time', 'Hora *')}</label>
                <TimeSelect value={mover.time} onChange={(h) => setMover((m) => ({ ...m, time: h }))} aria-label={t('agenda.form.time', 'Hora *')} />
              </div>
              <div className="field-group span-2">
                <label className="field-label">{t('agenda.form.professional', 'Profesional *')}</label>
                <Autocomplete value={mover.professionalId} allowClear={false} options={profOptions}
                  onChange={(id) => setMover((m) => ({ ...m, professionalId: id || a.professionalId }))}
                  aria-label={t('agenda.form.professional', 'Profesional *')} />
              </div>
              <div className="span-2">
                <FreeSlots professionalId={mover.professionalId} typeId={a.typeId} date={mover.date} value={mover.time}
                  onPick={(h, r) => setMover((m) => ({ ...m, time: h, resourceId: r ?? m.resourceId }))} />
              </div>
            </div>
            <div className="salud-inline-actions">
              <Button type="button" variant="ghost" onClick={() => setMode(null)}>{t('common.back', 'Volver')}</Button>
              <Button type="button" variant="accent" icon="check" disabled={busy || !mover.date || !mover.time}
                onClick={() => correr(() => rescheduleAppointment(a.id, {
                  startsAt: toInstant(mover.date, mover.time),
                  professionalId: Number(mover.professionalId), resourceId: mover.resourceId ?? null, confirmed: true,
                }), t('agenda.rescheduled', 'Cita reprogramada'))}>
                {t('agenda.reschedule', 'Reprogramar')}
              </Button>
            </div>
          </div>
        )}

        {mode === 'notes' && (
          <div className="salud-row">
            <div className="form-grid salud-row-fields ag-grow">
              <div className="field-group span-2">
                <label className="field-label">{t('agenda.detail.reason', 'Motivo')}</label>
                <input className="field-input" value={notas.reason} maxLength={300} onChange={(e) => setNotas((n) => ({ ...n, reason: e.target.value }))} />
              </div>
              <div className="field-group span-2">
                <label className="field-label">{t('agenda.detail.notes', 'Notas')}</label>
                <textarea className="field-input" rows={3} value={notas.notes} maxLength={1000} onChange={(e) => setNotas((n) => ({ ...n, notes: e.target.value }))} />
              </div>
            </div>
            <div className="salud-inline-actions">
              <Button type="button" variant="ghost" onClick={() => setMode(null)}>{t('common.back', 'Volver')}</Button>
              <Button type="button" variant="accent" icon="check" disabled={busy}
                onClick={() => correr(() => updateAppointmentNotes(a.id, { reason: notas.reason.trim() || null, notes: notas.notes.trim() || null }), t('agenda.notesSaved', 'Notas guardadas'))}>
                {t('common.save', 'Guardar')}
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="drawer-foot">
        {canSeePatients && (
          <Button type="button" variant="ghost" icon="folder" onClick={() => navigate('/patients', { state: { openPatientId: a.patientId } })}>
            {t('agenda.openRecord', 'Ver expediente')}
          </Button>
        )}
        <div className="drawer-foot-actions">
          {perms.editar && !mode && (
            <Button type="button" variant="ghost" icon="edit" onClick={() => setMode('notes')}>{t('agenda.editNotes', 'Notas')}</Button>
          )}
          {perms.editar && !mode && canReschedule(a.status) && (
            <Button type="button" icon="calendar" onClick={() => setMode('reschedule')}>{t('agenda.reschedule', 'Reprogramar')}</Button>
          )}
        </div>
      </div>
    </div>
  );
}
