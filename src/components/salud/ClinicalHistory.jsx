// Pestaña «Consultas» del expediente: los casos del paciente (abiertos
// primero) con sus consultas y controles, y los borradores sin caso. Desde
// aquí se abre una consulta, se agenda o cancela un control y se cierra o
// reabre un caso.
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Button from '../Button.jsx';
import Icon from '../Icon.jsx';
import EncounterEditor from './EncounterEditor.jsx';
import { useConfirm } from '../ConfirmDialog.jsx';
import Autocomplete from '../Autocomplete.jsx';
import {
  cancelFollowUp, cancelPlan, closeCase, createPlan, getClinicalHistory, listAppointmentTypes, listPlans, listProfessionals,
  reopenCase,
} from '../../api/salud.js';
import { RESPONSES, dueLabel, followUpDate, painTrend } from '../../lib/clinical.js';
import { FEELINGS, PLAN_STATUS, planProgress } from '../../lib/caja.js';
import { gtDate, todayGt } from '../../lib/agenda.js';

const fecha = (iso) => {
  if (!iso) return '';
  const d = String(iso).length > 10 ? gtDate(iso) : String(iso);
  const [a, m, dd] = d.split('-');
  return `${dd}/${m}/${a}`;
};

const FU_BADGE = { pendiente: 'warning', agendado: 'info', cumplido: 'success', cancelado: 'neutral' };

function EncounterItem({ e, onOpen }) {
  const { t } = useTranslation();
  const r = RESPONSES.find((x) => x.id === e.response);
  return (
    <li>
      <button type="button" className="enc-hist-item" onClick={() => onOpen(e.id)}>
        <span className="enc-hist-date mono">{fecha(e.signedAt || e.createdAt)}</span>
        <span className="enc-hist-main">
          <span className="salud-result-name">
            {e.dxDescription || t('clinical.history.noDx', 'Sin diagnóstico')}
            {e.dxCode && <span className="enc-code">{e.dxCode}</span>}
          </span>
          <span className="muted">
            {e.professionalName}
            {e.vitals?.painScore != null ? ` · ${t('clinical.history.pain', 'dolor {{n}}', { n: e.vitals.painScore })}` : ''}
            {e.rxCount > 0 ? ` · ${t('clinical.history.rx', '{{count}} medicamento(s)', { count: e.rxCount })}` : ''}
          </span>
        </span>
        <span className="salud-badges">
          {r && <span className={`badge-m3 ${r.badge}`}>{t(`clinical.response.${r.id}`, r.label)}</span>}
          {e.status !== 'firmada' && <span className="badge-m3 warning">{t('clinical.status.borrador', 'Borrador')}</span>}
        </span>
        <Icon name="chevronRight" size={16} />
      </button>
    </li>
  );
}

/** Plan de tratamiento nuevo: N sesiones de un tipo, cada tantos días. */
function PlanForm({ caseId, onSaved, onCancel, pushToast }) {
  const { t } = useTranslation();
  const [cat, setCat] = useState({ types: [], professionals: [] });
  const [f, setF] = useState({ title: '', typeId: '', professionalId: '', sessions: '10', intervalDays: '7', notes: '' });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    Promise.all([listAppointmentTypes(), listProfessionals()])
      .then(([types, professionals]) => setCat({ types: (types || []).filter((x) => x.active), professionals: (professionals || []).filter((p) => p.configured && p.active) }))
      .catch(() => {});
  }, []);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const listo = f.title.trim() && f.typeId && Number(f.sessions) >= 1;
  const guardar = async () => {
    setSaving(true);
    try {
      await createPlan(caseId, {
        title: f.title.trim(), typeId: Number(f.typeId), professionalId: f.professionalId === '' ? null : Number(f.professionalId),
        sessions: Number(f.sessions), intervalDays: f.intervalDays === '' ? null : Number(f.intervalDays), notes: f.notes.trim() || null,
      });
      pushToast?.(t('plans.saved', 'Plan de tratamiento indicado'), 'success');
      onSaved();
    } catch (err) {
      pushToast?.(err.message, 'danger');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="enc-plan-form">
      <div className="form-grid">
        <div className="field-group span-2">
          <label className="field-label">{t('plans.title', 'Plan *')}</label>
          <input className="field-input" value={f.title} maxLength={120} placeholder={t('plans.titleHint', 'Ej.: Fisioterapia de columna lumbar')}
            onChange={(e) => set('title', e.target.value)} aria-label={t('plans.title', 'Plan *')} />
        </div>
        <div className="field-group">
          <label className="field-label">{t('plans.type', 'Tipo de cita *')}</label>
          <Autocomplete value={f.typeId} onChange={(id) => set('typeId', id ?? '')} options={cat.types.map((x) => ({ id: x.id, name: x.name }))}
            aria-label={t('plans.type', 'Tipo de cita *')} />
        </div>
        <div className="field-group">
          <label className="field-label">{t('plans.professional', 'Profesional')}</label>
          <Autocomplete value={f.professionalId} onChange={(id) => set('professionalId', id ?? '')}
            options={cat.professionals.map((p) => ({ id: p.userId, name: p.name }))} placeholder={t('plans.anyProfessional', 'Cualquiera')}
            aria-label={t('plans.professional', 'Profesional')} />
        </div>
        <div className="field-group">
          <label className="field-label">{t('plans.sessions', 'Sesiones *')}</label>
          <input className="field-input mono" type="number" min={1} max={100} value={f.sessions} onChange={(e) => set('sessions', e.target.value)}
            aria-label={t('plans.sessions', 'Sesiones *')} />
        </div>
        <div className="field-group">
          <label className="field-label">{t('plans.interval', 'Cada (días)')}</label>
          <input className="field-input mono" type="number" min={1} max={90} value={f.intervalDays} onChange={(e) => set('intervalDays', e.target.value)}
            aria-label={t('plans.interval', 'Cada (días)')} />
        </div>
        <div className="field-group span-2">
          <label className="field-label">{t('plans.notes', 'Indicaciones')}</label>
          <input className="field-input" value={f.notes} maxLength={300} onChange={(e) => set('notes', e.target.value)}
            aria-label={t('plans.notes', 'Indicaciones')} />
        </div>
      </div>
      <div className="salud-inline-actions">
        <Button type="button" variant="ghost" onClick={onCancel}>{t('common.cancel', 'Cancelar')}</Button>
        <Button type="button" variant="accent" icon="check" disabled={!listo || saving} onClick={guardar}>{t('plans.save', 'Indicar plan')}</Button>
      </div>
    </div>
  );
}

function PlanItem({ p, canEdit, canSchedule, onSchedule, onCancel }) {
  const { t } = useTranslation();
  const st = PLAN_STATUS[p.status] || {};
  return (
    <div className={`enc-plan${p.status !== 'activo' ? ' is-closed' : ''}`}>
      <div className="enc-plan-main">
        <strong>{p.title}</strong>
        <span className="muted">
          {[p.typeName, p.professionalName, p.intervalDays ? t('plans.every', 'cada {{n}} días', { n: p.intervalDays }) : null].filter(Boolean).join(' · ')}
        </span>
        <div className="enc-plan-bar" role="progressbar" aria-valuemin={0} aria-valuemax={p.sessions} aria-valuenow={p.done}
          aria-label={t('plans.progress', 'Avance del plan')}>
          <span style={{ width: `${planProgress(p)}%` }} />
        </div>
        <span className="muted">
          {t('plans.progressText', '{{done}} de {{total}} sesiones atendidas', { done: p.done, total: p.sessions })}
          {p.scheduled > 0 ? ` · ${t('plans.scheduled', '{{n}} agendada(s)', { n: p.scheduled })}` : ''}
        </span>
      </div>
      <span className={`badge-m3 ${st.badge || 'neutral'}`}>{t(`plans.status.${p.status}`, st.label || p.status)}</span>
      {p.status === 'activo' && p.remaining > 0 && canSchedule && (
        <Button type="button" variant="tonal" icon="calendar" onClick={() => onSchedule(p)}>{t('plans.schedule', 'Agendar sesión')}</Button>
      )}
      {p.status === 'activo' && canEdit && (
        <Button type="button" variant="ghost" onClick={() => onCancel(p)}>{t('common.cancel', 'Cancelar')}</Button>
      )}
    </div>
  );
}

export default function ClinicalHistory({ patient, canEdit, canSchedule, pushToast }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(null); // id de la consulta abierta
  const [plans, setPlans] = useState([]);
  const [planFor, setPlanFor] = useState(null); // caso en el que se indica un plan

  const cargar = useCallback(() => {
    getClinicalHistory(patient.id)
      .then((d) => setData({ cases: d?.cases || [], drafts: d?.drafts || [] }))
      .catch((err) => { setData({ cases: [], drafts: [] }); pushToast?.(err.message, 'danger'); });
    listPlans(patient.id).then((r) => setPlans(r || [])).catch(() => setPlans([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient.id]);
  useEffect(() => { cargar(); }, [cargar]);

  const accion = async (fn, msg) => {
    try { await fn(); pushToast?.(msg, 'success'); cargar(); } catch (err) { pushToast?.(err.message, 'danger'); }
  };

  const cerrarCaso = async (c) => {
    const ok = await confirm({
      title: t('clinical.history.closeTitle', '¿Cerrar el caso «{{title}}»?', { title: c.title }),
      message: t('clinical.history.closeMsg', 'Se da por resuelto. Los controles que no se agendaron se cancelan. Se puede reabrir después.'),
      confirmLabel: t('clinical.history.close', 'Cerrar caso'),
    });
    if (ok) accion(() => closeCase(c.id, null), t('clinical.history.closed', 'Caso cerrado'));
  };

  const agendar = (c, f) => navigate('/agenda', {
    state: {
      newForPatient: { id: patient.id, name: patient.name, recordNumber: patient.recordNumber, phone: patient.phone },
      followUp: { id: f.id, caseTitle: c.title, typeId: f.typeId, professionalId: f.professionalId, date: followUpDate(f.dueOn, todayGt()) },
    },
  });

  const agendarSesion = (p) => navigate('/agenda', {
    state: {
      newForPatient: { id: patient.id, name: patient.name, recordNumber: patient.recordNumber, phone: patient.phone },
      plan: { id: p.id, title: p.title, typeId: p.typeId, professionalId: p.professionalId, date: p.nextDate || todayGt() },
    },
  });

  const cancelarPlan = async (p) => {
    const ok = await confirm({
      title: t('plans.cancelTitle', '¿Cancelar el plan «{{title}}»?', { title: p.title }),
      message: t('plans.cancelMsg', 'Las citas ya agendadas se mantienen; el plan deja de sugerir sesiones.'),
      confirmLabel: t('plans.cancel', 'Cancelar plan'), danger: true,
    });
    if (ok) accion(() => cancelPlan(p.id), t('plans.cancelled', 'Plan cancelado'));
  };

  if (!data) return <div className="empty">{t('clinical.history.loading', 'Cargando consultas…')}</div>;

  return (
    <div className="salud-stack">
      {data.cases.length === 0 && data.drafts.length === 0 && (
        <div className="empty">
          {t('clinical.history.empty', 'Sin consultas todavía. La consulta se abre desde la cita en la agenda, con «Atender».')}
        </div>
      )}

      {data.drafts.length > 0 && (
        <section className="enc-case">
          <div className="enc-case-head">
            <h4>{t('clinical.history.drafts', 'Consultas sin caso (borradores)')}</h4>
          </div>
          <ul className="enc-hist">{data.drafts.map((e) => <EncounterItem key={e.id} e={e} onOpen={setOpen} />)}</ul>
        </section>
      )}

      {data.cases.map((c) => {
        const tendencia = painTrend(c.encounters);
        return (
          <section key={c.id} className={`enc-case${c.status === 'cerrado' ? ' is-closed' : ''}`}>
            <div className="enc-case-head">
              <div>
                <h4>{c.title}</h4>
                <div className="muted">
                  {t('clinical.history.since', 'Desde el {{date}}', { date: fecha(c.openedAt) })}
                  {c.closedAt ? ` · ${t('clinical.history.closedOn', 'cerrado el {{date}}', { date: fecha(c.closedAt) })}` : ''}
                  {tendencia ? ` · ${t('clinical.history.painTrend', 'dolor {{trend}}', { trend: tendencia })}` : ''}
                </div>
              </div>
              <span className="salud-badges">
                <span className={`badge-m3 ${c.status === 'abierto' ? 'info' : 'neutral'}`}>
                  {c.status === 'abierto' ? t('clinical.history.open', 'Abierto') : t('clinical.history.closedBadge', 'Cerrado')}
                </span>
                {canEdit && (c.status === 'abierto' ? (
                  <Button type="button" variant="ghost" onClick={() => cerrarCaso(c)}>{t('clinical.history.close', 'Cerrar caso')}</Button>
                ) : (
                  <Button type="button" variant="ghost" onClick={() => accion(() => reopenCase(c.id), t('clinical.history.reopened', 'Caso reabierto'))}>
                    {t('clinical.history.reopen', 'Reabrir')}
                  </Button>
                ))}
              </span>
            </div>

            {c.followUps.filter((f) => f.status === 'pendiente' || f.status === 'agendado').map((f) => (
              <div key={f.id} className={`enc-fu${f.status === 'pendiente' && f.daysLeft < 0 ? ' is-late' : ''}`}>
                <Icon name="calendar" size={16} />
                <span className="enc-fu-main">
                  <strong>{t('clinical.history.control', 'Control')}</strong>
                  {' · '}{f.status === 'pendiente' ? dueLabel(f.daysLeft) : t('clinical.history.scheduled', 'Agendado')}
                  {' '}<span className="muted">({fecha(f.dueOn)})</span>
                  {f.notes && <span className="muted"> — {f.notes}</span>}
                  {f.feeling && (
                    <span className={`badge-m3 ${FEELINGS[f.feeling]?.badge || 'neutral'}`} title={f.feelingNote || undefined}>
                      {t('plans.feeling', 'Paciente: {{f}}', { f: t(`caja.feeling.${f.feeling}`, FEELINGS[f.feeling]?.label || f.feeling) })}
                    </span>
                  )}
                </span>
                <span className={`badge-m3 ${FU_BADGE[f.status]}`}>{t(`clinical.followUp.status.${f.status}`, f.status)}</span>
                {f.status === 'pendiente' && canSchedule && c.status === 'abierto' && (
                  <Button type="button" variant="tonal" icon="calendar" onClick={() => agendar(c, f)}>{t('clinical.history.schedule', 'Agendar')}</Button>
                )}
                {f.status === 'pendiente' && canEdit && (
                  <Button type="button" variant="ghost" onClick={() => accion(() => cancelFollowUp(f.id), t('clinical.history.fuCancelled', 'Control cancelado'))}>
                    {t('common.cancel', 'Cancelar')}
                  </Button>
                )}
              </div>
            ))}

            {plans.filter((p) => p.caseId === c.id).map((p) => (
              <PlanItem key={p.id} p={p} canEdit={canEdit} canSchedule={canSchedule} onSchedule={agendarSesion} onCancel={cancelarPlan} />
            ))}
            {planFor === c.id ? (
              <PlanForm caseId={c.id} pushToast={pushToast} onCancel={() => setPlanFor(null)} onSaved={() => { setPlanFor(null); cargar(); }} />
            ) : canEdit && c.status === 'abierto' && (
              <div>
                <Button type="button" variant="ghost" icon="plus" onClick={() => setPlanFor(c.id)}>{t('plans.new', 'Indicar plan de tratamiento')}</Button>
              </div>
            )}

            {c.outcome && <div className="enc-text muted">{c.outcome}</div>}
            <ul className="enc-hist">{c.encounters.map((e) => <EncounterItem key={e.id} e={e} onOpen={setOpen} />)}</ul>
          </section>
        );
      })}

      {open && (
        <EncounterEditor encounterId={open} pushToast={pushToast}
          onClose={() => { setOpen(null); cargar(); }} onChanged={() => cargar()} />
      )}
    </div>
  );
}
