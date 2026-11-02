// Bloquear la agenda de un profesional o un recurso: vacaciones, un
// congreso, un consultorio en mantenimiento. Si ya hay citas en ese horario
// el backend no deja bloquear y dice cuántas son.
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../Button.jsx';
import Icon from '../Icon.jsx';
import Autocomplete from '../Autocomplete.jsx';
import DatePicker from '../DatePicker.jsx';
import TimeSelect from './TimeSelect.jsx';
import { createBlock } from '../../api/salud.js';
import { toInstant, todayGt } from '../../lib/agenda.js';

export default function BlockDialog({ professionals, resources, initial = {}, onCreated, onClose, pushToast }) {
  const { t } = useTranslation();
  const hoy = initial.date || todayGt();
  const [f, setF] = useState({
    target: initial.resourceId ? 'resource' : 'professional',
    professionalId: initial.professionalId ?? '', resourceId: initial.resourceId ?? '',
    fromDate: hoy, fromTime: '08:00', toDate: hoy, toTime: '18:00', reason: '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const desde = f.fromDate && f.fromTime ? toInstant(f.fromDate, f.fromTime) : null;
  const hasta = f.toDate && f.toTime ? toInstant(f.toDate, f.toTime) : null;
  const rangoOk = desde && hasta && Date.parse(hasta) > Date.parse(desde);
  const destino = f.target === 'professional' ? f.professionalId : f.resourceId;

  const guardar = async () => {
    setSaving(true);
    try {
      await createBlock({
        professionalId: f.target === 'professional' ? Number(f.professionalId) : null,
        resourceId: f.target === 'resource' ? Number(f.resourceId) : null,
        startsAt: desde, endsAt: hasta, reason: f.reason.trim() || null,
      });
      onCreated();
    } catch (err) {
      pushToast?.(err.message, 'danger');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-md" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{t('agenda.block.title', 'Bloquear horario')}</h3>
          <button className="icon-btn" type="button" onClick={onClose} aria-label={t('common.close', 'Cerrar')}><Icon name="close" /></button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="span-2 ag-segment" role="radiogroup">
              {['professional', 'resource'].map((k) => (
                <button key={k} type="button" role="radio" aria-checked={f.target === k}
                  className={`chip${f.target === k ? ' active' : ''}`} onClick={() => set('target', k)}>
                  {k === 'professional' ? t('agenda.block.professional', 'Un profesional') : t('agenda.block.resource', 'Un recurso')}
                </button>
              ))}
            </div>
            <div className="field-group span-2">
              <label className="field-label">{f.target === 'professional' ? t('agenda.form.professional', 'Profesional *') : t('agenda.block.resourceLabel', 'Recurso *')}</label>
              {f.target === 'professional' ? (
                <Autocomplete value={f.professionalId} onChange={(id) => set('professionalId', id ?? '')}
                  options={professionals.filter((p) => p.configured).map((p) => ({ id: p.userId, name: p.name }))}
                  aria-label={t('agenda.form.professional', 'Profesional *')} />
              ) : (
                <Autocomplete value={f.resourceId} onChange={(id) => set('resourceId', id ?? '')}
                  options={resources.map((r) => ({ id: r.id, name: r.name }))}
                  aria-label={t('agenda.block.resourceLabel', 'Recurso *')} />
              )}
            </div>
            <div className="field-group">
              <label className="field-label">{t('agenda.block.from', 'Desde')}</label>
              <DatePicker value={f.fromDate} onChange={(iso) => set('fromDate', iso)} />
            </div>
            <div className="field-group">
              <label className="field-label">{t('agenda.block.fromTime', 'Hora de inicio')}</label>
              <TimeSelect value={f.fromTime} onChange={(h) => set('fromTime', h)} from="00:00" to="23:45" aria-label={t('agenda.block.fromTime', 'Hora de inicio')} />
            </div>
            <div className="field-group">
              <label className="field-label">{t('agenda.block.to', 'Hasta')}</label>
              <DatePicker value={f.toDate} onChange={(iso) => set('toDate', iso)} />
            </div>
            <div className="field-group">
              <label className="field-label">{t('agenda.block.toTime', 'Hora de fin')}</label>
              <TimeSelect value={f.toTime} onChange={(h) => set('toTime', h)} from="00:00" to="23:45" aria-label={t('agenda.block.toTime', 'Hora de fin')} />
            </div>
            <div className="field-group span-2">
              <label className="field-label">{t('agenda.block.reason', 'Motivo')}</label>
              <input className="field-input" value={f.reason} maxLength={200}
                placeholder={t('agenda.block.reasonHint', 'Vacaciones, congreso, mantenimiento…')}
                onChange={(e) => set('reason', e.target.value)} />
            </div>
            {!rangoOk && desde && hasta && (
              <div className="span-2 muted salud-help">{t('agenda.block.badRange', 'El bloqueo debe terminar después de empezar.')}</div>
            )}
          </div>
        </div>
        <div className="modal-foot">
          <Button type="button" variant="ghost" onClick={onClose}>{t('common.cancel', 'Cancelar')}</Button>
          <Button type="button" variant="accent" icon="lock" disabled={saving || !rangoOk || !destino} onClick={guardar}>
            {t('agenda.block.save', 'Bloquear')}
          </Button>
        </div>
      </div>
    </div>
  );
}
