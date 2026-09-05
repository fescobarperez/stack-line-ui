// Stackline — Panel lateral de notificaciones
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import Button from './Button.jsx';
import { getNotifications } from '../api/notifications.js';

const TYPE_ICON  = { stock_low: 'alert', expiry: 'clock', po_pending: 'truck', transfer: 'transfer', cash: 'cash', cxc: 'card' };
const TYPE_CLASS = { stock_low: 'danger', expiry: 'warning', po_pending: 'warning', transfer: 'info', cash: 'danger', cxc: 'warning' };
const TYPE_LABEL = { stock_low: 'Stock', expiry: 'Vencimiento', po_pending: 'Compras', transfer: 'Traslado', cash: 'Caja', cxc: 'CxC' };

const READ_KEY = 'maya_notif_read';
const loadRead = () => { try { return JSON.parse(localStorage.getItem(READ_KEY)) || {}; } catch { return {}; } };

// Notificaciones derivadas del backend (alertas en tiempo real). El estado leído/no
// leído se guarda en localStorage (el endpoint no persiste). Fallback al mock.
export function useNotifications() {
  const [items, setItems] = useState([]);
  const [read, setRead] = useState(loadRead);

  useEffect(() => {
    let cancelled = false;
    getNotifications()
      .then(rows => { if (!cancelled) setItems(Array.isArray(rows) ? rows : (rows?.content ?? [])); })
      .catch(() => { if (!cancelled) setItems([]); });
    return () => { cancelled = true; };
  }, []);

  const notifications = items.map(n => ({ ...n, readAt: read[n.id] || n.readAt || null }));
  const unreadCount = notifications.filter(n => !n.readAt).length;

  const persist = (next) => { setRead(next); try { localStorage.setItem(READ_KEY, JSON.stringify(next)); } catch { /* ignore */ } };
  const markRead = (id) => persist({ ...read, [id]: new Date().toISOString() });
  const markAllRead = () => {
    const next = { ...read };
    items.forEach(n => { if (!next[n.id]) next[n.id] = new Date().toISOString(); });
    persist(next);
  };

  return { notifications, unreadCount, markRead, markAllRead };
}

export function NotificationsPanel({ notifications, unreadCount, onMarkRead, onMarkAllRead }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = filter === 'unread'
    ? notifications.filter(n => !n.readAt)
    : notifications;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="icon-btn"
        title="Notificaciones"
        onClick={() => setOpen(o => !o)}
        style={{ position: 'relative' }}
      >
        <Icon name="bell" />
        {unreadCount > 0 && (
          <span className="icon-btn-badge">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          width: 380, maxHeight: 520,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 10, boxShadow: 'var(--shadow-lg)', zIndex: 200,
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Cabecera */}
          <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ fontWeight: 500, fontSize: 14 }}>
              Notificaciones {unreadCount > 0 && <span className="badge-m3 danger" style={{ marginLeft: 6 }}>{unreadCount}</span>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {unreadCount > 0 && (
                <Button size="sm" onClick={onMarkAllRead}>
                  Marcar todas leídas
                </Button>
              )}
            </div>
          </div>

          {/* Filtros */}
          <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, flexShrink: 0 }}>
            {['all', 'unread'].map(f => (
              <button key={f} className={`chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                {f === 'all' ? 'Todas' : `No leídas (${unreadCount})`}
              </button>
            ))}
          </div>

          {/* Lista */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filtered.length === 0 ? (
              <div className="empty" style={{ padding: '32px 16px' }}>
                <Icon name="check" size={20} style={{ opacity: 0.3, marginBottom: 8 }} />
                <div>Sin notificaciones {filter === 'unread' ? 'pendientes' : ''}</div>
              </div>
            ) : filtered.map(n => (
              <div
                key={n.id}
                onClick={() => { onMarkRead(n.id); navigate('/' + n.route); setOpen(false); }}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  background: n.readAt ? 'transparent' : 'rgba(var(--accent-rgb,20,184,166),.04)',
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                  transition: 'background .15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                onMouseLeave={e => e.currentTarget.style.background = n.readAt ? 'transparent' : 'rgba(var(--accent-rgb,20,184,166),.04)'}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  background: `rgba(var(--${TYPE_CLASS[n.type]}-rgb,239,68,68),.12)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginTop: 2,
                }}>
                  <Icon name={TYPE_ICON[n.type] || 'bell'} size={14} style={{ color: `var(--${TYPE_CLASS[n.type]})` }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ fontWeight: n.readAt ? 400 : 600, fontSize: 14, lineHeight: 1.3 }}>{n.title}</div>
                    {!n.readAt && <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: 4 }} />}
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2, lineHeight: 1.3 }}>{n.body}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <span className={`badge-m3 ${TYPE_CLASS[n.type]}`}>{TYPE_LABEL[n.type]}</span>
                    <span className="muted" style={{ fontSize: 11 }}>{n.createdAt.split(' ')[1] || n.createdAt}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
