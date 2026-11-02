// Stackline Salud — agenda, sin React: fechas en hora de Guatemala, rangos
// de día y semana, posición de las citas en la cuadrícula y estados.
//
// Las horas se calculan siempre en Guatemala (UTC−6, sin horario de verano)
// y no en la zona del navegador: una recepcionista con la laptop en otra
// zona vería las citas corridas. El backend recibe instantes ISO con zona.

export const OFFSET_MIN = -6 * 60;
const OFFSET_TXT = '-06:00';
const MS_MIN = 60000;

const dos = (n) => String(n).padStart(2, '0');

/** Partes de un instante en hora de Guatemala. */
export function gtParts(iso) {
  const d = new Date(Date.parse(iso) + OFFSET_MIN * MS_MIN);
  return {
    date: `${d.getUTCFullYear()}-${dos(d.getUTCMonth() + 1)}-${dos(d.getUTCDate())}`,
    time: `${dos(d.getUTCHours())}:${dos(d.getUTCMinutes())}`,
    minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
    weekday: ((d.getUTCDay() + 6) % 7) + 1, // ISO: 1 = lunes … 7 = domingo
  };
}

export const gtDate = (iso) => gtParts(iso).date;
export const gtTime = (iso) => gtParts(iso).time;

/** Fecha y hora de Guatemala → instante ISO con zona, para el backend. */
export const toInstant = (dateIso, hhmm) => `${dateIso}T${hhmm.length === 5 ? `${hhmm}:00` : hhmm}${OFFSET_TXT}`;

/** Hoy en Guatemala (YYYY-MM-DD). */
export const todayGt = (now = new Date()) => gtDate(now.toISOString());

export function addDays(dateIso, n) {
  const [a, m, d] = dateIso.split('-').map(Number);
  const f = new Date(Date.UTC(a, m - 1, d + n));
  return `${f.getUTCFullYear()}-${dos(f.getUTCMonth() + 1)}-${dos(f.getUTCDate())}`;
}

/** Día ISO de la semana (1 = lunes) de una fecha. */
export function weekdayOf(dateIso) {
  const [a, m, d] = dateIso.split('-').map(Number);
  return ((new Date(Date.UTC(a, m - 1, d)).getUTCDay() + 6) % 7) + 1;
}

/** Lunes de la semana de la fecha. */
export const startOfWeek = (dateIso) => addDays(dateIso, 1 - weekdayOf(dateIso));

/**
 * Días del mes en semanas completas de domingo a sábado (5 o 6 semanas),
 * como el calendario de pared. La vista de semana sigue de lunes a domingo.
 */
export function monthDays(dateIso) {
  const [a, m] = dateIso.split('-').map(Number);
  const primero = `${a}-${dos(m)}-01`;
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const desfase = weekdayOf(primero) % 7; // domingo = 0
  const inicio = addDays(primero, -desfase);
  const semanas = Math.ceil((desfase + ultimo) / 7);
  return Array.from({ length: semanas * 7 }, (_, i) => addDays(inicio, i));
}

/** Columnas del mes: domingo primero (ids de WEEKDAYS, 7 = domingo). */
export const MONTH_WEEKDAYS = [7, 1, 2, 3, 4, 5, 6];

/** Mismo día n meses después; si no existe (31 de febrero), el último del mes. */
export function addMonths(dateIso, n) {
  const [a, m, d] = dateIso.split('-').map(Number);
  const base = new Date(Date.UTC(a, m - 1 + n, 1));
  const ultimo = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
  return `${base.getUTCFullYear()}-${dos(base.getUTCMonth() + 1)}-${dos(Math.min(d, ultimo))}`;
}

/** «2026-11» de una fecha: para saber si un día es del mes que se ve. */
export const monthOf = (dateIso) => dateIso.slice(0, 7);

/** Días a mostrar: uno, los siete de la semana o las semanas del mes. */
export const daysOf = (view, dateIso) => {
  if (view === 'week') return Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(dateIso), i));
  if (view === 'month') return monthDays(dateIso);
  return [dateIso];
};

/** Rango [from, to) de los días, como instantes UTC para la API. */
export function rangeOf(days) {
  const from = new Date(Date.parse(toInstant(days[0], '00:00'))).toISOString();
  const to = new Date(Date.parse(toInstant(addDays(days[days.length - 1], 1), '00:00'))).toISOString();
  return { from, to };
}

export const hhmmToMin = (hhmm) => {
  const [h, m] = String(hhmm).slice(0, 5).split(':').map(Number);
  return h * 60 + m;
};
export const minToHhmm = (min) => `${dos(Math.floor(min / 60))}:${dos(min % 60)}`;

/** Horas cada `step` minutos entre `from` y `to` (para los selectores de hora). */
export function timeOptions(from = '06:00', to = '21:00', step = 15) {
  const out = [];
  for (let m = hhmmToMin(from); m <= hhmmToMin(to); m += step) out.push(minToHhmm(m));
  return out;
}

/**
 * Horas visibles de la cuadrícula: de la primera franja de trabajo a la
 * última (y las citas que caigan fuera), redondeadas a la hora. Sin
 * horarios configurados, de 7:00 a 19:00.
 */
export function visibleHours(professionals = [], appointments = []) {
  let ini = Infinity;
  let fin = -Infinity;
  professionals.forEach((p) => (p.schedule || []).forEach((s) => {
    ini = Math.min(ini, hhmmToMin(s.start));
    fin = Math.max(fin, hhmmToMin(s.end));
  }));
  appointments.forEach((a) => {
    ini = Math.min(ini, gtParts(a.startsAt).minutes);
    const f = gtParts(a.endsAt);
    fin = Math.max(fin, f.minutes === 0 && f.date !== gtDate(a.startsAt) ? 24 * 60 : f.minutes);
  });
  if (!Number.isFinite(ini)) return { start: 7 * 60, end: 19 * 60 };
  return { start: Math.floor(ini / 60) * 60, end: Math.min(24 * 60, Math.ceil(fin / 60) * 60) };
}

/**
 * Posición de un intervalo dentro de la columna de un día, en minutos desde
 * el inicio visible. Lo que no cae en ese día devuelve null; lo que se sale
 * por arriba o por abajo se recorta.
 */
export function placeIn(dayIso, startIso, endIso, hours) {
  const ini = gtParts(startIso);
  const fin = gtParts(endIso);
  const desde = ini.date < dayIso ? 0 : ini.date > dayIso ? null : ini.minutes;
  const hasta = fin.date > dayIso ? 24 * 60 : fin.date < dayIso ? null : fin.minutes;
  if (desde == null || hasta == null || hasta <= desde) return null;
  const top = Math.max(desde, hours.start) - hours.start;
  const bottom = Math.min(hasta, hours.end) - hours.start;
  if (bottom <= top) return null;
  return { top, height: bottom - top };
}

/** Franjas de trabajo del profesional ese día, en minutos. */
export const workWindows = (professional, dateIso) => (professional?.schedule || [])
  .filter((s) => s.weekday === weekdayOf(dateIso))
  .map((s) => ({ start: hhmmToMin(s.start), end: hhmmToMin(s.end), resourceId: s.resourceId ?? null }));

/** Minuto (relativo al día) donde se hizo clic en la columna, redondeado a `step`. */
export function snap(offsetPx, pxPerMin, hours, step = 15) {
  const min = hours.start + offsetPx / pxPerMin;
  return Math.max(hours.start, Math.min(hours.end - step, Math.floor(min / step) * step));
}

// ── Estados ───────────────────────────────────────────────────────────

export const STATUS = {
  solicitada:  { label: 'Solicitada',  badge: 'warning' },
  confirmada:  { label: 'Confirmada',  badge: 'info' },
  en_sala:     { label: 'En sala',     badge: 'tertiary' },
  en_atencion: { label: 'En atención', badge: 'accent' },
  completada:  { label: 'Completada',  badge: 'success' },
  cancelada:   { label: 'Cancelada',   badge: 'neutral' },
  no_asistio:  { label: 'No asistió',  badge: 'danger' },
};

/** Botón de cada cambio de estado: el verbo que ve recepción. */
export const ACTION = {
  confirmada:  { label: 'Confirmar', icon: 'check' },
  en_sala:     { label: 'Llegó', icon: 'user' },
  en_atencion: { label: 'Pasar a atención', icon: 'health' },
  completada:  { label: 'Completar', icon: 'check' },
  cancelada:   { label: 'Cancelar cita', icon: 'x', danger: true },
  no_asistio:  { label: 'No asistió', icon: 'alert', danger: true },
};

/** Las que ocupan el horario y se pintan llenas; canceladas y «no asistió» van tenues. */
export const isActive = (status) => status !== 'cancelada' && status !== 'no_asistio';

export const canReschedule = (status) => status === 'solicitada' || status === 'confirmada';

export const RESOURCE_KINDS = [
  { id: 'consultorio', label: 'Consultorio' },
  { id: 'sillon', label: 'Sillón' },
  { id: 'equipo', label: 'Equipo' },
  { id: 'sala', label: 'Sala' },
  { id: 'otro', label: 'Otro' },
];

export const WEEKDAYS = [
  { id: 1, label: 'Lunes', short: 'Lun' },
  { id: 2, label: 'Martes', short: 'Mar' },
  { id: 3, label: 'Miércoles', short: 'Mié' },
  { id: 4, label: 'Jueves', short: 'Jue' },
  { id: 5, label: 'Viernes', short: 'Vie' },
  { id: 6, label: 'Sábado', short: 'Sáb' },
  { id: 7, label: 'Domingo', short: 'Dom' },
];

/** Paleta para profesionales y tipos de cita sin color propio. */
export const PALETTE = ['#1E88E5', '#43A047', '#8E24AA', '#F4511E', '#00897B', '#6D4C41', '#3949AB', '#C0CA33'];
export const colorFor = (id, own) => own || PALETTE[Math.abs(Number(id) || 0) % PALETTE.length];

/** Valida el horario semanal antes de mandarlo: fin después del inicio y sin cruces el mismo día. */
export function scheduleErrors(slots) {
  const errs = [];
  const orden = [...slots].sort((a, b) => a.weekday - b.weekday || hhmmToMin(a.start) - hhmmToMin(b.start));
  orden.forEach((s, i) => {
    if (hhmmToMin(s.end) <= hhmmToMin(s.start)) errs.push({ key: 'slotRange', weekday: s.weekday });
    const prev = orden[i - 1];
    if (prev && prev.weekday === s.weekday && hhmmToMin(s.start) < hhmmToMin(prev.end)) {
      errs.push({ key: 'slotOverlap', weekday: s.weekday });
    }
  });
  return errs;
}

/** Las horas del backend llegan como 09:00:00; la pantalla trabaja con 09:00. */
export const normalizeSchedule = (slots = []) => slots.map((s) => ({
  weekday: s.weekday, start: String(s.start).slice(0, 5), end: String(s.end).slice(0, 5), resourceId: s.resourceId ?? null,
}));

/** Etiqueta corta de fecha: «lun 02/11». */
export function shortDate(dateIso) {
  const [, m, d] = dateIso.split('-');
  return `${WEEKDAYS[weekdayOf(dateIso) - 1].short} ${d}/${m}`;
}

// ── Recordatorios ──────────────────────────────────────────────────────

/** Anticipaciones que ofrece la pantalla (el backend acepta de 2 a 72 h). */
export const REMINDER_HOURS = [2, 4, 6, 12, 24, 48, 72];

/** Opciones del selector: las de siempre más la guardada si es otra. */
export const reminderHourOptions = (current) => [...new Set([...REMINDER_HOURS, Number(current) || 24])]
  .filter((h) => h >= 2 && h <= 72).sort((a, b) => a - b);

/**
 * Qué decir del recordatorio de una cita en el detalle. null cuando no hay
 * nada que contar (la cita no está pendiente o aún no toca).
 */
export function reminderInfo(a) {
  if (a?.reminderStatus === 'enviado') return { key: 'sent', badge: 'success', at: a.reminderSentAt };
  if (a?.reminderStatus === 'fallido') return { key: 'failed', badge: 'danger' };
  if (a?.reminderStatus === 'omitido') return { key: 'skipped', badge: 'neutral' };
  return null;
}
