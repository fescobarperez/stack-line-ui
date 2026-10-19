// Alta rápida de materia prima desde el editor de plantillas: lo mínimo para
// que la plantilla la pueda costear (nombre, SKU, unidad de uso, proveedor y
// costo). Lo demás —categoría, unidad de compra, stock mínimo— se completa
// después en Inventario.
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from './Icon.jsx';
import Button from './Button.jsx';
import Autocomplete from './Autocomplete.jsx';
import { createProduct } from '../api/catalog.js';
import { useSuppliers } from '../hooks/useMasters.js';
import { skuFromName, RAW_UNITS } from '../lib/templates.js';

export default function QuickRawMaterial({ initialName = '', pushToast, onClose, onCreated }) {
  const { t } = useTranslation();
  const { items: proveedores } = useSuppliers();
  const [f, setF] = useState({ name: initialName, sku: skuFromName(initialName), skuTocado: false, unit: 'Unidad', supplierId: '', cost: '' });
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const guardar = async () => {
    const e = {};
    if (!f.name.trim()) e.name = t('rawmat.errName', 'El nombre es obligatorio');
    if (!f.sku.trim()) e.sku = t('rawmat.errSku', 'El SKU es obligatorio');
    if (!f.supplierId) e.supplierId = t('rawmat.errSupplier', 'Elige el proveedor');
    if (!(Number(f.cost) > 0)) e.cost = t('rawmat.errCost', 'Costo mayor que cero');
    setErrores(e);
    if (Object.keys(e).length) return;
    setGuardando(true);
    try {
      const creado = await createProduct({
        name: f.name.trim(), sku: f.sku.trim(), categoryId: null, unit: f.unit,
        purchaseUnit: null, purchaseFactor: 1, itemType: 'raw_material',
        cost: Number(f.cost), price: 0, supplierId: Number(f.supplierId), supplierCost: Number(f.cost),
        minStock: 0, status: 'ACTIVE',
      });
      pushToast?.(t('rawmat.created', '«{{name}}» creada como materia prima', { name: creado?.name || f.name.trim() }), 'success');
      onCreated?.(creado);
    } catch (ex) {
      pushToast?.(t('rawmat.error', 'No se pudo crear: {{msg}}', { msg: ex.message }), 'danger');
      setGuardando(false);
    }
  };

  const error = (k) => errores[k] && <div className="tpl-err">{errores[k]}</div>;

  return (
    <div className="modal-overlay tpl-raw-overlay" onClick={() => !guardando && onClose()}>
      <div className="modal tpl-raw" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{t('rawmat.title', 'Nueva materia prima')}</h3>
          <button className="icon-btn" onClick={onClose} aria-label={t('common.close', 'Cerrar')}><Icon name="x" /></button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="field span-2">
              <label className="field-label">{t('rawmat.name', 'Nombre')} *</label>
              <input className={`field-input ${errores.name ? 'is-invalid' : ''}`} autoFocus value={f.name} placeholder={t('rawmat.namePh', 'Poste pino 4×4 × 3 m')}
                onChange={(e) => { const v = e.target.value; setF((x) => ({ ...x, name: v, sku: x.skuTocado ? x.sku : skuFromName(v) })); }} />
              {error('name')}
            </div>
            <div className="field">
              <label className="field-label">SKU *</label>
              <input className={`field-input mono ${errores.sku ? 'is-invalid' : ''}`} value={f.sku}
                onChange={(e) => setF((x) => ({ ...x, sku: e.target.value, skuTocado: true }))} />
              {error('sku')}
            </div>
            <div className="field">
              <label className="field-label">{t('rawmat.unit', 'Unidad de uso')}</label>
              <Autocomplete value={f.unit} allowClear={false} onChange={(id) => id && set('unit', id)}
                options={RAW_UNITS.map((u) => ({ id: u, name: u }))} aria-label={t('rawmat.unit', 'Unidad de uso')} />
            </div>
            <div className="field">
              <label className="field-label">{t('rawmat.supplier', 'Proveedor')} *</label>
              <Autocomplete value={f.supplierId} onChange={(id) => set('supplierId', id == null ? '' : String(id))}
                options={(proveedores || []).map((s) => ({ id: s.id, name: s.name }))}
                placeholder={t('rawmat.supplierPh', 'Buscar proveedor…')} emptyText={t('rawmat.noSuppliers', 'Sin proveedores')}
                aria-label={t('rawmat.supplier', 'Proveedor')} />
              {error('supplierId')}
            </div>
            <div className="field">
              <label className="field-label">{t('rawmat.cost', 'Costo por unidad (Q)')} *</label>
              <input className={`field-input mono ${errores.cost ? 'is-invalid' : ''}`} inputMode="decimal" value={f.cost}
                onChange={(e) => set('cost', e.target.value)} />
              {error('cost')}
            </div>
          </div>
          <p className="cfg-hint">{t('rawmat.hint', 'El costo es por unidad de uso (la misma con la que la plantilla calcula la cantidad). Categoría, unidad de compra y stock se completan después en Inventario.')}</p>
        </div>
        <div className="modal-foot">
          <Button variant="ghost" onClick={onClose} disabled={guardando}>{t('common.cancel', 'Cancelar')}</Button>
          <Button icon="check" variant="accent" onClick={guardar} disabled={guardando}>
            {guardando ? t('templates.saving', 'Guardando…') : t('rawmat.create', 'Crear materia prima')}
          </Button>
        </div>
      </div>
    </div>
  );
}
