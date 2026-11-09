// Mantenimiento de condiciones comerciales: textos fijos de la empresa que
// salen, en orden, en la sección «Condiciones comerciales» de cada PDF de
// cotización (métodos de pago, garantía, modificaciones…). Cada fila se guarda
// sola: no depende del botón «Guardar cambios» de Configuración. Una condición
// «la define el asesor» (p. ej. tiempo de entrega) usa este texto como valor
// por defecto y el asesor lo cambia en cada cotización, en «Editar borrador».
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from './Button.jsx';
import Icon from './Icon.jsx';
import {
  createQuoteCondition, deleteQuoteCondition, listQuoteConditions, updateQuoteCondition,
} from '../api/wave2.js';

let secuencia = 0;
// `key` estable para React: el id no existe hasta guardar y el índice cambia al reordenar.
const nueva = () => ({ id: null, key: `n${++secuencia}`, title: '', body: '', active: true, perQuote: false, dirty: true });
const conClave = (c) => ({ ...c, key: c.key ?? `c${c.id}` });

/** Fila válida para guardar: título y texto con contenido. */
export const conditionValid = (c) => Boolean(c.title?.trim()) && Boolean(c.body?.trim());

/** Intercambia la fila i con la de al lado (dir = -1 sube, 1 baja). */
export function moveCondition(rows, i, dir) {
  const j = i + dir;
  if (j < 0 || j >= rows.length) return rows;
  const out = [...rows];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

export default function QuoteConditionsEditor({ pushToast }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  // Acordeón: solo una abierta a la vez; las nuevas nacen abiertas.
  const [abierta, setAbierta] = useState(null);
  const alternar = (key) => setAbierta((cur) => (cur === key ? null : key));

  const cargar = () => listQuoteConditions()
    .then((list) => setRows((list || []).map((c) => conClave({ ...c, dirty: false }))))
    .catch((err) => pushToast?.(t('quoteConditions.loadFailed', 'No se pudieron cargar las condiciones: ') + err.message, 'danger'))
    .finally(() => setLoading(false));

  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (i, key, value) => setRows((cur) => cur.map((r, k) => (k === i ? { ...r, [key]: value, dirty: true } : r)));

  const guardar = async (i) => {
    const c = rows[i];
    if (!conditionValid(c)) {
      pushToast?.(t('quoteConditions.required', 'Escribe el título y el texto de la condición'), 'danger');
      return;
    }
    setBusy(true);
    try {
      const body = { title: c.title.trim(), body: c.body.trim(), active: c.active, perQuote: Boolean(c.perQuote), sortOrder: i + 1 };
      const saved = c.id ? await updateQuoteCondition(c.id, body) : await createQuoteCondition(body);
      setRows((cur) => cur.map((r, k) => (k === i ? { ...saved, key: r.key, dirty: false } : r)));
      pushToast?.(t('quoteConditions.saved', 'Condición guardada'), 'success');
    } catch (err) {
      pushToast?.(t('quoteConditions.saveFailed', 'No se pudo guardar: ') + err.message, 'danger');
    } finally {
      setBusy(false);
    }
  };

  const eliminar = async (i) => {
    const c = rows[i];
    if (!c.id) { setRows((cur) => cur.filter((_, k) => k !== i)); return; }
    setBusy(true);
    try {
      await deleteQuoteCondition(c.id);
      setRows((cur) => cur.filter((_, k) => k !== i));
    } catch (err) {
      pushToast?.(t('quoteConditions.deleteFailed', 'No se pudo eliminar: ') + err.message, 'danger');
    } finally {
      setBusy(false);
    }
  };

  // Reordenar guarda el nuevo orden de las que ya existen.
  const mover = async (i, dir) => {
    const next = moveCondition(rows, i, dir);
    if (next === rows) return;
    setRows(next);
    setBusy(true);
    try {
      await Promise.all(next.map((c, k) => (c.id && !c.dirty
        ? updateQuoteCondition(c.id, { title: c.title, body: c.body, active: c.active, perQuote: Boolean(c.perQuote), sortOrder: k + 1 })
        : null)));
    } catch (err) {
      pushToast?.(t('quoteConditions.orderFailed', 'No se pudo guardar el orden: ') + err.message, 'danger');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="muted body-small">{t('quoteConditions.loading', 'Cargando condiciones…')}</div>;

  return (
    <div className="quote-conditions">
      {rows.length === 0 && (
        <div className="muted body-small" style={{ marginBottom: 8 }}>
          {t('quoteConditions.empty', 'Sin condiciones. Agrega, por ejemplo, «Métodos de pago», «Garantía» o «Modificaciones».')}
        </div>
      )}
      {rows.map((c, i) => {
        const open = abierta === c.key;
        return (
          <div key={c.key} className={`quote-condition${open ? ' is-open' : ''}${c.active ? '' : ' is-inactive'}`}>
            <div className="quote-condition-head">
              <button type="button" className="quote-condition-toggle" aria-expanded={open} onClick={() => alternar(c.key)}>
                <Icon name={open ? 'chevronDown' : 'chevronRight'} size={16} />
                <span className="quote-condition-order">{i + 1}.</span>
                <span className="quote-condition-title">{c.title?.trim() || t('quoteConditions.new', 'Nueva condición')}</span>
                {!c.active && <span className="badge-m3">{t('quoteConditions.inactive', 'Inactiva')}</span>}
                {c.perQuote && <span className="badge-m3 accent">{t('quoteConditions.perQuoteBadge', 'Por cotización')}</span>}
                {c.dirty && <span className="quote-condition-dirty" title={t('quoteConditions.unsaved', 'Cambios sin guardar')}>●</span>}
              </button>
              <div className="quote-condition-actions">
                <button type="button" className="icon-btn" aria-label={t('quoteConditions.moveUp', 'Subir')} disabled={busy || i === 0} onClick={() => mover(i, -1)}>
                  <Icon name="chevronUp" size={14} />
                </button>
                <button type="button" className="icon-btn" aria-label={t('quoteConditions.moveDown', 'Bajar')} disabled={busy || i === rows.length - 1} onClick={() => mover(i, 1)}>
                  <Icon name="chevronDown" size={14} />
                </button>
                <button type="button" className="icon-btn" aria-label={t('quoteConditions.delete', 'Eliminar')} disabled={busy} onClick={() => eliminar(i)}>
                  <Icon name="close" size={14} />
                </button>
              </div>
            </div>
            {!open && c.body?.trim() && <div className="quote-condition-preview">{c.body}</div>}
            {open && (
              <div className="quote-condition-fields">
                <input className="field-input" placeholder={t('quoteConditions.titlePlaceholder', 'Título (p. ej. Garantía)')} maxLength={80}
                  value={c.title} onChange={(e) => set(i, 'title', e.target.value)} />
                <textarea className="field-input" rows={3} maxLength={1000}
                  placeholder={c.perQuote
                    ? t('quoteConditions.defaultPlaceholder', 'Valor por defecto (el asesor lo cambia en cada cotización)')
                    : t('quoteConditions.bodyPlaceholder', 'Texto que sale en el PDF')}
                  value={c.body} onChange={(e) => set(i, 'body', e.target.value)} />
                <div className="quote-condition-foot">
                  <label className="body-small" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="checkbox" checked={c.active} onChange={(e) => set(i, 'active', e.target.checked)} />
                    {t('quoteConditions.active', 'Activa (sale en el PDF)')}
                  </label>
                  <label className="body-small" style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    title={t('quoteConditions.perQuoteHint', 'Cada cotización nace con este texto y el asesor lo cambia en «Editar borrador».')}>
                    <input type="checkbox" checked={Boolean(c.perQuote)} onChange={(e) => set(i, 'perQuote', e.target.checked)} />
                    {t('quoteConditions.perQuote', 'La define el asesor en cada cotización')}
                  </label>
                  <Button type="button" size="sm" variant={c.dirty ? 'accent' : 'outlined'} disabled={busy || !c.dirty}
                    onClick={() => guardar(i)}>
                    {c.dirty ? t('quoteConditions.save', 'Guardar') : t('quoteConditions.savedShort', 'Guardada')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
      <Button type="button" icon="plus" size="sm" disabled={busy} onClick={() => { const n = nueva(); setRows((cur) => [...cur, n]); setAbierta(n.key); }}>
        {t('quoteConditions.add', 'Agregar condición')}
      </Button>
    </div>
  );
}
