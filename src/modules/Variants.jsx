// ERP MAYA — Variantes de Producto
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from '../components/Icon.jsx';
import { useVariants } from '../hooks/useVariants.js';
import { useProducts } from '../hooks/useCatalog.js';
import { createVariant, updateVariant } from '../api/wave2.js';

const Q = v => `Q ${v.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── Mock data ─────────────────────────────────────────────────────────────────
const INIT_GROUPS = [
  {
    id: 'vg01', name: 'Coca-Cola', brand: 'Coca-Cola Company', cat: 'bebidas', attrType: 'tamaño',
    variants: [
      { sku: '7501031125600', label: '350ml',  price: 6.50,  cost: 3.80,  stock: 72,  min: 36, active: true },
      { sku: '7501031125678', label: '600ml',  price: 8.50,  cost: 5.20,  stock: 98,  min: 36, active: true },
      { sku: '7501031125700', label: '1.5 L',  price: 16.00, cost: 10.50, stock: 24,  min: 12, active: true },
      { sku: '7501031125717', label: '2 L',    price: 20.00, cost: 13.50, stock: 18,  min: 12, active: true },
    ],
  },
  {
    id: 'vg02', name: 'Agua Pura Salvavidas', brand: 'Margarita, S.A.', cat: 'bebidas', attrType: 'tamaño',
    variants: [
      { sku: '7501031145500', label: '350ml', price: 3.00, cost: 1.50, stock: 180, min: 60, active: true },
      { sku: '7501031145552', label: '600ml', price: 4.50, cost: 2.10, stock: 240, min: 60, active: true },
      { sku: '7501031145569', label: '1.5 L', price: 9.00, cost: 5.20, stock: 56,  min: 24, active: true },
    ],
  },
  {
    id: 'vg03', name: 'Arroz Blanco Premium', brand: 'Molinos Modernos', cat: 'abarrotes', attrType: 'peso',
    variants: [
      { sku: '7501055309800', label: '500g', price: 7.00,  cost: 4.50,  stock: 88,  min: 20, active: true },
      { sku: '7501055309856', label: '1 kg', price: 12.50, cost: 8.20,  stock: 142, min: 30, active: true },
      { sku: '7501055309870', label: '2 kg', price: 23.00, cost: 15.80, stock: 6,   min: 12, active: true },
      { sku: '7501055309887', label: '5 kg', price: 54.00, cost: 38.00, stock: 0,   min: 8,  active: true },
    ],
  },
  {
    id: 'vg04', name: 'Shampoo Sedal', brand: 'Unilever Guatemala', cat: 'higiene', attrType: 'tamaño',
    variants: [
      { sku: '7501045500004', label: '180ml', price: 16.00, cost: 10.50, stock: 28, min: 12, active: true },
      { sku: '7501045500011', label: '350ml', price: 28.00, cost: 18.50, stock: 38, min: 16, active: true },
      { sku: '7501045500018', label: '700ml', price: 52.00, cost: 35.00, stock: 0,  min: 8,  active: true },
    ],
  },
  {
    id: 'vg05', name: 'Detergente Ariel', brand: 'P&G Guatemala', cat: 'limpieza', attrType: 'peso',
    variants: [
      { sku: '7501035010110', label: '500g', price: 22.00, cost: 14.80, stock: 38, min: 16, active: true },
      { sku: '7501035010123', label: '1 kg', price: 38.50, cost: 26.40, stock: 42, min: 18, active: true },
      { sku: '7501035010117', label: '3 kg', price: 99.00, cost: 68.00, stock: 4,  min: 6,  active: true },
    ],
  },
  {
    id: 'vg06', name: 'Sabritas', brand: 'PepsiCo Guatemala', cat: 'snacks', attrType: 'sabor',
    variants: [
      { sku: '7501073400001', label: 'Original',      price: 8.00, cost: 4.80, stock: 76, min: 30, active: true },
      { sku: '7501073400056', label: 'Chile y Limón', price: 8.00, cost: 4.80, stock: 52, min: 30, active: true },
      { sku: '7501073400063', label: 'Adobadas',      price: 8.50, cost: 5.10, stock: 44, min: 24, active: true },
      { sku: '7501073400070', label: 'Queso',         price: 8.50, cost: 5.10, stock: 8,  min: 24, active: true },
    ],
  },
  {
    id: 'vg07', name: 'Cloro Magia Blanca', brand: 'Industrias Magia', cat: 'limpieza', attrType: 'tamaño',
    variants: [
      { sku: '7501035010130', label: '1 L',  price: 12.50, cost: 7.80, stock: 88, min: 24, active: true },
      { sku: '7501035010138', label: '2 L',  price: 22.00, cost: 14.00, stock: 36, min: 12, active: true },
      { sku: '7501035010145', label: '3.8 L',price: 38.00, cost: 24.50, stock: 3,  min: 8,  active: true },
    ],
  },
  {
    id: 'vg08', name: 'Leche Foremost', brand: 'Foremost Guatemala', cat: 'lacteos', attrType: 'tamaño',
    variants: [
      { sku: '7501074234560', label: '500ml', price: 8.00,  cost: 5.20, stock: 48, min: 20, active: true },
      { sku: '7501074234567', label: '1 L',   price: 14.50, cost: 9.80, stock: 22, min: 30, active: true },
      { sku: '7501074234574', label: '2 L',   price: 27.00, cost: 18.50, stock: 0, min: 12, active: false },
    ],
  },
];

const ATTR_LABEL = { tamaño: 'Tamaño', peso: 'Peso', sabor: 'Sabor', color: 'Color', otro: 'Otro' };
const CATS = ['abarrotes', 'bebidas', 'lacteos', 'limpieza', 'higiene', 'snacks'];

function groupStatus(g) {
  if (g.variants.some(v => v.active && v.stock === 0)) return 'out';
  if (g.variants.some(v => v.active && v.stock < v.min)) return 'low';
  return 'ok';
}

export default function Variants({ pushToast }) {
  const { t } = useTranslation();
  const { groups, categories, reload } = useVariants();
  const { items: products } = useProducts();
  const [search, setSearch]         = useState('');
  const [filterCat, setFilterCat]   = useState('all');
  const [filterAttr, setFilterAttr] = useState('all');
  const [selected, setSelected]     = useState(null);
  const [groupModal, setGroupModal] = useState(false);
  const [variantModal, setVariantModal] = useState(null); // group to add variant to

  // Stats
  const totalVariants = groups.reduce((s, g) => s + g.variants.length, 0);
  const lowGroups     = groups.filter(g => groupStatus(g) === 'low').length;
  const outGroups     = groups.filter(g => groupStatus(g) === 'out').length;
  const alertGroups   = lowGroups + outGroups;

  const enriched = useMemo(() => groups.map(g => {
    const active   = g.variants.filter(v => v.active);
    const stocks   = active.map(v => v.stock);
    const prices   = active.map(v => v.price);
    return {
      ...g,
      status:       groupStatus(g),
      totalStock:   stocks.reduce((a, b) => a + b, 0),
      minPrice:     Math.min(...prices),
      maxPrice:     Math.max(...prices),
      activeCount:  active.length,
    };
  }), [groups]);

  const filtered = useMemo(() => enriched.filter(g => {
    if (filterCat  !== 'all' && g.cat      !== filterCat)  return false;
    if (filterAttr !== 'all' && g.attrType !== filterAttr) return false;
    if (search && !g.name.toLowerCase().includes(search.toLowerCase()) &&
        !g.brand.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [enriched, search, filterCat, filterAttr]);

  // "Nuevo grupo" = elegir un producto del catálogo y abrir el alta de variante.
  function handleAddGroup(group) {
    setGroupModal(false);
    setVariantModal({ productId: group.productId, name: group.name, attrType: group.attrType });
  }

  async function handleAddVariant(group, variant) {
    try {
      await createVariant({
        productId: group.productId,
        attributeType: group.attrType,
        attributeValue: variant.label,
        sku: variant.sku,
        price: variant.price,
        cost: variant.cost,
        stock: variant.stock,
        minStock: variant.min,
        active: true,
      });
      setVariantModal(null);
      setSelected(null);
      pushToast('Variante agregada', 'success');
      reload();
    } catch (err) { pushToast('No se pudo agregar la variante: ' + err.message, 'error'); }
  }

  async function toggleVariant(group, variant) {
    try {
      await updateVariant(variant.id, {
        productId: group.productId,
        attributeType: group.attrType,
        attributeValue: variant.label,
        sku: variant.sku,
        price: variant.price,
        cost: variant.cost,
        stock: variant.stock,
        minStock: variant.min,
        active: !variant.active,
      });
      reload();
      setSelected(null);
    } catch (err) { pushToast('No se pudo actualizar la variante: ' + err.message, 'error'); }
  }

  const statusBg  = { ok: 'var(--success)', low: 'var(--warning)', out: 'var(--danger)' };
  const statusPill = { ok: 'success', low: 'warning', out: 'danger' };
  const statusTxt  = { ok: 'OK', low: t('variants.stockLow', 'Stock bajo'), out: t('variants.outOfStock', 'Agotada') };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('variants.title', 'Variantes de Producto')}</h1>
          <div className="page-subtitle">{t('variants.subtitle', 'Grupos de variantes · tamaño, peso, sabor · SKUs por variante')}</div>
        </div>
        <div className="page-head-actions">
          <button className="btn accent" onClick={() => setGroupModal(true)}>
            <Icon name="plus" size={12} /> {t('variants.newGroup', 'Nuevo grupo')}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <div className="stat">
          <div className="label"><Icon name="box" size={11} />{t('variants.variantGroups', 'Grupos de variantes')}</div>
          <div className="val mono">{groups.length}</div>
          <div className="delta muted">{totalVariants} {t('variants.totalVariants', 'variantes en total')}</div>
        </div>
        <div className="stat">
          <div className="label"><Icon name="alert" size={11} />{t('variants.groupsWithAlerts', 'Grupos con alertas')}</div>
          <div className="val mono" style={{ color: alertGroups > 0 ? 'var(--danger)' : undefined }}>{alertGroups}</div>
          <div className="delta muted">{outGroups} {t('variants.outOfStock', 'agotadas')} · {lowGroups} {t('variants.stockLow', 'stock bajo')}</div>
        </div>
        <div className="stat">
          <div className="label"><Icon name="chart" size={11} />{t('variants.mostUsedAttr', 'Tipo de atributo más usado')}</div>
          <div className="val" style={{ fontSize: 20 }}>{t('variants.attrSize', 'Tamaño')}</div>
          <div className="delta muted">5 {t('variants.of8groups', 'de 8 grupos')}</div>
        </div>
        <div className="stat">
          <div className="label"><Icon name="check" size={11} />{t('variants.variantCoverage', 'Cobertura de variantes')}</div>
          <div className="val mono" style={{ color: 'var(--success)' }}>
            {Math.round((groups.reduce((s, g) => s + g.variants.filter(v => v.active && v.stock > v.min).length, 0) / totalVariants) * 100)}%
          </div>
          <div className="delta muted">{t('variants.variantsWithStock', 'Variantes con stock suficiente')}</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="filterbar">
        <div className="search-wrap" style={{ flex: 1, maxWidth: 320 }}>
          <Icon name="search" className="icon" size={13} />
          <input
            className="search-input"
            placeholder={t('variants.searchPlaceholder', 'Buscar producto o marca…')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="input" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="all">{t('variants.allCategories', 'Todas las categorías')}</option>
          {categories.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
        </select>
        <select className="input" value={filterAttr} onChange={e => setFilterAttr(e.target.value)}>
          <option value="all">{t('variants.allAttributes', 'Todos los atributos')}</option>
          <option value="tamaño">{t('variants.attrSize', 'Tamaño')}</option>
          <option value="peso">{t('variants.attrWeight', 'Peso')}</option>
          <option value="sabor">{t('variants.attrFlavor', 'Sabor')}</option>
          <option value="color">{t('variants.attrColor', 'Color')}</option>
        </select>
      </div>

      {/* Tabla de grupos */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="tbl-wrap"><table className="tbl">
          <thead>
            <tr>
              <th>{t('common.product', 'Producto')}</th>
              <th>{t('variants.brand', 'Marca')}</th>
              <th>{t('common.category', 'Categoría')}</th>
              <th>{t('variants.attribute', 'Atributo')}</th>
              <th style={{ textAlign: 'right' }}>{t('variants.variantsCol', 'Variantes')}</th>
              <th style={{ textAlign: 'right' }}>{t('variants.totalStock', 'Stock total')}</th>
              <th>{t('variants.priceRange', 'Rango de precios')}</th>
              <th>{t('common.status', 'Estado')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="empty">{t('variants.noGroupsWithFilters', 'Sin grupos con los filtros aplicados')}</td></tr>
            ) : filtered.map(g => (
              <tr key={g.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(g)}>
                <td>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{g.name}</div>
                  {g.variants.some(v => !v.active) && (
                    <div className="muted" style={{ fontSize: 10 }}>
                      {g.variants.filter(v => !v.active).length} {t('variants.inactiveVariants', 'variante(s) inactiva(s)')}
                    </div>
                  )}
                </td>
                <td className="muted" style={{ fontSize: 12 }}>{g.brand}</td>
                <td>
                  <span className="pill info" style={{ fontSize: 9, textTransform: 'capitalize' }}>{g.cat}</span>
                </td>
                <td style={{ fontSize: 12 }}>{ATTR_LABEL[g.attrType] || g.attrType}</td>
                <td style={{ textAlign: 'right' }}>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{g.activeCount}</span>
                  {g.variants.length !== g.activeCount && (
                    <span className="muted" style={{ fontSize: 10, marginLeft: 4 }}>/{g.variants.length}</span>
                  )}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <span className="mono" style={{ fontSize: 13, color: g.totalStock === 0 ? 'var(--danger)' : undefined }}>
                    {g.totalStock}
                  </span>
                </td>
                <td>
                  {g.minPrice === g.maxPrice
                    ? <span className="mono" style={{ fontSize: 12 }}>{Q(g.minPrice)}</span>
                    : <span className="mono" style={{ fontSize: 12 }}>{Q(g.minPrice)} – {Q(g.maxPrice)}</span>
                  }
                </td>
                <td>
                  {g.variants.some(v => v.active && v.stock === 0) && (
                    <span className="pill danger" style={{ fontSize: 9, marginRight: 4 }}>{t('variants.outOfStock', 'Agotada')}</span>
                  )}
                  {g.variants.some(v => v.active && v.stock > 0 && v.stock < v.min) && (
                    <span className="pill warning" style={{ fontSize: 9 }}>{t('variants.stockLow', 'Stock bajo')}</span>
                  )}
                  {g.status === 'ok' && (
                    <span className="pill success" style={{ fontSize: 9 }}>OK</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>

      {/* Drawer detalle de grupo */}
      {selected && (
        <div className="drawer-overlay" onClick={() => setSelected(null)}>
          <div className="drawer" style={{ width: 520 }} onClick={e => e.stopPropagation()}>
            <div className="drawer-head">
              <div>
                <div className="drawer-title">{selected.name}</div>
                <div className="muted" style={{ fontSize: 12 }}>{selected.brand} · {ATTR_LABEL[selected.attrType]}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" style={{ fontSize: 11 }}
                  onClick={() => { setVariantModal(selected); }}>
                  <Icon name="plus" size={11} /> {t('variants.variant', 'Variante')}
                </button>
                <button className="icon-btn" onClick={() => setSelected(null)}><Icon name="close" /></button>
              </div>
            </div>
            <div className="drawer-body" style={{ padding: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '8px 14px', textAlign: 'left', fontSize: 10, fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {ATTR_LABEL[selected.attrType]}
                    </th>
                    <th style={{ padding: '8px 14px', textAlign: 'left', fontSize: 10, fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>SKU</th>
                    <th style={{ padding: '8px 14px', textAlign: 'right', fontSize: 10, fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('common.price', 'Precio')}</th>
                    <th style={{ padding: '8px 14px', textAlign: 'right', fontSize: 10, fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('common.cost', 'Costo')}</th>
                    <th style={{ padding: '8px 14px', textAlign: 'right', fontSize: 10, fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Stock</th>
                    <th style={{ padding: '8px 14px', textAlign: 'right', fontSize: 10, fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('variants.min', 'Mín.')}</th>
                    <th style={{ padding: '8px 14px', width: 60, fontSize: 10, fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('common.status', 'Estado')}</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.variants.map((v, i) => {
                    const isOut = v.active && v.stock === 0;
                    const isLow = v.active && v.stock > 0 && v.stock < v.min;
                    return (
                      <tr key={v.sku} style={{ borderBottom: '1px solid var(--border)', opacity: v.active ? 1 : 0.45 }}>
                        <td style={{ padding: '9px 14px', fontWeight: 600 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: isOut ? 'var(--danger)' : isLow ? 'var(--warning)' : 'var(--success)', flexShrink: 0 }} />
                            {v.label}
                          </div>
                        </td>
                        <td style={{ padding: '9px 14px' }}>
                          <span className="mono muted" style={{ fontSize: 11 }}>{v.sku}</span>
                        </td>
                        <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{Q(v.price)}</td>
                        <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>{Q(v.cost)}</td>
                        <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: isOut ? 'var(--danger)' : isLow ? 'var(--warning)' : undefined }}>
                          {v.stock}
                        </td>
                        <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>{v.min}</td>
                        <td style={{ padding: '9px 14px' }}>
                          <button
                            className={`chip ${v.active ? 'active' : ''}`}
                            style={{ fontSize: 9, padding: '2px 6px' }}
                            onClick={() => { toggleVariant(selected, v); }}
                          >
                            {v.active ? t('variants.active', 'Activa') : t('variants.inactive', 'Inactiva')}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal nuevo grupo */}
      {groupModal && (
        <GroupModal products={products} onClose={() => setGroupModal(false)} onSave={handleAddGroup} />
      )}

      {/* Modal nueva variante */}
      {variantModal && (
        <VariantModal
          group={variantModal}
          onClose={() => setVariantModal(null)}
          onSave={v => handleAddVariant(variantModal, v)}
        />
      )}
    </div>
  );
}

// ── Modal: elegir producto + atributo para agregarle variantes ────────────────
function GroupModal({ products = [], onClose, onSave }) {
  const { t } = useTranslation();
  const [productId, setProductId] = useState('');
  const [attrType,  setAttrType]  = useState('tamaño');
  const [search,    setSearch]    = useState('');

  const filtered = products.filter(p => !search || (p.name || '').toLowerCase().includes(search.toLowerCase()));
  const valid = productId;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{t('variants.newGroupTitle', 'Variantes de un producto')}</h3>
          <button className="icon-btn" onClick={onClose}><Icon name="close" /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="field">
            <label className="field-label">{t('variants.searchProduct', 'Buscar producto')}</label>
            <input className="field-input" placeholder={t('variants.productNamePlaceholder', 'Ej. Coca-Cola')} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="field">
            <label className="field-label">{t('common.product', 'Producto del catálogo')}</label>
            <select className="field-input" value={productId} onChange={e => setProductId(e.target.value)}>
              <option value="">{t('common.selectDots', 'Seleccionar…')}</option>
              {filtered.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label">{t('variants.attributeType', 'Tipo de atributo')}</label>
            <select className="field-input" value={attrType} onChange={e => setAttrType(e.target.value)}>
              <option value="tamaño">{t('variants.attrSize', 'Tamaño')}</option>
              <option value="peso">{t('variants.attrWeight', 'Peso')}</option>
              <option value="sabor">{t('variants.attrFlavor', 'Sabor')}</option>
              <option value="color">{t('variants.attrColor', 'Color')}</option>
              <option value="otro">{t('variants.attrOther', 'Otro')}</option>
            </select>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>{t('common.cancel', 'Cancelar')}</button>
          <button className="btn accent" disabled={!valid}
            onClick={() => {
              const p = products.find(pp => String(pp.id) === String(productId));
              onSave({ productId: Number(productId), name: p?.name || '', attrType });
            }}>
            <Icon name="check" size={13} /> {t('variants.addVariant', 'Agregar variante')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: agregar variante a un grupo ───────────────────────────────────────
function VariantModal({ group, onClose, onSave }) {
  const { t } = useTranslation();
  const [label, setLabel]   = useState('');
  const [sku,   setSku]     = useState('');
  const [price, setPrice]   = useState('');
  const [cost,  setCost]    = useState('');
  const [stock, setStock]   = useState('0');
  const [min,   setMin]     = useState('10');

  const valid = label && sku && parseFloat(price) > 0 && parseFloat(cost) > 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{t('variants.newVariantTitle', 'Nueva variante')} — {group.name}</h3>
          <button className="icon-btn" onClick={onClose}><Icon name="close" /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-grid">
            <div className="field">
              <label className="field-label">{ATTR_LABEL[group.attrType] || t('variants.variant', 'Variante')}</label>
              <input className="field-input" placeholder={group.attrType === 'tamaño' ? 'Ej. 600ml' : group.attrType === 'peso' ? 'Ej. 1kg' : 'Ej. Original'}
                value={label} onChange={e => setLabel(e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label">{t('variants.skuBarcode', 'SKU / Código de barras')}</label>
              <input className="field-input mono" placeholder="7501XXXXXXXXX" value={sku} onChange={e => setSku(e.target.value)} />
            </div>
          </div>
          <div className="form-grid">
            <div className="field">
              <label className="field-label">{t('variants.salePrice', 'Precio de venta (Q)')}</label>
              <input type="number" className="field-input mono" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label">{t('variants.unitCost', 'Costo unitario (Q)')}</label>
              <input type="number" className="field-input mono" min="0" step="0.01" value={cost} onChange={e => setCost(e.target.value)} />
            </div>
          </div>
          <div className="form-grid">
            <div className="field">
              <label className="field-label">{t('variants.initialStock', 'Stock inicial')}</label>
              <input type="number" className="field-input mono" min="0" value={stock} onChange={e => setStock(e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label">{t('variants.minStock', 'Stock mínimo')}</label>
              <input type="number" className="field-input mono" min="0" value={min} onChange={e => setMin(e.target.value)} />
            </div>
          </div>
          {parseFloat(price) > 0 && parseFloat(cost) > 0 && (
            <div style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent)', borderRadius: 'var(--r-md)', padding: '8px 12px', fontSize: 12 }}>
              {t('common.margin', 'Margen')}: <strong>{Math.round(((parseFloat(price) - parseFloat(cost)) / parseFloat(price)) * 100)}%</strong>
              <span className="muted" style={{ marginLeft: 8 }}>{t('variants.profit', 'Utilidad')}: Q {(parseFloat(price) - parseFloat(cost)).toFixed(2)}</span>
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>{t('common.cancel', 'Cancelar')}</button>
          <button className="btn accent" disabled={!valid}
            onClick={() => onSave({ label, sku, price: parseFloat(price), cost: parseFloat(cost), stock: parseInt(stock) || 0, min: parseInt(min) || 10 })}>
            <Icon name="check" size={13} /> {t('variants.addVariant', 'Agregar variante')}
          </button>
        </div>
      </div>
    </div>
  );
}
