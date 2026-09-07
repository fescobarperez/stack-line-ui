// Stackline — App shell (ES module)
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePendingAuthorizations } from './hooks/useOperations.js';
import { useTranslation } from 'react-i18next';
import { canView } from './lib/permissions.js';
import Icon from './components/Icon.jsx';
import Button from './components/Button.jsx';
import {
  useTweaks,
  TweaksPanel,
  TweakSection,
  TweakRadio,
  TweakButton,
} from './components/TweaksPanel.jsx';
import Logo from './components/Logo.jsx';

import { useNotifications, NotificationsPanel } from './components/NotificationsPanel.jsx';
import GlobalSearch from './components/GlobalSearch.jsx';
import Dashboard from './modules/Dashboard.jsx';
import POS from './modules/POS.jsx';
import Billing from './modules/Billing.jsx';
import Inventory from './modules/Inventory.jsx';
import Catalog from './modules/Catalog.jsx';
import Reports from './modules/Reports.jsx';
import Maintenance from './modules/Maintenance.jsx';
import Clients from './modules/Clients.jsx';
import Purchases from './modules/Purchases.jsx';
import CashRegister from './modules/CashRegister.jsx';
import Config from './modules/Config.jsx';
import Accounting from './modules/Accounting.jsx';
import Transfers from './modules/Transfers.jsx';
import CxC from './modules/CxC.jsx';
import CxP from './modules/CxP.jsx';
import Audit from './modules/Audit.jsx';
import Projects from './modules/Projects.jsx';
import Authorizations from './modules/Authorizations.jsx';
import Returns from './modules/Returns.jsx';
import Variants from './modules/Variants.jsx';
import StockCount from './modules/StockCount.jsx';
import Ledger from './modules/Ledger.jsx';
import FinancialStatements from './modules/FinancialStatements.jsx';
import BankReconciliation from './modules/BankReconciliation.jsx';
import Banks from './modules/Banks.jsx';
import UOM from './modules/UOM.jsx';
import CostCenters from './modules/CostCenters.jsx';
import Quotes from './modules/Quotes.jsx';
import Payroll from './modules/Payroll.jsx';
import FixedAssets from './modules/FixedAssets.jsx';
import Promotions from './modules/Promotions.jsx';
import Presupuestos from './modules/Presupuestos.jsx';
import Loyalty from './modules/Loyalty.jsx';
import FEL from './modules/FEL.jsx';
import Users from './modules/Users.jsx';

const NAV = [
  {
    section: 'OPERACIÓN',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
      { id: 'pos', label: 'Punto de venta', icon: 'pos', kbd: '⌘P' },
      { id: 'billing',  label: 'Facturación',          icon: 'receipt', badge: 142 },
      { id: 'fel',      label: 'FEL · SAT',            icon: 'check'              },
      { id: 'returns',  label: 'Devoluciones',          icon: 'return',  badge: 1   },
      { id: 'cash', label: 'Caja y Cortes', icon: 'cash' },
    ],
  },
  {
    section: 'INVENTARIO',
    items: [
      { id: 'inventory',  label: 'Productos y stock', icon: 'box',      alert: 5 },
      { id: 'catalog',    label: 'Catálogo de productos', icon: 'folder' },
      { id: 'variants',    label: 'Variantes',              icon: 'settings'          },
      { id: 'stockcount', label: 'Conteo físico',          icon: 'check'             },
      { id: 'uom',        label: 'Unidades de Medida',     icon: 'settings'          },
      { id: 'purchases',  label: 'Compras y OCs',          icon: 'truck',    badge: 2 },
      { id: 'transfers',  label: 'Transferencias',        icon: 'transfer', badge: 1 },
    ],
  },
  {
    section: 'ANÁLISIS',
    items: [
      { id: 'reports', label: 'Reportería',  icon: 'chart'    },
      { id: 'quotes',      label: 'Cotizaciones', icon: 'receipt', badge: 2 },
      { id: 'projects',    label: 'Proyectos',    icon: 'box'              },
      { id: 'promotions',  label: 'Promociones',  icon: 'tag'              },
    ],
  },
  {
    section: 'CRM',
    items: [
      { id: 'clients', label: 'Clientes',     icon: 'user' },
      { id: 'loyalty', label: 'Fidelización', icon: 'tag'  },
      { id: 'cxc',     label: 'Cuentas por Cobrar', icon: 'card', alert: 3 },
      { id: 'cxp',     label: 'Cuentas por Pagar',  icon: 'receipt', alert: 2 },
    ],
  },
  {
    section: 'CONTABILIDAD',
    items: [
      { id: 'accounting',    label: 'Contabilidad',          icon: 'receipt' },
      { id: 'costcenters',  label: 'Centros de Costo',      icon: 'chart'   },
      { id: 'presupuestos', label: 'Presupuestos',          icon: 'chart'   },
      { id: 'ledger',       label: 'Mayor General',         icon: 'chart'   },
      { id: 'financials',   label: 'Estados Financieros',   icon: 'receipt' },
      { id: 'banks',        label: 'Bancos y Cuentas',  icon: 'card'    },
      { id: 'bankrec',      label: 'Conciliación Bancaria', icon: 'card'    },
    ],
  },
  {
    section: 'ADMINISTRACIÓN',
    items: [
      { id: 'maintenance', label: 'Mantenimientos', icon: 'settings' },
      { id: 'users',       label: 'Usuarios y roles', icon: 'users' },
      { id: 'payroll',      label: 'Planilla',        icon: 'users'    },
      { id: 'fixedassets',  label: 'Activos Fijos',  icon: 'box'      },
      { id: 'audit',       label: 'Auditoría',      icon: 'clock' },
      { id: 'config',      label: 'Configuración',  icon: 'bolt' },
    ],
  },
];

const MODULE_MAP = {
  dashboard:    Dashboard,
  pos:          POS,
  billing:      Billing,
  inventory:    Inventory,
  catalog:      Catalog,
  purchases:    Purchases,
  reports:      Reports,
  maintenance:  Maintenance,
  users:        Users,
  cash:         CashRegister,
  config:       Config,
  accounting:   Accounting,
  transfers:    Transfers,
  clients:      Clients,
  cxc:          CxC,
  cxp:          CxP,
  authorizations: Authorizations,
  projects:     Projects,
  audit:        Audit,
  returns:      Returns,
  variants:     Variants,
  stockcount:   StockCount,
  ledger:       Ledger,
  financials:   FinancialStatements,
  banks:        Banks,
  bankrec:      BankReconciliation,
  uom:          UOM,
  costcenters:  CostCenters,
  quotes:       Quotes,
  payroll:      Payroll,
  fixedassets:  FixedAssets,
  promotions:   Promotions,
  presupuestos: Presupuestos,
  loyalty:      Loyalty,
  fel:          FEL,
};

const TWEAK_DEFAULTS = {
  theme: 'light',
  style: 'editorial',
  density: 'high',
  showSparklines: true,
};

export default function App({ session, onLogout }) {
  const navigate = useNavigate();
  // El escudo solo existe para quien puede aprobar algo. Un cajero sin nivel
  // de autoridad no debería ver una bandeja donde no puede decidir nada.
  const canApprove = session?.user?.authLevelId != null;
  // Pendientes de autorización: el contador del escudo en la barra superior.
  const { items: pendingAuths } = usePendingAuthorizations();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const route = location.pathname.slice(1) || 'dashboard';

  const [toasts, setToasts] = useState([]);
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [collapsed, setCollapsed] = useState({});
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [navTooltip, setNavTooltip] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();

  const toggleLang = () => i18n.changeLanguage(i18n.language === 'es' ? 'en' : 'es');

  // Atajo ⌘K / Ctrl+K para abrir búsqueda global
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(s => !s);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Aplicar tema/estilo al <html>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tweaks.theme);
    document.documentElement.setAttribute('data-style', tweaks.style);
  }, [tweaks.theme, tweaks.style]);

  // Auto-expandir la sección que contiene la ruta activa
  useEffect(() => {
    const sec = NAV.find(s => s.items.some(i => i.id === route));
    if (sec) setCollapsed(prev => ({ ...prev, [sec.section]: false }));
  }, [route]);

  const branch = session.user.branch;
  const perms = session.user.perms || ['*'];

  const visibleNav = NAV.map(sec => ({
    ...sec,
    items: sec.items.filter(it => canView(it.id, perms)),
  })).filter(sec => sec.items.length > 0);

  const pushToast = (msg, kind = '') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  };

  const ModuleComponent = MODULE_MAP[route];
  const module = !ModuleComponent
    ? <div className="page">{t('shell.underConstruction')}</div>
    : !canView(route, perms)
    ? <AccessDenied />
    : <ModuleComponent pushToast={pushToast} />;

  const currentNav = NAV.flatMap((s) => s.items).find((i) => i.id === route);

  return (
    <div className="app" data-screen-label={`Module · ${currentNav?.label}`} data-sidebar={sidebarCollapsed ? 'collapsed' : 'expanded'}>
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Logo size={40} className="drawer-mark" />
          <div className="sidebar-brand-text">
            <div className="drawer-wordmark">Stack<span className="wm-l">line</span></div>
            <div className="tier">STACKLINE · RETAIL v4.0</div>
          </div>
          <button
            className="icon-btn sidebar-toggle"
            style={{ marginLeft: 'auto' }}
            title={sidebarCollapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
            onClick={() => setSidebarCollapsed(v => !v)}
          >
            <Icon name="chevronDown" size={13} style={{ transform: sidebarCollapsed ? 'rotate(-90deg)' : 'rotate(90deg)', transition: 'transform 0.2s' }} />
          </button>
        </div>

        <div className="sidebar-org">
          <button className="sidebar-org-btn">
            <span className="sidebar-org-dot"></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="sidebar-org-name">{session.company.name}</div>
              <div className="muted mono" style={{ fontSize: 11, marginTop: 1 }}>
                {session.company.code} · {session.company.tier}
              </div>
            </div>
            <Icon name="chevronDown" size={11} className="sidebar-org-arrow" />
          </button>
        </div>

        <div className="sidebar-nav">
          {visibleNav.map((sec) => {
            const isCollapsed = !!collapsed[sec.section];
            return (
              <div key={sec.section}>
                <div
                  className="nav-section"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => setCollapsed(prev => ({ ...prev, [sec.section]: !prev[sec.section] }))}
                >
                  <span className="nav-section-label">{t(`nav.sections.${sec.section}`, sec.section)}</span>
                  <Icon
                    name="chevronDown"
                    size={10}
                    className="nav-section-label"
                    style={{ marginRight: 4, transition: 'transform 0.2s', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
                  />
                </div>
                {!isCollapsed && sec.items.map((it) => (
                  <div
                    key={it.id}
                    className={`nav-item ${route === it.id ? 'active' : ''}`}
                    onClick={() => navigate('/' + it.id)}
                    onMouseEnter={sidebarCollapsed ? (e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      setNavTooltip({ label: it.label, y: r.top + r.height / 2 });
                    } : undefined}
                    onMouseLeave={sidebarCollapsed ? () => setNavTooltip(null) : undefined}
                  >
                    <Icon name={it.icon} size={24} fill={route === it.id} className="icon" />
                    <span className="nav-item-label">{t(`nav.${it.id}`, it.label)}</span>
                    {it.alert && <span className="badge alert">{it.alert}</span>}
                    {it.badge && !it.alert && <span className="badge">{it.badge}</span>}
                    {it.kbd && route !== it.id && <span className="badge mono">{it.kbd}</span>}
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        <div className="sidebar-footer">
          <div className="avatar">{session.user.initials}</div>
          <div className="user-info">
            <div className="nm">{session.user.name}</div>
            <div className="rl">{session.user.role} · {branch}</div>
          </div>
          <button className="icon-btn" title={t('common.logout')} onClick={onLogout}>
            <Icon name="lock" />
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="main">
        <header className="topbar">
          <button className="icon-btn" title="Menú" onClick={() => setSidebarCollapsed(v => !v)}>
            <Icon name="menu" size={24} />
          </button>
          <div className="topbar-search" role="button" tabIndex={0} onClick={() => setShowSearch(true)} onKeyDown={e => e.key === 'Enter' && setShowSearch(true)}>
            <Icon name="search" className="icon" size={24} />
            <span style={{ flex: 1, color: 'var(--md-sys-color-on-surface-variant)' }}>{t('shell.searchPlaceholder')}</span>
            <span className="kbd">⌘K</span>
          </div>
          <div className="topbar-spacer"></div>
          <div className="topbar-actions">
            <span className="badge-m3 success" style={{ marginRight: 4 }}>
              <span className="dot" />
              {t('shell.satOnline')}
            </span>
            <Button variant="ghost" title={t('common.language')} onClick={toggleLang} style={{ minWidth: 44, padding: '0 10px' }}>
              {i18n.language === 'es' ? 'ES' : 'EN'}
            </Button>
            {canApprove && (
              <button
                className="icon-btn"
                title={pendingAuths.length
                  ? t('authz.pendingTitle', `Autorizaciones · ${pendingAuths.length} pendientes`)
                  : t('authz.title', 'Autorizaciones')}
                aria-label={t('authz.title', 'Autorizaciones')}
                onClick={() => navigate('/authorizations')}
              >
                <Icon name="shield" size={24} />
                {pendingAuths.length > 0 && (
                  <span className="icon-btn-badge">
                    {pendingAuths.length > 9 ? '9+' : pendingAuths.length}
                  </span>
                )}
              </button>
            )}
            <NotificationsPanel
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkRead={markRead}
              onMarkAllRead={markAllRead}
            />
            <button
              className="icon-btn"
              title={t('common.theme')}
              onClick={() => setTweak('theme', tweaks.theme === 'dark' ? 'light' : 'dark')}
            >
              <Icon name={tweaks.theme === 'dark' ? 'light_mode' : 'moon'} size={24} />
            </button>
            <button className="icon-btn" title={t('common.help', 'Ayuda')}>
              <Icon name="help" size={24} />
            </button>
            <div className="avatar" title={session.user.name} style={{ width: 32, height: 32, fontSize: 12, marginLeft: 8 }}>
              {session.user.initials}
            </div>
          </div>
        </header>

        <div className="content" data-route={route} key={route}>
          {module}
        </div>
      </main>

      {/* Tooltip sidebar colapsado */}
      {sidebarCollapsed && navTooltip && (
        <div style={{
          position: 'fixed',
          left: 60,
          top: navTooltip.y,
          transform: 'translateY(-50%)',
          background: 'var(--text)',
          color: 'var(--surface)',
          padding: '5px 10px',
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 500,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 9999,
          boxShadow: '0 2px 8px rgba(0,0,0,.2)',
        }}>
          {navTooltip.label}
        </div>
      )}

      {/* Búsqueda global */}
      {showSearch && (
        <GlobalSearch
          navItems={visibleNav.flatMap(s =>
            s.items.map(i => ({ ...i, label: i.label, section: s.section }))
          )}
          onClose={() => setShowSearch(false)}
          onNavigate={(route) => navigate('/' + route)}
        />
      )}

      {/* Toasts */}
      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            {t.kind === 'success' && <Icon name="check" size={14} />}
            {t.kind === 'danger' && <Icon name="alert" size={14} />}
            {t.msg}
          </div>
        ))}
      </div>

      {/* Tweaks panel (sólo desarrollo) */}
      {import.meta.env.DEV && (
        <TweaksPanel title="Tweaks · Stackline">
          <TweakSection label="Tema">
            <TweakRadio
              label="Modo"
              value={tweaks.theme}
              onChange={(v) => setTweak('theme', v)}
              options={[
                { value: 'light', label: 'Claro' },
                { value: 'dark', label: 'Oscuro' },
              ]}
            />
          </TweakSection>
          <TweakSection label="Variaciones de estilo">
            <TweakRadio
              label="Estilo visual"
              value={tweaks.style || 'editorial'}
              onChange={(v) => setTweak('style', v)}
              options={[
                { value: 'editorial', label: 'Editorial denso' },
                { value: 'spacious', label: 'Espaciado' },
              ]}
            />
          </TweakSection>
          <TweakSection label="Atajos">
            <TweakButton label="→ Dashboard" onClick={() => navigate('/dashboard')} />
            <TweakButton label="→ Punto de venta" onClick={() => navigate('/pos')} />
            <TweakButton label="→ Inventario" onClick={() => navigate('/inventory')} />
            <TweakButton label="→ Reportería" onClick={() => navigate('/reports')} />
          </TweakSection>
        </TweaksPanel>
      )}
    </div>
  );
}

function AccessDenied() {
  const { t } = useTranslation();
  return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center' }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--border-strong)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 16 }}>
          <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        <div style={{ fontWeight: 500, fontSize: 16, marginBottom: 6 }}>{t('shell.accessDenied')}</div>
        <div className="muted" style={{ fontSize: 14 }}>{t('shell.accessDeniedDesc')}</div>
      </div>
    </div>
  );
}
