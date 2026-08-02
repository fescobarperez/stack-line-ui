// ERP MAYA — Módulo de Compras / Órdenes de Compra
import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from '../components/Icon.jsx';
import { usePurchaseOrders } from '../hooks/useOperations.js';
import { useSuppliers } from '../hooks/useMasters.js';
import { useBranches } from '../hooks/useMasters.js';
import { useProducts } from '../hooks/useCatalog.js';

const STATUS_LABEL = { pending: 'Pendiente', partial: 'Parcial', received: 'Recibida', cancelled: 'Cancelada', draft: 'Borrador' };
const STATUS_CLASS  = { pending: 'warning', partial: 'info', received: 'success', cancelled: 'neutral', draft: 'neutral' };

function fmt(n) { return `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

// ── Modal: Recibir ítems ─────────────────────────────────────────────────────
function ReceiveModal({ po, onSave, onClose }) {
  const { t } = useTranslation();
  const pending = po.items.filter(i => i.qtyReceived < i.qtyOrdered);
  const [qtys, setQtys] = useState(() => Object.fromEntries(pending.map(i => [i.id, i.qtyOrdered - i.qtyReceived])));

  const setQty = (id, val) => setQtys(prev => ({ ...prev, [id]: Math.max(0, Math.min(Number(val), po.items.find(i => i.id === id).qtyOrdered - po.items.find(i => i.id === id).qtyReceived)) }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const received = pending.filter(i => qtys[i.id] > 0).map(i => ({ itemId: i.id, qty: qtys[i.id] }));
    if (!received.length) return;
    onSave(received);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-title">{t('purchases.receiveTitle', 'Recibir mercancía')}</div>
            <div className="muted" style={{ fontSize: 12 }}>{po.id} · {po.supplier}</div>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('common.product', 'Producto')}</th>
                  <th className="right">{t('purchases.ordered', 'Pedido')}</th>
                  <th className="right">{t('purchases.alreadyReceived', 'Ya recibido')}</th>
                  <th className="right" style={{ width: 120 }}>{t('purchases.receiveNow', 'Recibir ahora')}</th>
                </tr>
              </thead>
              <tbody>
                {pending.map(item => (
                  <tr key={item.id}>
                    <td>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{item.name}</div>
                      <div className="mono muted" style={{ fontSize: 11 }}>{item.sku}</div>
                    </td>
                    <td className="right mono">{item.qtyOrdered}</td>
                    <td className="right mono muted">{item.qtyReceived}</td>
                    <td className="right">
                      <input
                        type="number" min="0" max={item.qtyOrdered - item.qtyReceived}
                        className="field-input mono" style={{ width: 90, textAlign: 'right', padding: '4px 8px' }}
                        value={qtys[item.id] ?? ''} onChange={e => setQty(item.id, e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose}>{t('common.cancel', 'Cancelar')}</button>
            <button type="submit" className="btn accent">
              <Icon name="check" size={12} />{t('purchases.confirmReceive', 'Confirmar recepción')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal: Nueva OC ──────────────────────────────────────────────────────────
function NewPOModal({ suppliers, branches, products, onSave, onClose }) {
  const { t } = useTranslation();
  const [supplierId, setSupplierId] = useState('');
  const [branchId, setBranchId]     = useState('');
  const [notes, setNotes]           = useState('');
  const [items, setItems]           = useState([{ sku: '', name: '', qtyOrdered: 1, unitCost: '' }]);
  const [search, setSearch]         = useState('');

  const addItem = () => setItems(prev => [...prev, { sku: '', name: '', qtyOrdered: 1, unitCost: '' }]);
  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));
  const setItem = (idx, key, val) => setItems(prev => prev.map((it, i) => i === idx ? { ...it, [key]: val } : it));

  const selectProduct = (idx, p) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, sku: p.sku, name: p.name, unitCost: String(p.cost) } : it));
    setSearch('');
  };

  const matchedProducts = search.length > 1
    ? products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.includes(search)).slice(0, 8)
    : [];

  const total = items.reduce((s, i) => s + (parseFloat(i.unitCost) || 0) * (parseInt(i.qtyOrdered) || 0), 0);
  const valid = branchId && items.some(i => i.sku && parseFloat(i.unitCost) > 0 && parseInt(i.qtyOrdered) > 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!valid) return;
    onSave({ supplierId, branchId, notes, items: items.filter(i => i.sku), total });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 680 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">{t('purchases.newPOTitle', 'Nueva orden de compra')}</div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid" style={{ marginBottom: 16 }}>
              <div className="field">
                <label className="field-label">{t('common.supplier', 'Proveedor')}</label>
                <select className="field-input" value={supplierId} onChange={e => setSupplierId(e.target.value)}>
                  <option value="">{t('purchases.noSupplier', '— Sin asignar —')}</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="field-label">{t('purchases.destBranch', 'Sucursal destino *')}</label>
                <select className="field-input" value={branchId} onChange={e => setBranchId(e.target.value)} required>
                  <option value="">{t('purchases.selectBranch', 'Seleccionar...')}</option>
                  {branches.filter(b => b.status === 'active').map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="field span-2">
                <label className="field-label">{t('common.notes', 'Notas')}</label>
                <input className="field-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('purchases.notesPlaceholder', 'Instrucciones especiales de entrega...')} />
              </div>
            </div>

            <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 12 }}>{t('common.product', 'Productos')}</div>

            {/* Buscador de productos */}
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <div className="search-wrap">
                <Icon name="search" className="icon" size={13} />
                <input className="search-input" placeholder={t('purchases.searchProductPlaceholder', 'Buscar producto para agregar…')} value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              {matchedProducts.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, boxShadow: 'var(--shadow-md)', zIndex: 50, maxHeight: 200, overflowY: 'auto' }}>
                  {matchedProducts.map(p => (
                    <div key={p.sku} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: 13 }}
                      onClick={() => { selectProduct(items.length - 1, p); }}>
                      <span style={{ fontWeight: 500 }}>{p.name}</span>
                      <span className="mono muted" style={{ fontSize: 11, marginLeft: 8 }}>{p.sku}</span>
                      <span className="mono" style={{ float: 'right', color: 'var(--accent)' }}>{t('common.cost', 'costo')} {fmt(p.cost)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <table className="data-table" style={{ marginBottom: 8 }}>
              <thead>
                <tr>
                  <th>{t('purchases.productSku', 'Producto (SKU)')}</th>
                  <th className="right" style={{ width: 90 }}>{t('common.quantity', 'Cantidad')}</th>
                  <th className="right" style={{ width: 120 }}>{t('purchases.unitCost', 'Costo unit.')}</th>
                  <th className="right" style={{ width: 110 }}>{t('common.subtotal', 'Subtotal')}</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td>
                      {item.name ? (
                        <div>
                          <div style={{ fontWeight: 500, fontSize: 13 }}>{item.name}</div>
                          <div className="mono muted" style={{ fontSize: 11 }}>{item.sku}</div>
                        </div>
                      ) : (
                        <input className="field-input" style={{ fontSize: 12 }} placeholder={t('purchases.skuPlaceholder', 'SKU o seleccionar arriba…')}
                          value={item.sku} onChange={e => setItem(idx, 'sku', e.target.value)} />
                      )}
                    </td>
                    <td className="right">
                      <input type="number" min="1" className="field-input mono" style={{ width: 80, textAlign: 'right', padding: '4px 8px' }}
                        value={item.qtyOrdered} onChange={e => setItem(idx, 'qtyOrdered', e.target.value)} />
                    </td>
                    <td className="right">
                      <input type="number" min="0" step="0.01" className="field-input mono" style={{ width: 110, textAlign: 'right', padding: '4px 8px' }}
                        placeholder="0.00" value={item.unitCost} onChange={e => setItem(idx, 'unitCost', e.target.value)} />
                    </td>
                    <td className="right mono" style={{ fontSize: 13 }}>
                      {fmt((parseFloat(item.unitCost) || 0) * (parseInt(item.qtyOrdered) || 0))}
                    </td>
                    <td>
                      {items.length > 1 && (
                        <button type="button" className="icon-btn" onClick={() => removeItem(idx)}>
                          <Icon name="x" size={12} style={{ color: 'var(--danger)' }} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} style={{ textAlign: 'right', fontWeight: 600, padding: '10px 12px', color: 'var(--muted)', fontSize: 13 }}>{t('purchases.totalPO', 'Total OC')}</td>
                  <td className="right mono" style={{ fontWeight: 700, fontSize: 15, padding: '10px 12px' }}>{fmt(total)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
            <button type="button" className="btn" style={{ fontSize: 12 }} onClick={addItem}>
              <Icon name="plus" size={11} />{t('purchases.addLine', 'Agregar línea')}
            </button>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose}>{t('common.cancel', 'Cancelar')}</button>
            <button type="submit" className="btn accent" disabled={!valid}>
              <Icon name="check" size={12} />{t('purchases.createPO', 'Crear OC')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Panel de detalle de OC ───────────────────────────────────────────────────
function PODetail({ po, onClose, onReceive, onCancel }) {
  const { t } = useTranslation();
  const totalOrdered  = po.items.reduce((s, i) => s + i.qtyOrdered, 0);
  const totalReceived = po.items.reduce((s, i) => s + i.qtyReceived, 0);
  const pct = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;
  const canReceive = po.status === 'pending' || po.status === 'partial';

  return (
    <div className="drawer">
      <div className="drawer-head">
        <div>
          <div className="drawer-title">{po.id}</div>
          <div className="muted" style={{ fontSize: 12 }}>
            {po.supplier} · {po.branch} · {po.date}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {canReceive && (
            <button className="btn accent" onClick={onReceive}>
              <Icon name="truck" size={12} />{t('purchases.receive', 'Recibir')}
            </button>
          )}
          {canReceive && (
            <button className="btn" style={{ color: 'var(--danger)' }} onClick={onCancel}>
              {t('purchases.cancelPO', 'Cancelar OC')}
            </button>
          )}
          <button className="icon-btn" onClick={onClose}><Icon name="x" /></button>
        </div>
      </div>

      <div className="drawer-body" style={{ overflowY: 'auto' }}>
        {/* Status + progreso */}
        <div className="stat-card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span className="label">{t('purchases.reception', 'Recepción')}</span>
            <span className={`pill ${STATUS_CLASS[po.status]}`}>{STATUS_LABEL[po.status]}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span className="mono" style={{ fontSize: 18, fontWeight: 700 }}>{totalReceived}<span className="muted" style={{ fontSize: 13, fontWeight: 400 }}>/{totalOrdered} {t('purchases.units', 'unid.')}</span></span>
            <span className="mono" style={{ fontSize: 18, fontWeight: 700 }}>{fmt(po.total)}</span>
          </div>
          <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: po.status === 'received' ? 'var(--success)' : 'var(--accent)', borderRadius: 3, transition: 'width .3s' }} />
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{pct}% {t('purchases.received', 'recibido')}</div>
        </div>

        {po.notes && (
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', marginBottom: 16, fontSize: 13, color: 'var(--muted)' }}>
            <Icon name="dots" size={11} style={{ marginRight: 6 }} />{po.notes}
          </div>
        )}

        {/* Tabla de ítems */}
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('common.product', 'Producto')}</th>
              <th className="right">{t('purchases.ordered', 'Pedido')}</th>
              <th className="right">{t('purchases.received', 'Recibido')}</th>
              <th className="right">{t('purchases.unitCost', 'Costo unit.')}</th>
              <th className="right">{t('common.subtotal', 'Subtotal')}</th>
            </tr>
          </thead>
          <tbody>
            {po.items.map(item => {
              const done = item.qtyReceived >= item.qtyOrdered;
              return (
                <tr key={item.id}>
                  <td>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{item.name}</div>
                    <div className="mono muted" style={{ fontSize: 11 }}>{item.sku}</div>
                  </td>
                  <td className="right mono">{item.qtyOrdered}</td>
                  <td className="right">
                    <span className={`pill ${done ? 'success' : item.qtyReceived > 0 ? 'warning' : 'neutral'}`} style={{ fontSize: 10 }}>
                      {item.qtyReceived}/{item.qtyOrdered}
                    </span>
                  </td>
                  <td className="right mono muted">{fmt(item.unitCost)}</td>
                  <td className="right mono">{fmt(item.unitCost * item.qtyOrdered)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Módulo principal ─────────────────────────────────────────────────────────
export default function Purchases({ pushToast }) {
  const { t } = useTranslation();
  // Órdenes de compra + catálogos (proveedores/sucursales/productos) desde el backend.
  const { items: apiOrders } = usePurchaseOrders();
  const { items: SUPPLIERS } = useSuppliers();
  const { items: BRANCHES } = useBranches();
  const { items: PRODUCTS } = useProducts();
  const [tab, setTab]             = useState('lista');
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatus] = useState('all');
  const [supplierFilter, setSupplier] = useState('all');
  const [selected, setSelected]   = useState(null);
  const [showNew, setShowNew]     = useState(false);
  const [showReceive, setReceive] = useState(false);
  const [orders, setOrders]       = useState(apiOrders);
  // Sincroniza la lista local cuando llegan las órdenes del backend.
  useEffect(() => { setOrders(apiOrders); }, [apiOrders]);

  const filtered = useMemo(() => {
    let o = orders;
    if (statusFilter !== 'all') o = o.filter(x => x.status === statusFilter);
    if (supplierFilter !== 'all') o = o.filter(x => x.supplierId === supplierFilter);
    if (search) {
      const q = search.toLowerCase();
      o = o.filter(x => x.id.toLowerCase().includes(q) || x.supplier.toLowerCase().includes(q));
    }
    return o;
  }, [orders, statusFilter, supplierFilter, search]);

  const pendingOrders = useMemo(() => orders.filter(o => o.status === 'pending' || o.status === 'partial'), [orders]);

  const totalThisMonth = orders.reduce((s, o) => s + (o.status !== 'cancelled' ? o.total : 0), 0);
  const totalPending   = pendingOrders.reduce((s, o) => s + o.total, 0);

  const handleNewOC = ({ supplierId, branchId, notes, items, total }) => {
    const sup = SUPPLIERS.find(s => s.id === supplierId);
    const br  = BRANCHES.find(b => b.id === branchId);
    const id  = `OC-2026-${String(orders.length + 1).padStart(4, '0')}`;
    const newOC = {
      id, date: new Date().toISOString().slice(0, 10),
      supplier: sup?.name || 'Sin proveedor', supplierId,
      branch: br?.name || '', branchId,
      total, status: 'pending', notes,
      items: items.map((item, idx) => ({
        id: Date.now() + idx,
        sku: item.sku, name: item.name,
        qtyOrdered: parseInt(item.qtyOrdered),
        qtyReceived: 0,
        unitCost: parseFloat(item.unitCost),
      })),
    };
    setOrders(prev => [newOC, ...prev]);
    setShowNew(false);
    pushToast?.(`OC ${id} creada correctamente`, 'success');
  };

  const handleReceive = (received) => {
    setOrders(prev => prev.map(o => {
      if (o.id !== selected.id) return o;
      const updatedItems = o.items.map(item => {
        const r = received.find(r => r.itemId === item.id);
        return r ? { ...item, qtyReceived: item.qtyReceived + r.qty } : item;
      });
      const allDone   = updatedItems.every(i => i.qtyReceived >= i.qtyOrdered);
      const someDone  = updatedItems.some(i => i.qtyReceived > 0);
      return { ...o, items: updatedItems, status: allDone ? 'received' : someDone ? 'partial' : 'pending' };
    }));
    const updatedOC = orders.find(o => o.id === selected.id);
    if (updatedOC) setSelected({ ...updatedOC });
    setReceive(false);
    pushToast?.('Recepción registrada y stock actualizado', 'success');
  };

  const handleCancel = () => {
    setOrders(prev => prev.map(o => o.id === selected.id ? { ...o, status: 'cancelled' } : o));
    setSelected(prev => ({ ...prev, status: 'cancelled' }));
    pushToast?.(`OC ${selected.id} cancelada`, '');
  };

  const selectedOrder = selected ? orders.find(o => o.id === selected.id) || selected : null;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('purchases.title', 'Compras y Órdenes de compra')}</h1>
          <div className="page-subtitle">{orders.length} {t('purchases.registeredOCs', 'OCs registradas')} · {pendingOrders.length} {t('purchases.pendingReception', 'pendientes de recepción')}</div>
        </div>
        <div className="page-head-actions">
          <button className="btn accent" onClick={() => setShowNew(true)}>
            <Icon name="plus" size={12} />{t('purchases.newPO', 'Nueva OC')}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <div className="stat">
          <div className="label"><Icon name="receipt" size={11} />{t('purchases.totalOCsMonth', 'Total OCs (mes)')}</div>
          <div className="val mono">{orders.filter(o => o.status !== 'cancelled').length}</div>
          <div className="delta muted">{orders.filter(o => o.status === 'cancelled').length} {t('common.cancelled', 'canceladas')}</div>
        </div>
        <div className="stat">
          <div className="label"><Icon name="cash" size={11} />{t('purchases.purchasedValueMonth', 'Valor comprado (mes)')}</div>
          <div className="val mono">{`Q ${Math.round(totalThisMonth / 1000)}k`}</div>
          <div className="delta muted">{fmt(totalThisMonth)}</div>
        </div>
        <div className="stat">
          <div className="label"><Icon name="clock" size={11} />{t('purchases.pendingToReceive', 'Pendiente de recibir')}</div>
          <div className="val mono" style={{ color: pendingOrders.length > 0 ? 'var(--warning)' : undefined }}>
            {pendingOrders.length}
          </div>
          <div className="delta muted">{fmt(totalPending)}</div>
        </div>
        <div className="stat">
          <div className="label"><Icon name="supplier" size={11} />{t('purchases.activeSuppliers', 'Proveedores activos')}</div>
          <div className="val mono">{SUPPLIERS.length}</div>
          <div className="delta muted">{t('purchases.inBranches', 'en')} {BRANCHES.length} {t('purchases.branchesWord', 'sucursales')}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <div className={`tab ${tab === 'lista' ? 'active' : ''}`} onClick={() => setTab('lista')}>
          {t('purchases.allOCs', 'Todas las OCs')} <span className="count">{orders.length}</span>
        </div>
        <div className={`tab ${tab === 'pendientes' ? 'active' : ''}`} onClick={() => setTab('pendientes')}>
          {t('purchases.pendingReceptionTab', 'Pendientes de recepción')} <span className="count">{pendingOrders.length}</span>
        </div>
      </div>

      {/* Filtros */}
      <div className="toolbar">
        <div className="search-wrap" style={{ flex: 1, maxWidth: 320 }}>
          <Icon name="search" className="icon" size={13} />
          <input className="search-input" placeholder={t('purchases.searchPlaceholder', 'Buscar por OC o proveedor…')}
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="field-input" style={{ width: 'auto' }} value={statusFilter} onChange={e => setStatus(e.target.value)}>
          <option value="all">{t('purchases.allStatuses', 'Todos los estados')}</option>
          <option value="pending">{t('common.pending', 'Pendiente')}</option>
          <option value="partial">{t('purchases.partial', 'Parcial')}</option>
          <option value="received">{t('purchases.receivedStatus', 'Recibida')}</option>
          <option value="cancelled">{t('common.cancelled', 'Cancelada')}</option>
        </select>
        <select className="field-input" style={{ width: 'auto' }} value={supplierFilter} onChange={e => setSupplier(e.target.value)}>
          <option value="all">{t('purchases.allSuppliers', 'Todos los proveedores')}</option>
          {SUPPLIERS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <span className="muted" style={{ fontSize: 12 }}>{filtered.length} {t('common.results_other', 'resultados')}</span>
      </div>

      {tab === 'lista' && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('purchases.headers.po', 'OC')}</th>
                <th>{t('purchases.headers.date', 'Fecha')}</th>
                <th>{t('purchases.headers.supplier', 'Proveedor')}</th>
                <th>{t('common.branch', 'Sucursal')}</th>
                <th className="right">{t('purchases.headers.items', 'Ítems')}</th>
                <th className="right">{t('purchases.headers.total', 'Total')}</th>
                <th>{t('purchases.headers.status', 'Estado')}</th>
                <th>{t('purchases.reception', 'Recepción')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="empty">{t('common.noResults', 'Sin resultados')}</td></tr>
              ) : filtered.map(oc => {
                const totalRecv = oc.items.reduce((s, i) => s + i.qtyReceived, 0);
                const totalOrd  = oc.items.reduce((s, i) => s + i.qtyOrdered, 0);
                const pct = totalOrd > 0 ? Math.round((totalRecv / totalOrd) * 100) : 0;
                return (
                  <tr key={oc.id} className="clickable" onClick={() => setSelected(oc)}>
                    <td className="mono" style={{ fontWeight: 600 }}>{oc.id}</td>
                    <td className="mono muted">{oc.date}</td>
                    <td>{oc.supplier || <span className="muted">{t('purchases.unassigned', 'Sin asignar')}</span>}</td>
                    <td className="muted">{oc.branch}</td>
                    <td className="right mono">{oc.items.length}</td>
                    <td className="right mono">{fmt(oc.total)}</td>
                    <td><span className={`pill ${STATUS_CLASS[oc.status]}`} style={{ fontSize: 10 }}>{STATUS_LABEL[oc.status]}</span></td>
                    <td>
                      {oc.status !== 'cancelled' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', minWidth: 60 }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? 'var(--success)' : 'var(--accent)', borderRadius: 2 }} />
                          </div>
                          <span className="mono muted" style={{ fontSize: 10 }}>{pct}%</span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'pendientes' && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('purchases.headers.po', 'OC')}</th>
                <th>{t('purchases.headers.date', 'Fecha')}</th>
                <th>{t('purchases.headers.supplier', 'Proveedor')}</th>
                <th>{t('common.branch', 'Sucursal')}</th>
                <th className="right">{t('purchases.missing', 'Faltante')}</th>
                <th className="right">{t('purchases.headers.total', 'Total')}</th>
                <th>{t('purchases.headers.status', 'Estado')}</th>
                <th>{t('common.actions', 'Acciones')}</th>
              </tr>
            </thead>
            <tbody>
              {pendingOrders.length === 0 ? (
                <tr><td colSpan={8} className="empty">{t('purchases.noPendingOCs', 'No hay OCs pendientes de recepción')}</td></tr>
              ) : pendingOrders.map(oc => {
                const faltante = oc.items.reduce((s, i) => s + (i.qtyOrdered - i.qtyReceived), 0);
                return (
                  <tr key={oc.id} className="clickable" onClick={() => setSelected(oc)}>
                    <td className="mono" style={{ fontWeight: 600 }}>{oc.id}</td>
                    <td className="mono muted">{oc.date}</td>
                    <td>{oc.supplier || <span className="muted">{t('purchases.unassigned', 'Sin asignar')}</span>}</td>
                    <td className="muted">{oc.branch}</td>
                    <td className="right mono" style={{ color: 'var(--warning)', fontWeight: 600 }}>{faltante} {t('purchases.units', 'unid.')}</td>
                    <td className="right mono">{fmt(oc.total)}</td>
                    <td><span className={`pill ${STATUS_CLASS[oc.status]}`} style={{ fontSize: 10 }}>{STATUS_LABEL[oc.status]}</span></td>
                    <td>
                      <button className="btn accent" style={{ fontSize: 11, padding: '3px 10px' }}
                        onClick={e => { e.stopPropagation(); setSelected(oc); setReceive(true); }}>
                        <Icon name="truck" size={11} />{t('purchases.receive', 'Recibir')}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Panel detalle OC */}
      {selectedOrder && !showReceive && (
        <div className="drawer-overlay">
          <PODetail
            po={selectedOrder}
            onClose={() => setSelected(null)}
            onReceive={() => setReceive(true)}
            onCancel={handleCancel}
          />
        </div>
      )}

      {/* Modal recibir */}
      {showReceive && selectedOrder && (
        <ReceiveModal po={selectedOrder} onSave={handleReceive} onClose={() => setReceive(false)} />
      )}

      {/* Modal nueva OC */}
      {showNew && (
        <NewPOModal
          suppliers={SUPPLIERS}
          branches={BRANCHES}
          products={PRODUCTS}
          onSave={handleNewOC}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  );
}
