// La consulta: nota SOAP, signos vitales, diagnósticos CIE-10, receta,
// respuesta al tratamiento (en los controles) y plan de seguimiento. Se
// guarda como borrador las veces que haga falta y se firma; firmada queda de
// solo lectura y las correcciones van como adenda.
//
// Se abre sobre la agenda (desde la cita) o sobre el expediente (pestaña
// Consultas). Todo lo valida también el backend.
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../Button.jsx';
import Icon from '../Icon.jsx';
import Autocomplete from '../Autocomplete.jsx';
import RowsEditor from './RowsEditor.jsx';
import Cie10Picker from './Cie10Picker.jsx';
import { useConfirm } from '../ConfirmDialog.jsx';
import {
  addAddendum, getEncounter, getPrescriptionPdf, listAppointmentTypes, saveEncounter, signEncounter,
} from '../../api/salud.js';
import {
  ADHERENCE, FOLLOW_UP_PRESETS, RESPONSES, ROUTES, VITALS, addDiagnosis, bmi, emptyPrescription, encounterPayload,
  encounterToForm, removeDiagnosis, setPrimary, signErrors, vitalsErrors, vitalsSummary,
} from '../../lib/clinical.js';
import { gtDate, gtTime } from '../../lib/agenda.js';

const fecha = (iso) => {
  if (!iso) return '';
  const [a, m, d] = gtDate(iso).split('-');
  return `${d}/${m}/${a}`;
};
const fechaHora = (iso) => (iso ? `${fecha(iso)} ${gtTime(iso)}` : '');

function Section({ title, hint, children, className = '' }) {
  return (
    <section className={`enc-section ${className}`}>
      <div className="enc-section-head">
        <h4>{title}</h4>
        {hint && <span className="muted">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

/** Texto largo: área editable o, firmada, el texto tal cual. */
function Area({ label, value, onChange, readOnly, rows = 3, placeholder }) {
  if (readOnly) {
    return value ? (
      <div className="field-group">
        <span className="field-label">{label.replace(/ \*$/, '')}</span>
        <div className="enc-text">{value}</div>
      </div>
    ) : null;
  }
  return (
    <div className="field-group">
      <label className="field-label">{label}</label>
      <textarea className="field-input enc-area" rows={rows} value={value} placeholder={placeholder}
        aria-label={label} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Segmented({ options, value, onChange, readOnly, label }) {
  return (
    <div className="ag-segment" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} disabled={readOnly && value !== o.id}
          className={`chip${value === o.id ? ' active' : ''}`}
          onClick={() => !readOnly && onChange(value === o.id ? '' : o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function EncounterEditor({ encounterId, initial, types: typesProp, onClose, onChanged, pushToast }) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const [view, setView] = useState(initial || null);
  const [form, setForm] = useState(initial ? encounterToForm(initial) : null);
  const [saved, setSaved] = useState(initial ? JSON.stringify(encounterPayload(encounterToForm(initial))) : '');
  const [types, setTypes] = useState(typesProp || []);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState([]);
  const [addendum, setAddendum] = useState('');

  useEffect(() => {
    if (initial) return undefined;
    let vigente = true;
    getEncounter(encounterId)
      .then((e) => { if (vigente) cargar(e); })
      .catch((err) => { pushToast?.(err.message, 'danger'); onClose(); });
    return () => { vigente = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encounterId]);

  useEffect(() => {
    if (typesProp) return;
    listAppointmentTypes().then((x) => setTypes(x || [])).catch(() => setTypes([]));
  }, [typesProp]);

  const cargar = (e) => {
    const f = encounterToForm(e);
    setView(e);
    setForm(f);
    setSaved(JSON.stringify(encounterPayload(f)));
    setErrors([]);
  };

  const payload = useMemo(() => (form ? encounterPayload(form) : null), [form]);
  const sucio = !!form && view?.canEdit && JSON.stringify(payload) !== saved;
  const ro = !view?.canEdit;
  const errVitales = useMemo(() => (form ? vitalsErrors(form.vitals) : {}), [form]);

  if (!view || !form) {
    return (
      <div className="modal-backdrop enc-backdrop">
        <div className="modal enc-modal"><div className="modal-body"><div className="empty">{t('clinical.loading', 'Cargando consulta…')}</div></div></div>
      </div>
    );
  }

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const setVital = (key, value) => setForm((f) => ({ ...f, vitals: { ...f.vitals, [key]: value } }));

  const cerrar = async () => {
    if (sucio) {
      const ok = await confirm({
        title: t('clinical.unsavedTitle', '¿Salir sin guardar?'),
        message: t('clinical.unsavedMsg', 'Hay cambios en la consulta que no se han guardado.'),
        confirmLabel: t('clinical.discard', 'Salir sin guardar'), danger: true,
      });
      if (!ok) return;
    }
    onClose();
  };

  const guardar = async () => {
    setBusy(true);
    try {
      const e = await saveEncounter(view.id, payload);
      cargar(e);
      onChanged?.(e);
      pushToast?.(t('clinical.saved', 'Borrador guardado'), 'success');
    } catch (err) {
      pushToast?.(err.message, 'danger');
    } finally {
      setBusy(false);
    }
  };

  const firmar = async () => {
    const errs = signErrors(form);
    setErrors(errs);
    if (errs.length) return;
    const ok = await confirm({
      title: t('clinical.signTitle', '¿Firmar la consulta?'),
      message: t('clinical.signMsg', 'Ya no se podrá editar: las correcciones irán como adenda. La receta pasará a los medicamentos del paciente y, si programaste control, quedará pendiente para agendar.'),
      confirmLabel: t('clinical.sign', 'Firmar'),
    });
    if (!ok) return;
    setBusy(true);
    try {
      const e = await signEncounter(view.id, payload);
      cargar(e);
      onChanged?.(e);
      pushToast?.(t('clinical.signed', 'Consulta firmada'), 'success');
    } catch (err) {
      pushToast?.(err.message, 'danger');
    } finally {
      setBusy(false);
    }
  };

  const agregarAdenda = async () => {
    if (!addendum.trim()) return;
    setBusy(true);
    try {
      const e = await addAddendum(view.id, addendum.trim());
      setAddendum('');
      cargar(e);
      pushToast?.(t('clinical.addendumSaved', 'Adenda agregada'), 'success');
    } catch (err) {
      pushToast?.(err.message, 'danger');
    } finally {
      setBusy(false);
    }
  };

  const receta = async () => {
    try {
      const blob = await getPrescriptionPdf(view.id);
      const url = URL.createObjectURL(blob);
      const w = window.open(url, '_blank');
      if (!w) {
        const a = document.createElement('a');
        a.href = url;
        a.download = `Receta-${view.recordNumber || view.id}.pdf`;
        a.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      pushToast?.(err.message, 'danger');
    }
  };

  const imc = bmi(form.vitals.weightKg, form.vitals.heightCm);
  const previo = view.previous;
  const esControl = !!previo || !!form.response;
  const tipos = types.filter((x) => x.active).map((x) => ({ id: x.id, name: `${x.name} · ${x.durationMinutes} min` }));
  const casos = (view.openCases || []).map((c) => ({ id: c.id, name: `${c.title} · ${fecha(c.openedAt)}` }));
  const firmada = view.status === 'firmada';

  return (
    <div className="modal-backdrop enc-backdrop" onClick={cerrar}>
      <div className="modal enc-modal" role="dialog" aria-label={t('clinical.title', 'Consulta')} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head enc-head">
          <div className="enc-head-main">
            <div className="enc-title">
              <h3>{view.patientName}</h3>
              <span className={`badge-m3 ${firmada ? 'success' : 'warning'}`}>
                {firmada ? t('clinical.status.firmada', 'Firmada') : t('clinical.status.borrador', 'Borrador')}
              </span>
              {(view.caseTitle || form.newCaseTitle) && (
                <span className="badge-m3 info">{view.caseTitle || form.newCaseTitle}</span>
              )}
            </div>
            <div className="muted enc-meta">
              {[view.recordNumber,
                view.patientAge != null ? t('clinical.age', '{{count}} años', { count: view.patientAge }) : null,
                view.patientSex,
                view.appointmentStartsAt ? fechaHora(view.appointmentStartsAt) : fechaHora(view.createdAt),
                view.professionalName].filter(Boolean).join(' · ')}
            </div>
          </div>
          <button className="icon-btn" type="button" onClick={cerrar} aria-label={t('common.close', 'Cerrar')}><Icon name="close" /></button>
        </div>

        {view.allergies?.length > 0 && (
          <div className="alert enc-allergy" role="alert">
            <Icon name="alert" size={16} />
            <span><strong>{t('clinical.allergies', 'Alergias')}:</strong> {view.allergies.join(', ')}</span>
          </div>
        )}

        <div className="modal-body enc-body">
          <div className="enc-main">
            <Section title={t('clinical.s.title', 'Subjetivo')} hint={t('clinical.s.hint', 'Motivo y síntomas, con palabras del paciente')}>
              <Area label={t('clinical.s.label', 'Motivo de consulta *')} value={form.subjective} readOnly={ro} rows={3}
                onChange={(v) => set('subjective', v)} />
            </Section>

            <Section title={t('clinical.o.title', 'Objetivo')} hint={t('clinical.o.hint', 'Signos vitales y examen físico')}>
              <div className="enc-vitals">
                {VITALS.map((x) => (
                  <div key={x.key} className="field-group">
                    <label className="field-label">{t(`clinical.vitals.${x.key}`, x.label)}</label>
                    {ro ? (
                      <div className="enc-vital-ro">{form.vitals[x.key] ? `${form.vitals[x.key]} ${x.unit}` : '—'}</div>
                    ) : (
                      <div className={`enc-vital${errVitales[x.key] ? ' is-error' : ''}`}>
                        <input className="field-input" inputMode="decimal" value={form.vitals[x.key]}
                          aria-label={t(`clinical.vitals.${x.key}`, x.label)} aria-invalid={!!errVitales[x.key]}
                          title={errVitales[x.key] || ''} onChange={(e) => setVital(x.key, e.target.value)} />
                        <span className="enc-unit">{x.unit}</span>
                      </div>
                    )}
                  </div>
                ))}
                <div className="field-group">
                  <span className="field-label">{t('clinical.vitals.bmi', 'IMC')}</span>
                  <div className="enc-vital-ro">{imc ?? '—'}</div>
                </div>
              </div>
              {Object.values(errVitales).length > 0 && (
                <div className="enc-errors">{Object.values(errVitales).join(' · ')}</div>
              )}
              <div className="field-group">
                <span className="field-label">{t('clinical.vitals.pain', 'Dolor (0 = nada, 10 = el peor)')}</span>
                <div className="enc-pain" role="radiogroup" aria-label={t('clinical.vitals.pain', 'Dolor (0 = nada, 10 = el peor)')}>
                  {Array.from({ length: 11 }, (_, n) => (
                    <button key={n} type="button" role="radio" aria-checked={form.painScore === n}
                      disabled={ro && form.painScore !== n}
                      className={`enc-pain-n enc-pain-${n <= 3 ? 'low' : n <= 6 ? 'mid' : 'high'}${form.painScore === n ? ' is-on' : ''}`}
                      onClick={() => !ro && set('painScore', form.painScore === n ? null : n)}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <Area label={t('clinical.o.label', 'Examen físico')} value={form.objective} readOnly={ro}
                onChange={(v) => set('objective', v)} />
            </Section>

            <Section title={t('clinical.a.title', 'Análisis')} hint={t('clinical.a.hint', 'Diagnósticos (CIE-10) y razonamiento')}>
              {!ro && <Cie10Picker onPick={(dx) => set('diagnoses', addDiagnosis(form.diagnoses, dx))} />}
              {form.diagnoses.length === 0 ? (
                <div className="muted salud-help">{t('clinical.dx.empty', 'Sin diagnósticos todavía.')}</div>
              ) : (
                <ul className="enc-dx-list">
                  {form.diagnoses.map((d, i) => (
                    <li key={`${d.code}-${d.description}`} className={`enc-dx${d.primary ? ' is-primary' : ''}`}>
                      {d.code ? <span className="enc-code">{d.code}</span> : <span className="enc-code enc-code--free">—</span>}
                      <span className="enc-dx-desc">{d.description}</span>
                      {d.primary ? (
                        <span className="badge-m3 accent">{t('clinical.dx.primary', 'Principal')}</span>
                      ) : !ro && (
                        <button type="button" className="ag-link enc-dx-make" onClick={() => set('diagnoses', setPrimary(form.diagnoses, i))}>
                          {t('clinical.dx.makePrimary', 'Hacer principal')}
                        </button>
                      )}
                      {!ro && (
                        <Button variant="icon" icon="close" type="button" title={t('common.remove', 'Quitar')}
                          aria-label={t('clinical.dx.remove', 'Quitar diagnóstico')} onClick={() => set('diagnoses', removeDiagnosis(form.diagnoses, i))} />
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <Area label={t('clinical.a.label', 'Análisis')} value={form.assessment} readOnly={ro}
                onChange={(v) => set('assessment', v)} />
            </Section>

            <Section title={t('clinical.p.title', 'Plan')} hint={t('clinical.p.hint', 'Tratamiento, estudios y receta')}>
              <Area label={t('clinical.p.label', 'Plan')} value={form.plan} readOnly={ro} onChange={(v) => set('plan', v)} />
              <div className="field-group">
                <span className="field-label">{t('clinical.rx.title', 'Receta')}</span>
                {ro ? (
                  form.prescriptions.length ? (
                    <ol className="enc-rx-ro">
                      {form.prescriptions.map((p, i) => (
                        <li key={i}>
                          <strong>{p.medication}</strong>
                          {p.quantity && <span className="muted"> — {p.quantity}</span>}
                          <div>{[p.dose, p.route && `vía ${p.route}`, p.frequency, p.durationDays && `por ${p.durationDays} días`].filter(Boolean).join(' · ')}</div>
                          {p.instructions && <div className="muted">{p.instructions}</div>}
                        </li>
                      ))}
                    </ol>
                  ) : <div className="muted">{t('clinical.rx.none', 'Sin receta')}</div>
                ) : (
                  <RowsEditor rows={form.prescriptions} onChange={(rows) => set('prescriptions', rows)} newRow={emptyPrescription}
                    addLabel={t('clinical.rx.add', 'Agregar medicamento')} empty={t('clinical.rx.empty', 'Sin medicamentos recetados.')}
                    fields={[
                      { key: 'medication', label: t('clinical.rx.medication', 'Medicamento y presentación'), required: true, wide: true },
                      { key: 'dose', label: t('clinical.rx.dose', 'Dosis') },
                      { key: 'route', label: t('clinical.rx.route', 'Vía'), type: 'select', options: ROUTES.map((r) => ({ id: r, name: r })) },
                      { key: 'frequency', label: t('clinical.rx.frequency', 'Frecuencia') },
                      { key: 'durationDays', label: t('clinical.rx.days', 'Días') },
                      { key: 'quantity', label: t('clinical.rx.quantity', 'Cantidad') },
                      { key: 'instructions', label: t('clinical.rx.instructions', 'Indicaciones'), wide: true },
                    ]} />
                )}
              </div>
              <Area label={t('clinical.instructions', 'Indicaciones para el paciente (van en la receta)')} value={form.instructions}
                readOnly={ro} onChange={(v) => set('instructions', v)} />
            </Section>

            {firmada && (
              <Section title={t('clinical.addenda.title', 'Adendas')} hint={t('clinical.addenda.hint', 'Correcciones posteriores a la firma')}>
                {(view.addenda || []).length === 0 && <div className="muted salud-help">{t('clinical.addenda.empty', 'Sin adendas.')}</div>}
                {(view.addenda || []).map((a) => (
                  <div key={a.id} className="enc-addendum">
                    <div className="muted">{fechaHora(a.createdAt)}{a.authorName ? ` · ${a.authorName}` : ''}</div>
                    <div className="enc-text">{a.text}</div>
                  </div>
                ))}
                <div className="enc-addendum-new">
                  <textarea className="field-input enc-area" rows={2} value={addendum} maxLength={2000}
                    placeholder={t('clinical.addenda.placeholder', 'Escribe la corrección o el dato que faltó…')}
                    aria-label={t('clinical.addenda.new', 'Nueva adenda')} onChange={(e) => setAddendum(e.target.value)} />
                  <Button type="button" variant="tonal" icon="plus" disabled={busy || !addendum.trim()} onClick={agregarAdenda}>
                    {t('clinical.addenda.add', 'Agregar adenda')}
                  </Button>
                </div>
              </Section>
            )}
          </div>

          <aside className="enc-aside">
            <Section title={t('clinical.case.title', 'Caso')} hint={t('clinical.case.hint', 'El problema que une las consultas')}>
              {ro ? (
                <div className="enc-text">{view.caseTitle || '—'}</div>
              ) : (
                <>
                  <Segmented label={t('clinical.case.title', 'Caso')} value={form.caseMode} onChange={(v) => v && set('caseMode', v)}
                    options={[
                      ...(casos.length ? [{ id: 'existing', label: t('clinical.case.existing', 'Caso abierto') }] : []),
                      { id: 'new', label: t('clinical.case.new', 'Caso nuevo') },
                    ]} />
                  {form.caseMode === 'existing' ? (
                    <Autocomplete value={form.caseId} onChange={(id) => set('caseId', id ?? '')} options={casos}
                      aria-label={t('clinical.case.pick', 'Caso abierto')} />
                  ) : (
                    <input className="field-input" value={form.newCaseTitle} maxLength={150}
                      placeholder={t('clinical.case.newPlaceholder', 'Ej.: Migraña, Control de diabetes…')}
                      aria-label={t('clinical.case.newTitle', 'Nombre del caso')} onChange={(e) => set('newCaseTitle', e.target.value)} />
                  )}
                </>
              )}
            </Section>

            {previo && (
              <Section title={t('clinical.previous.title', 'Consulta anterior')} hint={fecha(previo.signedAt || previo.createdAt)}>
                <div className="enc-prev">
                  {previo.dxDescription && <div><span className="enc-code">{previo.dxCode || '—'}</span> {previo.dxDescription}</div>}
                  {vitalsSummary(previo.vitals) && <div className="muted">{vitalsSummary(previo.vitals)}</div>}
                  {previo.vitals?.painScore != null && (
                    <div>{t('clinical.previous.pain', 'Dolor')}: <strong>{previo.vitals.painScore}</strong>
                      {form.painScore != null && <> → <strong>{form.painScore}</strong></>}
                    </div>
                  )}
                  {previo.rxCount > 0 && <div className="muted">{t('clinical.previous.rx', '{{count}} medicamento(s) recetado(s)', { count: previo.rxCount })}</div>}
                  <div className="muted">{previo.professionalName}</div>
                </div>
              </Section>
            )}

            {(esControl || !ro) && (
              <Section title={t('clinical.response.title', 'Respuesta al tratamiento')}
                hint={previo ? null : t('clinical.response.hint', 'Para los controles')}>
                <Segmented label={t('clinical.response.title', 'Respuesta al tratamiento')} readOnly={ro}
                  value={form.response} onChange={(v) => set('response', v)}
                  options={RESPONSES.map((r) => ({ id: r.id, label: t(`clinical.response.${r.id}`, r.label) }))} />
                <span className="field-label">{t('clinical.adherence.title', '¿Tomó el tratamiento como se indicó?')}</span>
                <Segmented label={t('clinical.adherence.title', '¿Tomó el tratamiento como se indicó?')} readOnly={ro}
                  value={form.adherence} onChange={(v) => set('adherence', v)}
                  options={ADHERENCE.map((r) => ({ id: r.id, label: t(`clinical.adherence.${r.id}`, r.label) }))} />
                <Area label={t('clinical.adverse', 'Reacciones o efectos adversos')} value={form.adverseEffects} rows={2}
                  readOnly={ro} onChange={(v) => set('adverseEffects', v)} />
              </Section>
            )}

            <Section title={t('clinical.followUp.title', 'Seguimiento')} hint={t('clinical.followUp.hint', 'Control a agendar')}>
              {ro ? (
                <div className="enc-text">
                  {view.followUpDays
                    ? t('clinical.followUp.summary', 'Control en {{count}} días', { count: view.followUpDays })
                      + (view.followUpNotes ? ` — ${view.followUpNotes}` : '')
                    : t('clinical.followUp.none', 'Sin control programado')}
                </div>
              ) : (
                <>
                  <label className="salud-check">
                    <input type="checkbox" checked={form.followUp} onChange={(e) => set('followUp', e.target.checked)} />
                    {t('clinical.followUp.enable', 'Programar control')}
                  </label>
                  {form.followUp && (
                    <>
                      <div className="ag-segment">
                        {FOLLOW_UP_PRESETS.map((d) => (
                          <button key={d} type="button" className={`chip${String(form.followUpDays) === String(d) ? ' active' : ''}`}
                            onClick={() => set('followUpDays', String(d))}>
                            {t('clinical.followUp.days', '{{count}} días', { count: d })}
                          </button>
                        ))}
                      </div>
                      <div className="form-grid">
                        <div className="field-group">
                          <label className="field-label">{t('clinical.followUp.inDays', 'En cuántos días')}</label>
                          <input className="field-input" inputMode="numeric" value={form.followUpDays}
                            aria-label={t('clinical.followUp.inDays', 'En cuántos días')} onChange={(e) => set('followUpDays', e.target.value)} />
                        </div>
                        <div className="field-group">
                          <label className="field-label">{t('clinical.followUp.type', 'Tipo de cita')}</label>
                          <Autocomplete value={form.followUpTypeId} onChange={(id) => set('followUpTypeId', id ?? '')} options={tipos}
                            aria-label={t('clinical.followUp.type', 'Tipo de cita')} />
                        </div>
                      </div>
                      <input className="field-input" value={form.followUpNotes} maxLength={300}
                        placeholder={t('clinical.followUp.notesPlaceholder', 'Qué revisar en el control')}
                        aria-label={t('clinical.followUp.notes', 'Qué revisar en el control')} onChange={(e) => set('followUpNotes', e.target.value)} />
                    </>
                  )}
                </>
              )}
            </Section>
          </aside>
        </div>

        {errors.length > 0 && (
          <div className="alert enc-sign-errors" role="alert">
            <Icon name="info" size={16} />
            <ul>{errors.map((e) => <li key={e}>{e}</li>)}</ul>
          </div>
        )}

        <div className="modal-foot enc-foot">
          <span className="muted enc-foot-info">
            {firmada
              ? t('clinical.signedAt', 'Firmada el {{when}}', { when: fechaHora(view.signedAt) })
              : sucio ? t('clinical.unsaved', 'Cambios sin guardar') : t('clinical.draft', 'Borrador')}
          </span>
          {firmada && form.prescriptions.length > 0 && (
            <Button type="button" variant="tonal" icon="print" onClick={receta}>{t('clinical.rx.pdf', 'Receta PDF')}</Button>
          )}
          {view.canEdit && (
            <>
              <Button type="button" variant="ghost" disabled={busy || !sucio} onClick={guardar}>{t('clinical.saveDraft', 'Guardar borrador')}</Button>
              <Button type="button" variant="accent" icon="check" disabled={busy} onClick={firmar}>{t('clinical.sign', 'Firmar')}</Button>
            </>
          )}
          {!view.canEdit && <Button type="button" variant="ghost" onClick={cerrar}>{t('common.close', 'Cerrar')}</Button>}
        </div>
      </div>
    </div>
  );
}
