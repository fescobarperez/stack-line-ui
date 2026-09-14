// DatePicker — selector de fecha propio.
//
// Reemplaza a <input type="date">, que se dibuja distinto en cada navegador:
// Chrome pinta su icono de calendario, Firefox otro y Safari casi nada, y el
// texto "dd/mm/aaaa" se mide diferente en cada uno. Con quince en el sistema,
// ninguna pantalla quedaba alineada.
//
// Misma firma que un input controlado: `value` en ISO (YYYY-MM-DD) y
// `onChange(iso)`. Devuelve '' al limpiar, no null, para que el consumidor no
// tenga que distinguir entre «sin fecha» y «campo vacío».
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon.jsx';

const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/** ISO → Date local. `new Date('2026-09-14')` lo interpreta en UTC y en
 *  Guatemala eso cae un día antes; por eso se parte a mano. */
const desdeIso = (iso) => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  const fecha = new Date(a, m - 1, d);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
};

const aIso = (fecha) => {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
};

const mostrar = (iso) => {
  const f = desdeIso(iso);
  return f ? `${String(f.getDate()).padStart(2, '0')}/${String(f.getMonth() + 1).padStart(2, '0')}/${f.getFullYear()}` : '';
};

const mismoDia = (a, b) => a && b && aIso(a) === aIso(b);

/** Lunes de la semana en que cae el día 1, para arrancar la rejilla. */
function celdas(ancla) {
  const primero = new Date(ancla.getFullYear(), ancla.getMonth(), 1);
  const desplazamiento = (primero.getDay() + 6) % 7;   // getDay(): 0 = domingo
  const inicio = new Date(primero);
  inicio.setDate(primero.getDate() - desplazamiento);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    return d;
  });
}

export default function DatePicker({
  value,
  onChange,
  min,
  max,
  disabled = false,
  allowClear = true,
  placeholder = 'dd/mm/aaaa',
  placement = 'auto',
  className = '',
  'aria-label': ariaLabel,
}) {
  const [abierto, setAbierto] = useState(false);
  const [caja, setCaja] = useState(null);
  const [ancla, setAncla] = useState(() => desdeIso(value) || new Date());
  const contenedor = useRef(null);
  const panel = useRef(null);

  const seleccionada = useMemo(() => desdeIso(value), [value]);
  const hoy = useMemo(() => new Date(), []);
  const limiteMin = useMemo(() => desdeIso(min), [min]);
  const limiteMax = useMemo(() => desdeIso(max), [max]);

  // Al abrir, el mes mostrado arranca en el de la fecha elegida.
  useEffect(() => { if (abierto) setAncla(desdeIso(value) || new Date()); }, [abierto, value]);

  /**
   * El panel va por portal a document.body, igual que la lista del
   * Autocomplete: dentro de un contenedor con overflow, un hijo absoluto se
   * recorta y ningún z-index lo salva. El precio es recalcular la posición
   * mientras esté abierto.
   */
  useEffect(() => {
    if (!abierto) return;
    const medir = () => {
      const el = contenedor.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const debajo = window.innerHeight - r.bottom;
      const arriba = placement === 'up' ? true
        : placement === 'down' ? false
        : debajo < 320 && r.top > debajo;
      setCaja({
        left: Math.min(r.left, window.innerWidth - 300),
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
    if (!abierto) return;
    const fuera = (e) => {
      if (contenedor.current?.contains(e.target)) return;
      if (panel.current?.contains(e.target)) return;
      setAbierto(false);
    };
    const escape = (e) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', escape);
    };
  }, [abierto]);

  const fueraDeRango = useCallback((d) => {
    if (limiteMin && d < limiteMin && !mismoDia(d, limiteMin)) return true;
    if (limiteMax && d > limiteMax && !mismoDia(d, limiteMax)) return true;
    return false;
  }, [limiteMin, limiteMax]);

  const elegir = (d) => {
    if (fueraDeRango(d)) return;
    onChange?.(aIso(d));
    setAbierto(false);
  };

  const moverMes = (delta) =>
    setAncla((a) => new Date(a.getFullYear(), a.getMonth() + delta, 1));

  const dias = useMemo(() => celdas(ancla), [ancla]);

  return (
    <div className={`datepicker ${className}`} ref={contenedor}>
      <button
        type="button"
        className={`datepicker-field${abierto ? ' is-open' : ''}`}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        onClick={() => !disabled && setAbierto((v) => !v)}
      >
        <Icon name="calendar" size={16} className="datepicker-icon" />
        <span className={value ? '' : 'datepicker-placeholder'}>
          {value ? mostrar(value) : placeholder}
        </span>
      </button>

      {allowClear && value && !disabled && (
        <button type="button" className="datepicker-clear" aria-label="Quitar fecha"
          onClick={() => onChange?.('')}>
          <Icon name="close" size={13} />
        </button>
      )}

      {abierto && caja && createPortal(
        <div className="datepicker-panel" ref={panel} style={{ position: 'fixed', ...caja }} role="dialog">
          <div className="datepicker-head">
            <button type="button" className="icon-btn sm" aria-label="Mes anterior"
              onClick={() => moverMes(-1)}><Icon name="chevronLeft" size={18} /></button>
            <span className="datepicker-month">{MESES[ancla.getMonth()]} {ancla.getFullYear()}</span>
            <button type="button" className="icon-btn sm" aria-label="Mes siguiente"
              onClick={() => moverMes(1)}><Icon name="chevronRight" size={18} /></button>
          </div>

          <div className="datepicker-grid datepicker-weekdays" aria-hidden="true">
            {DIAS.map((d, i) => <span key={i}>{d}</span>)}
          </div>

          <div className="datepicker-grid">
            {dias.map((d) => {
              const otroMes = d.getMonth() !== ancla.getMonth();
              const bloqueado = fueraDeRango(d);
              const clases = [
                'datepicker-day',
                otroMes && 'is-outside',
                mismoDia(d, seleccionada) && 'is-selected',
                mismoDia(d, hoy) && 'is-today',
              ].filter(Boolean).join(' ');
              return (
                <button key={aIso(d)} type="button" className={clases}
                  disabled={bloqueado} onClick={() => elegir(d)}>
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          <div className="datepicker-foot">
            <button type="button" className="datepicker-link" onClick={() => elegir(new Date())}>
              Hoy
            </button>
            {allowClear && (
              <button type="button" className="datepicker-link"
                onClick={() => { onChange?.(''); setAbierto(false); }}>
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
