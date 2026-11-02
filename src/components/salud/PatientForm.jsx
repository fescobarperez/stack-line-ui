// Formulario único del paciente: alta nueva, conversión de un cliente
// existente y edición. Una sola pantalla con pestañas; al guardar se crean
// o actualizan cliente y paciente juntos (el backend lo hace en una
// transacción).
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../Button.jsx';
import Icon from '../Icon.jsx';
import Autocomplete from '../Autocomplete.jsx';
import DatePicker from '../DatePicker.jsx';
import RowsEditor from './RowsEditor.jsx';
import GuardianEditor from './GuardianEditor.jsx';
import ClinicalFields from './ClinicalFields.jsx';
import { opts } from './options.js';
import { useUsers } from '../../hooks/useMasters.js';
import { ageFrom, emptyClinical, emptyContact, validateForm, MAYORIA_DE_EDAD } from '../../lib/patients.js';

/**
 * @param {'create'|'fromClient'|'edit'} mode
 * @param {object}   initial     formulario (lib/patients.js emptyForm / formFromDetail)
 * @param {boolean}  canClinical puede capturar datos clínicos (solo en alta)
 * @param {function} onSubmit    (form) => Promise
 */
export default function PatientForm({ mode, initial, canClinical = false, onSubmit, onCancel, pushToast }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(initial);
  const [tab, setTab] = useState('personal');
  const [errores, setErrores] = useState([]);
  const [saving, setSaving] = useState(false);
  const { items: users } = useUsers();

  const clienteFijo = mode === 'fromClient';
  const conClinico = canClinical && mode !== 'edit';
  const setC = (k, v) => setForm((f) => ({ ...f, client: { ...f.client, [k]: v } }));
  const setP = (k, v) => setForm((f) => ({ ...f, patient: { ...f.patient, [k]: v } }));
  const edad = ageFrom(form.patient.birthDate);
  const tabs = useMemo(() => [
    { id: 'personal', label: t('patients.tabs.personal', 'Datos personales') },
    { id: 'contact', label: t('patients.tabs.contact', 'Contacto y seguro') },
    { id: 'guardians', label: t('patients.tabs.guardians', 'Responsables') },
    ...(conClinico ? [{ id: 'clinical', label: t('patients.tabs.clinical', 'Datos clínicos') }] : []),
  ], [t, conClinico]);

  const professionals = users.filter((u) => u.status === 'active').map((u) => ({ id: u.id, name: u.name }));

  const submit = async (e) => {
    e.preventDefault();
    const errs = validateForm(form);
    setErrores(errs);
    if (errs.length) { setTab(errs[0].tab); return; }
    setSaving(true);
    try {
      await onSubmit(form);
    } catch (err) {
      pushToast?.(t('patients.saveFailed', 'No se pudo guardar el paciente: ') + err.message, 'danger');
    } finally {
      setSaving(false);
    }
  };

  const input = (scope, k, label, { wide = false, mono = false, type = 'text', disabled = false, placeholder } = {}) => {
    const val = scope === 'client' ? form.client[k] : form.patient[k];
    const set = scope === 'client' ? setC : setP;
    return (
      <div className={`field-group${wide ? ' span-2' : ''}`}>
        <label className="field-label">{label}</label>
        <input className={`field-input${mono ? ' mono' : ''}`} type={type} value={val ?? ''} disabled={disabled}
          placeholder={placeholder} aria-label={label} onChange={(e) => set(k, e.target.value)} />
      </div>
    );
  };
  const select = (k, label, group, { required = false } = {}) => (
    <div className="field-group">
      <label className="field-label">{label}</label>
      <Autocomplete value={form.patient[k] ?? ''} onChange={(id) => setP(k, id == null ? '' : String(id))}
        options={opts(t, group)} allowClear={!required}
        emptyText={t('common.noMatches', 'Sin coincidencias')} aria-label={label} />
    </div>
  );
  const fecha = (k, label) => (
    <div className="field-group">
      <label className="field-label">{label}</label>
      <DatePicker value={form.patient[k] ?? ''} onChange={(iso) => setP(k, iso)} />
    </div>
  );

  return (
    <form className="salud-form" onSubmit={submit}>
      <div className="tabs salud-form-tabs">
        {tabs.map((x) => (
          <button key={x.id} type="button" className={`tab ${tab === x.id ? 'active' : ''}`} onClick={() => setTab(x.id)}>
            {x.label}
            {errores.some((e) => e.tab === x.id) && <Icon name="alert" size={14} className="salud-tab-alert" />}
          </button>
        ))}
      </div>

      <div className="modal-body salud-form-body">
        {errores.length > 0 && (
          <div className="alert salud-errors" role="alert">
            <Icon name="alert" size={16} />
            <ul>{errores.map((e) => <li key={e.key}>{t(`patients.errors.${e.key}`, e.msg)}</li>)}</ul>
          </div>
        )}

        {tab === 'personal' && (
          <div className="form-grid">
            {clienteFijo && (
              <div className="span-2 muted salud-help">
                {t('patients.form.fromClientHint', 'Se usa el cliente existente. Sus datos de contacto se editan después desde la ficha del paciente.')}
              </div>
            )}
            {input('client', 'name', t('patients.fields.name', 'Nombre completo *'), { wide: true, disabled: clienteFijo })}
            {input('patient', 'preferredName', t('patients.fields.preferredName', 'Cómo prefiere que le llamen'))}
            {select('docType', t('patients.fields.docType', 'Documento'), 'docType')}
            {input('patient', 'docNumber', t('patients.fields.docNumber', 'Número de documento'), { mono: true })}
            {fecha('birthDate', t('patients.fields.birthDate', 'Fecha de nacimiento'))}
            <div className="field-group">
              <span className="field-label">{t('patients.fields.age', 'Edad')}</span>
              <span className="salud-age">
                {edad == null ? '—' : t('patients.ageYears', '{{n}} años', { n: edad })}
                {edad != null && edad < MAYORIA_DE_EDAD && (
                  <span className="badge-m3 warning">{t('patients.minor', 'Menor de edad')}</span>
                )}
              </span>
            </div>
            {select('sex', t('patients.fields.sex', 'Sexo'), 'sex')}
            {input('patient', 'gender', t('patients.fields.gender', 'Género (si difiere)'))}
            {select('maritalStatus', t('patients.fields.maritalStatus', 'Estado civil'), 'maritalStatus')}
            {input('patient', 'nationality', t('patients.fields.nationality', 'Nacionalidad'))}
            {input('patient', 'occupation', t('patients.fields.occupation', 'Ocupación'))}
            {input('patient', 'education', t('patients.fields.education', 'Escolaridad'))}
          </div>
        )}

        {tab === 'contact' && (
          <div className="form-grid">
            {input('client', 'phone', t('patients.fields.phone', 'Teléfono / WhatsApp'), { disabled: clienteFijo })}
            {input('client', 'email', t('patients.fields.email', 'Correo electrónico'), { type: 'email', disabled: clienteFijo })}
            {input('client', 'address', t('patients.fields.address', 'Dirección'), { wide: true, disabled: clienteFijo })}
            {input('client', 'nit', t('patients.fields.nit', 'NIT para facturar'), { mono: true, disabled: clienteFijo, placeholder: 'CF' })}
            {select('reminderChannel', t('patients.fields.reminderChannel', 'Recordatorios por'), 'reminderChannel', { required: true })}
            <label className="salud-check span-2">
              <input type="checkbox" checked={!!form.patient.acceptsMessages}
                onChange={(e) => setP('acceptsMessages', e.target.checked)} />
              {t('patients.fields.acceptsMessages', 'Acepta recibir recordatorios y mensajes')}
            </label>
            <div className="field-group">
              <label className="field-label">{t('patients.fields.professional', 'Profesional de cabecera')}</label>
              <Autocomplete value={form.patient.primaryProfessionalId ?? ''}
                onChange={(id) => setP('primaryProfessionalId', id == null ? '' : id)}
                options={professionals} emptyText={t('common.noMatches', 'Sin coincidencias')}
                aria-label={t('patients.fields.professional', 'Profesional de cabecera')} />
            </div>
            {input('patient', 'referralSource', t('patients.fields.referralSource', '¿Cómo nos conoció?'))}
            {input('patient', 'referredBy', t('patients.fields.referredBy', 'Referido por'), { wide: true })}

            <h4 className="salud-section-title span-2">{t('patients.form.insurance', 'Seguro o convenio')}</h4>
            {input('patient', 'insurerName', t('patients.fields.insurer', 'Aseguradora'))}
            {input('patient', 'policyNumber', t('patients.fields.policy', 'Póliza o afiliado'), { mono: true })}
            {fecha('policyExpiresOn', t('patients.fields.policyExpires', 'Vigente hasta'))}
            {input('patient', 'agreementName', t('patients.fields.agreement', 'Convenio o empresa'))}

            <h4 className="salud-section-title span-2">{t('patients.form.emergency', 'Contactos de emergencia')}</h4>
            <div className="span-2">
              <RowsEditor rows={form.patient.emergencyContacts} onChange={(rows) => setP('emergencyContacts', rows)}
                newRow={emptyContact}
                addLabel={t('patients.form.addContact', 'Agregar contacto')}
                empty={t('patients.form.noContacts', 'Sin contactos de emergencia')}
                fields={[
                  { key: 'name', label: t('patients.fields.contactName', 'Nombre'), required: true },
                  { key: 'relationship', label: t('patients.fields.contactRelationship', 'Parentesco') },
                  { key: 'phone', label: t('patients.fields.phoneShort', 'Teléfono'), required: true },
                ]} />
            </div>

            <div className="field-group span-2">
              <label className="field-label">{t('patients.fields.adminNotes', 'Notas administrativas')}</label>
              <textarea className="field-input" rows={2} value={form.patient.adminNotes}
                onChange={(e) => setP('adminNotes', e.target.value)} />
            </div>
          </div>
        )}

        {tab === 'guardians' && (
          <GuardianEditor guardians={form.patient.guardians} onChange={(g) => setP('guardians', g)}
            patientClientId={form.client.id} pushToast={pushToast} />
        )}

        {tab === 'clinical' && conClinico && (
          form.clinical ? (
            <ClinicalFields value={form.clinical} onChange={(c) => setForm((f) => ({ ...f, clinical: c }))} />
          ) : (
            <div className="empty">
              <p>{t('patients.form.clinicalLater', 'Los datos clínicos se pueden capturar ahora o después, desde el expediente.')}</p>
              <Button type="button" variant="tonal" icon="plus"
                onClick={() => setForm((f) => ({ ...f, clinical: emptyClinical() }))}>
                {t('patients.form.addClinical', 'Capturar datos clínicos')}
              </Button>
            </div>
          )
        )}
      </div>

      <div className="modal-foot">
        <Button type="button" variant="ghost" onClick={onCancel}>{t('common.cancel', 'Cancelar')}</Button>
        <Button type="submit" variant="accent" icon="check" disabled={saving}>
          {mode === 'edit' ? t('common.save', 'Guardar') : t('patients.form.register', 'Registrar paciente')}
        </Button>
      </div>
    </form>
  );
}
