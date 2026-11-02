// Cuadrícula de la agenda: una columna por profesional (vista de día) o por
// día (vista de semana). Las horas fuera del horario de trabajo van
// sombreadas, los bloqueos rayados y cada cita en su posición. Un clic en
// un hueco abre una cita nueva a esa hora.
//
// La posición de cada cita se calcula (minutos × escala), por eso va en
// `style`; todo lo demás está en global.css (.ag-*).
import React from 'react';
import { useTranslation } from 'react-i18next';
import { STATUS, gtTime, isActive, placeIn, snap, workWindows, colorFor } from '../../lib/agenda.js';

/** Píxeles por minuto: una hora mide 72 px. */
export const PX_POR_MIN = 1.2;

function Appointment({ a, pos, onClick, showProfessional }) {
  const { t } = useTranslation();
  const corta = pos.height < 34;
  return (
    <button type="button"
      className={`ag-appt ag-appt--${a.status}${isActive(a.status) ? '' : ' ag-appt--off'}${corta ? ' ag-appt--short' : ''}`}
      style={{ top: pos.top * PX_POR_MIN, height: Math.max(pos.height * PX_POR_MIN, 18), '--ag-color': colorFor(a.typeId, a.typeColor) }}
      onClick={(e) => { e.stopPropagation(); onClick(a); }}
      title={`${gtTime(a.startsAt)}–${gtTime(a.endsAt)} · ${a.patientName} · ${a.typeName} · ${t(`agenda.status.${a.status}`, STATUS[a.status]?.label)}`}>
      <span className="ag-appt-time">{gtTime(a.startsAt)}</span>
      <span className="ag-appt-name">{a.patientName}</span>
      {!corta && (
        <span className="ag-appt-meta">
          {/* Confirmada es lo normal y no se anuncia; cualquier otro estado sí. */}
          {a.status !== 'confirmada' && <strong>{t(`agenda.status.${a.status}`, STATUS[a.status]?.label)} · </strong>}
          {a.typeName}{showProfessional ? ` · ${a.professionalName}` : ''}{a.resourceName ? ` · ${a.resourceName}` : ''}
        </span>
      )}
    </button>
  );
}

/**
 * @param columns  [{ key, label, sub, date, professional, color }]
 * @param appointmentsFor (column) => citas de esa columna
 * @param blocksFor (column) => bloqueos de esa columna
 */
export default function AgendaGrid({ columns, hours, appointmentsFor, blocksFor, onSlot, onOpen, showProfessional = false, today }) {
  const { t } = useTranslation();
  const alto = (hours.end - hours.start) * PX_POR_MIN;
  const marcas = [];
  for (let m = hours.start; m < hours.end; m += 60) marcas.push(m);

  return (
    <div className="ag-scroll">
      <div className="ag-grid" style={{ '--ag-cols': columns.length }}>
        <div className="ag-corner" />
        {columns.map((c) => (
          <div key={c.key} className={`ag-head${c.date === today ? ' ag-head--today' : ''}`}>
            {c.color && <span className="ag-dot" style={{ background: c.color }} />}
            <span className="ag-head-label">{c.label}</span>
            {c.sub && <span className="ag-head-sub muted">{c.sub}</span>}
          </div>
        ))}

        <div className="ag-axis" style={{ height: alto }}>
          {marcas.map((m) => (
            <span key={m} className="ag-hour" style={{ top: (m - hours.start) * PX_POR_MIN }}>
              {String(Math.floor(m / 60)).padStart(2, '0')}:00
            </span>
          ))}
        </div>

        {columns.map((c) => (
          <div key={c.key} className="ag-col" style={{ height: alto }}
            role="button" tabIndex={-1}
            aria-label={t('agenda.newAt', 'Nueva cita en {{col}}', { col: c.label })}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              onSlot?.(c, snap(e.clientY - r.top, PX_POR_MIN, hours));
            }}>
            {marcas.map((m) => <span key={m} className="ag-line" style={{ top: (m - hours.start) * PX_POR_MIN }} />)}
            {workWindows(c.professional, c.date).map((w) => {
              const top = Math.max(w.start, hours.start) - hours.start;
              const h = Math.min(w.end, hours.end) - hours.start - top;
              return h > 0 ? <span key={w.start} className="ag-work" style={{ top: top * PX_POR_MIN, height: h * PX_POR_MIN }} /> : null;
            })}
            {(blocksFor?.(c) || []).map((b) => {
              const pos = placeIn(c.date, b.startsAt, b.endsAt, hours);
              return pos && (
                <span key={`b${b.id}`} className="ag-block" title={b.reason || t('agenda.blocked', 'Bloqueado')}
                  style={{ top: pos.top * PX_POR_MIN, height: pos.height * PX_POR_MIN }}>
                  <span className="ag-block-label">{b.reason || t('agenda.blocked', 'Bloqueado')}</span>
                </span>
              );
            })}
            {appointmentsFor(c).map((a) => {
              const pos = placeIn(c.date, a.startsAt, a.endsAt, hours);
              return pos && <Appointment key={a.id} a={a} pos={pos} onClick={onOpen} showProfessional={showProfessional} />;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
