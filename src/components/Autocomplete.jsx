// Selector con búsqueda por escritura.
//
// Sustituye a un <select> cuando la lista es larga: con treinta proveedores,
// desplegar y buscar con la vista es más lento que teclear tres letras.
//
// Mantiene la firma de un select controlado —`value` es el id, `onChange`
// recibe el id— para poder sustituir uno sin tocar el estado alrededor.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon.jsx';

export default function Autocomplete({
  value,                    // id seleccionado
  onChange,                 // (id) => void · '' al limpiar
  options = [],             // [{ id, name }]
  placeholder = 'Buscar…',
  emptyText = 'Sin coincidencias',
  disabled = false,
  // Un campo obligatorio con valor fijo —un enumerado— no debe poder quedarse
  // vacío: ahí la «x» solo ofrece un estado inválido.
  allowClear = true,
  /**
   * Hacia dónde se abre la lista: 'auto' mide el hueco, 'up' y 'down' lo
   * fuerzan. Dentro de un contenedor con scroll conviene forzar 'up': el
   * control suele estar al final y hacia abajo la lista se recorta.
   */
  placement = 'auto',
  className = '',
  'aria-label': ariaLabel,
}) {
  const [abierto, setAbierto] = useState(false);
  const [consulta, setConsulta] = useState('');
  const [resaltado, setResaltado] = useState(0);
  const [haciaArriba, setHaciaArriba] = useState(false);
  const [caja, setCaja] = useState(null);   // posición fija de la lista
  const contenedor = useRef(null);
  const lista = useRef(null);

  const seleccionado = useMemo(
    () => options.find((o) => String(o.id) === String(value)) || null,
    [options, value],
  );

  const filtradas = useMemo(() => {
    const q = consulta.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, consulta]);

  // Cerrar al pulsar fuera. Sin esto la lista se queda abierta al pasar a
  // otro campo y tapa el contenido de abajo.
  useEffect(() => {
    if (!abierto) return;
    const alPulsar = (e) => {
      if (contenedor.current?.contains(e.target)) return;
      // La lista ya no está dentro del control: sin esto, pulsar en ella
      // contaría como «fuera» y se cerraría antes de elegir.
      if (lista.current?.contains(e.target)) return;
      cerrar();
    };
    document.addEventListener('mousedown', alPulsar);
    return () => document.removeEventListener('mousedown', alPulsar);
  }, [abierto]);

  /**
   * La lista se dibuja en un portal sobre <body>, no dentro del control.
   *
   * Es la única forma de que no la recorte el contenedor: un ancestro con
   * `overflow` corta a sus hijos posicionados por muy alto que sea su
   * z-index, así que subirlo no arreglaba nada. Fuera del contenedor, con
   * posición fija, no hay nada que la recorte.
   *
   * El precio es que la posición hay que calcularla y rehacerla mientras
   * esté abierta: al desplazar cualquier ancestro, la lista se quedaría
   * flotando donde estaba.
   */
  useEffect(() => {
    if (!abierto) return;

    const medir = () => {
      const el = contenedor.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const debajo = window.innerHeight - r.bottom;
      const encima = r.top;
      const arriba = placement === 'up'
        ? true
        : placement === 'down'
          ? false
          : debajo < 240 && encima > debajo;
      setHaciaArriba(arriba);
      setCaja({
        left: r.left,
        width: r.width,
        // Al abrir hacia arriba se ancla por abajo, para que la lista crezca
        // alejándose del campo en vez de taparlo.
        ...(arriba
          ? { bottom: window.innerHeight - r.top + 4, maxHeight: Math.max(120, encima - 12) }
          : { top: r.bottom + 4, maxHeight: Math.max(120, debajo - 12) }),
      });
    };

    medir();
    // `true` para capturar también el scroll de contenedores internos, que
    // no burbujea hasta window.
    window.addEventListener('scroll', medir, true);
    window.addEventListener('resize', medir);
    return () => {
      window.removeEventListener('scroll', medir, true);
      window.removeEventListener('resize', medir);
    };
  }, [abierto, placement, filtradas.length]);

  const cerrar = () => { setAbierto(false); setConsulta(''); setResaltado(0); };

  const elegir = (opcion) => { onChange(String(opcion.id)); cerrar(); };

  const alTeclear = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!abierto) { setAbierto(true); return; }
      const paso = e.key === 'ArrowDown' ? 1 : -1;
      setResaltado((i) => (i + paso + filtradas.length) % Math.max(filtradas.length, 1));
      return;
    }
    if (e.key === 'Enter' && abierto) {
      e.preventDefault();
      if (filtradas[resaltado]) elegir(filtradas[resaltado]);
      return;
    }
    if (e.key === 'Escape' && abierto) { e.preventDefault(); cerrar(); }
  };

  // Mientras está abierto se muestra lo tecleado; cerrado, el nombre elegido.
  // Así el usuario ve siempre qué hay seleccionado sin tener que reabrir.
  const textoVisible = abierto ? consulta : (seleccionado?.name || '');

  return (
    <div className={`autocomplete ${className}`} ref={contenedor}>
      <input
        className="input autocomplete-input"
        type="text"
        role="combobox"
        aria-expanded={abierto}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        disabled={disabled}
        placeholder={seleccionado && !abierto ? seleccionado.name : placeholder}
        value={textoVisible}
        onFocus={() => setAbierto(true)}
        onChange={(e) => { setConsulta(e.target.value); setAbierto(true); setResaltado(0); }}
        onKeyDown={alTeclear}
      />

      {seleccionado && !disabled && allowClear ? (
        <button type="button" className="autocomplete-clear" aria-label="Quitar selección"
          onMouseDown={(e) => { e.preventDefault(); onChange(''); cerrar(); }}>
          <Icon name="x" size={14} />
        </button>
      ) : (
        <Icon name="chevronDown" size={16} className="autocomplete-caret" />
      )}

      {abierto && caja && createPortal(
        <ul
          ref={lista}
          className="autocomplete-list"
          role="listbox"
          style={{ position: 'fixed', ...caja }}
        >
          {filtradas.length === 0 && <li className="autocomplete-empty">{emptyText}</li>}
          {filtradas.map((o, i) => (
            <li
              key={o.id}
              role="option"
              aria-selected={String(o.id) === String(value)}
              className={`autocomplete-option${i === resaltado ? ' is-active' : ''}${String(o.id) === String(value) ? ' is-selected' : ''}`}
              // onMouseDown y no onClick: el clic quitaría el foco del input
              // y el cierre por «pulsar fuera» se adelantaría a la selección.
              onMouseDown={(e) => { e.preventDefault(); elegir(o); }}
              onMouseEnter={() => setResaltado(i)}
            >
              {o.name}
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </div>
  );
}
