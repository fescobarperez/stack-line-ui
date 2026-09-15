// Stackline — MaintenanceModule (catálogos / mantenimientos)
// Data-driven con CRUD: sucursales/proveedores/categorías desde sus endpoints.
// La pestaña Impuestos & SAT es configuración fiscal estática por ahora.
//
// Navegación en dos niveles, espejo del menú: pestaña de SECCIÓN (Inventario) →
// menú lateral con la OPCIÓN de menú (Productos y stock, Compras y OCs) → los
// catálogos que se mantienen desde esa pantalla. Así el usuario busca el
// mantenimiento donde usa el dato, no en una lista plana que crece sin criterio.
// El patrón menú + contenedor es el mismo de /config.
import Icon from '../components/Icon.jsx';
import Autocomplete from '../components/Autocomplete.jsx';
import Button from '../components/Button.jsx';
import DataTable from '../components/DataTable.jsx';
import { useBranches, useSuppliers } from '../hooks/useMasters.js';
import { createBranch, updateBranch } from '../api/org.js';
import { createSupplier, updateSupplier } from '../api/partners.js';
import { listCategories, createCategory, updateCategory } from '../api/catalog.js';
import { listChargeCategories, createChargeCategory, updateChargeCategory } from '../api/wave2.js';
import { listCashPoints, createCashPoint, updateCashPoint } from '../api/pos.js';
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PERM_SECTIONS } from '../lib/permissions.js';

const Q = (v) => `Q ${Number(v || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// PERM_SECTIONS rotula las secciones en mayúsculas para la matriz de permisos;
// como pestaña se leen a gritos. 'CRM' es sigla y se queda como está.
const TITULO_SECCION = {
  'OPERACIÓN': 'Operación', 'INVENTARIO': 'Inventario', 'ANÁLISIS': 'Análisis',
  'CRM': 'CRM', 'CONTABILIDAD': 'Contabilidad', 'ADMINISTRACIÓN': 'Administración',
};

/**
 * Cada catálogo declara bajo qué opción del menú se mantiene (`modulo`, un id
 * de PERM_SECTIONS). Agregar un mantenimiento nuevo es agregar una entrada
 * aquí: el árbol de pestañas se recalcula solo.
 */
const CATALOGOS = [
  { id: 'categorias',  modulo: 'inventory', form: 'categoria', label: 'Categorías',      addLabel: 'Agregar categoría' },
  { id: 'proveedores', modulo: 'purchases', form: 'proveedor', label: 'Proveedores',     addLabel: 'Agregar proveedor' },
  { id: 'sucursales',  modulo: 'config',    form: 'sucursal',  label: 'Sucursales',      addLabel: 'Agregar sucursal' },
  { id: 'gastos',      modulo: 'quotes',    form: 'gasto',    label: 'Conceptos de gasto', addLabel: 'Agregar concepto' },
  { id: 'cajas',       modulo: 'cash',      form: 'caja',     label: 'Cajas',              addLabel: 'Agregar caja' },
  { id: 'impuestos',   modulo: 'fel',                          label: 'Impuestos & SAT' },
];

// Los mismos íconos que usa NAV en App.jsx para esas opciones. Van copiados y
// no importados: App.jsx importa este módulo, y traerlo de vuelta cerraría el
// ciclo de imports.
const ICONO_MODULO = { inventory: 'box', purchases: 'truck', config: 'bolt', fel: 'check' };

/** Secciones y módulos que realmente tienen algo que mantener, en orden de menú. */
const ARBOL = PERM_SECTIONS
  .map((seccion) => ({
    id: seccion.section,
    label: TITULO_SECCION[seccion.section] || seccion.section,
    modulos: seccion.items
      .map((item) => ({ ...item, icon: ICONO_MODULO[item.id], catalogos: CATALOGOS.filter((c) => c.modulo === item.id) }))
      .filter((item) => item.catalogos.length),
  }))
  .filter((seccion) => seccion.modulos.length);

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
  caja: {
    title: 'Caja',
    fields: [
      { key: 'code', label: 'Código', required: true, placeholder: 'CAJA-01' },
      { key: 'name', label: 'Nombre', required: true, placeholder: 'Caja principal' },
      { key: 'branchId', label: 'Sucursal', type: 'branch', required: true },
      { key: 'status', label: 'Estado', type: 'select', options: [['active', 'Activa'], ['inactive', 'Inactiva']] },
    ],
    empty: { code: '', name: '', branchId: '', status: 'active' },
    toForm: (c) => ({ code: c.code || '', name: c.name || '',
                      branchId: c.branchId != null ? String(c.branchId) : '', status: c.status || 'active' }),
    toPayload: (f) => ({ code: f.code.trim(), name: f.name.trim(),
                         branchId: Number(f.branchId), status: f.status }),
  },
  gasto: {
    title: 'Concepto de gasto',
    fields: [
      { key: 'name', label: 'Nombre', required: true, placeholder: 'Energía eléctrica, alquiler…' },
      { key: 'operating', label: '¿Suma a Gastos operativos?', type: 'select',
        options: [['false', 'No, es un cargo aparte'], ['true', 'Sí, es gasto operativo']] },
      { key: 'sortOrder', label: 'Orden en la lista', placeholder: '50' },
      { key: 'status', label: 'Estado', type: 'select', options: [['active', 'Activo'], ['inactive', 'Inactivo']] },
    ],
    empty: { name: '', operating: 'false', sortOrder: '50', status: 'active' },
    toForm: (c) => ({ name: c.name || '', operating: c.operating ? 'true' : 'false',
                      sortOrder: String(c.sortOrder ?? 50), status: c.status || 'active' }),
    toPayload: (f) => ({ name: f.name.trim(), operating: f.operating === 'true',
                         sortOrder: Number(f.sortOrder) || 50, status: f.status }),
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
  const [seccionId, setSeccionId] = useState(ARBOL[0].id);
  const seccion = ARBOL.find((s) => s.id === seccionId) || ARBOL[0];
  const [moduloId, setModuloId] = useState(seccion.modulos[0].id);
  // Al cambiar de sección el módulo anterior ya no existe: se cae al primero.
  const modulo = seccion.modulos.find((m) => m.id === moduloId) || seccion.modulos[0];
  const irASeccion = (id) => {
    setSeccionId(id);
    setModuloId(ARBOL.find((s) => s.id === id).modulos[0].id);
  };
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

  // Conceptos de gasto de la cotización. No se llaman solo «categorías»
  // a propósito: en esta misma pantalla ya hay una pestaña de categorías de
  // producto y son cosas distintas.
  const [gastos, setGastos] = useState([]);
  const reloadGastos = useCallback(async () => {
    try {
      const rows = await listChargeCategories();
      setGastos(Array.isArray(rows) ? rows : []);
    } catch { setGastos([]); }
  }, []);
  useEffect(() => { reloadGastos(); }, [reloadGastos]);

  const [cajas, setCajas] = useState([]);
  const reloadCajas = useCallback(async () => {
    try {
      const rows = await listCashPoints();
      setCajas(Array.isArray(rows) ? rows : []);
    } catch { setCajas([]); }
  }, []);
  useEffect(() => { reloadCajas(); }, [reloadCajas]);

  // modal = { type, mode:'new'|'edit', id }
  const [modal, setModal] = useState(null);

  const save = async (type, id, payload) => {
    const api = {
      sucursal: { create: createBranch, update: updateBranch, reload: reloadBranches },
      proveedor: { create: createSupplier, update: updateSupplier, reload: reloadSuppliers },
      categoria: { create: createCategory, update: updateCategory, reload: reloadCategories },
      gasto: { create: createChargeCategory, update: updateChargeCategory, reload: reloadGastos },
      caja: { create: createCashPoint, update: updateCashPoint, reload: reloadCajas },
    }[type];
    try {
      if (id != null) await api.update(id, payload);
      else await api.create(payload);
      pushToast && pushToast(`${FORMS[type].title} ${id != null ? 'actualizado' : 'creado'}`, 'success');
      setModal(null);
      await api.reload();
    } catch (err) {
      pushToast && pushToast('No se pudo guardar: ' + err.message, 'danger');
    }
  };

  const catalogCategories = categories.filter((c) => c.id !== 'todos');

  const branchColumns = [
    { key: 'id', header: t('common.code', 'Código'), render: (b) => <span className="sku">{String(b.id).toUpperCase()}</span> },
    { key: 'name', header: t('common.name', 'Nombre'), sortable: true, render: (b) => <span className="nm">{b.name}</span> },
    { key: 'address', header: t('common.address', 'Dirección'), render: (b) => b.address || b.addr || '—' },
    { key: 'establishmentName', header: t('maintenance.establishment', 'Establecimiento'), render: (b) => <span style={{ color: 'var(--muted)' }}>{b.establishmentName || '—'}</span> },
    { key: 'status', header: t('common.status', 'Estado'), sortable: true, render: (b) => b.status !== 'paused'
      ? <span className="badge-m3 success">{t('maintenance.branchActive', 'Activa')}</span>
      : <span className="badge-m3 warning">{t('maintenance.branchPaused', 'Pausada')}</span> },
  ];
  const categoryColumns = [
    { key: 'icon', header: '', width: 44, render: (c) => <span className="maint-cat-icon">{c.icon || '📦'}</span> },
    { key: 'name', header: t('common.name', 'Nombre'), sortable: true, render: (c) => <span className="nm">{c.name}</span> },
    { key: 'id', header: t('common.code', 'Código'), render: (c) => <span className="sku">{String(c.id).toUpperCase()}</span> },
  ];
  const cajaColumns = [
    { key: 'code', header: t('common.code', 'Código'), sortable: true, render: (c) => <span className="sku">{c.code}</span> },
    { key: 'name', header: t('common.name', 'Nombre'), sortable: true, render: (c) => <span className="nm">{c.name}</span> },
    { key: 'branchName', header: t('common.branch', 'Sucursal'), sortable: true, render: (c) => c.branchName || '—' },
    // Quién la tiene tomada ahora: es la razón por la que no aparece libre
    // al abrir un turno, y sin esto habría que adivinarlo.
    { key: 'openSessionId', header: t('cash.inUse', 'En uso'), render: (c) => c.openSessionId
      ? <span className="badge-m3 warning">{c.openUserName || 'Turno abierto'}</span>
      : <span className="muted">—</span> },
    { key: 'status', header: t('common.status', 'Estado'), sortable: true, render: (c) => c.status === 'inactive'
      ? <span className="badge-m3">Inactiva</span>
      : <span className="badge-m3 success">Activa</span> },
  ];
  const gastoColumns = [
    { key: 'name', header: t('common.name', 'Nombre'), sortable: true, render: (g) => <span className="nm">{g.name}</span> },
    { key: 'code', header: t('common.code', 'Código'), render: (g) => <span className="sku">{g.code}</span> },
    { key: 'operating', header: t('maintenance.operating', 'Gasto operativo'), render: (g) => g.operating
      ? <span className="badge-m3 accent">Sí</span>
      : <span className="muted">—</span> },
    { key: 'protectedRow', header: '', width: 110, render: (g) => g.protectedRow
      ? <span className="badge-m3">Fijo del sistema</span>
      : null },
    { key: 'sortOrder', header: t('maintenance.order', 'Orden'), align: 'right', sortable: true, className: 'muted' },
    { key: 'status', header: t('common.status', 'Estado'), sortable: true, render: (g) => g.status === 'inactive'
      ? <span className="badge-m3 warning">Inactivo</span>
      : <span className="badge-m3 success">Activo</span> },
  ];
  const supplierColumns = [
    { key: 'name', header: t('maintenance.legalName', 'Razón social'), sortable: true, render: (s) => <span className="nm">{s.name}</span> },
    { key: 'nit', header: 'NIT', render: (s) => <span className="sku">{s.nit || '—'}</span> },
    { key: 'contact', header: t('maintenance.contact', 'Contacto'), render: (s) => s.contact || '—' },
    { key: 'phone', header: t('common.phone', 'Teléfono'), render: (s) => <span className="sku">{s.phone || '—'}</span> },
    { key: 'paymentTerms', header: t('maintenance.terms', 'Términos'), render: (s) => s.paymentTerms ? <span className="badge-m3">{s.paymentTerms}</span> : '—' },
    { key: 'balance', header: t('maintenance.cxpBalance', 'Saldo CxP'), align: 'right', sortable: true, sortValue: (s) => Number(s.balance), render: (s) => <span className="num" style={{ fontWeight: 500, color: Number(s.balance) > 0 ? 'var(--warning)' : 'var(--muted)' }}>{Q(s.balance)}</span> },
  ];

  const CONTEO = {
    sucursales: branches.length,
    proveedores: suppliers.length,
    categorias: catalogCategories.length,
    gastos: gastos.length,
    cajas: cajas.length,
  };

  // El cuerpo de cada catálogo; la cabecera y el botón de agregar son genéricos.
  const contenido = (id) => {
    if (id === 'sucursales') return (
      <DataTable
        rowKey={(b) => b.id}
        columns={branchColumns}
        rows={branches}
        density="compact"
        pageSize={12}
        onEdit={(b) => setModal({ type: 'sucursal', mode: 'edit', id: b.id, data: b })}
        empty={t('maintenance.noBranches', 'Sin sucursales')}
      />
    );
    if (id === 'proveedores') return (
      <DataTable
        rowKey={(s) => s.id}
        columns={supplierColumns}
        rows={suppliers}
        density="compact"
        pageSize={12}
        onEdit={(s) => setModal({ type: 'proveedor', mode: 'edit', id: s.id, data: s })}
        empty={t('maintenance.noSuppliers', 'Sin proveedores')}
      />
    );
    if (id === 'categorias') return (
      <DataTable
        rowKey={(c) => c.id}
        columns={categoryColumns}
        rows={catalogCategories}
        density="compact"
        pageSize={12}
        onEdit={(c) => setModal({ type: 'categoria', mode: 'edit', id: c.id, data: c })}
        empty={t('maintenance.noCategories', 'Sin categorías')}
      />
    );
    if (id === 'cajas') return (
      <>
        <DataTable
          rowKey={(c) => c.id}
          columns={cajaColumns}
          rows={cajas}
          density="compact"
          pageSize={12}
          onEdit={(c) => setModal({ type: 'caja', mode: 'edit', id: c.id, data: c })}
          empty={t('cash.noCashPoints', 'Sin cajas registradas')}
        />
        <div className="cfg-hint" style={{ marginTop: 12 }}>
          Una caja con un turno abierto no se puede eliminar hasta cerrarlo, y una con turnos
          registrados tampoco: su historial la ancla. Para sacarla de circulación, márcala como
          inactiva y dejará de ofrecerse al abrir turno.
        </div>
      </>
    );
    if (id === 'gastos') return (
      <>
        <DataTable
          rowKey={(g) => g.id}
          columns={gastoColumns}
          rows={gastos}
          density="compact"
          pageSize={12}
          onEdit={(g) => setModal({ type: 'gasto', mode: 'edit', id: g.id, data: g })}
          empty={t('maintenance.noCharges', 'Sin conceptos de gasto')}
        />
        <div className="cfg-hint" style={{ marginTop: 12 }}>
          Los marcados como <b>gasto operativo</b> suman al renglón fijo de Gastos operativos de la
          cotización. Los <b>fijos del sistema</b> no se pueden eliminar porque ese cálculo depende de
          ellos; si no los quieres en el selector, márcalos como inactivos.
        </div>
      </>
    );
    if (id === 'impuestos') return (
      <div className="grid-2">
        <div className="card">
          <div className="card-head"><h3>{t('maintenance.taxpayerData', 'Datos fiscales del contribuyente')}</h3></div>
          <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 14px', fontSize: 12 }}>
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
            <table className="mtable">
              <thead><tr><th>{t('common.code', 'Código')}</th><th>{t('common.name', 'Nombre')}</th><th className="r">{t('maintenance.rate', 'Tasa')}</th><th>{t('common.status', 'Estado')}</th></tr></thead>
              <tbody>
                <tr><td><span className="sku">IVA</span></td><td>Impuesto al Valor Agregado</td><td className="r num" style={{ fontWeight: 500 }}>12 %</td><td><span className="badge-m3 success">{t('common.active', 'Activo')}</span></td></tr>
                <tr><td><span className="sku">IDP</span></td><td>Impuesto Distribución Petróleo</td><td className="r num">—</td><td><span className="badge-m3">N/A</span></td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
    return null;
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('maintenance.title', 'Mantenimientos')}</h1>
          <div className="page-subtitle">{t('maintenance.subtitle', 'Catálogos maestros · Configuración de entidades del sistema')}</div>
        </div>
      </div>

      {/* Nivel 1 · sección del menú */}
      <div className="tabs">
        {ARBOL.map((item) => (
          <button key={item.id} type="button" className={`tab ${item.id === seccion.id ? 'active' : ''}`} onClick={() => irASeccion(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      <div className="maint-layout">
        {/* Nivel 2 · opción de menú dentro de la sección */}
        <nav className="maint-nav">
          {seccion.modulos.map((item) => (
            <div key={item.id}
              className={`nav-item ${item.id === modulo.id ? 'active' : ''}`}
              role="button" tabIndex={0}
              onClick={() => setModuloId(item.id)}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setModuloId(item.id); } }}>
              {item.icon && <Icon name={item.icon} size={13} className="icon" />}
              <span className="nav-item-label">{item.label}</span>
              {item.catalogos.length > 1 && <span className="badge mono">{item.catalogos.length}</span>}
            </div>
          ))}
        </nav>

        {/* Nivel 3 · los catálogos que se mantienen desde esa opción */}
        <div className="maint-panel">
          {modulo.catalogos.map((catalogo) => (
            <section key={catalogo.id} className="maint-catalogo">
              <div className="maint-catalogo-head">
                <h3>{catalogo.label}<span className="count mono">{CONTEO[catalogo.id] ?? ''}</span></h3>
                {catalogo.addLabel && (
                  <Button icon="plus" variant="accent" onClick={() => setModal({ type: catalogo.form, mode: 'new' })}>{catalogo.addLabel}</Button>
                )}
              </div>
              {contenido(catalogo.id)}
            </section>
          ))}
        </div>
      </div>

      {modal && (
        <CatalogModal
          spec={FORMS[modal.type]}
          branches={branches}
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
function CatalogModal({ spec, initial, isEdit, branches, onClose, onSave }) {
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
                {f.type === 'branch' ? (
                  <Autocomplete value={form[f.key]} onChange={(id) => set(f.key, id == null ? '' : String(id))}
                    options={(branches || []).map((b) => ({ id: b.id, name: b.name }))}
                    placeholder="Seleccionar sucursal…" emptyText="Sin sucursales" aria-label={f.label} />
                ) : f.type === 'select' ? (
                  <Autocomplete value={form[f.key]} onChange={(id) => set(f.key, id == null ? '' : String(id))}
                    options={f.options.map(([v, l]) => ({ id: v, name: l }))}
                    allowClear={false} emptyText="Sin opciones" aria-label={f.label} />
                ) : (
                  <input className="field-input" placeholder={f.placeholder || ''} value={form[f.key]} onChange={(e) => set(f.key, e.target.value)} />
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="modal-foot">
          <Button variant="ghost" onClick={onClose}>{t('common.cancel', 'Cancelar')}</Button>
          <Button icon="check" variant="accent" disabled={!valid || saving} onClick={submit}>{t('common.save', 'Guardar')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default MaintenanceModule;
