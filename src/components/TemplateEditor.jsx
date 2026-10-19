// Editor de una plantilla de cálculo (Mantenimientos › Análisis › Cotizaciones).
//
// Una plantilla dice cómo se calcula un producto a la medida: qué se le
// pregunta al cliente (parámetros), qué puede escoger (opciones de diseño),
// qué materia prima lleva y en qué cantidad (fórmulas sobre los parámetros) y
// las combinaciones armadas que ofrece el asistente. Solo materiales: la mano
// de obra y los demás costos se agregan en la cotización.
// Se guarda completa; cada guardado es una versión nueva.
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from './Icon.jsx';
import Button from './Button.jsx';
import Autocomplete from './Autocomplete.jsx';
import QuickRawMaterial from './QuickRawMaterial.jsx';
import { listProducts } from '../api/catalog.js';
import { createTemplate, updateTemplate, calculateTemplate } from '../api/templates.js';
import {
  emptyTemplate, toForm, toPayload, validateTemplate, whenOptions, slug, defaultParams, paramsPayload,
  newParam, newOption, newChoice, newComponent, newPreset,
} from '../lib/templates.js';

const Q = (v) => `Q ${Number(v || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const contenido = (rows) => (Array.isArray(rows) ? rows : rows?.content ?? []);

export default function TemplateEditor({ template, pushToast, onClose, onSaved }) {
  const { t } = useTranslation();
  const [f, setF] = useState(() => (template ? toForm(template) : emptyTemplate()));
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [vendibles, setVendibles] = useState([]);
  const [materias, setMaterias] = useState([]);
  // Alta rápida de materia prima (false = cerrada).
  const [nuevaMp, setNuevaMp] = useState(false);

  // La materia prima se vuelve a pedir al crear una nueva: así el catálogo del
  // editor es el del servidor y no una lista armada a mano.
  const cargarMaterias = () => listProducts({ itemType: 'raw_material', size: 500 })
    .then((r) => setMaterias(contenido(r))).catch(() => {});
  useEffect(() => {
    listProducts({ itemType: 'sellable', size: 500 }).then((r) => setVendibles(contenido(r))).catch(() => {});
    cargarMaterias();
  }, []);

  const cuando = useMemo(() => whenOptions(f), [f]);
  const err = (k) => errores[k];

  // Edita una fila de una lista por su key; el código sigue a la etiqueta
  // mientras la fila es nueva (uno ya guardado no cambia: lo usan las fórmulas).
  const fila = (lista, key, cambio) => setF((x) => ({ ...x, [lista]: x[lista].map((r) => (r.key === key ? { ...r, ...cambio(r) } : r)) }));
  const etiqueta = (r, v) => ({ label: v, ...(r.nueva ? { code: slug(v) } : {}) });
  const quitar = (lista, key) => setF((x) => ({ ...x, [lista]: x[lista].filter((r) => r.key !== key) }));
  const agregar = (lista, nuevo) => setF((x) => ({ ...x, [lista]: [...x[lista], nuevo] }));
  const eleccion = (oKey, cKey, cambio) => fila('options', oKey, (o) => ({
    choices: o.choices.map((c) => (c.key === cKey ? { ...c, ...cambio(c) } : c)),
  }));

  const guardar = async () => {
    const e = validateTemplate(f);
    setErrores(e);
    if (Object.keys(e).length) {
      pushToast?.(t('templates.fixErrors', 'Revisa los campos marcados'), 'danger');
      return;
    }
    setGuardando(true);
    try {
      const body = toPayload(f);
      const guardada = f.id ? await updateTemplate(f.id, body) : await createTemplate(body);
      pushToast?.(t('templates.saved', 'Plantilla guardada (versión {{v}})', { v: guardada.version }), 'success');
      onSaved?.(guardada);
    } catch (ex) {
      pushToast?.(t('templates.saveError', 'No se pudo guardar: {{msg}}', { msg: ex.message }), 'danger');
    } finally {
      setGuardando(false);
    }
  };

  // En pantalla angosta no hay fila de encabezados: cada campo lleva su etiqueta.
  const input = (k, value, onChange, props = {}) => (
    <>
      {props.label && <span className="tpl-cell-label">{props.label}</span>}
      <input className={`field-input ${props.mono ? 'mono' : ''} ${err(k) ? 'is-invalid' : ''}`} value={value}
        placeholder={props.placeholder || ''} aria-label={props.label || props.aria} inputMode={props.inputMode}
        onChange={(e) => onChange(e.target.value)} />
      {err(k) && <div className="tpl-err">{err(k)}</div>}
    </>
  );
  const quitarBtn = (onClick, label) => (
    <button type="button" className="icon-btn" aria-label={label} title={label} onClick={onClick}><Icon name="trash" /></button>
  );

  return (
    <div className="modal-overlay" onClick={() => !guardando && onClose()}>
      <div className="modal tpl-editor" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{f.id ? t('templates.edit', 'Plantilla · {{name}}', { name: f.name }) : t('templates.new', 'Nueva plantilla de cálculo')}</h3>
          <button className="icon-btn" onClick={onClose} aria-label={t('common.close', 'Cerrar')}><Icon name="x" /></button>
        </div>

        <div className="modal-body tpl-body">
          {/* ── Datos ── */}
          <section className="tpl-section">
            <div className="form-grid">
              <div className="field">
                <label className="field-label">{t('templates.product', 'Producto que se vende')} *</label>
                <Autocomplete value={f.productId} aria-label={t('templates.product', 'Producto que se vende')}
                  onChange={(id) => setF((x) => ({ ...x, productId: id === '' ? '' : id,
                    name: x.name || vendibles.find((p) => String(p.id) === String(id))?.name || '' }))}
                  options={vendibles.map((p) => ({ id: p.id, name: p.name }))}
                  placeholder={t('templates.productPh', 'Buscar producto…')} emptyText={t('templates.noProducts', 'Sin productos')} />
                {err('productId') && <div className="tpl-err">{err('productId')}</div>}
              </div>
              <div className="field">
                <label className="field-label">{t('templates.name', 'Nombre de la plantilla')} *</label>
                {input('name', f.name, (v) => setF((x) => ({ ...x, name: v })), { aria: t('templates.name', 'Nombre de la plantilla') })}
              </div>
              <div className="field span-2">
                <label className="field-label">{t('templates.description', 'Descripción')}</label>
                <input className="field-input" value={f.description} onChange={(e) => setF((x) => ({ ...x, description: e.target.value }))} />
              </div>
            </div>
            <label className="tpl-check">
              <input type="checkbox" checked={f.active} onChange={(e) => setF((x) => ({ ...x, active: e.target.checked }))} />
              {t('templates.active', 'Activa (se puede usar al cotizar)')}
            </label>
          </section>

          {/* ── Parámetros ── */}
          <section className="tpl-section">
            <div className="tpl-section-head">
              <div>
                <h4>{t('templates.params', 'Parámetros')}</h4>
                <p className="cfg-hint">{t('templates.paramsHint', 'Lo que se le pregunta al cliente. El código es el nombre que usan las fórmulas.')}</p>
              </div>
              <Button size="sm" variant="ghost" icon="plus" onClick={() => agregar('params', newParam())}>{t('templates.addParam', 'Parámetro')}</Button>
            </div>
            {err('params') && <div className="tpl-err">{err('params')}</div>}
            <div className="tpl-table">
              <div className="tpl-row tpl-head tpl-params">
                <span>{t('templates.label', 'Etiqueta')}</span><span>{t('templates.code', 'Código')}</span><span>{t('templates.unit', 'Unidad')}</span>
                <span>{t('templates.min', 'Mín.')}</span><span>{t('templates.max', 'Máx.')}</span><span>{t('templates.default', 'Defecto')}</span><span />
              </div>
              {f.params.map((p) => {
                const k = `params.${p.key}`;
                return (
                  <div className="tpl-row tpl-params" key={p.key}>
                    <div>{input(`${k}.label`, p.label, (v) => fila('params', p.key, (r) => etiqueta(r, v)), { placeholder: 'Ancho', label: t('templates.label', 'Etiqueta') })}</div>
                    <div>{input(`${k}.code`, p.code, (v) => fila('params', p.key, () => ({ code: v })), { mono: true, label: t('templates.code', 'Código') })}</div>
                    <div>{input(`${k}.unit`, p.unit, (v) => fila('params', p.key, () => ({ unit: v })), { placeholder: 'm', label: t('templates.unit', 'Unidad') })}</div>
                    <div>{input(`${k}.min`, p.min, (v) => fila('params', p.key, () => ({ min: v })), { mono: true, inputMode: 'decimal', label: t('templates.min', 'Mín.') })}</div>
                    <div>{input(`${k}.max`, p.max, (v) => fila('params', p.key, () => ({ max: v })), { mono: true, inputMode: 'decimal', label: t('templates.max', 'Máx.') })}</div>
                    <div>{input(`${k}.defaultValue`, p.defaultValue, (v) => fila('params', p.key, () => ({ defaultValue: v })), { mono: true, inputMode: 'decimal', label: t('templates.default', 'Defecto') })}</div>
                    <div>{quitarBtn(() => quitar('params', p.key), t('templates.remove', 'Quitar'))}</div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── Opciones de diseño ── */}
          <section className="tpl-section">
            <div className="tpl-section-head">
              <div>
                <h4>{t('templates.options', 'Opciones de diseño')}</h4>
                <p className="cfg-hint">{t('templates.optionsHint', 'Lo que el cliente puede escoger (techo, cielo, acabado). El texto de render es cómo se dibuja; el beneficio, cómo lo ofrece el asistente.')}</p>
              </div>
              <Button size="sm" variant="ghost" icon="plus" onClick={() => agregar('options', newOption())}>{t('templates.addOption', 'Opción')}</Button>
            </div>
            {f.options.map((o) => {
              const k = `options.${o.key}`;
              return (
                <div className="tpl-option" key={o.key}>
                  <div className="tpl-row tpl-option-head">
                    <div>{input(`${k}.label`, o.label, (v) => fila('options', o.key, (r) => etiqueta(r, v)), { placeholder: 'Techo', label: t('templates.optionLabel', 'Opción') })}</div>
                    <div>{input(`${k}.code`, o.code, (v) => fila('options', o.key, () => ({ code: v })), { mono: true, label: t('templates.code', 'Código') })}</div>
                    <label className="tpl-check">
                      <input type="checkbox" checked={o.required} onChange={(e) => fila('options', o.key, () => ({ required: e.target.checked }))} />
                      {t('templates.required', 'Obligatoria')}
                    </label>
                    <div>{quitarBtn(() => quitar('options', o.key), t('templates.removeOption', 'Quitar opción'))}</div>
                  </div>
                  {err(`${k}.choices`) && <div className="tpl-err">{err(`${k}.choices`)}</div>}
                  {o.choices.map((c) => {
                    const kc = `${k}.${c.key}`;
                    return (
                      <div className="tpl-row tpl-choice" key={c.key}>
                        <div>{input(`${kc}.label`, c.label, (v) => eleccion(o.key, c.key, (r) => etiqueta(r, v)), { placeholder: 'Shingle', label: t('templates.choice', 'Elección') })}</div>
                        <div>{input(`${kc}.code`, c.code, (v) => eleccion(o.key, c.key, () => ({ code: v })), { mono: true, label: t('templates.code', 'Código') })}</div>
                        <div>{input(`${kc}.renderText`, c.renderText, (v) => eleccion(o.key, c.key, () => ({ renderText: v })), { placeholder: t('templates.renderPh', 'techo de shingle gris sobre plywood'), label: t('templates.renderText', 'Texto de render') })}</div>
                        <div>{input(`${kc}.benefit`, c.benefit, (v) => eleccion(o.key, c.key, () => ({ benefit: v })), { placeholder: t('templates.benefitPh', 'más fresco, look de casa'), label: t('templates.benefit', 'Beneficio') })}</div>
                        <label className="tpl-check" title={t('templates.defaultHint', 'Se usa si el cliente no escoge')}>
                          <input type="radio" name={`def-${o.key}`} checked={c.isDefault}
                            onChange={() => fila('options', o.key, (r) => ({ choices: r.choices.map((x) => ({ ...x, isDefault: x.key === c.key })) }))} />
                          {t('templates.byDefault', 'Defecto')}
                        </label>
                        <div>{quitarBtn(() => fila('options', o.key, (r) => ({ choices: r.choices.filter((x) => x.key !== c.key) })), t('templates.remove', 'Quitar'))}</div>
                      </div>
                    );
                  })}
                  <Button size="sm" variant="ghost" icon="plus" onClick={() => fila('options', o.key, (r) => ({ choices: [...r.choices, newChoice()] }))}>
                    {t('templates.addChoice', 'Elección')}
                  </Button>
                </div>
              );
            })}
          </section>

          {/* ── Componentes ── */}
          <section className="tpl-section">
            <div className="tpl-section-head">
              <div>
                <h4>{t('templates.components', 'Materia prima')}</h4>
                <p className="cfg-hint">{t('templates.componentsHint', 'Cantidad en la unidad de uso del material. Fórmulas con los códigos de parámetros: (ceil(ancho/1.5)+1)*2 · ancho*profundidad. Funciones: ceil, floor, round, min, max.')}</p>
              </div>
              <div className="tpl-head-actions">
                <Button size="sm" variant="ghost" icon="plus" onClick={() => setNuevaMp(true)}>{t('templates.createMaterial', 'Crear materia prima')}</Button>
                <Button size="sm" variant="ghost" icon="plus" onClick={() => agregar('components', newComponent())}>{t('templates.addComponent', 'Material')}</Button>
              </div>
            </div>
            {err('components') && <div className="tpl-err">{err('components')}</div>}
            <div className="tpl-table">
              <div className="tpl-row tpl-head tpl-components">
                <span>{t('templates.material', 'Material')}</span><span>{t('templates.formula', 'Cantidad (fórmula)')}</span>
                <span>{t('templates.waste', 'Merma %')}</span><span>{t('templates.group', 'Grupo')}</span><span>{t('templates.when', 'Solo si…')}</span><span />
              </div>
              {f.components.map((c) => {
                const k = `components.${c.key}`;
                return (
                  <div className="tpl-row tpl-components" key={c.key}>
                    <div>
                      <span className="tpl-cell-label">{t('templates.material', 'Material')}</span>
                      <Autocomplete value={c.productId} aria-label={t('templates.material', 'Material')}
                        onChange={(id) => fila('components', c.key, () => {
                          const p = materias.find((x) => String(x.id) === String(id));
                          return { productId: id === '' ? '' : id, productName: p?.name || '', unit: p?.unit || '' };
                        })}
                        options={materias.map((p) => ({ id: p.id, name: `${p.name}${p.unit ? ` (${p.unit})` : ''}` }))}
                        placeholder={c.productName || t('templates.materialPh', 'Buscar materia prima…')} emptyText={t('templates.noMaterials', 'Sin materia prima')} />
                      {err(`${k}.productId`) && <div className="tpl-err">{err(`${k}.productId`)}</div>}
                    </div>
                    <div>
                      {input(`${k}.formula`, c.formula, (v) => fila('components', c.key, () => ({ formula: v })), { mono: true, placeholder: 'ancho*profundidad', label: t('templates.formula', 'Cantidad (fórmula)') })}
                      <label className="tpl-check tpl-small">
                        <input type="checkbox" checked={c.roundUp} onChange={(e) => fila('components', c.key, () => ({ roundUp: e.target.checked }))} />
                        {t('templates.roundUp', 'Piezas enteras')}
                      </label>
                    </div>
                    <div>{input(`${k}.wastePct`, c.wastePct, (v) => fila('components', c.key, () => ({ wastePct: v })), { mono: true, inputMode: 'decimal', label: t('templates.waste', 'Merma %') })}</div>
                    <div>{input(`${k}.group`, c.group, (v) => fila('components', c.key, () => ({ group: v })), { placeholder: 'Estructura', label: t('templates.group', 'Grupo') })}</div>
                    <div>
                      <span className="tpl-cell-label">{t('templates.when', 'Solo si…')}</span>
                      <Autocomplete value={c.when} aria-label={t('templates.when', 'Solo si…')}
                        onChange={(id) => fila('components', c.key, () => ({ when: id || '' }))}
                        options={cuando} placeholder={t('templates.always', 'Siempre')} emptyText={t('templates.noOptions', 'Sin opciones de diseño')} />
                      {err(`${k}.when`) && <div className="tpl-err">{err(`${k}.when`)}</div>}
                    </div>
                    <div>{quitarBtn(() => quitar('components', c.key), t('templates.remove', 'Quitar'))}</div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── Combinaciones ── */}
          {f.options.length > 0 && (
            <section className="tpl-section">
              <div className="tpl-section-head">
                <div>
                  <h4>{t('templates.presets', 'Combinaciones sugeridas')}</h4>
                  <p className="cfg-hint">{t('templates.presetsHint', 'Lo que el asistente propone cuando el cliente no sabe qué escoger (básica, recomendada, premium).')}</p>
                </div>
                <Button size="sm" variant="ghost" icon="plus" onClick={() => agregar('presets', newPreset())}>{t('templates.addPreset', 'Combinación')}</Button>
              </div>
              {f.presets.map((p) => {
                const k = `presets.${p.key}`;
                return (
                  <div className="tpl-option" key={p.key}>
                    <div className="tpl-row tpl-option-head">
                      <div>{input(`${k}.label`, p.label, (v) => fila('presets', p.key, (r) => etiqueta(r, v)), { placeholder: 'Recomendada', label: t('templates.presetLabel', 'Combinación') })}</div>
                      <div>{input(`${k}.code`, p.code, (v) => fila('presets', p.key, () => ({ code: v })), { mono: true, label: t('templates.code', 'Código') })}</div>
                      <span />
                      <div>{quitarBtn(() => quitar('presets', p.key), t('templates.remove', 'Quitar'))}</div>
                    </div>
                    {err(`${k}.choices`) && <div className="tpl-err">{err(`${k}.choices`)}</div>}
                    <div className="tpl-preset-grid">
                      {f.options.filter((o) => o.code).map((o) => (
                        <div className="field" key={o.key}>
                          <label className="field-label">{o.label || o.code}</label>
                          <Autocomplete value={p.choices[o.code] || ''} aria-label={o.label || o.code}
                            onChange={(id) => fila('presets', p.key, (r) => ({ choices: { ...r.choices, [o.code]: id || '' } }))}
                            options={o.choices.filter((c) => c.code).map((c) => ({ id: c.code, name: c.label || c.code }))}
                            placeholder={t('templates.defaultChoice', 'La de por defecto')} />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          {f.id && <TemplatePreview template={template} pushToast={pushToast} />}
        </div>

        {nuevaMp && (
          <QuickRawMaterial
            pushToast={pushToast}
            onClose={() => setNuevaMp(false)}
            onCreated={async (p) => {
              setNuevaMp(false);
              await cargarMaterias();
              if (p?.id == null) return;
              // Ocupa la primera fila sin material; si todas tienen, agrega una.
              const elegida = { productId: p.id, productName: p.name, unit: p.unit || '' };
              setF((x) => {
                const vacia = x.components.find((c) => !c.productId);
                return vacia
                  ? { ...x, components: x.components.map((c) => (c.key === vacia.key ? { ...c, ...elegida } : c)) }
                  : { ...x, components: [...x.components, { ...newComponent(), ...elegida }] };
              });
            }}
          />
        )}

        <div className="modal-foot">
          <Button variant="ghost" onClick={onClose} disabled={guardando}>{t('common.cancel', 'Cancelar')}</Button>
          <Button icon="check" variant="accent" onClick={guardar} disabled={guardando}>
            {guardando ? t('templates.saving', 'Guardando…')
              : f.id ? t('templates.saveVersion', 'Guardar versión {{v}}', { v: (f.version || 0) + 1 }) : t('common.save', 'Guardar')}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Calcula con la versión guardada: cantidades, costo y textos, sin tocar nada. */
function TemplatePreview({ template, pushToast }) {
  const { t } = useTranslation();
  const [valores, setValores] = useState(() => defaultParams(template));
  const [preset, setPreset] = useState('');
  const [calc, setCalc] = useState(null);
  const [calculando, setCalculando] = useState(false);

  const calcular = async () => {
    setCalculando(true);
    try {
      setCalc(await calculateTemplate(template.id, { params: paramsPayload(valores), preset: preset || null }));
    } catch (ex) {
      setCalc(null);
      pushToast?.(ex.message, 'danger');
    } finally {
      setCalculando(false);
    }
  };

  return (
    <section className="tpl-section tpl-preview">
      <div className="tpl-section-head">
        <div>
          <h4>{t('templates.preview', 'Probar el cálculo')}</h4>
          <p className="cfg-hint">{t('templates.previewHint', 'Usa la versión guardada. Si cambiaste algo, guarda primero.')}</p>
        </div>
      </div>
      <div className="tpl-preset-grid">
        {(template.params || []).map((p) => (
          <div className="field" key={p.code}>
            <label className="field-label">{p.label}{p.unit ? ` (${p.unit})` : ''}</label>
            <input className="field-input mono" inputMode="decimal" value={valores[p.code] ?? ''}
              onChange={(e) => setValores((v) => ({ ...v, [p.code]: e.target.value }))} />
          </div>
        ))}
        {(template.presets || []).length > 0 && (
          <div className="field">
            <label className="field-label">{t('templates.presetLabel', 'Combinación')}</label>
            <Autocomplete value={preset} onChange={(id) => setPreset(id || '')} aria-label={t('templates.presetLabel', 'Combinación')}
              options={template.presets.map((p) => ({ id: p.code, name: p.label }))} placeholder={t('templates.defaultChoices', 'Elecciones por defecto')} />
          </div>
        )}
      </div>
      <Button size="sm" icon="refresh" onClick={calcular} disabled={calculando}>
        {calculando ? t('templates.calculating', 'Calculando…') : t('templates.calculate', 'Calcular')}
      </Button>
      {calc && <CalculationTable calc={calc} />}
    </section>
  );
}

/** Desglose de un cálculo: materia prima y su total. Lo usa también la cotización. */
export function CalculationTable({ calc }) {
  const { t } = useTranslation();
  return (
    <div className="tpl-calc">
      <div className="tpl-calc-desc">{calc.description}</div>
      <table className="mtable tbl-stack">
        <thead><tr>
          <th>{t('templates.material', 'Material')}</th><th>{t('templates.group', 'Grupo')}</th>
          <th className="r">{t('templates.qty', 'Cantidad')}</th><th className="r">{t('templates.unitCost', 'Costo unit.')}</th>
          <th className="r">{t('common.total', 'Total')}</th>
        </tr></thead>
        <tbody>
          {calc.lines.map((l, i) => (
            <tr key={i}>
              <td className="stack-title">{l.productName}
                {l.missingCost && <span className="badge-m3 warning" style={{ marginLeft: 6 }}>{t('templates.noCost', 'Sin costo')}</span>}
              </td>
              <td data-label={t('templates.group', 'Grupo')}>{l.group}</td>
              <td data-label={t('templates.qty', 'Cantidad')} className="r num">{Number(l.quantity).toString()} {l.unit}</td>
              <td data-label={t('templates.unitCost', 'Costo unit.')} className="r num">{Q(l.unitCost)}</td>
              <td data-label={t('common.total', 'Total')} className="r num">{Q(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="tpl-calc-totals">
        <span>{t('templates.materialsCost', 'Materia prima')} <b className="num">{Q(calc.materialsCost)}</b></span>
      </div>
      {calc.missingCosts && <div className="cfg-hint tpl-warn">{t('templates.missingCosts', 'Hay materiales sin costo: la línea quedará «por cotizar» hasta que tengan proveedor con precio.')}</div>}
      <div className="cfg-hint">{t('templates.profitNote', 'La mano de obra, otros costos, la ganancia y el IVA se agregan en la cotización.')}</div>
    </div>
  );
}
