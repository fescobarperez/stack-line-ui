// Stackline — Devoluciones · Notas de Crédito FEL
import React, { useState, useMemo } from 'react';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import StatCard from '../components/StatCard.jsx';
import { useTranslation } from 'react-i18next';
import { useCreditNotes } from '../hooks/useReturns.js';
import { createCreditNote, retryCreditNoteFel } from '../api/wave2.js';

const Q = v => `Q ${v.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
      pushToast('No se pudo emitir la nota de crédito: ' + err.message, 'danger');
    }
  }

  async function retryFel(note) {
    try {
      await retryCreditNoteFel(note.backendId, { felStatus: 'autorizada' });
      pushToast(t('returns.retrySent', 'NC re-enviada — autorizada por SAT'), 'success');
      reloadNotes();
    } catch (err) {
      pushToast('No se pudo reintentar el envío FEL: ' + err.message, 'danger');
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
          <Button icon="plus" variant="accent" onClick={() => setCreateModal(true)}>{t('returns.newReturn', 'Nueva nota de crédito')}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <StatCard
          icon="return" tone="pri"
          label={t('returns.issuedMayo', 'NCs emitidas mayo')}
          value={mayo.length}
          foot={<>{notes.length} {t('returns.inTotal', 'en total')}</>}
        />
        <StatCard
          icon="cash" tone="ter"
          label={t('returns.amountMayo', 'Monto devuelto mayo')}
          valueColor={'var(--danger)'}
          value={<>−{Q(totalMayo)}</>}
          foot={<>{t('returns.ivaCredit', 'IVA crédito')}: −{Q(totalMayo * 0.12 / 1.12)}</>}
        />
        <StatCard
          icon="clock" tone="sec"
          label={t('returns.pendingFel', 'Pendientes FEL')}
          valueColor={pending > 0 ? 'var(--warning)' : undefined}
          value={pending}
          foot={t('returns.waitingSat', 'Esperando respuesta SAT')}
        />
        <StatCard
          icon="check" tone="err"
          label={t('returns.authorizedSat', 'Autorizadas SAT')}
          valueColor={'var(--success)'}
          value={authorized}
          foot={rejected > 0 ? t('returns.rejectedNeedAttention', '{{count}} rechazadas — requieren atención', { count: rejected }) : t('returns.noRejections', 'Sin rechazos')}
        />
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
                <td><span className="mono" style={{ fontSize: 12, fontWeight: 500 }}>{n.id}</span></td>
                <td><span className="mono muted" style={{ fontSize: 12 }}>{n.ticketId}</span></td>
                <td>
                  <div style={{ fontSize: 14 }}>{n.clientName}</div>
                  <div className="mono muted" style={{ fontSize: 11 }}>{n.clientNit}</div>
                </td>
                <td className="muted">{n.date}</td>
                <td>
                  <span className={`badge-m3 ${TYPE_CLASS[n.type]}`}>
                    {TYPE_LABEL[n.type]}
                  </span>
                </td>
                <td style={{ textAlign: 'right', fontWeight: 500, color: 'var(--danger)' }}>
                  −{Q(n.amount)}
                </td>
                <td className="muted">{n.cashier} · {n.branch}</td>
                <td>
                  <span className={`badge-m3 ${FEL_CLASS[n.felStatus]}`}>
                    {FEL_LABEL[n.felStatus]}
                  </span>
                </td>
                <td onClick={e => e.stopPropagation()}>
                  {n.felStatus === 'rechazada' && (
                    <Button size="sm" style={{ color: 'var(--warning)', borderColor: 'var(--warning)' }} onClick={() => retryFel(n)}>
                      {t('returns.retry', 'Reintentar')}
                    </Button>
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
                  <span className={`badge-m3 ${FEL_CLASS[selected.felStatus]}`}>
                    {FEL_LABEL[selected.felStatus]}
                  </span>
                </div>
                {selected.felUuid && (
                  <div className="mono muted" style={{ fontSize: 11, marginTop: 6, wordBreak: 'break-all' }}>
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
                          <td>{item.name}</td>
                          <td style={{ textAlign: 'right' }}>{item.qty}</td>
                          <td style={{ textAlign: 'right' }}>{Q(item.unitPrice)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 500 }}>{Q(item.qty * item.unitPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {selected.felStatus === 'rechazada' && (
                <div style={{ marginTop: 16 }}>
                  <Button icon="return" style={{ width: '100%', justifyContent: 'center', color: 'var(--warning)', borderColor: 'var(--warning)' }} onClick={() => { retryFel(selected); setSelected(null); }}>{t('returns.retryFel', 'Reintentar envío FEL')}
                  </Button>
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
      <span className={mono ? 'mono' : ''} style={{ fontSize: 14, fontWeight: bold ? 700 : 400, textAlign: 'right', maxWidth: 220 }}>{value}</span>
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
                <Button icon="plus" iconOnly onClick={addItem} />
              </div>
              {items.length > 0 && (
                <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-md)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 500, color: 'var(--muted)' }}>{t('common.product', 'Producto')}</th>
                        <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 500, color: 'var(--muted)' }}>{t('returns.qty', 'Cant.')}</th>
                        <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 500, color: 'var(--muted)' }}>{t('common.total', 'Total')}</th>
                        <th style={{ width: 28 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '6px 10px' }}>{it.name}</td>
                          <td className="num" style={{ padding: '6px 10px' }}>{it.qty}</td>
                          <td className="num" style={{ padding: '6px 10px', fontWeight: 500 }}>Q {(it.qty * it.unitPrice).toFixed(2)}</td>
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
                <div style={{ textAlign: 'right', fontSize: 14, fontWeight: 500, marginTop: 6 }}>
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
            <div style={{ background: 'var(--danger-soft)', border: '1px solid var(--danger)', borderRadius: 'var(--r-md)', padding: '10px 14px', fontSize: 14 }}>
              <span style={{ color: 'var(--danger)', fontWeight: 500 }}>
                {t('returns.creditNote', 'Nota de crédito')}: −Q {finalAmount.toFixed(2)}
              </span>
              <span className="muted" style={{ marginLeft: 10, fontSize: 12 }}>
                {t('common.iva', 'IVA')}: −Q {(finalAmount * 0.12 / 1.12).toFixed(2)}
              </span>
            </div>
          )}
        </div>
        <div className="modal-foot">
          <Button variant="ghost" onClick={onClose}>{t('common.cancel', 'Cancelar')}</Button>
          <Button icon="check" variant="accent" disabled={!valid} onClick={() => onSave({ ticketId, clientName, clientNit, type, reason, amount: finalAmount, items: type === 'descuento' ? [{ name: `Descuento sobre ${ticketId}`, qty: 1, unitPrice: finalAmount }] : items, cashier: cashier || 'Sistema', branch, })}>{t('returns.submitFel', 'Emitir y enviar a FEL')}
          </Button>
        </div>
      </div>
    </div>
  );
}
