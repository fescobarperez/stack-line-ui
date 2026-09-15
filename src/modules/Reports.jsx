// Stackline — ReportsModule (ES module)
// Ventas/Rentabilidad/Fiscal: /api/reports/sales (hook useReports). Compras: hooks
// usePurchaseOrders/useSuppliers. Caja: historial inline (sin endpoint de cierres).
import { AreaChart } from './Dashboard.jsx';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import StatCard from '../components/StatCard.jsx';
import { useReports } from '../hooks/useReports.js';
import { usePurchaseOrders } from '../hooks/useOperations.js';
import { useSuppliers } from '../hooks/useMasters.js';
import ProjectProfitabilityPanel from '../components/ProjectProfitabilityPanel.jsx';
import React, { useState as useStateRpt } from 'react';
import { useTranslation } from 'react-i18next';
import { etiquetaMetodoPago } from '../lib/pagos.js';
import { descargaXlsx } from '../lib/xlsx.js';
import { useTaxRate } from '../hooks/useOperations.js';
import { hoyISO, fechaISO } from '../lib/fechas.js';

const Q = (v) => `Q ${Number(v || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const Qs = Q;
const daysFor = { hoy: 1, '7d': 7, '14d': 14, '30d': 30, '90d': 90, mtd: 30, ytd: 365 };
// Cuántas ventas se pintan en la tabla de detalle antes de recortar.
const MAX_DETALLE = 200;

function ReportsModule({ pushToast }) {
  const { t } = useTranslation();
  const [section, setSection] = useStateRpt('ventas');
  const [range, setRange] = useStateRpt('30d');

  const { data: rpt, source } = useReports(daysFor[range] || 30);
  const { items: purchaseOrders } = usePurchaseOrders();
  const { items: suppliers } = useSuppliers();
  const taxRate = useTaxRate();
  // La rentabilidad de proyectos la carga su propio panel con sus filtros; nos
  // avisa de lo que trae para poder exportarlo desde aqui.
  const [rentabProyectos, setRentabProyectos] = useStateRpt(null);

  const totalPurchases = purchaseOrders.filter((p) => p.status !== 'cancelled').reduce((s, p) => s + Number(p.total || 0), 0);

  // Se exporta lo que la pestaña activa está mostrando, con los mismos filtros
  // de rango que hay en pantalla. Cada tarjeta se vuelca en su propia pestaña
  // del libro, y `moneda` marca qué columnas llevan formato de importe: el
  // valor de la celda sigue siendo el número crudo, para que las fórmulas que
  // alguien escriba encima sigan funcionando.
  const n = (v) => Number(v || 0);

  const bloquesExport = () => {
    if (section === 'ventas') return [
      { titulo: 'Resumen', cabeceras: ['Indicador', 'Valor'], filas: [
        ['Ventas totales (Q)', n(rpt.totalSales)],
        ['Tickets emitidos', rpt.totalTickets],
        ['Ticket promedio (Q)', n(rpt.avgTicket)],
        ['Sucursales con ventas', rpt.byBranch.length],
      ] },
      { titulo: 'Tendencia de ventas', cabeceras: ['Fecha', 'Ventas (Q)', 'Tickets'], moneda: [1],
        filas: rpt.trend.map((p) => [p.d, n(p.total), p.tickets]) },
      { titulo: 'Ventas por sucursal', cabeceras: ['Sucursal', 'Tickets', 'Total (Q)', 'Ticket promedio (Q)', '%'], moneda: [2, 3],
        filas: rpt.byBranch.map((b) => [b.name, b.tickets, n(b.total), n(b.tickets ? b.total / b.tickets : 0), b.pct]) },
      { titulo: 'Ventas por método de pago', cabeceras: ['Método', 'Total (Q)', '%'], moneda: [1],
        filas: rpt.byPayment.map((r) => [etiquetaMetodoPago(r.method, t), n(r.total), r.pct]) },
      { titulo: 'Top productos vendidos', cabeceras: ['#', 'SKU', 'Producto', 'Unidades', 'Ventas (Q)'], moneda: [4],
        filas: rpt.topProducts.map((p, i) => [i + 1, p.sku, p.name, p.qty, n(p.total)]) },
      { titulo: 'Detalle de ventas',
        cabeceras: ['Documento', 'Tipo', 'Fecha', 'NIT', 'Cliente', 'Método de pago', 'Estado', 'Subtotal (Q)', 'IVA (Q)', 'Total (Q)'],
        moneda: [7, 8, 9],
        filas: rpt.salesDetail.map((v) => [v.doc, v.docType, fechaISO(v.date), v.nit || 'C/F',
          v.client || 'Consumidor final', etiquetaMetodoPago(v.method, t), v.status,
          n(v.subtotal), n(v.iva), n(v.total)]) },
    ];

    if (section === 'compras') return [
      { titulo: 'Resumen', cabeceras: ['Indicador', 'Valor'], filas: [
        ['Compras en órdenes (Q)', n(totalPurchases)],
        ['Órdenes', purchaseOrders.length],
        ['Órdenes pendientes', purchaseOrders.filter((p) => p.status === 'pending').length],
        ['Proveedores', suppliers.length],
        ['Cuentas por pagar (Q)', n(suppliers.reduce((acc, sp) => acc + Number(sp.balance || 0), 0))],
      ] },
      { titulo: 'Órdenes de compra', cabeceras: ['No. OC', 'Fecha', 'Proveedor', 'Total (Q)', 'Estado'], moneda: [3],
        filas: purchaseOrders.map((po) => [String(po.docNumber || po.id), (po.orderDate || po.date || '').toString().slice(0, 10),
          po.supplierName || po.supplier || '', n(po.total), po.status]) },
      { titulo: 'Proveedores y saldos', cabeceras: ['#', 'Proveedor', 'NIT', 'Saldo (Q)'], moneda: [3],
        filas: suppliers.map((sp, i) => [i + 1, sp.name, sp.nit || '', n(sp.balance)]) },
    ];

    if (section === 'rentabilidad') return [
      { titulo: 'Resumen', cabeceras: ['Indicador', 'Valor'], filas: [
        ['Ingresos brutos (Q)', n(rpt.totalSales)],
        ['Costo de ventas (Q)', n(rpt.byCategory.reduce((acc, c) => acc + c.cost, 0))],
        ['Utilidad bruta (Q)', n(rpt.byCategory.reduce((acc, c) => acc + c.profit, 0))],
        ['Categorías', rpt.byCategory.length],
      ] },
      { titulo: 'Margen por categoría', cabeceras: ['Categoría', 'Ventas (Q)', 'Costo (Q)', 'Utilidad (Q)', 'Margen %'], moneda: [1, 2, 3],
        filas: rpt.byCategory.map((c) => [c.cat, n(c.sales), n(c.cost), n(c.profit), n(c.marginPct)]) },
    ];

    if (section === 'fiscal') return [
      { titulo: 'Libro de Ventas (SAT)',
        cabeceras: ['Día', 'Facturas', 'Gravable (Q)', `IVA ${taxRate}% (Q)`, 'Total (Q)'],
        moneda: [2, 3, 4],
        filas: [
          ...rpt.salesBook.map((d) => [d.d, d.tickets, n(d.taxable), n(d.iva), n(d.total)]),
          ['TOTAL',
            rpt.salesBook.reduce((acc, d) => acc + d.tickets, 0),
            rpt.salesBook.reduce((acc, d) => acc + n(d.taxable), 0),
            rpt.salesBook.reduce((acc, d) => acc + n(d.iva), 0),
            rpt.salesBook.reduce((acc, d) => acc + n(d.total), 0)],
        ] },
    ];

    if (section === 'proyectos') {
      const d = rentabProyectos;
      if (!d) return [];
      const filas = (lista) => (lista || []).map((f) => [f.code, f.name, f.clientName || '',
        n(f.contracted), n(f.executed), n(f.margin), n(f.marginPct)]);
      const cab = ['Código', 'Proyecto', 'Cliente', 'Contratado (Q)', 'Ejecutado (Q)', 'Margen (Q)', 'Margen %'];
      const mon = [3, 4, 5];
      return [
        { titulo: 'Resumen', cabeceras: ['Indicador', 'Valor'], filas: [
          ['Proyectos evaluados', d.evaluated],
          ['Margen acumulado (Q)', n(d.totalMargin)],
          ['Margen promedio %', n(d.avgMarginPct)],
        ] },
        { titulo: 'Donde más gané', cabeceras: cab, moneda: mon, filas: filas(d.best) },
        { titulo: 'Donde menos gané', cabeceras: cab, moneda: mon, filas: filas(d.worst) },
      ];
    }

    return [];
  };

  const exportar = () => {
    const filas = descargaXlsx(`reporte-${section}-${range}-${hoyISO()}`, bloquesExport());
    if (!filas) {
      pushToast?.('No hay datos que exportar en esta pestaña');
      return;
    }
    pushToast?.(`Reporte exportado · ${filas} filas`, 'success');
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('reports.title', 'Reportería')}</h1>
          <div className="page-subtitle">
            {t('reports.subtitle', 'Análisis de ventas, compras y rentabilidad')}
            {source === 'mock' && <span className="badge-m3" style={{ marginLeft: 8 }}>demo</span>}
          </div>
        </div>
        <div className="page-head-actions">
          <div className="filterbar" style={{ margin: 0, padding: '4px 6px' }}>
            {['Hoy', '7d', '14d', '30d', '90d', 'MTD', 'YTD'].map((r) => (
              <button key={r} className={`chip ${range === r.toLowerCase() ? 'active' : ''}`} onClick={() => setRange(r.toLowerCase())}>{r}</button>
            ))}
          </div>
          <Button icon="download" onClick={exportar}>{t('reports.export', 'Excel')}</Button>
        </div>
      </div>

      <div className="tabs">
        <div className={`tab ${section === 'ventas' ? 'active' : ''}`} onClick={() => setSection('ventas')}>{t('reports.tabs.sales', 'Reportes de ventas')}</div>
        <div className={`tab ${section === 'compras' ? 'active' : ''}`} onClick={() => setSection('compras')}>Reportes de compras</div>
        <div className={`tab ${section === 'rentabilidad' ? 'active' : ''}`} onClick={() => setSection('rentabilidad')}>Rentabilidad &amp; márgenes</div>
        <div className={`tab ${section === 'proyectos' ? 'active' : ''}`} onClick={() => setSection('proyectos')}>Rentabilidad de proyectos</div>
        <div className={`tab ${section === 'fiscal' ? 'active' : ''}`} onClick={() => setSection('fiscal')}>Reportes fiscales (SAT)</div>
      </div>

      {section === 'ventas' && (
        <>
          <div className="stat-grid">
            <StatCard
              icon="cash" tone="pri"
              label="Ventas totales"
              value={Qs(rpt.totalSales)}
            />
            <StatCard
              icon="receipt" tone="ter"
              label="Tickets emitidos"
              value={rpt.totalTickets.toLocaleString()}
            />
            <StatCard
              icon="chart" tone="sec"
              label={t('dashboard.kpis.avgTicket', 'Ticket promedio')}
              value={Q(rpt.avgTicket)}
            />
            <StatCard
              icon="branch" tone="err"
              label="Sucursales con ventas"
              value={rpt.byBranch.length}
            />
          </div>

          <div className="card">
            <div className="card-head"><div><h3>Tendencia de ventas</h3><div className="meta">Q · diario</div></div></div>
            <div className="card-body"><AreaChart data={rpt.trend} /></div>
          </div>

          <div className="grid-2 mt-12">
            <div className="card">
              <div className="card-head"><h3>Ventas por sucursal</h3></div>
              <div className="card-body flush">
                <table className="mtable">
                  <thead><tr><th>{t('common.branch', 'Sucursal')}</th><th className="num">Tickets</th><th className="num">Ventas</th><th className="num">Promedio</th><th className="num">% Total</th></tr></thead>
                  <tbody>
                    {rpt.byBranch.length === 0 && <tr><td colSpan={5}><div className="empty" style={{ padding: 20 }}>Sin ventas en el período</div></td></tr>}
                    {rpt.byBranch.map((b) => (
                      <tr key={b.id}>
                        <td style={{ fontWeight: 500 }}>{b.name}</td>
                        <td className="num">{b.tickets.toLocaleString()}</td>
                        <td className="num" style={{ fontWeight: 500 }}>{Qs(b.total)}</td>
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
                    <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                      <span style={{ fontWeight: 500 }}>{etiquetaMetodoPago(r.method, t)}</span>
                      <span><span className="mono" style={{ fontWeight: 500 }}>{Qs(r.total)}</span> <span className="muted mono">({r.pct}%)</span></span>
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
              <table className="mtable">
                <thead><tr><th>#</th><th>{t('common.product', 'Producto')}</th><th className="num">{t('common.quantity', 'Unidades')}</th><th className="num">Ventas</th></tr></thead>
                <tbody>
                  {rpt.topProducts.length === 0 && <tr><td colSpan={4}><div className="empty" style={{ padding: 20 }}>Sin ventas</div></td></tr>}
                  {rpt.topProducts.map((p, i) => (
                    <tr key={p.sku}>
                      <td className="code">{String(i + 1).padStart(2, '0')}</td>
                      <td><div style={{ fontWeight: 500 }}>{p.name}</div><div className="code muted" style={{ fontSize: 11 }}>{p.sku}</div></td>
                      <td className="num">{p.qty}</td>
                      <td className="num" style={{ fontWeight: 500 }}>{Q(p.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {section === 'ventas' && (
        <div className="card mt-12">
          <div className="card-head">
            <h3>Detalle de ventas</h3>
            <span className="body-small muted">
              {rpt.salesDetail.length} {rpt.salesDetail.length === 1 ? 'venta' : 'ventas'} en el período
            </span>
          </div>
          <div className="card-body flush">
            <div style={{ maxHeight: 460, overflow: 'auto' }}>
              <table className="mtable">
                <thead><tr>
                  <th>Documento</th>
                  <th>{t('common.date', 'Fecha')}</th>
                  <th>NIT</th>
                  <th>{t('common.client', 'Cliente')}</th>
                  <th>{t('projects.method', 'Método')}</th>
                  <th className="num">Subtotal</th>
                  <th className="num">IVA</th>
                  <th className="num">{t('common.total', 'Total')}</th>
                </tr></thead>
                <tbody>
                  {rpt.salesDetail.length === 0 && (
                    <tr><td colSpan={8}><div className="empty" style={{ padding: 20 }}>Sin ventas en el período</div></td></tr>
                  )}
                  {rpt.salesDetail.slice(0, MAX_DETALLE).map((v) => (
                    <tr key={v.id}>
                      <td className="code" style={{ color: 'var(--accent)', fontWeight: 500 }}>{v.doc}</td>
                      <td className="code">{fechaISO(v.date)}</td>
                      <td className="code">{v.nit || 'C/F'}</td>
                      <td>{v.client || <span className="muted">Consumidor final</span>}</td>
                      <td><span className="badge-m3">{etiquetaMetodoPago(v.method, t)}</span></td>
                      <td className="num muted">{Qs(v.subtotal)}</td>
                      <td className="num muted">{Qs(v.iva)}</td>
                      <td className="num" style={{ fontWeight: 500 }}>{Qs(v.total)}</td>
                    </tr>
                  ))}
                  {rpt.salesDetail.length > 0 && (
                    <tr style={{ background: 'var(--surface-2)' }}>
                      <td colSpan={5} style={{ fontWeight: 500 }}>{t('common.total', 'TOTAL')}</td>
                      <td className="num" style={{ fontWeight: 500 }}>{Qs(rpt.salesDetail.reduce((a, v) => a + v.subtotal, 0))}</td>
                      <td className="num" style={{ fontWeight: 500 }}>{Qs(rpt.salesDetail.reduce((a, v) => a + v.iva, 0))}</td>
                      <td className="num" style={{ fontWeight: 500 }}>{Qs(rpt.salesDetail.reduce((a, v) => a + v.total, 0))}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {/* La tabla se recorta para que el navegador no tenga que pintar un año
              entero de ventas; el archivo exportado sí las trae todas. */}
          {rpt.salesDetail.length > MAX_DETALLE && (
            <div className="cfg-hint" style={{ margin: '0 16px 16px' }}>
              Mostrando las {MAX_DETALLE} más recientes de {rpt.salesDetail.length}. El archivo exportado
              incluye todas, y los totales de arriba ya suman el período completo.
            </div>
          )}
        </div>
      )}

      {section === 'compras' && (
        <>
          <div className="stat-grid">
            <StatCard
              icon="truck" tone="pri"
              label="Compras (OCs)"
              value={Qs(totalPurchases)}
            />
            <StatCard
              icon="receipt" tone="ter"
              label="Órdenes"
              value={purchaseOrders.length}
              foot={<>{purchaseOrders.filter((p) => p.status === 'pending').length} {t('common.pending', 'pendientes')}</>}
            />
            <StatCard
              icon="supplier" tone="sec"
              label="Proveedores"
              value={suppliers.length}
            />
            <StatCard
              icon="cash" tone="err"
              label="Cuentas por pagar"
              valueColor={'var(--warning)'}
              value={Qs(suppliers.reduce((s, sp) => s + Number(sp.balance || 0), 0))}
            />
          </div>

          <div className="card">
            <div className="card-head"><h3>Órdenes de compra</h3></div>
            <div className="card-body flush">
              <table className="mtable">
                <thead><tr><th>No. OC</th><th>{t('common.date', 'Fecha')}</th><th>{t('common.supplier', 'Proveedor')}</th><th className="num">{t('common.total', 'Total')}</th><th>{t('common.status', 'Estado')}</th></tr></thead>
                <tbody>
                  {purchaseOrders.length === 0 && <tr><td colSpan={5}><div className="empty" style={{ padding: 20 }}>Sin órdenes de compra</div></td></tr>}
                  {purchaseOrders.map((po) => (
                    <tr key={po.id}>
                      <td className="code" style={{ color: 'var(--accent)', fontWeight: 500 }}>{po.docNumber || po.id}</td>
                      <td className="code">{(po.orderDate || po.date || '').toString().slice(0, 10)}</td>
                      <td>{po.supplierName || po.supplier || '—'}</td>
                      <td className="num" style={{ fontWeight: 500 }}>{Q(po.total)}</td>
                      <td><span className="badge-m3">{po.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card mt-12">
            <div className="card-head"><h3>Proveedores &amp; saldos</h3></div>
            <div className="card-body flush">
              <table className="mtable">
                <thead><tr><th>#</th><th>{t('common.supplier', 'Proveedor')}</th><th>NIT</th><th className="num">Saldo</th></tr></thead>
                <tbody>
                  {suppliers.length === 0 && <tr><td colSpan={4}><div className="empty" style={{ padding: 20 }}>Sin proveedores</div></td></tr>}
                  {suppliers.map((s, i) => (
                    <tr key={s.id}>
                      <td className="code">{String(i + 1).padStart(2, '0')}</td>
                      <td style={{ fontWeight: 500 }}>{s.name}</td>
                      <td className="code">{s.nit || '—'}</td>
                      <td className="num" style={{ fontWeight: 500 }}>{Q(s.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {section === 'proyectos' && <ProjectProfitabilityPanel pushToast={pushToast} onDatos={setRentabProyectos} />}

      {section === 'rentabilidad' && (
        <>
          <div className="stat-grid">
            <StatCard
              tone="pri"
              label="Ingresos brutos"
              value={Qs(rpt.totalSales)}
            />
            <StatCard
              tone="ter"
              label="Costo de ventas"
              value={Qs(rpt.byCategory.reduce((s, c) => s + c.cost, 0))}
            />
            <StatCard
              tone="sec"
              label={t('dashboard.kpis.gross', 'Utilidad bruta')}
              valueColor={'var(--success)'}
              value={Qs(rpt.byCategory.reduce((s, c) => s + c.profit, 0))}
            />
            <StatCard
              tone="err"
              label="Categorías"
              value={rpt.byCategory.length}
            />
          </div>

          <div className="card">
            <div className="card-head"><h3>Análisis de margen por categoría</h3></div>
            <div className="card-body flush">
              <table className="mtable">
                <thead><tr><th>{t('common.category', 'Categoría')}</th><th className="num">Ventas</th><th className="num">{t('common.cost', 'Costo')}</th><th className="num">Utilidad</th><th className="num">{t('common.margin', 'Margen')} %</th></tr></thead>
                <tbody>
                  {rpt.byCategory.length === 0 && <tr><td colSpan={5}><div className="empty" style={{ padding: 20 }}>Sin ventas en el período</div></td></tr>}
                  {rpt.byCategory.map((c) => (
                    <tr key={c.cat}>
                      <td style={{ fontWeight: 500 }}>{c.cat}</td>
                      <td className="num">{Qs(c.sales)}</td>
                      <td className="num muted">{Qs(c.cost)}</td>
                      <td className="num" style={{ fontWeight: 500, color: 'var(--success)' }}>{Qs(c.profit)}</td>
                      <td className="num" style={{ fontWeight: 500, color: c.marginPct> 35 ? 'var(--success)' : c.marginPct > 20 ? 'var(--text-2)' : 'var(--warning)' }}>{c.marginPct.toFixed(1)}%</td>
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
          <div className="card-head"><h3>Libro de Ventas (SAT)</h3><Button icon="download" size="sm" onClick={exportar}>Excel SAT</Button></div>
          <div className="card-body flush">
            <table className="mtable">
              <thead><tr><th>Día</th><th className="num">Facturas</th><th className="num">Gravable</th><th className="num">IVA {taxRate}%</th><th className="num">{t('common.total', 'Total')}</th></tr></thead>
              <tbody>
                {rpt.salesBook.length === 0 && <tr><td colSpan={5}><div className="empty" style={{ padding: 20 }}>Sin ventas en el período</div></td></tr>}
                {rpt.salesBook.map((d) => (
                  <tr key={d.d}>
                    <td className="code">{d.d}</td>
                    <td className="num">{d.tickets}</td>
                    <td className="num">{Qs(d.taxable)}</td>
                    <td className="num muted">{Qs(d.iva)}</td>
                    <td className="num" style={{ fontWeight: 500 }}>{Qs(d.total)}</td>
                  </tr>
                ))}
                <tr style={{ background: 'var(--surface-2)' }}>
                  <td style={{ fontWeight: 500 }}>{t('common.total', 'TOTAL')}</td>
                  <td className="num" style={{ fontWeight: 500 }}>{rpt.salesBook.reduce((s, d) => s + d.tickets, 0)}</td>
                  <td className="num" style={{ fontWeight: 500 }}>{Qs(rpt.salesBook.reduce((s, d) => s + d.taxable, 0))}</td>
                  <td className="num" style={{ fontWeight: 500 }}>{Qs(rpt.salesBook.reduce((s, d) => s + d.iva, 0))}</td>
                  <td className="num" style={{ fontWeight: 500 }}>{Qs(rpt.salesBook.reduce((s, d) => s + d.total, 0))}</td>
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
