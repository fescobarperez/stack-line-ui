import { describe, expect, it } from 'vitest';
import {
  addDays, daysOf, gtDate, gtParts, gtTime, normalizeSchedule, placeIn, rangeOf, scheduleErrors, snap,
  startOfWeek, timeOptions, toInstant, visibleHours, weekdayOf, workWindows, reminderHourOptions, reminderInfo,
  addMonths, monthDays, monthOf, MONTH_WEEKDAYS,
} from './agenda.js';
import { scheduleSummary } from '../components/salud/AgendaConfig.jsx';
import { PRESETS, aplicarPreset } from './permissions.js';
import { screenEnabled } from './modules.js';

describe('agenda · horas de Guatemala', () => {
  it('lee un instante en hora de Guatemala, sin importar la zona del navegador', () => {
    // 15:30 UTC = 09:30 en Guatemala
    expect(gtParts('2026-11-02T15:30:00Z')).toMatchObject({ date: '2026-11-02', time: '09:30', minutes: 570, weekday: 1 });
    // 03:00 UTC del martes sigue siendo lunes en Guatemala
    expect(gtDate('2026-11-03T03:00:00Z')).toBe('2026-11-02');
    expect(gtTime(toInstant('2026-11-02', '08:15'))).toBe('08:15');
  });

  it('arma días, semanas y el rango para la API', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(weekdayOf('2026-11-08')).toBe(7);
    expect(startOfWeek('2026-11-05')).toBe('2026-11-02');
    expect(daysOf('week', '2026-11-05')).toHaveLength(7);
    expect(daysOf('day', '2026-11-05')).toEqual(['2026-11-05']);
    expect(rangeOf(['2026-11-02'])).toEqual({ from: '2026-11-02T06:00:00.000Z', to: '2026-11-03T06:00:00.000Z' });
  });

  it('ofrece horas cada 15 minutos', () => {
    const h = timeOptions('08:00', '09:00');
    expect(h).toEqual(['08:00', '08:15', '08:30', '08:45', '09:00']);
  });
});

describe('agenda · cuadrícula', () => {
  const horas = { start: 8 * 60, end: 12 * 60 };
  const dia = '2026-11-02';

  it('ubica una cita por minutos desde el inicio visible', () => {
    expect(placeIn(dia, toInstant(dia, '09:00'), toInstant(dia, '09:30'), horas)).toEqual({ top: 60, height: 30 });
    expect(placeIn('2026-11-03', toInstant(dia, '09:00'), toInstant(dia, '09:30'), horas)).toBeNull();
    // un bloqueo de varios días se recorta al día visible
    expect(placeIn(dia, toInstant('2026-11-01', '10:00'), toInstant('2026-11-04', '10:00'), horas)).toEqual({ top: 0, height: 240 });
  });

  it('las horas visibles salen del horario y de las citas', () => {
    const prof = { schedule: [{ weekday: 1, start: '08:30:00', end: '13:00:00' }] };
    expect(visibleHours([prof], [])).toEqual({ start: 480, end: 780 });
    expect(visibleHours([], [])).toEqual({ start: 420, end: 1140 });
    const tarde = { startsAt: toInstant(dia, '18:00'), endsAt: toInstant(dia, '18:45') };
    expect(visibleHours([prof], [tarde]).end).toBe(19 * 60);
  });

  it('el clic se redondea a 15 minutos dentro del rango', () => {
    expect(snap(37 * 1.2, 1.2, horas)).toBe(8 * 60 + 30);
    expect(snap(-10, 1.2, horas)).toBe(8 * 60);
    expect(snap(9999, 1.2, horas)).toBe(12 * 60 - 15);
  });

  it('las franjas de trabajo son las del día de la semana', () => {
    const prof = { schedule: [{ weekday: 1, start: '08:00', end: '12:00', resourceId: 3 }, { weekday: 2, start: '14:00', end: '18:00' }] };
    expect(workWindows(prof, dia)).toEqual([{ start: 480, end: 720, resourceId: 3 }]);
    expect(workWindows(null, dia)).toEqual([]);
  });
});

describe('agenda · horario semanal', () => {
  it('detecta franjas invertidas o cruzadas', () => {
    expect(scheduleErrors([{ weekday: 1, start: '08:00', end: '12:00' }, { weekday: 1, start: '14:00', end: '18:00' }])).toEqual([]);
    expect(scheduleErrors([{ weekday: 1, start: '08:00', end: '12:00' }, { weekday: 1, start: '11:00', end: '13:00' }])[0].key).toBe('slotOverlap');
    expect(scheduleErrors([{ weekday: 2, start: '12:00', end: '08:00' }])[0].key).toBe('slotRange');
  });

  it('resume el horario en una línea', () => {
    const corto = (d) => ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'][d - 1];
    const semana = [1, 2, 3, 4, 5].map((d) => ({ weekday: d, start: '08:00:00', end: '12:00:00' }));
    expect(scheduleSummary([...semana, { weekday: 6, start: '09:00', end: '13:00' }], corto))
      .toBe('Lun–Vie 08:00–12:00 · Sáb 09:00–13:00');
    expect(normalizeSchedule([{ weekday: 1, start: '08:00:00', end: '12:00:00' }])[0]).toEqual({ weekday: 1, start: '08:00', end: '12:00', resourceId: null });
  });
});

describe('agenda · permisos y plan', () => {
  it('la agenda solo existe con el módulo salud', () => {
    expect(screenEnabled('agenda', ['base'])).toBe(false);
    expect(screenEnabled('agenda', ['base', 'salud'])).toBe(true);
  });

  it('recepción agenda y el profesional atiende, sin configurar la agenda', () => {
    const recepcion = aplicarPreset(PRESETS.find((p) => p.id === 'recepcion_clinica'));
    expect(recepcion.agenda.crear).toBe(true);
    expect(recepcion.agenda_config.ver).toBe(false);
    expect(recepcion.clinical_record.ver).toBe(false);
    const profesional = aplicarPreset(PRESETS.find((p) => p.id === 'profesional_salud'));
    expect(profesional.agenda.editar).toBe(true);
    expect(profesional.agenda_config.editar).toBe(false);
  });
});

describe('agenda · recordatorios', () => {
  it('ofrece las anticipaciones de siempre y conserva una guardada distinta', () => {
    expect(reminderHourOptions(24)).toEqual([2, 4, 6, 12, 24, 48, 72]);
    expect(reminderHourOptions(36)).toEqual([2, 4, 6, 12, 24, 36, 48, 72]);
    expect(reminderHourOptions(undefined)).toContain(24);
  });

  it('describe el estado del recordatorio', () => {
    expect(reminderInfo({ reminderStatus: 'enviado', reminderSentAt: 'x' })).toEqual({ key: 'sent', badge: 'success', at: 'x' });
    expect(reminderInfo({ reminderStatus: 'fallido' }).key).toBe('failed');
    expect(reminderInfo({ reminderStatus: null })).toBeNull();
    expect(reminderInfo(null)).toBeNull();
  });
});

describe('agenda · vista de mes', () => {
  it('arma semanas completas de domingo a sábado', () => {
    const oct = monthDays('2026-10-15'); // octubre 2026 empieza en jueves
    expect(oct[0]).toBe('2026-09-27');   // domingo
    expect(oct.length).toBe(35);         // 5 semanas: el 31 cae en sábado
    expect(oct.at(-1)).toBe('2026-10-31'); // sábado
    expect(monthDays('2026-05-10').length).toBe(42); // mayo 2026 empieza en viernes: 6 semanas
    expect(weekdayOf(oct[0])).toBe(7);
    expect(weekdayOf(oct.at(-1))).toBe(6);
    const nov = monthDays('2026-11-18'); // noviembre 2026 empieza en domingo
    expect(nov[0]).toBe('2026-11-01');
    expect(nov.length).toBe(35);
    expect(daysOf('month', '2026-11-18')).toEqual(nov);
    expect(MONTH_WEEKDAYS[0]).toBe(7);
  });

  it('mueve de mes sin caerse del último día', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-11-15', 2)).toBe('2027-01-15');
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
    expect(monthOf('2026-11-15')).toBe('2026-11');
  });
});
