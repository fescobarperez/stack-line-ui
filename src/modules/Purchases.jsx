// Stackline — Módulo de Compras / Órdenes de Compra
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import StatCard from '../components/StatCard.jsx';
import DataTable from '../components/DataTable.jsx';
import { usePurchaseOrders } from '../hooks/useOperations.js';
import { createPurchaseOrder, receivePurchaseOrder, cancelPurchaseOrder } from '../api/purchasing.js';
import { useSuppliers } from '../hooks/useMasters.js';
import { useBranches } from '../hooks/useMasters.js';
import { useProducts } from '../hooks/useCatalog.js';

const STATUS_LABEL = { pending: 'Pendiente', partial: 'Parcial', received: 'Recibida', cancelled: 'Cancelada', draft: 'Borrador' };
const STATUS_CLASS  = { pending: 'warning', partial: 'info', received: 'success', cancelled: 'neutral', draft: 'neutral' };

function fmt(n) { return `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

// PurchaseOrderDtos.Response → forma que usa la vista.
function mapOrder(o) {
  return {
    id: o.docNumber || `OC-${o.id}`,
    poId: o.id,                       // id real para las llamadas al backend
    date: o.orderDate || '',
    supplier: o.supplierName || 'Sin proveedor',
    supplierId: o.supplierId,
    branch: o.branchName || '',
    branchId: o.branchId,
    total: Number(o.total || 0),
    status: o.status || 'pending',
    notes: o.notes || '',
    items: (o.items || []).map((i) => ({
      id: i.id,
      sku: i.productId != null ? String(i.productId) : '',
      name: i.productName || '',
      qtyOrdered: Number(i.qtyOrdered || 0),
      qtyReceived: Number(i.qtyReceived || 0),
      unitCost: Number(i.unitCost || 0),
    })),
  };
}

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
            <h3>{t('purchases.receiveTitle', 'Recibir mercancía')}</h3>
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
                      <div style={{ fontWeight: 500, fontSize: 14 }}>{item.name}</div>
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
          <div className="modal-foot">
            <Button type="button" onClick={onClose}>{t('common.cancel', 'Cancelar')}</Button>
            <Button icon="check" variant="accent" type="submit">{t('purchases.confirmReceive', 'Confirmar recepción')}
            </Button>
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
    setItems(prev => prev.map((it, i) => i === idx
      ? { ...it, productId: p.id, sku: p.sku, name: p.name, unitCost: String(p.cost) }
      : it));
    setSearch('');
  };

  const matchedProducts = search.length > 1
    ? products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.includes(search)).slice(0, 8)
    : [];

  const total = items.reduce((s, i) => s + (parseFloat(i.unitCost) || 0) * (parseInt(i.qtyOrdered) || 0), 0);
  const usable = items.filter(i => i.productId && parseFloat(i.unitCost) > 0 && parseInt(i.qtyOrdered) > 0);
  const valid = branchId && usable.length > 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!valid) return;
    onSave({ supplierId, branchId, notes, items: usable, total });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 680 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{t('purchases.newPOTitle', 'Nueva orden de compra')}</h3>
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

            <div style={{ marginBottom: 8, fontWeight: 500, fontSize: 12 }}>{t('common.product', 'Productos')}</div>

            {/* Buscador de productos */}
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <div className="search-wrap">
                <Icon name="search" className="icon" size={13} />
                <input className="search-input" placeholder={t('purchases.searchProductPlaceholder', 'Buscar producto para agregar…')} value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              {matchedProducts.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--shape-sm)', boxShadow: 'var(--shadow-md)', zIndex: 50, maxHeight: 200, overflowY: 'auto' }}>
                  {matchedProducts.map(p => (
                    <div key={p.sku} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: 14 }}
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
                          <div style={{ fontWeight: 500, fontSize: 14 }}>{item.name}</div>
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
                    <td className="right mono">
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
                  <td colSpan={3} style={{ textAlign: 'right', fontWeight: 500, padding: '10px 12px', color: 'var(--muted)' }}>{t('purchases.totalPO', 'Total OC')}</td>
                  <td className="right mono" style={{ fontWeight: 500, padding: '10px 12px' }}>{fmt(total)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
            <Button size="sm" icon="plus" type="button" onClick={addItem}>{t('purchases.addLine', 'Agregar línea')}
            </Button>
          </div>
          <div className="modal-foot">
            <Button type="button" onClick={onClose}>{t('common.cancel', 'Cancelar')}</Button>
            <Button icon="check" variant="accent" type="submit" disabled={!valid}>{t('purchases.createPO', 'Crear OC')}
            </Button>
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
            <Button icon="truck" variant="accent" onClick={onReceive}>{t('purchases.receive', 'Recibir')}
            </Button>
          )}
          {canReceive && (
            <Button style={{ color: 'var(--danger)' }} onClick={onCancel}>
              {t('purchases.cancelPO', 'Cancelar OC')}
            </Button>
          )}
          <button className="icon-btn" onClick={onClose}><Icon name="x" /></button>
        </div>
      </div>

      <div className="drawer-body" style={{ overflowY: 'auto' }}>
        {/* Status + progreso */}
        <div className="stat-card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span className="label">{t('purchases.reception', 'Recepción')}</span>
            <span className={`badge-m3 ${STATUS_CLASS[po.status]}`}>{STATUS_LABEL[po.status]}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span className="mono" style={{ fontSize: 22, fontWeight: 400 }}>{totalReceived}<span className="muted" style={{ fontSize: 14, fontWeight: 400 }}>/{totalOrdered} {t('purchases.units', 'unid.')}</span></span>
            <span className="mono" style={{ fontSize: 22, fontWeight: 400 }}>{fmt(po.total)}</span>
          </div>
          <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: po.status === 'received' ? 'var(--success)' : 'var(--accent)', borderRadius: 3, transition: 'width .3s' }} />
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{pct}% {t('purchases.received', 'recibido')}</div>
        </div>

        {po.notes && (
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', marginBottom: 16, fontSize: 14, color: 'var(--muted)' }}>
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
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{item.name}</div>
                    <div className="mono muted" style={{ fontSize: 11 }}>{item.sku}</div>
                  </td>
                  <td className="right mono">{item.qtyOrdered}</td>
                  <td className="right">
                    <span className={`badge-m3 ${done ? 'success' : item.qtyReceived > 0 ? 'warning' : 'neutral'}`}>
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
  const { items: apiOrders, loading, reload: reloadOrders } = usePurchaseOrders();
  const { items: SUPPLIERS } = useSuppliers();
  const { items: BRANCHES } = useBranches();
  const { items: PRODUCTS, reload: reloadProducts } = useProducts();
  const [tab, setTab]             = useState('lista');
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatus] = useState('all');
  const [supplierFilter, setSupplier] = useState('all');
  const [selected, setSelected]   = useState(null);
  const [showNew, setShowNew]     = useState(false);
  const [showReceive, setReceive] = useState(false);
  const [saving, setSaving]       = useState(false);
  // La lista es siempre la del backend: no se mantiene copia local editable.
  const orders = useMemo(() => apiOrders.map(mapOrder), [apiOrders]);

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

  const isPending = (o) => o.status === 'pending' || o.status === 'partial';
  // Contador global del tab y KPIs: no depende de los filtros de la barra.
  const pendingOrders = useMemo(() => orders.filter(isPending), [orders]);
  // Filas que realmente se muestran: los filtros de la barra aplican en ambos tabs.
  const visibleRows = useMemo(
    () => (tab === 'pendientes' ? filtered.filter(isPending) : filtered),
    [tab, filtered]
  );

  const totalThisMonth = orders.reduce((s, o) => s + (o.status !== 'cancelled' ? o.total : 0), 0);
  const totalPending   = pendingOrders.reduce((s, o) => s + o.total, 0);

  // ── Columnas (estándar <DataTable>) ──────────────────────────────────────
  const colOC = { key: 'id', header: t('purchases.headers.po', 'OC'), sortable: true, mono: true,
    render: (oc) => <span className="nm">{oc.id}</span> };
  const colDate = { key: 'date', header: t('purchases.headers.date', 'Fecha'), sortable: true, mono: true,
    className: 'muted' };
  const colSupplier = { key: 'supplier', header: t('purchases.headers.supplier', 'Proveedor'), sortable: true,
    render: (oc) => oc.supplier || <span className="muted">{t('purchases.unassigned', 'Sin asignar')}</span> };
  const colBranch = { key: 'branch', header: t('common.branch', 'Sucursal'), sortable: true, className: 'muted' };
  const colTotal = { key: 'total', header: t('purchases.headers.total', 'Total'), align: 'right', sortable: true,
    render: (oc) => fmt(oc.total) };
  const colStatus = { key: 'status', header: t('purchases.headers.status', 'Estado'), sortable: true,
    sortValue: (oc) => STATUS_LABEL[oc.status],
    render: (oc) => <span className={`badge-m3 ${STATUS_CLASS[oc.status]}`}>{STATUS_LABEL[oc.status]}</span> };

  const pctOf = (oc) => {
    const ord = oc.items.reduce((a, i) => a + i.qtyOrdered, 0);
    const rec = oc.items.reduce((a, i) => a + i.qtyReceived, 0);
    return ord > 0 ? Math.round((rec / ord) * 100) : 0;
  };
  const missingOf = (oc) => oc.items.reduce((a, i) => a + (i.qtyOrdered - i.qtyReceived), 0);

  const listaColumns = [
    colOC, colDate, colSupplier, colBranch,
    { key: 'items', header: t('purchases.headers.items', 'Ítems'), align: 'right', sortable: true,
      sortValue: (oc) => oc.items.length, render: (oc) => oc.items.length },
    colTotal, colStatus,
    { key: 'reception', header: t('purchases.reception', 'Recepción'), sortable: true, sortValue: pctOf,
      render: (oc) => {
        if (oc.status === 'cancelled') return null;
        const pct = pctOf(oc);
        return (
          <div className="po-progress">
            <div className="po-progress-track">
              <div className={`po-progress-fill${pct === 100 ? ' is-done' : ''}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="po-progress-pct">{pct}%</span>
          </div>
        );
      } },
  ];

  const pendientesColumns = [
    colOC, colDate, colSupplier, colBranch,
    { key: 'missing', header: t('purchases.missing', 'Faltante'), align: 'right', sortable: true,
      sortValue: missingOf,
      render: (oc) => <span className="po-missing">{missingOf(oc)} {t('purchases.units', 'unid.')}</span> },
    colTotal, colStatus,
  ];

  const handleNewOC = async ({ supplierId, branchId, notes, items }) => {
    setSaving(true);
    try {
      const po = await createPurchaseOrder({
        supplierId: supplierId ? Number(supplierId) : null,
        branchId: Number(branchId),
        orderDate: new Date().toISOString().slice(0, 10),
        notes,
        items: items.map((item) => ({
          productId: Number(item.productId),
          qtyOrdered: Number(item.qtyOrdered),
          unitCost: Number(item.unitCost),
        })),
      });
      await reloadOrders();
      setShowNew(false);
      pushToast?.(`OC ${po.docNumber || po.id} creada correctamente`, 'success');
    } catch (err) {
      pushToast?.('No se pudo crear la OC: ' + err.message, 'danger');
    } finally {
      setSaving(false);
    }
  };

  const handleReceive = async (received) => {
    setSaving(true);
    try {
      // El backend espera `quantity`; el modal trabaja con `qty`.
      const po = await receivePurchaseOrder(selected.poId, {
        items: received.map((r) => ({ itemId: r.itemId, quantity: Number(r.qty) })),
      });
      await Promise.all([reloadOrders(), reloadProducts()]);
      setSelected(mapOrder(po));
      setReceive(false);
      pushToast?.('Recepción registrada · stock actualizado', 'success');
    } catch (err) {
      pushToast?.('No se pudo registrar la recepción: ' + err.message, 'danger');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    setSaving(true);
    try {
      const po = await cancelPurchaseOrder(selected.poId);
      await reloadOrders();
      setSelected(mapOrder(po));
      pushToast?.(`OC ${selected.id} cancelada`, 'success');
    } catch (err) {
      // 409 cuando la orden ya tiene mercancía recibida o ya estaba cancelada.
      pushToast?.('No se pudo cancelar: ' + err.message, 'danger');
    } finally {
      setSaving(false);
    }
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
          <Button icon="plus" variant="accent" onClick={() => setShowNew(true)}>{t('purchases.newPO', 'Nueva OC')}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <StatCard
          icon="receipt" tone="pri"
          label={t('purchases.totalOCsMonth', 'Total OCs (mes)')}
          value={orders.filter(o => o.status !== 'cancelled').length}
          foot={<>{orders.filter(o => o.status === 'cancelled').length} {t('common.cancelled', 'canceladas')}</>}
        />
        <StatCard
          icon="cash" tone="ter"
          label={t('purchases.purchasedValueMonth', 'Valor comprado (mes)')}
          value={`Q ${Math.round(totalThisMonth / 1000)}k`}
          foot={fmt(totalThisMonth)}
        />
        <StatCard
          icon="clock" tone="sec"
          label={t('purchases.pendingToReceive', 'Pendiente de recibir')}
          valueColor={pendingOrders.length > 0 ? 'var(--warning)' : undefined}
          value={pendingOrders.length}
          foot={fmt(totalPending)}
        />
        <StatCard
          icon="supplier" tone="err"
          label={t('purchases.activeSuppliers', 'Proveedores activos')}
          value={SUPPLIERS.length}
          foot={<>{t('purchases.inBranches', 'en')} {BRANCHES.length} {t('purchases.branchesWord', 'sucursales')}</>}
        />
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
        <span className="filterbar-count">{t('common.results', { count: visibleRows.length })}</span>
      </div>

      {tab === 'lista' && (
        <DataTable
          columns={listaColumns}
          rows={visibleRows}
          rowKey={(oc) => oc.id}
          loading={loading}
          pageSize={25}
          defaultSort={{ key: 'date', dir: 'desc' }}
          onRowClick={setSelected}
          onRefresh={reloadOrders}
          empty={t('common.noResults', 'Sin resultados')}
          emptyIcon="truck"
          totals={{
            items: visibleRows.reduce((a, oc) => a + oc.items.length, 0),
            total: fmt(visibleRows.reduce((a, oc) => a + oc.total, 0)),
          }}
        />
      )}

      {tab === 'pendientes' && (
        <DataTable
          columns={pendientesColumns}
          rows={visibleRows}
          rowKey={(oc) => oc.id}
          loading={loading}
          pageSize={25}
          defaultSort={{ key: 'date', dir: 'asc' }}
          onRowClick={setSelected}
          onRefresh={reloadOrders}
          empty={t('purchases.noPendingOCs', 'No hay OCs pendientes de recepción')}
          emptyIcon="clock"
          totals={{
            missing: visibleRows.reduce((a, oc) => a + missingOf(oc), 0),
            total: fmt(visibleRows.reduce((a, oc) => a + oc.total, 0)),
          }}
          actions={(oc) => (
            <Button icon="truck" variant="accent" size="sm" onClick={() => { setSelected(oc); setReceive(true); }}>{t('purchases.receive', 'Recibir')}
            </Button>
          )}
        />
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
