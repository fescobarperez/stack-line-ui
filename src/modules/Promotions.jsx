// Stackline — Promotions / Motor de Promociones
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from '../components/Icon.jsx';
import DataTable from '../components/DataTable.jsx';
import { usePromotions } from '../hooks/useMarketing.js';
import { createPromotion, updatePromotion } from '../api/marketing.js';

const Q   = (n) => `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const Qs  = (n) => `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 0,  maximumFractionDigits: 0  })}`;
const pct = (n) => `${n}%`;

// ── Tipos de promoción ─────────────────────────────────────────────────────
const PROMO_TYPES = [
  { id: 'pct_desc',   label: '% Descuento',             icon: 'tag',      desc: 'Porcentaje sobre el precio original' },
  { id: 'monto_fijo', label: 'Descuento fijo (Q)',       icon: 'cash',     desc: 'Monto fijo en quetzales' },
  { id: 'nxm',        label: 'NxM (2x1, 3x2…)',         icon: 'box',      desc: 'Compra N unidades, lleva M' },
  { id: 'precio_esp', label: 'Precio especial',          icon: 'tag',      desc: 'Precio fijo para el producto' },
  { id: 'combo',      label: 'Combo / Bundle',           icon: 'receipt',  desc: 'Descuento al comprar productos juntos' },
  { id: 'min_compra', label: 'Por monto mínimo',         icon: 'chart',    desc: 'Descuento si el ticket supera X quetzales' },
];

const TYPE_MAP = Object.fromEntries(PROMO_TYPES.map(t => [t.id, t]));

// ── Condiciones aplicables ─────────────────────────────────────────────────
const DIAS_SEMANA = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
const CLIENT_TYPES = ['Todos', 'Consumidor final', 'Minorista', 'Mayorista', 'Exento'];
const BRANCHES_OPT = ['Todas', 'Zona 10', 'Zona 1', 'Zona 15', 'Mixco', 'Escuintla'];
const CATEGORIES   = ['Abarrotes', 'Bebidas', 'Lácteos', 'Limpieza', 'Higiene', 'Snacks', 'Panadería', 'Congelados'];

// Datos reales del backend vía usePromotions. Helpers de fecha para el wizard.
const TODAY = new Date();
const fmtDate = (d) => d.toISOString().slice(0,10);
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate()+n); return r; };

const STATUS_CFG = {
  active:    { label:'Activa',     pill:'success',  dot:true },
  scheduled: { label:'Programada', pill:'info',     dot:true },
  paused:    { label:'Pausada',    pill:'warning',  dot:true },
  expired:   { label:'Expirada',   pill:'neutral',  dot:false },
};

function PromoTypeBadge({ type }) {
  const t = TYPE_MAP[type];
  if (!t) return null;
  return (
    <span className="pill" style={{gap:4}}>
      <Icon name={t.icon} size={10}/>{t.label}
    </span>
  );
}

function StatusPill({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.expired;
  return (
    <span className={`pill ${cfg.pill}`}>
      {cfg.dot && <span className="dot"/>}{cfg.label}
    </span>
  );
}

// ── Nuevo promo — estado inicial del formulario ───────────────────────────
const NEW_DEFAULTS = {
  name:'', type:'pct_desc', value:'', status:'active',
  category:'', product:'', clientType:'Todos', branches:'Todas',
  dias:[0,1,2,3,4,5,6], horaInicio:'', horaFin:'',
  minCompra:'', nxm_n:'2', nxm_m:'1',
  dateStart: fmtDate(TODAY), dateEnd: fmtDate(addDays(TODAY,30)),
  desc:'',
};

// ══════════════════════════════════════════════════════════════════════════════
export default function Promotions({ pushToast }) {
  const { t } = useTranslation();
  const { items: PROMOS, reload } = usePromotions();
  const [tab,      setTab]      = useState('activas');
  const [selPromo, setSelPromo] = useState(null);
  const [showNew,  setShowNew]  = useState(false);
  const [search,   setSearch]   = useState('');
  const [form,     setForm]     = useState(NEW_DEFAULTS);
  const [step,     setStep]     = useState(1); // wizard step

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleDia = (d) => setF('dias', form.dias.includes(d)
    ? form.dias.filter(x => x !== d) : [...form.dias, d]);

  const activePromos    = PROMOS.filter(p => p.status === 'active');
  const scheduledPromos = PROMOS.filter(p => p.status === 'scheduled');
  const pausedPromos    = PROMOS.filter(p => p.status === 'paused');
  const expiredPromos   = PROMOS.filter(p => p.status === 'expired');

  const summary = useMemo(() => ({
    active:   activePromos.length,
    totalUses:    PROMOS.reduce((s,p) => s + p.uses, 0),
    totalSavings: PROMOS.reduce((s,p) => s + p.savings, 0),
    avgSaving:    PROMOS.filter(p=>p.uses>0).reduce((s,p)=>s+p.savings/p.uses,0) / Math.max(1, PROMOS.filter(p=>p.uses>0).length),
  }), []);

  const tabPromos = {
    activas:    [...activePromos, ...pausedPromos],
    programadas:scheduledPromos,
    historial:  expiredPromos,
    efectividad:PROMOS.filter(p => p.uses > 0),
  }[tab] ?? activePromos;

  const filtered = tabPromos.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.id.toLowerCase().includes(search.toLowerCase())
  );

  const promoColumns = [
    { key: 'id', header: 'ID', render: (p) => <span className="sku">{p.id}</span> },
    { key: 'name', header: t('common.name', 'Nombre'), sortable: true, render: (p) => <span className="nm" style={{ whiteSpace: 'normal', display: 'block', maxWidth: 220 }}>{p.name}</span> },
    { key: 'type', header: t('common.type', 'Tipo'), render: (p) => <PromoTypeBadge type={p.type} /> },
    { key: 'appliesTo', header: t('promotions.appliesTo', 'Aplica a'), render: (p) => (
      <div style={{ fontSize: 11.5 }}>
        {p.category && <span className="badge-m3" style={{ marginRight: 4 }}>{p.category}</span>}
        {p.product && <span style={{ color: 'var(--muted)' }}>{p.product}</span>}
        {!p.category && !p.product && <span className="muted">{t('promotions.entireCart', 'Todo el carrito')}</span>}
      </div>
    ) },
    { key: 'conditions', header: t('promotions.conditions', 'Condiciones'), render: (p) => (
      <div className="sku">
        <div>{p.clientType !== 'Todos' ? p.clientType : t('promotions.allClients', 'Todos los clientes')}</div>
        <div>{p.branches}</div>
        {p.minCompra > 0 && <div>{t('promotions.min', 'Min.')} {Q(p.minCompra)}</div>}
        {p.horaInicio && <div>{p.horaInicio}–{p.horaFin}</div>}
      </div>
    ) },
    { key: 'validity', header: t('promotions.validity', 'Vigencia'), render: (p) => (
      <div className="sku"><div>{p.dateStart}</div><div style={{ color: 'var(--muted)' }}>→ {p.dateEnd}</div></div>
    ) },
    { key: 'uses', header: t('promotions.uses', 'Usos'), align: 'right', sortable: true, render: (p) => p.uses.toLocaleString('es-GT') },
    { key: 'savings', header: t('promotions.savingsGenerated', 'Ahorro generado'), align: 'right', sortable: true, sortValue: (p) => p.savings, render: (p) => <span className="num" style={{ color: 'var(--success)' }}>{p.savings > 0 ? Q(p.savings) : '—'}</span> },
    { key: 'status', header: t('common.status', 'Estado'), render: (p) => <StatusPill status={p.status} /> },
  ];

  // Empaqueta el formulario del wizard al shape del backend.
  const toPayload = (f) => ({
    name: f.name.trim(),
    promoType: f.type,
    status: f.status,
    value: f.value !== '' ? Number(f.value) : null,
    category: f.category || null,
    product: f.product || null,
    clientType: f.clientType,
    branches: f.branches,
    days: (f.dias || []).join(','),
    horaInicio: f.horaInicio || null,
    horaFin: f.horaFin || null,
    minCompra: f.minCompra !== '' ? Number(f.minCompra) : null,
    nxmN: f.nxm_n !== '' && f.nxm_n != null ? Number(f.nxm_n) : null,
    nxmM: f.nxm_m !== '' && f.nxm_m != null ? Number(f.nxm_m) : null,
    dateStart: f.dateStart || null,
    dateEnd: f.dateEnd || null,
    description: f.desc || null,
  });

  const handleSave = async () => {
    if (!form.name.trim()) { pushToast && pushToast('Ingresa el nombre de la promoción', 'danger'); return; }
    try {
      await createPromotion(toPayload(form));
      pushToast && pushToast(`Promoción "${form.name}" creada`, 'success');
      setShowNew(false);
      setForm(NEW_DEFAULTS);
      setStep(1);
      reload();
    } catch (err) { pushToast && pushToast('No se pudo crear la promoción: ' + err.message, 'error'); }
  };

  const handleToggle = async (promo) => {
    const nextStatus = promo.status === 'active' ? 'paused' : 'active';
    try {
      await updatePromotion(promo.backendId, { ...toPayload(promo), status: nextStatus });
      pushToast && pushToast(`Promoción ${nextStatus === 'active' ? 'activada' : 'pausada'}`, 'success');
      setSelPromo(null);
      reload();
    } catch (err) { pushToast && pushToast('No se pudo actualizar la promoción: ' + err.message, 'error'); }
  };

  return (
    <div className="page">
      {/* Header */}
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('promotions.title', 'Promociones')}</h1>
          <div className="page-subtitle">
            {t('promotions.subtitle', 'Motor de reglas · Descuentos · 2×1 · Combos · Por tipo de cliente · Vigencia automática')}
          </div>
        </div>
        <div className="page-head-actions">
          <button className="btn"><Icon name="download" size={12}/>{t('common.export', 'Exportar')}</button>
          <button className="btn accent" onClick={() => { setShowNew(true); setStep(1); }}>
            <Icon name="plus" size={12}/>{t('promotions.newPromo', 'Nueva promoción')}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="stat-grid" style={{gridTemplateColumns:'repeat(4,1fr)', marginBottom:16}}>
        <div className="stat">
          <div className="label"><Icon name="tag" size={11}/>{t('promotions.activePromos', 'Promociones activas')}</div>
          <div className="val mono" style={{fontSize:26, color:'var(--success)'}}>{summary.active}</div>
          <div className="delta" style={{color:'var(--muted)'}}>{scheduledPromos.length} {t('promotions.scheduled', 'programadas')}</div>
        </div>
        <div className="stat">
          <div className="label"><Icon name="receipt" size={11}/>{t('promotions.totalUsesMonth', 'Usos totales (mes)')}</div>
          <div className="val mono" style={{fontSize:26}}>{summary.totalUses.toLocaleString('es-GT')}</div>
          <div className="delta up"><Icon name="arrowUp" size={11}/>12% {t('promotions.vsPrevMonth', 'vs mes anterior')}</div>
        </div>
        <div className="stat">
          <div className="label"><Icon name="cash" size={11}/>{t('promotions.totalClientSavings', 'Ahorro total clientes')}</div>
          <div className="val mono" style={{fontSize:26}}>{Q(summary.totalSavings)}</div>
          <div className="delta" style={{color:'var(--muted)'}}>{t('promotions.discountsApplied', 'Descuentos aplicados')}</div>
        </div>
        <div className="stat">
          <div className="label"><Icon name="chart" size={11}/>{t('promotions.avgSavingPerUse', 'Ahorro promedio/uso')}</div>
          <div className="val mono" style={{fontSize:26}}>{Q(summary.avgSaving)}</div>
          <div className="delta" style={{color:'var(--muted)'}}>{t('promotions.perPromoTicket', 'Por ticket con promo')}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {[
          { id:'activas',     label:`${t('promotions.activeAndPaused', 'Activas y pausadas')} (${activePromos.length + pausedPromos.length})` },
          { id:'programadas', label:`${t('promotions.scheduledTab', 'Programadas')} (${scheduledPromos.length})` },
          { id:'historial',   label:`${t('promotions.history', 'Historial')} (${expiredPromos.length})` },
          { id:'efectividad', label:t('promotions.effectiveness', 'Efectividad') },
        ].map(tab_item => (
          <button key={tab_item.id} className={`tab ${tab===tab_item.id?'active':''}`}
            onClick={() => setTab(tab_item.id)}>{tab_item.label}
          </button>
        ))}
      </div>

      {/* Buscador */}
      <div className="toolbar">
        <div className="search-wrap" style={{flex:1, maxWidth:320}}>
          <Icon name="search" size={13} className="icon"/>
          <input className="search-input" placeholder={t('promotions.searchPlaceholder', 'Buscar promoción…')}
            value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <span className="muted" style={{fontSize:11, marginLeft:'auto'}}>{filtered.length} {t('promotions.records', 'registros')}</span>
      </div>

      {/* ── TAB: LISTA ── */}
      {tab !== 'efectividad' && (
        <DataTable
          rowKey={(p) => p.id}
          columns={promoColumns}
          rows={filtered}
          density="compact"
          pageSize={12}
          onRowClick={(p) => setSelPromo(p)}
          onView={(p) => setSelPromo(p)}
          empty={t('promotions.noPromosInCategory', 'Sin promociones en esta categoría')}
        />
      )}

      {/* ── TAB: EFECTIVIDAD ── */}
      {tab === 'efectividad' && (
        <>
          <div className="grid-2 mt-12" style={{gridTemplateColumns:'2fr 1fr', gap:16}}>
            {/* Ranking */}
            <div className="card">
              <div className="card-head">
                <h3>{t('promotions.rankingBySavings', 'Ranking por ahorro generado')}</h3>
                <span className="meta">{t('promotions.currentMonth', 'Mes actual')}</span>
              </div>
              <div className="card-body flush">
                <table className="mtable">
                  <thead>
                    <tr>
                      <th>#</th><th>{t('promotions.promotionCol', 'Promoción')}</th><th>{t('common.type', 'Tipo')}</th>
                      <th className="r">{t('promotions.uses', 'Usos')}</th>
                      <th className="r">{t('promotions.totalSavings', 'Ahorro total')}</th>
                      <th className="r">{t('promotions.savingsPerUse', 'Ahorro/uso')}</th>
                      <th>{t('promotions.effectivenessCol', 'Efectividad')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...PROMOS].filter(p=>p.uses>0)
                      .sort((a,b)=>b.savings-a.savings)
                      .map((p,i) => {
                        const maxSav = Math.max(...PROMOS.map(x=>x.savings));
                        const barW = Math.round((p.savings/maxSav)*100);
                        return (
                          <tr key={p.id}>
                            <td><span className="sku">{String(i+1).padStart(2,'0')}</span></td>
                            <td><span className="nm" style={{whiteSpace:'normal', display:'block', maxWidth:200}}>{p.name}</span></td>
                            <td><PromoTypeBadge type={p.type}/></td>
                            <td className="r num">{p.uses}</td>
                            <td className="r num" style={{color:'var(--success)', fontWeight:600}}>{Q(p.savings)}</td>
                            <td className="r num">{Q(p.savings/p.uses)}</td>
                            <td style={{minWidth:120}}>
                              <div className="prog" style={{width:90}}><i style={{width:`${barW}%`}}/></div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Por tipo */}
            <div className="card">
              <div className="card-head"><h3>{t('promotions.usesByPromoType', 'Usos por tipo de promo')}</h3></div>
              <div className="card-body">
                {PROMO_TYPES.map(t_item => {
                  const ps = PROMOS.filter(p => p.type === t_item.id && p.uses > 0);
                  if (!ps.length) return null;
                  const totalUses = ps.reduce((s,p)=>s+p.uses,0);
                  const totalSav  = ps.reduce((s,p)=>s+p.savings,0);
                  const maxU = Math.max(...PROMO_TYPES.map(tt =>
                    PROMOS.filter(p=>p.type===tt.id).reduce((s,p)=>s+p.uses,0)));
                  const barW = Math.round((totalUses/Math.max(maxU,1))*100);
                  return (
                    <div key={t_item.id} style={{marginBottom:14}}>
                      <div className="row" style={{justifyContent:'space-between', marginBottom:4, fontSize:12}}>
                        <span style={{fontWeight:500}}>
                          <Icon name={t_item.icon} size={11} style={{marginRight:5, color:'var(--muted)'}}/>
                          {t_item.label}
                        </span>
                        <span className="mono">{totalUses} {t('promotions.uses', 'usos')} · {Q(totalSav)}</span>
                      </div>
                      <div className="bar"><div style={{width:`${barW}%`}}/></div>
                    </div>
                  );
                }).filter(Boolean)}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── DRAWER: Detalle promoción ── */}
      {selPromo && (
        <>
          <div className="drawer-overlay" onClick={() => setSelPromo(null)}/>
          <div className="drawer" style={{width:520}}>
            <div className="drawer-head">
              <div>
                <div className="drawer-title">{selPromo.name}</div>
                <div className="muted" style={{fontSize:11, marginTop:2}}>{selPromo.id}</div>
              </div>
              <button className="icon-btn" onClick={() => setSelPromo(null)}><Icon name="x"/></button>
            </div>
            <div className="drawer-body">
              <div className="row" style={{gap:8, marginBottom:16}}>
                <StatusPill status={selPromo.status}/>
                <PromoTypeBadge type={selPromo.type}/>
              </div>

              <p style={{fontSize:13, color:'var(--text-2)', margin:'0 0 20px'}}>{selPromo.desc}</p>

              {/* Valor de la promoción */}
              <div style={{fontFamily:'var(--font-mono)', fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8}}>{t('promotions.promoValue', 'Valor de la promoción')}</div>
              <div className="card" style={{marginBottom:20}}>
                <div className="card-body" style={{padding:'12px 14px'}}>
                  {selPromo.type === 'pct_desc'   && <div style={{fontSize:28, fontWeight:700, color:'var(--accent)'}}>{pct(selPromo.value)} <span style={{fontSize:14, fontWeight:400, color:'var(--muted)'}}>{t('promotions.discount', 'de descuento')}</span></div>}
                  {selPromo.type === 'monto_fijo'  && <div style={{fontSize:28, fontWeight:700, color:'var(--accent)'}}>{Q(selPromo.value)} <span style={{fontSize:14, fontWeight:400, color:'var(--muted)'}}>{t('promotions.fixedDiscount', 'de descuento fijo')}</span></div>}
                  {selPromo.type === 'nxm'         && <div style={{fontSize:28, fontWeight:700, color:'var(--accent)'}}>{selPromo.nxm_n}×{selPromo.nxm_m} <span style={{fontSize:14, fontWeight:400, color:'var(--muted)'}}>{t('promotions.nxmDesc', 'compra')} {selPromo.nxm_n}, {t('promotions.nxmTake', 'lleva')} {selPromo.nxm_m+selPromo.nxm_n}</span></div>}
                  {selPromo.type === 'precio_esp'  && <div style={{fontSize:28, fontWeight:700, color:'var(--accent)'}}>{Q(selPromo.value)} <span style={{fontSize:14, fontWeight:400, color:'var(--muted)'}}>{t('promotions.specialPrice', 'precio especial')}</span></div>}
                  {selPromo.type === 'combo'       && <div style={{fontSize:28, fontWeight:700, color:'var(--accent)'}}>{pct(selPromo.value)} <span style={{fontSize:14, fontWeight:400, color:'var(--muted)'}}>{t('promotions.inCombo', 'en combo')}</span></div>}
                  {selPromo.type === 'min_compra'  && <div><div style={{fontSize:28, fontWeight:700, color:'var(--accent)'}}>{Q(selPromo.value)} <span style={{fontSize:14, fontWeight:400, color:'var(--muted)'}}>{t('promotions.discount', 'de descuento')}</span></div><div style={{fontSize:12, color:'var(--muted)', marginTop:4}}>{t('promotions.whenExceeding', 'al superar')} {Q(selPromo.minCompra)} {t('promotions.inTicket', 'en el ticket')}</div></div>}
                </div>
              </div>

              {/* Condiciones */}
              <div style={{fontFamily:'var(--font-mono)', fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8}}>{t('promotions.conditions', 'Condiciones')}</div>
              <div className="detail-grid" style={{marginBottom:20}}>
                {[
                  [t('promotions.appliesTo', 'Aplica a'),       selPromo.category || (selPromo.product ? selPromo.product : t('promotions.entireCart', 'Todo el carrito'))],
                  [t('promotions.clientType', 'Tipo de cliente'),selPromo.clientType],
                  [t('common.branch', 'Sucursales'),     selPromo.branches],
                  [t('promotions.validDays', 'Días válidos'),   selPromo.dias.map(d => DIAS_SEMANA[d]).join(', ')],
                  [t('promotions.schedule', 'Horario'),        selPromo.horaInicio ? `${selPromo.horaInicio} – ${selPromo.horaFin}` : t('promotions.allDay', 'Todo el día')],
                  [t('promotions.validity', 'Vigencia'),       `${selPromo.dateStart} → ${selPromo.dateEnd}`],
                ].map(([l,v]) => (
                  <div className="detail-row" key={l}>
                    <span className="detail-label">{l}</span>
                    <span style={{fontSize:12, textAlign:'right'}}>{v}</span>
                  </div>
                ))}
              </div>

              {/* Métricas */}
              {selPromo.uses > 0 && (
                <>
                  <div style={{fontFamily:'var(--font-mono)', fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8}}>{t('promotions.performance', 'Rendimiento')}</div>
                  <div className="stat-grid" style={{gridTemplateColumns:'1fr 1fr', gap:8}}>
                    <div className="stat" style={{padding:'10px 12px'}}>
                      <div className="label" style={{fontSize:10}}>{t('promotions.totalUses', 'Usos totales')}</div>
                      <div className="val mono" style={{fontSize:20}}>{selPromo.uses}</div>
                    </div>
                    <div className="stat" style={{padding:'10px 12px'}}>
                      <div className="label" style={{fontSize:10}}>{t('promotions.savingsGenerated', 'Ahorro generado')}</div>
                      <div className="val mono" style={{fontSize:20, color:'var(--success)'}}>{Q(selPromo.savings)}</div>
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="drawer-foot">
              <button className="btn ghost" onClick={() => setSelPromo(null)}>{t('common.close', 'Cerrar')}</button>
              {selPromo.status !== 'expired' && (
                <button className="btn" onClick={() => handleToggle(selPromo)}>
                  <Icon name={selPromo.status==='active'?'alert':'check'} size={12}/>
                  {selPromo.status === 'active' ? t('promotions.pause', 'Pausar') : t('promotions.activate', 'Activar')}
                </button>
              )}
              <button className="btn accent"><Icon name="edit" size={12}/>{t('common.edit', 'Editar')}</button>
            </div>
          </div>
        </>
      )}

      {/* ── MODAL: Nueva promoción (wizard 3 pasos) ── */}
      {showNew && (
        <div className="modal-overlay" onClick={() => { setShowNew(false); setStep(1); }}>
          <div className="modal" style={{width:580}} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{t('promotions.newPromo', 'Nueva promoción')}</h3>
              <div className="row gap-6">
                {[1,2,3].map(s => (
                  <span key={s} style={{
                    width:22, height:22, borderRadius:'50%', fontSize:11, fontWeight:600,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    background: step === s ? 'var(--accent)' : step > s ? 'var(--success)' : 'var(--surface-3)',
                    color: step >= s ? 'white' : 'var(--muted)',
                  }}>{step > s ? '✓' : s}</span>
                ))}
                <button className="icon-btn" onClick={() => { setShowNew(false); setStep(1); }}>
                  <Icon name="x"/>
                </button>
              </div>
            </div>

            <div className="modal-body">
              {/* Paso 1: Tipo y valor */}
              {step === 1 && (
                <>
                  <div style={{fontFamily:'var(--font-mono)', fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:12}}>{t('promotions.step1Title', 'Paso 1 — Tipo y valor de la promoción')}</div>
                  <div className="form-grid">
                    <div className="field span-2">
                      <label className="field-label">{t('promotions.promoName', 'Nombre de la promoción')}</label>
                      <input className="field-input" placeholder={t('promotions.promoNamePlaceholder', 'Ej. Descuento fin de semana en abarrotes')}
                        value={form.name} onChange={e => setF('name', e.target.value)}/>
                    </div>
                  </div>
                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, margin:'16px 0'}}>
                    {PROMO_TYPES.map(t_item => (
                      <button key={t_item.id} type="button"
                        onClick={() => setF('type', t_item.id)}
                        style={{
                          padding:'12px', border: form.type===t_item.id ? '2px solid var(--accent)' : '1px solid var(--border)',
                          background: form.type===t_item.id ? 'var(--accent-soft)' : 'var(--surface)',
                          borderRadius:'var(--r-md)', cursor:'pointer', textAlign:'left',
                          color: form.type===t_item.id ? 'var(--accent-ink)' : 'var(--text)',
                        }}>
                        <div style={{display:'flex', alignItems:'center', gap:7, fontWeight:600, fontSize:12, marginBottom:3}}>
                          <Icon name={t_item.icon} size={13}/>{t_item.label}
                        </div>
                        <div style={{fontSize:11, color:'var(--muted)'}}>{t_item.desc}</div>
                      </button>
                    ))}
                  </div>

                  {/* Valor según tipo */}
                  <div className="form-grid">
                    {form.type === 'pct_desc' && (
                      <div className="field">
                        <label className="field-label">{t('promotions.discountPct', 'Porcentaje de descuento (%)')}</label>
                        <input className="field-input mono" type="number" placeholder="Ej. 10"
                          value={form.value} onChange={e => setF('value', e.target.value)}/>
                      </div>
                    )}
                    {form.type === 'monto_fijo' && (
                      <div className="field">
                        <label className="field-label">{t('promotions.discountAmount', 'Monto de descuento (Q)')}</label>
                        <input className="field-input mono" type="number" placeholder="Ej. 25.00"
                          value={form.value} onChange={e => setF('value', e.target.value)}/>
                      </div>
                    )}
                    {form.type === 'nxm' && (
                      <>
                        <div className="field">
                          <label className="field-label">{t('promotions.buyNUnits', 'Compra N unidades')}</label>
                          <input className="field-input mono" type="number" placeholder="2"
                            value={form.nxm_n} onChange={e => setF('nxm_n', e.target.value)}/>
                        </div>
                        <div className="field">
                          <label className="field-label">{t('promotions.getMUnits', 'Lleva M unidades')}</label>
                          <input className="field-input mono" type="number" placeholder="1"
                            value={form.nxm_m} onChange={e => setF('nxm_m', e.target.value)}/>
                        </div>
                      </>
                    )}
                    {form.type === 'precio_esp' && (
                      <div className="field">
                        <label className="field-label">{t('promotions.specialPriceLabel', 'Precio especial (Q)')}</label>
                        <input className="field-input mono" type="number" placeholder="Ej. 32.00"
                          value={form.value} onChange={e => setF('value', e.target.value)}/>
                      </div>
                    )}
                    {form.type === 'combo' && (
                      <div className="field">
                        <label className="field-label">{t('promotions.comboDiscountPct', '% de descuento en combo')}</label>
                        <input className="field-input mono" type="number" placeholder="Ej. 15"
                          value={form.value} onChange={e => setF('value', e.target.value)}/>
                      </div>
                    )}
                    {form.type === 'min_compra' && (
                      <>
                        <div className="field">
                          <label className="field-label">{t('promotions.minTicketAmount', 'Monto mínimo del ticket (Q)')}</label>
                          <input className="field-input mono" type="number" placeholder="500"
                            value={form.minCompra} onChange={e => setF('minCompra', e.target.value)}/>
                        </div>
                        <div className="field">
                          <label className="field-label">{t('promotions.fixedDiscountLabel', 'Descuento fijo (Q)')}</label>
                          <input className="field-input mono" type="number" placeholder="50"
                            value={form.value} onChange={e => setF('value', e.target.value)}/>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}

              {/* Paso 2: A qué aplica */}
              {step === 2 && (
                <>
                  <div style={{fontFamily:'var(--font-mono)', fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:12}}>{t('promotions.step2Title', 'Paso 2 — ¿A qué aplica?')}</div>
                  <div className="form-grid">
                    <div className="field">
                      <label className="field-label">{t('promotions.productCategory', 'Categoría de producto')}</label>
                      <select className="field-input" value={form.category} onChange={e => setF('category', e.target.value)}>
                        <option value="">{t('promotions.allCategories', 'Todas las categorías')}</option>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label className="field-label">{t('promotions.clientType', 'Tipo de cliente')}</label>
                      <select className="field-input" value={form.clientType} onChange={e => setF('clientType', e.target.value)}>
                        {CLIENT_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label className="field-label">{t('common.branch', 'Sucursales')}</label>
                      <select className="field-input" value={form.branches} onChange={e => setF('branches', e.target.value)}>
                        {BRANCHES_OPT.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label className="field-label">{t('promotions.specificProduct', 'Producto específico (opcional)')}</label>
                      <input className="field-input" placeholder="Ej. Coca-Cola 600ml"
                        value={form.product} onChange={e => setF('product', e.target.value)}/>
                    </div>
                    <div className="field span-2">
                      <label className="field-label">{t('promotions.internalDesc', 'Descripción interna')}</label>
                      <input className="field-input" placeholder={t('promotions.internalDescPlaceholder', 'Descripción para el equipo…')}
                        value={form.desc} onChange={e => setF('desc', e.target.value)}/>
                    </div>
                  </div>
                </>
              )}

              {/* Paso 3: Vigencia y horario */}
              {step === 3 && (
                <>
                  <div style={{fontFamily:'var(--font-mono)', fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:12}}>{t('promotions.step3Title', 'Paso 3 — Vigencia y horario')}</div>
                  <div className="form-grid">
                    <div className="field">
                      <label className="field-label">{t('promotions.startDate', 'Fecha inicio')}</label>
                      <input className="field-input" type="date" value={form.dateStart}
                        onChange={e => setF('dateStart', e.target.value)}/>
                    </div>
                    <div className="field">
                      <label className="field-label">{t('promotions.endDate', 'Fecha fin')}</label>
                      <input className="field-input" type="date" value={form.dateEnd}
                        onChange={e => setF('dateEnd', e.target.value)}/>
                    </div>
                    <div className="field">
                      <label className="field-label">{t('promotions.startTime', 'Hora inicio (opcional)')}</label>
                      <input className="field-input mono" type="time" value={form.horaInicio}
                        onChange={e => setF('horaInicio', e.target.value)}/>
                    </div>
                    <div className="field">
                      <label className="field-label">{t('promotions.endTime', 'Hora fin (opcional)')}</label>
                      <input className="field-input mono" type="time" value={form.horaFin}
                        onChange={e => setF('horaFin', e.target.value)}/>
                    </div>
                  </div>

                  <div style={{marginTop:16}}>
                    <div className="field-label" style={{marginBottom:8}}>{t('promotions.daysOfWeek', 'Días de la semana')}</div>
                    <div style={{display:'flex', gap:6}}>
                      {DIAS_SEMANA.map((d,i) => (
                        <button key={i} type="button"
                          onClick={() => toggleDia(i)}
                          style={{
                            width:38, height:38, borderRadius:'var(--r-md)',
                            border: form.dias.includes(i) ? '2px solid var(--accent)' : '1px solid var(--border)',
                            background: form.dias.includes(i) ? 'var(--accent)' : 'var(--surface)',
                            color: form.dias.includes(i) ? 'white' : 'var(--text-2)',
                            cursor:'pointer', fontSize:11, fontWeight:600,
                          }}>{d}</button>
                      ))}
                    </div>
                  </div>

                  {/* Resumen */}
                  <div style={{marginTop:20, padding:'14px', background:'var(--surface-2)', borderRadius:'var(--r-md)', border:'1px solid var(--border)'}}>
                    <div style={{fontFamily:'var(--font-mono)', fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8}}>{t('promotions.promoSummary', 'Resumen de la promoción')}</div>
                    <div style={{fontSize:13, fontWeight:600, marginBottom:6}}>{form.name || t('promotions.noName', '(Sin nombre)')}</div>
                    <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                      <PromoTypeBadge type={form.type}/>
                      {form.category && <span className="pill">{form.category}</span>}
                      <span className="pill">{form.clientType}</span>
                      <span className="pill">{form.branches}</span>
                      <span className="pill">{form.dateStart} → {form.dateEnd}</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="modal-foot">
              <button className="btn ghost" onClick={() => { setShowNew(false); setStep(1); }}>{t('common.cancel', 'Cancelar')}</button>
              {step > 1 && (
                <button className="btn" onClick={() => setStep(s => s - 1)}>
                  <Icon name="chevronLeft" size={12}/>{t('promotions.previous', 'Anterior')}
                </button>
              )}
              {step < 3 ? (
                <button className="btn accent" onClick={() => setStep(s => s + 1)}>
                  {t('promotions.next', 'Siguiente')}<Icon name="chevronRight" size={12}/>
                </button>
              ) : (
                <button className="btn accent" onClick={handleSave}>
                  <Icon name="check" size={12}/>{t('promotions.createPromo', 'Crear promoción')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
