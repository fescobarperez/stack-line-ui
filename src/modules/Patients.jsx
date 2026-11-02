// Stackline Salud — Pacientes.
//
// Un paciente es un cliente con expediente: se busca antes de crear para no
// duplicar a nadie (si ya es cliente se convierte, si ya es paciente se
// abre), y el alta crea cliente y paciente juntos. Lo clínico solo aparece
// para quien tiene el permiso de expediente clínico; el backend lo valida
// igual, así que esconderlo aquí es comodidad, no seguridad.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import DataTable from '../components/DataTable.jsx';
import Autocomplete from '../components/Autocomplete.jsx';
import DatePicker from '../components/DatePicker.jsx';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import PatientForm from '../components/salud/PatientForm.jsx';
import ClinicalFields from '../components/salud/ClinicalFields.jsx';
import ClinicalHistory from '../components/salud/ClinicalHistory.jsx';
import PatientAccount from '../components/salud/PatientAccount.jsx';
import { opts, optLabel } from '../components/salud/options.js';
import { getClient } from '../api/partners.js';
import { sessionUser } from '../api/auth.js';
import {
  listPatients, findCandidates, getPatient, createPatient, createPatientFromClient, updatePatient,
  updateClinical, changePatientStatus, addConsent, revokeConsent, getAccessLog, listAppointments,
} from '../api/salud.js';
import { STATUS as APPT_STATUS, gtDate, gtTime } from '../lib/agenda.js';
import {
  STATUS_CLASS, MAYORIA_DE_EDAD, hasPerm, emptyForm, clientToForm, formFromDetail, clinicalToForm,
  clientPayload, patientPayload, clinicalPayload, clinicalAlerts, hoyIso, prefillFromSearch, consentSignedAt,
  normalizeDetail,
} from '../lib/patients.js';

const PAGE_SIZE = 50;

const fechaHora = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' }); } catch { return iso; }
};
const fecha = (iso) => {
  if (!iso) return '—';
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
};

function usePerms() {
  return useMemo(() => {
    const perms = sessionUser()?.perms || ['*'];
    return {
      crear: hasPerm(perms, 'patients', 'crear'),
      editar: hasPerm(perms, 'patients', 'editar'),
      verClinico: hasPerm(perms, 'clinical_record', 'ver'),
      editarClinico: hasPerm(perms, 'clinical_record', 'editar'),
      agenda: hasPerm(perms, 'agenda', 'ver'),
      agendar: hasPerm(perms, 'agenda', 'crear'),
      cuenta: hasPerm(perms, 'salud_billing', 'ver'),
      cobrar: hasPerm(perms, 'salud_billing', 'crear'),
    };
  }, []);
}

function StatusBadge({ status }) {
  const { t } = useTranslation();
  return <span className={`badge-m3 ${STATUS_CLASS[status] || 'neutral'}`}>{optLabel(t, 'status', status)}</span>;
}

// ── Alta: buscar antes de crear ──────────────────────────────────────────
function NewPatientDialog({ convertClient, perms, onCreated, onOpen, onClose, pushToast }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(convertClient ? 'form' : 'search');
  const [q, setQ] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [mode, setMode] = useState(convertClient ? 'fromClient' : 'create');
  const [initial, setInitial] = useState(() => (convertClient
    ? emptyForm({ client: clientToForm(convertClient) }) : emptyForm()));

  useEffect(() => {
    const term = q.trim();
    if (step !== 'search' || term.length < 2) { setCandidates([]); return undefined; }
    let vigente = true;
    setBuscando(true);
    const timer = setTimeout(async () => {
      try {
        const r = await findCandidates(term);
        if (vigente) setCandidates(r || []);
      } catch {
        if (vigente) setCandidates([]);
      } finally {
        if (vigente) setBuscando(false);
      }
    }, 300);
    return () => { vigente = false; clearTimeout(timer); };
  }, [q, step]);

  const usarCliente = async (c) => {
    try {
      const cliente = await getClient(c.clientId);
      setInitial(emptyForm({ client: clientToForm(cliente) }));
      setMode('fromClient');
      setStep('form');
    } catch (err) {
      pushToast?.(err.message, 'danger');
    }
  };

  const nuevo = () => {
    setInitial(emptyForm(prefillFromSearch(q)));
    setMode('create');
    setStep('form');
  };

  const guardar = async (form) => {
    const patient = patientPayload(form.patient);
    const clinical = form.clinical ? clinicalPayload(form.clinical) : null;
    const detail = mode === 'fromClient'
      ? await createPatientFromClient(form.client.id, { patient, clinical })
      : await createPatient({ client: clientPayload(form.client), patient, clinical });
    onCreated(detail);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-xl salud-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{mode === 'fromClient' && step === 'form'
            ? t('patients.convertTitle', 'Convertir cliente en paciente')
            : t('patients.newPatient', 'Nuevo paciente')}</h3>
          <button className="icon-btn" type="button" onClick={onClose} aria-label={t('common.close', 'Cerrar')}><Icon name="close" /></button>
        </div>

        {step === 'search' ? (
          <>
            <div className="modal-body">
              <p className="muted salud-help">
                {t('patients.searchFirst', 'Busca primero por nombre, teléfono, DPI o NIT: si ya es cliente se convierte en paciente, y si ya es paciente se abre su expediente.')}
              </p>
              <div className="search-wrap">
                <Icon name="search" className="icon" size={13} />
                <input className="search-input" autoFocus value={q} onChange={(e) => setQ(e.target.value)}
                  placeholder={t('patients.searchPlaceholder', 'Nombre, teléfono, DPI o NIT…')}
                  aria-label={t('patients.searchPlaceholder', 'Nombre, teléfono, DPI o NIT…')} />
              </div>
              {buscando && <div className="muted salud-help">{t('patients.searching', 'Buscando…')}</div>}
              {candidates.length > 0 && (
                <ul className="salud-results">
                  {candidates.map((c) => (
                    <li key={c.clientId} className="salud-candidate">
                      <div>
                        <div className="salud-result-name">{c.name}</div>
                        <div className="muted mono">
                          {c.nit || 'CF'}{c.phone ? ` · ${c.phone}` : ''}{c.patient ? ` · ${c.recordNumber}` : ''}
                        </div>
                      </div>
                      {c.patient ? (
                        <Button type="button" variant="tonal" icon="folder" onClick={() => onOpen(c.clientId)}>
                          {t('patients.openRecord', 'Abrir expediente')}
                        </Button>
                      ) : (
                        <Button type="button" variant="tonal" icon="plus" disabled={!perms.crear} onClick={() => usarCliente(c)}>
                          {t('patients.convert', 'Convertir en paciente')}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {q.trim().length >= 2 && !buscando && candidates.length === 0 && (
                <div className="empty">{t('patients.noCandidates', 'No hay clientes ni pacientes que coincidan.')}</div>
              )}
            </div>
            <div className="modal-foot">
              <Button type="button" variant="ghost" onClick={onClose}>{t('common.cancel', 'Cancelar')}</Button>
              <Button type="button" variant="accent" icon="plus" disabled={!perms.crear} onClick={nuevo}>
                {t('patients.registerNew', 'Registrar paciente nuevo')}
              </Button>
            </div>
          </>
        ) : (
          <PatientForm mode={mode} initial={initial} canClinical={perms.editarClinico}
            onSubmit={guardar} onCancel={onClose} pushToast={pushToast} />
        )}
      </div>
    </div>
  );
}

// ── Cambio de estado ─────────────────────────────────────────────────────
function StatusDialog({ patient, onSave, onClose }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState(patient.status);
  const [deceasedOn, setDeceasedOn] = useState(patient.deceasedOn || '');
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{t('patients.status.title', 'Estado del paciente')}</h3>
          <button className="icon-btn" type="button" onClick={onClose} aria-label={t('common.close', 'Cerrar')}><Icon name="close" /></button>
        </div>
        <div className="modal-body salud-stack">
          <p className="muted salud-help">
            {t('patients.status.help', 'El expediente nunca se borra. Un paciente inactivo deja de aparecer en las búsquedas habituales.')}
          </p>
          <div className="field-group">
            <label className="field-label">{t('common.status', 'Estado')}</label>
            <Autocomplete value={status} onChange={(id) => setStatus(id ? String(id) : patient.status)}
              options={opts(t, 'status')} allowClear={false} aria-label={t('common.status', 'Estado')} />
          </div>
          {status === 'fallecido' && (
            <div className="field-group">
              <label className="field-label">{t('patients.status.deceasedOn', 'Fecha de fallecimiento')}</label>
              <DatePicker value={deceasedOn} onChange={setDeceasedOn} />
            </div>
          )}
        </div>
        <div className="modal-foot">
          <Button type="button" variant="ghost" onClick={onClose}>{t('common.cancel', 'Cancelar')}</Button>
          <Button type="button" variant="accent" icon="check"
            onClick={() => onSave({ status, deceasedOn: status === 'fallecido' && deceasedOn ? deceasedOn : null })}>
            {t('common.save', 'Guardar')}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Datos clínicos: edición ──────────────────────────────────────────────
function ClinicalDialog({ clinical, onSave, onClose, pushToast }) {
  const { t } = useTranslation();
  const [value, setValue] = useState(() => clinicalToForm(clinical));
  const [saving, setSaving] = useState(false);
  const guardar = async () => {
    if ((value.history || []).some((h) => h.kind === 'familiar' && h.description.trim() && !h.relative.trim())) {
      pushToast?.(t('patients.errors.familyRelative', 'Indica el parentesco de cada antecedente familiar.'), 'danger');
      return;
    }
    setSaving(true);
    try { await onSave(clinicalPayload(value)); } finally { setSaving(false); }
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-xl salud-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{t('patients.clinical.editTitle', 'Datos clínicos')}</h3>
          <button className="icon-btn" type="button" onClick={onClose} aria-label={t('common.close', 'Cerrar')}><Icon name="close" /></button>
        </div>
        <div className="modal-body salud-form-body">
          <ClinicalFields value={value} onChange={setValue} />
        </div>
        <div className="modal-foot">
          <Button type="button" variant="ghost" onClick={onClose}>{t('common.cancel', 'Cancelar')}</Button>
          <Button type="button" variant="accent" icon="check" disabled={saving} onClick={guardar}>{t('common.save', 'Guardar')}</Button>
        </div>
      </div>
    </div>
  );
}

// ── Consentimientos ──────────────────────────────────────────────────────
function ConsentsTab({ detail, canEdit, onAdd, onRevoke }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <div className="salud-stack">
      <DataTable
        columns={[
          { key: 'kind', header: t('patients.consents.kind', 'Consentimiento'), card: 'title',
            render: (c) => optLabel(t, 'consentKind', c.kind) },
          { key: 'granted', header: t('patients.consents.answer', 'Respuesta'), card: 'badge',
            render: (c) => (c.revokedAt
              ? <span className="badge-m3 neutral">{t('patients.consents.revoked', 'Revocado')}</span>
              : <span className={`badge-m3 ${c.granted ? 'success' : 'danger'}`}>
                {c.granted ? t('patients.consents.granted', 'Acepta') : t('patients.consents.denied', 'No acepta')}
              </span>) },
          { key: 'signedAt', header: t('patients.consents.signedAt', 'Firmado'), mono: true, render: (c) => fecha(c.signedAt) },
          { key: 'version', header: t('patients.consents.version', 'Versión del documento'), hideOnTablet: true, render: (c) => c.version || '—' },
        ]}
        rows={detail.consents}
        rowKey={(c) => c.id}
        density="compact"
        empty={t('patients.consents.empty', 'Sin consentimientos registrados')}
        emptyIcon="check"
        actions={canEdit ? (c) => (c.revokedAt ? null : (
          <Button variant="icon" icon="x" title={t('patients.consents.revoke', 'Revocar')} onClick={() => onRevoke(c)} />
        )) : null}
      />
      {canEdit && !form && (
        <div>
          <Button type="button" variant="tonal" icon="plus"
            onClick={() => setForm({ kind: 'datos', version: '', granted: true, signedOn: hoyIso(), notes: '' })}>
            {t('patients.consents.add', 'Registrar consentimiento')}
          </Button>
        </div>
      )}
      {form && (
        <div className="salud-row">
          <div className="form-grid salud-row-fields">
            <div className="field-group">
              <label className="field-label">{t('patients.consents.kind', 'Consentimiento')}</label>
              <Autocomplete value={form.kind} onChange={(id) => set('kind', id ? String(id) : 'datos')}
                options={opts(t, 'consentKind')} allowClear={false} aria-label={t('patients.consents.kind', 'Consentimiento')} />
            </div>
            <div className="field-group">
              <label className="field-label">{t('patients.consents.signedAt', 'Firmado')}</label>
              <DatePicker value={form.signedOn} onChange={(iso) => set('signedOn', iso)} />
            </div>
            <div className="field-group">
              <label className="field-label">{t('patients.consents.version', 'Versión del documento')}</label>
              <input className="field-input" value={form.version} onChange={(e) => set('version', e.target.value)} />
            </div>
            <label className="salud-check">
              <input type="checkbox" checked={form.granted} onChange={(e) => set('granted', e.target.checked)} />
              {t('patients.consents.grantedCheck', 'El paciente acepta')}
            </label>
            <div className="field-group span-2">
              <label className="field-label">{t('patients.clinical.notes', 'Notas')}</label>
              <input className="field-input" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
            </div>
          </div>
          <div className="salud-inline-actions">
            <Button type="button" variant="ghost" onClick={() => setForm(null)}>{t('common.cancel', 'Cancelar')}</Button>
            <Button type="button" variant="accent" icon="check" onClick={async () => {
              const ok = await onAdd({
                kind: form.kind, version: form.version.trim() || null, granted: form.granted,
                signedAt: consentSignedAt(form.signedOn), notes: form.notes.trim() || null,
              });
              if (ok) setForm(null);
            }}>{t('common.save', 'Guardar')}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Bitácora ─────────────────────────────────────────────────────────────
function AccessLogTab({ patientId }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let vigente = true;
    getAccessLog(patientId).then((r) => { if (vigente) setRows(r || []); }).catch(() => { if (vigente) setRows([]); });
    return () => { vigente = false; };
  }, [patientId]);
  return (
    <DataTable
      columns={[
        { key: 'occurredAt', header: t('patients.log.when', 'Fecha'), mono: true, card: 'title', render: (r) => fechaHora(r.occurredAt) },
        { key: 'userName', header: t('patients.log.user', 'Usuario'), card: 'subtitle', render: (r) => r.userName || '—' },
        { key: 'action', header: t('patients.log.action', 'Acción'), render: (r) => t(`patients.log.actions.${r.action}`, r.action) },
      ]}
      rows={(rows || []).map((r, i) => ({ ...r, _k: i }))}
      loading={rows == null}
      rowKey={(r) => r._k}
      density="compact"
      pageSize={25}
      empty={t('patients.log.empty', 'Sin registros')}
      emptyIcon="clock"
    />
  );
}

// ── Citas del paciente ───────────────────────────────────────────────────
const UN_ANIO = 365 * 24 * 3600 * 1000;

function AppointmentsTab({ patient, canSchedule }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let vigente = true;
    const ahora = Date.now();
    listAppointments({ patientId: patient.id, from: new Date(ahora - UN_ANIO).toISOString(), to: new Date(ahora + UN_ANIO).toISOString() })
      .then((r) => { if (vigente) setRows([...(r || [])].reverse()); })
      .catch(() => { if (vigente) setRows([]); });
    return () => { vigente = false; };
  }, [patient.id]);
  return (
    <div className="salud-stack">
      {canSchedule && patient.status === 'activo' && (
        <div className="salud-inline-actions salud-tab-actions">
          <Button icon="calendar" variant="tonal" onClick={() => navigate('/agenda', {
            state: { newForPatient: { id: patient.id, name: patient.name, recordNumber: patient.recordNumber, phone: patient.phone } },
          })}>
            {t('patients.appointments.new', 'Agendar cita')}
          </Button>
        </div>
      )}
      <DataTable
        columns={[
          { key: 'startsAt', header: t('patients.appointments.when', 'Fecha'), mono: true, card: 'title',
            render: (a) => `${fecha(gtDate(a.startsAt))} ${gtTime(a.startsAt)}` },
          { key: 'professionalName', header: t('patients.appointments.professional', 'Profesional'), card: 'subtitle' },
          { key: 'typeName', header: t('patients.appointments.type', 'Tipo'), hideOnTablet: true },
          { key: 'status', header: t('common.status', 'Estado'), card: 'badge',
            render: (a) => <span className={`badge-m3 ${APPT_STATUS[a.status]?.badge || 'neutral'}`}>{t(`agenda.status.${a.status}`, APPT_STATUS[a.status]?.label)}</span> },
        ]}
        rows={rows || []} loading={rows == null} rowKey={(a) => a.id} density="compact" pageSize={10}
        empty={t('patients.appointments.empty', 'Sin citas en el último año ni próximas')} emptyIcon="calendar"
      />
    </div>
  );
}

// ── Expediente (panel lateral) ───────────────────────────────────────────
function Row({ label, children }) {
  if (children == null || children === '' || children === false) return null;
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span>{children}</span>
    </div>
  );
}

const conClave = (rows) => (rows || []).map((r, i) => ({ ...r, _k: i }));

function ClinicalView({ clinical, updatedAt }) {
  const { t } = useTranslation();
  const c = clinical;
  const lista = (rows, columns, empty, icon) => (
    <DataTable columns={columns} rows={conClave(rows)} rowKey={(r) => r._k} density="compact" empty={empty} emptyIcon={icon} />
  );
  return (
    <div className="salud-stack">
      <div className="detail-grid">
        <Row label={t('patients.clinical.bloodType', 'Tipo de sangre')}>{c.bloodType}</Row>
        <Row label={t('patients.clinical.alertsShort', 'Alertas')}>{c.alerts}</Row>
        <Row label={t('patients.clinical.religionShort', 'Religión')}>{c.religion}</Row>
        <Row label={t('patients.clinical.disability', 'Discapacidad')}>{c.disability}</Row>
        <Row label={t('patients.clinical.specialNeeds', 'Necesidades especiales de atención')}>{c.specialNeeds}</Row>
        <Row label={t('patients.clinical.smoking', 'Tabaco')}>{c.smoking}</Row>
        <Row label={t('patients.clinical.alcohol', 'Alcohol')}>{c.alcohol}</Row>
        <Row label={t('patients.clinical.activity', 'Actividad física')}>{c.physicalActivity}</Row>
        <Row label={t('patients.clinical.diet', 'Alimentación')}>{c.diet}</Row>
        <Row label={t('patients.clinical.gyneco', 'Antecedentes gineco-obstétricos')}>{c.gynecoObstetric}</Row>
        <Row label={t('patients.clinical.directives', 'Directivas anticipadas')}>{c.advanceDirectives}</Row>
      </div>
      <h4 className="salud-section-title">{t('patients.clinical.allergies', 'Alergias')}</h4>
      {lista(c.allergies, [
        { key: 'allergen', header: t('patients.clinical.allergen', 'Alérgeno'), card: 'title' },
        { key: 'kind', header: t('patients.clinical.kind', 'Tipo'), render: (a) => optLabel(t, 'allergyKind', a.kind) },
        { key: 'reaction', header: t('patients.clinical.reaction', 'Reacción'), render: (a) => a.reaction || '—' },
        { key: 'severity', header: t('patients.clinical.severity', 'Severidad'), card: 'badge',
          render: (a) => (a.severity
            ? <span className={`badge-m3 ${a.severity === 'severa' ? 'danger' : a.severity === 'moderada' ? 'warning' : 'neutral'}`}>{optLabel(t, 'severity', a.severity)}</span>
            : '—') },
      ], t('patients.clinical.noAllergies', 'Sin alergias conocidas'), 'check')}
      <h4 className="salud-section-title">{t('patients.clinical.history', 'Antecedentes')}</h4>
      {lista(c.history, [
        { key: 'description', header: t('patients.clinical.description', 'Descripción'), card: 'title' },
        { key: 'kind', header: t('patients.clinical.kind', 'Tipo'), card: 'subtitle', render: (h) => optLabel(t, 'historyKind', h.kind) },
        { key: 'relative', header: t('patients.clinical.relativeShort', 'Parentesco'), render: (h) => h.relative || '—' },
        { key: 'cie10Code', header: 'CIE-10', mono: true, hideOnTablet: true, render: (h) => h.cie10Code || '—' },
        { key: 'occurred', header: t('patients.clinical.occurred', 'Desde / cuándo'), hideOnTablet: true, render: (h) => h.occurred || '—' },
      ], t('patients.clinical.noHistory', 'Sin antecedentes registrados'), 'folder')}
      <h4 className="salud-section-title">{t('patients.clinical.medications', 'Medicamentos de uso actual')}</h4>
      {lista(c.medications, [
        { key: 'name', header: t('patients.clinical.medication', 'Medicamento'), card: 'title' },
        { key: 'dose', header: t('patients.clinical.dose', 'Dosis'), render: (m) => m.dose || '—' },
        { key: 'frequency', header: t('patients.clinical.frequency', 'Frecuencia'), render: (m) => m.frequency || '—' },
      ], t('patients.clinical.noMedications', 'No toma medicamentos'), 'check')}
      <h4 className="salud-section-title">{t('patients.clinical.vaccines', 'Vacunas')}</h4>
      {lista(c.vaccines, [
        { key: 'vaccine', header: t('patients.clinical.vaccine', 'Vacuna'), card: 'title' },
        { key: 'dose', header: t('patients.clinical.dose', 'Dosis'), render: (v) => v.dose || '—' },
        { key: 'appliedOn', header: t('patients.clinical.appliedOn', 'Fecha de aplicación'), mono: true, render: (v) => fecha(v.appliedOn) },
      ], t('patients.clinical.noVaccines', 'Sin vacunas registradas'), 'check')}
      {updatedAt && <div className="muted salud-help">{t('patients.clinical.updatedAt', 'Actualizado el {{when}}', { when: fechaHora(updatedAt) })}</div>}
    </div>
  );
}

function PatientDrawer({ patientId, perms, onClose, onChanged, pushToast }) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const [detail, setDetail] = useState(null);
  const [tab, setTab] = useState('ficha');
  const [dialog, setDialog] = useState(null); // 'edit' | 'status' | 'clinical'

  useEffect(() => {
    let vigente = true;
    setDetail(null);
    getPatient(patientId)
      .then((d) => { if (vigente) setDetail(normalizeDetail(d)); })
      .catch((err) => { pushToast?.(err.message, 'danger'); onClose(); });
    return () => { vigente = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  const aplicar = (d, msg) => {
    setDetail(normalizeDetail(d));
    setDialog(null);
    onChanged?.();
    pushToast?.(msg, 'success');
  };
  const intentar = async (fn, msg) => {
    try { aplicar(await fn(), msg); return true; } catch (err) { pushToast?.(err.message, 'danger'); return false; }
  };

  if (!detail) {
    return (
      <div className="drawer drawer--md"><div className="drawer-body"><div className="empty">{t('patients.loading', 'Cargando expediente…')}</div></div></div>
    );
  }

  const { client, patient: p } = detail;
  const alertas = clinicalAlerts(detail.clinical);
  const tabs = [
    { id: 'ficha', label: t('patients.tabs.record', 'Ficha') },
    { id: 'guardians', label: t('patients.tabs.guardians', 'Responsables'), count: detail.guardians.length + detail.emergencyContacts.length },
    ...(detail.clinicalVisible ? [{ id: 'clinical', label: t('patients.tabs.clinical', 'Datos clínicos') }] : []),
    ...(perms.verClinico ? [{ id: 'encounters', label: t('patients.tabs.encounters', 'Consultas') }] : []),
    ...(perms.agenda ? [{ id: 'appointments', label: t('patients.tabs.appointments', 'Citas') }] : []),
    ...(perms.cuenta ? [{ id: 'account', label: t('patients.tabs.account', 'Cuenta') }] : []),
    { id: 'consents', label: t('patients.tabs.consents', 'Consentimientos'), count: detail.consents.length },
    ...(perms.verClinico ? [{ id: 'log', label: t('patients.tabs.log', 'Bitácora') }] : []),
  ];

  return (
    <div className="drawer drawer--md">
      <div className="drawer-head">
        <div className="salud-drawer-title">
          <div className="drawer-title">{client.name}</div>
          <div className="muted mono salud-badges">
            <span>{p.recordNumber}</span>
            {p.age != null && <span>{t('patients.ageYears', '{{n}} años', { n: p.age })}</span>}
            {p.docNumber && <span>{optLabel(t, 'docType', p.docType)} {p.docNumber}</span>}
            <StatusBadge status={p.status} />
            {p.age != null && p.age < MAYORIA_DE_EDAD && <span className="badge-m3 warning">{t('patients.minor', 'Menor de edad')}</span>}
          </div>
        </div>
        <div className="salud-inline-actions">
          {perms.editar && <Button icon="edit" onClick={() => setDialog('edit')}>{t('common.edit', 'Editar')}</Button>}
          {perms.editar && <Button icon="settings" variant="ghost" onClick={() => setDialog('status')}>{t('patients.status.button', 'Estado')}</Button>}
          <button className="icon-btn" type="button" onClick={onClose} aria-label={t('common.close', 'Cerrar')}><Icon name="x" /></button>
        </div>
      </div>

      {alertas.length > 0 && (
        <div className="salud-alerts" role="note">
          {alertas.map((a) => (
            <span key={a.text} className={`badge-m3 ${a.kind === 'allergy' ? 'warning' : 'danger'}`}>
              <Icon name="alert" size={14} /> {a.kind === 'alert' ? a.text : t('patients.allergyChip', 'Alergia: {{name}}', { name: a.text })}
            </span>
          ))}
        </div>
      )}

      <div className="tabs salud-drawer-tabs">
        {tabs.map((x) => (
          <button key={x.id} type="button" className={`tab ${tab === x.id ? 'active' : ''}`} onClick={() => setTab(x.id)}>
            {x.label}{x.count != null && <span className="count">{x.count}</span>}
          </button>
        ))}
      </div>

      <div className="drawer-body">
        {tab === 'ficha' && (
          <div className="detail-grid">
            <Row label={t('patients.fields.preferredName', 'Cómo prefiere que le llamen')}>{p.preferredName}</Row>
            <Row label={t('patients.fields.birthDate', 'Fecha de nacimiento')}>{p.birthDate && fecha(p.birthDate)}</Row>
            <Row label={t('patients.fields.sex', 'Sexo')}>{optLabel(t, 'sex', p.sex)}</Row>
            <Row label={t('patients.fields.genderShort', 'Género')}>{p.gender}</Row>
            <Row label={t('patients.fields.maritalStatus', 'Estado civil')}>{optLabel(t, 'maritalStatus', p.maritalStatus)}</Row>
            <Row label={t('patients.fields.nationality', 'Nacionalidad')}>{p.nationality}</Row>
            <Row label={t('patients.fields.occupation', 'Ocupación')}>{p.occupation}</Row>
            <Row label={t('patients.fields.education', 'Escolaridad')}>{p.education}</Row>
            <Row label={t('patients.fields.phone', 'Teléfono / WhatsApp')}>{client.phone}</Row>
            <Row label={t('patients.fields.email', 'Correo electrónico')}>{client.email}</Row>
            <Row label={t('patients.fields.address', 'Dirección')}>{client.address}</Row>
            <Row label={t('patients.fields.nit', 'NIT para facturar')}>{client.nit}</Row>
            <Row label={t('patients.fields.reminderChannel', 'Recordatorios por')}>
              {optLabel(t, 'reminderChannel', p.reminderChannel)}
              {!p.acceptsMessages && ` · ${t('patients.noMessages', 'no acepta mensajes')}`}
            </Row>
            <Row label={t('patients.fields.referralSource', '¿Cómo nos conoció?')}>{p.referralSource}</Row>
            <Row label={t('patients.fields.referredBy', 'Referido por')}>{p.referredBy}</Row>
            <Row label={t('patients.fields.insurer', 'Aseguradora')}>
              {p.insurerName && `${p.insurerName}${p.policyNumber ? ` · ${p.policyNumber}` : ''}${p.policyExpiresOn ? ` · ${t('patients.until', 'hasta')} ${fecha(p.policyExpiresOn)}` : ''}`}
            </Row>
            <Row label={t('patients.fields.agreement', 'Convenio o empresa')}>{p.agreementName}</Row>
            <Row label={t('patients.fields.adminNotes', 'Notas administrativas')}>{p.adminNotes}</Row>
            {p.status === 'fallecido' && <Row label={t('patients.status.deceasedOn', 'Fecha de fallecimiento')}>{p.deceasedOn ? fecha(p.deceasedOn) : '—'}</Row>}
            <Row label={t('patients.since', 'Paciente desde')}>{fecha(p.createdAt)}</Row>
          </div>
        )}

        {tab === 'guardians' && (
          <div className="salud-stack">
            <h4 className="salud-section-title">{t('patients.tabs.guardians', 'Responsables')}</h4>
            <DataTable
              columns={[
                { key: 'name', header: t('patients.guardians.client', 'Cliente'), card: 'title' },
                { key: 'relationship', header: t('patients.guardians.relationshipShort', 'Parentesco'), card: 'subtitle' },
                { key: 'roles', header: t('patients.guardians.role', 'Rol'), card: 'badge',
                  render: (g) => (
                    <span className="salud-badges">
                      {g.legalGuardian && <span className="badge-m3 info">{t('patients.guardians.legal', 'Tutor legal')}</span>}
                      {g.payer && <span className="badge-m3 accent">{t('patients.guardians.payerShort', 'Paga')}</span>}
                    </span>
                  ) },
                { key: 'phone', header: t('patients.fields.phoneShort', 'Teléfono'), render: (g) => g.phone || '—' },
              ]}
              rows={detail.guardians} rowKey={(g) => g.clientId} density="compact"
              empty={t('patients.guardians.empty', 'Sin responsables. El paciente paga sus propias consultas.')} emptyIcon="users" />
            <h4 className="salud-section-title">{t('patients.form.emergency', 'Contactos de emergencia')}</h4>
            <DataTable
              columns={[
                { key: 'name', header: t('patients.fields.contactName', 'Nombre'), card: 'title' },
                { key: 'relationship', header: t('patients.fields.contactRelationship', 'Parentesco'), card: 'subtitle', render: (c) => c.relationship || '—' },
                { key: 'phone', header: t('patients.fields.phoneShort', 'Teléfono'), mono: true },
              ]}
              rows={conClave(detail.emergencyContacts)} rowKey={(c) => c._k} density="compact"
              empty={t('patients.form.noContacts', 'Sin contactos de emergencia')} emptyIcon="user" />
          </div>
        )}

        {tab === 'clinical' && detail.clinicalVisible && (
          <>
            {perms.editarClinico && (
              <div className="salud-inline-actions salud-tab-actions">
                <Button icon="edit" variant="tonal" onClick={() => setDialog('clinical')}>
                  {t('patients.clinical.edit', 'Editar datos clínicos')}
                </Button>
              </div>
            )}
            <ClinicalView clinical={detail.clinical} updatedAt={detail.clinicalUpdatedAt} />
          </>
        )}

        {tab === 'consents' && (
          <ConsentsTab detail={detail} canEdit={perms.editar}
            onAdd={(body) => intentar(() => addConsent(p.id, body), t('patients.consents.added', 'Consentimiento registrado'))}
            onRevoke={async (c) => {
              const ok = await confirm({
                title: t('patients.consents.revokeTitle', '¿Revocar el consentimiento?'),
                message: t('patients.consents.revokeMsg', 'Queda registrado quién y cuándo lo revocó. No se puede deshacer; si cambia de opinión, registra uno nuevo.'),
                confirmLabel: t('patients.consents.revoke', 'Revocar'), danger: true,
              });
              if (ok) await intentar(() => revokeConsent(p.id, c.id), t('patients.consents.revokedOk', 'Consentimiento revocado'));
            }} />
        )}

        {tab === 'appointments' && perms.agenda && (
          <AppointmentsTab canSchedule={perms.agendar}
            patient={{ id: p.id, name: client.name, recordNumber: p.recordNumber, phone: client.phone, status: p.status }} />
        )}

        {tab === 'encounters' && perms.verClinico && (
          <ClinicalHistory canEdit={perms.editarClinico} canSchedule={perms.agendar} pushToast={pushToast}
            patient={{ id: p.id, name: client.name, recordNumber: p.recordNumber, phone: client.phone }} />
        )}

        {tab === 'account' && perms.cuenta && <PatientAccount patientId={p.id} canCreate={perms.cobrar} pushToast={pushToast} />}

        {tab === 'log' && perms.verClinico && <AccessLogTab patientId={p.id} />}
      </div>

      {dialog === 'edit' && (
        <div className="modal-backdrop" onClick={() => setDialog(null)}>
          <div className="modal modal-xl salud-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{t('patients.editTitle', 'Editar paciente')}</h3>
              <button className="icon-btn" type="button" onClick={() => setDialog(null)} aria-label={t('common.close', 'Cerrar')}><Icon name="close" /></button>
            </div>
            <PatientForm mode="edit" initial={formFromDetail(detail)} pushToast={pushToast}
              onCancel={() => setDialog(null)}
              onSubmit={async (form) => aplicar(
                await updatePatient(p.id, { client: clientPayload(form.client), patient: patientPayload(form.patient) }),
                t('patients.updated', 'Paciente actualizado'))} />
          </div>
        </div>
      )}
      {dialog === 'status' && (
        <StatusDialog patient={p} onClose={() => setDialog(null)}
          onSave={(body) => intentar(() => changePatientStatus(p.id, body), t('patients.status.saved', 'Estado actualizado'))} />
      )}
      {dialog === 'clinical' && (
        <ClinicalDialog clinical={detail.clinical} pushToast={pushToast} onClose={() => setDialog(null)}
          onSave={(body) => intentar(() => updateClinical(p.id, body), t('patients.clinical.saved', 'Datos clínicos guardados'))} />
      )}
    </div>
  );
}

// ── Pantalla ─────────────────────────────────────────────────────────────
export default function Patients({ pushToast }) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const perms = usePerms();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('activo');
  const [page, setPage] = useState(0);
  const [data, setData] = useState({ content: [], totalSize: 0 });
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(location.state?.openPatientId ?? null);
  const [showNew, setShowNew] = useState(Boolean(location.state?.convertClient));
  const [convertClient, setConvertClient] = useState(location.state?.convertClient ?? null);

  // Lo que llega desde Clientes (abrir o convertir) se consume una sola vez.
  useEffect(() => {
    if (location.state?.openPatientId || location.state?.convertClient) {
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      setData(await listPatients({ search: search.trim(), status, page, size: PAGE_SIZE }));
    } catch (err) {
      setData({ content: [], totalSize: 0 });
      pushToast?.(t('patients.loadFailed', 'No se pudieron cargar los pacientes: ') + err.message, 'danger');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, page]);

  useEffect(() => {
    const timer = setTimeout(cargar, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [cargar, search]);

  const total = data.totalSize || 0;
  const desde = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const hasta = Math.min(total, (page + 1) * PAGE_SIZE);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('patients.title', 'Pacientes')}</h1>
          <div className="page-subtitle">{t('patients.subtitle', '{{count}} pacientes', { count: total })}</div>
        </div>
        <div className="page-head-actions">
          {perms.crear && (
            <Button icon="plus" variant="accent" onClick={() => { setConvertClient(null); setShowNew(true); }}>
              {t('patients.newPatient', 'Nuevo paciente')}
            </Button>
          )}
        </div>
      </div>

      <div className="toolbar">
        <div className="search-wrap filterbar-grow">
          <Icon name="search" className="icon" size={13} />
          <input className="search-input" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder={t('patients.listSearch', 'Buscar por nombre, expediente, DPI, NIT o teléfono…')}
            aria-label={t('patients.listSearch', 'Buscar por nombre, expediente, DPI, NIT o teléfono…')} />
        </div>
        <Autocomplete value={status || 'all'}
          onChange={(id) => { setStatus(!id || id === 'all' ? '' : String(id)); setPage(0); }}
          options={[{ id: 'all', name: t('patients.allStatuses', 'Todos los estados') }, ...opts(t, 'status')]}
          allowClear={false} aria-label={t('common.status', 'Estado')} />
      </div>

      <div className="table-wrap">
        <DataTable
          columns={[
            { key: 'name', header: t('patients.columns.patient', 'Paciente'), card: 'title',
              render: (r) => <span className="salud-result-name">{r.name}</span> },
            { key: 'recordNumber', header: t('patients.columns.record', 'Expediente'), mono: true, card: 'subtitle' },
            { key: 'doc', header: t('patients.columns.doc', 'Documento'), mono: true, hideOnTablet: true,
              render: (r) => (r.docNumber ? `${r.docType} ${r.docNumber}` : '—') },
            { key: 'age', header: t('patients.columns.age', 'Edad'), align: 'right',
              render: (r) => (r.age == null ? '—' : r.age) },
            { key: 'phone', header: t('patients.fields.phoneShort', 'Teléfono'), hideOnTablet: true, render: (r) => r.phone || '—' },
            { key: 'status', header: t('common.status', 'Estado'), card: 'badge', render: (r) => <StatusBadge status={r.status} /> },
          ]}
          rows={data.content}
          rowKey={(r) => r.id}
          loading={loading}
          sortable={false}
          onRowClick={(r) => setOpenId(r.id)}
          onRefresh={cargar}
          empty={search ? t('patients.noResults', 'Sin resultados') : t('patients.empty', 'Aún no hay pacientes registrados')}
          emptyIcon="user"
        />
      </div>

      {total > PAGE_SIZE && (
        <div className="salud-pager">
          <span className="muted">{t('patients.range', '{{from}}–{{to}} de {{total}}', { from: desde, to: hasta, total })}</span>
          <Button variant="ghost" icon="chevronLeft" disabled={page === 0} onClick={() => setPage((x) => x - 1)}>
            {t('patients.previous', 'Anterior')}
          </Button>
          <Button variant="ghost" iconRight="chevronRight" disabled={hasta >= total} onClick={() => setPage((x) => x + 1)}>
            {t('patients.next', 'Siguiente')}
          </Button>
        </div>
      )}

      {openId != null && (
        <div className="drawer-overlay" onClick={(e) => { if (e.target === e.currentTarget) setOpenId(null); }}>
          <PatientDrawer patientId={openId} perms={perms} pushToast={pushToast}
            onClose={() => setOpenId(null)} onChanged={cargar} />
        </div>
      )}

      {showNew && (
        <NewPatientDialog convertClient={convertClient} perms={perms} pushToast={pushToast}
          onClose={() => { setShowNew(false); setConvertClient(null); }}
          onOpen={(id) => { setShowNew(false); setOpenId(id); }}
          onCreated={(d) => {
            setShowNew(false);
            setConvertClient(null);
            pushToast?.(t('patients.created', 'Paciente registrado · expediente {{n}}', { n: d.patient.recordNumber }), 'success');
            cargar();
            setOpenId(d.patient.id);
          }} />
      )}
    </div>
  );
}
