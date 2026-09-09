// Editor de permisos por opción de menú.
//
// Son 33 opciones × 4 acciones = 132 casillas. Una tabla plana con eso es
// inusable: nadie la configura y todos terminan con «Administrador». De ahí
// las tres cosas de esta pantalla —secciones plegables, casilla de sección de
// tres estados y preajustes— que existen para que el caso normal sean dos
// clics y no veintiocho.
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from './Icon.jsx';
import {
  PERM_SECTIONS, ACTIONS, PRESETS, aplicarPreset, PERM_IDS,
} from '../lib/permissions.js';

/** Casilla de tres estados: marcada, indeterminada o vacía. */
function Casilla({ estado, onChange, title }) {
  return (
    <input
      type="checkbox"
      checked={estado === 'todo'}
      title={title}
      // `indeterminate` no es un atributo, solo existe como propiedad del DOM:
      // hay que ponerlo por ref o React no lo pinta.
      ref={(el) => { if (el) el.indeterminate = estado === 'parcial'; }}
      onChange={onChange}
      className="perm-check"
    />
  );
}

export default function PermissionMatrix({ matriz, onChange, readOnly = false }) {
  const { t } = useTranslation();
  const [abiertas, setAbiertas] = useState(() => new Set());

  const visibles = PERM_IDS.filter((id) => matriz[id]?.ver).length;

  const estadoSeccion = (items, accion) => {
    const ids = items.filter((i) => !i.exento).map((i) => i.id);
    const n = ids.filter((id) => matriz[id]?.[accion]).length;
    if (n === 0) return 'nada';
    return n === ids.length ? 'todo' : 'parcial';
  };

  const alternarCelda = (id, accion) => {
    if (readOnly) return;
    const fila = { ...matriz[id], [accion]: !matriz[id]?.[accion] };
    // Sin `ver` el módulo no aparece, así que las demás acciones no se pueden
    // ejercer: se apagan en vez de dejar un permiso que no se puede cumplir.
    if (accion === 'ver' && !fila.ver) {
      ACTIONS.forEach((a) => { fila[a] = false; });
    }
    // Y al revés: marcar cualquier acción implica poder ver el módulo.
    if (accion !== 'ver' && fila[accion]) fila.ver = true;
    onChange({ ...matriz, [id]: fila });
  };

  const alternarSeccion = (items, accion) => {
    if (readOnly) return;
    const ids = items.filter((i) => !i.exento).map((i) => i.id);
    const encender = estadoSeccion(items, accion) !== 'todo';
    const siguiente = { ...matriz };
    ids.forEach((id) => {
      const fila = { ...siguiente[id], [accion]: encender };
      if (accion === 'ver' && !encender) ACTIONS.forEach((a) => { fila[a] = false; });
      if (accion !== 'ver' && encender) fila.ver = true;
      siguiente[id] = fila;
    });
    onChange(siguiente);
  };

  return (
    <div className="perm-matrix">
      <div className="perm-head">
        <span className="perm-count">
          {t('users.visibleCount', '{{n}} de {{total}} opciones visibles',
             { n: visibles, total: PERM_IDS.length })}
        </span>
        {!readOnly && (
          <div className="perm-presets">
            <span className="perm-presets-label">{t('users.startFrom', 'Partir de')}</span>
            {PRESETS.map((p) => (
              <button key={p.id} type="button" className="perm-preset"
                onClick={() => onChange(aplicarPreset(p))}>
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="perm-cols">
        <span />
        {ACTIONS.map((a) => <span key={a} className="perm-col">{a}</span>)}
      </div>

      {PERM_SECTIONS.map(({ section, items }) => {
        const abierta = abiertas.has(section);
        const ids = items.filter((i) => !i.exento).map((i) => i.id);
        const conVer = ids.filter((id) => matriz[id]?.ver).length;

        return (
          <div key={section} className="perm-section">
            <div className="perm-section-head">
              <button type="button" className="perm-section-toggle"
                aria-expanded={abierta}
                onClick={() => setAbiertas((prev) => {
                  const s = new Set(prev);
                  s.has(section) ? s.delete(section) : s.add(section);
                  return s;
                })}>
                <Icon name={abierta ? 'chevronDown' : 'chevronRight'} size={14} />
                <span className="perm-section-name">{section}</span>
                {/* El contador es lo que permite dejarlas plegadas: de un
                    vistazo se ve qué tiene el rol sin abrir nada. */}
                <span className="perm-section-count">{conVer}/{ids.length}</span>
              </button>
              {ACTIONS.map((a) => (
                <Casilla key={a} estado={estadoSeccion(items, a)}
                  title={`${a} · toda la sección`}
                  onChange={() => alternarSeccion(items, a)} />
              ))}
            </div>

            {abierta && items.map((item) => (
              <div key={item.id} className="perm-row">
                <span className="perm-item">{item.label}</span>
                {item.exento ? (
                  <span className="perm-always">{t('users.alwaysVisible', 'siempre visible')}</span>
                ) : ACTIONS.map((a) => (
                  <input key={a} type="checkbox" className="perm-check"
                    checked={!!matriz[item.id]?.[a]}
                    // Sin `ver` las demás no aplican: se atenúan en vez de
                    // dejar marcar algo que no tendría efecto.
                    disabled={readOnly || (a !== 'ver' && !matriz[item.id]?.ver)}
                    onChange={() => alternarCelda(item.id, a)} />
                ))}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
