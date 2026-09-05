// Stackline — Módulo de Cierre de Caja
// Data-driven: /api/cash-registers (open/close). El backend calcula ventas/efectivo/
// tarjeta/diferencia a partir de las ventas de la caja.
import React, { useState, useMemo } from 'react';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import StatCard from '../components/StatCard.jsx';
import { useCashRegisters, useCashPoints, usePendingRegisters } from '../hooks/useOperations.js';
import { useBranches } from '../hooks/useMasters.js';
import { openCashRegister, closeCashRegister } from '../api/pos.js';
import { sessionUser } from '../api/auth.js';
import { useTranslation } from 'react-i18next';

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
              <select className="field-input" value={cashPointId} onChange={e => setCashPointId(e.target.value)} required>
                <option value="">{t('cash.selectCashPoint', 'Seleccionar caja…')}</option>
                {free.map(c => (
                  <option key={c.id} value={c.id}>{c.branchName} · {c.code} — {c.name}</option>
                ))}
              </select>
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
          <div style={{ fontWeight: 500, fontSize: 16 }}>{register.branch} · {register.cashPoint}</div>
          <div className="muted" style={{ fontSize: 12 }}>{register.cashier} · {t('cash.since', 'desde')} {register.openedAt.split(' ')[1]}</div>
        </div>
        <span className="badge-m3 success">{t('cash.open', 'Abierta')} · {elapsed}</span>
      </div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(100, (register.salesTotal / 20000) * 100)}%`, background: 'var(--accent)', borderRadius: 2 }} />
        </div>
        <Button icon="x" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => onClose(register)}>{t('cash.close', 'Cerrar caja')}
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
      pushToast?.(err.message, 'error');
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
          value={closedRegisters.filter(r => r.closedAt?.startsWith(new Date().toISOString().slice(0, 10))).length}
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

      {closing && (
        <CloseModal register={closing} onSave={handleClose} onClose={() => setClosing(null)} />
      )}
    </div>
  );
}
