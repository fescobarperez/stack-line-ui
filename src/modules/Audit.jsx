// ERP MAYA — Auditoría · Log de actividad
import React, { useState, useMemo, useEffect } from 'react';
import Icon from '../components/Icon.jsx';
import { listAuditLog } from '../api/wave2.js';
import { useTranslation } from 'react-i18next';

const Q = v => `Q ${v.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// (bitácora viene del backend; sin datos precargados)

// ── Display maps ─────────────────────────────────────────────────────────────
const MODULE_LABEL = {
  pos: 'Punto de Venta', billing: 'Facturación', inventory: 'Inventario',
  purchases: 'Compras', cash: 'Caja', clients: 'Clientes',
  users: 'Usuarios', config: 'Configuración', accounting: 'Contabilidad',
  transfers: 'Transferencias', cxc: 'CxC', cxp: 'CxP', auth: 'Sistema',
};
const MODULE_ICON = {
  pos: 'pos', billing: 'receipt', inventory: 'box', purchases: 'truck',
  cash: 'cash', clients: 'user', users: 'users', config: 'bolt',
  accounting: 'receipt', transfers: 'transfer', cxc: 'card', cxp: 'card', auth: 'lock',
};
const ACTION_LABEL = {
  login: 'Inicio de sesión', logout: 'Cierre de sesión', login_failed: 'Acceso fallido',
  sale_created: 'Venta registrada', sale_cancelled: 'Venta anulada',
  stock_adjusted: 'Ajuste de inventario', product_updated: 'Producto actualizado',
  purchase_received: 'OC recibida', cash_opened: 'Apertura de caja',
  cash_closed: 'Cierre de caja', client_created: 'Cliente creado',
  client_updated: 'Cliente actualizado', user_created: 'Usuario creado',
  user_updated: 'Usuario modificado', config_changed: 'Configuración modificada',
  transfer_created: 'Traslado creado', journal_created: 'Partida contable',
  cxc_payment: 'Cobro CxC', cxp_payment: 'Pago CxP',
};
const SEVERITY_CLASS = { info: 'info', success: 'success', warning: 'warning', danger: 'danger' };
const SEVERITY_LABEL = { info: 'Info', success: 'OK', warning: 'Aviso', danger: 'Crítico' };

const TODAY_DATE = new Date().toISOString().slice(0, 10);

// Backend AuditLog → forma que usa el componente.
function mapEntry(r) {
  const ts = r.occurredAt ? new Date(r.occurredAt).toISOString().replace('T', ' ').slice(0, 19) : '';
  return {
    id: r.id, ts, userId: r.userId, user: r.userName || 'Sistema', role: '',
    module: r.module, action: r.action, severity: r.severity || 'info',
    description: r.description, entity: r.entityRef,
    branch: r.branchId ? `#${r.branchId}` : '—', ip: r.ipAddress || '—',
  };
}

export default function Audit() {
  const { t } = useTranslation();
  const [search,        setSearch]        = useState('');
  const [filterModule,  setFilterModule]  = useState('all');
  const [filterUser,    setFilterUser]    = useState('all');
  const [filterSeverity,setFilterSeverity]= useState('all');
  const [selected,      setSelected]      = useState(null);
  const [log, setLog] = useState([]);
  const [source, setSource] = useState('');

  // Bitácora del backend con fallback al mock. (El auto-registro de eventos aún no
  // está implementado en el backend, por lo que puede venir vacío.)
  useEffect(() => {
    let cancelled = false;
    listAuditLog({ size: 200 })
      .then((page) => {
        const rows = Array.isArray(page) ? page : (page?.content ?? []);
        if (!cancelled) { setLog(rows.map(mapEntry)); setSource('api'); }
      })
      .catch(() => { if (!cancelled) { setLog([]); setSource('error'); } });
    return () => { cancelled = true; };
  }, []);

  // Stats
  const todayEntries    = log.filter(e => e.ts.startsWith(TODAY_DATE));
  const todayCount      = todayEntries.length;
  const activeUsers     = new Set(todayEntries.filter(e => e.userId).map(e => e.userId)).size;
  const alertCount      = log.filter(e => e.severity === 'danger').length;
  const weekCount       = log.length;

  const moduleFreq = useMemo(() => {
    const freq = {};
    todayEntries.forEach(e => { freq[e.module] = (freq[e.module] || 0) + 1; });
    return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0];
  }, [todayEntries]);

  const filtered = useMemo(() => log.filter(e => {
    if (filterModule   !== 'all' && e.module   !== filterModule)   return false;
    if (filterUser     !== 'all' && e.userId    !== filterUser)     return false;
    if (filterSeverity !== 'all' && e.severity  !== filterSeverity) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!e.user.toLowerCase().includes(q) && !e.description.toLowerCase().includes(q) && !(e.entity || '').toLowerCase().includes(q)) return false;
    }
    return true;
  }), [log, search, filterModule, filterUser, filterSeverity]);

  const uniqueUsers   = useMemo(() => [...new Set(log.filter(e => e.userId).map(e => ({ id: e.userId, name: e.user })).map(JSON.stringify))].map(JSON.parse), [log]);
  const uniqueModules = useMemo(() => [...new Set(log.map(e => e.module))], [log]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('audit.title', 'Auditoría')}</h1>
          <div className="page-subtitle">
            {t('audit.subtitle', 'Log de actividad del sistema · trazabilidad de acciones')}
            {source === 'mock' && <span className="pill" style={{ marginLeft: 8, fontSize: 10 }}>demo</span>}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <div className="stat">
          <div className="label"><Icon name="clock" size={11} />{t('audit.actionsToday', 'Acciones hoy')}</div>
          <div className="val mono">{todayCount}</div>
          <div className="delta muted">{weekCount} {t('audit.thisWeek', 'esta semana')}</div>
        </div>
        <div className="stat">
          <div className="label"><Icon name="users" size={11} />{t('audit.activeUsers', 'Usuarios activos')}</div>
          <div className="val mono">{activeUsers}</div>
          <div className="delta muted">{t('audit.uniqueSessions', 'Sesiones únicas hoy')}</div>
        </div>
        <div className="stat">
          <div className="label"><Icon name="alert" size={11} />{t('audit.alertsCritical', 'Alertas / críticos')}</div>
          <div className="val mono" style={{ color: alertCount > 0 ? 'var(--danger)' : undefined }}>{alertCount}</div>
          <div className="delta muted">{t('audit.criticalActionsWeek', 'Acciones críticas esta semana')}</div>
        </div>
        <div className="stat">
          <div className="label"><Icon name="dashboard" size={11} />{t('audit.mostActiveModule', 'Módulo más activo')}</div>
          <div className="val" style={{ fontSize: 20 }}>{MODULE_LABEL[moduleFreq] || '—'}</div>
          <div className="delta muted">{t('audit.mostActivityToday', 'Mayor actividad hoy')}</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="filterbar">
        <div className="search-wrap" style={{ flex: 1, maxWidth: 320 }}>
          <Icon name="search" className="icon" size={13} />
          <input
            className="search-input"
            placeholder={t('audit.searchPlaceholder', 'Buscar usuario, acción, entidad…')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="input" value={filterModule} onChange={e => setFilterModule(e.target.value)}>
          <option value="all">{t('audit.allModules', 'Todos los módulos')}</option>
          {uniqueModules.map(m => (
            <option key={m} value={m}>{MODULE_LABEL[m] || m}</option>
          ))}
        </select>
        <select className="input" value={filterUser} onChange={e => setFilterUser(e.target.value)}>
          <option value="all">{t('audit.allUsers', 'Todos los usuarios')}</option>
          {uniqueUsers.map(u => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
        <select className="input" value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)}>
          <option value="all">{t('audit.allSeverity', 'Toda la severidad')}</option>
          <option value="success">OK</option>
          <option value="info">Info</option>
          <option value="warning">{t('audit.warning', 'Aviso')}</option>
          <option value="danger">{t('audit.critical', 'Crítico')}</option>
        </select>
      </div>

      {/* Tabla de log */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="tbl-wrap"><table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 140 }}>{t('audit.dateTime', 'Fecha y hora')}</th>
              <th>{t('common.user', 'Usuario')}</th>
              <th>{t('audit.module', 'Módulo')}</th>
              <th>{t('audit.action', 'Acción')}</th>
              <th>{t('common.description', 'Descripción')}</th>
              <th>{t('common.branch', 'Sucursal')}</th>
              <th style={{ width: 70 }}>{t('audit.severity', 'Severidad')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="empty">{t('audit.noRecords', 'Sin registros con los filtros aplicados')}</td></tr>
            ) : filtered.map(entry => (
              <tr
                key={entry.id}
                style={{ cursor: 'pointer' }}
                onClick={() => setSelected(entry)}
              >
                <td>
                  <div className="mono muted" style={{ fontSize: 11 }}>{entry.ts.split(' ')[0]}</div>
                  <div className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{entry.ts.split(' ')[1]}</div>
                </td>
                <td>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{entry.user}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{entry.role}</div>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon name={MODULE_ICON[entry.module] || 'dashboard'} size={12} style={{ color: 'var(--muted)' }} />
                    <span style={{ fontSize: 12 }}>{MODULE_LABEL[entry.module] || entry.module}</span>
                  </div>
                </td>
                <td style={{ fontSize: 12 }}>{ACTION_LABEL[entry.action] || entry.action}</td>
                <td className="muted" style={{ fontSize: 12, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.description}
                </td>
                <td style={{ fontSize: 12 }}>{entry.branch}</td>
                <td>
                  <span className={`pill ${SEVERITY_CLASS[entry.severity]}`} style={{ fontSize: 9 }}>
                    {SEVERITY_LABEL[entry.severity]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>

      {/* Drawer de detalle */}
      {selected && (
        <div className="drawer-overlay" onClick={() => setSelected(null)}>
          <div className="drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-head">
              <div>
                <div className="drawer-title">{ACTION_LABEL[selected.action] || selected.action}</div>
                <div className="muted" style={{ fontSize: 12 }}>{selected.ts}</div>
              </div>
              <button className="icon-btn" aria-label={t('common.close', 'Cerrar')} onClick={() => setSelected(null)}><Icon name="close" /></button>
            </div>
            <div className="drawer-body detail-grid">
              <DetailRow label={t('common.user', 'Usuario')}    value={`${selected.user} · ${selected.role}`} />
              <DetailRow label={t('audit.module', 'Módulo')}     value={MODULE_LABEL[selected.module] || selected.module} />
              <DetailRow label={t('audit.action', 'Acción')}     value={ACTION_LABEL[selected.action] || selected.action} />
              <DetailRow label={t('common.description', 'Descripción')} value={selected.description} />
              {selected.entity && <DetailRow label={t('audit.affectedEntity', 'Entidad afectada')} value={selected.entity} mono />}
              <DetailRow label={t('common.branch', 'Sucursal')}   value={selected.branch} />
              <DetailRow label="IP"         value={selected.ip} mono />
              <DetailRow label={t('audit.dateTime', 'Fecha/hora')} value={selected.ts} mono />
              <div style={{ paddingTop: 4 }}>
                <span className={`pill ${SEVERITY_CLASS[selected.severity]}`}>
                  {SEVERITY_LABEL[selected.severity]}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, mono }) {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className={mono ? 'mono' : ''} style={{ fontSize: 13, textAlign: 'right' }}>{value}</span>
    </div>
  );
}
