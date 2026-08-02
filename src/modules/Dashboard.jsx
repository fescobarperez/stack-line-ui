// ERP MAYA — DashboardModule (ES module)
import Icon from '../components/Icon.jsx';
import { useDashboard } from '../hooks/useDashboard.js';
// ERP MAYA — Dashboard module
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
  const colors = ['var(--accent)', '#64748b', '#0891b2', '#a16207', '#7c3aed', '#9d174d', '#475569'];
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

  const colors = ['var(--accent)', '#64748b', '#0891b2', '#a16207', '#7c3aed', '#9d174d', '#475569'];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('nav.dashboard', 'Dashboard general')}</h1>
          <div className="page-subtitle">Vista consolidada · 5 sucursales · {new Date().toLocaleDateString('es-GT', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}</div>
        </div>
        <div className="page-head-actions">
          <div className="filterbar" style={{margin:0, padding:'4px 6px'}}>
            {['Hoy','7d','14d','30d','90d'].map(r => (
              <button key={r} className={`chip ${range === r.toLowerCase() ? 'active' : ''}`} onClick={() => setRange(r.toLowerCase())}>{r}</button>
            ))}
          </div>
          <button className="btn"><Icon name="download"/>{t('common.export', 'Exportar')}</button>
          <button className="btn primary"><Icon name="refresh"/>Sincronizar</button>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <div className="stat">
          <div className="label"><Icon name="cash" size={11}/>{t('dashboard.kpis.salesToday', 'Ventas hoy')}</div>
          <div className="val mono">{Qs(today.total)}</div>
          <div className={`delta ${deltaToday >= 0 ? 'up' : 'dn'}`}>
            <Icon name={deltaToday >= 0 ? 'arrowUp' : 'arrowDown'} size={11}/>
            {deltaToday}% vs ayer
          </div>
          <div className="spark"><Sparkline data={salesTrend.slice(-7).map(d => d.total)} color="var(--accent)" width={84} height={32}/></div>
        </div>
        <div className="stat">
          <div className="label"><Icon name="receipt" size={11}/>{t('dashboard.kpis.transactions', 'Tickets hoy')}</div>
          <div className="val mono">{today.tickets}</div>
          <div className="delta up"><Icon name="arrowUp" size={11}/>8.4% vs ayer</div>
          <div className="spark"><Sparkline data={salesTrend.slice(-7).map(d => d.tickets)} color="var(--info)" width={84} height={32}/></div>
        </div>
        <div className="stat">
          <div className="label"><Icon name="chart" size={11}/>{t('dashboard.kpis.avgTicket', 'Ticket promedio')}</div>
          <div className="val mono">{Q(avgTicket)}</div>
          <div className="delta up"><Icon name="arrowUp" size={11}/>2.1% vs sem. anterior</div>
        </div>
        <div className="stat">
          <div className="label"><Icon name="alert" size={11}/>{t('dashboard.sections.inventoryAlerts', 'Alertas activas')}</div>
          <div className="val mono" style={{color:'var(--danger)'}}>{lowStock.length + expiringSoon.filter(p => p.daysLeft < 30).length}</div>
          <div className="delta dn">
            {lowStock.length} {t('dashboard.alerts.lowStock', 'stock bajo')} · {expiringSoon.filter(p => p.daysLeft < 30).length} {t('dashboard.alerts.expiringSoon', 'por vencer')}
          </div>
        </div>
      </div>

      {/* Row 1: Chart + Donut */}
      <div className="grid-2 mt-12">
        <div className="card">
          <div className="card-head">
            <div>
              <h3>{t('dashboard.charts.salesByDay', 'Ventas por día')}</h3>
              <div className="meta">Últimos 14 días · Q en miles</div>
            </div>
            <div className="row gap-6">
              <button className="btn sm ghost"><Icon name="chart" size={12}/>Detalle</button>
            </div>
          </div>
          <div className="card-body">
            <AreaChart data={salesTrend}/>
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            <h3>{t('dashboard.charts.salesByCategory', 'Ventas por categoría')}</h3>
            <span className="meta">MTD</span>
          </div>
          <div className="card-body" style={{display:'flex', alignItems:'center', gap:16}}>
            <DonutChart data={salesByCat} size={150}/>
            <div style={{flex:1, display:'flex', flexDirection:'column', gap:4}}>
              {salesByCat.map((c, i) => (
                <div key={i} className="row" style={{justifyContent:'space-between', fontSize:12}}>
                  <span className="row gap-6">
                    <span style={{width:9, height:9, borderRadius:2, background:colors[i % colors.length], display:'inline-block'}}/>
                    {c.cat}
                  </span>
                  <span className="mono muted">{c.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Top products + Branches */}
      <div className="grid-2 mt-12">
        <div className="card">
          <div className="card-head">
            <h3>{t('dashboard.charts.topProducts', 'Productos más vendidos')}</h3>
            <a className="meta" href="#" style={{color:'var(--accent)'}}>Ver todos →</a>
          </div>
          <div className="card-body flush">
            <table className="tbl">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t('dashboard.headers.product', 'Producto')}</th>
                  <th className="num">Vendidos</th>
                  <th className="num">{t('common.total', 'Total')}</th>
                  <th className="num">∆</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.slice(0,7).map((p, i) => (
                  <tr key={p.sku}>
                    <td className="code">{String(i+1).padStart(2,'0')}</td>
                    <td>
                      <div style={{fontWeight:500}}>{p.name}</div>
                      <div className="code muted" style={{fontSize:10.5}}>{p.sku}</div>
                    </td>
                    <td className="num">{p.qty}</td>
                    <td className="num">{Q(p.total)}</td>
                    <td className="num" style={{color: p.trend.startsWith('+') ? 'var(--success)':'var(--danger)'}}>{p.trend}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            <h3>{t('dashboard.sections.branches', 'Sucursales en vivo')}</h3>
            <span className="meta">Tiempo real</span>
          </div>
          <div className="card-body flush">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t('dashboard.headers.branch', 'Sucursal')}</th>
                  <th className="num">{t('dashboard.kpis.salesToday', 'Ventas hoy')}</th>
                  <th className="center">{t('common.status', 'Estado')}</th>
                </tr>
              </thead>
              <tbody>
                {branchSales.map(b => {
                  const max = Math.max(...branchSales.map(x => x.sales));
                  const pct = (b.sales / max) * 100;
                  return (
                    <tr key={b.id}>
                      <td>
                        <div style={{fontWeight:500}}>{b.name}</div>
                        <div className="muted" style={{fontSize:11}}>{b.addr}</div>
                      </td>
                      <td className="num">
                        <div>{Q(b.sales)}</div>
                        <div className="bar" style={{marginTop:3, width:80, marginLeft:'auto'}}>
                          <div style={{width: `${pct}%`}}/>
                        </div>
                      </td>
                      <td className="center">
                        {b.status === 'active'
                          ? <span className="pill success"><span className="dot"/>{t('common.active', 'Activa')}</span>
                          : <span className="pill warning"><span className="dot"/>Pausada</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Row 3: Alerts + Recent tickets */}
      <div className="grid-2 mt-12">
        <div className="card">
          <div className="card-head">
            <h3>{t('dashboard.sections.inventoryAlerts', 'Alertas de inventario')}</h3>
            <span className="pill danger">{lowStock.length + expiringSoon.filter(p => p.daysLeft < 30).length} activas</span>
          </div>
          <div className="card-body flush">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t('dashboard.headers.type', 'Tipo')}</th>
                  <th>{t('dashboard.headers.product', 'Producto')}</th>
                  <th className="num">Stock / Días</th>
                  <th>{t('dashboard.headers.action', 'Acción')}</th>
                </tr>
              </thead>
              <tbody>
                {lowStock.slice(0,4).map(p => (
                  <tr key={p.sku}>
                    <td><span className="pill warning"><span className="dot"/>{t('dashboard.alerts.lowStock', 'Stock bajo')}</span></td>
                    <td>
                      <div style={{fontWeight:500}}>{p.name}</div>
                      <div className="code muted" style={{fontSize:10.5}}>{p.sku}</div>
                    </td>
                    <td className="num">
                      <span style={{color:'var(--warning)', fontWeight:600}}>{p.stock}</span>
                      <span className="muted"> / {p.min}</span>
                    </td>
                    <td><a href="#" style={{color:'var(--accent)', fontSize:11.5}}>Crear OC →</a></td>
                  </tr>
                ))}
                {expiringSoon.slice(0,3).map(p => (
                  <tr key={p.sku + '_exp'}>
                    <td><span className="pill danger"><span className="dot"/>Vence pronto</span></td>
                    <td>
                      <div style={{fontWeight:500}}>{p.name}</div>
                      <div className="code muted" style={{fontSize:10.5}}>Lote {p.batch} · {p.exp}</div>
                    </td>
                    <td className="num">
                      <span style={{color:'var(--danger)', fontWeight:600}}>{p.daysLeft}d</span>
                    </td>
                    <td><a href="#" style={{color:'var(--accent)', fontSize:11.5}}>Promocionar →</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            <h3>{t('dashboard.sections.recentTransactions', 'Últimas transacciones')}</h3>
            <a className="meta" href="#" style={{color:'var(--accent)'}}>Ver feed →</a>
          </div>
          <div className="card-body flush">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t('dashboard.headers.ticket', 'Ticket')}</th>
                  <th>{t('dashboard.headers.time', 'Hora')}</th>
                  <th>{t('dashboard.headers.branch', 'Sucursal')}</th>
                  <th>{t('dashboard.headers.payment', 'Pago')}</th>
                  <th className="num">{t('common.total', 'Total')}</th>
                </tr>
              </thead>
              <tbody>
                {recentTickets.slice(0,8).map(t => (
                  <tr key={t.id}>
                    <td className="code">{t.id.slice(-6)}</td>
                    <td className="code">{t.date.slice(11)}</td>
                    <td>{t.branch}</td>
                    <td>
                      <span className="pill">
                        <Icon name={t.pay === 'Efectivo' ? 'cash' : t.pay === 'Tarjeta' ? 'card' : 'transfer'} size={10}/>
                        {t.pay}
                      </span>
                    </td>
                    <td className="num" style={{fontWeight:600}}>{Q(t.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardModule;
export { Sparkline, AreaChart, DonutChart };
