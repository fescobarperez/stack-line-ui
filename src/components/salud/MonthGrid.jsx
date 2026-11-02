// Vista de mes de la agenda: calendario de domingo a sábado. Cada día muestra
// sus primeras citas (hora y paciente, con el color del tipo de cita) y un
// «+N más»; el número del día o el «más» abren ese día en la vista de día.
import React from 'react';
import { useTranslation } from 'react-i18next';
import { MONTH_WEEKDAYS, STATUS, WEEKDAYS, colorFor, gtDate, gtTime, isActive, monthOf, weekdayOf } from '../../lib/agenda.js';

/** Citas que caben en una celda antes del «+N más». */
export const MAX_POR_DIA = 3;

/**
 * @param days  días ISO a pintar (semanas completas)
 * @param month mes que se está viendo («2026-11»); los demás días van atenuados
 */
export default function MonthGrid({ days, month, today, appointments, onOpen, onDay, onNew, showProfessional = true }) {
  const { t, i18n } = useTranslation();
  // «1 nov»: el primer día de cada mes lleva el nombre, para no perderse en el cambio de mes.
  const mesCorto = (iso) => {
    const [a, m] = iso.split('-').map(Number);
    return new Intl.DateTimeFormat(i18n.language || 'es', { month: 'short', timeZone: 'UTC' })
      .format(new Date(Date.UTC(a, m - 1, 1))).replace('.', '');
  };
  const porDia = {};
  appointments.forEach((a) => { (porDia[gtDate(a.startsAt)] ||= []).push(a); });
  Object.values(porDia).forEach((l) => l.sort((x, y) => x.startsAt.localeCompare(y.startsAt)));

  return (
    <div className="ag-month" role="grid" aria-label={t('agenda.views.month', 'Mes')}>
      <div className="ag-month-row ag-month-head" role="row">
        {MONTH_WEEKDAYS.map((n) => (
          <div key={n} role="columnheader" className={`ag-month-wd${n >= 6 ? ' is-weekend' : ''}`}>
            {t(`agenda.weekdaysShort.${n}`, WEEKDAYS[n - 1].short)}
          </div>
        ))}
      </div>
      {Array.from({ length: days.length / 7 }, (_, s) => days.slice(s * 7, s * 7 + 7)).map((semana) => (
        <div key={semana[0]} className="ag-month-row" role="row">
          {semana.map((d) => {
            const citas = porDia[d] || [];
            const extra = citas.length - MAX_POR_DIA;
            const activas = citas.filter((a) => isActive(a.status)).length;
            const clases = [
              'ag-month-cell',
              monthOf(d) === month ? 'is-current' : 'is-outside',
              d === today && 'is-today',
              weekdayOf(d) >= 6 && 'is-weekend',
            ].filter(Boolean).join(' ');
            return (
              <div key={d} role="gridcell" className={clases}
                onDoubleClick={onNew ? () => onNew(d) : undefined}>
                <div className="ag-month-top">
                  <button type="button" className="ag-month-num" onClick={() => onDay(d)}
                    aria-label={t('agenda.month.openDay', 'Ver el día {{day}}', { day: d })}>
                    {Number(d.slice(8))}
                    {d.endsWith('-01') && <span className="ag-month-mon">{mesCorto(d)}</span>}
                  </button>
                  {activas > 0 && (
                    <span className="ag-month-count" title={t('agenda.month.count', '{{count}} citas', { count: activas })}>
                      {activas}
                    </span>
                  )}
                </div>
                <div className="ag-month-list">
                  {citas.slice(0, MAX_POR_DIA).map((a) => (
                    <button key={a.id} type="button"
                      className={`ag-month-appt ag-appt--${a.status}${isActive(a.status) ? '' : ' ag-appt--off'}`}
                      style={{ '--ag-color': colorFor(a.typeId, a.typeColor) }}
                      title={`${gtTime(a.startsAt)}–${gtTime(a.endsAt)} · ${a.patientName} · ${a.typeName}`
                        + `${showProfessional ? ` · ${a.professionalName}` : ''} · ${t(`agenda.status.${a.status}`, STATUS[a.status]?.label)}`}
                      onClick={() => onOpen(a)}>
                      <span className="ag-month-time">{gtTime(a.startsAt)}</span>
                      <span className="ag-month-name">{a.patientName}</span>
                    </button>
                  ))}
                  {extra > 0 && (
                    <button type="button" className="ag-month-more" onClick={() => onDay(d)}>
                      {t('agenda.month.more', '+{{count}} más', { count: extra })}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
