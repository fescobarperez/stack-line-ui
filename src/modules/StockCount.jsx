// Stackline — Conteo Físico de Inventario
import React, { useState, useMemo } from 'react';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import StatCard from '../components/StatCard.jsx';
import { useTranslation } from 'react-i18next';
import { useStockCounts, mapSession } from '../hooks/useStockCount.js';
import { useBranches } from '../hooks/useMasters.js';
import { createStockCount, saveStockCountCounts, closeStockCount, getStockCount } from '../api/wave2.js';

const Q = v => `Q ${v.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS_LABEL = { in_progress: 'En progreso', review: 'En revisión', completed: 'Completado', cancelled: 'Cancelado', scheduled: 'Programado' };
const STATUS_CLASS = { in_progress: 'info', review: 'warning', completed: 'success', cancelled: 'danger', scheduled: 'neutral' };
const CATS = ['all', 'abarrotes', 'bebidas', 'lacteos', 'limpieza', 'higiene', 'snacks'];
const CAT_LABEL = { all: 'Todas las categorías', abarrotes: 'Abarrotes', bebidas: 'Bebidas', lacteos: 'Lácteos', limpieza: 'Limpieza', higiene: 'Higiene', snacks: 'Snacks' };

function sessionProgress(s) {
  const total = s.lines.length;
  const done  = s.lines.filter(l => l.countedQty !== null).length;
  return { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
}

function sessionDiscrepancies(lines) {
  return lines.filter(l => l.countedQty !== null && l.countedQty !== l.systemQty);
}

export default function StockCount({ pushToast }) {
  const { t } = useTranslation();
  const { items: sessions, reload: reloadSessions } = useStockCounts();
  const { items: branches } = useBranches();
  const [tab, setTab]             = useState('active');
  const [selected, setSelected]   = useState(null);
  const [newModal, setNewModal]   = useState(false);
  const [lineFilter, setLineFilter] = useState('all'); // all | pending | diff

  // Stats
  const active     = sessions.filter(s => s.status === 'in_progress' || s.status === 'review');
  const completed  = sessions.filter(s => s.status === 'completed');
  const pending    = sessions.flatMap(s => s.status === 'in_progress' ? s.lines.filter(l => l.countedQty === null) : []).length;
  const totalDisc  = sessions.flatMap(s => sessionDiscrepancies(s.lines)).length;

  // Filtered lines in drawer
  const visibleLines = useMemo(() => {
    if (!selected) return [];
    return selected.lines.filter(l => {
      if (lineFilter === 'pending') return l.countedQty === null;
      if (lineFilter === 'diff')    return l.countedQty !== null && l.countedQty !== l.systemQty;
      return true;
    });
  }, [selected, lineFilter]);

  // Edición local del conteo abierto (se persiste al finalizar / aplicar ajustes).
  function updateCount(sessionId, sku, value) {
    const qty = value === '' ? null : parseInt(value);
    setSelected(prev => prev?.id === sessionId ? {
      ...prev,
      lines: prev.lines.map(l => l.sku === sku ? { ...l, countedQty: qty } : l),
    } : prev);
  }

  function updateNote(sessionId, sku, note) {
    setSelected(prev => prev?.id === sessionId ? {
      ...prev,
      lines: prev.lines.map(l => l.sku === sku ? { ...l, notes: note } : l),
    } : prev);
  }

  const countLines = (sess) => sess.lines.map(l => ({ itemId: l.itemId, countedQty: l.countedQty, lineNotes: l.notes }));

  async function finalizeCount(sess) {
    try {
      const full = await saveStockCountCounts(sess.backendId, { lines: countLines(sess), status: 'review' });
      setSelected(mapSession(full));
      reloadSessions();
      pushToast('Conteo enviado a revisión', 'success');
    } catch (err) { pushToast('No se pudo finalizar el conteo: ' + err.message, 'danger'); }
  }

  async function applyAdjustments(sess) {
    try {
      await saveStockCountCounts(sess.backendId, { lines: countLines(sess) });
      const closed = await closeStockCount(sess.backendId);
      const disc = closed.discrepancies ?? sessionDiscrepancies(sess.lines).length;
      setSelected(null);
      reloadSessions();
      pushToast(`${disc} ajustes de inventario aplicados`, 'success');
    } catch (err) { pushToast('No se pudo aplicar los ajustes: ' + err.message, 'danger'); }
  }

  async function handleCreate(session) {
    try {
      await createStockCount({
        branchId: session.branchId,
        responsible: session.responsible,
        category: session.category,
        categoryLabel: session.categoryLabel,
        notes: session.notes,
        countDate: session.date,
        items: [],
      });
      setNewModal(false);
      pushToast('Sesión creada — se tomó foto del stock de la sucursal', 'success');
      reloadSessions();
    } catch (err) { pushToast('No se pudo crear la sesión: ' + err.message, 'danger'); }
  }

  const activeSessions    = sessions.filter(s => ['in_progress', 'review', 'scheduled'].includes(s.status));
  const historySessions   = sessions.filter(s => ['completed', 'cancelled'].includes(s.status));

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('stockcount.title', 'Conteo Físico de Inventario')}</h1>
          <div className="page-subtitle">Sesiones de conteo · verificación de stock · ajustes por diferencia</div>
        </div>
        <div className="page-head-actions">
          <Button icon="plus" variant="accent" onClick={() => setNewModal(true)}>{t('stockcount.newCount', 'Nueva sesión')}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <StatCard
          icon="box" tone="pri"
          label="Sesiones activas"
          value={active.length}
          foot={<>{completed.length} completadas</>}
        />
        <StatCard
          icon="clock" tone="ter"
          label="Productos pendientes"
          valueColor={pending > 0 ? 'var(--warning)' : undefined}
          value={pending}
          foot="En sesiones en progreso"
        />
        <StatCard
          icon="alert" tone="sec"
          label="Discrepancias activas"
          valueColor={totalDisc > 0 ? 'var(--danger)' : undefined}
          value={totalDisc}
          foot="Productos con diferencia"
        />
        <StatCard
          icon="check" tone="err"
          label="Último conteo completo"
          value="30 abr"
          foot="CNT-2026-001 · Zona 10"
        />
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${tab === 'active' ? 'active' : ''}`} onClick={() => setTab('active')}>
          {t('stockcount.tabs.active', 'En progreso')} {active.length > 0 && <span className="count">{active.length}</span>}
        </button>
        <button className={`tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>
          {t('stockcount.tabs.history', 'Historial')}
        </button>
      </div>

      {tab === 'active' && (
        activeSessions.length === 0 ? (
          <div className="card" style={{ padding: '48px 16px', textAlign: 'center' }}>
            <Icon name="box" size={28} style={{ color: 'var(--muted)', marginBottom: 12 }} />
            <div style={{ fontWeight: 500, marginBottom: 4 }}>Sin sesiones activas</div>
            <div className="muted" style={{ fontSize: 14, marginBottom: 16 }}>Crea una nueva sesión para iniciar un conteo físico</div>
            <Button icon="plus" variant="accent" onClick={() => setNewModal(true)}>{t('stockcount.newCount', 'Nueva sesión')}</Button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {activeSessions.map(s => {
              const prog = sessionProgress(s);
              const disc = sessionDiscrepancies(s.lines);
              return (
                <div key={s.id} className="card" style={{ padding: '16px 20px', cursor: 'pointer' }} onClick={() => { setSelected(s); setLineFilter('all'); }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <span className="mono" style={{ fontWeight: 500, fontSize: 14 }}>{s.id}</span>
                        <span className={`badge-m3 ${STATUS_CLASS[s.status]}`}>{STATUS_LABEL[s.status]}</span>
                      </div>
                      <div style={{ fontSize: 14 }}>{s.branch} · {s.categoryLabel}</div>
                      <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{s.responsible} · {s.date}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 22, fontWeight: 400, fontFamily: 'var(--font-mono)' }}>
                        {prog.done}<span className="muted" style={{ fontSize: 14, fontWeight: 400 }}>/{prog.total}</span>
                      </div>
                      <div className="muted" style={{ fontSize: 11 }}>productos contados</div>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden', marginBottom: 10 }}>
                    <div style={{ height: '100%', width: `${prog.pct}%`, background: prog.pct === 100 ? 'var(--success)' : 'var(--accent)', borderRadius: 3, transition: 'width .3s' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                    <span className="muted">{prog.total - prog.done} pendientes</span>
                    {disc.length > 0 && (
                      <span style={{ color: 'var(--danger)', fontWeight: 500 }}>
                        <Icon name="alert" size={11} style={{ marginRight: 4 }} />
                        {disc.length} diferencia{disc.length !== 1 ? 's' : ''}
                      </span>
                    )}
                    {s.notes && <span className="muted" style={{ fontStyle: 'italic' }}>{s.notes}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {tab === 'history' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="tbl-wrap"><table className="tbl">
            <thead>
              <tr>
                <th>Sesión</th>
                <th>{t('common.branch', 'Sucursal')}</th>
                <th>{t('common.category', 'Categoría')}</th>
                <th>Responsable</th>
                <th>{t('common.date', 'Fecha')}</th>
                <th style={{ textAlign: 'right' }}>Productos</th>
                <th style={{ textAlign: 'right' }}>Diferencias</th>
                <th style={{ textAlign: 'right' }}>Uds. ajustadas</th>
                <th>{t('common.status', 'Estado')}</th>
              </tr>
            </thead>
            <tbody>
              {historySessions.length === 0 ? (
                <tr><td colSpan={9} className="empty">Sin conteos completados aún</td></tr>
              ) : historySessions.map(s => (
                <tr key={s.id}>
                  <td><span className="mono" style={{ fontWeight: 500, fontSize: 12 }}>{s.id}</span></td>
                  <td>{s.branch}</td>
                  <td>{s.categoryLabel}</td>
                  <td className="muted">{s.responsible}</td>
                  <td className="muted">{s.date}</td>
                  <td className="num">{s.lines.length || '35'}</td>
                  <td className="num" style={{ color: (s.discrepancies || 0)> 0 ? 'var(--danger)' : undefined }}>
                    {s.discrepancies ?? 0}
                  </td>
                  <td className="num">{s.adjustedQty ?? 0}</td>
                  <td><span className={`badge-m3 ${STATUS_CLASS[s.status]}`}>{STATUS_LABEL[s.status]}</span></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      {/* Drawer de conteo */}
      {selected && (
        <div className="drawer-overlay" onClick={() => setSelected(null)}>
          <div className="drawer" style={{ width: 680 }} onClick={e => e.stopPropagation()}>
            <div className="drawer-head">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="drawer-title">{selected.id}</div>
                  <span className={`badge-m3 ${STATUS_CLASS[selected.status]}`}>{STATUS_LABEL[selected.status]}</span>
                </div>
                <div className="muted" style={{ fontSize: 12 }}>{selected.branch} · {selected.categoryLabel} · {selected.responsible}</div>
              </div>
              <button className="icon-btn" onClick={() => setSelected(null)}><Icon name="close" /></button>
            </div>

            <div className="drawer-body" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1, overflow: 'hidden' }}>
              {/* Progreso */}
              {selected.status !== 'completed' && (() => {
                const prog = sessionProgress(selected);
                const disc = sessionDiscrepancies(selected.lines);
                return (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span className="muted">{prog.done} de {prog.total} productos contados ({prog.pct}%)</span>
                      {disc.length > 0 && <span style={{ color: 'var(--danger)', fontWeight: 500 }}>{disc.length} diferencia{disc.length !== 1 ? 's' : ''}</span>}
                    </div>
                    <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${prog.pct}%`, background: prog.pct === 100 ? 'var(--success)' : 'var(--accent)', borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })()}

              {/* Filtros de líneas */}
              {selected.status !== 'completed' && (
                <div style={{ display: 'flex', gap: 6 }}>
                  {[['all', t('common.all', 'Todos')], ['pending', 'Pendientes'], ['diff', 'Con diferencia']].map(([v, l]) => (
                    <button key={v} className={`chip ${lineFilter === v ? 'active' : ''}`} onClick={() => setLineFilter(v)}>{l}</button>
                  ))}
                </div>
              )}

              {/* Tabla de líneas */}
              <div style={{ flex: 1, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-2)', position: 'sticky', top: 0 }}>
                      {[t('common.product', 'Producto'), 'Cat.', 'Sistema', 'Contado', 'Diferencia', t('common.notes', 'Notas')].map((h, i) => (
                        <th key={h} style={{ padding: '7px 10px', textAlign: i>= 2 && i <= 4 ? 'center' : 'left', fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleLines.length === 0 ? (
                      <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>{t('common.noResults', 'Sin resultados')}</td></tr>
                    ) : visibleLines.map(line => {
                      const diff = line.countedQty !== null ? line.countedQty - line.systemQty : null;
                      const hasDiff = diff !== null && diff !== 0;
                      return (
                        <tr key={line.sku} style={{ borderBottom: '1px solid var(--border)', background: hasDiff ? (diff < 0 ? 'rgba(185,28,28,.04)' : 'rgba(21,128,61,.04)') : undefined }}>
                          <td style={{ padding: '8px 10px' }}>
                            <div style={{ fontWeight: 500 }}>{line.name}</div>
                            <div className="mono muted" style={{ fontSize: 11 }}>{line.sku}</div>
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <span className="badge-m3 info" style={{ textTransform: 'capitalize' }}>{line.cat}</span>
                          </td>
                          <td className="mono center" style={{ padding: '8px 10px', fontWeight: 500 }}>
                            {line.systemQty}
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                            {selected.status === 'in_progress' ? (
                              <input
                                type="number"
                                min="0"
                                value={line.countedQty ?? ''}
                                placeholder="—"
                                onChange={e => updateCount(selected.id, line.sku, e.target.value)}
                                style={{
                                  width: 68, textAlign: 'center',
                                  border: `1px solid ${hasDiff ? (diff < 0 ? 'var(--danger)' : 'var(--success)') : 'var(--border)'}`,
                                  borderRadius: 'var(--r-sm)', padding: '4px 6px',
                                  fontFamily: 'var(--font-mono)', fontSize: 12,
                                  background: 'var(--surface)', color: 'var(--text)', outline: 'none',
                                }}
                              />
                            ) : (
                              <span className="mono" style={{ fontWeight: 500 }}>{line.countedQty ?? '—'}</span>
                            )}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            {diff === null ? (
                              <span className="muted">—</span>
                            ) : diff === 0 ? (
                              <span style={{ color: 'var(--success)', fontFamily: 'var(--font-mono)' }}>✓</span>
                            ) : (
                              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, color: diff < 0 ? 'var(--danger)' : 'var(--success)' }}>
                                {diff > 0 ? '+' : ''}{diff}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '6px 10px', minWidth: 120 }}>
                            {selected.status === 'in_progress' ? (
                              <input
                                value={line.notes}
                                onChange={e => updateNote(selected.id, line.sku, e.target.value)}
                                placeholder={t('common.observations', 'Observaciones')}
                                style={{
                                  width: '100%', border: '1px solid var(--border)',
                                  borderRadius: 'var(--r-sm)', padding: '4px 8px',
                                  fontSize: 12, background: 'var(--surface)',
                                  color: 'var(--text)', outline: 'none',
                                }}
                              />
                            ) : (
                              <span className="muted" style={{ fontSize: 11 }}>{line.notes || '—'}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Resumen de discrepancias (en revisión) */}
              {selected.status === 'review' && (() => {
                const disc = sessionDiscrepancies(selected.lines);
                const impactQ = disc.reduce((s, l) => s + Math.abs(l.countedQty - l.systemQty) * l.cost, 0);
                return (
                  <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '12px 16px' }}>
                    <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 8 }}>Resumen de ajustes</div>
                    <div style={{ display: 'flex', gap: 24, fontSize: 14 }}>
                      <div>
                        <span className="muted" style={{ fontSize: 11, display: 'block' }}>Productos con diferencia</span>
                        <span style={{ fontWeight: 500, color: 'var(--danger)' }}>{disc.length}</span>
                      </div>
                      <div>
                        <span className="muted" style={{ fontSize: 11, display: 'block' }}>Unidades a ajustar</span>
                        <span style={{ fontWeight: 500, fontFamily: 'var(--font-mono)' }}>
                          {disc.reduce((s, l) => s + Math.abs(l.countedQty - l.systemQty), 0)}
                        </span>
                      </div>
                      <div>
                        <span className="muted" style={{ fontSize: 11, display: 'block' }}>Impacto en inventario</span>
                        <span style={{ fontWeight: 500, fontFamily: 'var(--font-mono)', color: 'var(--danger)' }}>
                          {Q(impactQ)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            {selected.status !== 'completed' && (
              <div className="drawer-foot">
                {selected.status === 'in_progress' && (
                  <>
                    <span className="muted" style={{ fontSize: 12 }}>
                      {sessionProgress(selected).total - sessionProgress(selected).done} productos sin contar
                    </span>
                    <Button icon="check" variant="accent" disabled={sessionProgress(selected).pct < 100} onClick={() => finalizeCount(selected)}>Finalizar conteo
                    </Button>
                  </>
                )}
                {selected.status === 'review' && (
                  <>
                    <Button variant="ghost" onClick={() => setSelected(null)}>{t('common.cancel', 'Cancelar')}</Button>
                    <Button icon="check" variant="accent" onClick={() => applyAdjustments(selected)}>Aplicar ajustes al inventario
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal nueva sesión */}
      {newModal && (
        <NewSessionModal branches={branches} onClose={() => setNewModal(false)} onSave={handleCreate} />
      )}
    </div>
  );
}

// ── Modal: nueva sesión de conteo ─────────────────────────────────────────────
function NewSessionModal({ branches = [], onClose, onSave }) {
  const { t } = useTranslation();
  const [date,        setDate]        = useState(new Date().toISOString().slice(0, 10));
  const [branchId,    setBranchId]    = useState('');
  const [category,    setCategory]    = useState('all');
  const [responsible, setResponsible] = useState('');
  const [notes,       setNotes]       = useState('');

  const valid = date && branchId && responsible;
  const CAT_LABEL = { all: 'Todas las categorías', abarrotes: 'Abarrotes', bebidas: 'Bebidas', lacteos: 'Lácteos', limpieza: 'Limpieza', higiene: 'Higiene', snacks: 'Snacks' };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{t('stockcount.newCount', 'Nueva sesión de conteo')}</h3>
          <button className="icon-btn" onClick={onClose}><Icon name="close" /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-grid">
            <div className="field">
              <label className="field-label">Fecha del conteo</label>
              <input type="date" className="field-input" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label">{t('common.branch', 'Sucursal')}</label>
              <select className="field-input" value={branchId} onChange={e => setBranchId(e.target.value)}>
                <option value="">{t('common.selectDots', 'Seleccionar…')}</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label className="field-label">{t('common.category', 'Categoría')} a contar</label>
            <select className="field-input" value={category} onChange={e => setCategory(e.target.value)}>
              {Object.entries(CAT_LABEL).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field-label">Responsable del conteo</label>
            <input className="field-input" placeholder="Nombre del encargado"
              value={responsible} onChange={e => setResponsible(e.target.value)} />
          </div>
          <div className="field">
            <label className="field-label">{t('common.observations', 'Observaciones')} ({t('common.optional', 'Opcional')})</label>
            <input className="field-input" placeholder="Ej. Conteo mensual, revisión de caducados…"
              value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="modal-foot">
          <Button variant="ghost" onClick={onClose}>{t('common.cancel', 'Cancelar')}</Button>
          <Button icon="check" variant="accent" disabled={!valid} onClick={() => onSave({ date, branchId: Number(branchId), category, categoryLabel: CAT_LABEL[category], responsible, notes })}>Iniciar sesión
          </Button>
        </div>
      </div>
    </div>
  );
}
