// Stackline — Módulo de Transferencias entre Sucursales
import React, { useState, useMemo } from 'react';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import StatCard from '../components/StatCard.jsx';
import { useTransfers } from '../hooks/useOperations.js';
import { useBranches } from '../hooks/useMasters.js';
import { useProducts } from '../hooks/useCatalog.js';
import { createTransfer, dispatchTransfer, receiveTransfer } from '../api/transfers.js';
import { useTranslation } from 'react-i18next';

// Backend Transfer.Response → forma de la UI. Si ya es shape de UI (fallback mock), lo deja igual.
function mapTransfer(r) {
  if (r.fromBranch !== undefined) return r;
  return {
    id: r.docNumber || String(r.id),
    apiId: r.id,
    date: r.transferDate,
    fromBranch: r.fromBranchName,
    toBranch: r.toBranchName,
    transporter: r.transporter,
    status: r.status,
    items: (r.items || []).map(i => ({ name: i.productName, sku: '', qty: Number(i.quantity), qtyReceived: Number(i.qtyReceived || 0) })),
  };
}

const STATUS_LABEL = { draft: 'Borrador', in_transit: 'En tránsito', completed: 'Completada', cancelled: 'Cancelada' };
const STATUS_CLASS  = { draft: 'neutral', in_transit: 'warning', completed: 'success', cancelled: 'neutral' };
const FLOW = ['draft', 'in_transit', 'completed'];

function fmt(n) { return `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

// ── Modal: Nueva transferencia ────────────────────────────────────────────────
function NewTransferModal({ branches, products, onSave, onClose }) {
  const { t } = useTranslation();
  const [fromBranch, setFrom]   = useState('');
  const [toBranch, setTo]       = useState('');
  const [transporter, setTrans] = useState('');
  const [items, setItems]       = useState([{ sku: '', name: '', qty: 1 }]);
  const [search, setSearch]     = useState('');

  const addItem = () => setItems(prev => [...prev, { sku: '', name: '', qty: 1 }]);
  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));
  const setItem = (idx, k, v) => setItems(prev => prev.map((it, i) => i === idx ? { ...it, [k]: v } : it));

  const matched = search.length > 1
    ? products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.includes(search)).slice(0, 8)
    : [];

  const selectProduct = (idx, p) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, sku: p.sku, name: p.name } : it));
    setSearch('');
  };

  const valid = fromBranch && toBranch && fromBranch !== toBranch && items.some(i => i.sku && parseInt(i.qty) > 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!valid) return;
    onSave({ fromBranch, toBranch, transporter, items: items.filter(i => i.sku) });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 620 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{t('transfers.newTransfer', 'Nueva transferencia')}</h3>
          <button className="icon-btn" onClick={onClose}><Icon name="x" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'end', marginBottom: 16 }}>
              <div className="field">
                <label className="field-label">Sucursal origen *</label>
                <select className="field-input" value={fromBranch} onChange={e => setFrom(e.target.value)} required>
                  <option value="">Seleccionar...</option>
                  {branches.filter(b => b.status === 'active').map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                </select>
              </div>
              <div style={{ textAlign: 'center', color: 'var(--accent)', paddingBottom: 8 }}>
                <Icon name="transfer" size={20} />
              </div>
              <div className="field">
                <label className="field-label">Sucursal destino *</label>
                <select className="field-input" value={toBranch} onChange={e => setTo(e.target.value)} required>
                  <option value="">Seleccionar...</option>
                  {branches.filter(b => b.status === 'active' && b.name !== fromBranch).map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                </select>
              </div>
            </div>

            <div className="field" style={{ marginBottom: 16 }}>
              <label className="field-label">{t('inventory.transfer.carrier', 'Transportista / chofer')}</label>
              <input className="field-input" value={transporter} onChange={e => setTrans(e.target.value)} placeholder={t('inventory.transfer.carrierPlaceholder', 'Nombre del conductor o mensajero...')} />
            </div>

            <div style={{ fontWeight: 500, fontSize: 12, marginBottom: 8 }}>Productos a transferir</div>

            <div style={{ position: 'relative', marginBottom: 12 }}>
              <div className="search-wrap">
                <Icon name="search" className="icon" size={13} />
                <input className="search-input" placeholder={t('transfers.searchPlaceholder', 'Buscar producto para agregar…')} value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              {matched.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--shape-sm)', boxShadow: 'var(--shadow-md)', zIndex: 50, maxHeight: 200, overflowY: 'auto' }}>
                  {matched.map(p => (
                    <div key={p.sku} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: 14 }}
                      onClick={() => selectProduct(items.length - 1, p)}>
                      <span style={{ fontWeight: 500 }}>{p.name}</span>
                      <span className="mono muted" style={{ fontSize: 11, marginLeft: 8 }}>{p.sku}</span>
                      <span className="mono" style={{ float: 'right', color: 'var(--muted)', fontSize: 11 }}>Stock: {p.stock}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <table className="data-table" style={{ marginBottom: 8 }}>
              <thead>
                <tr>
                  <th>{t('common.product', 'Producto')}</th>
                  <th className="right" style={{ width: 100 }}>{t('common.quantity', 'Cantidad')}</th>
                  <th style={{ width: 36 }}></th>
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
                        <input className="field-input" style={{ fontSize: 12 }} placeholder="SKU o seleccionar arriba..."
                          value={item.sku} onChange={e => setItem(idx, 'sku', e.target.value)} />
                      )}
                    </td>
                    <td>
                      <input type="number" min="1" className="field-input mono" style={{ width: 90, textAlign: 'right', padding: '4px 8px' }}
                        value={item.qty} onChange={e => setItem(idx, 'qty', e.target.value)} />
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
            </table>
            <Button size="sm" icon="plus" type="button" onClick={addItem}>Agregar línea
            </Button>
          </div>
          <div className="modal-foot">
            <Button type="button" onClick={onClose}>{t('common.cancel', 'Cancelar')}</Button>
            <Button icon="check" variant="accent" type="submit" disabled={!valid}>{t('inventory.transfer.create', 'Crear transferencia')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Panel detalle ─────────────────────────────────────────────────────────────
function TransferDetail({ transfer, onClose, onDispatch, onReceive }) {
  const { t } = useTranslation();
  const canDispatch = transfer.status === 'draft';
  const canReceive  = transfer.status === 'in_transit';
  const currentStep = FLOW.indexOf(transfer.status);

  return (
    <div className="drawer">
      <div className="drawer-head">
        <div>
          <div className="drawer-title">{transfer.id}</div>
          <div className="muted" style={{ fontSize: 12 }}>{transfer.date} · {transfer.fromBranch} → {transfer.toBranch}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {canDispatch && <Button icon="truck" variant="accent" onClick={() => onDispatch(transfer)}>Despachar</Button>}
          {canReceive  && <Button icon="check" variant="accent" onClick={() => onReceive(transfer)}>Recibir</Button>}
          <button className="icon-btn" onClick={onClose}><Icon name="x" /></button>
        </div>
      </div>

      <div className="drawer-body" style={{ overflowY: 'auto' }}>
        {/* Flujo de estados */}
        {transfer.status !== 'cancelled' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 20 }}>
            {FLOW.map((s, i) => (
              <React.Fragment key={s}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: i <= currentStep ? 'var(--accent)' : 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                    {i < currentStep ? <Icon name="check" size={12} style={{ color: 'var(--md-sys-color-on-primary)' }} /> :
                     i === currentStep ? <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--md-sys-color-on-primary)' }} /> : null}
                  </div>
                  <div style={{ fontSize: 11, color: i <= currentStep ? 'var(--accent)' : 'var(--muted)', fontWeight: i === currentStep ? 600 : 400, textAlign: 'center' }}>
                    {STATUS_LABEL[s]}
                  </div>
                </div>
                {i < FLOW.length - 1 && (
                  <div style={{ flex: 2, height: 2, background: i < currentStep ? 'var(--accent)' : 'var(--border)', marginBottom: 20 }} />
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        <div className="detail-grid" style={{ marginBottom: 16 }}>
          <div className="detail-row">
            <span className="detail-label">Origen</span>
            <span style={{ fontWeight: 500 }}>{transfer.fromBranch}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Destino</span>
            <span style={{ fontWeight: 500 }}>{transfer.toBranch}</span>
          </div>
          {transfer.transporter && (
            <div className="detail-row">
              <span className="detail-label">{t('inventory.transfer.carrier', 'Transportista / chofer')}</span>
              <span>{transfer.transporter}</span>
            </div>
          )}
          <div className="detail-row">
            <span className="detail-label">{t('common.status', 'Estado')}</span>
            <span className={`badge-m3 ${STATUS_CLASS[transfer.status]}`}>{STATUS_LABEL[transfer.status]}</span>
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>{t('common.product', 'Producto')}</th>
              <th className="right">{t('common.quantity', 'Cantidad')}</th>
              {transfer.status === 'completed' && <th className="right">Recibido</th>}
            </tr>
          </thead>
          <tbody>
            {transfer.items.map((item, idx) => (
              <tr key={idx}>
                <td>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{item.name}</div>
                  <div className="mono muted" style={{ fontSize: 11 }}>{item.sku}</div>
                </td>
                <td className="right mono">{item.qty}</td>
                {transfer.status === 'completed' && (
                  <td className="right">
                    <span className={`badge-m3 ${item.qtyReceived === item.qty ? 'success' : 'warning'}`}>
                      {item.qtyReceived}/{item.qty}
                    </span>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Módulo principal ──────────────────────────────────────────────────────────
export default function Transfers({ pushToast }) {
  const { t } = useTranslation();
  const { items: transfersRaw, reload } = useTransfers();
  const { items: BRANCHES } = useBranches();
  const { items: PRODUCTS } = useProducts();
  const transfers = useMemo(() => transfersRaw.map(mapTransfer), [transfersRaw]);
  const [selected, setSelected]     = useState(null);
  const [showNew, setShowNew]       = useState(false);
  const [statusFilter, setStatus]   = useState('all');
  const [branchFilter, setBranch]   = useState('all');
  const [search, setSearch]         = useState('');

  const filtered = useMemo(() => {
    let t = transfers;
    if (statusFilter !== 'all') t = t.filter(x => x.status === statusFilter);
    if (branchFilter !== 'all') t = t.filter(x => x.fromBranch === branchFilter || x.toBranch === branchFilter);
    if (search) {
      const q = search.toLowerCase();
      t = t.filter(x => x.id.toLowerCase().includes(q) || x.fromBranch.toLowerCase().includes(q) || x.toBranch.toLowerCase().includes(q));
    }
    return t;
  }, [transfers, statusFilter, branchFilter, search]);

  const inTransit  = transfers.filter(t => t.status === 'in_transit');
  const drafts     = transfers.filter(t => t.status === 'draft');

  const handleNew = async ({ fromBranch, toBranch, transporter, items }) => {
    const fromBranchId = BRANCHES.find(b => b.name === fromBranch)?.id;
    const toBranchId = BRANCHES.find(b => b.name === toBranch)?.id;
    const lines = items
      .map(i => ({ productId: PRODUCTS.find(p => p.sku === i.sku)?.id, quantity: Number(i.qty) }))
      .filter(l => l.productId && l.quantity > 0);
    if (!fromBranchId || !toBranchId || lines.length === 0) {
      pushToast?.('Datos incompletos para el traslado', 'danger');
      return;
    }
    try {
      await createTransfer({
        fromBranchId, toBranchId, transporter: transporter || null,
        transferDate: new Date().toISOString().slice(0, 10), items: lines,
      });
      await reload();
      setShowNew(false);
      pushToast?.('Transferencia creada', 'success');
    } catch (err) {
      pushToast?.('No se pudo crear el traslado: ' + err.message, 'danger');
    }
  };

  const handleDispatch = async (transfer) => {
    try {
      await dispatchTransfer(transfer.apiId);
      await reload();
      setSelected(null);
      pushToast?.(`${transfer.id} despachada`, 'success');
    } catch (err) {
      pushToast?.('No se pudo despachar: ' + err.message, 'danger');
    }
  };

  const handleReceive = async (transfer) => {
    try {
      await receiveTransfer(transfer.apiId);
      await reload();
      setSelected(null);
      pushToast?.(`${transfer.id} recibida y stock actualizado`, 'success');
    } catch (err) {
      pushToast?.('No se pudo recibir: ' + err.message, 'danger');
    }
  };

  const selectedTransfer = selected ? transfers.find(t => t.id === selected.id) : null;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('transfers.title', 'Transferencias entre sucursales')}</h1>
          <div className="page-subtitle">{transfers.length} transferencias · {inTransit.length} en tránsito</div>
        </div>
        <div className="page-head-actions">
          <Button icon="plus" variant="accent" onClick={() => setShowNew(true)}>{t('transfers.newTransfer', 'Nueva transferencia')}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <StatCard
          icon="transfer" tone="pri"
          label="Total transferencias"
          value={transfers.length}
          foot={<>{transfers.filter(t => t.status === 'completed').length} completadas</>}
        />
        <StatCard
          icon="truck" tone="ter"
          label="En tránsito"
          valueColor={inTransit.length > 0 ? 'var(--warning)' : undefined}
          value={inTransit.length}
          foot="Pendiente de confirmación en destino"
        />
        <StatCard
          icon="edit" tone="sec"
          label="Borradores"
          value={drafts.length}
          foot="Sin despachar aún"
        />
        <StatCard
          icon="branch" tone="err"
          label="Sucursales activas"
          value={BRANCHES.filter(b => b.status === 'active').length}
          foot={<>de {BRANCHES.length} totales</>}
        />
      </div>

      {/* Filtros */}
      <div className="toolbar">
        <div className="search-wrap" style={{ flex: 1, maxWidth: 300 }}>
          <Icon name="search" className="icon" size={13} />
          <input className="search-input" placeholder={t('transfers.searchPlaceholder', 'No. transferencia, sucursal…')}
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="field-input" style={{ width: 'auto' }} value={statusFilter} onChange={e => setStatus(e.target.value)}>
          <option value="all">{t('common.all', 'Todos')} los estados</option>
          <option value="draft">{t('common.draft', 'Borrador')}</option>
          <option value="in_transit">En tránsito</option>
          <option value="completed">{t('common.completed', 'Completado')}</option>
          <option value="cancelled">{t('common.cancelled', 'Cancelado')}</option>
        </select>
        <select className="field-input" style={{ width: 'auto' }} value={branchFilter} onChange={e => setBranch(e.target.value)}>
          <option value="all">{t('common.allFem', 'Todas')} las sucursales</option>
          {BRANCHES.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
        </select>
        <span className="muted" style={{ fontSize: 12 }}>{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>{t('common.date', 'Fecha')}</th>
              <th>Origen</th>
              <th>Destino</th>
              <th>{t('inventory.transfer.carrier', 'Transportista / chofer')}</th>
              <th className="right">Ítems</th>
              <th>{t('common.status', 'Estado')}</th>
              <th>{t('common.actions', 'Acciones')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="empty">{t('common.noResults', 'Sin resultados')}</td></tr>
            ) : filtered.map(t => (
              <tr key={t.id} className="clickable" onClick={() => setSelected(t)}>
                <td className="mono" style={{ fontWeight: 500 }}>{t.id}</td>
                <td className="mono muted">{t.date}</td>
                <td>{t.fromBranch}</td>
                <td>{t.toBranch}</td>
                <td className="muted">{t.transporter || '—'}</td>
                <td className="right mono">{t.items.length}</td>
                <td><span className={`badge-m3 ${STATUS_CLASS[t.status]}`}>{STATUS_LABEL[t.status]}</span></td>
                <td>
                  {t.status === 'draft' && (
                    <Button size="sm" icon="truck" onClick={e => { e.stopPropagation(); setSelected(t); handleDispatch(t); }}>Despachar
                    </Button>
                  )}
                  {t.status === 'in_transit' && (
                    <Button size="sm" icon="check" variant="accent" onClick={e => { e.stopPropagation(); setSelected(t); handleReceive(t); }}>Recibir
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Panel detalle */}
      {selectedTransfer && (
        <div className="drawer-overlay">
          <TransferDetail
            transfer={selectedTransfer}
            onClose={() => setSelected(null)}
            onDispatch={handleDispatch}
            onReceive={handleReceive}
          />
        </div>
      )}

      {/* Modal nueva transferencia */}
      {showNew && (
        <NewTransferModal branches={BRANCHES} products={PRODUCTS} onSave={handleNew} onClose={() => setShowNew(false)} />
      )}
    </div>
  );
}
