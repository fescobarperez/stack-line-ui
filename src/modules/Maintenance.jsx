// ERP MAYA — MaintenanceModule (catálogos / mantenimientos)
// Data-driven con CRUD: sucursales/proveedores/categorías desde sus endpoints.
// La pestaña Impuestos & SAT es configuración fiscal estática por ahora.
import Icon from '../components/Icon.jsx';
import { useBranches, useSuppliers } from '../hooks/useMasters.js';
import { createBranch, updateBranch } from '../api/org.js';
import { createSupplier, updateSupplier } from '../api/partners.js';
import { listCategories, createCategory, updateCategory } from '../api/catalog.js';
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

const Q = (v) => `Q ${Number(v || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Definición de campos por catálogo (para el modal genérico).
const FORMS = {
  sucursal: {
    title: 'Sucursal',
    fields: [
      { key: 'name', label: 'Nombre', required: true },
      { key: 'address', label: 'Dirección' },
      { key: 'status', label: 'Estado', type: 'select', options: [['active', 'Activa'], ['paused', 'Pausada']] },
    ],
    empty: { name: '', address: '', status: 'active' },
    toForm: (b) => ({ name: b.name || '', address: b.address || b.addr || '', status: b.status === 'paused' ? 'paused' : 'active' }),
    toPayload: (f) => ({ name: f.name.trim(), address: f.address || null, status: f.status, establishmentId: null }),
  },
  proveedor: {
    title: 'Proveedor',
    fields: [
      { key: 'name', label: 'Razón social', required: true },
      { key: 'nit', label: 'NIT' },
      { key: 'contact', label: 'Contacto' },
      { key: 'phone', label: 'Teléfono' },
      { key: 'paymentTerms', label: 'Términos de pago', placeholder: 'Ej. 30 días' },
      { key: 'status', label: 'Estado', type: 'select', options: [['active', 'Activo'], ['inactive', 'Inactivo']] },
    ],
    empty: { name: '', nit: '', contact: '', phone: '', paymentTerms: '', status: 'active' },
    toForm: (s) => ({ name: s.name || '', nit: s.nit || '', contact: s.contact || '', phone: s.phone || '', paymentTerms: s.paymentTerms || '', status: s.status || 'active' }),
    toPayload: (f) => ({ name: f.name.trim(), nit: f.nit || null, contact: f.contact || null, phone: f.phone || null, paymentTerms: f.paymentTerms || null, balance: 0, status: f.status }),
  },
  categoria: {
    title: 'Categoría',
    fields: [
      { key: 'name', label: 'Nombre', required: true },
      { key: 'icon', label: 'Ícono (emoji)', placeholder: '📦' },
    ],
    empty: { name: '', icon: '' },
    toForm: (c) => ({ name: c.name || '', icon: c.icon || '' }),
    toPayload: (f) => ({ name: f.name.trim(), icon: f.icon || null }),
  },
};

function MaintenanceModule({ pushToast }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState('sucursales');
  const { items: branches, reload: reloadBranches } = useBranches();
  const { items: suppliers, reload: reloadSuppliers } = useSuppliers();

  // Categorías con reload local (el hook compartido no lo expone).
  const [categories, setCategories] = useState([]);
  const reloadCategories = useCallback(async () => {
    try {
      const rows = await listCategories();
      setCategories(Array.isArray(rows) ? rows : (rows?.content ?? []));
    } catch { setCategories([]); }
  }, []);
  useEffect(() => { reloadCategories(); }, [reloadCategories]);

  // modal = { type, mode:'new'|'edit', id }
  const [modal, setModal] = useState(null);

  const save = async (type, id, payload) => {
    const api = {
      sucursal: { create: createBranch, update: updateBranch, reload: reloadBranches },
      proveedor: { create: createSupplier, update: updateSupplier, reload: reloadSuppliers },
      categoria: { create: createCategory, update: updateCategory, reload: reloadCategories },
    }[type];
    try {
      if (id != null) await api.update(id, payload);
      else await api.create(payload);
      pushToast && pushToast(`${FORMS[type].title} ${id != null ? 'actualizado' : 'creado'}`, 'success');
      setModal(null);
      await api.reload();
    } catch (err) {
      pushToast && pushToast('No se pudo guardar: ' + err.message, 'error');
    }
  };

  const catalogCategories = categories.filter((c) => c.id !== 'todos');

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
        <div className={`tab ${tab === 'categorias' ? 'active' : ''}`} onClick={() => setTab('categorias')}>{t('maintenance.tabs.categories', 'Categorías')} <span className="count">{catalogCategories.length}</span></div>
        <div className={`tab ${tab === 'impuestos' ? 'active' : ''}`} onClick={() => setTab('impuestos')}>{t('maintenance.tabs.taxes', 'Impuestos & SAT')}</div>
      </div>

      {tab === 'sucursales' && (
        <>
          <div className="toolbar" style={{ justifyContent: 'flex-end', marginBottom: 12 }}>
            <button className="btn accent" onClick={() => setModal({ type: 'sucursal', mode: 'new' })}>
              <Icon name="plus" size={12} /> {t('maintenance.addBranch', 'Agregar sucursal')}
            </button>
          </div>
          <div className="card">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t('common.code', 'Código')}</th><th>{t('common.name', 'Nombre')}</th>
                  <th>{t('common.address', 'Dirección')}</th><th>{t('maintenance.establishment', 'Establecimiento')}</th>
                  <th>{t('common.status', 'Estado')}</th><th></th>
                </tr>
              </thead>
              <tbody>
                {branches.length === 0 && <tr><td colSpan={6}><div className="empty" style={{ padding: 20 }}>Sin sucursales</div></td></tr>}
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
                    <td><button className="btn-ghost" onClick={() => setModal({ type: 'sucursal', mode: 'edit', id: b.id, data: b })}>{t('common.edit', 'Editar')}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'proveedores' && (
        <>
          <div className="toolbar" style={{ justifyContent: 'flex-end', marginBottom: 12 }}>
            <button className="btn accent" onClick={() => setModal({ type: 'proveedor', mode: 'new' })}>
              <Icon name="plus" size={12} /> {t('maintenance.addSupplier', 'Agregar proveedor')}
            </button>
          </div>
          <div className="card">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t('maintenance.legalName', 'Razón social')}</th><th>NIT</th><th>{t('maintenance.contact', 'Contacto')}</th>
                  <th>{t('common.phone', 'Teléfono')}</th><th>{t('maintenance.terms', 'Términos')}</th>
                  <th className="num">{t('maintenance.cxpBalance', 'Saldo CxP')}</th><th></th>
                </tr>
              </thead>
              <tbody>
                {suppliers.length === 0 && <tr><td colSpan={7}><div className="empty" style={{ padding: 20 }}>Sin proveedores</div></td></tr>}
                {suppliers.map((s) => (
                  <tr key={s.id}>
                    <td><div style={{ fontWeight: 500 }}>{s.name}</div></td>
                    <td className="code">{s.nit || '—'}</td>
                    <td>{s.contact || '—'}</td>
                    <td className="code">{s.phone || '—'}</td>
                    <td>{s.paymentTerms ? <span className="pill">{s.paymentTerms}</span> : '—'}</td>
                    <td className="num" style={{ fontWeight: 600, color: Number(s.balance) > 0 ? 'var(--warning)' : 'var(--muted)' }}>{Q(s.balance)}</td>
                    <td><button className="btn-ghost" onClick={() => setModal({ type: 'proveedor', mode: 'edit', id: s.id, data: s })}>{t('common.edit', 'Editar')}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'categorias' && (
        <>
          <div className="toolbar" style={{ justifyContent: 'flex-end', marginBottom: 12 }}>
            <button className="btn accent" onClick={() => setModal({ type: 'categoria', mode: 'new' })}>
              <Icon name="plus" size={12} /> {t('maintenance.addCategory', 'Agregar categoría')}
            </button>
          </div>
          <div className="grid-3">
            {catalogCategories.length === 0 && <div className="empty" style={{ padding: 20 }}>Sin categorías</div>}
            {catalogCategories.map((c) => (
              <div key={c.id} className="card" style={{ cursor: 'pointer' }} onClick={() => setModal({ type: 'categoria', mode: 'edit', id: c.id, data: c })}>
                <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 'var(--r-md)', background: 'var(--surface-3)', display: 'grid', placeItems: 'center', fontSize: 22 }}>{c.icon || '📦'}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{c.name}</div>
                    <div className="muted mono" style={{ fontSize: 11 }}>{String(c.id).toUpperCase()}</div>
                  </div>
                  <Icon name="edit" size={13} className="muted" />
                </div>
              </div>
            ))}
          </div>
        </>
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

      {modal && (
        <CatalogModal
          spec={FORMS[modal.type]}
          initial={modal.mode === 'edit' ? FORMS[modal.type].toForm(modal.data) : FORMS[modal.type].empty}
          isEdit={modal.mode === 'edit'}
          onClose={() => setModal(null)}
          onSave={(form) => save(modal.type, modal.id ?? null, FORMS[modal.type].toPayload(form))}
        />
      )}
    </div>
  );
}

// ── Modal genérico de catálogo ────────────────────────────────────────────────
function CatalogModal({ spec, initial, isEdit, onClose, onSave }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const valid = spec.fields.filter((f) => f.required).every((f) => String(form[f.key] || '').trim());

  const submit = async () => { setSaving(true); await onSave(form); setSaving(false); };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{isEdit ? `${t('common.edit', 'Editar')} ${spec.title.toLowerCase()}` : `${t('common.new', 'Nuevo')} ${spec.title.toLowerCase()}`}</h3>
          <button className="icon-btn" onClick={onClose}><Icon name="x" /></button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            {spec.fields.map((f) => (
              <div className="field span-2" key={f.key}>
                <label className="field-label">{f.label}{f.required ? ' *' : ''}</label>
                {f.type === 'select' ? (
                  <select className="field-input" value={form[f.key]} onChange={(e) => set(f.key, e.target.value)}>
                    {f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                ) : (
                  <input className="field-input" placeholder={f.placeholder || ''} value={form[f.key]} onChange={(e) => set(f.key, e.target.value)} />
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>{t('common.cancel', 'Cancelar')}</button>
          <button className="btn accent" disabled={!valid || saving} onClick={submit}>
            <Icon name="check" size={13} /> {t('common.save', 'Guardar')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default MaintenanceModule;
