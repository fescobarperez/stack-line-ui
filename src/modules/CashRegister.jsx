// Stackline — Módulo de Cierre de Caja
// Data-driven: /api/cash-registers (open/close). El backend calcula ventas/efectivo/
// tarjeta/diferencia a partir de las ventas de la caja.
import React, { useState, useMemo, useEffect } from 'react';
import Autocomplete from '../components/Autocomplete.jsx';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import StatCard from '../components/StatCard.jsx';
import { useCashRegisters, useCashPoints, usePendingRegisters } from '../hooks/useOperations.js';
import { useBranches } from '../hooks/useMasters.js';
import { openCashRegister, closeCashRegister, getCashRegisterDetail } from '../api/pos.js';
import { sessionUser } from '../api/auth.js';
import { useTranslation } from 'react-i18next';
import { hoyISO } from '../lib/fechas.js';
import { etiquetaMetodoPago } from '../lib/pagos.js';

function fmt(n) { return `Q ${Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

function pad(n) { return String(n).padStart(2, '0'); }
function fmtDateTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Backend CashRegister.Response → forma de la UI.
function mapRegister(r, user) {
  // userName ya viene del backend; el fallback cubre turnos sin usuario asignado.
  const cashier = r.userName || (user && user.id === r.userId ? user.name : (r.userId ? `Usuario ${r.userId}` : '—'));
  return {
    id: r.id,
    branchId: r.branchId,
    branch: r.branchName || '—',
    cashPoint: r.cashPointCode ? `${r.cashPointCode} — ${r.cashPointName || ''}`.trim() : '—',
    businessDate: r.businessDate || null,
    cashier,
    openedAt: fmtDateTime(r.openedAt) || '',
    // El instante crudo: recalcular desde el texto formateado pierde el día
    // y rompe cualquier turno que cruce la medianoche.
    openedAtISO: r.openedAt || null,
    closedAt: fmtDateTime(r.closedAt),
    openingAmount: Number(r.openingAmount || 0),
    closingAmount: r.closingAmount != null ? Number(r.closingAmount) : null,
    status: r.status,
    salesTotal: Number(r.salesTotal || 0),
    salesCash: Number(r.salesCash || 0),
    salesCard: Number(r.salesCard || 0),
    refunds: Number(r.refunds || 0),
    diff: r.difference != null ? Number(r.difference) : null,
  };
}

// ── Modal: Apertura de caja ──────────────────────────────────────────────────
// Se elige la CAJA, no la sucursal: una sucursal tiene N cajas y cada una la
// ocupa un cajero a la vez. Las tomadas (openSessionId) no se ofrecen.
function OpenModal({ cashPoints, onSave, onClose }) {
  const { t } = useTranslation();
  const [cashPointId, setCashPointId] = useState('');
  const [openingAmount, setOpening]   = useState('500.00');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!cashPointId) return;
    onSave({ cashPointId: Number(cashPointId), openingAmount: parseFloat(openingAmount) || 0 });
  };

  const free  = cashPoints.filter(c => c.status === 'active' && !c.openSessionId);
  const taken = cashPoints.filter(c => c.openSessionId);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{t('cash.open', 'Abrir caja')}</h3>
          <button className="icon-btn" onClick={onClose}><Icon name="x" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="field" style={{ marginBottom: 12 }}>
              <label className="field-label">{t('cash.cashPoint', 'Caja')} *</label>
              <Autocomplete value={cashPointId} onChange={(id) => setCashPointId(id == null ? '' : String(id))}
                options={free.map((c) => ({ id: c.id, name: `${c.branchName} · ${c.code} — ${c.name}` }))}
                placeholder={t('cash.selectCashPoint', 'Seleccionar caja…')}
                emptyText={t('cash.noCashPoints', 'Sin cajas libres')}
                aria-label={t('cash.cashPoint', 'Caja')} />
              {free.length === 0 && (
                <div className="alert" style={{ marginTop: 8 }}>
                  <Icon name="alert" size={16} />
                  {t('cash.noFreeCashPoint', 'No hay cajas libres en este momento.')}
                </div>
              )}
            </div>
            {taken.length > 0 && (
              <div className="field" style={{ marginBottom: 12 }}>
                <label className="field-label">{t('cash.inUse', 'En uso ahora')}</label>
                {taken.map(c => (
                  <div key={c.id} className="detail-row">
                    <span>{c.branchName} · {c.code}</span>
                    <span className="muted">{c.openUserName || t('cash.otherUser', 'otro usuario')}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="field">
              <label className="field-label">{t('cash.openingAmount', 'Fondo inicial (Q)')}</label>
              <input className="field-input mono" type="number" min="0" step="0.01"
                value={openingAmount} onChange={e => setOpening(e.target.value)} />
            </div>
          </div>
          <div className="modal-foot">
            <Button type="button" onClick={onClose}>{t('common.cancel', 'Cancelar')}</Button>
            <Button icon="cash" variant="accent" type="submit">{t('cash.open', 'Abrir caja')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal: Cierre de caja ────────────────────────────────────────────────────
function CloseModal({ register, onSave, onClose }) {
  const { t } = useTranslation();
  const expectedCash = register.openingAmount + register.salesCash - register.refunds;
  const [counted, setCounted] = useState(String(expectedCash.toFixed(2)));
  const countedNum = parseFloat(counted) || 0;
  const diff = countedNum - expectedCash;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ closingAmount: countedNum, diff });
  };

  const METHOD_ROWS = [
    { label: t('cash.salesCash', 'Efectivo en ventas'),        val: register.salesCash, color: '' },
    { label: t('cash.salesCard', 'Tarjeta / transferencia'),   val: register.salesCard, color: 'var(--accent)' },
    { label: t('cash.refunds', 'Devoluciones'),                val: -register.refunds,  color: 'var(--danger)' },
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h3>{t('cash.close', 'Cerrar caja')}</h3>
            <div className="muted" style={{ fontSize: 12 }}>{register.branch} · {register.cashPoint} · {register.cashier}</div>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Resumen del turno */}
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <div style={{ fontWeight: 500, fontSize: 12, marginBottom: 10, color: 'var(--muted)' }}>{t('cash.shiftSummary', 'RESUMEN DEL TURNO')}</div>
              {METHOD_ROWS.map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 14, color: 'var(--text)' }}>{row.label}</span>
                  <span className="mono" style={{ fontWeight: 500, color: row.color || 'var(--text)' }}>{fmt(Math.abs(row.val))}</span>
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--border)', marginTop: 10, paddingTop: 10, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 500 }}>{t('cash.totalSales', 'Total ventas')}</span>
                <span className="mono" style={{ fontWeight: 500, fontSize: 16 }}>{fmt(register.salesTotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <span className="muted" style={{ fontSize: 12 }}>{t('cash.expectedCash', 'Efectivo esperado en caja')}</span>
                <span className="mono" style={{ fontSize: 12 }}>{fmt(expectedCash)}</span>
              </div>
            </div>

            {/* Efectivo contado */}
            <div className="field" style={{ marginBottom: 12 }}>
              <label className="field-label">{t('cash.countedCash', 'Efectivo contado (Q)')} *</label>
              <input className="field-input mono" type="number" min="0" step="0.01"
                value={counted} onChange={e => setCounted(e.target.value)} required autoFocus
                style={{ fontSize: 22, padding: '10px 12px' }} />
            </div>

            {/* Diferencia */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 8, background: diff === 0 ? 'var(--bg)' : diff > 0 ? 'rgba(var(--success-rgb,34,197,94),.08)' : 'rgba(var(--danger-rgb,239,68,68),.08)', border: '1px solid var(--border)' }}>
              <span style={{ fontWeight: 500, fontSize: 14 }}>{t('cash.difference', 'Diferencia')}</span>
              <span className="mono" style={{ fontWeight: 400, fontSize: 22, color: diff > 0 ? 'var(--success)' : diff < 0 ? 'var(--danger)' : 'var(--muted)' }}>
                {diff >= 0 ? '+' : ''}{fmt(diff)}
              </span>
            </div>
            {diff !== 0 && (
              <div className="muted" style={{ fontSize: 11, marginTop: 6, textAlign: 'right' }}>
                {diff > 0
                  ? t('cash.surplus', 'Sobrante — revisar ventas tarjeta no registradas')
                  : t('cash.shortage', 'Faltante — se registrará en el corte')}
              </div>
            )}
          </div>
          <div className="modal-foot">
            <Button type="button" onClick={onClose}>{t('common.cancel', 'Cancelar')}</Button>
            <Button icon="check" variant="accent" type="submit">{t('cash.close', 'Cerrar caja')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Detalle de un turno abierto.
 *
 * Lo que un supervisor quiere saber sin ir al POS: cuánto lleva vendido, por
 * qué medio entró, cuánto debería haber en la gaveta si cerrara ahora y qué
 * ventas lo componen.
 */
function TurnoDrawer({ register, onClose, onCerrar }) {
  const { t } = useTranslation();
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    getCashRegisterDetail(register.id)
      .then((d) => { if (vigente) setDatos(d); })
      .catch(() => { if (vigente) setDatos(null); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [register.id]);

  const r = datos?.register;
  const cifra = (etiqueta, valor, tono) => (
    <div className="turno-cifra">
      <span>{etiqueta}</span>
      <strong className="mono" style={tono ? { color: tono } : undefined}>{valor}</strong>
    </div>
  );

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer drawer--wide">
        <div className="drawer-head">
          <div>
            <div className="drawer-title">{register.branch} · {register.cashPoint}</div>
            <div className="muted body-small">
              {register.cashier} · {t('cash.since', 'desde')} {register.openedAt}
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label={t('common.close', 'Cerrar')}>
            <Icon name="close" />
          </button>
        </div>

        <div className="drawer-body">
          {cargando && <div className="muted body-small">{t('common.loading', 'Cargando…')}</div>}

          {!cargando && !datos && (
            <div className="empty" style={{ padding: 20 }}>
              {t('cash.detailFailed', 'No se pudo cargar el detalle del turno.')}
            </div>
          )}

          {!cargando && datos && (<>
            <div className="turno-grid">
              {cifra(t('cash.opening', 'Fondo de apertura'), fmt(r.openingAmount))}
              {cifra(t('cash.shiftSales', 'Ventas del turno'), fmt(r.salesTotal))}
              {cifra(t('cash.tickets', 'Tickets'), datos.ticketCount)}
              {cifra(t('cash.avgTicket', 'Ticket promedio'), fmt(datos.averageTicket))}
            </div>

            <div className="quote-subsection-title" style={{ marginTop: 18 }}>
              {t('cash.byMethod', 'Por medio de pago')}
            </div>
            <div className="turno-grid">
              {cifra(t('cash.cash', 'Efectivo'), fmt(r.salesCash))}
              {cifra(t('cash.card', 'Tarjeta'), fmt(r.salesCard))}
              {cifra(t('cash.otherMethods', 'Otros medios'), fmt(datos.otherTotal))}
              {cifra(t('cash.refunds', 'Devoluciones'), fmt(r.refunds))}
            </div>

            {/* La cifra que de verdad importa al cerrar: contra esto se compara
                el dinero contado en la gaveta. */}
            <div className="turno-esperado">
              <div>
                <span>{t('cash.expectedCash', 'Efectivo esperado en caja')}</span>
                <small>
                  {t('cash.expectedHint', 'Fondo de apertura + efectivo vendido − devoluciones')}
                </small>
              </div>
              <strong className="mono">{fmt(datos.expectedCash)}</strong>
            </div>

            <div className="cfg-hint" style={{ marginTop: 12 }}>
              {t('cash.creditHint', 'Las ventas al crédito no entran: de esas no ingresó dinero a la gaveta. Se contarán cuando se cobren, con su propio recibo.')}
            </div>

            <div className="quote-subsection-title" style={{ marginTop: 18 }}>
              {t('cash.lastSales', 'Últimas ventas')}
            </div>
            <table className="mtable">
              <thead><tr>
                <th>{t('cash.doc', 'Documento')}</th>
                <th>{t('common.date', 'Fecha')}</th>
                <th>{t('projects.method', 'Método')}</th>
                <th className="r">{t('projects.amount', 'Monto')}</th>
              </tr></thead>
              <tbody>
                {(datos.lastSales || []).length === 0 && (
                  <tr><td colSpan={4}><div className="empty" style={{ padding: 16 }}>
                    {t('cash.noSales', 'Sin ventas en este turno')}
                  </div></td></tr>
                )}
                {(datos.lastSales || []).map((v) => (
                  <tr key={v.id}>
                    <td><span className="sku">{v.docNumber}</span></td>
                    <td className="muted">{fmtDateTime(v.createdAt)}</td>
                    <td><span className="badge-m3">{etiquetaMetodoPago(v.paymentMethod, t)}</span></td>
                    <td className="r num">{fmt(v.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {datos.ticketCount > (datos.lastSales || []).length && (
              <div className="muted body-small" style={{ marginTop: 8 }}>
                {t('cash.showingLast', 'Mostrando las últimas')} {(datos.lastSales || []).length} {t('common.of', 'de')} {datos.ticketCount}.
              </div>
            )}
          </>)}
        </div>

        <div className="drawer-foot">
          <Button onClick={onClose}>{t('common.close', 'Cerrar')}</Button>
          <Button icon="x" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
            onClick={() => { onClose(); onCerrar(register); }}>
            {t('cash.close', 'Cerrar caja')}
          </Button>
        </div>
      </div>
    </>
  );
}

// ── Tarjeta de caja abierta ──────────────────────────────────────────────────
function CajaCard({ register, onClose, onOpenDetail }) {
  const { t } = useTranslation();
  // El transcurrido se recalcula solo. Antes se computaba una vez al renderizar
  // y se quedaba congelado en «0 min» hasta que algo más provocara otro render.
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  /**
   * Antes salía de la hora del TEXTO ya formateado y solo con hora y minuto:
   * un turno abierto a las 22:00 y visto a las 08:00 daba −840 min. Ahora se
   * calcula sobre el instante real que manda el backend.
   */
  const elapsed = (() => {
    if (!register.openedAtISO) return null;
    const inicio = new Date(register.openedAtISO).getTime();
    if (Number.isNaN(inicio)) return null;
    const min = Math.max(0, Math.floor((ahora - inicio) / 60000));
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    return h < 24 ? `${h} h ${min % 60} min` : `${Math.floor(h / 24)} d ${h % 24} h`;
  })();

  // La tarjeta entera abre el detalle; el botón de cerrar caja detiene la
  // propagación para que un solo clic no haga las dos cosas.
  return (
    <div
      className="stat-card caja-card--click"
      style={{ position: 'relative' }}
      role="button"
      tabIndex={0}
      onClick={() => onOpenDetail(register)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenDetail(register); } }}
    >
      <div className="caja-card-head">
        <div className="caja-card-title">
          <div className="nombre" title={`${register.branch} · ${register.cashPoint}`}>
            {register.branch} · {register.cashPoint}
          </div>
          <div className="detalle">
            {register.cashier} · {t('cash.since', 'desde')} {register.openedAt.split(' ')[1] || register.openedAt}
          </div>
        </div>
        <span className="badge-m3 success">{t('cash.open', 'Abierta')}{elapsed ? ` · ${elapsed}` : ''}</span>
      </div>
      <div className="caja-card-cifras">
        <div>
          <div className="label" style={{ fontSize: 11 }}>{t('cash.shiftSales', 'Ventas turno')}</div>
          <div className="mono" style={{ fontWeight: 400, fontSize: 22 }}>{fmt(register.salesTotal)}</div>
        </div>
        <div>
          <div className="label" style={{ fontSize: 11 }}>{t('cash.cash', 'Efectivo')}</div>
          <div className="mono" style={{ fontSize: 16 }}>{fmt(register.salesCash)}</div>
        </div>
        <div>
          <div className="label" style={{ fontSize: 11 }}>{t('cash.card', 'Tarjeta')}</div>
          <div className="mono" style={{ fontSize: 16 }}>{fmt(register.salesCard)}</div>
        </div>
      </div>
      <div className="caja-card-pie">
        <div className="caja-card-barra">
          <span style={{ width: `${Math.min(100, (register.salesTotal / 20000) * 100)}%` }} />
        </div>
        <Button icon="x" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={(e) => { e.stopPropagation(); onClose(register); }}>{t('cash.close', 'Cerrar caja')}
        </Button>
      </div>
    </div>
  );
}

// ── Módulo principal ─────────────────────────────────────────────────────────
export default function CashRegister({ pushToast }) {
  const { t } = useTranslation();
  const { items: registersRaw, reload } = useCashRegisters();
  const { items: cashPoints, reload: reloadPoints } = useCashPoints();
  const { items: pending, reload: reloadPending } = usePendingRegisters();
  const { items: BRANCHES } = useBranches();
  const user = useMemo(() => sessionUser(), []);
  const registers = useMemo(() => registersRaw.map((r) => mapRegister(r, user)), [registersRaw, user]);
  const [tab, setTab]             = useState('turno');
  const [showOpen, setShowOpen]   = useState(false);
  const [closing, setClosing]     = useState(null);
  const [detalle, setDetalle]     = useState(null);
  const [histSearch, setSearch]   = useState('');

  const openRegisters  = useMemo(() => registers.filter(r => r.status === 'open'), [registers]);
  const closedRegisters = useMemo(() => {
    let c = registers.filter(r => r.status === 'closed');
    if (histSearch) {
      const q = histSearch.toLowerCase();
      c = c.filter(r => r.branch.toLowerCase().includes(q) || r.cashier.toLowerCase().includes(q)
        || (r.cashPoint || '').toLowerCase().includes(q));
    }
    return c.sort((a, b) => b.id - a.id);
  }, [registers, histSearch]);

  const handleOpen = async ({ cashPointId, openingAmount }) => {
    const cp = cashPoints.find(c => c.id === cashPointId);
    try {
      await openCashRegister({ cashPointId, userId: user?.id ?? null, openingAmount });
      await Promise.all([reload(), reloadPoints(), reloadPending()]);
      setShowOpen(false);
      pushToast?.(`Caja ${cp?.code || ''} abierta en ${cp?.branchName || ''}`, 'success');
    } catch (err) {
      // El backend devuelve 409 con el motivo: caja ocupada, turno de ayer
      // sin cerrar, o el cajero ya tiene otra caja abierta.
      pushToast?.(err.message, 'danger');
    }
  };

  const handleClose = async ({ closingAmount }) => {
    try {
      await closeCashRegister(closing.id, { closingAmount });
      await reload();
      setClosing(null);
      pushToast?.(t('cash.closedSuccess', 'Caja cerrada correctamente'), 'success');
    } catch (err) {
      pushToast?.('No se pudo cerrar la caja: ' + err.message, 'danger');
    }
  };

  const totalSalesOpen = openRegisters.reduce((s, r) => s + r.salesTotal, 0);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('cash.title', 'Caja & Cortes')}</h1>
          <div className="page-subtitle">
            {openRegisters.length}{' '}
            {openRegisters.length === 1
              ? t('cash.openRegisterOne', 'caja abierta')
              : t('cash.openRegisterMany', 'cajas abiertas')}
            {' · '}{t('cash.activeShiftTotal', 'Total turno activo')}{' '}
            <span className="mono">{fmt(totalSalesOpen)}</span>
          </div>
        </div>
        <div className="page-head-actions">
          <Button icon="plus" variant="accent" onClick={() => setShowOpen(true)}>{t('cash.open', 'Abrir caja')}
          </Button>
        </div>
      </div>

      {/* Stats */}
      {pending.length > 0 && (
        <div className="alert" style={{ marginBottom: 16 }}>
          <Icon name="alert" size={18} />
          <div>
            <strong>
              {pending.length === 1
                ? t('cash.pendingOne', 'Hay un turno de un día anterior sin cerrar')
                : t('cash.pendingMany', 'Hay turnos de días anteriores sin cerrar')}
            </strong>
            <div className="body-small">
              {pending.map(p => `${p.cashPointCode || '—'} · ${p.businessDate} · ${p.userName || '—'}`).join(' | ')}
              {' — '}
              {t('cash.pendingHint', 'Esas cajas no se pueden reabrir hasta cuadrar el arqueo de su día.')}
            </div>
          </div>
        </div>
      )}

      <div className="stat-grid">
        <StatCard
          icon="cash" tone="pri"
          label={t('cash.openRegisters', 'Cajas abiertas')}
          value={openRegisters.length}
          foot={t('cash.ofActiveBranches', 'de {{count}} sucursales activas', { count: BRANCHES.filter(b => b.status === 'active').length })}
        />
        <StatCard
          icon="chart" tone="ter"
          label={t('cash.activeShiftSales', 'Ventas turno activo')}
          value={fmt(totalSalesOpen)}
          foot={openRegisters.reduce((s, r) => s + r.salesCash, 0) > 0 ? `${fmt(openRegisters.reduce((s, r) => s + r.salesCash, 0))} ${t('cash.cash', 'efectivo')}` : '—'}
        />
        <StatCard
          icon="receipt" tone="sec"
          label={t('cash.closuresToday', 'Cortes hoy')}
          value={closedRegisters.filter(r => r.closedAt?.startsWith(hoyISO())).length}
          foot={t('cash.dayClosures', 'Cierres del día')}
        />
        <StatCard
          icon="alert" tone="err"
          label={t('cash.detectedDiffs', 'Diferencias detectadas')}
          valueColor={closedRegisters.some(r => r.diff && r.diff !== 0) ? 'var(--warning)' : undefined}
          value={closedRegisters.filter(r => r.diff && r.diff !== 0).length}
          foot={t('cash.inLastClosures', 'En los últimos cortes')}
        />
      </div>

      {/* Tabs */}
      <div className="tabs">
        <div className={`tab ${tab === 'turno' ? 'active' : ''}`} onClick={() => setTab('turno')}>
          {t('cash.tabs.current', 'Turno actual')} <span className="count">{openRegisters.length}</span>
        </div>
        <div className={`tab ${tab === 'historial' ? 'active' : ''}`} onClick={() => setTab('historial')}>
          {t('cash.historyTab', 'Historial de cortes')} <span className="count">{closedRegisters.length}</span>
        </div>
      </div>

      {tab === 'turno' && (
        <>
          {openRegisters.length === 0 ? (
            <div className="empty" style={{ padding: '60px 20px' }}>
              <Icon name="cash" size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
              <div style={{ fontWeight: 500, marginBottom: 4 }}>{t('cash.noOpenRegisters', 'No hay cajas abiertas')}</div>
              <div className="muted" style={{ fontSize: 14, marginBottom: 20 }}>{t('cash.noOpenRegistersHint', 'Abre una caja para comenzar a registrar ventas')}</div>
              <Button icon="plus" variant="accent" onClick={() => setShowOpen(true)}>{t('cash.open', 'Abrir caja')}
              </Button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
              {openRegisters.map(r => (
                <CajaCard key={r.id} register={r} onClose={setClosing} onOpenDetail={setDetalle} />
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'historial' && (
        <>
          <div className="toolbar">
            <div className="search-wrap" style={{ flex: 1, maxWidth: 300 }}>
              <Icon name="search" className="icon" size={13} />
              <input className="search-input" placeholder={t('cash.searchPlaceholder', 'Buscar por sucursal o cajero…')}
                value={histSearch} onChange={e => setSearch(e.target.value)} />
            </div>
            <span className="muted" style={{ fontSize: 12 }}>{closedRegisters.length} {t('cash.cutLabel', 'corte')}{closedRegisters.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('common.branch', 'Sucursal')}</th>
                  <th>{t('cash.cashPoint', 'Caja')}</th>
                  <th>{t('cash.cashier', 'Cajero')}</th>
                  <th>{t('cash.opening', 'Apertura')}</th>
                  <th>{t('cash.closing', 'Cierre')}</th>
                  <th className="right">{t('cash.openingAmount', 'Fondo inicial')}</th>
                  <th className="right">{t('cash.totalSales', 'Ventas totales')}</th>
                  <th className="right">{t('cash.countedCash', 'Efectivo contado')}</th>
                  <th className="right">{t('cash.difference', 'Diferencia')}</th>
                </tr>
              </thead>
              <tbody>
                {closedRegisters.length === 0 ? (
                  <tr><td colSpan={8} className="empty">{t('cash.noCuts', 'Sin cortes registrados')}</td></tr>
                ) : closedRegisters.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 500 }}>{r.branch}</td>
                    <td>{r.cashPoint}</td>
                    <td className="muted">{r.cashier}</td>
                    <td className="mono muted">{r.openedAt}</td>
                    <td className="mono muted">{r.closedAt || '—'}</td>
                    <td className="right mono muted">{fmt(r.openingAmount)}</td>
                    <td className="right mono">{fmt(r.salesTotal)}</td>
                    <td className="right mono">{r.closingAmount != null ? fmt(r.closingAmount) : '—'}</td>
                    <td className="right">
                      {r.diff != null ? (
                        <span className="mono" style={{ color: r.diff > 0 ? 'var(--success)' : r.diff < 0 ? 'var(--danger)' : 'var(--muted)', fontWeight: 500 }}>
                          {r.diff >= 0 ? '+' : ''}{fmt(r.diff)}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showOpen && (
        <OpenModal cashPoints={cashPoints} onSave={handleOpen} onClose={() => setShowOpen(false)} />
      )}

      {detalle && (
        <TurnoDrawer register={detalle} onClose={() => setDetalle(null)} onCerrar={setClosing} />
      )}

      {closing && (
        <CloseModal register={closing} onSave={handleClose} onClose={() => setClosing(null)} />
      )}
    </div>
  );
}
