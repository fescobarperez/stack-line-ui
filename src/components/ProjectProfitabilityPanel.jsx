// Rentabilidad de proyectos: dónde se ganó más y dónde menos.
//
// Los números salen del backend, que es el único que sabe restar material
// pendiente, cargos de cotizaciones no aprobadas y órdenes de compra vivas.
// Recalcular aquí volvería a abrir la brecha entre esta pantalla y /projects.
import React, { useCallback, useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import StatCard from './StatCard.jsx';
import { getProjectProfitability } from '../api/reports.js';
import { useNavigate } from 'react-router-dom';

const Q = (v) => `Q ${Number(v || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const PCT = (v) => `${Number(v || 0).toFixed(1)}%`;

const ESTADOS = [
  { value: 'closed', label: 'Solo finalizados' },
  { value: 'closed,open', label: 'Finalizados y en curso' },
  { value: 'all', label: 'Todos' },
];

export default function ProjectProfitabilityPanel({ pushToast }) {
  const navigate = useNavigate();
  const [filtros, setFiltros] = useState({ limit: 5, orderBy: 'amount', status: 'closed' });
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const set = (k, v) => setFiltros((f) => ({ ...f, [k]: v }));

  const cargar = useCallback(async () => {
    setCargando(true);
    try { setDatos(await getProjectProfitability(filtros)); }
    catch (error) { pushToast?.(`No se pudo cargar la rentabilidad: ${error.message}`, 'danger'); }
    finally { setCargando(false); }
  }, [filtros, pushToast]);

  useEffect(() => { cargar(); }, [cargar]);

  const porPorcentaje = filtros.orderBy === 'percent';
  const abrirProyecto = (fila) => navigate('/projects', { state: { openProjectId: fila.projectId } });

  const tabla = (titulo, icono, color, filas) => (
    <div className="card">
      <div className="card-head">
        <h3><Icon name={icono} size={14} style={{ color, verticalAlign: '-2px', marginRight: 4 }} /> {titulo}</h3>
      </div>
      <div className="card-body flush">
        <table className="mtable">
          <thead><tr>
            <th>Proyecto</th>
            <th>Cliente</th>
            <th className="r">Contratado</th>
            <th className="r">Ejecutado</th>
            <th className="r">Margen</th>
            <th className="r">%</th>
          </tr></thead>
          <tbody>
            {filas.length === 0 && (
              <tr><td colSpan={6}><div className="empty" style={{ padding: 20 }}>Sin proyectos que cumplan el filtro</div></td></tr>
            )}
            {filas.map((f) => (
              <tr key={f.projectId} style={{ cursor: 'pointer' }} onClick={() => abrirProyecto(f)}>
                <td>
                  <div style={{ fontWeight: 500 }}>{f.name}</div>
                  <div className="sku muted">{f.code}</div>
                </td>
                <td>{f.clientName || '—'}</td>
                <td className="r num muted">{Q(f.contracted)}</td>
                <td className="r num muted">{Q(f.executed)}</td>
                <td className="r num" style={{ fontWeight: 500, color: Number(f.margin) < 0 ? 'var(--danger)' : 'var(--success)' }}>
                  {Q(f.margin)}
                </td>
                <td className="r num" style={{ color: Number(f.marginPct) < 0 ? 'var(--danger)' : 'inherit' }}>
                  {PCT(f.marginPct)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <>
      <div className="toolbar rentab-toolbar">
        <div className="field-group">
          <label className="field-label">Ordenar por</label>
          <select className="field-input" value={filtros.orderBy} onChange={(e) => set('orderBy', e.target.value)}>
            <option value="amount">Ganancia en quetzales</option>
            <option value="percent">Margen porcentual</option>
          </select>
        </div>
        <div className="field-group">
          <label className="field-label">Proyectos</label>
          <select className="field-input" value={filtros.status} onChange={(e) => set('status', e.target.value)}>
            {ESTADOS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="field-group">
          <label className="field-label">Cuántos</label>
          <select className="field-input" value={filtros.limit} onChange={(e) => set('limit', Number(e.target.value))}>
            {[3, 5, 10, 20].map((n) => <option key={n} value={n}>Top {n}</option>)}
          </select>
        </div>
      </div>

      {cargando && <div className="muted body-small" style={{ padding: '8px 0' }}>Cargando rentabilidad…</div>}

      {!cargando && datos && (
        <>
          <div className="stat-grid">
            <StatCard icon="box" tone="pri" label="Proyectos evaluados" value={datos.evaluated}
              foot={datos.statusFilter === 'closed' ? 'Solo finalizados' : datos.statusFilter === 'all' ? 'Todos los estados' : datos.statusFilter} />
            <StatCard icon="cash" tone="sec" label="Margen acumulado" value={Q(datos.totalMargin)}
              valueColor={Number(datos.totalMargin) < 0 ? 'var(--danger)' : 'var(--success)'} />
            <StatCard icon="chart" tone="ter" label="Margen promedio" value={PCT(datos.avgMarginPct)} />
          </div>

          {/* Un proyecto sin monto contratado no compite: el porcentaje seria una
              division por cero y en quetzales aparentaria una perdida del tamanio
              de su costo. Se avisa para que su ausencia no parezca un error. */}
          {datos.evaluated === 0 && (
            <div className="cfg-hint" style={{ marginBottom: 16 }}>
              Ningún proyecto cumple el filtro. Por defecto solo entran los finalizados, porque un
              proyecto en curso tiene el margen a medio cocinar. Cambia el filtro para incluir los
              que están en marcha.
            </div>
          )}

          <div className="grid-2 rentab-grid">
            {tabla(porPorcentaje ? 'Mejor margen %' : 'Donde más gané', 'chart', 'var(--success)', datos.best || [])}
            {tabla(porPorcentaje ? 'Peor margen %' : 'Donde menos gané', 'alert', 'var(--warning)', datos.worst || [])}
          </div>
        </>
      )}
    </>
  );
}
