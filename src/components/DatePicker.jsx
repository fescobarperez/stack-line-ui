// DatePicker — selector de fecha propio.
//
// Reemplaza a <input type="date">, que se dibuja distinto en cada navegador:
// Chrome pinta su icono de calendario, Firefox otro y Safari casi nada, y el
// texto "dd/mm/aaaa" se mide diferente en cada uno. Con quince en el sistema,
// ninguna pantalla quedaba alineada.
//
// Para llegar rápido a una fecha lejana: el nombre del mes abre los doce
// meses, el año abre una docena de años, y arriba se puede escribir la fecha
// («15/11/2026», «15/11», «hoy», «mañana»).
//
// Misma firma que un input controlado: `value` en ISO (YYYY-MM-DD) y
// `onChange(iso)`. Devuelve '' al limpiar, no null, para que el consumidor no
// tenga que distinguir entre «sin fecha» y «campo vacío».
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon.jsx';

/** Semana de domingo a sábado, como el calendario de pared (y la vista de mes de la agenda). */
const DIAS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
/** Años por página en la vista de años (rejilla de 3 × 4). */
const ANIOS = 12;

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

/** Domingo de la semana en que cae el día 1, para arrancar la rejilla. */
function celdas(ancla) {
  const primero = new Date(ancla.getFullYear(), ancla.getMonth(), 1);
  const desplazamiento = primero.getDay();   // getDay(): 0 = domingo
  const inicio = new Date(primero);
  inicio.setDate(primero.getDate() - desplazamiento);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    return d;
  });
}

/**
 * Lo que alguien escribe → Date, o null si no es una fecha real.
 * «15/11/2026» · «15-11-26» · «15.11.2026» · «15112026» · «15/11» (este año)
 * · «hoy» · «mañana» · «ayer».
 */
export function leerFecha(texto, hoy = new Date()) {
  const t = String(texto || '').trim().toLowerCase();
  if (!t) return null;
  const base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const relativos = { hoy: 0, 'mañana': 1, manana: 1, ayer: -1 };
  if (t in relativos) {
    base.setDate(base.getDate() + relativos[t]);
    return base;
  }
  let d; let m; let a;
  const compacto = /^(\d{2})(\d{2})(\d{4})$/.exec(t);
  const partes = /^(\d{1,2})[/.\- ](\d{1,2})(?:[/.\- ](\d{2}|\d{4}))?$/.exec(t);
  if (compacto) [, d, m, a] = compacto;
  else if (partes) [, d, m, a] = partes;
  else return null;
  let anio = a == null ? base.getFullYear() : Number(a);
  if (a != null && a.length === 2) anio += 2000;
  const fecha = new Date(anio, Number(m) - 1, Number(d));
  // 31/02 se convertiría en 3 de marzo: no es una fecha real.
  if (fecha.getDate() !== Number(d) || fecha.getMonth() !== Number(m) - 1) return null;
  return fecha;
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
  const [vista, setVista] = useState('dias'); // 'dias' | 'meses' | 'anios'
  const [caja, setCaja] = useState(null);
  const [ancla, setAncla] = useState(() => desdeIso(value) || new Date());
  const [escrito, setEscrito] = useState('');
  const [error, setError] = useState(false);
  const contenedor = useRef(null);
  const panel = useRef(null);

  const seleccionada = useMemo(() => desdeIso(value), [value]);
  const hoy = useMemo(() => new Date(), []);
  const limiteMin = useMemo(() => desdeIso(min), [min]);
  const limiteMax = useMemo(() => desdeIso(max), [max]);

  // Al abrir, el mes mostrado arranca en el de la fecha elegida, en vista de días.
  useEffect(() => {
    if (!abierto) return;
    setAncla(desdeIso(value) || new Date());
    setVista('dias');
    setEscrito('');
    setError(false);
  }, [abierto, value]);

  /**
   * El panel va por portal a document.body, igual que la lista del
   * Autocomplete: dentro de un contenedor con overflow, un hijo absoluto se
   * recorta y ningún z-index lo salva. El precio es recalcular la posición
   * mientras esté abierto.
   */
  useEffect(() => {
    if (!abierto) return undefined;
    const medir = () => {
      const el = contenedor.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const debajo = window.innerHeight - r.bottom;
      const arriba = placement === 'up' ? true
        : placement === 'down' ? false
        : debajo < 400 && r.top > debajo;
      setCaja({
        // Sin salirse de la pantalla en un teléfono angosto.
        left: Math.max(8, Math.min(r.left, window.innerWidth - 308)),
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
      if (contenedor.current?.contains(e.target)) return;
      if (panel.current?.contains(e.target)) return;
      setAbierto(false);
    };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, [abierto]);

  // Escape vuelve un nivel (años → meses → días) antes de cerrar.
  useEffect(() => {
    if (!abierto) return undefined;
    const escape = (e) => {
      if (e.key !== 'Escape') return;
      if (vista === 'dias') setAbierto(false);
      else setVista(vista === 'anios' ? 'meses' : 'dias');
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [abierto, vista]);

  const fueraDeRango = useCallback((d) => {
    if (limiteMin && d < limiteMin && !mismoDia(d, limiteMin)) return true;
    if (limiteMax && d > limiteMax && !mismoDia(d, limiteMax)) return true;
    return false;
  }, [limiteMin, limiteMax]);

  /** Un mes (o un año) se puede elegir si algún día suyo queda en el rango. */
  const mesFuera = (anio, mes) =>
    !!((limiteMin && new Date(anio, mes + 1, 0) < limiteMin) || (limiteMax && new Date(anio, mes, 1) > limiteMax));
  const anioFuera = (anio) =>
    !!((limiteMin && anio < limiteMin.getFullYear()) || (limiteMax && anio > limiteMax.getFullYear()));

  const elegir = (d) => {
    if (fueraDeRango(d)) return;
    onChange?.(aIso(d));
    setAbierto(false);
  };

  /** Las flechas avanzan lo que se está viendo: un mes, un año o una docena de años. */
  const mover = (delta) => setAncla((a) => {
    if (vista === 'meses') return new Date(a.getFullYear() + delta, a.getMonth(), 1);
    if (vista === 'anios') return new Date(a.getFullYear() + delta * ANIOS, a.getMonth(), 1);
    return new Date(a.getFullYear(), a.getMonth() + delta, 1);
  });

  const irAMes = (mes) => { setAncla((a) => new Date(a.getFullYear(), mes, 1)); setVista('dias'); };
  const irAAnio = (anio) => { setAncla((a) => new Date(anio, a.getMonth(), 1)); setVista('meses'); };

  const escribir = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const f = leerFecha(escrito, hoy);
    if (!f || fueraDeRango(f)) { setError(true); return; }
    elegir(f);
  };

  const dias = useMemo(() => celdas(ancla), [ancla]);
  const primerAnio = ancla.getFullYear() - (ancla.getFullYear() % ANIOS);
  const etiquetaMover = vista === 'dias' ? 'mes' : vista === 'meses' ? 'año' : 'grupo de años';

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
        <div className="datepicker-panel" ref={panel} style={{ position: 'fixed', ...caja }} role="dialog"
          aria-label={ariaLabel || 'Elegir fecha'}>
          <input
            className={`datepicker-type${error ? ' is-error' : ''}`}
            value={escrito}
            placeholder="Escribe la fecha: 15/11/2026, hoy…"
            aria-label="Escribir fecha"
            aria-invalid={error}
            onChange={(e) => { setEscrito(e.target.value); setError(false); }}
            onKeyDown={escribir}
          />
          {error && (
            <div className="datepicker-error" role="alert">
              Fecha no válida{limiteMin || limiteMax ? ' o fuera del rango permitido' : ''}
            </div>
          )}

          <div className="datepicker-head">
            <button type="button" className="icon-btn sm" aria-label={`Anterior ${etiquetaMover}`}
              onClick={() => mover(-1)}><Icon name="chevronLeft" size={18} /></button>
            <div className="datepicker-titles">
              {vista === 'anios' ? (
                <span className="datepicker-range">{primerAnio} – {primerAnio + ANIOS - 1}</span>
              ) : (
                <>
                  {vista === 'dias' && (
                    <button type="button" className="datepicker-title-btn" aria-label="Elegir mes"
                      onClick={() => setVista('meses')}>
                      {MESES[ancla.getMonth()]}
                    </button>
                  )}
                  <button type="button" className="datepicker-title-btn" aria-label="Elegir año"
                    onClick={() => setVista('anios')}>
                    {ancla.getFullYear()}
                    <Icon name="chevronDown" size={16} />
                  </button>
                </>
              )}
            </div>
            <button type="button" className="icon-btn sm" aria-label={`Siguiente ${etiquetaMover}`}
              onClick={() => mover(1)}><Icon name="chevronRight" size={18} /></button>
          </div>

          {vista === 'dias' && (
            <>
              <div className="datepicker-grid datepicker-weekdays" aria-hidden="true">
                {DIAS.map((d, i) => <span key={i} className={i === 0 || i === 6 ? 'is-weekend' : ''}>{d}</span>)}
              </div>
              <div className="datepicker-grid">
                {dias.map((d) => {
                  const otroMes = d.getMonth() !== ancla.getMonth();
                  const elegido = mismoDia(d, seleccionada) || false;
                  const clases = [
                    'datepicker-day',
                    otroMes ? 'is-outside' : 'is-current',
                    elegido && 'is-selected',
                    mismoDia(d, hoy) && 'is-today',
                  ].filter(Boolean).join(' ');
                  return (
                    <button key={aIso(d)} type="button" className={clases}
                      disabled={fueraDeRango(d)} onClick={() => elegir(d)}
                      aria-label={`${d.getDate()} de ${MESES[d.getMonth()].toLowerCase()} de ${d.getFullYear()}`}
                      aria-pressed={elegido}>
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {vista === 'meses' && (
            <div className="datepicker-cells">
              {MESES_CORTOS.map((nombre, mes) => {
                const anio = ancla.getFullYear();
                const clases = [
                  'datepicker-cell',
                  seleccionada?.getFullYear() === anio && seleccionada?.getMonth() === mes && 'is-selected',
                  hoy.getFullYear() === anio && hoy.getMonth() === mes && 'is-today',
                ].filter(Boolean).join(' ');
                return (
                  <button key={mes} type="button" className={clases} disabled={mesFuera(anio, mes)}
                    aria-label={`${MESES[mes]} ${anio}`} onClick={() => irAMes(mes)}>
                    {nombre}
                  </button>
                );
              })}
            </div>
          )}

          {vista === 'anios' && (
            <div className="datepicker-cells">
              {Array.from({ length: ANIOS }, (_, i) => primerAnio + i).map((anio) => {
                const clases = [
                  'datepicker-cell',
                  seleccionada?.getFullYear() === anio && 'is-selected',
                  hoy.getFullYear() === anio && 'is-today',
                ].filter(Boolean).join(' ');
                return (
                  <button key={anio} type="button" className={clases} disabled={anioFuera(anio)}
                    onClick={() => irAAnio(anio)}>
                    {anio}
                  </button>
                );
              })}
            </div>
          )}

          <div className="datepicker-foot">
            {vista !== 'dias' && (
              <button type="button" className="datepicker-link" onClick={() => setVista('dias')}>
                <Icon name="chevronLeft" size={14} /> Días
              </button>
            )}
            <span className="datepicker-spacer" />
            <button type="button" className="datepicker-link" disabled={fueraDeRango(hoy)} onClick={() => elegir(new Date())}>
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
