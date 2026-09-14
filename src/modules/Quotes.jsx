// Stackline — Cotizaciones a clientes + RFQ a proveedores
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import DatePicker from '../components/DatePicker.jsx';
import StatCard from '../components/StatCard.jsx';
import DataTable from '../components/DataTable.jsx';
import Autocomplete from '../components/Autocomplete.jsx';
import { useTranslation } from 'react-i18next';
import { useTaxRate, useProjects } from '../hooks/useOperations.js';
import { getClientByNit } from '../api/partners.js';
import { useNavigate, useLocation } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import { useClientQuotes, useSupplierRfqs, mapQuote, mapRfq } from '../hooks/useQuotes.js';
import { getQuote, getQuoteCharges, createQuote as apiCreateQuote, updateQuoteStatus, listSettings, setQuoteAdjustment, resendQuoteEmail } from '../api/wave2.js';
import { sessionCompany } from '../api/auth.js';
import { renderQuotePdfWindow } from '../lib/quotePdf.js';
import QuoteBuilderModal from '../components/QuoteBuilderModal.jsx';
import QuoteDraftEditModal from '../components/QuoteDraftEditModal.jsx';
import QuoteChargesPanel from '../components/QuoteChargesPanel.jsx';
import QuotePlanPanel from '../components/QuotePlanPanel.jsx';

const Q       = v  => `Q ${Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = d  => d
  ? new Date(d + 'T00:00').toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—';
const today   = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();
const quoteHasCurrentExpiration = quote => Boolean(quote?.validUntil) && quote.validUntil >= today;

// — Cotizaciones a clientes —
const STATUS_LABEL = { borrador: 'Borrador', enviada: 'Enviada', aprobada: 'Aprobada', rechazada: 'Rechazada', vencida: 'Vencida', convertida: 'Convertida' };
const STATUS_CLASS  = { borrador: 'neutral', enviada: 'info',    aprobada: 'success',  rechazada: 'danger',    vencida: 'warning',  convertida: 'success'    };

// — RFQ a proveedores —
const RFQ_LABEL = { solicitada: 'Solicitada', recibida: 'Recibida', aprobada: 'Aprobada', rechazada: 'Rechazada', convertida: 'Conv. a OC' };
const RFQ_CLASS  = { solicitada: 'info',       recibida: 'warning',  aprobada: 'success',  rechazada: 'danger',    convertida: 'success'    };

// El IVA va INCLUIDO en el precio, igual que lo calcula el backend
// (tax = total × tasa/(100+tasa)). Se usa para las tarjetas de pipeline y el
// desglose del drawer; el precio de cada línea ya lo trae el backend.
function computeTotals(items, taxRate = 12) {
  const lines    = (items ?? []).map(i => ({ ...i, lineTotal: (i.qty || 0) * (i.unitPrice || 0) * (1 - (i.discount || 0) / 100) }));
  const total    = lines.reduce((s, l) => s + l.lineTotal, 0);
  const iva      = total * (taxRate / (100 + taxRate));
  return { lines, subtotal: total - iva, iva, total, taxRate };
}

const newRfqId = () => `RFQ-${Date.now()}`;

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
            <DatePicker value={deadline} onChange={(iso) => setDeadline(iso)} min={today}
              aria-label={t('quotes.respondBefore', 'Resp. antes')} />
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
  const taxRate = useTaxRate();
  const { items: projects } = useProjects();
  const navigate = useNavigate();
  const location = useLocation();
  // Cliente traído desde «Cotizar» en la lista de clientes.
  const [prefillClient, setPrefillClient] = useState(location.state?.newQuoteFor || null);

  // El proyecto se crea antes o durante la cotización; la aprobación solo cambia
  // si la asociación entra al agregado del proyecto.
  const [quoteType, setQuoteType] = useState('cliente');

  // — cotizaciones a clientes —
  const { items: quotes, reload: reloadQuotes } = useClientQuotes();
  const [selected,     setSelected]     = useState(null);
  const [selectedPlanBalanced, setSelectedPlanBalanced] = useState(null);
  const [chargesVersion, setChargesVersion] = useState(0);
  // El resumen completo del backend: es la cascada autoritativa —la misma que
  // se guarda en la cotización y sale en el PDF—. Antes solo se conservaba la
  // suma de cargos y el resto de la pantalla lo recalculaba por su cuenta.
  const [chargeSummary, setChargeSummary] = useState(null);
  // Borrador del ajuste mientras se teclea. Vacío = mostrar el guardado.
  const [ajusteBorrador, setAjusteBorrador] = useState('');
  const [reenviando, setReenviando] = useState(false);

  /**
   * Reenvío manual. El envío automático ocurre al pasar a «enviada», pero ese
   * no devuelve acuse: aquí el usuario sí ve si salió y por qué no, que es lo
   * que pide cuando el cliente dice que no le llegó.
   */
  const reenviarCorreo = useCallback(async (quoteId) => {
    setReenviando(true);
    try {
      const r = await resendQuoteEmail(quoteId);
      pushToast(r?.message || 'Correo procesado', r?.ok ? 'success' : 'danger');
    } catch (err) {
      pushToast('No se pudo reenviar: ' + err.message, 'danger');
    } finally { setReenviando(false); }
  }, [pushToast]);
  const [guardandoAjuste, setGuardandoAjuste] = useState(false);
  const handlePlanBalanceChange = useCallback((balanced) => setSelectedPlanBalanced(balanced), []);
  const handleChargesChange = useCallback(() => setChargesVersion((version) => version + 1), []);
  const handleChargeSummary = useCallback((summary) => setChargeSummary(summary || null), []);
  const guardarAjuste = useCallback(async (quoteId) => {
    const monto = parseFloat(ajusteBorrador);
    if (!Number.isFinite(monto)) { pushToast(t('quotes.adjInvalid', 'Indica un monto válido'), 'danger'); return; }
    setGuardandoAjuste(true);
    try {
      setChargeSummary(await setQuoteAdjustment(quoteId, monto));
      setAjusteBorrador('');
      setChargesVersion((v) => v + 1);
    } catch (err) {
      pushToast(t('quotes.adjFailed', 'No se pudo guardar el ajuste: ') + err.message, 'danger');
    } finally { setGuardandoAjuste(false); }
  }, [ajusteBorrador, pushToast, t]);
  const [drawerTab,    setDrawerTab]    = useState('detail');
  const [showCreate,   setShowCreate]   = useState(Boolean(location.state?.newQuoteFor));
  // Proyecto elegido para el constructor de cotización desde materiales.
  const [builderProject, setBuilderProject] = useState(null);
  const [showDraftEdit, setShowDraftEdit] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Limpia el estado de la ruta tras abrir: si no, recargar o volver atrás
  // reabriría el diálogo con el mismo cliente.
  useEffect(() => {
    if (location.state?.newQuoteFor) navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);
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
    setSelectedPlanBalanced(null);
    setChargeSummary(null);
    setSelectedRfq(null);
    setStatusFilter('');
    setSearch('');
    setRfqFilter('');
    setRfqSearch('');
  };

  // — KPIs clientes —
  const pipeline    = quotes.filter(q => ['borrador', 'enviada', 'aprobada'].includes(q.status));
  /**
   * Columnas de la lista de cotizaciones.
   *
   * `sortValue` donde el render no es ordenable por sí solo: la fecha se pinta
   * formateada y el total es un cálculo, así que sin él DataTable ordenaría por
   * el texto que ve —"14/09/2026" antes que "03/10/2026"— en vez de por la
   * fecha real.
   */
  const quoteColumns = [
    { key: 'id', header: t('quotes.quoteNo', 'Cotización'), sortable: true, mono: true, width: 150 },
    { key: 'client', header: t('common.client', 'Cliente'), sortable: true,
      sortValue: (q) => q.client?.name || '',
      render: (q) => (<>
        <div style={{ fontWeight: 500 }}>{q.client?.name}</div>
        {q.client?.contact && <div className="muted" style={{ fontSize: 11 }}>{q.client.contact}</div>}
      </>) },
    { key: 'date', header: t('common.date', 'Fecha'), sortable: true, className: 'muted',
      sortValue: (q) => q.date || '', render: (q) => fmtDate(q.date) },
    { key: 'validUntil', header: t('quotes.validUntil', 'Válida hasta'), sortable: true,
      sortValue: (q) => q.validUntil || '',
      render: (q) => {
        const vencida = q.validUntil < today && !['convertida', 'rechazada', 'vencida'].includes(q.status);
        return <span style={{ color: vencida ? 'var(--danger)' : 'inherit' }}>{fmtDate(q.validUntil)}</span>;
      } },
    { key: 'items', header: t('quotes.items', 'Ítems'), align: 'center', sortable: true,
      sortValue: (q) => (q.items || []).length, render: (q) => (q.items || []).length },
    { key: 'total', header: t('quotes.totalWithIva', 'Total (c/IVA)'), align: 'right', sortable: true,
      sortValue: (q) => computeTotals(q.items, taxRate).total,
      render: (q) => <span className="num" style={{ fontWeight: 500 }}>{Q(computeTotals(q.items, taxRate).total)}</span> },
    { key: 'status', header: t('common.status', 'Estado'), sortable: true,
      render: (q) => <span className={`badge-m3 ${STATUS_CLASS[q.status]}`}>{STATUS_LABEL[q.status]}</span> },
  ];

  /**
   * Columnas de la lista de RFQ.
   *
   * El total solo se muestra cuando el proveedor ya puso precios; hasta
   * entonces sería un Q0.00 que se lee como «me lo dan gratis» en vez de
   * «todavía no responde». Al ordenar, esas filas pesan −1 para que queden al
   * fondo y no compitan con montos reales.
   */
  const rfqColumns = [
    { key: 'id', header: t('quotes.rfqNo', 'Solicitud'), sortable: true, mono: true, width: 150 },
    { key: 'supplier', header: t('common.supplier', 'Proveedor'), sortable: true,
      sortValue: (r) => r.supplier?.name || '',
      render: (r) => (<>
        <div style={{ fontWeight: 500 }}>{r.supplier?.name}</div>
        {r.supplier?.contact && <div className="muted" style={{ fontSize: 11 }}>{r.supplier.contact}</div>}
      </>) },
    { key: 'date', header: t('common.date', 'Fecha'), sortable: true, className: 'muted',
      sortValue: (r) => r.date || '', render: (r) => fmtDate(r.date) },
    { key: 'deadline', header: t('quotes.respondBefore', 'Resp. antes'), sortable: true,
      sortValue: (r) => r.deadline || '',
      render: (r) => {
        const vencida = r.deadline && r.deadline < today && ['solicitada', 'recibida'].includes(r.status);
        return <span style={{ color: vencida ? 'var(--danger)' : 'inherit' }}>{r.deadline ? fmtDate(r.deadline) : '—'}</span>;
      } },
    { key: 'leadTime', header: t('quotes.leadTime', 'T. entrega'), sortable: true, render: (r) => r.leadTime || '—' },
    { key: 'paymentTerms', header: t('quotes.paymentTerm', 'Plazo pago'), sortable: true, render: (r) => r.paymentTerms || '—' },
    { key: 'total', header: t('quotes.totalWithIva', 'Total (c/IVA)'), align: 'right', sortable: true,
      sortValue: (r) => ((r.items || []).some((i) => i.unitPrice > 0) ? computeTotals(r.items, taxRate).total : -1),
      render: (r) => {
        const conPrecios = (r.items || []).some((i) => i.unitPrice > 0);
        return conPrecios
          ? <span className="num" style={{ fontWeight: 500 }}>{Q(computeTotals(r.items, taxRate).total)}</span>
          : <span className="muted">{t('quotes.pending', 'Pendiente')}</span>;
      } },
    { key: 'status', header: t('common.status', 'Estado'), sortable: true,
      render: (r) => <span className={`badge-m3 ${RFQ_CLASS[r.status]}`}>{RFQ_LABEL[r.status]}</span> },
  ];

  const pipelineAmt = pipeline.reduce((s, q) => s + computeTotals(q.items, taxRate).total, 0);
  const approvedAmt = quotes.filter(q => q.status === 'aprobada').reduce((s, q) => s + computeTotals(q.items, taxRate).total, 0);

  const filtered = useMemo(() => quotes.filter(q => {
    if (statusFilter && q.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return q.id.toLowerCase().includes(s) || q.client.name.toLowerCase().includes(s);
    }
    return true;
  }), [quotes, statusFilter, search]);

  // `okMsg` se avisa DENTRO del try: antes las llamadas hacían
  // `updateStatus(...); pushToast('éxito')` sin esperar, así que un fallo de
  // red o un rechazo del backend se anunciaban como éxito igualmente.
  const updateStatus = async (id, newStatus, entry, okMsg, okTone = 'success') => {
    const q = quotes.find(x => x.id === id);
    if (!q) { pushToast(t('quotes.notFound', 'No se encontró la cotización'), 'danger'); return; }
    if (newStatus === 'enviada' && !quoteHasCurrentExpiration(q)) {
      pushToast(t('quotes.expirationRequiredBeforeSend', 'No se puede enviar: define una fecha de expiración vigente.'), 'danger');
      return;
    }
    try {
      const full = await updateQuoteStatus(q.backendId, { status: newStatus, note: entry, actor: '' });
      setSelected(mapQuote(full));
      reloadQuotes();
      if (okMsg) pushToast(okMsg, okTone);
    } catch (err) { pushToast('No se pudo actualizar el estado: ' + err.message, 'danger'); }
  };

  const openDrawer  = async (q) => {
    setSelectedPlanBalanced(null);
    setChargeSummary(null);
    setAjusteBorrador('');
    setSelected(q); setDrawerTab('detail');
    try { setSelected(mapQuote(await getQuote(q.backendId))); } catch { /* deja el de la lista */ }
  };

  const handleGeneratePdf = async () => {
    if (!selQuote || generatingPdf) return;
    if (!quoteHasCurrentExpiration(selQuote)) {
      pushToast(t('quotes.pdfExpirationBlocked', 'No se puede generar el PDF: define una fecha de expiración vigente.'), 'danger');
      return;
    }
    const popup = window.open('', '_blank', 'width=920,height=900');
    if (!popup) {
      pushToast(t('quotes.pdfBlocked', 'Permite las ventanas emergentes para generar el PDF'), 'danger');
      return;
    }
    popup.document.write('<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Generando PDF…</title></head><body style="font-family:system-ui;padding:32px;color:#555">Generando PDF…</body></html>');
    popup.document.close();
    setGeneratingPdf(true);
    try {
      const charges = await getQuoteCharges(selQuote.backendId);
      let branding;
      try {
        const rows = await listSettings();
        const byKey = Object.fromEntries((rows || []).map((r) => [r.settingKey, r.settingValue]));
        branding = {
          logoUrl: byKey['company.logo_url'] || '',
          primaryColor: byKey['brand.primary_color'] || '',
          secondaryColor: byKey['brand.secondary_color'] || '',
        };
      } catch { /* sin settings, el PDF usa el logo y colores por defecto */ }
      renderQuotePdfWindow(popup, selQuote, {
        company: sessionCompany(),
        charges,
        branding,
        // La tasa de la cotización manda por estar congelada en el documento;
        // si no la trae, la configurada en la empresa. El 12 duro se fue: era
        // el que hacía que el PDF ignorara la configuración.
        taxRate: Number(selQuote.taxRate ?? taxRate),
      });
      pushToast(t('quotes.pdfReady', 'PDF generado. Revisa la ventana de impresión para guardarlo.'), 'success');
    } catch (err) {
      popup.close();
      pushToast(t('quotes.pdfFailed', 'No se pudo generar el PDF: ') + err.message, 'danger');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const selQuote    = selected;
  const selectedQuoteExpirationValid = quoteHasCurrentExpiration(selQuote);

  // Abrir una cotización concreta al llegar desde "Ver cotización" en el
  // proyecto: se navega con state.openQuoteId (el backendId de la cotización).
  useEffect(() => {
    const openId = location.state?.openQuoteId;
    if (!openId || !quotes.length) return;
    const row = quotes.find((q) => q.backendId === openId);
    if (row) {
      openDrawer(row);
      navigate(location.pathname, { replace: true, state: null });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, quotes]);

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

  const updateRfqStatus = async (id, newStatus, entry, okMsg, okTone = 'success') => {
    const r = rfqs.find(x => x.id === id);
    if (!r) { pushToast(t('quotes.rfqNotFound', 'No se encontró la solicitud'), 'danger'); return; }
    try {
      const full = await updateQuoteStatus(r.backendId, { status: newStatus, note: entry, actor: '' });
      setSelectedRfq(mapRfq(full));
      reloadRfqs();
      if (okMsg) pushToast(okMsg, okTone);
    } catch (err) { pushToast('No se pudo actualizar el estado: ' + err.message, 'danger'); }
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
    } catch (err) { pushToast('No se pudo crear la solicitud: ' + err.message, 'danger'); }
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

          {/* Mismo patrón que la barra de /inventory: buscador con el ícono
              dentro, filtros como chips y el conteo de resultados a la
              derecha. Los estados pasan de select a chips porque son siete y
              cortos: se ven todos de un vistazo y se cambian con un clic. */}
          <div className="filterbar">
            <div style={{ position: 'relative', width: 280 }}>
              <Icon name="search" size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
              <input className="input" style={{ width: '100%', paddingLeft: 26 }}
                placeholder={t('quotes.searchPlaceholder', 'Buscar cotización o cliente…')}
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="row gap-6" style={{ flexWrap: 'wrap' }}>
              {[['', t('common.all', 'Todos')], ...Object.entries(STATUS_LABEL)].map(([k, v]) => (
                <button key={k || 'all'} className={`chip ${statusFilter === k ? 'active' : ''}`}
                  onClick={() => setStatusFilter(k)}>{v}</button>
              ))}
            </div>
            <div className="grow" />
            <span className="muted mono" style={{ fontSize: 11 }}>{filtered.length} resultados</span>
          </div>

          <DataTable
            rowKey={(q) => q.id}
            columns={quoteColumns}
            rows={filtered}
            density="compact"
            pageSize={12}
            onRowClick={openDrawer}
            onView={openDrawer}
            empty={t('quotes.noQuotes', 'Sin cotizaciones')}
            emptyIcon="receipt"
          />
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

          {/* Misma barra que la pestaña de cotizaciones: son hermanas dentro
              del mismo módulo y verlas distintas al cambiar de pestaña haría
              dudar de cuál es la buena. */}
          <div className="filterbar">
            <div style={{ position: 'relative', width: 280 }}>
              <Icon name="search" size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
              <input className="input" style={{ width: '100%', paddingLeft: 26 }}
                placeholder={t('quotes.rfqSearchPlaceholder', 'Buscar RFQ o proveedor…')}
                value={rfqSearch} onChange={e => setRfqSearch(e.target.value)} />
            </div>
            <div className="row gap-6" style={{ flexWrap: 'wrap' }}>
              {[['', t('common.all', 'Todos')], ...Object.entries(RFQ_LABEL)].map(([k, v]) => (
                <button key={k || 'all'} className={`chip ${rfqFilter === k ? 'active' : ''}`}
                  onClick={() => setRfqFilter(k)}>{v}</button>
              ))}
            </div>
            <div className="grow" />
            <span className="muted mono" style={{ fontSize: 11 }}>{filteredRfqs.length} resultados</span>
          </div>

          <DataTable
            rowKey={(r) => r.id}
            columns={rfqColumns}
            rows={filteredRfqs}
            density="compact"
            pageSize={12}
            onRowClick={openRfqDrawer}
            onView={openRfqDrawer}
            empty={t('quotes.noRequests', 'Sin solicitudes')}
            emptyIcon="truck"
          />
        </>
      )}

      {/* ── Drawer: cotización a cliente ────────────────────────────────────── */}
      {selQuote && (
        <>
          <div className="drawer-overlay" onClick={() => setSelected(null)} />
          <div className="drawer drawer--wide">
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
                // `lines` sigue saliendo de computeTotals: son las filas de la
                // tabla. Los totales ya NO, porque el frontend los rehacía con
                // otra regla de IVA que la del backend —extraía el impuesto de
                // un total que ya lo incluía mientras el bloque de abajo lo
                // sumaba encima— y el PDF imprimía un tercer número.
                const { lines } = computeTotals(selQuote.items, taxRate);
                const resumen = chargeSummary;
                const num = (v) => Number(v || 0);
                const tasa = resumen ? num(resumen.taxRate) : taxRate;
                return (
                  <>
                    <section className="quote-section quote-section--detail">
                      <div className="quote-section-heading">
                        <div>
                          <div className="quote-section-title">{t('quotes.detailSection', 'Detalle de la cotización')}</div>
                          <div className="quote-section-description">{t('quotes.detailSectionHint', 'Productos, cargos y resumen fiscal')}</div>
                        </div>
                      </div>
                      <div className="quote-section-card quote-section-card--detail-core">
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
                      {selQuote.projectId && (
                        <div className="detail-row">
                          <span className="detail-label">{t('quotes.project', 'Proyecto')}</span>
                          <span style={{ fontSize: 12, textAlign: 'right' }}>
                            <a href="#" onClick={(e) => { e.preventDefault(); navigate('/projects', { state: { openProjectId: selQuote.projectId } }); }}
                              style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                              {t('quotes.goToProject', 'Ir al proyecto')} <Icon name="chevronRight" size={13} />
                            </a>
                          </span>
                        </div>
                      )}
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

                    {selQuote.notes && (
                      <div style={{ fontSize: 12, color: 'var(--text-2)', background: 'var(--surface-2)', padding: '10px 14px', borderRadius: 'var(--r-md)', borderLeft: '3px solid var(--border)' }}>
                        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted)', marginBottom: 4, letterSpacing: '0.05em' }}>{t('common.notes', 'NOTAS').toUpperCase()}</div>
                        {selQuote.notes}
                      </div>
                    )}
                      </div>

                    <QuoteChargesPanel
                      quoteId={selQuote.backendId}
                      canEdit={selQuote.status === 'borrador'}
                      onChargesChange={handleChargesChange}
                      onSummaryChange={handleChargeSummary}
                      pushToast={pushToast}
                    />

                    <div className="quote-fiscal-card" style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-md)', padding: '10px 14px', marginTop: 14, marginBottom: 14 }}>
                      {!resumen ? (
                        <div className="muted" style={{ fontSize: 12 }}>{t('common.loading', 'Cargando…')}</div>
                      ) : (<>
                        {[
                          [t('quotes.calcSubtotal', 'Subtotal'), Q(resumen.subtotal)],
                          // El porcentaje va siempre, se haya capturado como
                          // monto o como porcentaje: es la lectura que el
                          // negocio usa para comparar entre cotizaciones.
                          [`${t('quotes.calcOperating', 'Gastos operativos')}${num(resumen.subtotal) > 0
                              ? ` (${(num(resumen.operatingExpenses) / num(resumen.subtotal) * 100).toFixed(1)}%)` : ''}`,
                            Q(resumen.operatingExpenses)],
                          ...(num(resumen.otherCharges) !== 0
                            ? [[t('quotes.calcOtherCharges', 'Otros cargos'), Q(resumen.otherCharges)]] : []),
                          [t('quotes.calcProfitBase', 'Base de ganancia'), Q(resumen.operatingCost)],
                          [`${t('projects.profit', 'Ganancia')}${resumen.profitCalcType === 'percent' ? ` (${num(resumen.profitValue)}%)` : ''}`, Q(resumen.profitAmount)],
                          // Los tres renglones del ajuste solo cuando hay uno:
                          // sin ajuste serían la misma cifra repetida tres veces.
                          ...(num(resumen.manualAdjustment) !== 0 ? [
                            [t('quotes.calcBeforeAdj', 'Base antes de ajuste'), Q(resumen.taxableSubtotal)],
                            [t('quotes.calcAdjustment', 'Ajuste'), Q(resumen.manualAdjustment)],
                          ] : []),
                          [t('quotes.calcAdjustedBase', 'Base ajustada'), Q(resumen.adjustedBase)],
                          [`${t('common.iva', 'IVA')} (${tasa}%)`, Q(resumen.tax)],
                        ].map(([l, v]) => (
                          <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5, color: 'var(--text-2)' }}>
                            <span>{l}</span><span className="mono">{v}</span>
                          </div>
                        ))}

                        {/* El ajuste se teclea aquí mismo, en el renglón donde
                            se lee: llevarlo a otro formulario obligaría a
                            perder de vista la base sobre la que se aplica. */}
                        {selQuote.status === 'borrador' && (
                          <div className="quote-adj-row">
                            <span>{t('quotes.calcAdjustment', 'Ajuste')}</span>
                            <input className="field-input mono" type="number" step="0.01"
                              placeholder={Number(resumen.manualAdjustment).toFixed(2)}
                              value={ajusteBorrador}
                              onChange={(e) => setAjusteBorrador(e.target.value)} />
                            <Button size="sm" icon="check" disabled={guardandoAjuste || ajusteBorrador === ''}
                              onClick={() => guardarAjuste(selQuote.backendId)}>
                              {t('common.apply', 'Aplicar')}
                            </Button>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 500, fontSize: 14, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                          <span>{t('common.total', 'TOTAL').toUpperCase()}</span><span className="mono">{Q(resumen.total)}</span>
                        </div>
                      </>)}
                    </div>

                    </section>

                    <QuotePlanPanel
                      quote={selQuote}
                      canEdit={selQuote.status !== 'rechazada' && selQuote.status !== 'cancelada'}
                      chargesVersion={chargesVersion}
                      onPlanBalanceChange={handlePlanBalanceChange}
                      pushToast={pushToast}
                    />
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
              <Button
                icon="download"
                variant="tonal"
                disabled={generatingPdf || !selectedQuoteExpirationValid}
                title={selectedQuoteExpirationValid ? '' : t('quotes.expirationRequiredBeforeActions', 'Define una fecha de expiración vigente antes de enviar o generar el PDF.')}
                onClick={handleGeneratePdf}
              >
                {generatingPdf ? t('quotes.generatingPdf', 'Generando PDF…') : t('quotes.generatePdf', 'Generar PDF')}
              </Button>
              <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                {selQuote.status === 'borrador' && (
                  <>
                    <Button onClick={() => setShowDraftEdit(true)}>
                      {t('quotes.editDraft', 'Editar borrador')}
                    </Button>
                    <Button
                      disabled={selectedPlanBalanced !== true || !selectedQuoteExpirationValid}
                      title={!selectedQuoteExpirationValid
                        ? t('quotes.expirationRequiredBeforeActions', 'Define una fecha de expiración vigente antes de enviar o generar el PDF.')
                        : selectedPlanBalanced === true
                          ? ''
                          : t('quotes.sendRequiresBalancedPlan', 'Completa el plan de pagos para enviar la cotización')}
                      onClick={() => { updateStatus(selQuote.id, 'enviada', 'Enviada al cliente por correo electrónico', 'Cotización enviada'); }}>
                      {t('quotes.sendToClient', 'Enviar al cliente')}
                    </Button>
                  </>
                )}
                {selQuote.status === 'enviada' && (
                  <>
                    <Button style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => { updateStatus(selQuote.id, 'rechazada', 'Rechazada', 'Cotización rechazada', 'danger'); }}>
                      {t('quotes.reject', 'Rechazar')}
                    </Button>
                    <Button icon="bell" disabled={reenviando}
                      onClick={() => reenviarCorreo(selQuote.backendId)}>
                      {reenviando ? t('quotes.resending', 'Reenviando…') : t('quotes.resendEmail', 'Reenviar correo')}
                    </Button>
                    <Button onClick={() => { updateStatus(selQuote.id, 'aprobada', 'Aprobada por el cliente', 'Cotización aprobada'); }}>
                      {t('quotes.markApproved', 'Marcar aprobada')}
                    </Button>
                  </>
                )}
                {selQuote.status === 'aprobada' && (
                  <Button icon="receipt" onClick={() => { const fid = `T-2026-0${Math.floor(Math.random() * 9000 + 1000)}`; updateStatus(selQuote.id, 'convertida', `Convertida a venta — Factura FEL ${fid}`, `Factura FEL ${fid} generada`); }}>{t('quotes.convertToSale', 'Convertir a venta')}
                  </Button>
                )}
                {selQuote.status === 'aprobada' && (
                  selQuote.projectId ? (
                    <Button icon="box" onClick={() => navigate('/projects')}>
                      {t('quotes.viewProject', 'Ver proyecto')}
                    </Button>
                  ) : (
                    <span className="badge-m3 warning">Proyecto pendiente de asignar</span>
                  )
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {showDraftEdit && selQuote && selQuote.status === 'borrador' && (
        <QuoteDraftEditModal
          quote={selQuote}
          pushToast={pushToast}
          onClose={() => setShowDraftEdit(false)}
          onSaved={(updated) => {
            const next = mapQuote(updated);
            setSelected(next);
            setShowDraftEdit(false);
            setSelectedPlanBalanced(null);
            setChargesVersion((version) => version + 1);
            reloadQuotes();
          }}
        />
      )}

      {/* ── Drawer: RFQ a proveedor ─────────────────────────────────────────── */}
      {selRfq && (
        <>
          <div className="drawer-overlay" onClick={() => setSelectedRfq(null)} />
          <div className="drawer drawer--wide">
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
                const { lines, subtotal, iva, total } = computeTotals(selRfq.items, taxRate);
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
                        {[[t('quotes.subtotalNoIva', 'Subtotal sin IVA'), Q(subtotal)], [`${t('common.iva', 'IVA')} (${taxRate}%)`, Q(iva)]].map(([l, v]) => (
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
                  <Button onClick={() => { updateRfqStatus(selRfq.id, 'recibida', 'Cotización recibida del proveedor', 'Respuesta registrada'); }}>
                    {t('quotes.registerResponse', 'Registrar respuesta')}
                  </Button>
                )}
                {selRfq.status === 'recibida' && (
                  <>
                    <Button style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => { updateRfqStatus(selRfq.id, 'rechazada', 'Cotización rechazada — condiciones no aceptadas', 'Cotización rechazada', 'danger'); }}>
                      {t('quotes.reject', 'Rechazar')}
                    </Button>
                    <Button onClick={() => { updateRfqStatus(selRfq.id, 'aprobada', 'Cotización aprobada — mejor precio y condiciones', 'Cotización aprobada'); }}>
                      {t('quotes.approve', 'Aprobar')}
                    </Button>
                  </>
                )}
                {selRfq.status === 'aprobada' && (
                  <Button icon="truck" onClick={() => { const ocNum = `OC-2026-${String(Math.floor(Math.random() * 900 + 100)).padStart(5, '0')}`; updateRfqStatus(selRfq.id, 'convertida', `Convertida a orden de compra — ${ocNum}`, `${ocNum} generada`); }}>{t('quotes.convertToPO', 'Convertir a OC')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Paso 1: elegir el proyecto. La cotización se arma desde SUS materiales,
          así que primero se selecciona el proyecto y luego se abre el constructor. */}
      {showCreate && !builderProject && (
        <div className="modal-backdrop" onClick={() => { setShowCreate(false); setPrefillClient(null); }}>
          <div className="modal" style={{ width: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{t('quotes.pickProject', 'Nueva cotización · elegir proyecto')}</h3>
              <button className="icon-btn" onClick={() => { setShowCreate(false); setPrefillClient(null); }}><Icon name="close" /></button>
            </div>
            <div className="modal-body">
              <div className="field-group">
                <label className="field-label">{t('quotes.project', 'Proyecto')}</label>
                <Autocomplete value={builderProject?.id ?? ''}
                  onChange={(id) => {
                    const elegido = (projects || []).find((x) => String(x.id) === String(id));
                    if (elegido) setBuilderProject(elegido);
                  }}
                  options={(projects || []).map((p2) => ({ id: p2.id, name: `${p2.code} · ${p2.name}` }))}
                  placeholder={t('common.select', 'Seleccionar…')}
                  emptyText={t('projects.empty', 'Sin proyectos')}
                  aria-label={t('quotes.project', 'Proyecto')} />
                <div className="cfg-hint">{t('quotes.pickProjectHint', 'La cotización se compone de los materiales planificados del proyecto.')}</div>
              </div>
            </div>
            <div className="modal-foot">
              <Button variant="ghost" onClick={() => { setShowCreate(false); setPrefillClient(null); }}>{t('common.cancel', 'Cancelar')}</Button>
            </div>
          </div>
        </div>
      )}
      {/* Paso 2: constructor desde materiales del proyecto elegido. */}
      {showCreate && builderProject && (
        <QuoteBuilderModal
          project={builderProject}
          pushToast={pushToast}
          onClose={() => { setShowCreate(false); setBuilderProject(null); setPrefillClient(null); }}
          onCreated={() => { setShowCreate(false); setBuilderProject(null); setPrefillClient(null); reloadQuotes(); }}
        />
      )}
      {showCreateRfq && <CreateRFQModal onSave={submitRfq}   onClose={() => setShowCreateRfq(false)} />}
    </div>
  );
}
