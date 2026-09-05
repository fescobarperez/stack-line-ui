// Stackline — Cotizaciones a clientes + RFQ a proveedores
import React, { useState, useMemo } from 'react';
import StatCard from '../components/StatCard.jsx';
import { useTranslation } from 'react-i18next';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import { useClientQuotes, useSupplierRfqs, mapQuote, mapRfq } from '../hooks/useQuotes.js';
import { getQuote, createQuote as apiCreateQuote, updateQuoteStatus } from '../api/wave2.js';

const Q       = v  => `Q ${Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = d  => new Date(d + 'T00:00').toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' });
const today   = '2026-05-24';

// — Cotizaciones a clientes —
const STATUS_LABEL = { borrador: 'Borrador', enviada: 'Enviada', aprobada: 'Aprobada', rechazada: 'Rechazada', vencida: 'Vencida', convertida: 'Convertida' };
const STATUS_CLASS  = { borrador: 'neutral', enviada: 'info',    aprobada: 'success',  rechazada: 'danger',    vencida: 'warning',  convertida: 'success'    };

// — RFQ a proveedores —
const RFQ_LABEL = { solicitada: 'Solicitada', recibida: 'Recibida', aprobada: 'Aprobada', rechazada: 'Rechazada', convertida: 'Conv. a OC' };
const RFQ_CLASS  = { solicitada: 'info',       recibida: 'warning',  aprobada: 'success',  rechazada: 'danger',    convertida: 'success'    };

function computeTotals(items) {
  const lines    = items.map(i => ({ ...i, lineTotal: i.qty * (i.unitPrice || 0) * (1 - (i.discount || 0) / 100) }));
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const iva      = subtotal * 0.12;
  return { lines, subtotal, iva, total: subtotal + iva };
}

// ── Mock: cotizaciones a clientes ─────────────────────────────────────────────

let _nextId = 13;
const newId = () => `COT-2026-${String(_nextId++).padStart(5, '0')}`;

const INIT_QUOTES = [
  {
    id: 'COT-2026-00012', date: '2026-05-23', validUntil: '2026-06-06',
    client: { name: 'Supermercado El Ahorro', nit: '1234567-8', email: 'compras@elahorro.gt', contact: 'Jorge Fuentes' },
    createdBy: 'Carlos Méndez', status: 'aprobada',
    notes: 'Cliente solicita entrega en bodega Zona 4. Coordinar con logística.',
    items: [
      { id: 1, name: 'Coca-Cola 600ml',   qty: 50, uom: 'CAJ', unitPrice: 180.00, discount: 5 },
      { id: 2, name: 'Leche Foremost 1L', qty: 20, uom: 'CAJ', unitPrice: 158.00, discount: 0 },
      { id: 3, name: 'Agua Pura 600ml',   qty: 30, uom: 'CAJ', unitPrice: 78.00,  discount: 0 },
    ],
    history: [
      { ts: '2026-05-23 09:14', user: 'Carlos Méndez', action: 'Cotización creada' },
      { ts: '2026-05-23 10:30', user: 'Carlos Méndez', action: 'Enviada al cliente por correo electrónico' },
      { ts: '2026-05-23 15:22', user: 'Jorge Fuentes',  action: 'Aprobada por el cliente' },
    ],
  },
  {
    id: 'COT-2026-00011', date: '2026-05-22', validUntil: '2026-06-05',
    client: { name: 'Distribuidora Fuentes', nit: '9876543-2', email: 'pedidos@fuentes.gt', contact: 'Marta Fuentes' },
    createdBy: 'Ana López', status: 'enviada',
    notes: 'Precio especial por volumen. Descuento por pronto pago 8%.',
    items: [
      { id: 1, name: 'Cerveza Gallo 350ml', qty: 40, uom: 'CAJ', unitPrice: 215.00, discount: 8 },
      { id: 2, name: 'Coca-Cola 600ml',     qty: 20, uom: 'CAJ', unitPrice: 180.00, discount: 5 },
      { id: 3, name: 'Arroz Blanco 1kg',    qty: 5,  uom: 'PAQ', unitPrice: 285.00, discount: 0 },
    ],
    history: [
      { ts: '2026-05-22 11:00', user: 'Ana López', action: 'Cotización creada' },
      { ts: '2026-05-22 14:45', user: 'Ana López', action: 'Enviada al cliente por WhatsApp Business' },
    ],
  },
  {
    id: 'COT-2026-00010', date: '2026-05-21', validUntil: '2026-06-04',
    client: { name: 'Mini Super La Estrella', nit: '5678901-4', email: 'compras@estrella.gt', contact: 'Roberto Paz' },
    createdBy: 'Carlos Méndez', status: 'borrador',
    notes: 'Pendiente de confirmar precios con gerencia.',
    items: [
      { id: 1, name: 'Detergente Ariel 1kg',       qty: 24, uom: 'UN',  unitPrice: 38.50, discount: 0 },
      { id: 2, name: 'Cloro Magia Blanca 1L',       qty: 24, uom: 'UN',  unitPrice: 12.50, discount: 0 },
      { id: 3, name: 'Papel Higiénico Petalo 4pz',  qty: 24, uom: 'PAQ', unitPrice: 18.50, discount: 0 },
    ],
    history: [
      { ts: '2026-05-21 16:20', user: 'Carlos Méndez', action: 'Cotización creada (borrador)' },
    ],
  },
  {
    id: 'COT-2026-00009', date: '2026-05-20', validUntil: '2026-06-03',
    client: { name: 'Tienda La Esperanza', nit: '3456789-0', email: 'tienda@esperanza.gt', contact: 'Carmen López' },
    createdBy: 'José Ramírez', status: 'rechazada',
    notes: 'Cliente indicó que el precio está fuera de su presupuesto.',
    items: [
      { id: 1, name: 'Pan de Manteca',        qty: 50,  uom: 'DOC', unitPrice: 26.00, discount: 0 },
      { id: 2, name: 'Galletas María Gamesa',  qty: 100, uom: 'UN',  unitPrice: 5.00,  discount: 0 },
      { id: 3, name: 'Chocolate Milky Way',    qty: 50,  uom: 'UN',  unitPrice: 7.50,  discount: 0 },
    ],
    history: [
      { ts: '2026-05-20 10:05', user: 'José Ramírez', action: 'Cotización creada' },
      { ts: '2026-05-20 11:30', user: 'José Ramírez', action: 'Enviada al cliente' },
      { ts: '2026-05-21 09:00', user: 'Carmen López', action: 'Rechazada — precio fuera de presupuesto' },
    ],
  },
  {
    id: 'COT-2026-00008', date: '2026-05-18', validUntil: '2026-06-01',
    client: { name: 'Hotel Las Américas', nit: '2345678-1', email: 'alimentos@lasamericas.gt', contact: 'Patricia Vásquez' },
    createdBy: 'Ana López', status: 'convertida',
    notes: 'Pedido mensual recurrente. Convertido a factura FEL.',
    items: [
      { id: 1, name: 'Café Soluble Frasco 200g', qty: 24, uom: 'UN',  unitPrice: 42.00,  discount: 10 },
      { id: 2, name: 'Azúcar Estándar 2kg',       qty: 20, uom: 'PAQ', unitPrice: 175.00, discount: 5  },
      { id: 3, name: 'Leche Foremost 1L',          qty: 10, uom: 'CAJ', unitPrice: 158.00, discount: 5  },
      { id: 4, name: 'Pan de Manteca',             qty: 30, uom: 'DOC', unitPrice: 26.00,  discount: 0  },
    ],
    history: [
      { ts: '2026-05-18 08:30', user: 'Ana López',        action: 'Cotización creada' },
      { ts: '2026-05-18 09:15', user: 'Ana López',        action: 'Enviada al cliente' },
      { ts: '2026-05-19 10:00', user: 'Patricia Vásquez', action: 'Aprobada' },
      { ts: '2026-05-19 10:45', user: 'Ana López',        action: 'Convertida a venta — Factura FEL T-2026-04820' },
    ],
  },
  {
    id: 'COT-2026-00007', date: '2026-05-10', validUntil: '2026-05-24',
    client: { name: 'Restaurante El Buen Sabor', nit: '8765432-1', email: 'cocina@buensabor.gt', contact: 'Luis Morales' },
    createdBy: 'Carlos Méndez', status: 'vencida',
    notes: 'Sin respuesta del cliente. Cotización vencida.',
    items: [
      { id: 1, name: 'Aceite Vegetal 900ml', qty: 12, uom: 'CAJ', unitPrice: 220.00, discount: 0 },
      { id: 2, name: 'Sal Refinada 1kg',     qty: 50, uom: 'UN',  unitPrice: 6.50,   discount: 0 },
    ],
    history: [
      { ts: '2026-05-10 14:00', user: 'Carlos Méndez', action: 'Cotización creada' },
      { ts: '2026-05-10 15:30', user: 'Carlos Méndez', action: 'Enviada al cliente' },
      { ts: '2026-05-24 00:00', user: 'Sistema',        action: 'Cotización vencida sin respuesta' },
    ],
  },
];

// ── Mock: RFQ a proveedores ───────────────────────────────────────────────────

let _nextRfqId = 7;
const newRfqId = () => `RFQ-2026-${String(_nextRfqId++).padStart(5, '0')}`;

const INIT_RFQ = [
  {
    id: 'RFQ-2026-00006', date: '2026-05-23', deadline: '2026-05-28',
    supplier: { name: 'Distribuidora El Mayoreo', nit: '7891234-5', email: 'ventas@elmayoreo.gt', contact: 'Fernando Díaz' },
    createdBy: 'Carlos Méndez', status: 'recibida',
    leadTime: '3-5 días', paymentTerms: '30 días crédito',
    notes: 'Comparar con cotización de Proveedor Central antes de aprobar.',
    items: [
      { id: 1, name: 'Coca-Cola 600ml',   qty: 100, uom: 'CAJ', unitPrice: 168.00, discount: 0 },
      { id: 2, name: 'Leche Foremost 1L', qty: 50,  uom: 'CAJ', unitPrice: 145.00, discount: 0 },
      { id: 3, name: 'Agua Pura 600ml',   qty: 80,  uom: 'CAJ', unitPrice: 68.00,  discount: 0 },
    ],
    history: [
      { ts: '2026-05-23 08:30', user: 'Carlos Méndez', action: 'Solicitud de cotización creada' },
      { ts: '2026-05-23 11:00', user: 'Carlos Méndez', action: 'RFQ enviada a proveedor por correo' },
      { ts: '2026-05-24 09:15', user: 'Fernando Díaz', action: 'Cotización recibida del proveedor' },
    ],
  },
  {
    id: 'RFQ-2026-00005', date: '2026-05-22', deadline: '2026-05-27',
    supplier: { name: 'Proveedor Central S.A.', nit: '3456789-1', email: 'cotizaciones@procentral.gt', contact: 'María Estrada' },
    createdBy: 'Ana López', status: 'aprobada',
    leadTime: '2-3 días', paymentTerms: '15 días crédito',
    notes: 'Mejor precio del mercado. Aprobado para proceder con OC.',
    items: [
      { id: 1, name: 'Coca-Cola 600ml',   qty: 100, uom: 'CAJ', unitPrice: 165.00, discount: 2 },
      { id: 2, name: 'Leche Foremost 1L', qty: 50,  uom: 'CAJ', unitPrice: 142.00, discount: 0 },
      { id: 3, name: 'Agua Pura 600ml',   qty: 80,  uom: 'CAJ', unitPrice: 65.00,  discount: 0 },
    ],
    history: [
      { ts: '2026-05-22 09:00', user: 'Ana López',     action: 'Solicitud de cotización creada' },
      { ts: '2026-05-22 10:30', user: 'Ana López',     action: 'RFQ enviada a proveedor' },
      { ts: '2026-05-23 08:00', user: 'María Estrada', action: 'Cotización recibida del proveedor' },
      { ts: '2026-05-24 10:00', user: 'Ana López',     action: 'Cotización aprobada — precio más competitivo' },
    ],
  },
  {
    id: 'RFQ-2026-00004', date: '2026-05-20', deadline: '2026-05-25',
    supplier: { name: 'Importadora del Norte', nit: '5678901-3', email: 'ventas@imnorte.gt', contact: 'José García' },
    createdBy: 'Carlos Méndez', status: 'convertida',
    leadTime: '5-7 días', paymentTerms: '30 días crédito',
    notes: 'OC generada para reponer stock crítico de limpieza.',
    items: [
      { id: 1, name: 'Detergente Ariel 1kg',       qty: 48, uom: 'UN',  unitPrice: 32.50, discount: 0 },
      { id: 2, name: 'Cloro Magia Blanca 1L',       qty: 48, uom: 'UN',  unitPrice: 10.00, discount: 0 },
      { id: 3, name: 'Papel Higiénico Petalo 4pz',  qty: 48, uom: 'PAQ', unitPrice: 15.50, discount: 5 },
    ],
    history: [
      { ts: '2026-05-20 13:00', user: 'Carlos Méndez', action: 'Solicitud de cotización creada' },
      { ts: '2026-05-20 14:00', user: 'Carlos Méndez', action: 'RFQ enviada a proveedor' },
      { ts: '2026-05-21 11:30', user: 'José García',   action: 'Cotización recibida del proveedor' },
      { ts: '2026-05-22 09:00', user: 'Carlos Méndez', action: 'Cotización aprobada' },
      { ts: '2026-05-22 09:30', user: 'Carlos Méndez', action: 'Convertida a OC — OC-2026-00089' },
    ],
  },
  {
    id: 'RFQ-2026-00003', date: '2026-05-18', deadline: '2026-05-23',
    supplier: { name: 'Agro Distribuciones', nit: '9012345-6', email: 'pedidos@agrodist.gt', contact: 'Laura Pérez' },
    createdBy: 'Ana López', status: 'rechazada',
    leadTime: '7-10 días', paymentTerms: '45 días crédito',
    notes: 'Precio elevado, tiempo de entrega fuera de lo requerido. Buscar proveedor alternativo.',
    items: [
      { id: 1, name: 'Arroz Blanco 1kg', qty: 200, uom: 'PAQ', unitPrice: 8.50,  discount: 0 },
      { id: 2, name: 'Frijol Negro 1kg', qty: 100, uom: 'PAQ', unitPrice: 12.00, discount: 0 },
    ],
    history: [
      { ts: '2026-05-18 10:00', user: 'Ana López',   action: 'Solicitud de cotización creada' },
      { ts: '2026-05-18 11:00', user: 'Ana López',   action: 'RFQ enviada a proveedor' },
      { ts: '2026-05-20 16:00', user: 'Laura Pérez', action: 'Cotización recibida del proveedor' },
      { ts: '2026-05-21 09:00', user: 'Ana López',   action: 'Rechazada — precio y plazo no competitivos' },
    ],
  },
  {
    id: 'RFQ-2026-00002', date: '2026-05-16', deadline: '2026-05-21',
    supplier: { name: 'Bebidas del Pacífico', nit: '6789012-4', email: 'cuentas@bebidaspacifico.gt', contact: 'Roberto Castillo' },
    createdBy: 'José Ramírez', status: 'solicitada',
    leadTime: 'Por confirmar', paymentTerms: 'Por confirmar',
    notes: 'Seguimiento pendiente. Sin respuesta del proveedor — hacer llamada de seguimiento.',
    items: [
      { id: 1, name: 'Cerveza Gallo 350ml', qty: 50,  uom: 'CAJ', unitPrice: 0, discount: 0 },
      { id: 2, name: 'Agua Pura 600ml',      qty: 100, uom: 'CAJ', unitPrice: 0, discount: 0 },
    ],
    history: [
      { ts: '2026-05-16 14:00', user: 'José Ramírez', action: 'Solicitud de cotización creada' },
      { ts: '2026-05-16 15:00', user: 'José Ramírez', action: 'RFQ enviada a proveedor por correo' },
    ],
  },
  {
    id: 'RFQ-2026-00001', date: '2026-05-14', deadline: '2026-05-24',
    supplier: { name: 'Distribuidora Centroamérica', nit: '1234509-7', email: 'ventas@distca.gt', contact: 'Sandra Morales' },
    createdBy: 'Carlos Méndez', status: 'recibida',
    leadTime: '4-6 días', paymentTerms: '30 días crédito',
    notes: 'Cotización para reposición de dulcería.',
    items: [
      { id: 1, name: 'Chocolate Milky Way 40g',  qty: 200, uom: 'UN', unitPrice: 6.20,  discount: 0 },
      { id: 2, name: 'Galletas Oreo 36g',         qty: 200, uom: 'UN', unitPrice: 4.50,  discount: 5 },
      { id: 3, name: 'Caramelos Halls Menta',     qty: 100, uom: 'UN', unitPrice: 3.00,  discount: 0 },
    ],
    history: [
      { ts: '2026-05-14 10:00', user: 'Carlos Méndez',  action: 'Solicitud de cotización creada' },
      { ts: '2026-05-14 11:30', user: 'Carlos Méndez',  action: 'RFQ enviada a proveedor' },
      { ts: '2026-05-16 09:00', user: 'Sandra Morales', action: 'Cotización recibida del proveedor' },
    ],
  },
];

// ── Modal: nueva cotización a cliente ─────────────────────────────────────────

const EMPTY_ITEM = () => ({ id: Date.now(), name: '', qty: 1, uom: 'UN', unitPrice: 0, discount: 0 });

function CreateModal({ onSave, onClose }) {
  const { t } = useTranslation();
  const [client,    setClient]    = useState({ name: '', nit: '', email: '', contact: '' });
  const [validDays, setValidDays] = useState(15);
  const [notes,     setNotes]     = useState('');
  const [items,     setItems]     = useState([EMPTY_ITEM()]);
  const setC = (k, v) => setClient(c => ({ ...c, [k]: v }));

  const setItem    = (id, k, v) => setItems(prev => prev.map(i => i.id === id ? { ...i, [k]: v } : i));
  const addItem    = () => setItems(prev => [...prev, EMPTY_ITEM()]);
  const removeItem = id => setItems(prev => prev.filter(i => i.id !== id));

  const { lines, subtotal, iva, total } = computeTotals(items);
  const validDate = new Date(today);
  validDate.setDate(validDate.getDate() + validDays);
  const validUntil = validDate.toISOString().slice(0, 10);

  const canSave = client.name.trim() && items.every(i => i.name.trim() && i.qty > 0 && i.unitPrice > 0);

  const handleSave = () => {
    onSave({
      id: newId(), date: today, validUntil, client, createdBy: 'Carlos Méndez',
      status: 'borrador', notes,
      items: items.map((i, idx) => ({ ...i, id: idx + 1 })),
      history: [{ ts: `${today} ${new Date().toTimeString().slice(0, 5)}`, user: 'Carlos Méndez', action: 'Cotización creada' }],
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 680, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{t('quotes.newQuote', 'Nueva Cotización')}</h3>
          <button className="icon-btn" onClick={onClose}><Icon name="close" /></button>
        </div>

        <div className="modal-body" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 10 }}>{t('common.client', 'CLIENTE').toUpperCase()}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="field-group">
                <label className="field-label">{t('quotes.clientName', 'Nombre / Empresa *')}</label>
                <input className="field-input" value={client.name} onChange={e => setC('name', e.target.value)} placeholder={t('quotes.clientNamePlaceholder', 'Empresa o persona')} />
              </div>
              <div className="field-group">
                <label className="field-label">NIT</label>
                <input className="field-input" value={client.nit} onChange={e => setC('nit', e.target.value)} placeholder="0000000-0" />
              </div>
              <div className="field-group">
                <label className="field-label">{t('common.email', 'Correo electrónico')}</label>
                <input className="field-input" type="email" value={client.email} onChange={e => setC('email', e.target.value)} placeholder="correo@empresa.gt" />
              </div>
              <div className="field-group">
                <label className="field-label">{t('quotes.contact', 'Contacto')}</label>
                <input className="field-input" value={client.contact} onChange={e => setC('contact', e.target.value)} placeholder={t('quotes.contactPlaceholder', 'Nombre del contacto')} />
              </div>
            </div>
          </div>

          <div className="field-group" style={{ maxWidth: 220 }}>
            <label className="field-label">{t('quotes.validityDays', 'Validez (días)')}</label>
            <input className="field-input" type="number" min="1" max="90" value={validDays}
              onChange={e => setValidDays(Number(e.target.value))} />
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{t('quotes.expires', 'Vence')}: {fmtDate(validUntil)}</div>
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 10 }}>{t('quotes.productsServices', 'PRODUCTOS / SERVICIOS')}</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {[t('common.description', 'Descripción'), t('quotes.qty', 'Cant.'), 'UOM', t('quotes.unitPrice', 'P. unitario'), t('common.discount', 'Desc %'), t('common.total', 'Total'), ''].map((h, i) => (
                    <th key={i} style={{ padding: '4px 6px', textAlign: i>= 3 && i <= 4 ? 'center' : i === 5 ? 'right' : 'left', fontWeight: 500, color: 'var(--text-2)',
                      width: [undefined, 60, 60, 100, 60, 100, 28][i] }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '4px 6px' }}>
                      <input className="field-input" style={{ padding: '3px 6px' }} value={item.name}
                        onChange={e => setItem(item.id, 'name', e.target.value)} placeholder={t('quotes.productOrService', 'Producto o servicio')} />
                    </td>
                    <td style={{ padding: '4px 6px' }}>
                      <input className="field-input" type="number" min="1" style={{ padding: '3px 6px', textAlign: 'center', width: '100%' }}
                        value={item.qty} onChange={e => setItem(item.id, 'qty', Number(e.target.value))} />
                    </td>
                    <td style={{ padding: '4px 6px' }}>
                      <input className="field-input" style={{ padding: '3px 6px', textAlign: 'center', width: '100%' }}
                        value={item.uom} onChange={e => setItem(item.id, 'uom', e.target.value)} />
                    </td>
                    <td style={{ padding: '4px 6px' }}>
                      <input className="field-input" type="number" min="0" step="0.01" style={{ padding: '3px 6px', textAlign: 'right', width: '100%' }}
                        value={item.unitPrice} onChange={e => setItem(item.id, 'unitPrice', Number(e.target.value))} />
                    </td>
                    <td style={{ padding: '4px 6px' }}>
                      <input className="field-input" type="number" min="0" max="100" style={{ padding: '3px 6px', textAlign: 'center', width: '100%' }}
                        value={item.discount} onChange={e => setItem(item.id, 'discount', Number(e.target.value))} />
                    </td>
                    <td className="num" style={{ padding: '4px 6px' }}>
                      {Q(item.qty * item.unitPrice * (1 - item.discount / 100))}
                    </td>
                    <td style={{ padding: '4px 2px' }}>
                      <button className="icon-btn" onClick={() => removeItem(item.id)} disabled={items.length === 1}>
                        <Icon name="close" size={11} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Button icon="plus" variant="ghost" style={{ marginTop: 8 }} onClick={addItem}>{t('quotes.addLine', 'Agregar línea')}
            </Button>
          </div>

          <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-md)', padding: '12px 16px', alignSelf: 'flex-end', minWidth: 260 }}>
            {[[t('quotes.subtotalNoIva', 'Subtotal (sin IVA)'), Q(subtotal)], [t('common.iva', 'IVA') + ' (12%)', Q(iva)]].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6, color: 'var(--text-2)' }}>
                <span>{l}</span><span className="mono">{v}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 500, fontSize: 14, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
              <span>{t('common.total', 'TOTAL').toUpperCase()}</span><span className="mono">{Q(total)}</span>
            </div>
          </div>

          <div className="field-group">
            <label className="field-label">{t('quotes.notesConditions', 'Notas / condiciones')}</label>
            <textarea className="field-input" rows={2} style={{ resize: 'none' }} value={notes}
              onChange={e => setNotes(e.target.value)} placeholder={t('quotes.notesPlaceholder', 'Condiciones de pago, entrega, observaciones…')} />
          </div>
        </div>

        <div className="modal-foot">
          <Button variant="ghost" onClick={onClose}>{t('common.cancel', 'Cancelar')}</Button>
          <Button icon="check" variant="accent" disabled={!canSave} onClick={handleSave}>{t('quotes.createQuote', 'Crear cotización')}</Button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: nueva solicitud de cotización a proveedor (RFQ) ────────────────────

const EMPTY_RITEM = () => ({ id: Date.now(), name: '', qty: 1, uom: 'UN' });

function CreateRFQModal({ onSave, onClose }) {
  const { t } = useTranslation();
  const [supplier, setSupplier] = useState({ name: '', nit: '', email: '', contact: '' });
  const [deadline, setDeadline] = useState('');
  const [notes,    setNotes]    = useState('');
  const [items,    setItems]    = useState([EMPTY_RITEM()]);
  const setS = (k, v) => setSupplier(s => ({ ...s, [k]: v }));

  const setItem    = (id, k, v) => setItems(prev => prev.map(i => i.id === id ? { ...i, [k]: v } : i));
  const addItem    = () => setItems(prev => [...prev, EMPTY_RITEM()]);
  const removeItem = id => setItems(prev => prev.filter(i => i.id !== id));

  const canSave = supplier.name.trim() && items.every(i => i.name.trim() && i.qty > 0);

  const handleSave = () => {
    onSave({
      id: newRfqId(), date: today, deadline,
      supplier, createdBy: 'Carlos Méndez', status: 'solicitada',
      leadTime: 'Por confirmar', paymentTerms: 'Por confirmar',
      notes,
      items: items.map((i, idx) => ({ ...i, id: idx + 1, unitPrice: 0, discount: 0 })),
      history: [{ ts: `${today} ${new Date().toTimeString().slice(0, 5)}`, user: 'Carlos Méndez', action: 'Solicitud de cotización creada' }],
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 620, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{t('quotes.newRFQ', 'Nueva Solicitud de Cotización (RFQ)')}</h3>
          <button className="icon-btn" onClick={onClose}><Icon name="close" /></button>
        </div>

        <div className="modal-body" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 10 }}>{t('common.supplier', 'PROVEEDOR').toUpperCase()}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="field-group">
                <label className="field-label">{t('quotes.supplierName', 'Nombre / Empresa *')}</label>
                <input className="field-input" value={supplier.name} onChange={e => setS('name', e.target.value)} placeholder={t('quotes.supplierNamePlaceholder', 'Empresa proveedora')} />
              </div>
              <div className="field-group">
                <label className="field-label">NIT</label>
                <input className="field-input" value={supplier.nit} onChange={e => setS('nit', e.target.value)} placeholder="0000000-0" />
              </div>
              <div className="field-group">
                <label className="field-label">{t('common.email', 'Correo electrónico')}</label>
                <input className="field-input" type="email" value={supplier.email} onChange={e => setS('email', e.target.value)} placeholder="ventas@proveedor.gt" />
              </div>
              <div className="field-group">
                <label className="field-label">{t('quotes.contact', 'Contacto')}</label>
                <input className="field-input" value={supplier.contact} onChange={e => setS('contact', e.target.value)} placeholder={t('quotes.contactPlaceholder', 'Nombre del contacto')} />
              </div>
            </div>
          </div>

          <div className="field-group" style={{ maxWidth: 220 }}>
            <label className="field-label">{t('quotes.respondBefore', 'Responder antes de')}</label>
            <input className="field-input" type="date" value={deadline} min={today}
              onChange={e => setDeadline(e.target.value)} />
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 10 }}>{t('quotes.requestedProducts', 'PRODUCTOS SOLICITADOS')}</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '4px 6px', textAlign: 'left', fontWeight: 500, color: 'var(--text-2)' }}>{t('common.description', 'Descripción')}</th>
                  <th style={{ padding: '4px 6px', textAlign: 'center', width: 80, fontWeight: 500, color: 'var(--text-2)' }}>{t('common.quantity', 'Cantidad')}</th>
                  <th style={{ padding: '4px 6px', textAlign: 'center', width: 70, fontWeight: 500, color: 'var(--text-2)' }}>UOM</th>
                  <th style={{ width: 28 }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '4px 6px' }}>
                      <input className="field-input" style={{ padding: '3px 6px' }} value={item.name}
                        onChange={e => setItem(item.id, 'name', e.target.value)} placeholder={t('quotes.productOrInput', 'Producto o insumo')} />
                    </td>
                    <td style={{ padding: '4px 6px' }}>
                      <input className="field-input" type="number" min="1" style={{ padding: '3px 6px', textAlign: 'center', width: '100%' }}
                        value={item.qty} onChange={e => setItem(item.id, 'qty', Number(e.target.value))} />
                    </td>
                    <td style={{ padding: '4px 6px' }}>
                      <input className="field-input" style={{ padding: '3px 6px', textAlign: 'center', width: '100%' }}
                        value={item.uom} onChange={e => setItem(item.id, 'uom', e.target.value)} />
                    </td>
                    <td style={{ padding: '4px 2px' }}>
                      <button className="icon-btn" onClick={() => removeItem(item.id)} disabled={items.length === 1}>
                        <Icon name="close" size={11} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Button icon="plus" variant="ghost" style={{ marginTop: 8 }} onClick={addItem}>{t('quotes.addProduct', 'Agregar producto')}
            </Button>
          </div>

          <div className="field-group">
            <label className="field-label">{t('quotes.notesSpecs', 'Notas / especificaciones')}</label>
            <textarea className="field-input" rows={2} style={{ resize: 'none' }} value={notes}
              onChange={e => setNotes(e.target.value)} placeholder={t('quotes.notesSpecsPlaceholder', 'Especificaciones técnicas, condiciones deseadas, observaciones…')} />
          </div>
        </div>

        <div className="modal-foot">
          <Button variant="ghost" onClick={onClose}>{t('common.cancel', 'Cancelar')}</Button>
          <Button icon="check" variant="accent" disabled={!canSave} onClick={handleSave}>{t('quotes.createRequest', 'Crear solicitud')}</Button>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────

export default function Quotes({ pushToast }) {
  const { t } = useTranslation();
  const [quoteType, setQuoteType] = useState('cliente');

  // — cotizaciones a clientes —
  const { items: quotes, reload: reloadQuotes } = useClientQuotes();
  const [selected,     setSelected]     = useState(null);
  const [drawerTab,    setDrawerTab]    = useState('detail');
  const [showCreate,   setShowCreate]   = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [search,       setSearch]       = useState('');

  // — RFQ a proveedores —
  const { items: rfqs, reload: reloadRfqs } = useSupplierRfqs();
  const [selectedRfq,   setSelectedRfq]   = useState(null);
  const [rfqDrawerTab,  setRfqDrawerTab]  = useState('detail');
  const [showCreateRfq, setShowCreateRfq] = useState(false);
  const [rfqFilter,     setRfqFilter]     = useState('');
  const [rfqSearch,     setRfqSearch]     = useState('');

  const switchType = (type) => {
    setQuoteType(type);
    setSelected(null);
    setSelectedRfq(null);
    setStatusFilter('');
    setSearch('');
    setRfqFilter('');
    setRfqSearch('');
  };

  // — KPIs clientes —
  const pipeline    = quotes.filter(q => ['borrador', 'enviada', 'aprobada'].includes(q.status));
  const pipelineAmt = pipeline.reduce((s, q) => s + computeTotals(q.items).total, 0);
  const approvedAmt = quotes.filter(q => q.status === 'aprobada').reduce((s, q) => s + computeTotals(q.items).total, 0);

  const filtered = useMemo(() => quotes.filter(q => {
    if (statusFilter && q.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return q.id.toLowerCase().includes(s) || q.client.name.toLowerCase().includes(s);
    }
    return true;
  }), [quotes, statusFilter, search]);

  const updateStatus = async (id, newStatus, entry) => {
    const q = quotes.find(x => x.id === id);
    if (!q) return;
    try {
      const full = await updateQuoteStatus(q.backendId, { status: newStatus, note: entry, actor: '' });
      setSelected(mapQuote(full));
      reloadQuotes();
    } catch (err) { pushToast('No se pudo actualizar el estado: ' + err.message, 'error'); }
  };

  const submitQuote = async (draft) => {
    try {
      await apiCreateQuote({
        partyType: 'client',
        clientName: draft.client.name, clientNit: draft.client.nit,
        clientEmail: draft.client.email, clientContact: draft.client.contact,
        quoteDate: draft.date, validUntil: draft.validUntil,
        createdBy: draft.createdBy, notes: draft.notes,
        items: draft.items.map(i => ({ itemName: i.name, uom: i.uom, quantity: i.qty, unitPrice: i.unitPrice, discount: i.discount })),
      });
      setShowCreate(false);
      pushToast('Cotización creada como borrador', 'success');
      reloadQuotes();
    } catch (err) { pushToast('No se pudo crear la cotización: ' + err.message, 'error'); }
  };
  const openDrawer  = async (q) => {
    setSelected(q); setDrawerTab('detail');
    try { setSelected(mapQuote(await getQuote(q.backendId))); } catch { /* deja el de la lista */ }
  };
  const selQuote    = selected;

  // — KPIs proveedores —
  const rfqInProcess = rfqs.filter(r => ['solicitada', 'recibida'].includes(r.status));
  const rfqPending   = rfqs.filter(r => r.status === 'solicitada');
  const rfqApproved  = rfqs.filter(r => r.status === 'aprobada');

  const filteredRfqs = useMemo(() => rfqs.filter(r => {
    if (rfqFilter && r.status !== rfqFilter) return false;
    if (rfqSearch) {
      const s = rfqSearch.toLowerCase();
      return r.id.toLowerCase().includes(s) || r.supplier.name.toLowerCase().includes(s);
    }
    return true;
  }), [rfqs, rfqFilter, rfqSearch]);

  const updateRfqStatus = async (id, newStatus, entry) => {
    const r = rfqs.find(x => x.id === id);
    if (!r) return;
    try {
      const full = await updateQuoteStatus(r.backendId, { status: newStatus, note: entry, actor: '' });
      setSelectedRfq(mapRfq(full));
      reloadRfqs();
    } catch (err) { pushToast('No se pudo actualizar el estado: ' + err.message, 'error'); }
  };

  const submitRfq = async (draft) => {
    try {
      await apiCreateQuote({
        partyType: 'supplier',
        supplierName: draft.supplier.name, supplierNit: draft.supplier.nit,
        supplierEmail: draft.supplier.email, supplierContact: draft.supplier.contact,
        quoteDate: draft.date, deadline: draft.deadline || null,
        createdBy: draft.createdBy, notes: draft.notes,
        items: draft.items.map(i => ({ itemName: i.name, uom: i.uom, quantity: i.qty, unitPrice: i.unitPrice || 0, discount: i.discount || 0 })),
      });
      setShowCreateRfq(false);
      pushToast('Solicitud creada — esperando respuesta del proveedor', 'success');
      reloadRfqs();
    } catch (err) { pushToast('No se pudo crear la solicitud: ' + err.message, 'error'); }
  };
  const openRfqDrawer = async (r) => {
    setSelectedRfq(r); setRfqDrawerTab('detail');
    try { setSelectedRfq(mapRfq(await getQuote(r.backendId))); } catch { /* deja el de la lista */ }
  };
  const selRfq        = selectedRfq;

  return (
    <div className="page">
      {/* Cabecera con selector de tipo */}
      <div className="page-head">
        <div>
          <div className="page-title">{t('quotes.title', 'Cotizaciones')}</div>
          <div className="page-sub">
            {quoteType === 'cliente' ? t('quotes.subtitleClient', 'Pre-ventas y propuestas comerciales a clientes') : t('quotes.subtitleSupplier', 'Solicitudes de cotización a proveedores (RFQ)')}
          </div>
        </div>
        <div className="page-head-actions" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Selector de tipo */}
          <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 'var(--r-md)', padding: 3, gap: 2 }}>
            {[['cliente', t('quotes.toClients', 'A clientes')], ['proveedor', t('quotes.toSuppliers', 'A proveedores')]].map(([val, lbl]) => (
              <button key={val} onClick={() => switchType(val)}
                style={{ padding: '5px 14px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
                  borderRadius: 'calc(var(--r-md) - 2px)',
                  background: quoteType === val ? 'var(--md-sys-color-secondary-container)' : 'transparent',
                  color: quoteType === val ? 'var(--md-sys-color-on-secondary-container)' : 'var(--text-2)',
                  transition: 'background .15s, color .15s',
                }}>
                {lbl}
              </button>
            ))}
          </div>
          {quoteType === 'cliente' ? (
            <Button icon="plus" variant="accent" onClick={() => setShowCreate(true)}>{t('quotes.newQuote', 'Nueva cotización')}
            </Button>
          ) : (
            <Button icon="plus" variant="accent" onClick={() => setShowCreateRfq(true)}>{t('quotes.newRequest', 'Nueva solicitud')}
            </Button>
          )}
        </div>
      </div>

      {/* ── Vista: cotizaciones a clientes ─────────────────────────────────── */}
      {quoteType === 'cliente' && (
        <>
          <div className="stat-grid" style={{ marginBottom: 20 }}>
            <StatCard
              label={t('quotes.inPipeline', 'En pipeline')}
              value={pipeline.length}
              foot={<>{Q(pipelineAmt)} {t('quotes.inProcess', 'en proceso')}</>}
            />
            <StatCard
              label={t('common.approved', 'Aprobadas')}
              valueColor={'var(--success)'}
              value={quotes.filter(q => q.status === 'aprobada').length}
              foot={<>{Q(approvedAmt)} {t('quotes.readyToInvoice', 'listas para facturar')}</>}
            />
            <StatCard
              label={t('quotes.converted', 'Convertidas')}
              value={quotes.filter(q => q.status === 'convertida').length}
              foot={t('quotes.thisMonth', 'Este mes')}
            />
            <StatCard
              label={t('quotes.expiredRejected', 'Vencidas / Rechazadas')}
              valueColor={'var(--danger)'}
              value={quotes.filter(q => ['vencida', 'rechazada'].includes(q.status)).length}
              foot={t('quotes.requireFollowup', 'Requieren seguimiento')}
            />
          </div>

          <div className="filterbar" style={{ marginBottom: 12 }}>
            <div className="field-wrap search-wrap">
              <Icon name="search" className="field-icon" size={13} />
              <input className="field-input" placeholder={t('quotes.searchPlaceholder', 'Buscar cotización o cliente…')} value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="field-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">{t('quotes.allStatuses', 'Todos los estados')}</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          <div className="card">
            <div className="table-wrap" style={{ border: 'none', margin: 0, borderRadius: 0 }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>{t('quotes.quoteNo', 'Cotización')}</th>
                    <th>{t('common.client', 'Cliente')}</th>
                    <th>{t('common.date', 'Fecha')}</th>
                    <th>{t('quotes.validUntil', 'Válida hasta')}</th>
                    <th style={{ textAlign: 'center' }}>{t('quotes.items', 'Ítems')}</th>
                    <th style={{ textAlign: 'right' }}>{t('quotes.totalWithIva', 'Total (c/IVA)')}</th>
                    <th>{t('common.status', 'Estado')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(q => {
                    const { total }  = computeTotals(q.items);
                    const isExpired  = q.validUntil < today && !['convertida', 'rechazada', 'vencida'].includes(q.status);
                    return (
                      <tr key={q.id} onClick={() => openDrawer(q)} style={{ cursor: 'pointer' }}>
                        <td><span className="mono" style={{ fontWeight: 500, fontSize: 12 }}>{q.id}</span></td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{q.client.name}</div>
                          <div className="muted" style={{ fontSize: 11 }}>{q.client.contact}</div>
                        </td>
                        <td className="muted">{fmtDate(q.date)}</td>
                        <td style={{ color: isExpired ? 'var(--danger)' : 'var(--text-2)' }}>{fmtDate(q.validUntil)}</td>
                        <td style={{ textAlign: 'center' }}>{q.items.length}</td>
                        <td className="num" style={{ fontWeight: 500 }}>{Q(total)}</td>
                        <td><span className={`badge-m3 ${STATUS_CLASS[q.status]}`}>{STATUS_LABEL[q.status]}</span></td>
                        <td><Button variant="ghost" onClick={e => { e.stopPropagation(); openDrawer(q); }}>{t('common.view', 'Ver')}</Button></td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>{t('quotes.noQuotes', 'Sin cotizaciones')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Vista: RFQ a proveedores ────────────────────────────────────────── */}
      {quoteType === 'proveedor' && (
        <>
          <div className="stat-grid" style={{ marginBottom: 20 }}>
            <StatCard
              label={t('quotes.rfqInProcess', 'En proceso')}
              value={rfqInProcess.length}
              foot={t('quotes.rfqRequestedReceived', 'Solicitadas + recibidas')}
            />
            <StatCard
              label={t('quotes.rfqPendingResponse', 'Pendientes respuesta')}
              valueColor={'var(--warning)'}
              value={rfqPending.length}
              foot={t('quotes.rfqWaitingSupplier', 'Esperando al proveedor')}
            />
            <StatCard
              label={t('common.approved', 'Aprobadas')}
              valueColor={'var(--success)'}
              value={rfqApproved.length}
              foot={t('quotes.rfqReadyForPO', 'Listas para generar OC')}
            />
            <StatCard
              label={t('quotes.rfqConvertedToPO', 'Convertidas a OC')}
              value={rfqs.filter(r => r.status === 'convertida').length}
              foot={t('quotes.thisMonth', 'Este mes')}
            />
          </div>

          <div className="filterbar" style={{ marginBottom: 12 }}>
            <div className="field-wrap search-wrap">
              <Icon name="search" className="field-icon" size={13} />
              <input className="field-input" placeholder={t('quotes.rfqSearchPlaceholder', 'Buscar RFQ o proveedor…')} value={rfqSearch} onChange={e => setRfqSearch(e.target.value)} />
            </div>
            <select className="field-input" value={rfqFilter} onChange={e => setRfqFilter(e.target.value)}>
              <option value="">{t('quotes.allStatuses', 'Todos los estados')}</option>
              {Object.entries(RFQ_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          <div className="card">
            <div className="table-wrap" style={{ border: 'none', margin: 0, borderRadius: 0 }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>{t('quotes.rfqNo', 'Solicitud')}</th>
                    <th>{t('common.supplier', 'Proveedor')}</th>
                    <th>{t('common.date', 'Fecha')}</th>
                    <th>{t('quotes.respondBefore', 'Resp. antes')}</th>
                    <th>{t('quotes.leadTime', 'T. entrega')}</th>
                    <th>{t('quotes.paymentTerm', 'Plazo pago')}</th>
                    <th style={{ textAlign: 'right' }}>{t('quotes.totalWithIva', 'Total (c/IVA)')}</th>
                    <th>{t('common.status', 'Estado')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRfqs.map(r => {
                    const { total }   = computeTotals(r.items);
                    const hasPrices   = r.items.some(i => i.unitPrice > 0);
                    const isOverdue   = r.deadline && r.deadline < today && ['solicitada', 'recibida'].includes(r.status);
                    return (
                      <tr key={r.id} onClick={() => openRfqDrawer(r)} style={{ cursor: 'pointer' }}>
                        <td><span className="mono" style={{ fontWeight: 500, fontSize: 12 }}>{r.id}</span></td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{r.supplier.name}</div>
                          <div className="muted" style={{ fontSize: 11 }}>{r.supplier.contact}</div>
                        </td>
                        <td className="muted">{fmtDate(r.date)}</td>
                        <td style={{ color: isOverdue ? 'var(--danger)' : 'var(--text-2)' }}>
                          {r.deadline ? fmtDate(r.deadline) : '—'}
                        </td>
                        <td>{r.leadTime}</td>
                        <td>{r.paymentTerms}</td>
                        <td className="num" style={{ fontWeight: 500, color: hasPrices ? 'var(--text)' : 'var(--muted)' }}>
                          {hasPrices ? Q(total) : t('quotes.pending', 'Pendiente')}
                        </td>
                        <td><span className={`badge-m3 ${RFQ_CLASS[r.status]}`}>{RFQ_LABEL[r.status]}</span></td>
                        <td><Button variant="ghost" onClick={e => { e.stopPropagation(); openRfqDrawer(r); }}>{t('common.view', 'Ver')}</Button></td>
                      </tr>
                    );
                  })}
                  {filteredRfqs.length === 0 && (
                    <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>{t('quotes.noRequests', 'Sin solicitudes')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Drawer: cotización a cliente ────────────────────────────────────── */}
      {selQuote && (
        <div className="drawer-backdrop" onClick={() => setSelected(null)}>
          <div className="drawer" style={{ width: 600 }} onClick={e => e.stopPropagation()}>
            <div className="drawer-head">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 500, fontSize: 14 }}>{selQuote.id}</span>
                  <span className={`badge-m3 ${STATUS_CLASS[selQuote.status]}`}>{STATUS_LABEL[selQuote.status]}</span>
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{selQuote.client.name} · {fmtDate(selQuote.date)}</div>
              </div>
              <button className="icon-btn" onClick={() => setSelected(null)}><Icon name="close" /></button>
            </div>

            <div className="tabs" style={{ padding: '0 16px', borderBottom: '1px solid var(--border)' }}>
              <button className={`tab ${drawerTab === 'detail'  ? 'active' : ''}`} onClick={() => setDrawerTab('detail')}>{t('quotes.detail', 'Detalle')}</button>
              <button className={`tab ${drawerTab === 'history' ? 'active' : ''}`} onClick={() => setDrawerTab('history')}>{t('quotes.history', 'Historial')}</button>
            </div>

            <div className="drawer-body">
              {drawerTab === 'detail' && (() => {
                const { lines, subtotal, iva, total } = computeTotals(selQuote.items);
                return (
                  <>
                    <div className="detail-grid" style={{ marginBottom: 16 }}>
                      {[
                        [t('common.client', 'Cliente'),      selQuote.client.name],
                        ['NIT',          selQuote.client.nit || '—'],
                        [t('quotes.contact', 'Contacto'),     selQuote.client.contact || '—'],
                        [t('quotes.email', 'Correo'),       selQuote.client.email || '—'],
                        [t('quotes.validUntil', 'Válida hasta'), fmtDate(selQuote.validUntil)],
                        [t('quotes.createdBy', 'Creado por'),   selQuote.createdBy],
                      ].map(([l, v]) => (
                        <div className="detail-row" key={l}>
                          <span className="detail-label">{l}</span>
                          <span style={{ fontSize: 12, textAlign: 'right' }}>{v}</span>
                        </div>
                      ))}
                    </div>

                    <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 8 }}>{t('common.product', 'PRODUCTOS').toUpperCase()}</div>
                    <table className="tbl" style={{ marginBottom: 4 }}>
                      <thead>
                        <tr>
                          <th>{t('common.description', 'Descripción')}</th>
                          <th style={{ textAlign: 'center' }}>{t('quotes.qty', 'Cant.')}</th>
                          <th style={{ textAlign: 'center' }}>UOM</th>
                          <th style={{ textAlign: 'right' }}>{t('quotes.unitPriceShort', 'P. Unit.')}</th>
                          <th style={{ textAlign: 'center' }}>{t('common.discount', 'Desc.')}</th>
                          <th style={{ textAlign: 'right' }}>{t('common.total', 'Total')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map(l => (
                          <tr key={l.id}>
                            <td>{l.name}</td>
                            <td style={{ textAlign: 'center' }}>{l.qty}</td>
                            <td style={{ textAlign: 'center' }}><span className="badge-m3">{l.uom}</span></td>
                            <td className="num">{Q(l.unitPrice)}</td>
                            <td style={{ textAlign: 'center', color: l.discount> 0 ? 'var(--success)' : 'var(--muted)' }}>
                              {l.discount > 0 ? `${l.discount}%` : '—'}
                            </td>
                            <td className="num" style={{ fontWeight: 500 }}>{Q(l.lineTotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-md)', padding: '10px 14px', marginBottom: 14 }}>
                      {[[t('quotes.subtotalNoIva', 'Subtotal sin IVA'), Q(subtotal)], [t('common.iva', 'IVA') + ' (12%)', Q(iva)]].map(([l, v]) => (
                        <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5, color: 'var(--text-2)' }}>
                          <span>{l}</span><span className="mono">{v}</span>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 500, fontSize: 14, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                        <span>{t('common.total', 'TOTAL').toUpperCase()}</span><span className="mono">{Q(total)}</span>
                      </div>
                    </div>

                    {selQuote.notes && (
                      <div style={{ fontSize: 12, color: 'var(--text-2)', background: 'var(--surface-2)', padding: '10px 14px', borderRadius: 'var(--r-md)', borderLeft: '3px solid var(--border)' }}>
                        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted)', marginBottom: 4, letterSpacing: '0.05em' }}>{t('common.notes', 'NOTAS').toUpperCase()}</div>
                        {selQuote.notes}
                      </div>
                    )}
                  </>
                );
              })()}

              {drawerTab === 'history' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {selQuote.history.map((h, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 12, paddingBottom: 16 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: idx === 0 ? 'var(--accent)' : 'var(--border)', flexShrink: 0, marginTop: 4 }} />
                        {idx < selQuote.history.length - 1 && <div style={{ width: 1, flex: 1, background: 'var(--border)' }} />}
                      </div>
                      <div style={{ flex: 1, paddingBottom: 4 }}>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{h.action}</div>
                        <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{h.user} · {h.ts}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="drawer-foot" style={{ flexWrap: 'wrap', gap: 8 }}>
              <Button variant="ghost" onClick={() => setSelected(null)}>{t('common.close', 'Cerrar')}</Button>
              <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                {selQuote.status === 'borrador' && (
                  <Button onClick={() => { updateStatus(selQuote.id, 'enviada', 'Enviada al cliente por correo electrónico'); pushToast('Cotización enviada', 'success'); }}>
                    {t('quotes.sendToClient', 'Enviar al cliente')}
                  </Button>
                )}
                {selQuote.status === 'enviada' && (
                  <>
                    <Button style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => { updateStatus(selQuote.id, 'rechazada', 'Rechazada'); pushToast('Cotización rechazada', 'danger'); }}>
                      {t('quotes.reject', 'Rechazar')}
                    </Button>
                    <Button onClick={() => { updateStatus(selQuote.id, 'aprobada', 'Aprobada por el cliente'); pushToast('Cotización aprobada', 'success'); }}>
                      {t('quotes.markApproved', 'Marcar aprobada')}
                    </Button>
                  </>
                )}
                {selQuote.status === 'aprobada' && (
                  <Button icon="receipt" onClick={() => { const fid = `T-2026-0${Math.floor(Math.random() * 9000 + 1000)}`; updateStatus(selQuote.id, 'convertida', `Convertida a venta — Factura FEL ${fid}`); pushToast(`Factura FEL ${fid} generada`, 'success'); }}>{t('quotes.convertToSale', 'Convertir a venta')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Drawer: RFQ a proveedor ─────────────────────────────────────────── */}
      {selRfq && (
        <div className="drawer-backdrop" onClick={() => setSelectedRfq(null)}>
          <div className="drawer" style={{ width: 600 }} onClick={e => e.stopPropagation()}>
            <div className="drawer-head">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 500, fontSize: 14 }}>{selRfq.id}</span>
                  <span className={`badge-m3 ${RFQ_CLASS[selRfq.status]}`}>{RFQ_LABEL[selRfq.status]}</span>
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{selRfq.supplier.name} · {fmtDate(selRfq.date)}</div>
              </div>
              <button className="icon-btn" onClick={() => setSelectedRfq(null)}><Icon name="close" /></button>
            </div>

            <div className="tabs" style={{ padding: '0 16px', borderBottom: '1px solid var(--border)' }}>
              <button className={`tab ${rfqDrawerTab === 'detail'  ? 'active' : ''}`} onClick={() => setRfqDrawerTab('detail')}>{t('quotes.detail', 'Detalle')}</button>
              <button className={`tab ${rfqDrawerTab === 'history' ? 'active' : ''}`} onClick={() => setRfqDrawerTab('history')}>{t('quotes.history', 'Historial')}</button>
            </div>

            <div className="drawer-body">
              {rfqDrawerTab === 'detail' && (() => {
                const hasPrices = selRfq.items.some(i => i.unitPrice > 0);
                const { lines, subtotal, iva, total } = computeTotals(selRfq.items);
                return (
                  <>
                    <div className="detail-grid" style={{ marginBottom: 16 }}>
                      {[
                        [t('common.supplier', 'Proveedor'),     selRfq.supplier.name],
                        ['NIT',           selRfq.supplier.nit || '—'],
                        [t('quotes.contact', 'Contacto'),      selRfq.supplier.contact || '—'],
                        [t('quotes.email', 'Correo'),        selRfq.supplier.email || '—'],
                        [t('quotes.respondBeforeFull', 'Resp. antes de'), selRfq.deadline ? fmtDate(selRfq.deadline) : '—'],
                        [t('quotes.createdBy', 'Creado por'),    selRfq.createdBy],
                        [t('quotes.leadTimeFull', 'Tiempo entrega'), selRfq.leadTime],
                        [t('quotes.paymentTermFull', 'Plazo de pago'), selRfq.paymentTerms],
                      ].map(([l, v]) => (
                        <div className="detail-row" key={l}>
                          <span className="detail-label">{l}</span>
                          <span style={{ fontSize: 12, textAlign: 'right' }}>{v}</span>
                        </div>
                      ))}
                    </div>

                    <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 8 }}>{t('quotes.requestedProducts', 'PRODUCTOS SOLICITADOS')}</div>

                    {!hasPrices && (
                      <div style={{ fontSize: 12, color: 'var(--warning)', background: 'var(--surface-2)', padding: '8px 12px', borderRadius: 'var(--r-md)', borderLeft: '3px solid var(--warning)', marginBottom: 10 }}>
                        {t('quotes.waitingSupplierResponse', 'Esperando respuesta del proveedor — precios pendientes de confirmar')}
                      </div>
                    )}

                    <table className="tbl" style={{ marginBottom: 4 }}>
                      <thead>
                        <tr>
                          <th>{t('common.description', 'Descripción')}</th>
                          <th style={{ textAlign: 'center' }}>{t('quotes.qty', 'Cant.')}</th>
                          <th style={{ textAlign: 'center' }}>UOM</th>
                          {hasPrices && (
                            <>
                              <th style={{ textAlign: 'right' }}>{t('quotes.unitPriceShort', 'P. Unit.')}</th>
                              <th style={{ textAlign: 'center' }}>{t('common.discount', 'Desc.')}</th>
                              <th style={{ textAlign: 'right' }}>{t('common.total', 'Total')}</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map(l => (
                          <tr key={l.id}>
                            <td>{l.name}</td>
                            <td style={{ textAlign: 'center' }}>{l.qty}</td>
                            <td style={{ textAlign: 'center' }}><span className="badge-m3">{l.uom}</span></td>
                            {hasPrices && (
                              <>
                                <td className="num">{Q(l.unitPrice)}</td>
                                <td style={{ textAlign: 'center', color: l.discount> 0 ? 'var(--success)' : 'var(--muted)' }}>
                                  {l.discount > 0 ? `${l.discount}%` : '—'}
                                </td>
                                <td className="num" style={{ fontWeight: 500 }}>{Q(l.lineTotal)}</td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {hasPrices && (
                      <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-md)', padding: '10px 14px', marginBottom: 14 }}>
                        {[[t('quotes.subtotalNoIva', 'Subtotal sin IVA'), Q(subtotal)], [t('common.iva', 'IVA') + ' (12%)', Q(iva)]].map(([l, v]) => (
                          <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5, color: 'var(--text-2)' }}>
                            <span>{l}</span><span className="mono">{v}</span>
                          </div>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 500, fontSize: 14, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                          <span>{t('quotes.estimatedTotal', 'TOTAL ESTIMADO')}</span><span className="mono">{Q(total)}</span>
                        </div>
                      </div>
                    )}

                    {selRfq.notes && (
                      <div style={{ fontSize: 12, color: 'var(--text-2)', background: 'var(--surface-2)', padding: '10px 14px', borderRadius: 'var(--r-md)', borderLeft: '3px solid var(--border)' }}>
                        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted)', marginBottom: 4, letterSpacing: '0.05em' }}>{t('common.notes', 'NOTAS').toUpperCase()}</div>
                        {selRfq.notes}
                      </div>
                    )}
                  </>
                );
              })()}

              {rfqDrawerTab === 'history' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {selRfq.history.map((h, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 12, paddingBottom: 16 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: idx === 0 ? 'var(--accent)' : 'var(--border)', flexShrink: 0, marginTop: 4 }} />
                        {idx < selRfq.history.length - 1 && <div style={{ width: 1, flex: 1, background: 'var(--border)' }} />}
                      </div>
                      <div style={{ flex: 1, paddingBottom: 4 }}>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{h.action}</div>
                        <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{h.user} · {h.ts}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="drawer-foot" style={{ flexWrap: 'wrap', gap: 8 }}>
              <Button variant="ghost" onClick={() => setSelectedRfq(null)}>{t('common.close', 'Cerrar')}</Button>
              <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                {selRfq.status === 'solicitada' && (
                  <Button onClick={() => { updateRfqStatus(selRfq.id, 'recibida', 'Cotización recibida del proveedor'); pushToast('Respuesta registrada', 'success'); }}>
                    {t('quotes.registerResponse', 'Registrar respuesta')}
                  </Button>
                )}
                {selRfq.status === 'recibida' && (
                  <>
                    <Button style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => { updateRfqStatus(selRfq.id, 'rechazada', 'Cotización rechazada — condiciones no aceptadas'); pushToast('Cotización rechazada', 'danger'); }}>
                      {t('quotes.reject', 'Rechazar')}
                    </Button>
                    <Button onClick={() => { updateRfqStatus(selRfq.id, 'aprobada', 'Cotización aprobada — mejor precio y condiciones'); pushToast('Cotización aprobada', 'success'); }}>
                      {t('quotes.approve', 'Aprobar')}
                    </Button>
                  </>
                )}
                {selRfq.status === 'aprobada' && (
                  <Button icon="truck" onClick={() => { const ocNum = `OC-2026-${String(Math.floor(Math.random() * 900 + 100)).padStart(5, '0')}`; updateRfqStatus(selRfq.id, 'convertida', `Convertida a orden de compra — ${ocNum}`); pushToast(`${ocNum} generada`, 'success'); }}>{t('quotes.convertToPO', 'Convertir a OC')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreate    && <CreateModal    onSave={submitQuote} onClose={() => setShowCreate(false)}    />}
      {showCreateRfq && <CreateRFQModal onSave={submitRfq}   onClose={() => setShowCreateRfq(false)} />}
    </div>
  );
}
