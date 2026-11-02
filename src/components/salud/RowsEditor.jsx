// Editor de filas para las listas del paciente (alergias, antecedentes,
// medicamentos, vacunas, contactos de emergencia). Cada lista declara sus
// campos; el editor pinta una tarjeta por fila con su botón de quitar.
import React from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../Button.jsx';
import Autocomplete from '../Autocomplete.jsx';
import DatePicker from '../DatePicker.jsx';

/**
 * @param {object[]} rows      filas actuales
 * @param {function} onChange  (filas) => void
 * @param {object[]} fields    [{ key, label, type: 'text'|'select'|'date', options, required, wide }]
 * @param {function} newRow    () => fila vacía
 * @param {string}   addLabel  texto del botón agregar
 * @param {string}   empty     texto cuando no hay filas
 * @param {boolean}  readOnly
 */
export default function RowsEditor({ rows = [], onChange, fields, newRow, addLabel, empty, readOnly = false }) {
  const { t } = useTranslation();
  const set = (i, key, value) => onChange(rows.map((r, j) => (j === i ? { ...r, [key]: value } : r)));
  const remove = (i) => onChange(rows.filter((_, j) => j !== i));

  return (
    <div className="salud-rows">
      {rows.length === 0 && <div className="salud-rows-empty muted">{empty}</div>}
      {rows.map((row, i) => (
        <div key={i} className="salud-row">
          <div className="form-grid salud-row-fields">
            {fields.map((f) => (
              <div key={f.key} className={`field-group${f.wide ? ' span-2' : ''}`}>
                <label className="field-label">{f.label}{f.required ? ' *' : ''}</label>
                {f.type === 'select' ? (
                  <Autocomplete value={row[f.key] ?? ''}
                    onChange={(id) => set(i, f.key, id == null ? '' : String(id))}
                    options={f.options}
                    allowClear={!f.required}
                    disabled={readOnly}
                    emptyText={t('common.noMatches', 'Sin coincidencias')}
                    aria-label={f.label} />
                ) : f.type === 'date' ? (
                  <DatePicker value={row[f.key] ?? ''} onChange={(iso) => set(i, f.key, iso)} disabled={readOnly} />
                ) : (
                  <input className="field-input" value={row[f.key] ?? ''} disabled={readOnly}
                    aria-label={f.label}
                    onChange={(e) => set(i, f.key, e.target.value)} />
                )}
              </div>
            ))}
          </div>
          {!readOnly && (
            <Button variant="icon" icon="trash" type="button"
              title={t('common.remove', 'Quitar')} aria-label={t('common.remove', 'Quitar')}
              onClick={() => remove(i)} />
          )}
        </div>
      ))}
      {!readOnly && (
        <div>
          <Button icon="plus" variant="tonal" type="button" onClick={() => onChange([...rows, newRow()])}>{addLabel}</Button>
        </div>
      )}
    </div>
  );
}
