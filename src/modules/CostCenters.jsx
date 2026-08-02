// ERP MAYA — Centros de Costo (catálogo)
// Data-driven contra /api/cost-centers (hook useCostCenters). El análisis de gasto
// por centro se omite: el backend aún no etiqueta transacciones con centro de costo.
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from '../components/Icon.jsx';
import { useCostCenters } from '../hooks/useMasters.js';
import { createCostCenter, updateCostCenter } from '../api/wave2.js';

const Q = (v) => `Q ${Number(v || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const GROUPS = ['Sucursales', 'Administración', 'Operación'];
const TYPE_LABEL = { profit: 'Centro de Utilidad', cost: 'Centro de Costo' };
const TYPE_CLASS = { profit: 'success', cost: '' };

function CenterModal({ center, onSave, onClose }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(center || { code: '', name: '', group: GROUPS[0], type: 'cost', responsible: '', budget: '', active: true });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const valid = form.code.trim() && form.name.trim() && Number(form.budget) >= 0;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 400 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">{center ? t('costcenters.editCenter', 'Editar centro') : t('costcenters.newCenter', 'Nuevo centro de costo')}</span>
          <button className="icon-btn" onClick={onClose}><Icon name="close" /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field-group">
              <label className="field-label">{t('common.code', 'Código')}</label>
              <input className="field-input" placeholder="CC-XXX" value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} disabled={!!center} />
            </div>
            <div className="field-group">
              <label className="field-label">{t('common.type', 'Tipo')}</label>
              <select className="field-input" value={form.type} onChange={(e) => set('type', e.target.value)}>
                <option value="cost">{t('costcenters.typeCost', 'Centro de Costo')}</option>
                <option value="profit">{t('costcenters.typeProfit', 'Centro de Utilidad')}</option>
              </select>
            </div>
          </div>
          <div className="field-group">
            <label className="field-label">{t('common.name', 'Nombre')}</label>
            <input className="field-input" placeholder={t('costcenters.namePlaceholder', 'Nombre del centro')} value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div className="field-group">
            <label className="field-label">{t('costcenters.group', 'Grupo')}</label>
            <select className="field-input" value={form.group} onChange={(e) => set('group', e.target.value)}>
              {GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="field-group">
            <label className="field-label">{t('costcenters.monthlyBudget', 'Presupuesto mensual (Q)')}</label>
            <input className="field-input" type="number" min="0" step="100" placeholder="0.00" value={form.budget} onChange={(e) => set('budget', e.target.value)} />
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn-ghost" onClick={onClose}>{t('common.cancel', 'Cancelar')}</button>
          <button className="btn" disabled={!valid} onClick={() => onSave({ ...form, budget: Number(form.budget) })}>
            {center ? t('costcenters.saveChanges', 'Guardar cambios') : t('costcenters.createCenter', 'Crear centro')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CostCenters({ pushToast }) {
  const { t } = useTranslation();
  const { items: centers, source, reload } = useCostCenters();
  const [editTarget, setEditTarget] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const groups = useMemo(() => {
    const present = [...new Set(centers.map((c) => c.group))];
    return [...GROUPS.filter((g) => present.includes(g)), ...present.filter((g) => !GROUPS.includes(g))];
  }, [centers]);

  const activeCount = centers.filter((c) => c.active).length;
  const totalBudget = centers.filter((c) => c.active).reduce((s, c) => s + c.budget, 0);

  const openEdit = (c) => { setEditTarget(c); setShowModal(true); };
  const openNew = () => { setEditTarget(null); setShowModal(true); };

  const toApi = (form) => ({
    code: form.code, name: form.name, costGroup: form.group, centerType: form.type,
    responsibleUserId: null, budget: form.budget, active: form.active,
  });

  const saveCenter = async (form) => {
    try {
      if (editTarget) await updateCostCenter(editTarget.id, toApi(form));
      else await createCostCenter(toApi(form));
      await reload();
      pushToast(`Centro "${form.name}" ${editTarget ? 'actualizado' : 'creado'}`, 'success');
      setShowModal(false);
    } catch (err) {
      pushToast('No se pudo guardar el centro: ' + err.message, 'error');
    }
  };

  const toggleActive = async (c) => {
    try {
      await updateCostCenter(c.id, toApi({ ...c, active: !c.active }));
      await reload();
    } catch (err) {
      pushToast('No se pudo cambiar el estado: ' + err.message, 'error');
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-title">{t('costcenters.title', 'Centros de Costo')}</div>
          <div className="page-sub">
            {t('costcenters.subtitle', 'Catálogo de centros de costo y utilidad')}
            {source === 'mock' && <span className="pill" style={{ marginLeft: 8, fontSize: 10 }}>demo</span>}
          </div>
        </div>
        <div className="page-head-actions">
          <button className="btn" onClick={openNew}><Icon name="plus" size={12} /> {t('costcenters.newCenter', 'Nuevo centro')}</button>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="label">{t('costcenters.activeCenters', 'Centros activos')}</div>
          <div className="value">{activeCount}</div>
          <div className="sub muted">{centers.length} {t('costcenters.inTotal', 'en total')}</div>
        </div>
        <div className="stat-card">
          <div className="label">{t('costcenters.totalBudget', 'Presupuesto total')}</div>
          <div className="value">{Q(totalBudget)}</div>
          <div className="sub muted">mensual · centros activos</div>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap" style={{ border: 'none', margin: 0 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>{t('common.code', 'Código')}</th>
                <th>{t('common.name', 'Nombre')}</th>
                <th>{t('costcenters.group', 'Grupo')}</th>
                <th>{t('common.type', 'Tipo')}</th>
                <th>{t('costcenters.responsible', 'Responsable')}</th>
                <th style={{ textAlign: 'right' }}>{t('costcenters.monthlyBudget', 'Presupuesto / mes')}</th>
                <th>{t('common.status', 'Estado')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {centers.length === 0 && <tr><td colSpan={8}><div className="empty" style={{ padding: 24 }}>Sin centros de costo</div></td></tr>}
              {groups.map((grp) => (
                <React.Fragment key={grp}>
                  <tr className="fs-section-hdr"><td colSpan={8}>{grp.toUpperCase()}</td></tr>
                  {centers.filter((c) => c.group === grp).map((c) => (
                    <tr key={c.id} style={{ opacity: c.active ? 1 : 0.55 }}>
                      <td><span className="mono" style={{ fontWeight: 700, fontSize: 12 }}>{c.code}</span></td>
                      <td style={{ fontWeight: 500 }}>{c.name}</td>
                      <td className="muted">{c.group}</td>
                      <td><span className={`pill ${TYPE_CLASS[c.type]}`}>{TYPE_LABEL[c.type] || c.type}</span></td>
                      <td style={{ fontSize: 12.5 }}>{c.responsible || '—'}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{Q(c.budget)}</td>
                      <td><span className={`pill ${c.active ? 'success' : ''}`}>{c.active ? t('common.active', 'Activo') : t('common.inactive', 'Inactivo')}</span></td>
                      <td style={{ display: 'flex', gap: 4 }}>
                        <button className="btn-ghost" onClick={() => openEdit(c)}>{t('common.edit', 'Editar')}</button>
                        <button className="btn-ghost" onClick={() => toggleActive(c)}>{c.active ? t('costcenters.deactivate', 'Desactivar') : t('costcenters.activate', 'Activar')}</button>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && <CenterModal center={editTarget} onSave={saveCenter} onClose={() => setShowModal(false)} />}
    </div>
  );
}
