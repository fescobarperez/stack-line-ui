// TimePicker — selector de hora propio, hermano de DatePicker.
//
// En vez de una lista larga (05:00, 05:15, 05:30… 68 renglones), la hora se
// elige en dos toques: primero la hora, agrupada por momento del día
// (mañana, tarde, noche), y luego los minutos. También se puede escribir
// («930», «9:30», «2 pm», «14.30») y mover con las flechas ↑ ↓.
//
// Misma firma que un input controlado: `value` en HH:mm (24 h) y
// `onChange('HH:mm')`. Devuelve '' al limpiar, como DatePicker.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon.jsx';

const dos = (n) => String(n).padStart(2, '0');
export const aMinutos = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm || '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
export const aHhmm = (min) => `${dos(Math.floor(min / 60))}:${dos(min % 60)}`;

/** «9:30 a. m.»: cómo se dice la hora en Guatemala. */
export function hora12(hhmm) {
  const t = aMinutos(hhmm);
  if (t == null) return '';
  const h = Math.floor(t / 60);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${dos(t % 60)} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}

/**
 * Lo que alguien escribe → minutos del día, o null si no se entiende.
 * «9» 09:00 · «930» 09:30 · «0930» · «9:30» · «9.30» · «2 pm» 14:00 ·
 * «2:30 p. m.» 14:30 · «12 am» 00:00.
 */
export function leerHora(texto) {
  const t = String(texto || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!t) return null;
  const m = /^(\d{1,2})(?:[:.h ]?(\d{2}))?\s*(a\.?\s?m\.?|p\.?\s?m\.?)?$/.exec(t);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] != null ? Number(m[2]) : 0;
  const sufijo = m[3]?.[0];
  if (sufijo) {
    if (h < 1 || h > 12) return null;
    if (sufijo === 'p' && h !== 12) h += 12;
    if (sufijo === 'a' && h === 12) h = 0;
  }
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Al múltiplo de `paso` más cercano, sin salirse del rango. */
export function ajustar(min, desde, hasta, paso) {
  const redondo = Math.round(min / paso) * paso;
  return Math.min(Math.max(redondo, desde), hasta - ((hasta - desde) % paso));
}

const MOMENTOS = [
  { id: 'madrugada', label: 'Madrugada', de: 0, a: 5 },
  { id: 'manana', label: 'Mañana', de: 6, a: 11 },
  { id: 'tarde', label: 'Tarde', de: 12, a: 17 },
  { id: 'noche', label: 'Noche', de: 18, a: 23 },
];

export default function TimePicker({
  value,
  onChange,
  from = '00:00',
  to = '23:59',
  step = 15,
  disabled = false,
  allowClear = false,
  placeholder = '--:--',
  placement = 'auto',
  className = '',
  'aria-label': ariaLabel,
}) {
  const desde = aMinutos(from) ?? 0;
  const hasta = aMinutos(to) ?? 23 * 60 + 59;
  const [abierto, setAbierto] = useState(false);
  const [vista, setVista] = useState('hora'); // 'hora' | 'minutos'
  const [hora, setHora] = useState(null);     // hora elegida en el panel antes de los minutos
  const [texto, setTexto] = useState(value || '');
  const [caja, setCaja] = useState(null);
  const contenedor = useRef(null);
  const panel = useRef(null);
  const entrada = useRef(null);

  const actual = aMinutos(value);
  useEffect(() => { setTexto(value || ''); }, [value]);

  // Al abrir: si ya hay hora, se ve resaltada; se empieza siempre por la hora.
  useEffect(() => {
    if (!abierto) return;
    setVista('hora');
    setHora(actual != null ? Math.floor(actual / 60) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  /** Valores posibles: cada `step` minutos dentro del rango. */
  const posibles = useMemo(() => {
    const out = [];
    for (let m = desde; m <= hasta; m += step) out.push(m);
    return out;
  }, [desde, hasta, step]);
  const horasPosibles = useMemo(() => new Set(posibles.map((m) => Math.floor(m / 60))), [posibles]);
  const minutosDe = (h) => posibles.filter((m) => Math.floor(m / 60) === h).map((m) => m % 60);
  const pasoMinutos = useMemo(() => Array.from({ length: Math.ceil(60 / step) }, (_, i) => i * step).filter((m) => m < 60), [step]);

  // Mismo manejo que DatePicker: panel por portal, posición recalculada.
  useEffect(() => {
    if (!abierto) return undefined;
    const medir = () => {
      const el = contenedor.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const debajo = window.innerHeight - r.bottom;
      const arriba = placement === 'up' ? true
        : placement === 'down' ? false
        : debajo < 360 && r.top > debajo;
      setCaja({
        left: Math.max(8, Math.min(r.left, window.innerWidth - 312)),
        ...(arriba ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
      });
    };
    medir();
    window.addEventListener('scroll', medir, true);
    window.addEventListener('resize', medir);
    return () => {
      window.removeEventListener('scroll', medir, true);
      window.removeEventListener('resize', medir);
    };
  }, [abierto, placement]);

  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => {
      if (contenedor.current?.contains(e.target) || panel.current?.contains(e.target)) return;
      setAbierto(false);
    };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, [abierto]);

  const emitir = (min) => {
    const v = min == null ? '' : aHhmm(min);
    setTexto(v);
    if (v !== (value || '')) onChange?.(v);
  };

  /** Lo escrito: se entiende, se lleva al paso y al rango; si no, vuelve lo de antes. */
  const confirmarTexto = () => {
    if (!texto.trim()) {
      if (allowClear) emitir(null); else setTexto(value || '');
      return;
    }
    const min = leerHora(texto);
    if (min == null) { setTexto(value || ''); return; }
    emitir(ajustar(min, desde, hasta, step));
  };

  const mover = (delta) => {
    const base = actual ?? leerHora(texto) ?? (delta > 0 ? desde - step : hasta + step);
    emitir(ajustar(base + delta * step, desde, hasta, step));
  };

  const teclas = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); confirmarTexto(); setAbierto(false); }
    else if (e.key === 'Escape') { setTexto(value || ''); setAbierto(false); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); mover(1); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); mover(-1); }
    else if (e.key === 'Tab') setAbierto(false);
  };

  const elegirHora = (h) => {
    const mins = minutosDe(h);
    const minActual = actual != null ? actual % 60 : null;
    const min = mins.includes(minActual) ? minActual : mins[0];
    setHora(h);
    emitir(h * 60 + min);
    // Si esa hora solo tiene un minuto posible, no hay nada más que elegir.
    if (mins.length > 1) setVista('minutos'); else setAbierto(false);
  };

  const elegirMinuto = (min) => {
    emitir(hora * 60 + min);
    setAbierto(false);
  };

  const ahora = () => {
    const d = new Date();
    emitir(ajustar(d.getHours() * 60 + d.getMinutes(), desde, hasta, step));
    setAbierto(false);
  };

  const horaVista = hora ?? (actual != null ? Math.floor(actual / 60) : null);
  const minVista = actual != null ? actual % 60 : null;
  const grupos = MOMENTOS
    .map((g) => ({ ...g, horas: Array.from({ length: g.a - g.de + 1 }, (_, i) => g.de + i).filter((h) => horasPosibles.has(h)) }))
    .filter((g) => g.horas.length > 0);

  return (
    <div className={`timepicker ${className}`} ref={contenedor}>
      <div className={`timepicker-field${abierto ? ' is-open' : ''}${disabled ? ' is-disabled' : ''}${allowClear ? ' has-clear' : ''}`}
        onClick={() => { if (!disabled) { entrada.current?.focus(); setAbierto(true); } }}>
        <Icon name="clock" size={16} className="timepicker-icon" />
        <input
          ref={entrada}
          className="timepicker-input"
          value={texto}
          placeholder={placeholder}
          disabled={disabled}
          inputMode="numeric"
          autoComplete="off"
          aria-label={ariaLabel}
          aria-haspopup="dialog"
          aria-expanded={abierto}
          onChange={(e) => setTexto(e.target.value)}
          onFocus={() => setAbierto(true)}
          onBlur={confirmarTexto}
          onKeyDown={teclas}
        />
        {value && <span className="timepicker-ampm">{hora12(value).split(' ').slice(1).join(' ')}</span>}
        {allowClear && value && !disabled && (
          <button type="button" className="timepicker-clear" aria-label="Quitar hora"
            onClick={(e) => { e.stopPropagation(); emitir(null); }}>
            <Icon name="close" size={13} />
          </button>
        )}
      </div>

      {abierto && caja && createPortal(
        <div className="timepicker-panel" ref={panel} style={{ position: 'fixed', ...caja }} role="dialog"
          aria-label={ariaLabel || 'Elegir hora'}
          // Que un clic en el panel no le quite el foco al campo (y no confirme a medias).
          onMouseDown={(e) => e.preventDefault()}>
          <div className="timepicker-readout">
            <button type="button" className={`timepicker-seg${vista === 'hora' ? ' is-active' : ''}`}
              onClick={() => setVista('hora')} aria-label="Cambiar la hora">
              {horaVista != null ? dos(horaVista) : '--'}
            </button>
            <span className="timepicker-colon">:</span>
            <button type="button" className={`timepicker-seg${vista === 'minutos' ? ' is-active' : ''}`}
              disabled={horaVista == null} onClick={() => { setHora(horaVista); setVista('minutos'); }}
              aria-label="Cambiar los minutos">
              {minVista != null ? dos(minVista) : '--'}
            </button>
            <span className="timepicker-readout-12">{value ? hora12(value) : 'Elige la hora'}</span>
          </div>

          {vista === 'hora' ? (
            <div className="timepicker-body">
              {grupos.map((g) => (
                <div key={g.id} className="timepicker-group">
                  <span className="timepicker-group-label">{g.label}</span>
                  <div className="timepicker-grid timepicker-grid--hours">
                    {g.horas.map((h) => (
                      <button key={h} type="button" aria-pressed={horaVista === h}
                        className={`timepicker-chip${horaVista === h ? ' is-selected' : ''}`}
                        onClick={() => elegirHora(h)}>
                        {dos(h)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="timepicker-body">
              <span className="timepicker-group-label">Minutos de las {dos(hora)}</span>
              <div className={`timepicker-grid ${pasoMinutos.length > 6 ? 'timepicker-grid--many' : 'timepicker-grid--mins'}`}>
                {pasoMinutos.map((m) => {
                  const ok = minutosDe(hora).includes(m);
                  const elegido = actual != null && Math.floor(actual / 60) === hora && minVista === m;
                  return (
                    <button key={m} type="button" disabled={!ok} aria-pressed={elegido}
                      className={`timepicker-chip${elegido ? ' is-selected' : ''}`}
                      onClick={() => elegirMinuto(m)}>
                      :{dos(m)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="timepicker-foot">
            {vista === 'minutos' && (
              <button type="button" className="timepicker-link" onClick={() => setVista('hora')}>
                <Icon name="chevronLeft" size={14} /> Hora
              </button>
            )}
            <span className="timepicker-spacer" />
            <button type="button" className="timepicker-link" onClick={ahora}>Ahora</button>
            {allowClear && (
              <button type="button" className="timepicker-link" onClick={() => { emitir(null); setAbierto(false); }}>
                Limpiar
              </button>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
