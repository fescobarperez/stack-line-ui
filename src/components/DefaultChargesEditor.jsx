// Cargos por defecto de las cotizaciones: la empresa arma la lista y cada
// cotización nueva nace con ellos (el asesor los puede editar o quitar). La
// primera fila es la ganancia: no es un cargo, llena la ganancia de la
// cotización y se calcula sobre la base configurada (costo total o directo).
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from './Button.jsx';
import Icon from './Icon.jsx';
import Autocomplete from './Autocomplete.jsx';
import { listChargeCategories } from '../api/wave2.js';
import { newDefaultCharge, previewDefaultCharges } from '../lib/defaultCharges.js';

const Q = (v) => `Q ${Number(v || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const EJEMPLO = 1000;

export default function DefaultChargesEditor({ rows, onChange, profit, onProfitChange, profitBase = 'total_cost', errors = {} }) {
  const { t } = useTranslation();
  const [conceptos, setConceptos] = useState([]);
  useEffect(() => {
    listChargeCategories().then((r) => setConceptos(Array.isArray(r) ? r : [])).catch(() => setConceptos([]));
  }, []);

  const set = (key, cambio) => onChange(rows.map((r) => (r.key === key ? { ...r, ...cambio } : r)));
  const opciones = conceptos.filter((c) => c.status !== 'inactive')
    .map((c) => ({ id: String(c.id), name: c.name }));
  const ejemplo = useMemo(() => previewDefaultCharges(rows, EJEMPLO, profit, profitBase), [rows, profit, profitBase]);
  const tipos = [
    { id: 'percent', name: t('config.quotes.dcPercent', 'Porcentaje (%)') },
    { id: 'fixed', name: t('config.quotes.dcFixed', 'Monto fijo (Q)') },
  ];

  return (
    <div className="dc-editor">
      {(
        <div className="dc-row dc-head">
          <span>{t('config.quotes.dcConcept', 'Concepto')}</span>
          <span>{t('config.quotes.dcDescription', 'Descripción (opcional)')}</span>
          <span>{t('config.quotes.dcType', 'Tipo')}</span>
          <span>{t('config.quotes.dcValue', 'Valor')}</span>
          <span className="dc-amount-head">{t('config.quotes.dcOn', 'Sobre {{base}}', { base: Q(EJEMPLO) })}</span>
        </div>
      )}
      {/* Ganancia: fila fija, sin concepto ni botón de quitar (vacía = sin ganancia sugerida). */}
      <div className="dc-row dc-profit">
        <div>
          <span className="dc-label">{t('config.quotes.dcConcept', 'Concepto')}</span>
          <div className="dc-profit-name">{t('config.quotes.dcProfit', 'Ganancia')}</div>
        </div>
        <div className="dc-profit-hint">
          {profitBase === 'direct_cost'
            ? t('config.quotes.dcProfitDirect', 'Sobre el costo directo (los productos)')
            : t('config.quotes.dcProfitTotal', 'Sobre el costo total (productos + gastos y cargos)')}
        </div>
        <div>
          <span className="dc-label">{t('config.quotes.dcType', 'Tipo')}</span>
          <Autocomplete value={profit.calcType} allowClear={false} onChange={(id) => id && onProfitChange({ ...profit, calcType: id })}
            options={tipos} aria-label={t('config.quotes.dcProfitType', 'Tipo de ganancia')} />
        </div>
        <div>
          <span className="dc-label">{t('config.quotes.dcValue', 'Valor')}</span>
          <input className={`field-input mono ${errors.profit ? 'is-invalid' : ''}`} inputMode="decimal" value={profit.value}
            placeholder={t('config.quotes.dcProfitPh', 'Sin ganancia')} aria-label={t('config.quotes.dcProfitValue', 'Ganancia')}
            onChange={(e) => onProfitChange({ ...profit, value: e.target.value })} />
          {errors.profit && <div className="tpl-err">{errors.profit}</div>}
        </div>
        <div className="dc-actions">
          <span className="dc-amount mono">{Q(ejemplo.ganancia)}</span>
          <span className="dc-spacer" />
        </div>
      </div>
      {rows.map((r, i) => (
        <div className="dc-row" key={r.key}>
          <div>
            <span className="dc-label">{t('config.quotes.dcConcept', 'Concepto')}</span>
            <Autocomplete value={r.categoryId} onChange={(id) => set(r.key, { categoryId: id == null ? '' : String(id) })}
              options={opciones} placeholder={t('config.quotes.dcConceptPh', 'Escoge el concepto…')}
              emptyText={t('config.quotes.dcNoConcepts', 'Sin conceptos: créalos en Mantenimientos › Análisis › Cotizaciones')}
              aria-label={t('config.quotes.dcConcept', 'Concepto')} />
            {errors[r.key]?.categoryId && <div className="tpl-err">{errors[r.key].categoryId}</div>}
          </div>
          <div>
            <span className="dc-label">{t('config.quotes.dcDescription', 'Descripción (opcional)')}</span>
            <input className="field-input" maxLength={300} value={r.description}
              placeholder={t('config.quotes.dcDescriptionPh', 'El nombre del concepto')}
              aria-label={t('config.quotes.dcDescription', 'Descripción (opcional)')}
              onChange={(e) => set(r.key, { description: e.target.value })} />
          </div>
          <div>
            <span className="dc-label">{t('config.quotes.dcType', 'Tipo')}</span>
            <Autocomplete value={r.calcType} allowClear={false} onChange={(id) => id && set(r.key, { calcType: id })}
              options={tipos} aria-label={t('config.quotes.dcType', 'Tipo')} />
          </div>
          <div>
            <span className="dc-label">{t('config.quotes.dcValue', 'Valor')}</span>
            <input className={`field-input mono ${errors[r.key]?.value ? 'is-invalid' : ''}`} inputMode="decimal" value={r.value}
              placeholder={r.calcType === 'percent' ? '10' : '150.00'} aria-label={t('config.quotes.dcValue', 'Valor')}
              onChange={(e) => set(r.key, { value: e.target.value })} />
            {errors[r.key]?.value && <div className="tpl-err">{errors[r.key].value}</div>}
          </div>
          <div className="dc-actions">
            <span className="dc-amount mono">{Q(ejemplo.montos[i])}</span>
            <button type="button" className="icon-btn" aria-label={t('config.quotes.dcRemove', 'Quitar cargo')}
              title={t('config.quotes.dcRemove', 'Quitar cargo')} onClick={() => onChange(rows.filter((x) => x.key !== r.key))}>
              <Icon name="trash" />
            </button>
          </div>
        </div>
      ))}
      <div className="dc-foot">
        <Button size="sm" variant="ghost" icon="plus" onClick={() => onChange([...rows, newDefaultCharge()])}>
          {t('config.quotes.dcAdd', 'Agregar cargo')}
        </Button>
        <span className="cfg-hint">
          {t('config.quotes.dcExample2', 'Ejemplo: sobre {{base}} en productos, cargos {{total}} y ganancia {{profit}}.', { base: Q(EJEMPLO), total: Q(ejemplo.total), profit: Q(ejemplo.ganancia) })}
        </span>
      </div>
    </div>
  );
}
