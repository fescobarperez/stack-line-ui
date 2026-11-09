// Configuración de la agenda: profesionales y su horario semanal, recursos
// (consultorios, sillones, equipos) y tipos de cita. Nada se borra: se
// desactiva, para no romper las citas pasadas que los usan.
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../Button.jsx';
import Icon from '../Icon.jsx';
import DataTable from '../DataTable.jsx';
import Autocomplete from '../Autocomplete.jsx';
import TimeSelect from './TimeSelect.jsx';
import {
  saveProfessional, saveSchedule, createResource, updateResource, createAppointmentType, updateAppointmentType,
  getSaludSettings, saveSaludSettings, listPackages, createPackage, updatePackage,
} from '../../api/salud.js';
import { Q, parseAmount } from '../../lib/caja.js';
import { RESOURCE_KINDS, WEEKDAYS, colorFor, normalizeSchedule, reminderHourOptions, scheduleErrors } from '../../lib/agenda.js';

const Swatch = ({ color }) => <span className="ag-dot" style={{ background: color }} aria-hidden="true" />;

/** «Lun–Vie 08:00–12:00 · Sáb 09:00–13:00»: el horario en una línea. */
export function scheduleSummary(slots, dayLabel) {
  const porHorario = new Map();
  normalizeSchedule(slots).forEach((s) => {
    const k = `${s.start}–${s.end}`;
    porHorario.set(k, [...(porHorario.get(k) || []), s.weekday]);
  });
  return [...porHorario.entries()].map(([h, dias]) => {
    const orden = [...new Set(dias)].sort((a, b) => a - b);
    const seguidos = orden.length > 2 && orden.every((d, i) => i === 0 || d === orden[i - 1] + 1);
    const txt = seguidos ? `${dayLabel(orden[0])}–${dayLabel(orden[orden.length - 1])}` : orden.map(dayLabel).join(', ');
    return `${txt} ${h}`;
  }).join(' · ');
}

function Modal({ title, onClose, children, foot, size = 'modal-md' }) {
  const { t } = useTranslation();
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal ${size}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" type="button" onClick={onClose} aria-label={t('common.close', 'Cerrar')}><Icon name="close" /></button>
        </div>
        <div className="modal-body salud-form-body">{children}</div>
        <div className="modal-foot">{foot}</div>
      </div>
    </div>
  );
}

function ProfessionalDialog({ prof, resources, onSaved, onClose, pushToast }) {
  const { t } = useTranslation();
  const [f, setF] = useState({
    specialty: prof.specialty || '', licenseNumber: prof.licenseNumber || '',
    color: prof.color || colorFor(prof.userId), active: prof.configured ? prof.active : true,
  });
  const [slots, setSlots] = useState(normalizeSchedule(prof.schedule));
  const [saving, setSaving] = useState(false);
  const errores = scheduleErrors(slots);
  const dias = WEEKDAYS.map((d) => ({ id: d.id, name: t(`agenda.weekdays.${d.id}`, d.label) }));
  const recursos = resources.filter((r) => r.active).map((r) => ({ id: r.id, name: r.name }));
  const setSlot = (i, patch) => setSlots((xs) => xs.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  /** Copia la primera franja a lunes–viernes: el caso de casi todos los consultorios. */
  const repetirSemana = () => {
    const base = slots[0] || { start: '08:00', end: '17:00', resourceId: null };
    setSlots([1, 2, 3, 4, 5].map((d) => ({ ...base, weekday: d })));
  };

  const guardar = async () => {
    setSaving(true);
    try {
      await saveProfessional(prof.userId, { ...f, specialty: f.specialty.trim() || null, licenseNumber: f.licenseNumber.trim() || null });
      const v = await saveSchedule(prof.userId, slots.map((s) => ({ ...s, resourceId: s.resourceId || null })));
      onSaved(v);
    } catch (err) {
      pushToast?.(err.message, 'danger');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal size="modal-lg" title={prof.name} onClose={onClose}
      foot={<>
        <Button type="button" variant="ghost" onClick={onClose}>{t('common.cancel', 'Cancelar')}</Button>
        <Button type="button" variant="accent" icon="check" disabled={saving || errores.length > 0} onClick={guardar}>{t('common.save', 'Guardar')}</Button>
      </>}>
      <div className="form-grid">
        <div className="field-group">
          <label className="field-label">{t('agenda.config.specialty', 'Especialidad')}</label>
          <input className="field-input" value={f.specialty} maxLength={80} onChange={(e) => setF((x) => ({ ...x, specialty: e.target.value }))} />
        </div>
        <div className="field-group">
          <label className="field-label">{t('agenda.config.license', 'Colegiado')}</label>
          <input className="field-input mono" value={f.licenseNumber} maxLength={40} onChange={(e) => setF((x) => ({ ...x, licenseNumber: e.target.value }))} />
        </div>
        <div className="field-group">
          <label className="field-label" htmlFor="prof-color">{t('agenda.config.color', 'Color en la agenda')}</label>
          <input id="prof-color" className="field-input ag-color" type="color" value={f.color} onChange={(e) => setF((x) => ({ ...x, color: e.target.value }))} />
        </div>
        <label className="salud-check">
          <input type="checkbox" checked={f.active} onChange={(e) => setF((x) => ({ ...x, active: e.target.checked }))} />
          {t('agenda.config.activeProfessional', 'Atiende pacientes (aparece en la agenda)')}
        </label>
      </div>

      <h4 className="salud-section-title">{t('agenda.config.schedule', 'Horario semanal')}</h4>
      <div className="salud-rows">
        {slots.length === 0 && <div className="salud-rows-empty muted">{t('agenda.config.noSchedule', 'Sin horario: no se le ofrecerán horarios libres.')}</div>}
        {slots.map((s, i) => (
          <div key={i} className="salud-row">
            <div className="form-grid salud-row-fields">
              <div className="field-group">
                <label className="field-label">{t('agenda.config.day', 'Día')}</label>
                <Autocomplete value={s.weekday} options={dias} allowClear={false}
                  onChange={(id) => setSlot(i, { weekday: Number(id) || s.weekday })} aria-label={t('agenda.config.day', 'Día')} />
              </div>
              <div className="field-group">
                <label className="field-label">{t('agenda.config.start', 'Desde')}</label>
                <TimeSelect value={s.start} onChange={(h) => setSlot(i, { start: h })} aria-label={t('agenda.config.start', 'Desde')} />
              </div>
              <div className="field-group">
                <label className="field-label">{t('agenda.config.end', 'Hasta')}</label>
                <TimeSelect value={s.end} onChange={(h) => setSlot(i, { end: h })} aria-label={t('agenda.config.end', 'Hasta')} />
              </div>
              <div className="field-group">
                <label className="field-label">{t('agenda.config.fixedResource', 'Consultorio fijo')}</label>
                <Autocomplete value={s.resourceId ?? ''} options={recursos}
                  onChange={(id) => setSlot(i, { resourceId: id === '' || id == null ? null : Number(id) })}
                  aria-label={t('agenda.config.fixedResource', 'Consultorio fijo')} />
              </div>
            </div>
            <Button variant="icon" icon="trash" type="button" title={t('common.remove', 'Quitar')}
              onClick={() => setSlots((xs) => xs.filter((_, j) => j !== i))} />
          </div>
        ))}
        {errores.length > 0 && (
          <div className="alert" role="alert"><Icon name="alert" size={16} />
            {errores[0].key === 'slotOverlap'
              ? t('agenda.config.slotOverlap', 'Dos franjas del mismo día se cruzan.')
              : t('agenda.config.slotRange', 'Una franja termina antes de empezar.')}
          </div>
        )}
        <div className="salud-inline-actions ag-start">
          <Button type="button" variant="tonal" icon="plus"
            onClick={() => setSlots((xs) => [...xs, { weekday: 1, start: '08:00', end: '12:00', resourceId: null }])}>
            {t('agenda.config.addSlot', 'Agregar franja')}
          </Button>
          <Button type="button" variant="ghost" icon="copy" onClick={repetirSemana}>
            {t('agenda.config.repeatWeek', 'Repetir de lunes a viernes')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ResourceDialog({ resource, onSaved, onClose, pushToast }) {
  const { t } = useTranslation();
  const [f, setF] = useState({ name: resource?.name || '', kind: resource?.kind || 'consultorio', active: resource ? resource.active : true });
  const guardar = async () => {
    try {
      const body = { name: f.name.trim(), kind: f.kind, active: f.active };
      onSaved(resource ? await updateResource(resource.id, body) : await createResource(body));
    } catch (err) {
      pushToast?.(err.message, 'danger');
    }
  };
  return (
    <Modal title={resource ? resource.name : t('agenda.config.newResource', 'Nuevo recurso')} onClose={onClose}
      foot={<>
        <Button type="button" variant="ghost" onClick={onClose}>{t('common.cancel', 'Cancelar')}</Button>
        <Button type="button" variant="accent" icon="check" disabled={!f.name.trim()} onClick={guardar}>{t('common.save', 'Guardar')}</Button>
      </>}>
      <div className="form-grid">
        <div className="field-group">
          <label className="field-label">{t('agenda.config.name', 'Nombre *')}</label>
          <input className="field-input" value={f.name} maxLength={80} autoFocus
            placeholder={t('agenda.config.resourceHint', 'Consultorio 1, Sillón 2…')} onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))} />
        </div>
        <div className="field-group">
          <label className="field-label">{t('agenda.config.kind', 'Tipo')}</label>
          <Autocomplete value={f.kind} allowClear={false} onChange={(id) => setF((x) => ({ ...x, kind: id || 'consultorio' }))}
            options={RESOURCE_KINDS.map((k) => ({ id: k.id, name: t(`agenda.kinds.${k.id}`, k.label) }))}
            aria-label={t('agenda.config.kind', 'Tipo')} />
        </div>
        <label className="salud-check span-2">
          <input type="checkbox" checked={f.active} onChange={(e) => setF((x) => ({ ...x, active: e.target.checked }))} />
          {t('agenda.config.active', 'Activo')}
        </label>
      </div>
    </Modal>
  );
}

function TypeDialog({ type, onSaved, onClose, pushToast }) {
  const { t } = useTranslation();
  const [f, setF] = useState({
    name: type?.name || '', durationMinutes: String(type?.durationMinutes ?? 30), price: type?.price != null ? String(type.price) : '',
    color: type?.color || colorFor(type?.id ?? 1), requiresResource: !!type?.requiresResource, active: type ? type.active : true,
  });
  const dur = Number(f.durationMinutes);
  const valido = f.name.trim() && dur >= 5 && dur <= 480 && (f.price === '' || Number(f.price) >= 0);
  const guardar = async () => {
    try {
      const body = { name: f.name.trim(), durationMinutes: dur, price: f.price === '' ? null : Number(f.price),
        color: f.color, requiresResource: f.requiresResource, active: f.active };
      onSaved(type ? await updateAppointmentType(type.id, body) : await createAppointmentType(body));
    } catch (err) {
      pushToast?.(err.message, 'danger');
    }
  };
  return (
    <Modal title={type ? type.name : t('agenda.config.newType', 'Nuevo tipo de cita')} onClose={onClose}
      foot={<>
        <Button type="button" variant="ghost" onClick={onClose}>{t('common.cancel', 'Cancelar')}</Button>
        <Button type="button" variant="accent" icon="check" disabled={!valido} onClick={guardar}>{t('common.save', 'Guardar')}</Button>
      </>}>
      <div className="form-grid">
        <div className="field-group span-2">
          <label className="field-label">{t('agenda.config.name', 'Nombre *')}</label>
          <input className="field-input" value={f.name} maxLength={80} autoFocus
            placeholder={t('agenda.config.typeHint', 'Consulta general, Limpieza dental…')} onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))} />
        </div>
        <div className="field-group">
          <label className="field-label">{t('agenda.config.duration', 'Duración (minutos) *')}</label>
          <input className="field-input mono" type="number" min="5" max="480" step="5" value={f.durationMinutes}
            onChange={(e) => setF((x) => ({ ...x, durationMinutes: e.target.value }))} />
        </div>
        <div className="field-group">
          <label className="field-label">{t('agenda.config.price', 'Precio de referencia (Q)')}</label>
          <input className="field-input mono" type="number" min="0" step="0.01" value={f.price}
            onChange={(e) => setF((x) => ({ ...x, price: e.target.value }))} />
        </div>
        <div className="field-group">
          <label className="field-label" htmlFor="type-color">{t('agenda.config.color', 'Color en la agenda')}</label>
          <input id="type-color" className="field-input ag-color" type="color" value={f.color} onChange={(e) => setF((x) => ({ ...x, color: e.target.value }))} />
        </div>
        <div className="salud-checks">
          <label className="salud-check">
            <input type="checkbox" checked={f.requiresResource} onChange={(e) => setF((x) => ({ ...x, requiresResource: e.target.checked }))} />
            {t('agenda.config.requiresResource', 'Necesita consultorio o recurso')}
          </label>
          <label className="salud-check">
            <input type="checkbox" checked={f.active} onChange={(e) => setF((x) => ({ ...x, active: e.target.checked }))} />
            {t('agenda.config.active', 'Activo')}
          </label>
        </div>
      </div>
    </Modal>
  );
}

const Activo = ({ on }) => {
  const { t } = useTranslation();
  return <span className={`badge-m3 ${on ? 'success' : 'neutral'}`}>{on ? t('agenda.config.active', 'Activo') : t('agenda.config.inactive', 'Inactivo')}</span>;
};

/**
 * Recordatorios por WhatsApp: TINO escribe al paciente antes de la cita con
 * botones para confirmar, reprogramar o cancelar. Solo a pacientes que
 * aceptan mensajes y prefieren WhatsApp.
 */
export function RemindersCard({ canEdit, pushToast }) {
  const { t } = useTranslation();
  const [actual, setActual] = useState(null);
  const [f, setF] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let vivo = true;
    getSaludSettings()
      .then((s) => {
        // Un backend anterior a la fase 7 no manda los del control: se completan con los de fábrica.
        const n = { controlRemindersEnabled: true, controlReminderDays: 2, ...s };
        if (vivo) { setActual(n); setF(n); }
      })
      .catch(() => { if (vivo) { const d = { remindersEnabled: true, reminderHours: 24, controlRemindersEnabled: true, controlReminderDays: 2 }; setActual(d); setF(d); } });
    return () => { vivo = false; };
  }, []);

  if (!f) return null;
  const cambio = f.remindersEnabled !== actual.remindersEnabled || Number(f.reminderHours) !== Number(actual.reminderHours)
    || f.controlRemindersEnabled !== actual.controlRemindersEnabled || Number(f.controlReminderDays) !== Number(actual.controlReminderDays);
  const guardar = async () => {
    setSaving(true);
    try {
      const s = await saveSaludSettings({
        remindersEnabled: f.remindersEnabled, reminderHours: Number(f.reminderHours),
        controlRemindersEnabled: f.controlRemindersEnabled ?? true, controlReminderDays: Number(f.controlReminderDays ?? 2),
      });
      const n = { controlRemindersEnabled: true, controlReminderDays: 2, ...s };
      setActual(n); setF(n);
      pushToast?.(t('agenda.reminder.saved', 'Recordatorios guardados'), 'success');
    } catch (err) {
      pushToast?.(err.message, 'danger');
    } finally {
      setSaving(false);
    }
  };
  const horas = (h) => t('agenda.reminder.hoursBefore', '{{count}} h antes', { count: h });

  return (
    <section className="ag-config-section">
      <div className="ag-config-head">
        <div>
          <h3>{t('agenda.reminder.title', 'Recordatorios por WhatsApp')}</h3>
          <p className="muted">
            {t('agenda.reminder.help', 'TINO escribe por el WhatsApp de la clínica con botones para confirmar, reprogramar o cancelar. Solo a pacientes que aceptan mensajes y prefieren WhatsApp.')}
          </p>
        </div>
        {canEdit && cambio && (
          <Button type="button" variant="accent" icon="check" disabled={saving} onClick={guardar}>{t('common.save', 'Guardar')}</Button>
        )}
      </div>
      <div className="ag-config-box">
        <label className="salud-check">
          <input type="checkbox" checked={f.remindersEnabled} disabled={!canEdit}
            onChange={(e) => setF((x) => ({ ...x, remindersEnabled: e.target.checked }))} />
          {t('agenda.reminder.enabled', 'Enviar recordatorio antes de cada cita')}
        </label>
        <div className="field-group ag-config-when">
          <label className="field-label">{t('agenda.reminder.when', 'Cuándo')}</label>
          <Autocomplete value={Number(f.reminderHours)} allowClear={false} disabled={!canEdit || !f.remindersEnabled}
            onChange={(id) => setF((x) => ({ ...x, reminderHours: id || 24 }))}
            options={reminderHourOptions(f.reminderHours).map((h) => ({ id: h, name: horas(h) }))}
            aria-label={t('agenda.reminder.when', 'Cuándo')} />
        </div>
      </div>
      <div className="ag-config-box">
        <label className="salud-check">
          <input type="checkbox" checked={f.controlRemindersEnabled ?? true} disabled={!canEdit}
            onChange={(e) => setF((x) => ({ ...x, controlRemindersEnabled: e.target.checked }))} />
          {t('agenda.reminder.controlEnabled', 'Antes de cada control pendiente, preguntar cómo sigue el paciente y ofrecer agendar')}
        </label>
        <div className="field-group ag-config-when">
          <label className="field-label">{t('agenda.reminder.when', 'Cuándo')}</label>
          <Autocomplete value={Number(f.controlReminderDays ?? 2)} allowClear={false} disabled={!canEdit || f.controlRemindersEnabled === false}
            onChange={(id) => setF((x) => ({ ...x, controlReminderDays: id || 2 }))}
            options={[1, 2, 3, 5, 7, 10, 14].map((d) => ({ id: d, name: t('agenda.reminder.daysBefore', '{{count}} día(s) antes', { count: d }) }))}
            aria-label={t('agenda.reminder.controlWhen', 'Cuándo recordar el control')} />
        </div>
      </div>
    </section>
  );
}

/** Paquete del catálogo: N sesiones de un tipo de cita a un precio, con vigencia opcional. */
function PackageDialog({ pkg, types, onSaved, onClose, pushToast }) {
  const { t } = useTranslation();
  const [f, setF] = useState({
    name: pkg?.name || '', typeId: pkg?.typeId ?? '', sessions: String(pkg?.sessions ?? 10),
    price: pkg?.price != null ? String(pkg.price) : '', validDays: pkg?.validDays != null ? String(pkg.validDays) : '',
    active: pkg ? pkg.active : true,
  });
  const ses = Number(f.sessions);
  const precio = parseAmount(f.price);
  const valido = f.name.trim() && f.typeId && ses >= 1 && ses <= 200 && precio != null && !Number.isNaN(precio) && precio >= 0;
  const guardar = async () => {
    try {
      const body = { name: f.name.trim(), typeId: Number(f.typeId), sessions: ses, price: precio,
        validDays: f.validDays === '' ? null : Number(f.validDays), active: f.active };
      onSaved(pkg ? await updatePackage(pkg.id, body) : await createPackage(body));
    } catch (err) {
      pushToast?.(err.message, 'danger');
    }
  };
  return (
    <Modal title={pkg ? pkg.name : t('agenda.config.newPackage', 'Nuevo paquete')} onClose={onClose}
      foot={<>
        <Button type="button" variant="ghost" onClick={onClose}>{t('common.cancel', 'Cancelar')}</Button>
        <Button type="button" variant="accent" icon="check" disabled={!valido} onClick={guardar}>{t('common.save', 'Guardar')}</Button>
      </>}>
      <div className="form-grid">
        <div className="field-group span-2">
          <label className="field-label">{t('agenda.config.name', 'Nombre *')}</label>
          <input className="field-input" value={f.name} maxLength={100} autoFocus
            placeholder={t('agenda.config.packageHint', '10 sesiones de fisioterapia')} onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))} />
        </div>
        <div className="field-group span-2">
          <label className="field-label">{t('agenda.config.packageType', 'Tipo de cita que cubre *')}</label>
          <Autocomplete value={f.typeId} onChange={(id) => setF((x) => ({ ...x, typeId: id ?? '' }))}
            options={types.filter((x) => x.active || x.id === pkg?.typeId).map((x) => ({ id: x.id, name: x.name }))}
            aria-label={t('agenda.config.packageType', 'Tipo de cita que cubre *')} />
        </div>
        <div className="field-group">
          <label className="field-label">{t('agenda.config.sessions', 'Sesiones *')}</label>
          <input className="field-input mono" type="number" min="1" max="200" value={f.sessions}
            onChange={(e) => setF((x) => ({ ...x, sessions: e.target.value }))} />
        </div>
        <div className="field-group">
          <label className="field-label">{t('agenda.config.packagePrice', 'Precio del paquete (Q) *')}</label>
          <input className="field-input mono" inputMode="decimal" value={f.price}
            onChange={(e) => setF((x) => ({ ...x, price: e.target.value }))} />
          {precio > 0 && ses > 0 && (
            <span className="muted salud-help">{t('agenda.config.perSession', '{{q}} por sesión', { q: Q(precio / ses) })}</span>
          )}
        </div>
        <div className="field-group">
          <label className="field-label">{t('agenda.config.validDays', 'Vigencia (días)')}</label>
          <input className="field-input mono" type="number" min="1" max="1095" value={f.validDays} placeholder={t('agenda.config.noExpiry', 'Sin vencimiento')}
            onChange={(e) => setF((x) => ({ ...x, validDays: e.target.value }))} />
        </div>
        <div className="salud-checks">
          <label className="salud-check">
            <input type="checkbox" checked={f.active} onChange={(e) => setF((x) => ({ ...x, active: e.target.checked }))} />
            {t('agenda.config.active', 'Activo')}
          </label>
        </div>
      </div>
    </Modal>
  );
}

/** Paquetes de sesiones: se venden en la cuenta del paciente y cada cita de su tipo descuenta una sesión. */
function PackagesSection({ types, canEdit, pushToast }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState(null);
  const [dialog, setDialog] = useState(null); // { item }
  const cargar = () => listPackages().then((r) => setRows(r || [])).catch(() => setRows([]));
  useEffect(() => { cargar(); }, []);
  return (
    <section className="ag-config-section">
      <div className="ag-config-head">
        <div>
          <h3>{t('agenda.config.packages', 'Paquetes de sesiones')}</h3>
          <p className="muted">{t('agenda.config.packagesHelp', 'Se venden en la cuenta del paciente (se facturan al venderlos) y cada cita del tipo descuenta una sesión al completarse.')}</p>
        </div>
        {canEdit && <Button type="button" variant="tonal" icon="plus" onClick={() => setDialog({})}>{t('agenda.config.newPackage', 'Nuevo paquete')}</Button>}
      </div>
      <DataTable
        columns={[
          { key: 'name', header: t('agenda.config.nameColumn', 'Nombre'), card: 'title' },
          { key: 'typeName', header: t('agenda.config.packageTypeShort', 'Tipo de cita'), card: 'subtitle', render: (p) => p.typeName || '—' },
          { key: 'sessions', header: t('agenda.config.sessions', 'Sesiones'), align: 'right' },
          { key: 'price', header: t('agenda.config.priceShort', 'Precio'), align: 'right', card: 'amount',
            render: (p) => <span className="num">{Q(p.price)}</span> },
          { key: 'validDays', header: t('agenda.config.validDaysShort', 'Vigencia'), hideOnTablet: true,
            render: (p) => (p.validDays ? t('agenda.config.days', '{{count}} días', { count: p.validDays }) : t('agenda.config.noExpiry', 'Sin vencimiento')) },
          { key: 'active', header: t('common.status', 'Estado'), card: 'badge', render: (p) => <Activo on={p.active} /> },
        ]}
        rows={rows || []} loading={rows == null} rowKey={(p) => p.id} density="compact"
        onRowClick={canEdit ? (p) => setDialog({ item: p }) : undefined}
        empty={t('agenda.config.noPackages', 'Sin paquetes. Úsalos para tratamientos de varias sesiones pagados por adelantado.')} emptyIcon="box"
      />
      {dialog && (
        <PackageDialog pkg={dialog.item} types={types} pushToast={pushToast} onClose={() => setDialog(null)}
          onSaved={() => { setDialog(null); cargar(); pushToast?.(t('agenda.config.packageSaved', 'Paquete guardado'), 'success'); }} />
      )}
    </section>
  );
}

export default function AgendaConfig({ professionals, resources, types, canEdit, onChanged, pushToast }) {
  const { t } = useTranslation();
  const [dialog, setDialog] = useState(null); // { kind, item }
  const cerrar = () => setDialog(null);
  const guardado = (msg) => () => { cerrar(); onChanged(); pushToast?.(msg, 'success'); };
  const diaCorto = (d) => t(`agenda.weekdaysShort.${d}`, WEEKDAYS[d - 1].short);

  return (
    <div className="salud-stack">
      <section className="ag-config-section">
        <div className="ag-config-head">
          <div>
            <h3>{t('agenda.config.professionals', 'Profesionales')}</h3>
            <p className="muted">{t('agenda.config.professionalsHelp', 'Usuarios que atienden citas: su especialidad y su horario semanal.')}</p>
          </div>
        </div>
        <DataTable
          columns={[
            { key: 'name', header: t('agenda.config.user', 'Usuario'), card: 'title',
              render: (p) => <span className="salud-badges">{p.configured && <Swatch color={colorFor(p.userId, p.color)} />}<span className="salud-result-name">{p.name}</span></span> },
            { key: 'specialty', header: t('agenda.config.specialty', 'Especialidad'), card: 'subtitle', render: (p) => p.specialty || '—' },
            { key: 'schedule', header: t('agenda.config.schedule', 'Horario semanal'), hideOnTablet: true,
              render: (p) => (p.schedule?.length ? scheduleSummary(p.schedule, diaCorto) : '—') },
            { key: 'status', header: t('common.status', 'Estado'), card: 'badge',
              render: (p) => (p.configured ? <Activo on={p.active} /> : <span className="badge-m3 neutral">{t('agenda.config.notProfessional', 'No es profesional')}</span>) },
          ]}
          rows={professionals} rowKey={(p) => p.userId} density="compact"
          onRowClick={canEdit ? (p) => setDialog({ kind: 'prof', item: p }) : undefined}
          empty={t('agenda.config.noUsers', 'No hay usuarios')} emptyIcon="users"
        />
      </section>

      <section className="ag-config-section">
        <div className="ag-config-head">
          <div>
            <h3>{t('agenda.config.resources', 'Consultorios y recursos')}</h3>
            <p className="muted">{t('agenda.config.resourcesHelp', 'Consultorios, sillones o equipos que se reservan junto con la cita.')}</p>
          </div>
          {canEdit && <Button type="button" variant="tonal" icon="plus" onClick={() => setDialog({ kind: 'res' })}>{t('agenda.config.newResource', 'Nuevo recurso')}</Button>}
        </div>
        <DataTable
          columns={[
            { key: 'name', header: t('agenda.config.nameColumn', 'Nombre'), card: 'title' },
            { key: 'kind', header: t('agenda.config.kind', 'Tipo'), card: 'subtitle', render: (r) => t(`agenda.kinds.${r.kind}`, RESOURCE_KINDS.find((k) => k.id === r.kind)?.label || r.kind) },
            { key: 'active', header: t('common.status', 'Estado'), card: 'badge', render: (r) => <Activo on={r.active} /> },
          ]}
          rows={resources} rowKey={(r) => r.id} density="compact"
          onRowClick={canEdit ? (r) => setDialog({ kind: 'res', item: r }) : undefined}
          empty={t('agenda.config.noResources', 'Sin recursos. Solo hacen falta si los tipos de cita reservan consultorio o equipo.')} emptyIcon="box"
        />
      </section>

      <section className="ag-config-section">
        <div className="ag-config-head">
          <div>
            <h3>{t('agenda.config.types', 'Tipos de cita')}</h3>
            <p className="muted">{t('agenda.config.typesHelp', 'Lo que se agenda: cuánto dura, cuánto cuesta y si necesita consultorio.')}</p>
          </div>
          {canEdit && <Button type="button" variant="tonal" icon="plus" onClick={() => setDialog({ kind: 'type' })}>{t('agenda.config.newType', 'Nuevo tipo de cita')}</Button>}
        </div>
        <DataTable
          columns={[
            { key: 'name', header: t('agenda.config.nameColumn', 'Nombre'), card: 'title',
              render: (x) => <span className="salud-badges"><Swatch color={colorFor(x.id, x.color)} />{x.name}</span> },
            { key: 'durationMinutes', header: t('agenda.config.durationShort', 'Duración'), align: 'right', render: (x) => `${x.durationMinutes} min` },
            { key: 'price', header: t('agenda.config.priceShort', 'Precio'), align: 'right', card: 'amount',
              render: (x) => (x.price != null ? <span className="num">Q {Number(x.price).toFixed(2)}</span> : '—') },
            { key: 'requiresResource', header: t('agenda.config.resourceShort', 'Recurso'), hideOnTablet: true,
              render: (x) => (x.requiresResource ? t('agenda.config.required', 'Obligatorio') : '—') },
            { key: 'active', header: t('common.status', 'Estado'), card: 'badge', render: (x) => <Activo on={x.active} /> },
          ]}
          rows={types} rowKey={(x) => x.id} density="compact"
          onRowClick={canEdit ? (x) => setDialog({ kind: 'type', item: x }) : undefined}
          empty={t('agenda.config.noTypes', 'Crea al menos un tipo de cita (por ejemplo, Consulta de 30 minutos) para empezar a agendar.')} emptyIcon="calendar"
        />
      </section>

      <PackagesSection types={types} canEdit={canEdit} pushToast={pushToast} />

      <RemindersCard canEdit={canEdit} pushToast={pushToast} />

      {dialog?.kind === 'prof' && (
        <ProfessionalDialog prof={dialog.item} resources={resources} pushToast={pushToast} onClose={cerrar}
          onSaved={guardado(t('agenda.config.professionalSaved', 'Profesional guardado'))} />
      )}
      {dialog?.kind === 'res' && (
        <ResourceDialog resource={dialog.item} pushToast={pushToast} onClose={cerrar}
          onSaved={guardado(t('agenda.config.resourceSaved', 'Recurso guardado'))} />
      )}
      {dialog?.kind === 'type' && (
        <TypeDialog type={dialog.item} pushToast={pushToast} onClose={cerrar}
          onSaved={guardado(t('agenda.config.typeSaved', 'Tipo de cita guardado'))} />
      )}
    </div>
  );
}
