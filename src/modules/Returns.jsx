// Stackline — Devoluciones · Notas de Crédito FEL
import React, { useState, useMemo } from 'react';
import Icon from '../components/Icon.jsx';
import { useTranslation } from 'react-i18next';
import { useCreditNotes } from '../hooks/useReturns.js';
import { createCreditNote, retryCreditNoteFel } from '../api/wave2.js';

const Q = v => `Q ${v.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── Mock data ────────────────────────────────────────────────────────────────
const INIT_NOTES = [
  {
    id: 'NC-2026-00021',
    ticketId:   'T-2026-04815',
    clientName: 'Consumidor Final',
    clientNit:  'CF',
    date:       '2026-05-23',
    type:       'anulacion',
    reason:     'Producto no entregado — error en despacho de Zona 10',
    amount:     156.75,
    felStatus:  'autorizada',
    felUuid:    'f3e2d1c0-4b5a-6c7d-8e9f-0a1b2c3d4e5f',
    cashier:    'Carlos M.',
    branch:     'Zona 10',
    items: [
      { name: 'Agua Pura Salvavidas 600ml', qty: 5, unitPrice: 4.50 },
      { name: 'Coca-Cola 600ml',            qty: 4, unitPrice: 8.50 },
      { name: 'Pan de Manteca',             qty: 6, unitPrice: 2.50 },
    ],
  },
  {
    id: 'NC-2026-00020',
    ticketId:   'T-2026-04821',
    clientName: 'Consumidor Final',
    clientNit:  'CF',
    date:       '2026-05-22',
    type:       'devolucion',
    reason:     'Producto en mal estado — Yogurt Natural caducado',
    amount:     44.80,
    felStatus:  'autorizada',
    felUuid:    'e2d1c0b9-3a4b-5c6d-7e8f-9a0b1c2d3e4f',
    cashier:    'José R.',
    branch:     'Mixco',
    items: [
      { name: 'Yogurt Natural 250ml', qty: 8, unitPrice: 5.60 },
    ],
  },
  {
    id: 'NC-2026-00019',
    ticketId:   'T-2026-04816',
    clientName: 'Consumidor Final',
    clientNit:  'CF',
    date:       '2026-05-22',
    type:       'descuento',
    reason:     'Ajuste de precio acordado en caja — diferencia cobrada en exceso',
    amount:     19.82,
    felStatus:  'autorizada',
    felUuid:    'd1c0b9a8-2a3b-4c5d-6e7f-8a9b0c1d2e3f',
    cashier:    'María H.',
    branch:     'Centro',
    items: [
      { name: 'Descuento aplicado sobre factura T-2026-04816', qty: 1, unitPrice: 19.82 },
    ],
  },
  {
    id: 'NC-2026-00018',
    ticketId:   'T-2026-04810',
    clientName: 'Consumidor Final',
    clientNit:  'CF',
    date:       '2026-05-24',
    type:       'devolucion',
    reason:     'Cliente devuelve producto — cambio de decisión',
    amount:     62.40,
    felStatus:  'pendiente',
    felUuid:    null,
    cashier:    'José R.',
    branch:     'Mixco',
    items: [
      { name: 'Cerveza Gallo 350ml',  qty: 6, unitPrice: 6.80 },
      { name: 'Sabritas Original 70g', qty: 3, unitPrice: 4.80 },
    ],
  },
  {
    id: 'NC-2026-00017',
    ticketId:   'T-2026-04805',
    clientName: 'Restaurante Don Quijote',
    clientNit:  '8876543-2',
    date:       '2026-05-20',
    type:       'anulacion',
    reason:     'Factura duplicada — ticket emitido dos veces por error del sistema',
    amount:     89.25,
    felStatus:  'autorizada',
    felUuid:    'c0b9a8f7-1a2b-3c4d-5e6f-7a8b9c0d1e2f',
    cashier:    'Carlos M.',
    branch:     'Zona 10',
    items: [
      { name: 'Arroz Blanco Premium 1kg', qty: 5, unitPrice: 8.20 },
      { name: 'Frijol Negro 1kg',          qty: 4, unitPrice: 9.50 },
    ],
  },
  {
    id: 'NC-2026-00016',
    ticketId:   'T-2026-04799',
    clientName: 'Tienda La Esperanza',
    clientNit:  '6234501-8',
    date:       '2026-05-19',
    type:       'devolucion',
    reason:     'Devolución de producto — NIT erróneo en factura original',
    amount:     32.00,
    felStatus:  'rechazada',
    felUuid:    null,
    felError:   'DTE original no encontrado en SAT — UUID inválido',
    cashier:    'Pedro M.',
    branch:     'Antigua',
    items: [
      { name: 'Cloro Magia Blanca 1L', qty: 4, unitPrice: 8.00 },
    ],
  },
  {
    id: 'NC-2026-00015',
    ticketId:   'T-2026-04792',
    clientName: 'Consumidor Final',
    clientNit:  'CF',
    date:       '2026-05-17',
    type:       'devolucion',
    reason:     'Producto incompleto — caja de cereal sin contenido',
    amount:     156.50,
    felStatus:  'autorizada',
    felUuid:    'b9a8f7e6-0a1b-2c3d-4e5f-6a7b8c9d0e1f',
    cashier:    'María H.',
    branch:     'Centro',
    items: [
      { name: 'Harina de Maíz 1kg',    qty: 10, unitPrice: 6.10 },
      { name: 'Azúcar Estándar 2kg',    qty: 8,  unitPrice: 13.00 },
    ],
  },
];

const TYPE_LABEL = { anulacion: 'Anulación total', devolucion: 'Devolución', descuento: 'Descuento post-venta' };
const TYPE_CLASS = { anulacion: 'danger', devolucion: 'warning', descuento: 'info' };
const FEL_LABEL  = { autorizada: 'Autorizada', pendiente: 'Pendiente FEL', rechazada: 'Rechazada' };
const FEL_CLASS  = { autorizada: 'success', pendiente: 'warning', rechazada: 'danger' };

const PAY_METHODS = ['efectivo', 'transferencia', 'cheque'];

export default function Returns({ pushToast }) {
  const { t } = useTranslation();
  const { items: notes, reload: reloadNotes } = useCreditNotes();
  const [search, setSearch]         = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterFel, setFilterFel]   = useState('all');
  const [selected, setSelected]     = useState(null);
  const [createModal, setCreateModal] = useState(false);

  // Stats
  const mayo      = notes.filter(n => n.date.startsWith('2026-05'));
  const totalMayo = mayo.reduce((s, n) => s + n.amount, 0);
  const pending   = notes.filter(n => n.felStatus === 'pendiente').length;
  const rejected  = notes.filter(n => n.felStatus === 'rechazada').length;
  const authorized = notes.filter(n => n.felStatus === 'autorizada').length;

  const filtered = useMemo(() => notes.filter(n => {
    if (filterType !== 'all' && n.type      !== filterType) return false;
    if (filterFel  !== 'all' && n.felStatus !== filterFel)  return false;
    if (search) {
      const q = search.toLowerCase();
      if (!n.id.toLowerCase().includes(q) &&
          !n.ticketId.toLowerCase().includes(q) &&
          !n.clientName.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [notes, search, filterType, filterFel]);

  async function handleCreate(newNote) {
    try {
      await createCreditNote({
        noteType: newNote.type,
        ticketRef: newNote.ticketId,
        clientName: newNote.clientName,
        clientNit: newNote.clientNit,
        cashier: newNote.cashier,
        branchName: newNote.branch,
        reason: newNote.reason,
        refundMethod: 'efectivo',
        items: newNote.items.map(i => ({ itemName: i.name, quantity: i.qty, unitPrice: i.unitPrice })),
      });
      setCreateModal(false);
      pushToast('Nota de crédito emitida y autorizada por FEL', 'success');
      reloadNotes();
    } catch (err) {
      pushToast('No se pudo emitir la nota de crédito: ' + err.message, 'error');
    }
  }

  async function retryFel(note) {
    try {
      await retryCreditNoteFel(note.backendId, { felStatus: 'autorizada' });
      pushToast(t('returns.retrySent', 'NC re-enviada — autorizada por SAT'), 'success');
      reloadNotes();
    } catch (err) {
      pushToast('No se pudo reintentar el envío FEL: ' + err.message, 'error');
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('returns.title', 'Devoluciones')} · {t('returns.creditNotes', 'Notas de Crédito')}</h1>
          <div className="page-subtitle">{t('returns.subtitle', 'Anulaciones, devoluciones y ajustes post-venta · FEL Guatemala')}</div>
        </div>
        <div className="page-head-actions">
          <button className="btn accent" onClick={() => setCreateModal(true)}>
            <Icon name="plus" size={12} /> {t('returns.newReturn', 'Nueva nota de crédito')}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <div className="stat">
          <div className="label"><Icon name="return" size={11} />{t('returns.issuedMayo', 'NCs emitidas mayo')}</div>
          <div className="val mono">{mayo.length}</div>
          <div className="delta muted">{notes.length} {t('returns.inTotal', 'en total')}</div>
        </div>
        <div className="stat">
          <div className="label"><Icon name="cash" size={11} />{t('returns.amountMayo', 'Monto devuelto mayo')}</div>
          <div className="val mono" style={{ color: 'var(--danger)' }}>−{Q(totalMayo)}</div>
          <div className="delta muted">{t('returns.ivaCredit', 'IVA crédito')}: −{Q(totalMayo * 0.12 / 1.12)}</div>
        </div>
        <div className="stat">
          <div className="label"><Icon name="clock" size={11} />{t('returns.pendingFel', 'Pendientes FEL')}</div>
          <div className="val mono" style={{ color: pending > 0 ? 'var(--warning)' : undefined }}>{pending}</div>
          <div className="delta muted">{t('returns.waitingSat', 'Esperando respuesta SAT')}</div>
        </div>
        <div className="stat">
          <div className="label"><Icon name="check" size={11} />{t('returns.authorizedSat', 'Autorizadas SAT')}</div>
          <div className="val mono" style={{ color: 'var(--success)' }}>{authorized}</div>
          <div className="delta muted" style={{ color: rejected > 0 ? 'var(--danger)' : undefined }}>
            {rejected > 0
              ? t('returns.rejectedNeedAttention', '{{count}} rechazadas — requieren atención', { count: rejected })
              : t('returns.noRejections', 'Sin rechazos')}
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="filterbar">
        <div className="search-wrap" style={{ flex: 1, maxWidth: 320 }}>
          <Icon name="search" className="icon" size={13} />
          <input
            className="search-input"
            placeholder={t('returns.searchPlaceholder', 'Buscar NC, ticket, cliente…')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="input" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="all">{t('returns.allTypes', 'Todos los tipos')}</option>
          <option value="anulacion">{t('returns.typeAnulacion', 'Anulación total')}</option>
          <option value="devolucion">{t('returns.typeDevolucion', 'Devolución')}</option>
          <option value="descuento">{t('returns.typeDescuento', 'Descuento post-venta')}</option>
        </select>
        <select className="input" value={filterFel} onChange={e => setFilterFel(e.target.value)}>
          <option value="all">{t('returns.allFelStatus', 'Todo estado FEL')}</option>
          <option value="autorizada">{t('returns.felAuthorized', 'Autorizadas')}</option>
          <option value="pendiente">{t('returns.felPending', 'Pendientes')}</option>
          <option value="rechazada">{t('returns.felRejected', 'Rechazadas')}</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="tbl-wrap"><table className="tbl">
          <thead>
            <tr>
              <th>{t('returns.creditNote', 'Nota de Crédito')}</th>
              <th>{t('returns.originTicket', 'Ticket origen')}</th>
              <th>{t('common.client', 'Cliente')}</th>
              <th>{t('common.date', 'Fecha')}</th>
              <th>{t('common.type', 'Tipo')}</th>
              <th style={{ textAlign: 'right' }}>{t('common.amount', 'Monto')}</th>
              <th>{t('returns.cashierHeader', 'Cajero')}</th>
              <th>{t('returns.felStatus', 'Estado FEL')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={9} className="empty">{t('returns.noResults', 'Sin notas de crédito con los filtros aplicados')}</td></tr>
            ) : filtered.map(n => (
              <tr key={n.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(n)}>
                <td><span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{n.id}</span></td>
                <td><span className="mono muted" style={{ fontSize: 12 }}>{n.ticketId}</span></td>
                <td>
                  <div style={{ fontSize: 13 }}>{n.clientName}</div>
                  <div className="mono muted" style={{ fontSize: 10 }}>{n.clientNit}</div>
                </td>
                <td className="muted" style={{ fontSize: 12 }}>{n.date}</td>
                <td>
                  <span className={`pill ${TYPE_CLASS[n.type]}`} style={{ fontSize: 9 }}>
                    {TYPE_LABEL[n.type]}
                  </span>
                </td>
                <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 13, color: 'var(--danger)' }}>
                  −{Q(n.amount)}
                </td>
                <td className="muted" style={{ fontSize: 12 }}>{n.cashier} · {n.branch}</td>
                <td>
                  <span className={`pill ${FEL_CLASS[n.felStatus]}`} style={{ fontSize: 9 }}>
                    {FEL_LABEL[n.felStatus]}
                  </span>
                </td>
                <td onClick={e => e.stopPropagation()}>
                  {n.felStatus === 'rechazada' && (
                    <button className="btn" style={{ fontSize: 11, padding: '3px 8px', color: 'var(--warning)', borderColor: 'var(--warning)' }}
                      onClick={() => retryFel(n)}>
                      {t('returns.retry', 'Reintentar')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>

      {/* Drawer detalle */}
      {selected && (
        <div className="drawer-overlay" onClick={() => setSelected(null)}>
          <div className="drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-head">
              <div>
                <div className="drawer-title">{selected.id}</div>
                <div className="muted" style={{ fontSize: 12 }}>{selected.ticketId} · {selected.branch}</div>
              </div>
              <button className="icon-btn" onClick={() => setSelected(null)}><Icon name="close" /></button>
            </div>
            <div className="drawer-body" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {/* Info principal */}
              <div className="detail-grid">
                <Row label={t('returns.creditNote', 'NC')}             value={selected.id} mono />
                <Row label={t('returns.originTicket', 'Ticket origen')}  value={selected.ticketId} mono />
                <Row label={t('common.client', 'Cliente')}        value={`${selected.clientName} · NIT ${selected.clientNit}`} />
                <Row label={t('common.date', 'Fecha')}          value={selected.date} />
                <Row label={t('returns.cashierHeader', 'Cajero')}         value={`${selected.cashier} · ${selected.branch}`} />
                <Row label={t('common.type', 'Tipo')}           value={TYPE_LABEL[selected.type]} />
                <Row label={t('returns.reason', 'Motivo')}           value={selected.reason} />
                <Row label={t('returns.ncAmount', 'Monto NC')}       value={`−${Q(selected.amount)}`} bold />
                <Row label={t('returns.ivaDebit', 'IVA débito')}     value={`−${Q(selected.amount * 0.12 / 1.12)}`} />
              </div>

              {/* Estado FEL */}
              <div style={{ marginTop: 16, marginBottom: 8 }}>
                <div className="detail-label" style={{ marginBottom: 8 }}>{t('returns.felStatus', 'Estado FEL')}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={`pill ${FEL_CLASS[selected.felStatus]}`}>
                    {FEL_LABEL[selected.felStatus]}
                  </span>
                </div>
                {selected.felUuid && (
                  <div className="mono muted" style={{ fontSize: 10, marginTop: 6, wordBreak: 'break-all' }}>
                    UUID: {selected.felUuid}
                  </div>
                )}
                {selected.felError && (
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--danger)' }}>
                    {t('returns.satError', 'Error SAT')}: {selected.felError}
                  </div>
                )}
              </div>

              {/* Items */}
              <div style={{ marginTop: 12 }}>
                <div className="detail-label" style={{ marginBottom: 8 }}>{t('returns.items', 'Artículos')}</div>
                <div className="tbl-wrap" style={{ borderRadius: 'var(--r-md)' }}>
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>{t('common.product', 'Producto')}</th>
                        <th style={{ textAlign: 'right' }}>{t('returns.qty', 'Cant.')}</th>
                        <th style={{ textAlign: 'right' }}>{t('returns.unitPrice', 'P. Unit.')}</th>
                        <th style={{ textAlign: 'right' }}>{t('common.total', 'Total')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.items.map((item, i) => (
                        <tr key={i}>
                          <td style={{ fontSize: 12 }}>{item.name}</td>
                          <td style={{ textAlign: 'right', fontSize: 12 }}>{item.qty}</td>
                          <td style={{ textAlign: 'right', fontSize: 12 }}>{Q(item.unitPrice)}</td>
                          <td style={{ textAlign: 'right', fontSize: 12, fontWeight: 600 }}>{Q(item.qty * item.unitPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {selected.felStatus === 'rechazada' && (
                <div style={{ marginTop: 16 }}>
                  <button className="btn" style={{ width: '100%', justifyContent: 'center', color: 'var(--warning)', borderColor: 'var(--warning)' }}
                    onClick={() => { retryFel(selected); setSelected(null); }}>
                    <Icon name="return" size={13} /> {t('returns.retryFel', 'Reintentar envío FEL')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal nueva NC */}
      {createModal && (
        <CreateModal
          onClose={() => setCreateModal(false)}
          onSave={handleCreate}
        />
      )}
    </div>
  );
}

function Row({ label, value, mono, bold }) {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className={mono ? 'mono' : ''} style={{ fontSize: 13, fontWeight: bold ? 700 : 400, textAlign: 'right', maxWidth: 220 }}>{value}</span>
    </div>
  );
}

function CreateModal({ onClose, onSave }) {
  const { t } = useTranslation();
  const [ticketId,    setTicketId]    = useState('');
  const [clientName,  setClientName]  = useState('Consumidor Final');
  const [clientNit,   setClientNit]   = useState('CF');
  const [type,        setType]        = useState('devolucion');
  const [reason,      setReason]      = useState('');
  const [amount,      setAmount]      = useState('');
  const [cashier,     setCashier]     = useState('');
  const [branch,      setBranch]      = useState('Zona 10');
  const [itemName,    setItemName]    = useState('');
  const [itemQty,     setItemQty]     = useState('1');
  const [itemPrice,   setItemPrice]   = useState('');
  const [items,       setItems]       = useState([]);

  const totalItems = items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  const finalAmount = type === 'descuento' ? parseFloat(amount) || 0 : totalItems;
  const valid = ticketId && reason && finalAmount > 0 && (type === 'descuento' ? true : items.length > 0);

  function addItem() {
    if (!itemName || !itemPrice || parseFloat(itemPrice) <= 0) return;
    setItems(prev => [...prev, { name: itemName, qty: parseInt(itemQty) || 1, unitPrice: parseFloat(itemPrice) }]);
    setItemName(''); setItemQty('1'); setItemPrice('');
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{t('returns.newReturn', 'Nueva nota de crédito')}</h3>
          <button className="icon-btn" onClick={onClose}><Icon name="close" /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Tipo */}
          <div className="field">
            <label className="field-label">{t('returns.ncType', 'Tipo de nota de crédito')}</label>
            <select className="field-input" value={type} onChange={e => setType(e.target.value)}>
              <option value="anulacion">{t('returns.typeAnulacion', 'Anulación total')}</option>
              <option value="devolucion">{t('returns.typeDevolucionProducts', 'Devolución de productos')}</option>
              <option value="descuento">{t('returns.typeDescuento', 'Descuento post-venta')}</option>
            </select>
          </div>

          {/* Ticket */}
          <div className="form-grid">
            <div className="field">
              <label className="field-label">{t('returns.originTicketLabel', 'Ticket / Factura origen')}</label>
              <input className="field-input mono" placeholder="T-2026-XXXXX"
                value={ticketId} onChange={e => setTicketId(e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label">{t('returns.cashierHeader', 'Cajero')}</label>
              <input className="field-input" placeholder={t('returns.cashierPlaceholder', 'Nombre del cajero')}
                value={cashier} onChange={e => setCashier(e.target.value)} />
            </div>
          </div>

          {/* Cliente */}
          <div className="form-grid">
            <div className="field">
              <label className="field-label">{t('common.client', 'Cliente')}</label>
              <input className="field-input" value={clientName} onChange={e => setClientName(e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label">NIT</label>
              <input className="field-input mono" value={clientNit} onChange={e => setClientNit(e.target.value)} />
            </div>
          </div>

          {/* Motivo */}
          <div className="field">
            <label className="field-label">{t('returns.reason', 'Motivo de la devolución')}</label>
            <input className="field-input" placeholder={t('returns.reasonPlaceholder', 'Describa el motivo…')}
              value={reason} onChange={e => setReason(e.target.value)} />
          </div>

          {/* Items (para anulacion / devolucion) */}
          {type !== 'descuento' && (
            <div className="field">
              <label className="field-label">{t('returns.itemsToReturn', 'Artículos a devolver')}</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 90px auto', gap: 6, marginBottom: 6 }}>
                <input className="field-input" placeholder={t('returns.productName', 'Nombre del producto')}
                  value={itemName} onChange={e => setItemName(e.target.value)} />
                <input className="field-input mono" type="number" min="1" placeholder={t('returns.qty', 'Cant.')}
                  value={itemQty} onChange={e => setItemQty(e.target.value)} />
                <input className="field-input mono" type="number" min="0" step="0.01" placeholder={t('returns.unitPrice', 'P. Unit.')}
                  value={itemPrice} onChange={e => setItemPrice(e.target.value)} />
                <button className="btn" style={{ padding: '0 10px' }} onClick={addItem}>
                  <Icon name="plus" size={12} />
                </button>
              </div>
              {items.length > 0 && (
                <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-md)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 500, color: 'var(--muted)', fontSize: 10 }}>{t('common.product', 'Producto')}</th>
                        <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 500, color: 'var(--muted)', fontSize: 10 }}>{t('returns.qty', 'Cant.')}</th>
                        <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 500, color: 'var(--muted)', fontSize: 10 }}>{t('common.total', 'Total')}</th>
                        <th style={{ width: 28 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '6px 10px' }}>{it.name}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{it.qty}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>Q {(it.qty * it.unitPrice).toFixed(2)}</td>
                          <td style={{ padding: '0 6px' }}>
                            <button className="icon-btn" style={{ width: 22, height: 22 }}
                              onClick={() => setItems(prev => prev.filter((_, j) => j !== i))}>
                              <Icon name="x" size={11} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {items.length > 0 && (
                <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, marginTop: 6 }}>
                  {t('common.total', 'Total')}: −Q {totalItems.toFixed(2)}
                </div>
              )}
            </div>
          )}

          {/* Monto (solo para descuento) */}
          {type === 'descuento' && (
            <div className="field">
              <label className="field-label">{t('returns.discountAmount', 'Monto del descuento (Q)')}</label>
              <input type="number" className="field-input mono" min="0.01" step="0.01"
                value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
          )}

          {finalAmount > 0 && (
            <div style={{ background: 'var(--danger-soft)', border: '1px solid var(--danger)', borderRadius: 'var(--r-md)', padding: '10px 14px', fontSize: 13 }}>
              <span style={{ color: 'var(--danger)', fontWeight: 700 }}>
                {t('returns.creditNote', 'Nota de crédito')}: −Q {finalAmount.toFixed(2)}
              </span>
              <span className="muted" style={{ marginLeft: 10, fontSize: 12 }}>
                {t('common.iva', 'IVA')}: −Q {(finalAmount * 0.12 / 1.12).toFixed(2)}
              </span>
            </div>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>{t('common.cancel', 'Cancelar')}</button>
          <button className="btn accent" disabled={!valid}
            onClick={() => onSave({
              ticketId, clientName, clientNit, type, reason,
              amount: finalAmount, items: type === 'descuento'
                ? [{ name: `Descuento sobre ${ticketId}`, qty: 1, unitPrice: finalAmount }]
                : items,
              cashier: cashier || 'Sistema', branch,
            })}>
            <Icon name="check" size={13} /> {t('returns.submitFel', 'Emitir y enviar a FEL')}
          </button>
        </div>
      </div>
    </div>
  );
}
