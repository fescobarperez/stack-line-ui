// ERP MAYA — MaintenanceModule (catálogos / mantenimientos)
// Data-driven: sucursales/proveedores/categorías desde sus endpoints (hooks).
// La pestaña Impuestos & SAT es configuración fiscal estática por ahora.
import Icon from '../components/Icon.jsx';
import { useBranches, useSuppliers } from '../hooks/useMasters.js';
import { useCategories } from '../hooks/useCatalog.js';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const Q = (v) => `Q ${Number(v || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function MaintenanceModule() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('sucursales');
  const { items: branches } = useBranches();
  const { items: suppliers } = useSuppliers();
  const categories = useCategories();

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('maintenance.title', 'Mantenimientos')}</h1>
          <div className="page-subtitle">{t('maintenance.subtitle', 'Catálogos maestros · Configuración de entidades del sistema')}</div>
        </div>
      </div>

      <div className="tabs">
        <div className={`tab ${tab === 'sucursales' ? 'active' : ''}`} onClick={() => setTab('sucursales')}>{t('maintenance.tabs.branches', 'Sucursales')} <span className="count">{branches.length}</span></div>
        <div className={`tab ${tab === 'proveedores' ? 'active' : ''}`} onClick={() => setTab('proveedores')}>{t('maintenance.tabs.suppliers', 'Proveedores')} <span className="count">{suppliers.length}</span></div>
        <div className={`tab ${tab === 'categorias' ? 'active' : ''}`} onClick={() => setTab('categorias')}>{t('maintenance.tabs.categories', 'Categorías')} <span className="count">{categories.length}</span></div>
        <div className={`tab ${tab === 'impuestos' ? 'active' : ''}`} onClick={() => setTab('impuestos')}>{t('maintenance.tabs.taxes', 'Impuestos & SAT')}</div>
      </div>

      {tab === 'sucursales' && (
        <div className="card">
          <table className="tbl">
            <thead>
              <tr>
                <th>{t('common.code', 'Código')}</th><th>{t('common.name', 'Nombre')}</th>
                <th>{t('common.address', 'Dirección')}</th><th>{t('maintenance.establishment', 'Establecimiento')}</th>
                <th>{t('common.status', 'Estado')}</th>
              </tr>
            </thead>
            <tbody>
              {branches.length === 0 && <tr><td colSpan={5}><div className="empty" style={{ padding: 20 }}>Sin sucursales</div></td></tr>}
              {branches.map((b) => (
                <tr key={b.id}>
                  <td className="code">{String(b.id).toUpperCase()}</td>
                  <td><div style={{ fontWeight: 500 }}>{b.name}</div></td>
                  <td>{b.address || b.addr || '—'}</td>
                  <td className="muted">{b.establishmentName || '—'}</td>
                  <td>
                    {b.status !== 'paused'
                      ? <span className="pill success"><span className="dot" />{t('maintenance.branchActive', 'Activa')}</span>
                      : <span className="pill warning"><span className="dot" />{t('maintenance.branchPaused', 'Pausada')}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'proveedores' && (
        <div className="card">
          <table className="tbl">
            <thead>
              <tr>
                <th>{t('maintenance.legalName', 'Razón social')}</th><th>NIT</th><th>{t('maintenance.contact', 'Contacto')}</th>
                <th>{t('common.phone', 'Teléfono')}</th><th>{t('maintenance.terms', 'Términos')}</th>
                <th className="num">{t('maintenance.cxpBalance', 'Saldo CxP')}</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.length === 0 && <tr><td colSpan={6}><div className="empty" style={{ padding: 20 }}>Sin proveedores</div></td></tr>}
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <td><div style={{ fontWeight: 500 }}>{s.name}</div></td>
                  <td className="code">{s.nit || '—'}</td>
                  <td>{s.contact || '—'}</td>
                  <td className="code">{s.phone || '—'}</td>
                  <td>{s.terms ? <span className="pill">{s.terms}</span> : '—'}</td>
                  <td className="num" style={{ fontWeight: 600, color: Number(s.balance) > 0 ? 'var(--warning)' : 'var(--muted)' }}>{Q(s.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'categorias' && (
        <div className="grid-3">
          {categories.filter((c) => c.id !== 'todos').length === 0 && <div className="empty" style={{ padding: 20 }}>Sin categorías</div>}
          {categories.filter((c) => c.id !== 'todos').map((c) => (
            <div key={c.id} className="card">
              <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: 'var(--r-md)', background: 'var(--surface-3)', display: 'grid', placeItems: 'center', fontSize: 22 }}>{c.icon || '📦'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{c.name}</div>
                  <div className="muted mono" style={{ fontSize: 11 }}>{String(c.id).toUpperCase()}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'impuestos' && (
        <div className="grid-2">
          <div className="card">
            <div className="card-head"><h3>{t('maintenance.taxpayerData', 'Datos fiscales del contribuyente')}</h3></div>
            <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 14px', fontSize: 12.5 }}>
              <div className="muted">{t('maintenance.regime', 'Régimen')}</div><div>General sobre Utilidades</div>
              <div className="muted">{t('maintenance.satCategory', 'Categoría SAT')}</div><div>Definitivo IVA</div>
              <div className="muted" style={{ gridColumn: '1 / -1', fontSize: 11, marginTop: 4 }}>
                Configuración fiscal — pendiente de cablear a /api/settings.
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h3>{t('maintenance.taxConfig', 'Configuración de impuestos')}</h3></div>
            <div className="card-body flush">
              <table className="tbl">
                <thead><tr><th>{t('common.code', 'Código')}</th><th>{t('common.name', 'Nombre')}</th><th className="num">{t('maintenance.rate', 'Tasa')}</th><th>{t('common.status', 'Estado')}</th></tr></thead>
                <tbody>
                  <tr><td className="code">IVA</td><td>Impuesto al Valor Agregado</td><td className="num" style={{ fontWeight: 600 }}>12%</td><td><span className="pill success"><span className="dot" />{t('common.active', 'Activo')}</span></td></tr>
                  <tr><td className="code">IDP</td><td>Impuesto Distribución Petróleo</td><td className="num">—</td><td><span className="pill"><span className="dot" style={{ background: 'var(--muted)' }} />N/A</span></td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MaintenanceModule;
