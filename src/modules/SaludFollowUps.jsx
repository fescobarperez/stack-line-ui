// Stackline Salud — Seguimiento.
//
// La bandeja de recepción: controles indicados en consulta que todavía no
// tienen cita, agrupados en vencidos, esta semana y después. Desde aquí se
// agenda el control (queda en su caso), se ve si TINO ya le escribió al
// paciente y, con permiso clínico, qué contestó. Si el paciente lo dice por
// teléfono, recepción registra la respuesta.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button.jsx';
import Icon from '../components/Icon.jsx';
import DataTable from '../components/DataTable.jsx';
import Autocomplete from '../components/Autocomplete.jsx';
import StatCard from '../components/StatCard.jsx';
import { sessionUser } from '../api/auth.js';
import { listFollowUps, listProfessionals, saveFeedback } from '../api/salud.js';
import { hasPerm } from '../lib/patients.js';
import { dueLabel, followUpDate } from '../lib/clinical.js';
import { FEELINGS, followUpBuckets } from '../lib/caja.js';
import { todayGt } from '../lib/agenda.js';

const fecha = (iso) => { const [a, m, d] = String(iso).split('-'); return `${d}/${m}/${a}`; };
const HORIZONTES = [7, 30, 90];

function FeedbackDialog({ item, onSaved, onClose, pushToast }) {
  const { t } = useTranslation();
  const [feeling, setFeeling] = useState(item.feeling || '');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const guardar = async () => {
    setSaving(true);
    try {
      await saveFeedback(item.id, { feeling, note: note.trim() || null });
      pushToast?.(t('followups.feedbackSaved', 'Respuesta registrada en el caso'), 'success');
      onSaved();
    } catch (err) {
      pushToast?.(err.message, 'danger');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{t('followups.feedbackTitle', '¿Cómo sigue {{name}}?', { name: item.patientName })}</h3>
          <button className="icon-btn" type="button" onClick={onClose} aria-label={t('common.close', 'Cerrar')}><Icon name="close" /></button>
        </div>
        <div className="modal-body salud-stack">
          <div className="ag-segment" role="radiogroup" aria-label={t('followups.feeling', 'Cómo se siente')}>
            {Object.entries(FEELINGS).map(([id, f]) => (
              <button key={id} type="button" role="radio" aria-checked={feeling === id}
                className={`chip${feeling === id ? ' active' : ''}`} onClick={() => setFeeling(id)}>{t(`caja.feeling.${id}`, f.label)}</button>
            ))}
          </div>
          <div className="field-group">
            <label className="field-label">{t('followups.note', 'Lo que contó el paciente')}</label>
            <textarea className="field-input" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)}
              aria-label={t('followups.note', 'Lo que contó el paciente')} />
          </div>
        </div>
        <div className="modal-foot">
          <Button type="button" variant="ghost" onClick={onClose}>{t('common.cancel', 'Cancelar')}</Button>
          <Button type="button" variant="accent" icon="check" disabled={!feeling || saving} onClick={guardar}>{t('common.save', 'Guardar')}</Button>
        </div>
      </div>
    </div>
  );
}

export default function SaludFollowUps({ pushToast }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const perms = useMemo(() => {
    const p = sessionUser()?.perms || ['*'];
    return {
      agendar: hasPerm(p, 'agenda', 'crear'),
      registrar: hasPerm(p, 'agenda', 'editar'),
      clinico: hasPerm(p, 'clinical_record', 'ver'),
    };
  }, []);
  const [days, setDays] = useState(30);
  const [professionalId, setProfessionalId] = useState('');
  const [profs, setProfs] = useState([]);
  const [rows, setRows] = useState(null);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => { listProfessionals().then((r) => setProfs((r || []).filter((p) => p.configured && p.active))).catch(() => {}); }, []);

  const cargar = useCallback(() => {
    setRows(null);
    listFollowUps({ days, professionalId })
      .then((r) => setRows(r || []))
      .catch((err) => { setRows([]); pushToast?.(err.message, 'danger'); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, professionalId]);
  useEffect(() => { cargar(); }, [cargar]);

  const grupos = followUpBuckets(rows);
  const respondieron = (rows || []).filter((f) => f.answered).length;

  const agendar = (f) => navigate('/agenda', {
    state: {
      newForPatient: { id: f.patientId, name: f.patientName, recordNumber: f.recordNumber, phone: f.patientPhone },
      followUp: { id: f.id, caseTitle: f.caseTitle || '', typeId: f.typeId, professionalId: f.professionalId, date: followUpDate(f.dueOn, todayGt()) },
    },
  });

  const columnas = [
    { key: 'patientName', header: t('followups.cols.patient', 'Paciente'), card: 'title',
      render: (f) => (
        <span className="cj-cell">
          <strong>{f.patientName}</strong>
          <span className="muted mono">{[f.recordNumber, f.patientPhone].filter(Boolean).join(' · ')}</span>
        </span>
      ) },
    { key: 'due', header: t('followups.cols.due', 'Fecha límite'), card: 'subtitle',
      render: (f) => (
        <span className="cj-cell">
          <span className={f.daysLeft < 0 ? 'cj-late' : undefined}>{dueLabel(f.daysLeft)}</span>
          <span className="muted mono">{fecha(f.dueOn)}</span>
        </span>
      ) },
    { key: 'professionalName', header: t('followups.cols.professional', 'Con'),
      render: (f) => [f.professionalName, f.typeName].filter(Boolean).join(' · ') || '—' },
    ...(perms.clinico ? [{ key: 'caseTitle', header: t('followups.cols.case', 'Caso'), hideOnTablet: true, render: (f) => f.caseTitle || '—' }] : []),
    { key: 'reminder', header: t('followups.cols.whatsapp', 'WhatsApp'), card: 'badge',
      render: (f) => {
        if (f.feeling) {
          const x = FEELINGS[f.feeling];
          return <span className={`badge-m3 ${x?.badge || 'neutral'}`} title={f.feelingNote || undefined}>{t(`caja.feeling.${f.feeling}`, x?.label || f.feeling)}</span>;
        }
        if (f.answered) return <span className="badge-m3 info">{t('followups.answered', 'Respondió')}</span>;
        if (f.reminderStatus === 'enviado') return <span className="badge-m3 neutral">{t('followups.sent', 'Recordado')}</span>;
        if (f.reminderStatus === 'fallido') return <span className="badge-m3 danger">{t('followups.failed', 'No se pudo enviar')}</span>;
        return <span className="muted">—</span>;
      } },
  ];

  const acciones = (f) => (
    <span className="salud-inline-actions">
      {perms.registrar && (
        <Button variant="icon" icon="edit" title={t('followups.registerFeedback', 'Registrar cómo sigue')} onClick={() => setFeedback(f)} />
      )}
      {perms.agendar && (
        <Button variant="tonal" icon="calendar" onClick={() => agendar(f)}>{t('followups.schedule', 'Agendar')}</Button>
      )}
    </span>
  );

  const grupo = (titulo, items, vacio) => (
    <section className="card">
      <div className="card-head"><h3>{titulo} <span className="count">{items.length}</span></h3></div>
      <DataTable columns={columnas} rows={items} rowKey={(f) => f.id} density="compact" loading={rows == null}
        actions={acciones} empty={vacio} emptyIcon="check" />
    </section>
  );

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('followups.title', 'Seguimiento')}</h1>
          <div className="page-subtitle">{t('followups.subtitle', 'Controles indicados en consulta que todavía no tienen cita')}</div>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard icon="alert" tone="err" label={t('followups.kpis.overdue', 'Vencidos')} value={grupos.overdue.length}
          valueColor={grupos.overdue.length ? 'var(--danger)' : undefined} />
        <StatCard icon="calendar" tone="ter" label={t('followups.kpis.week', 'Vencen esta semana')} value={grupos.week.length} />
        <StatCard icon="clock" tone="sec" label={t('followups.kpis.later', 'Más adelante')} value={grupos.later.length} />
        <StatCard icon="bell" tone="pri" label={t('followups.kpis.answered', 'Respondieron por WhatsApp')} value={respondieron} />
      </div>

      <div className="toolbar ag-toolbar">
        <div className="ag-segment" role="radiogroup" aria-label={t('followups.horizon', 'Horizonte')}>
          {HORIZONTES.map((d) => (
            <button key={d} type="button" role="radio" aria-checked={days === d}
              className={`chip${days === d ? ' active' : ''}`} onClick={() => setDays(d)}>
              {t('followups.nextDays', 'Próximos {{count}} días', { count: d })}
            </button>
          ))}
        </div>
        <div className="ag-filter">
          <Autocomplete value={professionalId || 'all'} allowClear={false}
            onChange={(id) => setProfessionalId(!id || id === 'all' ? '' : String(id))}
            options={[{ id: 'all', name: t('agenda.allProfessionals', 'Todos los profesionales') }, ...profs.map((p) => ({ id: p.userId, name: p.name }))]}
            aria-label={t('agenda.filterProfessional', 'Filtrar por profesional')} />
        </div>
      </div>

      <div className="salud-stack">
        {grupo(t('followups.overdue', 'Vencidos'), grupos.overdue, t('followups.noneOverdue', 'Ningún control vencido.'))}
        {grupo(t('followups.week', 'Esta semana'), grupos.week, t('followups.noneWeek', 'Nada vence esta semana.'))}
        {grupo(t('followups.later', 'Más adelante'), grupos.later, t('followups.noneLater', 'Sin controles más adelante.'))}
      </div>

      {feedback && (
        <FeedbackDialog item={feedback} pushToast={pushToast} onClose={() => setFeedback(null)}
          onSaved={() => { setFeedback(null); cargar(); }} />
      )}
    </div>
  );
}
