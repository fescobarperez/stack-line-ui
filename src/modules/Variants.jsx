// Stackline — Variantes de Producto
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import StatCard from '../components/StatCard.jsx';
import DataTable from '../components/DataTable.jsx';
import { useVariants } from '../hooks/useVariants.js';
import { useProducts } from '../hooks/useCatalog.js';
import { createVariant, updateVariant } from '../api/wave2.js';

const Q = v => `Q ${v.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
    } catch (err) { pushToast('No se pudo agregar la variante: ' + err.message, 'danger'); }
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
    } catch (err) { pushToast('No se pudo actualizar la variante: ' + err.message, 'danger'); }
  }

  const statusBg  = { ok: 'var(--success)', low: 'var(--warning)', out: 'var(--danger)' };
  const statusPill = { ok: 'success', low: 'warning', out: 'danger' };
  const statusTxt  = { ok: 'OK', low: t('variants.stockLow', 'Stock bajo'), out: t('variants.outOfStock', 'Agotada') };

  // Columnas de la tabla de grupos (CRUD → DataTable)
  const groupColumns = [
    { key: 'name', header: t('common.product', 'Producto'), sortable: true, render: (g) => (
      <div className="cell-stack">
        <span className="nm">{g.name}</span>
        {g.variants.some(v => !v.active) && <span className="sku">{g.variants.filter(v => !v.active).length} {t('variants.inactiveVariants', 'variante(s) inactiva(s)')}</span>}
      </div>
    ) },
    { key: 'brand', header: t('variants.brand', 'Marca'), sortable: true, render: (g) => <span className="sku">{g.brand}</span> },
    { key: 'cat', header: t('common.category', 'Categoría'), sortable: true, render: (g) => <span className="badge-m3 tertiary" style={{ textTransform: 'capitalize' }}>{g.cat}</span> },
    { key: 'attrType', header: t('variants.attribute', 'Atributo'), render: (g) => ATTR_LABEL[g.attrType] || g.attrType },
    { key: 'activeCount', header: t('variants.variantsCol', 'Variantes'), align: 'right', sortable: true, render: (g) => (
      <span className="num"><strong>{g.activeCount}</strong>{g.variants.length !== g.activeCount && <span className="sku" style={{ display: 'inline' }}> /{g.variants.length}</span>}</span>
    ) },
    { key: 'totalStock', header: t('variants.totalStock', 'Stock total'), align: 'right', sortable: true, render: (g) => <span className="num" style={{ color: g.totalStock === 0 ? 'var(--md-error)' : undefined }}>{g.totalStock}</span> },
    { key: 'price', header: t('variants.priceRange', 'Rango de precios'), align: 'right', render: (g) => <span className="num">{g.minPrice === g.maxPrice ? Q(g.minPrice) : `${Q(g.minPrice)} – ${Q(g.maxPrice)}`}</span> },
    { key: 'status', header: t('common.status', 'Estado'), render: (g) => (
      <>
        {g.variants.some(v => v.active && v.stock === 0) && <span className="badge-m3 error" style={{ marginRight: 4 }}>{t('variants.outOfStock', 'Agotada')}</span>}
        {g.variants.some(v => v.active && v.stock > 0 && v.stock < v.min) && <span className="badge-m3 warning">{t('variants.stockLow', 'Stock bajo')}</span>}
        {g.status === 'ok' && <span className="badge-m3 success">OK</span>}
      </>
    ) },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('variants.title', 'Variantes de Producto')}</h1>
          <div className="page-subtitle">{t('variants.subtitle', 'Grupos de variantes · tamaño, peso, sabor · SKUs por variante')}</div>
        </div>
        <div className="page-head-actions">
          <Button icon="plus" variant="accent" onClick={() => setGroupModal(true)}>{t('variants.newGroup', 'Nuevo grupo')}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <StatCard
          icon="box" tone="pri"
          label={t('variants.variantGroups', 'Grupos de variantes')}
          value={groups.length}
          foot={<>{totalVariants} {t('variants.totalVariants', 'variantes en total')}</>}
        />
        <StatCard
          icon="alert" tone="ter"
          label={t('variants.groupsWithAlerts', 'Grupos con alertas')}
          valueColor={alertGroups > 0 ? 'var(--danger)' : undefined}
          value={alertGroups}
          foot={<>{outGroups} {t('variants.outOfStock', 'agotadas')} · {lowGroups} {t('variants.stockLow', 'stock bajo')}</>}
        />
        <StatCard
          icon="chart" tone="sec"
          label={t('variants.mostUsedAttr', 'Tipo de atributo más usado')}
          value={t('variants.attrSize', 'Tamaño')}
          foot={<>5 {t('variants.of8groups', 'de 8 grupos')}</>}
        />
        <StatCard
          icon="check" tone="err"
          label={t('variants.variantCoverage', 'Cobertura de variantes')}
          valueColor={'var(--success)'}
          value={<>{Math.round((groups.reduce((s, g) => s + g.variants.filter(v => v.active && v.stock > v.min).length, 0) / totalVariants) * 100)}%</>}
          foot={t('variants.variantsWithStock', 'Variantes con stock suficiente')}
        />
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
      <DataTable
        rowKey={(g) => g.id}
        columns={groupColumns}
        rows={filtered}
        density="compact"
        pageSize={12}
        onRowClick={(g) => setSelected(g)}
        empty={t('variants.noGroupsWithFilters', 'Sin grupos con los filtros aplicados')}
      />

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
                <Button size="sm" icon="plus" onClick={() => { setVariantModal(selected); }}>{t('variants.variant', 'Variante')}
                </Button>
                <button className="icon-btn" onClick={() => setSelected(null)}><Icon name="close" /></button>
              </div>
            </div>
            <div className="drawer-body" style={{ padding: 0 }}>
              <table className="mtable">
                <thead>
                  <tr>
                    <th>{ATTR_LABEL[selected.attrType]}</th>
                    <th>SKU</th>
                    <th className="r">{t('common.price', 'Precio')}</th>
                    <th className="r">{t('common.cost', 'Costo')}</th>
                    <th className="r">Stock</th>
                    <th className="r">{t('variants.min', 'Mín.')}</th>
                    <th style={{ width: 80 }}>{t('common.status', 'Estado')}</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.variants.map((v) => {
                    const isOut = v.active && v.stock === 0;
                    const isLow = v.active && v.stock > 0 && v.stock < v.min;
                    return (
                      <tr key={v.sku} style={{ opacity: v.active ? 1 : 0.45 }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: isOut ? 'var(--danger)' : isLow ? 'var(--warning)' : 'var(--success)', flexShrink: 0 }} />
                            <span className="nm">{v.label}</span>
                          </div>
                        </td>
                        <td><span className="sku">{v.sku}</span></td>
                        <td className="r num">{Q(v.price)}</td>
                        <td className="r num" style={{ color: 'var(--muted)' }}>{Q(v.cost)}</td>
                        <td className="r num" style={{ fontWeight: 500, color: isOut ? 'var(--danger)' : isLow ? 'var(--warning)' : undefined }}>{v.stock}</td>
                        <td className="r num" style={{ color: 'var(--muted)' }}>{v.min}</td>
                        <td>
                          <button className={`chip ${v.active ? 'active' : ''}`} style={{ height: 28, padding: '0 10px', fontSize: 12 }}
                            onClick={() => { toggleVariant(selected, v); }}>
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
          <Button variant="ghost" onClick={onClose}>{t('common.cancel', 'Cancelar')}</Button>
          <Button icon="check" variant="accent" disabled={!valid} onClick={() => { const p = products.find(pp => String(pp.id) === String(productId)); onSave({ productId: Number(productId), name: p?.name || '', attrType }); }}>{t('variants.addVariant', 'Agregar variante')}
          </Button>
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
          <Button variant="ghost" onClick={onClose}>{t('common.cancel', 'Cancelar')}</Button>
          <Button icon="check" variant="accent" disabled={!valid} onClick={() => onSave({ label, sku, price: parseFloat(price), cost: parseFloat(cost), stock: parseInt(stock) || 0, min: parseInt(min) || 10 })}>{t('variants.addVariant', 'Agregar variante')}
          </Button>
        </div>
      </div>
    </div>
  );
}
