// Stackline — Fidelización / Puntos
import React, { useState, useMemo } from 'react';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import StatCard from '../components/StatCard.jsx';
import DataTable from '../components/DataTable.jsx';
import { useTranslation } from 'react-i18next';
import { useLoyalty } from '../hooks/useLoyalty.js';
import { addLoyaltyMovement } from '../api/wave3.js';

const Q  = (n) => `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const Qs = (n) => `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const pts = (n) => `${Number(n).toLocaleString('es-GT')} pts`;

// ── Configuración del programa ─────────────────────────────────────────────
const CONFIG = {
  puntosXQ10: 1,       // 1 punto por cada Q10 gastados
  valorPunto: 0.10,    // Q0.10 por punto al canjear
  expiracionMeses: 12,
};

const TIERS = [
  { id: 'basico',  nombre: 'Básico',  min: 0,    max: 499,        pill: '',        bonus: 1.0,  icon: '⬡' },
  { id: 'plata',   nombre: 'Plata',   min: 500,  max: 1999,       pill: 'info',    bonus: 1.25, icon: '◈' },
  { id: 'oro',     nombre: 'Oro',     min: 2000, max: 4999,       pill: 'warning', bonus: 1.5,  icon: '★' },
  { id: 'platino', nombre: 'Platino', min: 5000, max: Infinity,   pill: 'accent',  bonus: 2.0,  icon: '✦' },
];

const tierOf = (pts) => TIERS.findLast(t => pts >= t.min) ?? TIERS[0];

const TYPE_META = {
  earned:   { label:'Acumulado',  pill:'success', icon:'↑' },
  redeemed: { label:'Canjeado',   pill:'danger',  icon:'↓' },
  bonus:    { label:'Bono',       pill:'warning', icon:'★' },
  ajuste:   { label:'Ajuste',     pill:'',        icon:'⟳' },
};

// ── Componente ─────────────────────────────────────────────────────────────
export default function Loyalty({ pushToast }) {
  const { t } = useTranslation();
  const { members, txns, reload } = useLoyalty();
  const [tab, setTab]       = useState('resumen');
  const [search, setSearch] = useState('');
  const [tierFiltro, setTierFiltro] = useState('todos');
  const [txnFiltro, setTxnFiltro]   = useState('todos');
  const [drawer, setDrawer] = useState(null);
  const [showAjuste, setShowAjuste] = useState(null); // member for manual adjustment
  const [ajustePts, setAjustePts]   = useState('');
  const [ajusteNota, setAjusteNota] = useState('');

  // KPIs
  const totalMembers   = members.length;
  const totalPoints    = members.reduce((s, m) => s + m.points, 0);
  const totalRedeemed  = members.reduce((s, m) => s + m.redeemed, 0);
  const activeThisMonth = members.filter(m => m.lastPurchase >= '2026-05-01').length;

  // Filtered members
  const filteredMembers = useMemo(() => {
    let list = members;
    if (tierFiltro !== 'todos') list = list.filter(m => tierOf(m.points).id === tierFiltro);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(m => m.nombre.toLowerCase().includes(q) || m.nit.includes(q));
    }
    return list.sort((a, b) => b.points - a.points);
  }, [search, tierFiltro]);

  // Filtered transactions
  const filteredTxns = useMemo(() => {
    if (txnFiltro === 'todos') return txns;
    return txns.filter(t => t.type === txnFiltro);
  }, [txnFiltro]);

  const memberColumns = [
    { key: 'nombre', header: t('common.client', 'Cliente'), sortable: true, render: (m) => (
      <div className="cell-stack"><span className="nm">{m.nombre}</span><span className="sku">{m.nit}</span></div>
    ) },
    { key: 'nivel', header: 'Nivel', render: (m) => {
      const tier = tierOf(m.points);
      const next = TIERS.find(ti => ti.min > tier.min);
      const pctNext = next ? Math.min((m.points / next.min) * 100, 100) : 100;
      return (
        <div>
          <span className={`badge-m3 ${tier.pill}`}>{tier.icon} {tier.nombre}</span>
          {next && (
            <div style={{ marginTop: 4, width: 90 }}>
              <div className="prog" style={{ height: 3 }}><i style={{ width: `${pctNext}%` }} /></div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{next.min - m.points} pts para {next.nombre}</div>
            </div>
          )}
        </div>
      );
    } },
    { key: 'points', header: 'Puntos actuales', align: 'right', sortable: true, render: (m) => <span className="num" style={{ fontWeight: 500, color: 'var(--accent)' }}>{pts(m.points)}</span> },
    { key: 'earned', header: 'Total acumulado', align: 'right', sortable: true, render: (m) => <span className="num">{pts(m.earned)}</span> },
    { key: 'totalSpent', header: 'Total gastado', align: 'right', sortable: true, render: (m) => <span className="num">{Qs(m.totalSpent)}</span> },
    { key: 'lastPurchase', header: 'Último movimiento', render: (m) => <span className="sku">{m.lastPurchase}</span> },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-title">{t('loyalty.title', 'Programa de Fidelización')} · Programa de Puntos</div>
          <div className="muted" style={{fontSize:12}}>
            {CONFIG.puntosXQ10} punto por cada Q10 · Valor de canje Q{CONFIG.valorPunto.toFixed(2)} / punto
          </div>
        </div>
        <div className="row gap-8">
          <Button icon="download" onClick={() => pushToast?.('Exportando…', '')}>{t('common.export', 'Exportar')}
          </Button>
          <Button icon="plus" variant="accent" onClick={() => pushToast?.('Redirigiendo a Clientes…', '')}>{t('loyalty.tabs.members', 'Nuevo miembro')}
          </Button>
        </div>
      </div>

      <div className="tabs" style={{marginBottom:20}}>
        {[
          { id:'resumen',    label:'Resumen' },
          { id:'clientes',   label:t('loyalty.tabs.members', 'Miembros') },
          { id:'movimientos',label:'Movimientos' },
          { id:'config',     label:'Configuración' },
        ].map(tabItem => (
          <button key={tabItem.id} className={`tab ${tab===tabItem.id?'active':''}`} onClick={() => setTab(tabItem.id)}>
            {tabItem.label}
          </button>
        ))}
      </div>

      {/* ── RESUMEN ──────────────────────────────────────────────────────── */}
      {tab === 'resumen' && (
        <div>
          <div className="stat-grid" style={{marginBottom:20}}>
            <StatCard
              tone="pri"
              label="Total miembros"
              value={totalMembers}
              trend={{ dir: 'up', label: <>{activeThisMonth} activos este mes</> }}
            />
            <StatCard
              tone="ter"
              label="Puntos vigentes"
              value={totalPoints.toLocaleString('es-GT')}
              trend={{ dir: 'up', label: <>≈ {Q(totalPoints * CONFIG.valorPunto)} en circulación</> }}
            />
            <StatCard
              tone="sec"
              label="Puntos canjeados (total)"
              value={totalRedeemed.toLocaleString('es-GT')}
              trend={{ dir: 'up', label: <>{Q(totalRedeemed * CONFIG.valorPunto)} en descuentos</> }}
            />
            <StatCard
              tone="err"
              label="Tasa de canje"
              value={<>{members.reduce((s,m)=>s+m.earned,0) > 0 ? ((totalRedeemed/members.reduce((s,m)=>s+m.earned,0))*100).toFixed(1) : 0}%</>}
              foot="Pts canjeados / emitidos"
            />
          </div>

          {/* Distribución por tier */}
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20}}>
            <div className="card" style={{padding:16}}>
              <div style={{fontWeight: 500, fontSize: 14, marginBottom:14}}>Distribución por nivel</div>
              {TIERS.map(tierItem => {
                const count = members.filter(m => tierOf(m.points).id === tierItem.id).length;
                const pct   = totalMembers > 0 ? (count / totalMembers) * 100 : 0;
                return (
                  <div key={tierItem.id} style={{marginBottom:10}}>
                    <div style={{display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4}}>
                      <span style={{display:'flex', alignItems:'center', gap:6}}>
                        <span className={`badge-m3 ${tierItem.pill}`}>{tierItem.icon} {tierItem.nombre}</span>
                      </span>
                      <span className="muted" style={{fontFamily:'var(--font-mono)', fontSize:11}}>{count} miembros · {pct.toFixed(0)}%</span>
                    </div>
                    <div style={{height:5, background:'var(--border)', borderRadius:3}}>
                      <div style={{height:'100%', width:`${pct}%`, background:'var(--accent)', borderRadius:3}}/>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="card" style={{padding:16}}>
              <div style={{fontWeight: 500, fontSize: 14, marginBottom:14}}>Actividad reciente</div>
              {txns.slice(0, 7).map(tx => {
                const meta = TYPE_META[tx.type];
                return (
                  <div key={tx.id} style={{display:'flex', alignItems:'center', gap:10, marginBottom:10, fontSize:12}}>
                    <span className={`badge-m3 ${meta.pill}`} style={{minWidth:72, justifyContent:'center'}}>
                      {meta.icon} {meta.label}
                    </span>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{tx.nombre}</div>
                      <div className="muted" style={{fontSize: 11, fontFamily:'var(--font-mono)'}}>{tx.ref} · {tx.date}</div>
                    </div>
                    <div style={{fontFamily:'var(--font-mono)', fontSize:12, fontWeight: 500,
                      color: tx.points > 0 ? 'var(--success)' : 'var(--danger)'}}>
                      {tx.points > 0 ? '+' : ''}{tx.points} pts
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── CLIENTES ─────────────────────────────────────────────────────── */}
      {tab === 'clientes' && (
        <div>
          <div style={{display:'flex', gap:8, marginBottom:14, flexWrap:'wrap'}}>
            <div style={{position:'relative', flex:1, minWidth:200}}>
              <Icon name="search" size={13} style={{position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'var(--muted)'}}/>
              <input
                style={{width:'100%', paddingLeft:30, border:'1px solid var(--border)', borderRadius:'var(--r-md)', padding:'6px 10px 6px 30px', background:'var(--surface)', color:'var(--text)', fontSize: 14}}
                placeholder={t('clients.searchPlaceholder', 'Buscar por nombre o NIT…')}
                value={search} onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div style={{display:'flex', gap:4}}>
              {[{v:'todos',l:t('common.all', 'Todos')},...TIERS.map(tierItem=>({v:tierItem.id,l:tierItem.nombre}))].map(o => (
                <Button size="sm" variant={tierFiltro===o.v?'accent':'outlined'} key={o.v} onClick={() => setTierFiltro(o.v)}>{o.l}</Button>
              ))}
            </div>
          </div>

          <DataTable
            rowKey={(m) => m.id}
            columns={memberColumns}
            rows={filteredMembers}
            density="compact"
            pageSize={12}
            onRowClick={(m) => setDrawer(m)}
            empty={t('common.noResults', 'Sin resultados')}
            actions={(m) => (
              <Button variant="ghost" size="sm" onClick={() => { setShowAjuste(m); setAjustePts(''); setAjusteNota(''); }}>
                Ajustar
              </Button>
            )}
          />
        </div>
      )}

      {/* ── MOVIMIENTOS ──────────────────────────────────────────────────── */}
      {tab === 'movimientos' && (
        <div>
          <div style={{display:'flex', gap:4, marginBottom:14}}>
            {[{v:'todos',l:t('common.all', 'Todos')},...Object.entries(TYPE_META).map(([v,m])=>({v,l:m.label}))].map(o => (
              <Button size="sm" variant={txnFiltro===o.v?'accent':'outlined'} key={o.v} onClick={() => setTxnFiltro(o.v)}>{o.l}</Button>
            ))}
          </div>

          <div className="card" style={{padding:0, overflow:'hidden'}}>
            <table className="mtable">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>{t('common.client', 'Cliente')}</th>
                  <th>{t('common.type', 'Tipo')}</th>
                  <th className="num">Puntos</th>
                  <th className="num">Valor Q</th>
                  <th>{t('common.reference', 'Referencia')}</th>
                  <th>{t('common.date', 'Fecha')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredTxns.map(tx => {
                  const meta = TYPE_META[tx.type];
                  return (
                    <tr key={tx.id}>
                      <td className="code">{tx.id}</td>
                      <td style={{fontWeight:500}}>{tx.nombre}</td>
                      <td><span className={`badge-m3 ${meta.pill}`}>{meta.icon} {meta.label}</span></td>
                      <td className="num" style={{ fontWeight:500, color: tx.points> 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {tx.points > 0 ? '+' : ''}{tx.points}
                      </td>
                      <td className="num" style={{color:'var(--muted)'}}>
                        {tx.monto !== 0 ? Q(Math.abs(tx.monto)) : '—'}
                      </td>
                      <td className="code">{tx.ref}</td>
                      <td style={{ color:'var(--muted)' }}>{tx.date}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── CONFIGURACIÓN ────────────────────────────────────────────────── */}
      {tab === 'config' && (
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
          <div className="card" style={{padding:20}}>
            <div style={{fontWeight: 500, fontSize: 14, marginBottom:16}}>Reglas de acumulación</div>
            <div className="field" style={{marginBottom:12}}>
              <label>Puntos por cada Q10 gastados</label>
              <input type="number" defaultValue={CONFIG.puntosXQ10} style={{fontFamily:'var(--font-mono)'}}/>
            </div>
            <div className="field" style={{marginBottom:12}}>
              <label>Valor de 1 punto al canjear (Q)</label>
              <input type="number" defaultValue={CONFIG.valorPunto} step="0.01" style={{fontFamily:'var(--font-mono)'}}/>
            </div>
            <div className="field" style={{marginBottom:16}}>
              <label>Expiración por inactividad (meses)</label>
              <input type="number" defaultValue={CONFIG.expiracionMeses} style={{fontFamily:'var(--font-mono)'}}/>
            </div>
            <Button icon="check" variant="accent" full onClick={() => pushToast?.('Configuración guardada', 'success')}>{t('common.save', 'Guardar')} cambios
            </Button>
          </div>

          <div className="card" style={{padding:20}}>
            <div style={{fontWeight: 500, fontSize: 14, marginBottom:16}}>Niveles de fidelización</div>
            <table className="mtable">
              <thead>
                <tr>
                  <th>Nivel</th>
                  <th className="num">Desde</th>
                  <th className="num">Hasta</th>
                  <th className="num">Multiplicador</th>
                </tr>
              </thead>
              <tbody>
                {TIERS.map(tierItem => (
                  <tr key={tierItem.id}>
                    <td><span className={`badge-m3 ${tierItem.pill}`}>{tierItem.icon} {tierItem.nombre}</span></td>
                    <td className="num">{tierItem.min.toLocaleString('es-GT')} pts</td>
                    <td className="num">{tierItem.max === Infinity ? '∞' : tierItem.max.toLocaleString('es-GT') + ' pts'}</td>
                    <td className="num" style={{ fontWeight:500 }}>{tierItem.bonus}×</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{marginTop:12, padding:'10px 12px', background:'var(--surface-2)', borderRadius:'var(--r-md)', fontSize:11, color:'var(--muted)'}}>
              El multiplicador se aplica sobre los puntos base al momento de la compra.
              Ejemplo: Oro compra Q200 → 20 pts base × 1.5 = <strong>30 pts</strong>.
            </div>
          </div>

          <div className="card" style={{padding:20, gridColumn:'1/-1'}}>
            <div style={{fontWeight: 500, fontSize: 14, marginBottom:14}}>Bonificaciones especiales</div>
            <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12}}>
              {[
                { label:'Doble puntos fin de semana', activo:true,  desc:'Sáb y Dom — 2× sobre base' },
                { label:'Cumpleaños del cliente',      activo:true,  desc:'3× el día del cumpleaños' },
                { label:'Primera compra del mes',      activo:false, desc:'1.5× en la primera compra mensual' },
              ].map((b, i) => (
                <div key={i} className="card" style={{padding:14, display:'flex', gap:12, alignItems:'flex-start'}}>
                  <div style={{marginTop:2}}>
                    <div style={{width:14, height:14, borderRadius:3,
                      background: b.activo ? 'var(--success)' : 'var(--border)',
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize: 11, color:'var(--md-sys-color-on-success)'}}>
                      {b.activo ? '✓' : ''}
                    </div>
                  </div>
                  <div>
                    <div style={{fontWeight:500, fontSize:12}}>{b.label}</div>
                    <div style={{fontSize:11, color:'var(--muted)', marginTop:2}}>{b.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── DRAWER: detalle de cliente ────────────────────────────────────── */}
      {drawer && (
        <div className="drawer-overlay" onClick={() => setDrawer(null)}>
          <div className="drawer" onClick={e => e.stopPropagation()} style={{width:420}}>
            <div className="drawer-head">
              <div>
                <div style={{fontWeight: 500, fontSize: 16}}>{drawer.nombre}</div>
                <div className="muted" style={{fontSize:11}}>NIT {drawer.nit} · Desde {drawer.joinDate}</div>
              </div>
              <button className="icon-btn" onClick={() => setDrawer(null)}><Icon name="x"/></button>
            </div>
            <div className="drawer-body" style={{padding:20}}>
              {(() => {
                const tier = tierOf(drawer.points);
                const next = TIERS.find(tierItem => tierItem.min > tier.min);
                const pctNext = next ? Math.min((drawer.points / next.min) * 100, 100) : 100;
                const memberTxns = txns.filter(tx => tx.memberId === drawer.id);
                return (
                  <>
                    <div style={{textAlign:'center', marginBottom:20}}>
                      <span className={`badge-m3 ${tier.pill}`} style={{fontSize:14, height:32, padding:'0 16px'}}>
                        {tier.icon} {tier.nombre}
                      </span>
                      <div style={{fontFamily:'var(--font-mono)', fontWeight: 400, fontSize:28, marginTop:10, color:'var(--accent)'}}>
                        {drawer.points.toLocaleString('es-GT')} pts
                      </div>
                      <div style={{fontSize:12, color:'var(--muted)'}}>
                        ≈ {Q(drawer.points * CONFIG.valorPunto)} disponibles para canje
                      </div>
                    </div>

                    {next && (
                      <div className="card" style={{padding:12, marginBottom:16}}>
                        <div style={{display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:6}}>
                          <span>Progreso a <strong>{next.nombre}</strong></span>
                          <span className="muted">{next.min - drawer.points} pts restantes</span>
                        </div>
                        <div style={{height:7, background:'var(--border)', borderRadius:4}}>
                          <div style={{height:'100%', width:`${pctNext}%`, background:'var(--accent)', borderRadius:4}}/>
                        </div>
                      </div>
                    )}

                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:20}}>
                      {[
                        { label:'Acumulados', val:pts(drawer.earned) },
                        { label:'Canjeados',  val:pts(drawer.redeemed) },
                        { label:'Total gastado', val:Qs(drawer.totalSpent) },
                      ].map(s => (
                        <div key={s.label} className="card" style={{padding:10, textAlign:'center'}}>
                          <div style={{fontSize: 11, color:'var(--muted)', marginBottom:4}}>{s.label}</div>
                          <div style={{fontFamily:'var(--font-mono)', fontWeight: 500, fontSize:12}}>{s.val}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{fontSize:11, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8, fontFamily:'var(--font-mono)'}}>
                      Últimos movimientos
                    </div>
                    {memberTxns.length === 0 && <div className="muted" style={{fontSize:12}}>Sin movimientos registrados.</div>}
                    {memberTxns.slice(0,5).map(tx => {
                      const meta = TYPE_META[tx.type];
                      return (
                        <div key={tx.id} style={{display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid var(--border)'}}>
                          <span className={`badge-m3 ${meta.pill}`}>{meta.label}</span>
                          <div style={{flex:1}}>
                            <div className="code" style={{fontSize:11}}>{tx.ref}</div>
                            <div style={{fontSize: 11, color:'var(--muted)'}}>{tx.date}</div>
                          </div>
                          <div style={{fontFamily:'var(--font-mono)', fontWeight: 500, fontSize: 14,
                            color: tx.points > 0 ? 'var(--success)' : 'var(--danger)'}}>
                            {tx.points > 0 ? '+' : ''}{tx.points} pts
                          </div>
                        </div>
                      );
                    })}

                    <Button style={{width:'100%', marginTop:16 }} onClick={() => { setDrawer(null); setShowAjuste(drawer); setAjustePts(''); setAjusteNota(''); }}>
                      Ajustar puntos manualmente
                    </Button>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: ajuste de puntos ───────────────────────────────────────── */}
      {showAjuste && (
        <div className="modal-overlay" onClick={() => setShowAjuste(null)}>
          <div className="modal" style={{width:420}} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Ajuste de puntos</h3>
              <button className="icon-btn" onClick={() => setShowAjuste(null)}><Icon name="x"/></button>
            </div>
            <div className="modal-body">
              <div style={{padding:'10px 14px', background:'var(--surface-2)', borderRadius:'var(--r-md)', marginBottom:14, fontSize:12}}>
                <strong>{showAjuste.nombre}</strong>
                <span className="muted" style={{marginLeft:8}}>Saldo actual: <strong>{pts(showAjuste.points)}</strong></span>
              </div>
              <div className="field" style={{marginBottom:12}}>
                <label>Puntos (positivo = agregar, negativo = descontar)</label>
                <input
                  type="number"
                  value={ajustePts}
                  onChange={e => setAjustePts(e.target.value)}
                  placeholder="Ej. +50 o -20"
                  style={{fontFamily:'var(--font-mono)'}}
                />
              </div>
              <div className="field">
                <label>Motivo del ajuste</label>
                <input type="text" value={ajusteNota} onChange={e => setAjusteNota(e.target.value)}
                  placeholder="Ej. Compensación por error en caja"/>
              </div>
              {ajustePts && (
                <div style={{marginTop:12, padding:'10px 14px', background:'var(--surface-2)', borderRadius:'var(--r-md)', fontSize:12}}>
                  Nuevo saldo: <strong style={{fontFamily:'var(--font-mono)'}}>
                    {pts(Math.max(0, showAjuste.points + (parseInt(ajustePts) || 0)))}
                  </strong>
                </div>
              )}
            </div>
            <div className="modal-foot">
              <Button onClick={() => setShowAjuste(null)}>{t('common.cancel', 'Cancelar')}</Button>
              <Button icon="check" variant="accent" onClick={async () => { const p = parseInt(ajustePts) || 0; try { await addLoyaltyMovement(showAjuste.backendId, { movementType: p >= 0 ? 'bonus' : 'redeemed', points: p, reference: ajusteNota || 'Ajuste manual', amount: 0, }); pushToast?.(`Ajuste de ${ajustePts} pts aplicado a ${showAjuste.nombre}`, 'success'); setShowAjuste(null); reload(); } catch (err) { pushToast?.('No se pudo aplicar el ajuste: ' + err.message, 'error'); } }}>{t('common.apply', 'Aplicar')} ajuste
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
