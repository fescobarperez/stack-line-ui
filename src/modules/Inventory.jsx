// Stackline — InventoryModule (ES module)
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import StatCard from '../components/StatCard.jsx';
import DataTable from '../components/DataTable.jsx';
import { useConfirm } from '../components/ConfirmDialog.jsx';
// Stackline — Inventory module
import React, { useState as useStateInv, useMemo as useMemoInv } from 'react';
import { useTranslation } from 'react-i18next';
import { useProducts, useCategories } from '../hooks/useCatalog.js';
import { useSuppliers, useBranches } from '../hooks/useMasters.js';
import { useStockMovements } from '../hooks/useOperations.js';

const Q = (v) => `Q ${Number(v || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const Qs = Q;

// itemType: sellable = se vende en POS · raw_material = se consume en proyectos
// · service = mano de obra, sin existencias.
// Etiqueta y color del tipo de artículo en la tabla.
const ITEM_TYPES = {
  sellable:     { label: 'POS',           variant: 'success' },
  raw_material: { label: 'Materia prima', variant: 'info'    },
  service:      { label: 'Servicio',      variant: 'warning' },
};

const EMPTY_FORM = { name: '', sku: '', cat: '', unit: 'Unidad', purchaseUnit: '', purchaseFactor: '', itemType: 'sellable', supplierId: '', cost: '', price: '', stock: '', min: '', desc: '', active: true, lots: false };

function InventoryModule({ pushToast }) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  // Datos reales desde el backend (con fallback automático al mock).
  const { items: PRODUCTS, reload: reloadProducts, create: createProductApi, update: updateProductApi, remove: removeProductApi } = useProducts();
  const CATEGORIES = useCategories();
  const { items: SUPPLIERS } = useSuppliers();
  const { items: BRANCHES } = useBranches();
  const { items: movementsRaw } = useStockMovements();
  // Kardex: mapea los movimientos del backend a la forma de la vista.
  const STOCK_MOVEMENTS = useMemoInv(() => movementsRaw.map((m) => ({
    date: m.createdAt ? new Date(m.createdAt).toISOString().slice(0, 10) : '',
    type: m.movementType,
    sku: String(m.productId ?? ''),
    name: m.productName,
    qty: Number(m.quantity || 0),
    ref: m.refId || '—',
    user: m.userId ? `#${m.userId}` : '—',
  })), [movementsRaw]);
  // Stock bajo: derivado de los productos reales.
  const LOW_STOCK = useMemoInv(() => PRODUCTS.filter((p) => Number(p.stock) < Number(p.min)), [PRODUCTS]);
  // Vencimientos: el backend aún no expone lotes/vencimientos en el catálogo → vacío.
  const EXPIRING_SOON = [];
  const [tab, setTab] = useStateInv('productos');
  const [cat, setCat] = useStateInv('todos');
  const [search, setSearch] = useStateInv('');
  const [stockFilter, setStockFilter] = useStateInv('all'); // all, low, ok, out
  const [selected, setSelected] = useStateInv(null);
  const [selRows, setSelRows] = useStateInv([]);
  const [showNew, setShowNew] = useStateInv(false);
  const [form, setForm] = useStateInv(EMPTY_FORM);
  const [editingId, setEditingId] = useStateInv(null);
  const [saving, setSaving] = useStateInv(false);

  const filtered = useMemoInv(() => {
    let p = PRODUCTS;
    if (cat !== 'todos') p = p.filter(x => x.cat === cat);
    if (search) {
      const q = search.toLowerCase();
      p = p.filter(x => x.name.toLowerCase().includes(q) || x.sku.includes(search));
    }
    if (stockFilter === 'low')  p = p.filter(x => x.stock > 0 && x.stock < x.min);
    if (stockFilter === 'ok')   p = p.filter(x => x.stock >= x.min);
    if (stockFilter === 'out')  p = p.filter(x => x.stock === 0);
    return p;
  }, [cat, search, stockFilter, PRODUCTS]);

  const totalValueCost = PRODUCTS.reduce((s, p) => s + p.cost * p.stock, 0);
  const totalValueSale = PRODUCTS.reduce((s, p) => s + p.price * p.stock, 0);
  const totalStock = filtered.reduce((s, p) => s + Number(p.stock || 0), 0);

  // Acciones de producto (reutilizadas por la tabla y el drawer de detalle)
  const firstCatId = () => (CATEGORIES.find(c => c.id !== 'todos') || {}).id ?? '';

  const openNew = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, cat: firstCatId() });
    setShowNew(true);
  };
  const viewProduct = (p) => setSelected(p);
  const editProduct = (p) => {
    // Redirige al formulario en modo edición, precargando los datos del producto.
    setSelected(null);
    setEditingId(p.id);
    setForm({
      name: p.name ?? '', sku: p.sku ?? '', cat: p.cat ?? firstCatId(),
      unit: p.unit ?? 'Unidad',
      purchaseUnit: p.purchaseUnit ?? '',
      purchaseFactor: (p.purchaseFactor ?? 1) == 1 ? '' : String(p.purchaseFactor),
      itemType: p.itemType ?? 'sellable', supplierId: p.supplierId ?? '',
      cost: p.cost ?? '', price: p.price ?? '', stock: p.stock ?? '', min: p.min ?? '',
      desc: p.description ?? '', active: (p.status ?? 'ACTIVE') !== 'INACTIVE', lots: !!p.lots,
    });
    setShowNew(true);
  };
  const saveProduct = async () => {
    if (!form.name.trim() || !form.sku.trim()) {
      if (pushToast) pushToast('Nombre y SKU son obligatorios', 'danger');
      return;
    }
    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      categoryId: form.cat || null,
      unit: form.unit,
      // Vacío = se compra como se guarda. El backend normaliza el factor a 1.
      purchaseUnit: form.purchaseUnit.trim() || null,
      purchaseFactor: Number(form.purchaseFactor) || 1,
      itemType: form.itemType,
      cost: Number(form.cost) || 0,
      price: Number(form.price) || 0,
      minStock: Number(form.min) || 0,
      status: form.active ? 'ACTIVE' : 'INACTIVE',
    };
    setSaving(true);
    try {
      if (editingId != null) {
        await updateProductApi(editingId, payload);
        if (pushToast) pushToast(`"${payload.name}" actualizado`, 'success');
      } else {
        await createProductApi(payload);
        if (pushToast) pushToast(`"${payload.name}" creado`, 'success');
      }
      setShowNew(false);
    } catch (err) {
      if (pushToast) pushToast(err?.message || 'No se pudo guardar el producto', 'danger');
    } finally {
      setSaving(false);
    }
  };
  const deleteProduct = async (p) => {
    const ok = await confirm({
      title: 'Eliminar producto',
      message: `¿Seguro que querés eliminar "${p.name}"? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      danger: true,
      icon: 'trash',
    });
    if (!ok) return;
    try {
      await removeProductApi(p.id);
      if (pushToast) pushToast(`"${p.name}" eliminado`, 'success');
      if (selected && selected.id === p.id) setSelected(null);
    } catch (err) {
      if (pushToast) pushToast(err?.message || 'No se pudo eliminar el producto', 'danger');
    }
  };

  // Columnas de la tabla de productos (demo del componente <DataTable>)
  const catName = (id) => CATEGORIES.find(c => c.id === id)?.name;
  const productColumns = [
    { key: 'sku', header: t('inventory.headers.sku', 'SKU / Código'), sortable: true, mono: true },
    { key: 'name', header: t('inventory.headers.product', 'Producto'), sortable: true,
      render: (p) => (<><div style={{ fontWeight: 500 }}>{p.name}</div><div className="muted" style={{ fontSize: 11 }}>{p.unit}</div></>) },
    { key: 'cat', header: t('inventory.headers.category', 'Categoría'), sortable: true,
      sortValue: (p) => catName(p.cat), render: (p) => catName(p.cat) },
    { key: 'itemType', header: t('inventory.headers.itemType', 'Tipo'), sortable: true,
      render: (p) => {
        const it = ITEM_TYPES[p.itemType] || ITEM_TYPES.sellable;
        return <span className={`badge-m3 ${it.variant}`}>{it.label}</span>;
      } },
    { key: 'cost', header: t('inventory.headers.cost', 'Costo'), align: 'right', sortable: true, render: (p) => Q(p.cost) },
    { key: 'price', header: t('inventory.headers.price', 'Precio'), align: 'right', sortable: true,
      render: (p) => (<span style={{ fontWeight: 500 }}>{Q(p.price)}</span>) },
    { key: 'margin', header: t('inventory.headers.margin', 'Margen'), align: 'right', sortable: true,
      sortValue: (p) => ((p.price - p.cost) / p.price * 100),
      render: (p) => { const m = ((p.price - p.cost) / p.price * 100); return <span style={{ color: m > 30 ? 'var(--success)' : m > 15 ? 'var(--text-2)' : 'var(--warning)' }}>{m.toFixed(1)}%</span>; } },
    { key: 'stock', header: t('inventory.headers.stock', 'Stock'), align: 'right', sortable: true,
      render: (p) => (<span style={{ fontWeight: 500, color: p.stock === 0 ? 'var(--danger)' : p.stock < p.min ? 'var(--warning)' : 'var(--text)' }}>{p.stock}</span>) },
    { key: 'min', header: t('inventory.headers.min', 'Mín'), align: 'right', sortable: true, className: 'muted' },
    { key: 'batch', header: t('inventory.headers.lot', 'Lote'), mono: true, className: 'muted', render: (p) => p.batch || '—' },
    { key: 'exp', header: t('inventory.headers.expires', 'Vence'), mono: true, className: 'muted', render: (p) => p.exp || '—' },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('inventory.title', 'Inventario')}</h1>
          <div className="page-subtitle">{PRODUCTS.length} SKUs activos · {CATEGORIES.length - 1} categorías · Valor cost. <span className="mono">{Qs(totalValueCost)}</span></div>
        </div>
        <div className="page-head-actions">
          <Button icon="upload">{t('common.import', 'Importar')}</Button>
          <Button icon="download">{t('common.export', 'Exportar')}</Button>
          <Button icon="plus" variant="accent" onClick={openNew}>{t('inventory.newProduct', 'Nuevo producto')}</Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="stat-grid">
        <StatCard
          icon="box" tone="pri"
          label="Total SKUs"
          value={PRODUCTS.length.toLocaleString()}
          foot={<>{CATEGORIES.length - 1} categorías</>}
        />
        <StatCard
          icon="cash" tone="ter"
          label="Valor inventario (costo)"
          value={Qs(totalValueCost)}
          trend={{ dir: 'up', label: "4.2% vs mes anterior" }}
        />
        <StatCard
          icon="tag" tone="sec"
          label="Margen potencial"
          value={Qs(totalValueSale - totalValueCost)}
          foot={<>{((totalValueSale - totalValueCost)/totalValueCost*100).toFixed(1)}% sobre costo</>}
        />
        <StatCard
          icon="alert" tone="err"
          label="Requiere atención"
          valueColor={'var(--warning)'}
          value={LOW_STOCK.length + EXPIRING_SOON.filter(p => p.daysLeft < 30).length}
          trend={{ dir: 'down', label: <>{LOW_STOCK.length} bajo · {EXPIRING_SOON.filter(p => p.daysLeft < 30).length} vencen pronto</> }}
        />
      </div>

      {/* Tabs */}
      <div className="tabs">
        <div className={`tab ${tab==='productos'?'active':''}`} onClick={() => setTab('productos')}>
          {t('inventory.tabs.products', 'Productos')} <span className="count">{PRODUCTS.length}</span>
        </div>
        <div className={`tab ${tab==='kardex'?'active':''}`} onClick={() => setTab('kardex')}>
          {t('inventory.tabs.movements', 'Kárdex / Movimientos')} <span className="count">{STOCK_MOVEMENTS.length}</span>
        </div>
        <div className={`tab ${tab==='lotes'?'active':''}`} onClick={() => setTab('lotes')}>
          {t('inventory.tabs.lots', 'Lotes & vencimientos')} <span className="count">{EXPIRING_SOON.length}</span>
        </div>
        <div className={`tab ${tab==='alertas'?'active':''}`} onClick={() => setTab('alertas')}>
          {t('inventory.tabs.alerts', 'Alertas')} <span className="count" style={{color:'var(--danger)'}}>{LOW_STOCK.length}</span>
        </div>
        <div className={`tab ${tab==='ajustes'?'active':''}`} onClick={() => setTab('ajustes')}>
          Ajustes &amp; transferencias
        </div>
        <div className={`tab ${tab==='valoracion'?'active':''}`} onClick={() => setTab('valoracion')}>
          Valoración
        </div>
      </div>

      {tab === 'productos' && (
        <>
          <div className="filterbar">
            <div style={{position:'relative', width:280}}>
              <Icon name="search" size={12} style={{position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', color:'var(--muted)'}}/>
              <input className="input" style={{width:'100%', paddingLeft:26}} placeholder={t('inventory.searchPlaceholder', 'Buscar SKU, código de barras o nombre…')} value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
            <select className="input" value={cat} onChange={e=>setCat(e.target.value)}>
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="row gap-6">
              {[
                ['all', t('common.all', 'Todos')],
                ['ok', 'Stock OK'],
                ['low', 'Stock bajo'],
                ['out', 'Agotados']
              ].map(([id, lbl]) => (
                <button key={id} className={`chip ${stockFilter===id?'active':''}`} onClick={()=>setStockFilter(id)}>{lbl}</button>
              ))}
            </div>
            <div className="grow"></div>
            <span className="muted mono" style={{fontSize:11}}>{filtered.length} resultados</span>
            <Button icon="filter" size="sm">{t('common.filter', 'Filtrar')}</Button>
          </div>

          <DataTable
            rowKey={(p) => p.sku}
            columns={productColumns}
            rows={filtered}
            selectable
            selected={selRows}
            onSelectedChange={setSelRows}
            pageSize={12}
            density="compact"
            totals={{ sku: 'Total', stock: totalStock }}
            title={`${filtered.length} productos`}
            onRowClick={viewProduct}
            onView={viewProduct}
            onEdit={editProduct}
            onDelete={deleteProduct}
            onRefresh={() => { reloadProducts(); pushToast && pushToast('Actualizando productos…'); }}
            empty={t('inventory.empty', 'Sin productos que coincidan con el filtro')}
            emptyIcon="box"
          />
        </>
      )}

      {tab === 'kardex' && (
        <>
          <div className="filterbar">
            <input className="input" placeholder={t('inventory.searchMovements', 'Buscar producto, SKU o ref…')} style={{width:280}}/>
            <select className="input">
              <option>Todos los movimientos</option>
              <option>Ventas</option>
              <option>Recepciones</option>
              <option>Transferencias</option>
              <option>Ajustes</option>
            </select>
            <select className="input">
              <option>Todas las sucursales</option>
              {BRANCHES.map(b => <option key={b.id}>{b.name}</option>)}
            </select>
            <div className="grow"></div>
            <Button icon="calendar" size="sm">Mayo 2026</Button>
            <Button icon="download" size="sm">{t('inventory.exportMovements', 'Exportar')}</Button>
          </div>
          <div className="card card-outlined">
            <table className="mtable">
              <thead>
                <tr>
                  <th>{t('inventory.headers.date', 'Fecha')}</th>
                  <th>{t('inventory.headers.type', 'Tipo')}</th>
                  <th>{t('inventory.headers.sku', 'SKU / Código')}</th>
                  <th>{t('inventory.headers.product', 'Producto')}</th>
                  <th className="r">{t('inventory.headers.quantity', 'Cantidad')}</th>
                  <th>{t('inventory.headers.reference', 'Referencia')}</th>
                  <th>{t('inventory.headers.user', 'Usuario')}</th>
                </tr>
              </thead>
              <tbody>
                {STOCK_MOVEMENTS.map((m, i) => (
                  <tr key={i}>
                    <td className="num">{m.date}</td>
                    <td>
                      {m.type === 'sale' && <span className="badge-m3"><Icon name="receipt" size={14}/>Venta</span>}
                      {m.type === 'reception' && <span className="badge-m3 success"><Icon name="truck" size={14}/>Recepción</span>}
                      {m.type === 'transfer' && <span className="badge-m3 tertiary"><Icon name="transfer" size={14}/>Transferencia</span>}
                      {m.type === 'adjustment' && <span className="badge-m3 warning"><Icon name="edit" size={14}/>Ajuste</span>}
                    </td>
                    <td><span className="sku">{m.sku.slice(-7)}</span></td>
                    <td>{m.name}</td>
                    <td className="r num" style={{ color: m.qty> 0 ? 'var(--md-success)' : 'var(--md-error)', fontWeight:500 }}>
                      {m.qty > 0 ? '+' : ''}{m.qty}
                    </td>
                    <td><span className="sku">{m.ref}</span></td>
                    <td>{m.user}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'lotes' && (
        <>
          <div className="filterbar">
            <input className="input" placeholder={t('inventory.searchLots', 'Buscar lote o producto…')} style={{width:280}}/>
            <div className="row gap-6">
              <button className="chip active">{t('common.all', 'Todos')}</button>
              <button className="chip">&lt; 7 días</button>
              <button className="chip">&lt; 30 días</button>
              <button className="chip">&lt; 90 días</button>
              <button className="chip">Vencidos</button>
            </div>
            <div className="grow"></div>
            <Button icon="tag" variant="accent" size="sm">{t('inventory.createPromoExpiring', 'Crear promoción para vencimientos')}</Button>
          </div>
          <div className="card">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t('inventory.headers.lot', 'Lote')}</th>
                  <th>{t('inventory.headers.product', 'Producto')}</th>
                  <th>{t('inventory.headers.branch', 'Sucursal')}</th>
                  <th className="num">{t('inventory.headers.stock', 'Stock')}</th>
                  <th>{t('inventory.headers.expires', 'Vence')}</th>
                  <th>{t('inventory.headers.days', 'Días')}</th>
                  <th>{t('inventory.headers.status', 'Estado')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {EXPIRING_SOON.concat(PRODUCTS.filter(p => p.batch && p.exp).slice(0,10)).slice(0,15).map((p, i) => {
                  const days = p.daysLeft ?? Math.floor((new Date(p.exp + (p.exp.length===7?'-15':'')).getTime() - Date.now())/86400000);
                  return (
                    <tr key={p.sku + '_' + i}>
                      <td className="code">{p.batch || '—'}</td>
                      <td>
                        <div style={{fontWeight:500}}>{p.name}</div>
                        <div className="code muted" style={{fontSize: 11}}>{p.sku}</div>
                      </td>
                      <td>Zona 10</td>
                      <td className="num">{p.stock}</td>
                      <td className="code">{p.exp}</td>
                      <td className="num" style={{ color: days < 30 ? 'var(--danger)' : days < 90 ? 'var(--warning)' : 'var(--text-2)', fontWeight:500 }}>
                        {days}d
                      </td>
                      <td>
                        {days < 0 && <span className="badge-m3 danger">Vencido</span>}
                        {days >= 0 && days < 30 && <span className="badge-m3 danger"><span className="dot"/>Crítico</span>}
                        {days >= 30 && days < 90 && <span className="badge-m3 warning"><span className="dot"/>Atención</span>}
                        {days >= 90 && <span className="badge-m3 success"><span className="dot"/>OK</span>}
                      </td>
                      <td><Button icon="tag" variant="ghost" size="sm">Promo</Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'alertas' && (
        <>
          <div className="alert" style={{marginBottom:12}}>
            <Icon name="alert" size={14}/>
            <span><strong>{LOW_STOCK.length} productos</strong> {t('inventory.lowStockWarning', 'están por debajo del stock mínimo y requieren reorden.')} Sugerencia: generar órdenes de compra automáticas con los proveedores asignados.</span>
            <Button variant="accent" size="sm" style={{marginLeft:'auto' }}>Generar OCs automáticas</Button>
          </div>

          <div className="card">
            <div className="card-head">
              <h3>{t('inventory.lowStockCard', 'Productos bajo stock mínimo')}</h3>
              <span className="muted mono" style={{fontSize:11}}>{LOW_STOCK.length} de {PRODUCTS.length} SKUs</span>
            </div>
            <div className="card-body flush">
              <table className="tbl">
                <thead>
                  <tr>
                    <th><input type="checkbox"/></th>
                    <th>{t('inventory.headers.sku', 'SKU / Código')}</th>
                    <th>{t('inventory.headers.product', 'Producto')}</th>
                    <th className="num">Stock actual</th>
                    <th className="num">Stock mínimo</th>
                    <th className="num">{t('inventory.headers.suggested', 'Sugerido')}</th>
                    <th>{t('inventory.headers.supplier', 'Proveedor')}</th>
                    <th>Cobertura</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {LOW_STOCK.map((p, i) => {
                    const suggested = (p.min * 2) - p.stock;
                    const pct = (p.stock / p.min) * 100;
                    return (
                      <tr key={p.sku}>
                        <td><input type="checkbox" defaultChecked/></td>
                        <td className="code">{p.sku.slice(-7)}</td>
                        <td><div style={{fontWeight:500}}>{p.name}</div></td>
                        <td className="num">
                          <span style={{color:'var(--danger)', fontWeight: 500}}>{p.stock}</span>
                        </td>
                        <td className="num muted">{p.min}</td>
                        <td className="num" style={{ fontWeight:500, color:'var(--accent)' }}>+{suggested}</td>
                        <td>{SUPPLIERS[i % SUPPLIERS.length].name.split(',')[0]}</td>
                        <td>
                          <div className="bar danger" style={{width:80}}>
                            <div style={{width: Math.min(100, pct) + '%'}}/>
                          </div>
                        </td>
                        <td><Button icon="truck" size="sm">OC</Button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'ajustes' && (
        <div className="grid-2">
          <div className="card">
            <div className="card-head"><h3>{t('inventory.adjustment.title', 'Nuevo ajuste de inventario')}</h3></div>
            <div className="card-body" style={{display:'flex', flexDirection:'column', gap:10}}>
              <div className="field"><label>{t('inventory.adjustment.product', 'Producto')}</label><input placeholder="Buscar por SKU o nombre…"/></div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
                <div className="field"><label>{t('common.type', 'Tipo')}</label>
                  <select>
                    <option>Merma / Pérdida</option>
                    <option>Rotura / Daño</option>
                    <option>Vencimiento</option>
                    <option>Conteo físico</option>
                    <option>Devolución cliente</option>
                  </select>
                </div>
                <div className="field"><label>{t('inventory.adjustment.quantity', 'Cantidad')}</label><input type="number" placeholder="0"/></div>
              </div>
              <div className="field"><label>{t('common.branch', 'Sucursal')}</label>
                <select>{BRANCHES.map(b => <option key={b.id}>{b.name}</option>)}</select>
              </div>
              <div className="field"><label>Justificación</label>
                <textarea rows="3" placeholder={t('inventory.adjustment.reason', 'Detalle de la razón del ajuste…')}></textarea>
              </div>
              <div className="row gap-8" style={{marginTop:6}}>
                <Button icon="check" variant="accent">Registrar ajuste</Button>
                <Button>{t('common.cancel', 'Cancelar')}</Button>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h3>{t('inventory.transfer.title', 'Nueva transferencia entre sucursales')}</h3></div>
            <div className="card-body" style={{display:'flex', flexDirection:'column', gap:10}}>
              <div style={{display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:8, alignItems:'end'}}>
                <div className="field"><label>Desde</label>
                  <select>{BRANCHES.map(b => <option key={b.id}>{b.name}</option>)}</select>
                </div>
                <div style={{height:30, display:'grid', placeItems:'center', color:'var(--accent)'}}><Icon name="transfer" size={18}/></div>
                <div className="field"><label>Hacia</label>
                  <select>{BRANCHES.map(b => <option key={b.id}>{b.name}</option>)}</select>
                </div>
              </div>
              <div className="field"><label>{t('common.product', 'Producto')}</label>
                <div style={{border:'1px dashed var(--border)', borderRadius:'var(--r-md)', padding:18, textAlign:'center', color:'var(--muted)', fontSize:12}}>
                  Arrastra productos aquí o usa el escáner
                </div>
              </div>
              <div className="field"><label>{t('inventory.transfer.carrier', 'Transportista / chofer')}</label><input placeholder={t('inventory.transfer.carrierPlaceholder', 'Nombre del responsable')}/></div>
              <div className="row gap-8" style={{marginTop:6}}>
                <Button icon="truck" variant="accent">{t('inventory.transfer.create', 'Crear transferencia')}</Button>
                <Button>{t('common.saveDraft', 'Guardar borrador')}</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'valoracion' && (
        <div>
          <div className="stat-grid" style={{marginBottom:16}}>
            <StatCard
              icon="cash" tone="pri"
              label="Valor costo promedio"
              value={Qs(PRODUCTS.reduce((s, p) => s + (p.avgCost || p.cost) * p.stock, 0))}
              foot="Método: Promedio Ponderado"
            />
            <StatCard
              icon="tag" tone="ter"
              label="Valor a precio de venta"
              value={Qs(PRODUCTS.reduce((s, p) => s + p.price * p.stock, 0))}
              trend={{ dir: 'up', label: <>Margen bruto potencial {((1 - PRODUCTS.reduce((s, p) => s + (p.avgCost||p.cost)*p.stock,0) / PRODUCTS.reduce((s, p) => s + p.price*p.stock,0))*100).toFixed(1)}%</> }}
            />
            <StatCard
              icon="box" tone="sec"
              label="SKUs con costo promedio"
              value={PRODUCTS.filter(p => p.avgCost).length}
              foot={<>de {PRODUCTS.length} activos</>}
            />
            <StatCard
              icon="arrowUp" tone="err"
              label="Variación vs. costo base"
              valueColor={'var(--success)'}
              value={<>{((PRODUCTS.reduce((s,p)=>s+(p.avgCost||p.cost)*p.stock,0)/PRODUCTS.reduce((s,p)=>s+p.cost*p.stock,0)-1)*100).toFixed(2)}%</>}
              foot="Promedio vs. costo estándar"
            />
          </div>
          <div className="card">
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>{t('inventory.headers.sku', 'SKU / Código')}</th>
                    <th>{t('inventory.headers.product', 'Producto')}</th>
                    <th className="num">{t('inventory.headers.stock', 'Stock')}</th>
                    <th className="num">Costo base</th>
                    <th className="num">Costo prom.</th>
                    <th className="num">Variación</th>
                    <th className="num">Valor (avg)</th>
                    <th className="num">Valor (venta)</th>
                  </tr>
                </thead>
                <tbody>
                  {PRODUCTS.map(p => {
                    const avg = p.avgCost || p.cost;
                    const diff = ((avg - p.cost) / p.cost * 100);
                    return (
                      <tr key={p.sku}>
                        <td className="mono muted">{p.sku}</td>
                        <td style={{fontWeight:500}}>{p.name}</td>
                        <td className="num mono">{p.stock}</td>
                        <td className="num mono muted">{Q(p.cost)}</td>
                        <td className="num mono">{Q(avg)}</td>
                        <td className="num">
                          <span style={{fontSize:11, color: diff > 0 ? 'var(--danger)' : diff < 0 ? 'var(--success)' : 'var(--muted)', fontWeight: 500}}>
                            {diff >= 0 ? '+' : ''}{diff.toFixed(2)}%
                          </span>
                        </td>
                        <td className="num mono">{Qs(avg * p.stock)}</td>
                        <td className="num mono muted">{Qs(p.price * p.stock)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Detail drawer */}
      {selected && (
        <>
          <div className="drawer-overlay" onClick={() => setSelected(null)}/>
          <div className="drawer">
            <div className="drawer-head">
              <div>
                <div className="code muted" style={{fontSize:11}}>{selected.sku}</div>
                <h3 style={{margin:0, marginTop:2, fontSize: 16}}>{selected.name}</h3>
              </div>
              <button className="icon-btn" onClick={() => setSelected(null)}><Icon name="x"/></button>
            </div>
            <div className="drawer-body">
              <div className="stat-grid" style={{gridTemplateColumns:'1fr 1fr', marginBottom:12}}>
                <StatCard
                  tone="pri"
                  label="Stock total"
                  value={selected.stock}
                  foot={<>Mín {selected.min} · {selected.unit}</>}
                />
                <StatCard
                  tone="ter"
                  label={t('inventory.headers.price', 'Precio')}
                  value={Q(selected.price)}
                  trend={{ dir: 'up', label: <>Margen {((selected.price-selected.cost)/selected.price*100).toFixed(1)}%</> }}
                />
              </div>

              <div className="card" style={{marginBottom:12}}>
                <div className="card-head"><h3>{t('inventory.generalData', 'Datos generales')}</h3><Button icon="edit" variant="ghost" size="sm" onClick={() => editProduct(selected)}>{t('common.edit', 'Editar')}</Button></div>
                <div className="card-body" style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px 14px', fontSize: 12}}>
                  <div><div className="muted" style={{fontSize:11}}>{t('inventory.headers.category', 'Categoría')}</div><div>{CATEGORIES.find(c=>c.id===selected.cat)?.name}</div></div>
                  <div><div className="muted" style={{fontSize:11}}>Unidad</div><div>{selected.unit}</div></div>
                  <div><div className="muted" style={{fontSize:11}}>Costo unitario</div><div className="mono">{Q(selected.cost)}</div></div>
                  <div><div className="muted" style={{fontSize:11}}>Precio venta</div><div className="mono">{Q(selected.price)}</div></div>
                  <div><div className="muted" style={{fontSize:11}}>Lote actual</div><div className="mono">{selected.batch || '—'}</div></div>
                  <div><div className="muted" style={{fontSize:11}}>Vencimiento</div><div className="mono">{selected.exp || '—'}</div></div>
                </div>
              </div>

              <div className="card">
                <div className="card-head"><h3>Stock por sucursal</h3></div>
                <div className="card-body flush">
                  <table className="tbl">
                    <thead><tr><th>{t('inventory.headers.branch', 'Sucursal')}</th><th className="num">{t('inventory.headers.stock', 'Stock')}</th><th className="num">{t('inventory.headers.min', 'Mín')}</th><th>{t('inventory.headers.status', 'Estado')}</th></tr></thead>
                    <tbody>
                      {BRANCHES.map((b, i) => {
                        const s = Math.max(0, Math.floor(selected.stock * (0.1 + 0.25 * Math.random() + i*0.05)));
                        return (
                          <tr key={b.id}>
                            <td>{b.name}</td>
                            <td className="num">{s}</td>
                            <td className="num muted">{Math.floor(selected.min/3)}</td>
                            <td>
                              {s < selected.min/3 ? <span className="badge-m3 warning"><span className="dot"/>Bajo</span> : <span className="badge-m3 success"><span className="dot"/>OK</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="drawer-foot">
              <Button icon="trash" variant="danger" onClick={() => deleteProduct(selected)}>{t('common.delete', 'Eliminar')}</Button>
              <Button icon="edit" variant="accent" onClick={() => editProduct(selected)}>{t('inventory.editProduct', 'Editar producto')}</Button>
            </div>
          </div>
        </>
      )}

      {/* Product form modal (crear / editar) */}
      {showNew && (
        <div className="modal-overlay" onClick={() => !saving && setShowNew(false)}>
          <div className="modal" style={{width:640}} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{editingId != null ? t('inventory.editProduct', 'Editar producto') : t('inventory.newProduct', 'Nuevo producto')}</h3>
              <button className="icon-btn" onClick={() => setShowNew(false)}><Icon name="x"/></button>
            </div>
            <div className="modal-body" style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px 14px'}}>
              <div className="field" style={{gridColumn:'1 / -1'}}><label>Nombre del producto</label>
                <input placeholder="Ej. Coca-Cola 600ml" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}/></div>
              <div className="field"><label>Código de barras / SKU</label>
                <input placeholder="7501..." value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}/></div>
              <div className="field"><label>{t('inventory.headers.category', 'Categoría')}</label>
                <select value={form.cat} onChange={e => setForm(f => ({ ...f, cat: e.target.value }))}>
                  {CATEGORIES.filter(c=>c.id!=='todos').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="field"><label>{t('inventory.itemType', 'Tipo de artículo')}</label>
                <select value={form.itemType}
                  onChange={e => setForm(f => ({ ...f, itemType: e.target.value }))}>
                  <option value="sellable">{t('inventory.itemTypeSellable', 'Vendible (POS)')}</option>
                  <option value="raw_material">{t('inventory.itemTypeRaw', 'Materia prima')}</option>
                  <option value="service">{t('inventory.itemTypeService', 'Servicio / mano de obra')}</option>
                </select>
                <span className="cfg-hint">
                  {form.itemType === 'sellable'
                    ? t('inventory.itemTypeHintSellable', 'Se ofrece en el punto de venta.')
                    : form.itemType === 'raw_material'
                      ? t('inventory.itemTypeHintRaw', 'No se vende en POS. Su costo se imputa al consumirla en un proyecto.')
                      : t('inventory.itemTypeHintService', 'Sin existencias. Se imputa como mano de obra.')}
                </span>
              </div>
              <div className="field"><label>Unidad de medida</label>
                <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                  <option>Unidad</option><option>Paquete</option><option>Kg</option><option>Libra</option><option>Litro</option>
                </select>
              </div>
              {/* Solo para lo que se compra en una presentación y se gasta en
                  otra: un paquete de 100 tornillos que se consumen de a uno.
                  Vacío es el caso normal —comprar y guardar en lo mismo—. */}
              <div className="field-row" style={{ gridColumn: '1 / -1' }}>
                <div className="field"><label>Unidad de compra</label>
                  <input value={form.purchaseUnit} placeholder="Paquete, Caja…"
                    onChange={e => setForm(f => ({ ...f, purchaseUnit: e.target.value }))} />
                </div>
                <div className="field">
                  <label>{form.purchaseUnit
                    ? `${form.unit} por ${form.purchaseUnit.toLowerCase()}`
                    : 'Unidades por unidad de compra'}</label>
                  <input type="number" min="0" step="0.000001" className="mono"
                    value={form.purchaseFactor} placeholder="1"
                    onChange={e => setForm(f => ({ ...f, purchaseFactor: e.target.value }))} />
                </div>
              </div>
              <div className="field"><label>{t('inventory.headers.supplier', 'Proveedor')}</label>
                <select value={form.supplierId} onChange={e => setForm(f => ({ ...f, supplierId: e.target.value }))}>
                  <option value="">—</option>
                  {SUPPLIERS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="field"><label>Costo unitario (Q)</label>
                <input type="number" placeholder="0.00" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))}/></div>
              <div className="field"><label>Precio venta (Q)</label>
                <input type="number" placeholder="0.00" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}/></div>
              <div className="field"><label>Stock inicial</label>
                <input type="number" placeholder="0" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} disabled={editingId != null}/></div>
              <div className="field"><label>Stock mínimo</label>
                <input type="number" placeholder="0" value={form.min} onChange={e => setForm(f => ({ ...f, min: e.target.value }))}/></div>
              <div className="field" style={{gridColumn:'1 / -1'}}>
                <label>{t('common.description', 'Descripción')} / Notas</label>
                <textarea rows="2" placeholder="Detalles, presentación, observaciones…" value={form.desc} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))}></textarea>
              </div>
              <div className="row gap-8" style={{gridColumn:'1 / -1'}}>
                <label className="row gap-6" style={{fontSize:12}}>
                  <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}/>Producto activo en POS
                </label>
                <label className="row gap-6" style={{fontSize:12}}>
                  <input type="checkbox" checked={form.lots} onChange={e => setForm(f => ({ ...f, lots: e.target.checked }))}/>Maneja lotes y vencimientos
                </label>
              </div>
            </div>
            <div className="modal-foot">
              <Button onClick={() => setShowNew(false)} disabled={saving}>{t('common.cancel', 'Cancelar')}</Button>
              <Button icon="check" variant="accent" onClick={saveProduct} disabled={saving}>{saving ? t('common.saving', 'Guardando…') : (editingId != null ? t('common.saveChanges', 'Guardar cambios') : t('inventory.newProduct', 'Nuevo producto'))}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default InventoryModule;
