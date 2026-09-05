// Stackline — Módulo de Clientes (CRM básico)
import React, { useState, useMemo, useEffect } from 'react';
import Icon from '../components/Icon.jsx';
import { useTranslation } from 'react-i18next';
import { useClients } from '../hooks/useMasters.js';
import { usePayments } from '../hooks/useOperations.js';

const TYPE_LABEL = { CF: 'CF', minorista: 'Minorista', mayorista: 'Mayorista', exento: 'Exento' };
const STATUS_LABEL = { active: 'Activo', inactive: 'Inactivo', blocked: 'Bloqueado' };
const STATUS_CLASS = { active: 'success', inactive: 'neutral', blocked: 'danger' };
const METHOD_LABEL = { efectivo: 'Efectivo', transferencia: 'Transferencia', cheque: 'Cheque', tarjeta: 'Tarjeta' };

function fmt(n) { return `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function initials(name) {
  const w = name.split(' ').filter(s => s.length > 1);
  return (w[0] ? w[0][0] : '') + (w[1] ? w[1][0] : '').toUpperCase();
}

// ── Formulario Nuevo / Editar cliente ────────────────────────────────────────
function ClientForm({ initial = {}, onSave, onCancel }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name: '',
    nit: 'CF',
    clientType: 'CF',
    address: '',
    phone: '',
    email: '',
    creditLimit: '0',
    paymentTerms: '0',
    notes: '',
    ...initial,
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave(form);
  };

  return (
    <form className="drawer-body" onSubmit={handleSubmit}>
      <div className="form-grid">
        <div className="field span-2">
          <label className="field-label">{t('clients.form.name', 'Nombre / Razón social *')}</label>
          <input className="field-input" value={form.name} onChange={e => set('name', e.target.value)} required />
        </div>
        <div className="field">
          <label className="field-label">{t('clients.form.nit', 'NIT')}</label>
          <input className="field-input mono" placeholder={t('clients.form.nitPlaceholder', 'CF')} value={form.nit} onChange={e => set('nit', e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label">{t('clients.form.type', 'Tipo de cliente')}</label>
          <select className="field-input" value={form.clientType} onChange={e => set('clientType', e.target.value)}>
            <option value="CF">{t('clients.form.types.cf', 'CF (Consumidor Final)')}</option>
            <option value="minorista">{t('clients.form.types.retail', 'Minorista')}</option>
            <option value="mayorista">{t('clients.form.types.wholesale', 'Mayorista')}</option>
            <option value="exento">{t('clients.form.types.exempt', 'Exento de IVA')}</option>
          </select>
        </div>
        <div className="field span-2">
          <label className="field-label">{t('clients.form.address', 'Dirección')}</label>
          <input className="field-input" value={form.address} onChange={e => set('address', e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label">{t('clients.form.phone', 'Teléfono')}</label>
          <input className="field-input" value={form.phone} onChange={e => set('phone', e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label">{t('clients.form.email', 'Correo electrónico')}</label>
          <input className="field-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label">{t('clients.form.creditLimit', 'Límite de crédito (Q)')}</label>
          <input className="field-input mono" type="number" min="0" step="0.01" value={form.creditLimit} onChange={e => set('creditLimit', e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label">{t('clients.form.paymentTerms', 'Plazo de pago (días)')}</label>
          <input className="field-input mono" type="number" min="0" value={form.paymentTerms} onChange={e => set('paymentTerms', e.target.value)} />
        </div>
        <div className="field span-2">
          <label className="field-label">{t('clients.form.internalNotes', 'Notas internas')}</label>
          <textarea className="field-input" rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>
      </div>
      <div className="drawer-footer">
        <button type="button" className="btn" onClick={onCancel}>{t('common.cancel', 'Cancelar')}</button>
        <button type="submit" className="btn accent"><Icon name="check" size={12} />{t('common.save', 'Guardar')}</button>
      </div>
    </form>
  );
}

// ── Modal: Registrar pago ────────────────────────────────────────────────────
function PaymentModal({ client, onSave, onClose }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ amount: '', paymentMethod: 'efectivo', reference: '', notes: '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) return;
    onSave(form);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-title">{t('clients.payment.title', 'Registrar pago')}</div>
            <div className="muted" style={{ fontSize: 12 }}>{client.name}</div>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="info-row" style={{ marginBottom: 16 }}>
              <span className="muted">{t('clients.payment.pendingBalance', 'Saldo pendiente')}</span>
              <span className="mono" style={{ color: 'var(--danger)', fontWeight: 600 }}>{fmt(client.balance)}</span>
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label className="field-label">{t('clients.payment.amount', 'Monto del pago (Q) *')}</label>
              <input className="field-input mono" type="number" min="0.01" step="0.01" value={form.amount}
                onChange={e => set('amount', e.target.value)} required autoFocus />
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label className="field-label">{t('clients.payment.method', 'Forma de pago')}</label>
              <select className="field-input" value={form.paymentMethod} onChange={e => set('paymentMethod', e.target.value)}>
                <option value="efectivo">{t('clients.payment.methods.cash', 'Efectivo')}</option>
                <option value="transferencia">{t('clients.payment.methods.transfer', 'Transferencia')}</option>
                <option value="cheque">{t('clients.payment.methods.check', 'Cheque')}</option>
                <option value="tarjeta">{t('clients.payment.methods.card', 'Tarjeta')}</option>
              </select>
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label className="field-label">{t('clients.payment.reference', 'Referencia / No. cheque')}</label>
              <input className="field-input" value={form.reference} onChange={e => set('reference', e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label">{t('clients.payment.notes', 'Notas')}</label>
              <input className="field-input" value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose}>{t('common.cancel', 'Cancelar')}</button>
            <button type="submit" className="btn accent"><Icon name="cash" size={12} />{t('clients.payment.submit', 'Registrar pago')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Panel de detalle de cliente ──────────────────────────────────────────────
function ClientDetail({ client, payments, onClose, onEdit, onPayment }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState('info');
  const clientPayments = payments.filter(p => p.clientId === client.id);
  const available = client.creditLimit - client.balance;
  const usedPct = client.creditLimit > 0 ? Math.min(100, (client.balance / client.creditLimit) * 100) : 0;

  return (
    <div className="drawer">
      <div className="drawer-head">
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div className="avatar" style={{ width: 40, height: 40, fontSize: 15, flexShrink: 0 }}>
            {initials(client.name)}
          </div>
          <div>
            <div className="drawer-title">{client.name}</div>
            <div className="muted mono" style={{ fontSize: 11 }}>
              NIT {client.nit} · <span className={`pill ${STATUS_CLASS[client.status]}`} style={{ fontSize: 10 }}>{STATUS_LABEL[client.status]}</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {client.balance > 0 && (
            <button className="btn" onClick={onPayment}>
              <Icon name="cash" size={12} />{t('clients.payment.title', 'Pago')}
            </button>
          )}
          <button className="btn" onClick={onEdit}><Icon name="edit" size={12} />{t('common.edit', 'Editar')}</button>
          <button className="icon-btn" onClick={onClose}><Icon name="x" /></button>
        </div>
      </div>

      <div className="tabs" style={{ padding: '0 20px' }}>
        <div className={`tab ${tab === 'info' ? 'active' : ''}`} onClick={() => setTab('info')}>{t('clients.drawer.tabs.info', 'Información')}</div>
        <div className={`tab ${tab === 'cxc' ? 'active' : ''}`} onClick={() => setTab('cxc')}>
          {t('clients.drawer.tabs.cxc', 'CxC / Pagos')} <span className="count">{clientPayments.length}</span>
        </div>
      </div>

      {tab === 'info' && (
        <div className="drawer-body" style={{ overflowY: 'auto' }}>
          {/* Crédito */}
          {client.clientType !== 'CF' && (
            <div className="stat-card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="label"><Icon name="card" size={11} />{t('clients.drawer.availableCredit', 'Crédito disponible')}</span>
                <span className={`pill ${usedPct > 90 ? 'danger' : usedPct > 70 ? 'warning' : 'success'}`} style={{ fontSize: 10 }}>
                  {usedPct.toFixed(0)}% usado
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span className="mono" style={{ fontSize: 20, fontWeight: 700 }}>{fmt(available)}</span>
                <span className="muted mono" style={{ fontSize: 12 }}>de {fmt(client.creditLimit)}</span>
              </div>
              <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${usedPct}%`, background: usedPct > 90 ? 'var(--danger)' : usedPct > 70 ? 'var(--warning)' : 'var(--accent)', borderRadius: 3, transition: 'width .3s' }} />
              </div>
              {client.paymentTerms > 0 && (
                <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>{t('clients.drawer.paymentTerms', 'Plazo: {{days}} días', { days: client.paymentTerms })}</div>
              )}
            </div>
          )}

          <div className="detail-grid">
            {client.address && (
              <div className="detail-row">
                <span className="detail-label">{t('clients.drawer.labels.address', 'Dirección')}</span>
                <span>{client.address}</span>
              </div>
            )}
            {client.phone && (
              <div className="detail-row">
                <span className="detail-label">{t('clients.drawer.labels.phone', 'Teléfono')}</span>
                <span className="mono">{client.phone}</span>
              </div>
            )}
            {client.email && (
              <div className="detail-row">
                <span className="detail-label">{t('clients.drawer.labels.email', 'Correo')}</span>
                <span>{client.email}</span>
              </div>
            )}
            <div className="detail-row">
              <span className="detail-label">{t('clients.drawer.labels.type', 'Tipo')}</span>
              <span>{TYPE_LABEL[client.clientType]}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">{t('clients.drawer.labels.pendingBalance', 'Saldo pendiente')}</span>
              <span className="mono" style={{ color: client.balance > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>
                {fmt(client.balance)}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">{t('clients.drawer.labels.since', 'Cliente desde')}</span>
              <span className="mono">{client.createdAt}</span>
            </div>
          </div>
        </div>
      )}

      {tab === 'cxc' && (
        <div className="drawer-body" style={{ overflowY: 'auto', padding: 0 }}>
          {clientPayments.length === 0 ? (
            <div className="empty" style={{ padding: '40px 20px' }}>
              <Icon name="cash" size={24} style={{ opacity: 0.3, marginBottom: 8 }} />
              <div>{t('clients.drawer.noPayments', 'Sin pagos registrados')}</div>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('clients.drawer.paymentHeaders.date', 'Fecha')}</th>
                  <th>{t('clients.drawer.paymentHeaders.method', 'Forma de pago')}</th>
                  <th>{t('clients.drawer.paymentHeaders.reference', 'Referencia')}</th>
                  <th className="right">{t('clients.drawer.paymentHeaders.amount', 'Monto')}</th>
                </tr>
              </thead>
              <tbody>
                {clientPayments.map(p => (
                  <tr key={p.id}>
                    <td className="mono muted">{p.date}</td>
                    <td>{METHOD_LABEL[p.paymentMethod] || p.paymentMethod}</td>
                    <td className="mono muted">{p.reference || '—'}</td>
                    <td className="right mono" style={{ color: 'var(--success)', fontWeight: 600 }}>+{fmt(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ── Módulo principal ─────────────────────────────────────────────────────────
export default function Clients({ pushToast }) {
  const { t } = useTranslation();
  // Clientes y pagos desde el backend (con fallback automático al mock).
  const { items: apiClients } = useClients();
  const { items: paymentsRaw } = usePayments();
  const CLIENT_PAYMENTS = useMemo(
    () => paymentsRaw.map(p => ({ ...p, date: p.paymentDate || p.date, paymentMethod: p.method || p.paymentMethod })),
    [paymentsRaw],
  );
  const [tab, setTab] = useState('lista');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [clients, setClients] = useState(apiClients);
  // Sincroniza la lista local cuando llegan los clientes del backend.
  useEffect(() => { setClients(apiClients); }, [apiClients]);

  const filtered = useMemo(() => {
    let c = clients;
    if (typeFilter !== 'all') c = c.filter(x => x.clientType === typeFilter);
    if (statusFilter !== 'all') c = c.filter(x => x.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      c = c.filter(x => x.name.toLowerCase().includes(q) || x.nit.toLowerCase().includes(q));
    }
    return c;
  }, [clients, typeFilter, statusFilter, search]);

  const cxcClients = useMemo(() => clients.filter(c => c.balance > 0), [clients]);
  const totalBalance = clients.reduce((s, c) => s + c.balance, 0);
  const totalCreditLimit = clients.filter(c => c.clientType !== 'CF').reduce((s, c) => s + c.creditLimit, 0);

  const handleSaveNew = (form) => {
    const newClient = {
      id: Math.max(...clients.map(c => c.id)) + 1,
      ...form,
      creditLimit: parseFloat(form.creditLimit) || 0,
      paymentTerms: parseInt(form.paymentTerms) || 0,
      balance: 0,
      status: 'active',
      createdAt: new Date().toISOString().slice(0, 10),
    };
    setClients(prev => [...prev, newClient]);
    setShowNew(false);
    pushToast?.('Cliente creado correctamente', 'success');
  };

  const handleSaveEdit = (form) => {
    setClients(prev => prev.map(c => c.id === selected.id ? { ...c, ...form, creditLimit: parseFloat(form.creditLimit) || 0, paymentTerms: parseInt(form.paymentTerms) || 0 } : c));
    setSelected(prev => ({ ...prev, ...form, creditLimit: parseFloat(form.creditLimit) || 0, paymentTerms: parseInt(form.paymentTerms) || 0 }));
    setEditing(false);
    pushToast?.('Cliente actualizado', 'success');
  };

  const handlePayment = (form) => {
    const amount = parseFloat(form.amount);
    setClients(prev => prev.map(c => c.id === selected.id ? { ...c, balance: Math.max(0, c.balance - amount) } : c));
    setSelected(prev => ({ ...prev, balance: Math.max(0, prev.balance - amount) }));
    setShowPayment(false);
    pushToast?.(`Pago de ${fmt(amount)} registrado`, 'success');
  };

  const selectedClient = selected ? clients.find(c => c.id === selected.id) || selected : null;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('clients.title', 'Clientes')}</h1>
          <div className="page-subtitle">{t('clients.subtitle', '{{count}} clientes registrados · CxC total', { count: clients.length })} <span className="mono">{fmt(totalBalance)}</span></div>
        </div>
        <div className="page-head-actions">
          <button className="btn accent" onClick={() => setShowNew(true)}>
            <Icon name="plus" size={12} />{t('clients.newClient', 'Nuevo cliente')}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <div className="stat">
          <div className="label"><Icon name="users" size={11} />{t('clients.kpis.total', 'Total clientes')}</div>
          <div className="val mono">{clients.length}</div>
          <div className="delta muted">{clients.filter(c => c.status === 'active').length} {t('common.active', 'activos').toLowerCase()}</div>
        </div>
        <div className="stat">
          <div className="label"><Icon name="card" size={11} />{t('clients.kpis.balance', 'Saldo CxC total')}</div>
          <div className="val mono" style={{ color: totalBalance > 0 ? 'var(--danger)' : undefined }}>{fmt(totalBalance)}</div>
          <div className="delta muted">{cxcClients.length} clientes con saldo</div>
        </div>
        <div className="stat">
          <div className="label"><Icon name="chart" size={11} />Crédito otorgado</div>
          <div className="val mono">{fmt(totalCreditLimit)}</div>
          <div className="delta muted">Entre {clients.filter(c => c.creditLimit > 0).length} clientes</div>
        </div>
        <div className="stat">
          <div className="label"><Icon name="alert" size={11} />Clientes bloqueados</div>
          <div className="val mono" style={{ color: clients.filter(c => c.status === 'blocked').length > 0 ? 'var(--danger)' : undefined }}>
            {clients.filter(c => c.status === 'blocked').length}
          </div>
          <div className="delta muted">{clients.filter(c => c.status === 'inactive').length} {t('common.inactive', 'inactivos').toLowerCase()}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <div className={`tab ${tab === 'lista' ? 'active' : ''}`} onClick={() => setTab('lista')}>
          Lista de clientes <span className="count">{clients.length}</span>
        </div>
        <div className={`tab ${tab === 'cxc' ? 'active' : ''}`} onClick={() => setTab('cxc')}>
          Cuentas por cobrar <span className="count">{cxcClients.length}</span>
        </div>
      </div>

      {tab === 'lista' && (
        <>
          {/* Filtros */}
          <div className="toolbar">
            <div className="search-wrap" style={{ flex: 1, maxWidth: 320 }}>
              <Icon name="search" className="icon" size={13} />
              <input
                className="search-input"
                placeholder={t('clients.searchPlaceholder', 'Buscar por nombre o NIT…')}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select className="field-input" style={{ width: 'auto' }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="all">Todos los tipos</option>
              <option value="CF">CF</option>
              <option value="minorista">Minorista</option>
              <option value="mayorista">Mayorista</option>
              <option value="exento">Exento</option>
            </select>
            <select className="field-input" style={{ width: 'auto' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">Todos los estados</option>
              <option value="active">{t('common.active', 'Activos')}</option>
              <option value="inactive">{t('common.inactive', 'Inactivos')}</option>
              <option value="blocked">Bloqueados</option>
            </select>
            <span className="muted" style={{ fontSize: 12 }}>{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('common.client', 'Cliente')}</th>
                  <th>NIT</th>
                  <th>{t('common.type', 'Tipo')}</th>
                  <th>Contacto</th>
                  <th className="right">Límite crédito</th>
                  <th className="right">{t('clients.drawer.labels.pendingBalance', 'Saldo pendiente')}</th>
                  <th>{t('common.status', 'Estado')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="empty">{t('common.noResults', 'Sin resultados')}</td></tr>
                ) : filtered.map(c => (
                  <tr key={c.id} className="clickable" onClick={() => { setSelected(c); setEditing(false); }}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="avatar" style={{ width: 28, height: 28, fontSize: 11, flexShrink: 0 }}>{initials(c.name)}</div>
                        <span style={{ fontWeight: 500 }}>{c.name}</span>
                      </div>
                    </td>
                    <td className="mono muted">{c.nit}</td>
                    <td><span className="pill neutral" style={{ fontSize: 10 }}>{TYPE_LABEL[c.clientType]}</span></td>
                    <td className="muted" style={{ fontSize: 12 }}>{c.phone || c.email || '—'}</td>
                    <td className="right mono muted">{c.creditLimit > 0 ? fmt(c.creditLimit) : '—'}</td>
                    <td className="right mono" style={{ color: c.balance > 0 ? 'var(--danger)' : 'var(--muted)', fontWeight: c.balance > 0 ? 600 : 400 }}>
                      {fmt(c.balance)}
                    </td>
                    <td><span className={`pill ${STATUS_CLASS[c.status]}`} style={{ fontSize: 10 }}>{STATUS_LABEL[c.status]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'cxc' && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('common.client', 'Cliente')}</th>
                <th>{t('common.type', 'Tipo')}</th>
                <th className="right">Límite crédito</th>
                <th className="right">{t('clients.drawer.labels.pendingBalance', 'Saldo pendiente')}</th>
                <th className="right">% utilizado</th>
                <th>Plazo</th>
                <th>{t('common.actions', 'Acciones')}</th>
              </tr>
            </thead>
            <tbody>
              {cxcClients.length === 0 ? (
                <tr><td colSpan={7} className="empty">No hay cuentas por cobrar pendientes</td></tr>
              ) : cxcClients.map(c => {
                const pct = c.creditLimit > 0 ? (c.balance / c.creditLimit * 100) : 0;
                return (
                  <tr key={c.id} className="clickable" onClick={() => { setSelected(c); setEditing(false); }}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="avatar" style={{ width: 28, height: 28, fontSize: 11, flexShrink: 0 }}>{initials(c.name)}</div>
                        <span style={{ fontWeight: 500 }}>{c.name}</span>
                      </div>
                    </td>
                    <td><span className="pill neutral" style={{ fontSize: 10 }}>{TYPE_LABEL[c.clientType]}</span></td>
                    <td className="right mono muted">{c.creditLimit > 0 ? fmt(c.creditLimit) : '—'}</td>
                    <td className="right mono" style={{ color: 'var(--danger)', fontWeight: 600 }}>{fmt(c.balance)}</td>
                    <td className="right">
                      <span className={`pill ${pct > 90 ? 'danger' : pct > 70 ? 'warning' : 'success'}`} style={{ fontSize: 10 }}>
                        {pct.toFixed(0)}%
                      </span>
                    </td>
                    <td className="muted">{c.paymentTerms > 0 ? `${c.paymentTerms} días` : 'Contado'}</td>
                    <td>
                      <button className="btn" style={{ fontSize: 11, padding: '3px 10px' }}
                        onClick={e => { e.stopPropagation(); setSelected(c); setShowPayment(true); }}>
                        <Icon name="cash" size={11} />{t('clients.payment.title', 'Pago')}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Panel lateral — detalle o edición */}
      {selectedClient && !editing && (
        <div className="drawer-overlay">
          <ClientDetail
            client={selectedClient}
            payments={CLIENT_PAYMENTS}
            onClose={() => setSelected(null)}
            onEdit={() => setEditing(true)}
            onPayment={() => setShowPayment(true)}
          />
        </div>
      )}

      {selectedClient && editing && (
        <div className="drawer-overlay">
          <div className="drawer">
            <div className="drawer-head">
              <div className="drawer-title">{t('inventory.editProduct', 'Editar cliente')}</div>
              <button className="icon-btn" onClick={() => setEditing(false)}><Icon name="x" /></button>
            </div>
            <ClientForm
              initial={{ ...selectedClient, creditLimit: String(selectedClient.creditLimit), paymentTerms: String(selectedClient.paymentTerms) }}
              onSave={handleSaveEdit}
              onCancel={() => setEditing(false)}
            />
          </div>
        </div>
      )}

      {/* Modal nuevo cliente */}
      {showNew && (
        <div className="modal-backdrop" onClick={() => setShowNew(false)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">{t('clients.newClient', 'Nuevo cliente')}</div>
              <button className="icon-btn" onClick={() => setShowNew(false)}><Icon name="x" /></button>
            </div>
            <ClientForm onSave={handleSaveNew} onCancel={() => setShowNew(false)} />
          </div>
        </div>
      )}

      {/* Modal pago */}
      {showPayment && selectedClient && (
        <PaymentModal
          client={selectedClient}
          onSave={handlePayment}
          onClose={() => setShowPayment(false)}
        />
      )}
    </div>
  );
}
