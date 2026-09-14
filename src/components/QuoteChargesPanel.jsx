// Gastos / cargos de la cotización (modelo cotización-céntrico).
// Muestra el gasto de materiales (auto, derivado de las líneas) + los cargos
// manuales (fixed / percent sobre el subtotal de costo), y permite agregarlos
// y eliminarlos. Cada operación devuelve el resumen recalculado del backend.
import React, { useEffect, useState, useCallback } from 'react';
import Button from './Button.jsx';
import Icon from './Icon.jsx';
import { getQuoteCharges, addQuoteCharge, deleteQuoteCharge, listChargeCategories,
  setQuoteOperatingMode, setQuoteOperatingAmount, setQuoteOperatingPct } from '../api/wave2.js';
import Autocomplete from './Autocomplete.jsx';
import { useTranslation } from 'react-i18next';

const Q = (n) => `Q ${Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function QuoteChargesPanel({ quoteId, canEdit = true, pushToast, onChargesChange, onSummaryChange }) {
  const { t } = useTranslation();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ calcType: 'fixed', categoryId: '', description: '', value: '' });
  // El catálogo reemplaza al input de texto libre: sin él no se podía sumar
  // por concepto ni comparar la estructura de costo entre cotizaciones.
  const [categorias, setCategorias] = useState([]);
  const [montoOperativo, setMontoOperativo] = useState('');
  const [pctOperativo, setPctOperativo] = useState('');
  // El bloque nace plegado: la tabla debe leerse como resumen de la
  // cotización, no como el formulario de captura de los gastos.
  const [opAbierto, setOpAbierto] = useState(false);
  const [partida, setPartida] = useState({ categoryId: '', description: '', calcType: 'fixed', value: '' });
  const setPa = (k, v) => setPartida((f) => ({ ...f, [k]: v }));
  useEffect(() => {
    let vigente = true;
    listChargeCategories()
      .then((rows) => { if (vigente) setCategorias(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (vigente) setCategorias([]); });
    return () => { vigente = false; };
  }, []);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await getQuoteCharges(quoteId);
      setSummary(next);
      onSummaryChange?.(next);
    }
    catch (err) { pushToast?.(t('quotes.chargesError', 'No se pudieron cargar los gastos: ') + err.message, 'danger'); }
    finally { setLoading(false); }
  }, [onSummaryChange, quoteId, pushToast, t]);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    const value = parseFloat(form.value);
    if (!form.description.trim()) { pushToast?.(t('quotes.chargeDescRequired', 'Indica una descripción'), 'danger'); return; }
    if (!(value >= 0)) { pushToast?.(t('quotes.chargeValueRequired', 'Indica un valor válido'), 'danger'); return; }
    setBusy(true);
    try {
      const res = await addQuoteCharge(quoteId, {
        calcType: form.calcType,
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        description: form.description.trim(),
        value,
      });
      setSummary(res);
      onChargesChange?.();
      onSummaryChange?.(res);
      setForm({ calcType: 'fixed', categoryId: '', description: '', value: '' });
    } catch (err) {
      pushToast?.(t('quotes.chargeAddFailed', 'No se pudo agregar el gasto: ') + err.message, 'danger');
    } finally { setBusy(false); }
  };

  const remove = async (chargeId) => {
    setBusy(true);
    try {
      const next = await deleteQuoteCharge(quoteId, chargeId);
      setSummary(next);
      onSummaryChange?.(next);
      onChargesChange?.();
    }
    catch (err) { pushToast?.(t('quotes.chargeDelFailed', 'No se pudo eliminar el gasto: ') + err.message, 'danger'); }
    finally { setBusy(false); }
  };

  const modo = ['detailed', 'percent'].includes(summary?.operatingExpenseMode)
    ? summary.operatingExpenseMode : 'single';
  const partidasOperativas = (summary?.charges || []).filter((c) => c.operating);
  const otrosCargos = (summary?.charges || []).filter((c) => !c.operating);

  const cambiarModo = async (siguiente) => {
    if (siguiente === modo) return;
    setBusy(true);
    try {
      const next = await setQuoteOperatingMode(quoteId, siguiente);
      setSummary(next);
      onSummaryChange?.(next);
      onChargesChange?.();
    } catch (err) {
      pushToast?.(t('quotes.opModeFailed', 'No se pudo cambiar el modo: ') + err.message, 'danger');
    } finally { setBusy(false); }
  };

  const guardarPctOperativo = async () => {
    const pct = parseFloat(pctOperativo);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      pushToast?.(t('quotes.opPctRange', 'El porcentaje debe estar entre 0 y 100'), 'danger');
      return;
    }
    setBusy(true);
    try {
      const next = await setQuoteOperatingPct(quoteId, pct);
      setSummary(next);
      setPctOperativo('');
      onSummaryChange?.(next);
      onChargesChange?.();
    } catch (err) {
      pushToast?.(t('quotes.opPctFailed', 'No se pudo guardar el porcentaje: ') + err.message, 'danger');
    } finally { setBusy(false); }
  };

  const guardarMontoOperativo = async () => {
    const monto = parseFloat(montoOperativo);
    if (!Number.isFinite(monto) || monto < 0) {
      pushToast?.(t('quotes.opAmountRequired', 'Indica un monto válido'), 'danger');
      return;
    }
    setBusy(true);
    try {
      const next = await setQuoteOperatingAmount(quoteId, monto);
      setSummary(next);
      setMontoOperativo('');
      onSummaryChange?.(next);
      onChargesChange?.();
    } catch (err) {
      pushToast?.(t('quotes.opAmountFailed', 'No se pudo guardar el gasto operativo: ') + err.message, 'danger');
    } finally { setBusy(false); }
  };

  const conceptosOperativos = categorias.filter((c) => c.operating);

  /** Agrega una partida al desglose sin salir del bloque. */
  const agregarPartida = async () => {
    if (!partida.categoryId) { pushToast?.(t('quotes.opCatRequired', 'Elige el concepto de la partida'), 'danger'); return; }
    const valor = parseFloat(partida.value);
    if (!(valor > 0)) { pushToast?.(t('quotes.opValueRequired', 'Indica un monto mayor a cero'), 'danger'); return; }
    setBusy(true);
    try {
      const concepto = conceptosOperativos.find((c) => String(c.id) === String(partida.categoryId));
      const next = await addQuoteCharge(quoteId, {
        categoryId: Number(partida.categoryId),
        // Sin descripción propia se usa el nombre del concepto: la columna es
        // NOT NULL y obligar a repetir "Energía eléctrica" no aporta nada.
        description: partida.description.trim() || concepto?.name || 'Gasto operativo',
        calcType: partida.calcType,
        value: valor,
        sortOrder: 5,
      });
      setSummary(next);
      setPartida({ categoryId: '', description: '', calcType: 'fixed', value: '' });
      onSummaryChange?.(next);
      onChargesChange?.();
    } catch (err) {
      pushToast?.(t('quotes.opAddFailed', 'No se pudo agregar la partida: ') + err.message, 'danger');
    } finally { setBusy(false); }
  };

  if (loading) return <div className="muted" style={{ fontSize: 12, padding: '8px 0' }}>{t('common.loading', 'Cargando…')}</div>;
  if (!summary) return null;

  /**
   * Captura del gasto operativo: el monto único o el alta de partidas.
   *
   * Se arma aquí y no dentro del JSX de la tabla para no anidar dos ternarios
   * dentro de un <td>, que es donde esto se vuelve ilegible.
   */
  const contenidoCaptura = !canEdit ? null : modo === 'percent' ? (
    <div className="quote-op-box">
      <div className="quote-op-box-title">{t('quotes.opPctTitle', 'Gasto operativo como porcentaje del subtotal')}</div>
      <div className="quote-op-form is-single">
        <div className="field-group">
          <label className="field-label">%</label>
          <input className="field-input mono" type="number" min="0" max="100" step="0.01"
            placeholder={Number(summary.operatingExpensePct || 0).toFixed(2)}
            value={pctOperativo} onChange={(e) => setPctOperativo(e.target.value)} />
        </div>
        <Button size="sm" icon="check" onClick={guardarPctOperativo} disabled={busy}>
          {t('quotes.opSave', 'Guardar')}
        </Button>
      </div>
      <div className="cfg-hint">
        {t('quotes.opPctHint', 'Se recalcula solo cuando cambian las líneas de la cotización. Las partidas capturadas quedan guardadas pero no suman mientras esté en este modo.')}
      </div>
    </div>
  ) : modo === 'single' ? (
          <div className="quote-op-box">
            <div className="quote-op-box-title">{t('quotes.operating', 'Gastos operativos')}</div>
            <div className="quote-op-form is-single">
              <div className="field-group">
                <label className="field-label">{t('projects.amount', 'Monto')}</label>
                <input className="field-input mono" type="number" min="0" step="0.01"
                  placeholder={Number(summary.operatingExpenses) > 0 ? String(summary.operatingExpenses) : '0.00'}
                  value={montoOperativo} onChange={(e) => setMontoOperativo(e.target.value)} />
              </div>
              <Button size="sm" icon="check" onClick={guardarMontoOperativo} disabled={busy}>
                {t('quotes.opSave', 'Guardar')}
              </Button>
            </div>
          </div>
  ) : (
          <div className="quote-op-box">
            <div className="quote-op-box-title">{t('quotes.opAddTitle', 'Agregar partida de gasto operativo')}</div>
            <div className="quote-op-form">
              <div className="field-group">
                <label className="field-label">{t('quotes.opConcept', 'Concepto')}</label>
                <Autocomplete
                  value={partida.categoryId}
                  onChange={(id) => setPa('categoryId', id == null ? '' : String(id))}
                  options={conceptosOperativos.map((c) => ({ id: c.id, name: c.name }))}
                  placeholder={t('quotes.opConceptPh', 'Energía, alquiler…')}
                  emptyText={t('quotes.opNoConcepts', 'Sin conceptos operativos')}
                  aria-label={t('quotes.opConcept', 'Concepto')}
                />
              </div>
              <div className="field-group">
                <label className="field-label">{t('common.description', 'Descripción')}</label>
                <input className="field-input" value={partida.description}
                  placeholder={t('quotes.opDescPh', 'Opcional')}
                  onChange={(e) => setPa('description', e.target.value)} />
              </div>
              <div className="field-group">
                <label className="field-label">{t('quotes.chargeCalc', 'Cálculo')}</label>
                <Autocomplete value={partida.calcType}
                  onChange={(id) => setPa('calcType', id == null ? '' : String(id))}
                  options={[{ id: 'fixed', name: t('quotes.fixed', 'fijo') }, { id: 'percent', name: '%' }]}
                  allowClear={false}
                  emptyText="Sin coincidencias"
                  aria-label="Cálculo" />
              </div>
              <div className="field-group">
                <label className="field-label">{partida.calcType === 'percent' ? '%' : t('projects.amount', 'Monto')}</label>
                <input className="field-input mono" type="number" min="0" step="0.01"
                  value={partida.value} onChange={(e) => setPa('value', e.target.value)} />
              </div>
              <Button size="sm" icon="plus" onClick={agregarPartida} disabled={busy}>
                {t('quotes.opAdd', 'Agregar partida')}
              </Button>
            </div>
            {conceptosOperativos.length === 0 && (
              <div className="cfg-hint" style={{ marginTop: 8 }}>
                No hay conceptos marcados como gasto operativo. Créalos en
                Mantenimientos → Cotizaciones → Conceptos de gasto.
              </div>
            )}
          </div>
        );

  return (
    <div className="quote-subsection quote-subsection--charges" style={{ marginTop: 16 }}>
      <div className="quote-subsection-heading">
        <div className="quote-subsection-title">{t('quotes.charges', 'Gastos / cargos')}</div>
        <div className="quote-subsection-description">{t('quotes.chargesHint', 'Materiales derivados y cargos adicionales')}</div>
      </div>
      <div className="quote-subsection-card">
        <table className="data-table" style={{ width: '100%', fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>{t('quotes.chargeType', 'Tipo')}</th>
            <th style={{ textAlign: 'left' }}>{t('common.description', 'Descripción')}</th>
            <th style={{ textAlign: 'left' }}>{t('quotes.chargeCalc', 'Cálculo')}</th>
            <th style={{ textAlign: 'right' }}>{t('projects.amount', 'Monto')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {/* Gasto de materiales: derivado, no editable ni eliminable. */}
          <tr>
            <td><span className="badge-m3 success"><Icon name="box" size={13} /> {t('quotes.materials', 'Materiales')}</span></td>
            <td className="muted">{t('quotes.materialsAuto', 'Auto desde líneas')}</td>
            <td className="muted">{t('quotes.derived', 'derivado')}</td>
            <td className="num" style={{ textAlign: 'right' }}>{Q(summary.materialsCost)}</td>
            <td />
          </tr>
          {/* Gastos operativos: renglón fijo. Está siempre, aunque valga Q0,
              igual que el de Materiales — si desaparece cuando está vacío,
              nadie se acuerda de llenarlo. */}
          <tr className="quote-op-row">
            <td>
              <button type="button" className={`quote-op-toggle${opAbierto ? ' is-open' : ''}`}
                onClick={() => setOpAbierto((v) => !v)}
                aria-expanded={opAbierto}
                aria-label={opAbierto ? t('quotes.opCollapse', 'Contraer gastos operativos') : t('quotes.opExpand', 'Expandir gastos operativos')}>
                <Icon name="chevron" size={16} />
                <span className="badge-m3 accent"><Icon name="cash" size={13} /> {t('quotes.operating', 'Gastos operativos')}</span>
              </button>
            </td>
            <td className="muted">
              {modo === 'percent'
                ? `${Number(summary.operatingExpensePct || 0)}% ${t('quotes.opOfSubtotal', 'del subtotal')}`
                : modo === 'single'
                  ? t('quotes.opSingle', 'Monto único')
                  : `${partidasOperativas.length} ${partidasOperativas.length === 1 ? t('quotes.opItem', 'partida') : t('quotes.opItems', 'partidas')}`}
            </td>
            <td>
              {canEdit && (
                <div className="segmented quote-op-modo">
                  <button type="button" className={`seg ${modo === 'single' ? 'sel' : ''}`}
                    onClick={() => cambiarModo('single')} disabled={busy}>
                    {t('quotes.opModeSingle', 'Monto')}
                  </button>
                  <button type="button" className={`seg ${modo === 'detailed' ? 'sel' : ''}`}
                    onClick={() => cambiarModo('detailed')} disabled={busy}>
                    {t('quotes.opModeDetailed', 'Desglose')}
                  </button>
                  <button type="button" className={`seg ${modo === 'percent' ? 'sel' : ''}`}
                    onClick={() => cambiarModo('percent')} disabled={busy}>
                    {t('quotes.opModePercent', '%')}
                  </button>
                </div>
              )}
            </td>
            <td className="num" style={{ textAlign: 'right', fontWeight: 500 }}>{Q(summary.operatingExpenses)}</td>
            <td />
          </tr>

          {/* Todo el detalle y la captura viven dentro del panel: plegado, el
              renglón se lee como una línea más del resumen; desplegado, es el
              único sitio donde se tocan los gastos operativos. */}
          {opAbierto && (
            <tr className="quote-op-panel">
              <td colSpan={5}>
                {modo === 'detailed' && (
                  partidasOperativas.length === 0
                    ? <div className="quote-op-empty">{t('quotes.opNoItems', 'Sin partidas todavía. Agrega la primera abajo.')}</div>
                    : <ul className="quote-op-list">
                        {partidasOperativas.map((c) => (
                          <li key={c.id}>
                            <span className="quote-op-list-name">
                              <strong>{c.category}</strong>
                              {c.description && c.description !== c.category && <small>{c.description}</small>}
                            </span>
                            <span className="quote-op-list-calc muted">
                              {c.calcType === 'percent'
                                ? `${Number(c.value)}% / ${t('quotes.overSubtotal', 'subtotal')}`
                                : t('quotes.fixed', 'fijo')}
                            </span>
                            <span className="num quote-op-list-amount">{Q(c.computedAmount)}</span>
                            {canEdit && (
                              <button className="icon-btn" onClick={() => remove(c.id)} disabled={busy}
                                aria-label={t('quotes.opDelete', 'Eliminar partida')}><Icon name="close" size={12} /></button>
                            )}
                          </li>
                        ))}
                      </ul>
                )}
                {contenidoCaptura}
              </td>
            </tr>
          )}

          {otrosCargos.map((c) => (
            <tr key={c.id}>
              <td>{c.category || <span className="muted">{t('quotes.manual', 'Manual')}</span>}</td>
              <td>{c.description}</td>
              <td>{c.calcType === 'percent'
                ? <span>{Number(c.value)}% <span className="muted">/ {t('quotes.overSubtotal', 'subtotal')}</span></span>
                : <span className="muted">{t('quotes.fixed', 'fijo')}</span>}</td>
              <td className="num" style={{ textAlign: 'right' }}>{Q(c.computedAmount)}</td>
              <td style={{ textAlign: 'right' }}>
                {canEdit && <button className="icon-btn" onClick={() => remove(c.id)} disabled={busy} aria-label="Eliminar gasto"><Icon name="close" size={12} /></button>}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: '1px solid var(--border)' }}>
            <td colSpan={3} className="muted">{t('quotes.subtotalCost', 'Subtotal de costo')}</td>
            <td className="num" style={{ textAlign: 'right' }}>{Q(summary.subtotalCost)}</td>
            <td />
          </tr>
          <tr style={{ fontWeight: 600 }}>
            <td colSpan={3}>{t('common.total', 'Total')}</td>
            <td className="num" style={{ textAlign: 'right' }}>{Q(summary.total)}</td>
            <td />
          </tr>
        </tfoot>
      </table>

        {canEdit && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 10, flexWrap: 'wrap' }}>
            <div className="field-group" style={{ width: 120 }}>
            <label className="field-label">{t('quotes.chargeType', 'Tipo')}</label>
            <Autocomplete value={form.calcType}
              onChange={(id) => set('calcType', id == null ? '' : String(id))}
              options={[{ id: 'fixed', name: t('quotes.fixed', 'Fijo') }, { id: 'percent', name: t('quotes.percent', 'Porcentaje') }]}
              allowClear={false}
              emptyText="Sin coincidencias"
              aria-label="Cálculo" />
          </div>
          <div className="field-group" style={{ width: 140 }}>
            <label className="field-label">{t('quotes.category', 'Categoría')}</label>
            <Autocomplete
              value={form.categoryId}
              onChange={(id) => set('categoryId', id == null ? '' : String(id))}
              // Los conceptos operativos se capturan en su propio bloque, con
              // su monto o su desglose. Ofrecerlos también aquí crearía
              // partidas que el renglón fijo no sabría de dónde salieron.
              options={categorias.filter((c) => !c.operating).map((c) => ({ id: c.id, name: c.name }))}
              placeholder={t('quotes.categoryPh', 'Mano de obra…')}
              emptyText={t('quotes.noCategories', 'Sin categorías')}
              aria-label={t('quotes.category', 'Categoría')}
            />
          </div>
          <div className="field-group" style={{ flex: 1, minWidth: 160 }}>
            <label className="field-label">{t('common.description', 'Descripción')}</label>
            <input className="field-input" value={form.description} placeholder={t('quotes.chargeDescPh', 'Descripción del gasto')}
              onChange={(e) => set('description', e.target.value)} />
          </div>
          <div className="field-group" style={{ width: 110 }}>
            <label className="field-label">{form.calcType === 'percent' ? '%' : t('quotes.value', 'Valor')}</label>
            <input className="field-input mono" type="number" min="0" step="0.01" value={form.value}
              onChange={(e) => set('value', e.target.value)} />
          </div>
            <Button icon="plus" variant="accent" onClick={add} disabled={busy}>{t('quotes.addCharge', 'Agregar gasto')}</Button>
          </div>
        )}
      </div>
    </div>
  );
}
