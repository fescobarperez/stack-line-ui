// Datos clínicos base del paciente: alertas, alergias, antecedentes,
// medicamentos, vacunas y hábitos. Solo lo ve quien tiene el permiso de
// expediente clínico; el backend lo vuelve a validar.
import React from 'react';
import { useTranslation } from 'react-i18next';
import Autocomplete from '../Autocomplete.jsx';
import RowsEditor from './RowsEditor.jsx';
import { opts } from './options.js';
import { emptyAllergy, emptyHistory, emptyMedication, emptyVaccine } from '../../lib/patients.js';

function Section({ title, children }) {
  return (
    <section className="salud-section">
      <h4 className="salud-section-title">{title}</h4>
      {children}
    </section>
  );
}

export default function ClinicalFields({ value, onChange }) {
  const { t } = useTranslation();
  const set = (k, v) => onChange({ ...value, [k]: v });
  const text = (k, label, { wide = false, area = false } = {}) => (
    <div className={`field-group${wide ? ' span-2' : ''}`}>
      <label className="field-label">{label}</label>
      {area ? (
        <textarea className="field-input" rows={2} value={value[k] ?? ''} onChange={(e) => set(k, e.target.value)} />
      ) : (
        <input className="field-input" value={value[k] ?? ''} onChange={(e) => set(k, e.target.value)} />
      )}
    </div>
  );

  return (
    <div className="salud-clinical">
      <Section title={t('patients.clinical.base', 'Datos base y alertas')}>
        <div className="form-grid">
          <div className="field-group">
            <label className="field-label">{t('patients.clinical.bloodType', 'Tipo de sangre')}</label>
            <Autocomplete value={value.bloodType ?? ''} onChange={(id) => set('bloodType', id == null ? '' : String(id))}
              options={opts(t, 'bloodType')} emptyText={t('common.noMatches', 'Sin coincidencias')}
              aria-label={t('patients.clinical.bloodType', 'Tipo de sangre')} />
          </div>
          {text('religion', t('patients.clinical.religion', 'Religión (si influye en la atención)'))}
          {text('alerts', t('patients.clinical.alerts', 'Alertas clínicas (se muestran al abrir el expediente)'), { wide: true, area: true })}
        </div>
      </Section>

      <Section title={t('patients.clinical.allergies', 'Alergias')}>
        <RowsEditor rows={value.allergies} onChange={(rows) => set('allergies', rows)} newRow={emptyAllergy}
          addLabel={t('patients.clinical.addAllergy', 'Agregar alergia')}
          empty={t('patients.clinical.noAllergies', 'Sin alergias conocidas')}
          fields={[
            { key: 'kind', label: t('patients.clinical.kind', 'Tipo'), type: 'select', options: opts(t, 'allergyKind'), required: true },
            { key: 'allergen', label: t('patients.clinical.allergen', 'Alérgeno'), required: true },
            { key: 'reaction', label: t('patients.clinical.reaction', 'Reacción') },
            { key: 'severity', label: t('patients.clinical.severity', 'Severidad'), type: 'select', options: opts(t, 'severity') },
          ]} />
      </Section>

      <Section title={t('patients.clinical.history', 'Antecedentes')}>
        <RowsEditor rows={value.history} onChange={(rows) => set('history', rows)} newRow={emptyHistory}
          addLabel={t('patients.clinical.addHistory', 'Agregar antecedente')}
          empty={t('patients.clinical.noHistory', 'Sin antecedentes registrados')}
          fields={[
            { key: 'kind', label: t('patients.clinical.kind', 'Tipo'), type: 'select', options: opts(t, 'historyKind'), required: true },
            { key: 'description', label: t('patients.clinical.description', 'Descripción'), required: true },
            { key: 'cie10Code', label: t('patients.clinical.cie10', 'CIE-10') },
            { key: 'relative', label: t('patients.clinical.relative', 'Parentesco (si es familiar)') },
            { key: 'occurred', label: t('patients.clinical.occurred', 'Desde / cuándo') },
            { key: 'notes', label: t('patients.clinical.notes', 'Notas') },
          ]} />
      </Section>

      <Section title={t('patients.clinical.medications', 'Medicamentos de uso actual')}>
        <RowsEditor rows={value.medications} onChange={(rows) => set('medications', rows)} newRow={emptyMedication}
          addLabel={t('patients.clinical.addMedication', 'Agregar medicamento')}
          empty={t('patients.clinical.noMedications', 'No toma medicamentos')}
          fields={[
            { key: 'name', label: t('patients.clinical.medication', 'Medicamento'), required: true },
            { key: 'dose', label: t('patients.clinical.dose', 'Dosis') },
            { key: 'frequency', label: t('patients.clinical.frequency', 'Frecuencia') },
            { key: 'since', label: t('patients.clinical.since', 'Desde') },
          ]} />
      </Section>

      <Section title={t('patients.clinical.vaccines', 'Vacunas')}>
        <RowsEditor rows={value.vaccines} onChange={(rows) => set('vaccines', rows)} newRow={emptyVaccine}
          addLabel={t('patients.clinical.addVaccine', 'Agregar vacuna')}
          empty={t('patients.clinical.noVaccines', 'Sin vacunas registradas')}
          fields={[
            { key: 'vaccine', label: t('patients.clinical.vaccine', 'Vacuna'), required: true },
            { key: 'dose', label: t('patients.clinical.dose', 'Dosis') },
            { key: 'appliedOn', label: t('patients.clinical.appliedOn', 'Fecha de aplicación'), type: 'date' },
            { key: 'notes', label: t('patients.clinical.notes', 'Notas') },
          ]} />
      </Section>

      <Section title={t('patients.clinical.habits', 'Hábitos')}>
        <div className="form-grid">
          {text('smoking', t('patients.clinical.smoking', 'Tabaco'))}
          {text('alcohol', t('patients.clinical.alcohol', 'Alcohol'))}
          {text('physicalActivity', t('patients.clinical.activity', 'Actividad física'))}
          {text('diet', t('patients.clinical.diet', 'Alimentación'))}
        </div>
      </Section>

      <Section title={t('patients.clinical.other', 'Otros datos')}>
        <div className="form-grid">
          {text('disability', t('patients.clinical.disability', 'Discapacidad'))}
          {text('specialNeeds', t('patients.clinical.specialNeeds', 'Necesidades especiales de atención'))}
          {text('gynecoObstetric', t('patients.clinical.gyneco', 'Antecedentes gineco-obstétricos'), { wide: true, area: true })}
          {text('advanceDirectives', t('patients.clinical.directives', 'Directivas anticipadas'), { wide: true, area: true })}
        </div>
      </Section>
    </div>
  );
}
