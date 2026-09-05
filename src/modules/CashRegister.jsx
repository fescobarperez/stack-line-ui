// Stackline — Módulo de Cierre de Caja
// Data-driven: /api/cash-registers (open/close). El backend calcula ventas/efectivo/
// tarjeta/diferencia a partir de las ventas de la caja.
import React, { useState, useMemo } from 'react';
import Icon from '../components/Icon.jsx';
import { useCashRegisters } from '../hooks/useOperations.js';
import { useBranches } from '../hooks/useMasters.js';
import { openCashRegister, closeCashRegister } from '../api/pos.js';
import { useTranslation } from 'react-i18next';

function fmt(n) { return `Q ${Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

function pad(n) { return String(n).padStart(2, '0'); }
function fmtDateTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Usuario de la sesión (para el userId de la caja y mostrar el cajero).
function sessionUser() {
  try { return JSON.parse(sessionStorage.getItem('maya_session'))?.user || null; } catch { return null; }
}

// Backend CashRegister.Response → forma de la UI.
function mapRegister(r, user) {
  const cashier = user && user.id === r.userId ? user.name : (r.userId ? `Usuario ${r.userId}` : '—');
  return {
    id: r.id,
    branchId: r.branchId,
    branch: r.branchName || '—',
    cashier,
    openedAt: fmtDateTime(r.openedAt) || '',
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
function OpenModal({ branches, onSave, onClose }) {
  const { t } = useTranslation();
  const [branchId, setBranchId]       = useState('');
  const [openingAmount, setOpening]   = useState('500.00');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!branchId) return;
    onSave({ branchId: Number(branchId), openingAmount: parseFloat(openingAmount) || 0 });
  };

  const availableBranches = branches.filter(b => b.status !== 'paused');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">{t('cash.open', 'Abrir caja')}</div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="field" style={{ marginBottom: 12 }}>
              <label className="field-label">{t('common.branch', 'Sucursal')} *</label>
              <select className="field-input" value={branchId} onChange={e => setBranchId(e.target.value)} required>
                <option value="">{t('cash.selectBranch', 'Seleccionar sucursal…')}</option>
                {availableBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field-label">{t('cash.openingAmount', 'Fondo inicial (Q)')}</label>
              <input className="field-input mono" type="number" min="0" step="0.01"
                value={openingAmount} onChange={e => setOpening(e.target.value)} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose}>{t('common.cancel', 'Cancelar')}</button>
            <button type="submit" className="btn accent">
              <Icon name="cash" size={12} />{t('cash.open', 'Abrir caja')}
            </button>
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
            <div className="modal-title">{t('cash.close', 'Cerrar caja')}</div>
            <div className="muted" style={{ fontSize: 12 }}>{register.branch} · {register.cashier}</div>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Resumen del turno */}
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 10, color: 'var(--muted)' }}>{t('cash.shiftSummary', 'RESUMEN DEL TURNO')}</div>
              {METHOD_ROWS.map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: 'var(--text)' }}>{row.label}</span>
                  <span className="mono" style={{ fontWeight: 600, color: row.color || 'var(--text)' }}>{fmt(Math.abs(row.val))}</span>
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--border)', marginTop: 10, paddingTop: 10, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600 }}>{t('cash.totalSales', 'Total ventas')}</span>
                <span className="mono" style={{ fontWeight: 700, fontSize: 16 }}>{fmt(register.salesTotal)}</span>
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
                style={{ fontSize: 20, padding: '10px 12px' }} />
            </div>

            {/* Diferencia */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 8, background: diff === 0 ? 'var(--bg)' : diff > 0 ? 'rgba(var(--success-rgb,34,197,94),.08)' : 'rgba(var(--danger-rgb,239,68,68),.08)', border: '1px solid var(--border)' }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{t('cash.difference', 'Diferencia')}</span>
              <span className="mono" style={{ fontWeight: 700, fontSize: 18, color: diff > 0 ? 'var(--success)' : diff < 0 ? 'var(--danger)' : 'var(--muted)' }}>
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
          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose}>{t('common.cancel', 'Cancelar')}</button>
            <button type="submit" className="btn accent">
              <Icon name="check" size={12} />{t('cash.close', 'Cerrar caja')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Tarjeta de caja abierta ──────────────────────────────────────────────────
function CajaCard({ register, onClose }) {
  const { t } = useTranslation();
  const elapsed = (() => {
    const [h, m] = register.openedAt.split(' ')[1].split(':').map(Number);
    const now = new Date();
    const diffMin = (now.getHours() * 60 + now.getMinutes()) - (h * 60 + m);
    return diffMin < 60 ? `${diffMin} min` : `${Math.floor(diffMin / 60)}h ${diffMin % 60}min`;
  })();

  return (
    <div className="stat-card" style={{ position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{register.branch}</div>
          <div className="muted" style={{ fontSize: 12 }}>{register.cashier} · {t('cash.since', 'desde')} {register.openedAt.split(' ')[1]}</div>
        </div>
        <span className="pill success">{t('cash.open', 'Abierta')} · {elapsed}</span>
      </div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
        <div>
          <div className="label" style={{ fontSize: 10 }}>{t('cash.shiftSales', 'Ventas turno')}</div>
          <div className="mono" style={{ fontWeight: 700, fontSize: 18 }}>{fmt(register.salesTotal)}</div>
        </div>
        <div>
          <div className="label" style={{ fontSize: 10 }}>{t('cash.cash', 'Efectivo')}</div>
          <div className="mono" style={{ fontSize: 15 }}>{fmt(register.salesCash)}</div>
        </div>
        <div>
          <div className="label" style={{ fontSize: 10 }}>{t('cash.card', 'Tarjeta')}</div>
          <div className="mono" style={{ fontSize: 15 }}>{fmt(register.salesCard)}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(100, (register.salesTotal / 20000) * 100)}%`, background: 'var(--accent)', borderRadius: 2 }} />
        </div>
        <button className="btn" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => onClose(register)}>
          <Icon name="x" size={12} />{t('cash.close', 'Cerrar caja')}
        </button>
      </div>
    </div>
  );
}

// ── Módulo principal ─────────────────────────────────────────────────────────
export default function CashRegister({ pushToast }) {
  const { t } = useTranslation();
  const { items: registersRaw, reload } = useCashRegisters();
  const { items: BRANCHES } = useBranches();
  const user = useMemo(() => sessionUser(), []);
  const registers = useMemo(() => registersRaw.map((r) => mapRegister(r, user)), [registersRaw, user]);
  const [tab, setTab]             = useState('turno');
  const [showOpen, setShowOpen]   = useState(false);
  const [closing, setClosing]     = useState(null);
  const [histSearch, setSearch]   = useState('');

  const openRegisters  = useMemo(() => registers.filter(r => r.status === 'open'), [registers]);
  const closedRegisters = useMemo(() => {
    let c = registers.filter(r => r.status === 'closed');
    if (histSearch) {
      const q = histSearch.toLowerCase();
      c = c.filter(r => r.branch.toLowerCase().includes(q) || r.cashier.toLowerCase().includes(q));
    }
    return c.sort((a, b) => b.id - a.id);
  }, [registers, histSearch]);

  const handleOpen = async ({ branchId, openingAmount }) => {
    const br = BRANCHES.find(b => b.id === branchId);
    try {
      await openCashRegister({ branchId, userId: user?.id ?? null, openingAmount });
      await reload();
      setShowOpen(false);
      pushToast?.(`Caja abierta en ${br?.name || ''}`, 'success');
    } catch (err) {
      pushToast?.('No se pudo abrir la caja: ' + err.message, 'error');
    }
  };

  const handleClose = async ({ closingAmount }) => {
    try {
      await closeCashRegister(closing.id, { closingAmount });
      await reload();
      setClosing(null);
      pushToast?.(t('cash.closedSuccess', 'Caja cerrada correctamente'), 'success');
    } catch (err) {
      pushToast?.('No se pudo cerrar la caja: ' + err.message, 'error');
    }
  };

  const totalSalesOpen = openRegisters.reduce((s, r) => s + r.salesTotal, 0);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('cash.title', 'Caja & Cortes')}</h1>
          <div className="page-subtitle">
            {openRegisters.length} {t('cash.openRegistersLabel', 'caja{openRegisters.length !== 1 ? "s" : ""} abierta{openRegisters.length !== 1 ? "s" : ""}')}
            {openRegisters.length !== 1 ? 's' : ''} {t('cash.openSuffix', 'abierta')}{openRegisters.length !== 1 ? 's' : ''} · {t('cash.activeShiftTotal', 'Total turno activo')} <span className="mono">{fmt(totalSalesOpen)}</span>
          </div>
        </div>
        <div className="page-head-actions">
          <button className="btn accent" onClick={() => setShowOpen(true)}>
            <Icon name="plus" size={12} />{t('cash.open', 'Abrir caja')}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <div className="stat">
          <div className="label"><Icon name="cash" size={11} />{t('cash.openRegisters', 'Cajas abiertas')}</div>
          <div className="val mono">{openRegisters.length}</div>
          <div className="delta muted">{t('cash.ofActiveBranches', 'de {{count}} sucursales activas', { count: BRANCHES.filter(b => b.status === 'active').length })}</div>
        </div>
        <div className="stat">
          <div className="label"><Icon name="chart" size={11} />{t('cash.activeShiftSales', 'Ventas turno activo')}</div>
          <div className="val mono">{fmt(totalSalesOpen)}</div>
          <div className="delta muted">{openRegisters.reduce((s, r) => s + r.salesCash, 0) > 0 ? `${fmt(openRegisters.reduce((s, r) => s + r.salesCash, 0))} ${t('cash.cash', 'efectivo')}` : '—'}</div>
        </div>
        <div className="stat">
          <div className="label"><Icon name="receipt" size={11} />{t('cash.closuresToday', 'Cortes hoy')}</div>
          <div className="val mono">{closedRegisters.filter(r => r.closedAt?.startsWith(new Date().toISOString().slice(0, 10))).length}</div>
          <div className="delta muted">{t('cash.dayClosures', 'Cierres del día')}</div>
        </div>
        <div className="stat">
          <div className="label"><Icon name="alert" size={11} />{t('cash.detectedDiffs', 'Diferencias detectadas')}</div>
          <div className="val mono" style={{ color: closedRegisters.some(r => r.diff && r.diff !== 0) ? 'var(--warning)' : undefined }}>
            {closedRegisters.filter(r => r.diff && r.diff !== 0).length}
          </div>
          <div className="delta muted">{t('cash.inLastClosures', 'En los últimos cortes')}</div>
        </div>
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
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{t('cash.noOpenRegisters', 'No hay cajas abiertas')}</div>
              <div className="muted" style={{ fontSize: 13, marginBottom: 20 }}>{t('cash.noOpenRegistersHint', 'Abre una caja para comenzar a registrar ventas')}</div>
              <button className="btn accent" onClick={() => setShowOpen(true)}>
                <Icon name="plus" size={12} />{t('cash.open', 'Abrir caja')}
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
              {openRegisters.map(r => (
                <CajaCard key={r.id} register={r} onClose={setClosing} />
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
                    <td className="muted">{r.cashier}</td>
                    <td className="mono muted">{r.openedAt}</td>
                    <td className="mono muted">{r.closedAt || '—'}</td>
                    <td className="right mono muted">{fmt(r.openingAmount)}</td>
                    <td className="right mono">{fmt(r.salesTotal)}</td>
                    <td className="right mono">{r.closingAmount != null ? fmt(r.closingAmount) : '—'}</td>
                    <td className="right">
                      {r.diff != null ? (
                        <span className="mono" style={{ color: r.diff > 0 ? 'var(--success)' : r.diff < 0 ? 'var(--danger)' : 'var(--muted)', fontWeight: 600 }}>
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
        <OpenModal branches={BRANCHES} onSave={handleOpen} onClose={() => setShowOpen(false)} />
      )}

      {closing && (
        <CloseModal register={closing} onSave={handleClose} onClose={() => setClosing(null)} />
      )}
    </div>
  );
}
