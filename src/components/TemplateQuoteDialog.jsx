// Agregar a la cotización una línea calculada con la plantilla de su
// producto (o recalcular una que ya lo está): medidas, opciones de diseño o
// una combinación sugerida, cantidad. Se ve el desglose antes de agregarla.
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from './Icon.jsx';
import Button from './Button.jsx';
import Autocomplete from './Autocomplete.jsx';
import { CalculationTable } from './TemplateEditor.jsx';
import { listTemplates, getTemplate, calculateTemplate, addTemplateItem, recalcTemplateItem } from '../api/templates.js';
import { defaultParams, paramsPayload } from '../lib/templates.js';

export default function TemplateQuoteDialog({ quoteId, item = null, pushToast, onClose, onSaved }) {
  const { t } = useTranslation();
  const config = item?.templateConfig || null;
  const [plantillas, setPlantillas] = useState([]);
  const [templateId, setTemplateId] = useState(item?.templateId ? String(item.templateId) : '');
  const [plantilla, setPlantilla] = useState(null);
  const [valores, setValores] = useState({});
  const [elecciones, setElecciones] = useState({});
  const [preset, setPreset] = useState('');
  const [cantidad, setCantidad] = useState(item ? String(item.qty) : '1');
  const [calc, setCalc] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    listTemplates().then((r) => setPlantillas((Array.isArray(r) ? r : []).filter((x) => x.active))).catch(() => setPlantillas([]));
  }, []);

  useEffect(() => {
    setCalc(null);
    if (!templateId) { setPlantilla(null); return; }
    getTemplate(templateId).then((tpl) => {
      setPlantilla(tpl);
      // Al recalcular se parte de lo que tenía la línea; si no, de los valores por defecto.
      const base = defaultParams(tpl);
      const previos = config && String(item?.templateId) === String(templateId) ? config : null;
      setValores(previos?.params ? { ...base, ...Object.fromEntries(Object.entries(previos.params).map(([k, v]) => [k, String(v)])) } : base);
      setElecciones(previos?.choices ? { ...previos.choices } : {});
      setPreset(previos?.preset || '');
    }).catch((ex) => pushToast?.(ex.message, 'danger'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  const cuerpo = () => ({
    templateId: Number(templateId),
    params: paramsPayload(valores),
    choices: Object.fromEntries(Object.entries(elecciones).filter(([, v]) => v)),
    preset: preset || null,
    quantity: Number(cantidad) > 0 ? Number(cantidad) : 1,
  });

  const calcular = async () => {
    setOcupado(true);
    try {
      const b = cuerpo();
      setCalc(await calculateTemplate(b.templateId, { params: b.params, choices: b.choices, preset: b.preset }));
    } catch (ex) {
      setCalc(null);
      pushToast?.(ex.message, 'danger');
    } finally {
      setOcupado(false);
    }
  };

  const guardar = async () => {
    setOcupado(true);
    try {
      const full = item ? await recalcTemplateItem(quoteId, item.id, cuerpo()) : await addTemplateItem(quoteId, cuerpo());
      pushToast?.(item ? t('templates.lineRecalculated', 'Línea recalculada') : t('templates.lineAdded', 'Línea agregada a la cotización'), 'success');
      onSaved?.(full);
    } catch (ex) {
      pushToast?.(ex.message, 'danger');
      setOcupado(false);
    }
  };

  // Una combinación pone todas las elecciones; tocar una después la deja «a la medida».
  const elegirPreset = (code) => {
    setPreset(code || '');
    const p = plantilla?.presets?.find((x) => x.code === code);
    setElecciones(p ? { ...p.choices } : {});
    setCalc(null);
  };

  return (
    <div className="modal-overlay" onClick={() => !ocupado && onClose()}>
      <div className="modal tpl-quote" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{item ? t('templates.recalcTitle', 'Recalcular línea') : t('templates.fromTemplate', 'Agregar desde plantilla')}</h3>
          <button className="icon-btn" onClick={onClose} aria-label={t('common.close', 'Cerrar')}><Icon name="x" /></button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="field span-2">
              <label className="field-label">{t('templates.template', 'Plantilla')}</label>
              <Autocomplete value={templateId} onChange={(id) => setTemplateId(id ? String(id) : '')} disabled={Boolean(item)}
                aria-label={t('templates.template', 'Plantilla')}
                options={plantillas.map((p) => ({ id: p.id, name: `${p.name} · ${p.productName}` }))}
                placeholder={t('templates.pickTemplate', 'Escoge la plantilla del producto…')}
                emptyText={t('templates.noTemplates', 'No hay plantillas activas: créalas en Mantenimientos › Análisis › Cotizaciones')} />
            </div>
          </div>

          {plantilla && (
            <>
              <div className="tpl-preset-grid" style={{ marginTop: 12 }}>
                {plantilla.params.map((p) => (
                  <div className="field" key={p.code}>
                    <label className="field-label">{p.label}{p.unit ? ` (${p.unit})` : ''}{p.required && p.defaultValue == null ? ' *' : ''}</label>
                    <input className="field-input mono" inputMode="decimal" value={valores[p.code] ?? ''} aria-label={p.label}
                      placeholder={[p.min, p.max].some((x) => x != null) ? `${p.min ?? ''}–${p.max ?? ''}` : ''}
                      onChange={(e) => { setValores((v) => ({ ...v, [p.code]: e.target.value })); setCalc(null); }} />
                  </div>
                ))}
                <div className="field">
                  <label className="field-label">{t('quotes.qty', 'Cant.')}</label>
                  <input className="field-input mono" inputMode="decimal" value={cantidad} aria-label={t('quotes.qty', 'Cant.')}
                    onChange={(e) => setCantidad(e.target.value)} />
                </div>
              </div>

              {plantilla.presets?.length > 0 && (
                <div className="tpl-presets">
                  {plantilla.presets.map((p) => (
                    <button type="button" key={p.code} className={`chip ${preset === p.code ? 'active' : ''}`} onClick={() => elegirPreset(preset === p.code ? '' : p.code)}>
                      {p.label}
                    </button>
                  ))}
                </div>
              )}

              {plantilla.options?.length > 0 && (
                <div className="tpl-preset-grid">
                  {plantilla.options.map((o) => (
                    <div className="field" key={o.code}>
                      <label className="field-label">{o.label}</label>
                      <Autocomplete value={elecciones[o.code] || ''} aria-label={o.label}
                        onChange={(id) => { setElecciones((x) => ({ ...x, [o.code]: id || '' })); setPreset(''); setCalc(null); }}
                        options={o.choices.map((c) => ({ id: c.code, name: c.benefit ? `${c.label} — ${c.benefit}` : c.label }))}
                        placeholder={o.choices.find((c) => c.isDefault)?.label || (o.required ? t('templates.pick', 'Escoge…') : t('templates.none', 'Ninguno'))} />
                    </div>
                  ))}
                </div>
              )}

              <Button size="sm" icon="refresh" onClick={calcular} disabled={ocupado}>
                {ocupado && !calc ? t('templates.calculating', 'Calculando…') : t('templates.calculate', 'Calcular')}
              </Button>
              {calc && <CalculationTable calc={calc} />}
            </>
          )}
        </div>
        <div className="modal-foot">
          <Button variant="ghost" onClick={onClose} disabled={ocupado}>{t('common.cancel', 'Cancelar')}</Button>
          <Button icon="check" variant="accent" onClick={guardar} disabled={ocupado || !calc}
            title={calc ? '' : t('templates.calcFirst', 'Calcula primero para revisar el desglose')}>
            {item ? t('templates.updateLine', 'Actualizar línea') : t('templates.addLine', 'Agregar a la cotización')}
          </Button>
        </div>
      </div>
    </div>
  );
}
