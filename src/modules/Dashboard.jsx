// Stackline — DashboardModule (ES module)
import Icon from '../components/Icon.jsx';
import { useDashboard } from '../hooks/useDashboard.js';
// Stackline — Dashboard module
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
function Sparkline({ data, color = "currentColor", height = 32, width = 100 }) {
  if (!data || !data.length) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  const areaPts = `0,${height} ${pts} ${width},${height}`;
  return (
    <svg width={width} height={height} style={{display:'block'}}>
      <polygon points={areaPts} fill={color} opacity="0.08"/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"/>
    </svg>
  );
}

function AreaChart({ data, height = 220, accent = "var(--accent)" }) {
  const w = 800;
  const h = height;
  const pad = { l: 40, r: 12, t: 12, b: 28 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  // Sin datos (cargando o backend sin respuesta): evita el crash por pts vacío.
  if (!data || data.length < 2) {
    return (
      <svg viewBox={`0 0 ${w} ${h}`} style={{width:'100%', height, display:'block'}}>
        <text x={w/2} y={h/2} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="12" fill="var(--muted)">
          Sin datos
        </text>
      </svg>
    );
  }
  const vals = data.map(d => d.total);
  const max = Math.max(...vals) * 1.1;
  const min = 0;
  const xStep = innerW / (data.length - 1);
  const pts = data.map((d, i) => {
    const x = pad.l + i * xStep;
    const y = pad.t + innerH - ((d.total - min) / (max - min)) * innerH;
    return [x, y];
  });
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
  const areaPath = `${linePath} L ${pts[pts.length-1][0]} ${pad.t + innerH} L ${pts[0][0]} ${pad.t + innerH} Z`;
  const yTicks = 4;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{width:'100%', height, display:'block'}}>
      <defs>
        <linearGradient id="areaGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.22"/>
          <stop offset="100%" stopColor={accent} stopOpacity="0"/>
        </linearGradient>
      </defs>
      {/* y grid */}
      {Array.from({length: yTicks+1}).map((_, i) => {
        const y = pad.t + (innerH / yTicks) * i;
        const v = Math.round((max - (max/yTicks)*i) / 1000);
        return (
          <g key={i}>
            <line x1={pad.l} x2={w - pad.r} y1={y} y2={y} stroke="var(--border)" strokeWidth="1" strokeDasharray={i === yTicks ? '' : '2,3'} />
            <text x={pad.l - 6} y={y + 3} textAnchor="end" fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--muted)">{v}k</text>
          </g>
        );
      })}
      {/* x labels */}
      {data.map((d, i) => i % 2 === 0 && (
        <text key={i} x={pad.l + i * xStep} y={h - 10} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--muted)">
          {d.d.slice(5)}
        </text>
      ))}
      <path d={areaPath} fill="url(#areaGrad)"/>
      <path d={linePath} fill="none" stroke={accent} strokeWidth="1.8"/>
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={i === pts.length - 1 ? 3.5 : 0} fill="var(--bg)" stroke={accent} strokeWidth="1.8"/>
      ))}
    </svg>
  );
}

function DonutChart({ data, size = 160 }) {
  const total = data.reduce((s, d) => s + d.pct, 0);
  const r = size / 2 - 12;
  const cx = size / 2;
  const cy = size / 2;
  const colors = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];
  let acc = 0;
  return (
    <svg width={size} height={size}>
      {data.map((d, i) => {
        const start = acc / total * Math.PI * 2 - Math.PI/2;
        acc += d.pct;
        const end = acc / total * Math.PI * 2 - Math.PI/2;
        const x1 = cx + r * Math.cos(start);
        const y1 = cy + r * Math.sin(start);
        const x2 = cx + r * Math.cos(end);
        const y2 = cy + r * Math.sin(end);
        const largeArc = end - start > Math.PI ? 1 : 0;
        return (
          <path
            key={i}
            d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`}
            fill={colors[i % colors.length]}
            stroke="var(--surface)"
            strokeWidth="2"
          />
        );
      })}
      <circle cx={cx} cy={cy} r={r * 0.55} fill="var(--surface)"/>
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize="11" fontFamily="var(--font-mono)" fill="var(--muted)">TOTAL</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize="14" fontWeight="600" fill="var(--text)">Q307.6k</text>
    </svg>
  );
}

function DashboardModule() {
  const { t } = useTranslation();
  const [range, setRange] = useState('14d');
  const daysFor = { hoy: 1, '7d': 7, '14d': 14, '30d': 30, '90d': 90 };
  const { data } = useDashboard(daysFor[range] || 14);
  const { salesTrend, salesByCat, topProducts, recentTickets, lowStock, branchSales } = data;
  const expiringSoon = [];

  const Q = (v) => `Q ${Number(v || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const Qs = Q;

  const today = salesTrend[salesTrend.length - 1] || { total: 0, tickets: 0 };
  const yesterday = salesTrend[salesTrend.length - 2] || { total: 0, tickets: 0 };
  const deltaToday = yesterday.total ? ((today.total - yesterday.total) / yesterday.total * 100).toFixed(1) : '0.0';

  const totalSales = salesTrend.reduce((s, d) => s + d.total, 0);
  const totalTickets = salesTrend.reduce((s, d) => s + d.tickets, 0);
  const avgTicket = totalTickets ? totalSales / totalTickets : 0;

  // Saludo con contexto (copy M3)
  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Buenos días' : now.getHours() < 19 ? 'Buenas tardes' : 'Buenas noches';
  let firstName = '';
  try { firstName = (JSON.parse(sessionStorage.getItem('maya_session'))?.user?.name || '').split(' ')[0]; } catch { firstName = ''; }
  const longDate = now.toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const hhmm = now.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });

  const colors = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

  // Distribución de métodos de pago (derivada de los tickets recientes reales)
  const payAgg = {};
  recentTickets.forEach(tk => { payAgg[tk.pay] = (payAgg[tk.pay] || 0) + tk.total; });
  const payTotal = Object.values(payAgg).reduce((a, b) => a + b, 0) || 1;
  const rangeLabels = [['hoy', 'Hoy'], ['7d', '7 días'], ['14d', '14 días'], ['30d', '30 días']];

  return (
    <div className="page dash">
      <div className="page-head">
        <div className="grow">
          <h1 className="headline-large">{greeting}{firstName ? `, ${firstName}` : ''}</h1>
          <p className="body-large supporting">Resumen operativo · {longDate} · {hhmm}</p>
        </div>
        <div className="actions">
          <div className="segmented">
            {rangeLabels.map(([id, lbl]) => (
              <button key={id} className={`seg ${range === id ? 'sel' : ''}`} onClick={() => setRange(id)}>
                {range === id && <Icon name="check"/>}{lbl}
              </button>
            ))}
          </div>
          <button className="btn btn-outlined"><Icon name="download"/>{t('common.export', 'Exportar')}</button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="kpi-grid">
        <div className="card card-elevated kpi">
          <div className="kpi-top">
            <div className="kpi-ic pri"><Icon name="cash" size={24}/></div>
            <div className="kpi-label label-large">{t('dashboard.kpis.salesToday', 'Ventas del día')}</div>
          </div>
          <div className="kpi-val">{Qs(today.total)}</div>
          <div className="kpi-foot body-small">
            <span className={`trend ${deltaToday >= 0 ? 'up' : 'down'}`}>
              <Icon name={deltaToday >= 0 ? 'arrowUp' : 'arrowDown'} size={16}/>{Math.abs(deltaToday)} %
            </span>
            <span>vs. ayer</span>
          </div>
        </div>
        <div className="card card-elevated kpi">
          <div className="kpi-top">
            <div className="kpi-ic ter"><Icon name="receipt" size={24}/></div>
            <div className="kpi-label label-large">{t('dashboard.kpis.transactions', 'Tickets emitidos')}</div>
          </div>
          <div className="kpi-val">{today.tickets}</div>
          <div className="kpi-foot body-small">
            <span>ticket prom. {Q(avgTicket)}</span>
          </div>
        </div>
        <div className="card card-elevated kpi">
          <div className="kpi-top">
            <div className="kpi-ic sec"><Icon name="chart" size={24}/></div>
            <div className="kpi-label label-large">{t('dashboard.kpis.avgTicket', 'Ticket promedio')}</div>
          </div>
          <div className="kpi-val">{Q(avgTicket)}</div>
          <div className="kpi-foot body-small">
            <span className="trend up"><Icon name="arrowUp" size={16}/>2.1 %</span>
            <span>vs. sem. anterior</span>
          </div>
        </div>
        <div className="card card-elevated kpi">
          <div className="kpi-top">
            <div className="kpi-ic err"><Icon name="alert" size={24}/></div>
            <div className="kpi-label label-large">Alertas de stock</div>
          </div>
          <div className="kpi-val">{lowStock.length}</div>
          <div className="kpi-foot body-small">
            <span className="trend down"><Icon name="alert" size={16}/>{lowStock.length} bajo mínimo</span>
          </div>
        </div>
      </div>

      {/* Row 1: Chart + Donut */}
      <div className="grid-2">
        <div className="card card-elevated">
          <div className="card-head">
            <div className="grow">
              <h2 className="title-large">{t('dashboard.charts.salesByDay', 'Tendencia de ventas')}</h2>
              <p className="body-medium supporting">Últimos {daysFor[range] || 14} días · todas las sucursales</p>
            </div>
            <button className="btn btn-text">Ver detalle</button>
          </div>
          <div className="card-body">
            <AreaChart data={salesTrend} accent="var(--chart-1)"/>
          </div>
        </div>
        <div className="card card-elevated">
          <div className="card-head">
            <div className="grow">
              <h2 className="title-large">{t('dashboard.charts.salesByCategory', 'Ventas por categoría')}</h2>
              <p className="body-medium supporting">Por categoría · mes actual</p>
            </div>
          </div>
          <div className="card-body">
            <div style={{display:'grid', placeItems:'center', padding:'8px 0 4px'}}>
              <DonutChart data={salesByCat} size={180}/>
            </div>
            <div className="legend">
              {salesByCat.map((c, i) => (
                <div key={i} className="legend-row">
                  <span className="legend-sw" style={{background: colors[i % colors.length]}}/>
                  <span className="legend-nm body-medium">{c.cat}</span>
                  <span className="legend-val label-large">{c.pct} %</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Top products + Alerts */}
      <div className="grid-2">
        <div className="card card-outlined">
          <div className="card-head">
            <div className="grow">
              <h2 className="title-large">{t('dashboard.charts.topProducts', 'Productos más vendidos')}</h2>
              <p className="body-medium supporting">Por ingreso · hoy</p>
            </div>
            <button className="btn btn-tonal"><Icon name="filter"/>Filtrar</button>
          </div>
          <div className="card-body flush">
            <table>
              <thead>
                <tr>
                  <th style={{width:'44%'}}>{t('dashboard.headers.product', 'Producto')}</th>
                  <th className="r">Unid.</th>
                  <th className="r">{t('common.total', 'Total')}</th>
                  <th className="r">∆</th>
                  <th style={{width:'18%'}}>Stock</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.slice(0,6).map((p) => {
                  const maxQty = Math.max(...topProducts.map(x => x.qty)) || 1;
                  const pctBar = Math.round((p.qty / maxQty) * 100);
                  return (
                    <tr key={p.sku}>
                      <td><div className="cell-stack"><span className="nm">{p.name}</span><span className="sku">{p.sku}</span></div></td>
                      <td className="r num">{p.qty}</td>
                      <td className="r num">{Q(p.total)}</td>
                      <td className="r num" style={{color: p.trend.startsWith('+') ? 'var(--md-success)' : 'var(--md-error)'}}>{p.trend}</td>
                      <td><div className="prog"><i style={{width:`${pctBar}%`}}/></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card card-filled">
          <div className="card-head">
            <div className="grow">
              <h2 className="title-large">{t('dashboard.sections.inventoryAlerts', 'Requiere atención')}</h2>
              <p className="body-medium supporting">{lowStock.length} alertas activas</p>
            </div>
          </div>
          <div className="list">
            {lowStock.slice(0,5).map(p => (
              <div key={p.sku} className="list-item">
                <div className="list-lead err"><Icon name="alert" size={20}/></div>
                <div className="list-txt">
                  <div className="h title-medium">{p.name}</div>
                  <div className="s body-small">{p.stock} unid. · mínimo {p.min}</div>
                </div>
                <div className="list-trail label-large">{p.stock - p.min}</div>
              </div>
            ))}
          </div>
          <div className="divider"/>
          <div style={{padding:'12px 16px', display:'flex', justifyContent:'flex-end', gap:8}}>
            <button className="btn btn-text">Descartar todo</button>
            <button className="btn btn-tonal">Ver todas</button>
          </div>
        </div>
      </div>

      {/* Row 3: Payment methods + Recent tickets */}
      <div className="grid-2b">
        <div className="card card-outlined">
          <div className="card-head">
            <div className="grow">
              <h2 className="title-large">Métodos de pago</h2>
              <p className="body-medium supporting">Distribución del día</p>
            </div>
          </div>
          <div className="card-body">
            <div style={{display:'flex', flexDirection:'column', gap:20}}>
              {Object.entries(payAgg).map(([method, amt], i) => {
                const pct = Math.round((amt / payTotal) * 100);
                return (
                  <div key={method}>
                    <div style={{display:'flex', justifyContent:'space-between', marginBottom:8}}>
                      <span className="label-large">{method}</span>
                      <span className="label-large num">{Q(amt)} · {pct} %</span>
                    </div>
                    <div className={i === 1 ? 'prog ter' : 'prog'}><i style={{width:`${pct}%`}}/></div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="card card-outlined">
          <div className="card-head">
            <div className="grow">
              <h2 className="title-large">{t('dashboard.sections.recentTransactions', 'Tickets recientes')}</h2>
              <p className="body-medium supporting">Últimas transacciones</p>
            </div>
            <button className="btn btn-text">Ver todos</button>
          </div>
          <div className="card-body flush">
            <table>
              <thead>
                <tr>
                  <th>{t('dashboard.headers.ticket', 'Ticket')}</th>
                  <th>{t('dashboard.headers.time', 'Hora')}</th>
                  <th>{t('dashboard.headers.payment', 'Pago')}</th>
                  <th className="r">{t('common.total', 'Total')}</th>
                  <th>{t('common.status', 'Estado')}</th>
                </tr>
              </thead>
              <tbody>
                {recentTickets.slice(0,6).map(tk => (
                  <tr key={tk.id}>
                    <td className="num">{tk.id.slice(-6)}</td>
                    <td className="num">{tk.date.slice(11,16)}</td>
                    <td>{tk.pay}</td>
                    <td className="r num">{Q(tk.total)}</td>
                    <td><span className="badge ok">Certificado</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <button className="fab dash-fab"><Icon name="plus"/>Nueva venta</button>
    </div>
  );
}

export default DashboardModule;
export { Sparkline, AreaChart, DonutChart };
