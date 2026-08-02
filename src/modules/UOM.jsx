// ERP MAYA — Unidades de Medida múltiples (UOM)
// Data-driven: catálogo de unidades → /api/uom/units (CRUD real). Las conversiones
// por producto se editan localmente (el backend solo modela conversiones genéricas).
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from '../components/Icon.jsx';
import { useUomUnits } from '../hooks/useOperations.js';
import { useProducts } from '../hooks/useCatalog.js';
import { createUnit, updateUnit } from '../api/wave2.js';

const Q = v => `Q ${Number(v || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── (catálogo y productos vienen del backend)

// ── Modal: nueva UOM ──────────────────────────────────────────────────────

function NewUomModal({ uoms, onSave, onClose }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ code: '', name: '', symbol: '', type: 'count' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const valid = form.code.trim() && form.name.trim() && form.symbol.trim()
    && !uoms.find(u => u.code.toUpperCase() === form.code.toUpperCase().trim());

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 380 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">{t('uom.newUomTitle', 'Nueva unidad de medida')}</span>
          <button className="icon-btn" onClick={onClose}><Icon name="close" /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="field-group">
            <label className="field-label">{t('common.code', 'Código')}</label>
            <input className="field-input" placeholder="ej. TND" maxLength={6}
              value={form.code} onChange={e => set('code', e.target.value.toUpperCase())} />
          </div>
          <div className="field-group">
            <label className="field-label">{t('common.name', 'Nombre')}</label>
            <input className="field-input" placeholder="ej. Tonelada" value={form.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div className="field-group">
            <label className="field-label">{t('uom.symbol', 'Símbolo')}</label>
            <input className="field-input" placeholder="ej. t" maxLength={6} value={form.symbol} onChange={e => set('symbol', e.target.value)} />
          </div>
          <div className="field-group">
            <label className="field-label">{t('common.type', 'Tipo')}</label>
            <select className="field-input" value={form.type} onChange={e => set('type', e.target.value)}>
              {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={onClose}>{t('common.cancel', 'Cancelar')}</button>
          <button className="btn" disabled={!valid} onClick={() => onSave({ ...form, code: form.code.trim(), base: false, active: true })}>
            {t('common.save', 'Guardar')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: agregar conversión ─────────────────────────────────────────────

function AddConvModal({ product, uoms, onSave, onClose }) {
  const { t } = useTranslation();
  const usedCodes = new Set(product.convs.map(c => c.uom));
  const available = uoms.filter(u => u.active && !usedCodes.has(u.code));
  const [form, setForm] = useState({
    uom: available[0]?.code ?? '',
    factor: '',
    price: '',
    isPurchase: false,
    isSale: false,
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const valid = form.uom && Number(form.factor) > 0 && Number(form.price) >= 0;

  if (!available.length) return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 340 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">{t('uom.noUomAvailable', 'Sin UOM disponibles')}</span>
          <button className="icon-btn" onClick={onClose}><Icon name="close" /></button>
        </div>
        <div className="modal-body"><p style={{ color: 'var(--muted)', fontSize: 13 }}>{t('uom.allUomsConfigured', 'Todas las UOM activas ya están configuradas para este producto.')}</p></div>
        <div className="modal-foot"><button className="btn" onClick={onClose}>{t('common.close', 'Cerrar')}</button></div>
      </div>
    </div>
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 380 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">{t('uom.addConversion', 'Agregar conversión')}</span>
          <button className="icon-btn" onClick={onClose}><Icon name="close" /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="field-group">
            <label className="field-label">{t('uom.unitOfMeasure', 'Unidad de medida')}</label>
            <select className="field-input" value={form.uom} onChange={e => set('uom', e.target.value)}>
              {available.map(u => <option key={u.code} value={u.code}>{u.name} ({u.symbol})</option>)}
            </select>
          </div>
          <div className="field-group">
            <label className="field-label">{t('uom.conversionFactor', 'Factor de conversión')}</label>
            <input className="field-input" type="number" min="0.001" step="1" placeholder={`1 ${form.uom} = ? ${product.baseUom}`}
              value={form.factor} onChange={e => set('factor', e.target.value)} />
            {form.factor && Number(form.factor) > 0 && (
              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>
                1 {form.uom} = {form.factor} {product.baseUom}
              </div>
            )}
          </div>
          <div className="field-group">
            <label className="field-label">{t('uom.salePrice', 'Precio de venta')}</label>
            <input className="field-input" type="number" min="0" step="0.01" placeholder="Q 0.00"
              value={form.price} onChange={e => set('price', e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.isPurchase} onChange={e => set('isPurchase', e.target.checked)} />
              {t('uom.purchaseUom', 'UOM de compra')}
            </label>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.isSale} onChange={e => set('isSale', e.target.checked)} />
              {t('uom.saleUom', 'UOM de venta')}
            </label>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={onClose}>{t('common.cancel', 'Cancelar')}</button>
          <button className="btn" disabled={!valid}
            onClick={() => onSave({ uom: form.uom, factor: Number(form.factor), price: Number(form.price), isPurchase: form.isPurchase, isSale: form.isSale })}>
            {t('uom.add', 'Agregar')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────

export default function UOM({ pushToast }) {
  const { t } = useTranslation();
  const [tab, setTab]         = useState('catalog');
  const { items: unitsRaw, reload: reloadUnits } = useUomUnits();
  const { items: productsRaw } = useProducts();
  const uoms = useMemo(() => unitsRaw.map(mapUnit), [unitsRaw]);
  const products = useMemo(() => productsRaw.map(mapProdConv), [productsRaw]);
  const [search, setSearch]   = useState('');
  const [selected, setSelected] = useState(null);
  const [showUomModal, setShowUomModal] = useState(false);
  const [showConvModal, setShowConvModal] = useState(false);

  const uomByCode = Object.fromEntries(uoms.map(u => [u.code, u]));

  const multiCount  = products.filter(p => p.convs.length > 1).length;
  const singleCount = products.filter(p => p.convs.length === 1).length;
  const totalUoms   = uoms.filter(u => u.active).length;

  const filtered = products.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.includes(search)
  );

  const toggleUomActive = async (u) => {
    try {
      await updateUnit(u.id, { code: u.code, name: u.name, symbol: u.symbol, uomType: u.type, isBase: u.base, active: !u.active });
      await reloadUnits();
    } catch (err) {
      pushToast('No se pudo actualizar la UOM: ' + err.message, 'error');
    }
  };

  const addUom = async (uom) => {
    try {
      await createUnit({ code: uom.code, name: uom.name, symbol: uom.symbol, uomType: uom.type, isBase: false, active: true });
      await reloadUnits();
      setShowUomModal(false);
      pushToast(`UOM "${uom.name}" creada`, 'success');
    } catch (err) {
      pushToast('No se pudo crear la UOM: ' + err.message, 'error');
    }
  };

  const openProduct = p => setSelected(JSON.parse(JSON.stringify(p)));

  const removeConv = uomCode => {
    if (uomCode === selected.baseUom) return;
    setSelected(prev => ({ ...prev, convs: prev.convs.filter(c => c.uom !== uomCode) }));
  };

  const updateConvField = (uomCode, field, value) => {
    setSelected(prev => ({
      ...prev,
      convs: prev.convs.map(c => c.uom === uomCode ? { ...c, [field]: value } : c),
    }));
  };

  const addConv = conv => {
    setSelected(prev => ({ ...prev, convs: [...prev.convs, conv] }));
    setShowConvModal(false);
  };

  const saveProduct = () => {
    // El backend aún no persiste conversiones por producto (solo conversiones genéricas UOM→UOM).
    pushToast('Edición local — el backend aún no persiste conversiones por producto', 'info');
    setSelected(null);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-title">{t('uom.title', 'Unidades de Medida')}</div>
          <div className="page-sub">{t('uom.subtitle', 'Configuración de UOM múltiples por producto')}</div>
        </div>
        <div className="page-head-actions">
          {tab === 'catalog' && (
            <button className="btn" onClick={() => setShowUomModal(true)}>
              <Icon name="plus" size={12} /> {t('uom.newUnit', 'Nueva UOM')}
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="label">{t('uom.activeUoms', 'UOM activas')}</div>
          <div className="value">{totalUoms}</div>
          <div className="sub muted">{uoms.length} {t('uom.inCatalog', 'en catálogo')}</div>
        </div>
        <div className="stat-card">
          <div className="label">{t('uom.multiUomProducts', 'Productos multi-UOM')}</div>
          <div className="value">{multiCount}</div>
          <div className="sub muted">{t('uom.withConversions', 'Con conversiones')}</div>
        </div>
        <div className="stat-card">
          <div className="label">{t('uom.baseUomOnly', 'Solo UOM base')}</div>
          <div className="value">{singleCount}</div>
          <div className="sub muted">{t('uom.noExtraConversion', 'Sin conversión extra')}</div>
        </div>
        <div className="stat-card">
          <div className="label">{t('uom.totalProducts', 'Total productos')}</div>
          <div className="value">{products.length}</div>
          <div className="sub muted">{t('uom.withUomConfigured', 'Con UOM configurada')}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 0 }}>
        <button className={`tab ${tab === 'catalog' ? 'active' : ''}`} onClick={() => setTab('catalog')}>
          {t('uom.tabCatalog', 'Catálogo de UOM')}
        </button>
        <button className={`tab ${tab === 'products' ? 'active' : ''}`} onClick={() => setTab('products')}>
          {t('uom.tabConversions', 'Conversiones por Producto')}
        </button>
      </div>

      {/* ── Tab: Catálogo ─────────────────────────────────────────────── */}
      {tab === 'catalog' && (
        <div className="card" style={{ borderTopLeftRadius: 0 }}>
          <div className="table-wrap" style={{ border: 'none', margin: 0, borderRadius: 0 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t('common.code', 'Código')}</th>
                  <th>{t('common.name', 'Nombre')}</th>
                  <th>{t('uom.symbol', 'Símbolo')}</th>
                  <th>{t('common.type', 'Tipo')}</th>
                  <th>{t('uom.base', 'Base')}</th>
                  <th>{t('common.status', 'Estado')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {uoms.map(u => (
                  <tr key={u.code}>
                    <td><span className="mono" style={{ fontWeight: 700, fontSize: 12.5 }}>{u.code}</span></td>
                    <td style={{ fontWeight: 500 }}>{u.name}</td>
                    <td><span className="mono muted">{u.symbol}</span></td>
                    <td><span className={`pill ${TYPE_CLASS[u.type]}`}>{TYPE_LABEL[u.type]}</span></td>
                    <td>{u.base ? <span className="pill success">{t('uom.baseLabel', 'Base')}</span> : <span className="muted">—</span>}</td>
                    <td>
                      <span className={`pill ${u.active ? 'success' : ''}`}>
                        {u.active ? t('uom.active', 'Activa') : t('uom.inactive', 'Inactiva')}
                      </span>
                    </td>
                    <td>
                      {!u.base && (
                        <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => toggleUomActive(u)}>
                          {u.active ? t('uom.deactivate', 'Desactivar') : t('uom.activate', 'Activar')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab: Conversiones ─────────────────────────────────────────── */}
      {tab === 'products' && (
        <div className="card" style={{ borderTopLeftRadius: 0 }}>
          <div className="filterbar" style={{ padding: '10px 16px' }}>
            <div className="field-wrap search-wrap">
              <Icon name="search" className="field-icon" size={13} />
              <input className="field-input" placeholder={t('uom.searchPlaceholder', 'Buscar producto o SKU…')}
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="table-wrap" style={{ border: 'none', margin: 0, borderRadius: 0 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>{t('common.product', 'Producto')}</th>
                  <th>{t('uom.baseUom', 'UOM Base')}</th>
                  <th>{t('uom.purchaseUom', 'UOM Compra')}</th>
                  <th>{t('uom.saleUom', 'UOM Venta')}</th>
                  <th>{t('uom.conversions', 'Conversiones')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const purchaseConv = p.convs.find(c => c.isPurchase);
                  const saleConvs    = p.convs.filter(c => c.isSale);
                  return (
                    <tr key={p.sku} onClick={() => openProduct(p)} style={{ cursor: 'pointer' }}>
                      <td className="mono muted" style={{ fontSize: 11 }}>{p.sku.slice(-6)}</td>
                      <td style={{ fontWeight: 500 }}>{p.name}</td>
                      <td><span className="mono" style={{ fontWeight: 700 }}>{p.baseUom}</span></td>
                      <td>
                        {purchaseConv
                          ? <span className="pill">{purchaseConv.uom} &nbsp;<span className="muted">×{purchaseConv.factor}</span></span>
                          : <span className="muted">—</span>}
                      </td>
                      <td>
                        {saleConvs.map(c => (
                          <span key={c.uom} className="pill" style={{ marginRight: 4 }}>{c.uom}</span>
                        ))}
                      </td>
                      <td>
                        <span className={`pill ${p.convs.length > 1 ? 'success' : ''}`}>
                          {p.convs.length} UOM
                        </span>
                      </td>
                      <td>
                        <button className="btn-ghost" onClick={e => { e.stopPropagation(); openProduct(p); }}>
                          {t('common.edit', 'Editar')}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Drawer: conversiones del producto ─────────────────────────── */}
      {selected && (
        <div className="drawer-backdrop" onClick={() => setSelected(null)}>
          <div className="drawer" style={{ width: 540 }} onClick={e => e.stopPropagation()}>
            <div className="drawer-head">
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{selected.name}</div>
                <div className="mono muted" style={{ fontSize: 11, marginTop: 2 }}>{selected.sku}</div>
              </div>
              <button className="icon-btn" onClick={() => setSelected(null)}><Icon name="close" /></button>
            </div>

            <div className="drawer-body">
              <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>
                  {t('uom.baseUnit', 'Unidad base:')}
                </span>
                <span className="pill success">{selected.baseUom} — {uomByCode[selected.baseUom]?.name}</span>
                <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 'auto' }}>
                  {t('uom.stockInBase', 'El stock siempre se registra en la unidad base')}
                </span>
              </div>

              <table className="tbl" style={{ marginBottom: 12 }}>
                <thead>
                  <tr>
                    <th>UOM</th>
                    <th style={{ textAlign: 'center' }}>{t('uom.factor', 'Factor')}</th>
                    <th style={{ textAlign: 'right' }}>{t('uom.salePrice', 'Precio venta')}</th>
                    <th style={{ textAlign: 'center' }}>{t('uom.purchaseShort', 'Compra')}</th>
                    <th style={{ textAlign: 'center' }}>{t('uom.saleShort', 'Venta')}</th>
                    <th style={{ width: 36 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {selected.convs.map(c => {
                    const isBase = c.uom === selected.baseUom;
                    return (
                      <tr key={c.uom}>
                        <td>
                          <strong>{c.uom}</strong>
                          <span className="muted" style={{ fontSize: 11, marginLeft: 6 }}>{uomByCode[c.uom]?.name}</span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="number" min="0.001" step="1"
                            className="field-input"
                            style={{ width: 80, textAlign: 'center', padding: '3px 6px', fontSize: 12.5 }}
                            value={c.factor}
                            disabled={isBase}
                            onChange={e => updateConvField(c.uom, 'factor', Number(e.target.value))}
                          />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            type="number" min="0" step="0.01"
                            className="field-input"
                            style={{ width: 90, textAlign: 'right', padding: '3px 6px', fontSize: 12.5 }}
                            value={c.price}
                            onChange={e => updateConvField(c.uom, 'price', Number(e.target.value))}
                          />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input type="checkbox" checked={c.isPurchase}
                            onChange={e => updateConvField(c.uom, 'isPurchase', e.target.checked)} />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input type="checkbox" checked={c.isSale}
                            onChange={e => updateConvField(c.uom, 'isSale', e.target.checked)} />
                        </td>
                        <td>
                          {!isBase && (
                            <button className="icon-btn" title={t('common.delete', 'Eliminar')} onClick={() => removeConv(c.uom)}>
                              <Icon name="close" size={12} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Equivalencias informativas */}
              <div className="card" style={{ padding: '10px 14px', marginBottom: 12, background: 'var(--surface-2)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--muted)', marginBottom: 8 }}>
                  {t('uom.equivalences', 'EQUIVALENCIAS')}
                </div>
                {selected.convs.filter(c => c.uom !== selected.baseUom).map(c => (
                  <div key={c.uom} style={{ fontSize: 12.5, color: 'var(--text-2)', marginBottom: 4 }}>
                    1 <strong>{c.uom}</strong> = {c.factor} <strong>{selected.baseUom}</strong>
                    <span className="muted" style={{ marginLeft: 12 }}>
                      {t('uom.pricePerBase', 'Precio/unidad base:')} {Q(c.price / (c.factor || 1))}
                    </span>
                  </div>
                ))}
                {selected.convs.length === 1 && (
                  <div className="muted" style={{ fontSize: 12 }}>{t('uom.noAdditionalConversions', 'Sin conversiones adicionales')}</div>
                )}
              </div>

              <button className="btn-outline" style={{ width: '100%' }} onClick={() => setShowConvModal(true)}>
                <Icon name="plus" size={12} /> {t('uom.addConversion', 'Agregar conversión')}
              </button>
            </div>

            <div className="drawer-foot">
              <button className="btn-ghost" onClick={() => setSelected(null)}>{t('common.cancel', 'Cancelar')}</button>
              <button className="btn" onClick={saveProduct}>{t('uom.saveChanges', 'Guardar cambios')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modales */}
      {showUomModal  && <NewUomModal  uoms={uoms}     onSave={addUom}  onClose={() => setShowUomModal(false)} />}
      {showConvModal && selected && (
        <AddConvModal product={selected} uoms={uoms} onSave={addConv} onClose={() => setShowConvModal(false)} />
      )}
    </div>
  );
}
