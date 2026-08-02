// ERP MAYA — ReportsModule (ES module)
// Ventas/Rentabilidad/Fiscal: /api/reports/sales (hook useReports). Compras: hooks
// usePurchaseOrders/useSuppliers. Caja: historial inline (sin endpoint de cierres).
import { AreaChart } from './Dashboard.jsx';
import Icon from '../components/Icon.jsx';
import { useReports } from '../hooks/useReports.js';
import { usePurchaseOrders } from '../hooks/useOperations.js';
import { useSuppliers } from '../hooks/useMasters.js';
import React, { useState as useStateRpt } from 'react';
import { useTranslation } from 'react-i18next';

const Q = (v) => `Q ${Number(v || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const Qs = Q;
const daysFor = { hoy: 1, '7d': 7, '14d': 14, '30d': 30, '90d': 90, mtd: 30, ytd: 365 };

function ReportsModule() {
  const { t } = useTranslation();
  const [section, setSection] = useStateRpt('ventas');
  const [range, setRange] = useStateRpt('30d');

  const { data: rpt, source } = useReports(daysFor[range] || 30);
  const { items: purchaseOrders } = usePurchaseOrders();
  const { items: suppliers } = useSuppliers();

  const totalPurchases = purchaseOrders.filter((p) => p.status !== 'cancelled').reduce((s, p) => s + Number(p.total || 0), 0);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('reports.title', 'Reportería')}</h1>
          <div className="page-subtitle">
            {t('reports.subtitle', 'Análisis de ventas, compras y rentabilidad')}
            {source === 'mock' && <span className="pill" style={{ marginLeft: 8, fontSize: 10 }}>demo</span>}
          </div>
        </div>
        <div className="page-head-actions">
          <div className="filterbar" style={{ margin: 0, padding: '4px 6px' }}>
            {['Hoy', '7d', '14d', '30d', '90d', 'MTD', 'YTD'].map((r) => (
              <button key={r} className={`chip ${range === r.toLowerCase() ? 'active' : ''}`} onClick={() => setRange(r.toLowerCase())}>{r}</button>
            ))}
          </div>
          <button className="btn"><Icon name="download" />{t('reports.export', 'Excel')}</button>
        </div>
      </div>

      <div className="tabs">
        <div className={`tab ${section === 'ventas' ? 'active' : ''}`} onClick={() => setSection('ventas')}>{t('reports.tabs.sales', 'Reportes de ventas')}</div>
        <div className={`tab ${section === 'compras' ? 'active' : ''}`} onClick={() => setSection('compras')}>Reportes de compras</div>
        <div className={`tab ${section === 'rentabilidad' ? 'active' : ''}`} onClick={() => setSection('rentabilidad')}>Rentabilidad &amp; márgenes</div>
        <div className={`tab ${section === 'fiscal' ? 'active' : ''}`} onClick={() => setSection('fiscal')}>Reportes fiscales (SAT)</div>
      </div>

      {section === 'ventas' && (
        <>
          <div className="stat-grid">
            <div className="stat">
              <div className="label"><Icon name="cash" size={11} />Ventas totales</div>
              <div className="val mono">{Qs(rpt.totalSales)}</div>
            </div>
            <div className="stat">
              <div className="label"><Icon name="receipt" size={11} />Tickets emitidos</div>
              <div className="val mono">{rpt.totalTickets.toLocaleString()}</div>
            </div>
            <div className="stat">
              <div className="label"><Icon name="chart" size={11} />{t('dashboard.kpis.avgTicket', 'Ticket promedio')}</div>
              <div className="val mono">{Q(rpt.avgTicket)}</div>
            </div>
            <div className="stat">
              <div className="label"><Icon name="branch" size={11} />Sucursales con ventas</div>
              <div className="val mono">{rpt.byBranch.length}</div>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><div><h3>Tendencia de ventas</h3><div className="meta">Q · diario</div></div></div>
            <div className="card-body"><AreaChart data={rpt.trend} /></div>
          </div>

          <div className="grid-2 mt-12">
            <div className="card">
              <div className="card-head"><h3>Ventas por sucursal</h3></div>
              <div className="card-body flush">
                <table className="tbl">
                  <thead><tr><th>{t('common.branch', 'Sucursal')}</th><th className="num">Tickets</th><th className="num">Ventas</th><th className="num">Promedio</th><th className="num">% Total</th></tr></thead>
                  <tbody>
                    {rpt.byBranch.length === 0 && <tr><td colSpan={5}><div className="empty" style={{ padding: 20 }}>Sin ventas en el período</div></td></tr>}
                    {rpt.byBranch.map((b) => (
                      <tr key={b.id}>
                        <td style={{ fontWeight: 500 }}>{b.name}</td>
                        <td className="num">{b.tickets.toLocaleString()}</td>
                        <td className="num" style={{ fontWeight: 600 }}>{Qs(b.total)}</td>
                        <td className="num">{Q(b.tickets ? b.total / b.tickets : 0)}</td>
                        <td className="num">{b.pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card">
              <div className="card-head"><h3>Ventas por método de pago</h3></div>
              <div className="card-body">
                {rpt.byPayment.length === 0 && <div className="empty" style={{ padding: 20 }}>Sin datos</div>}
                {rpt.byPayment.map((r) => (
                  <div key={r.method} style={{ marginBottom: 14 }}>
                    <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4, fontSize: 12.5 }}>
                      <span style={{ fontWeight: 500 }}>{r.method}</span>
                      <span><span className="mono" style={{ fontWeight: 600 }}>{Qs(r.total)}</span> <span className="muted mono">({r.pct}%)</span></span>
                    </div>
                    <div className="bar"><div style={{ width: r.pct + '%' }} /></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card mt-12">
            <div className="card-head"><h3>{t('dashboard.charts.topProducts', 'Top productos vendidos')}</h3></div>
            <div className="card-body flush">
              <table className="tbl">
                <thead><tr><th>#</th><th>{t('common.product', 'Producto')}</th><th className="num">{t('common.quantity', 'Unidades')}</th><th className="num">Ventas</th></tr></thead>
                <tbody>
                  {rpt.topProducts.length === 0 && <tr><td colSpan={4}><div className="empty" style={{ padding: 20 }}>Sin ventas</div></td></tr>}
                  {rpt.topProducts.map((p, i) => (
                    <tr key={p.sku}>
                      <td className="code">{String(i + 1).padStart(2, '0')}</td>
                      <td><div style={{ fontWeight: 500 }}>{p.name}</div><div className="code muted" style={{ fontSize: 10.5 }}>{p.sku}</div></td>
                      <td className="num">{p.qty}</td>
                      <td className="num" style={{ fontWeight: 600 }}>{Q(p.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {section === 'compras' && (
        <>
          <div className="stat-grid">
            <div className="stat">
              <div className="label"><Icon name="truck" size={11} />Compras (OCs)</div>
              <div className="val mono">{Qs(totalPurchases)}</div>
            </div>
            <div className="stat">
              <div className="label"><Icon name="receipt" size={11} />Órdenes</div>
              <div className="val mono">{purchaseOrders.length}</div>
              <div className="delta muted">{purchaseOrders.filter((p) => p.status === 'pending').length} {t('common.pending', 'pendientes')}</div>
            </div>
            <div className="stat">
              <div className="label"><Icon name="supplier" size={11} />Proveedores</div>
              <div className="val mono">{suppliers.length}</div>
            </div>
            <div className="stat">
              <div className="label"><Icon name="cash" size={11} />Cuentas por pagar</div>
              <div className="val mono" style={{ color: 'var(--warning)' }}>{Qs(suppliers.reduce((s, sp) => s + Number(sp.balance || 0), 0))}</div>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3>Órdenes de compra</h3></div>
            <div className="card-body flush">
              <table className="tbl">
                <thead><tr><th>No. OC</th><th>{t('common.date', 'Fecha')}</th><th>{t('common.supplier', 'Proveedor')}</th><th className="num">{t('common.total', 'Total')}</th><th>{t('common.status', 'Estado')}</th></tr></thead>
                <tbody>
                  {purchaseOrders.length === 0 && <tr><td colSpan={5}><div className="empty" style={{ padding: 20 }}>Sin órdenes de compra</div></td></tr>}
                  {purchaseOrders.map((po) => (
                    <tr key={po.id}>
                      <td className="code" style={{ color: 'var(--accent)', fontWeight: 600 }}>{po.docNumber || po.id}</td>
                      <td className="code">{(po.orderDate || po.date || '').toString().slice(0, 10)}</td>
                      <td>{po.supplierName || po.supplier || '—'}</td>
                      <td className="num" style={{ fontWeight: 600 }}>{Q(po.total)}</td>
                      <td><span className="pill">{po.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card mt-12">
            <div className="card-head"><h3>Proveedores &amp; saldos</h3></div>
            <div className="card-body flush">
              <table className="tbl">
                <thead><tr><th>#</th><th>{t('common.supplier', 'Proveedor')}</th><th>NIT</th><th className="num">Saldo</th></tr></thead>
                <tbody>
                  {suppliers.length === 0 && <tr><td colSpan={4}><div className="empty" style={{ padding: 20 }}>Sin proveedores</div></td></tr>}
                  {suppliers.map((s, i) => (
                    <tr key={s.id}>
                      <td className="code">{String(i + 1).padStart(2, '0')}</td>
                      <td style={{ fontWeight: 500 }}>{s.name}</td>
                      <td className="code">{s.nit || '—'}</td>
                      <td className="num" style={{ fontWeight: 600 }}>{Q(s.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {section === 'rentabilidad' && (
        <>
          <div className="stat-grid">
            <div className="stat">
              <div className="label">Ingresos brutos</div>
              <div className="val mono">{Qs(rpt.totalSales)}</div>
            </div>
            <div className="stat">
              <div className="label">Costo de ventas</div>
              <div className="val mono">{Qs(rpt.byCategory.reduce((s, c) => s + c.cost, 0))}</div>
            </div>
            <div className="stat">
              <div className="label">{t('dashboard.kpis.gross', 'Utilidad bruta')}</div>
              <div className="val mono" style={{ color: 'var(--success)' }}>{Qs(rpt.byCategory.reduce((s, c) => s + c.profit, 0))}</div>
            </div>
            <div className="stat">
              <div className="label">Categorías</div>
              <div className="val mono">{rpt.byCategory.length}</div>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3>Análisis de margen por categoría</h3></div>
            <div className="card-body flush">
              <table className="tbl">
                <thead><tr><th>{t('common.category', 'Categoría')}</th><th className="num">Ventas</th><th className="num">{t('common.cost', 'Costo')}</th><th className="num">Utilidad</th><th className="num">{t('common.margin', 'Margen')} %</th></tr></thead>
                <tbody>
                  {rpt.byCategory.length === 0 && <tr><td colSpan={5}><div className="empty" style={{ padding: 20 }}>Sin ventas en el período</div></td></tr>}
                  {rpt.byCategory.map((c) => (
                    <tr key={c.cat}>
                      <td style={{ fontWeight: 500 }}>{c.cat}</td>
                      <td className="num">{Qs(c.sales)}</td>
                      <td className="num muted">{Qs(c.cost)}</td>
                      <td className="num" style={{ fontWeight: 600, color: 'var(--success)' }}>{Qs(c.profit)}</td>
                      <td className="num" style={{ fontWeight: 600, color: c.marginPct > 35 ? 'var(--success)' : c.marginPct > 20 ? 'var(--text-2)' : 'var(--warning)' }}>{c.marginPct.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {section === 'fiscal' && (
        <div className="card">
          <div className="card-head"><h3>Libro de Ventas (SAT)</h3><button className="btn sm"><Icon name="download" />Excel SAT</button></div>
          <div className="card-body flush">
            <table className="tbl">
              <thead><tr><th>Día</th><th className="num">Facturas</th><th className="num">Gravable</th><th className="num">IVA 12%</th><th className="num">{t('common.total', 'Total')}</th></tr></thead>
              <tbody>
                {rpt.salesBook.length === 0 && <tr><td colSpan={5}><div className="empty" style={{ padding: 20 }}>Sin ventas en el período</div></td></tr>}
                {rpt.salesBook.map((d) => (
                  <tr key={d.d}>
                    <td className="code">{d.d}</td>
                    <td className="num">{d.tickets}</td>
                    <td className="num">{Qs(d.taxable)}</td>
                    <td className="num muted">{Qs(d.iva)}</td>
                    <td className="num" style={{ fontWeight: 600 }}>{Qs(d.total)}</td>
                  </tr>
                ))}
                <tr style={{ background: 'var(--surface-2)' }}>
                  <td style={{ fontWeight: 700 }}>{t('common.total', 'TOTAL')}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{rpt.salesBook.reduce((s, d) => s + d.tickets, 0)}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{Qs(rpt.salesBook.reduce((s, d) => s + d.taxable, 0))}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{Qs(rpt.salesBook.reduce((s, d) => s + d.iva, 0))}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{Qs(rpt.salesBook.reduce((s, d) => s + d.total, 0))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default ReportsModule;
