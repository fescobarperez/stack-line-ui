// Stackline — Fixed Assets / Activos Fijos (Guatemala · Decreto 26-92 ISR)
// Data-driven: activos desde /api/fixed-assets (hook useAssets). La depreciación
// línea recta se calcula en el front sobre el costo/fecha reales.
import React, { useState, useMemo, useEffect } from 'react';
import Icon from '../components/Icon.jsx';
import DataTable from '../components/DataTable.jsx';
import { useAssets } from '../hooks/useOperations.js';
import { useAccounts } from '../hooks/useAccounting.js';
import { createAsset, updateAsset, disposeAsset } from '../api/wave3.js';
import { getSetting, putSetting } from '../api/wave2.js';

// Claves de configuración de las cuentas de la partida de baja (company_settings).
const DISPOSAL_KEYS = {
  asset: 'asset_disposal.asset_account',
  depr:  'asset_disposal.depreciation_account',
  loss:  'asset_disposal.loss_account',
};
import { useTranslation } from 'react-i18next';

const Q  = (n) => `Q ${Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n) => `${((n || 0) * 100).toFixed(2)}%`;

// Backend FixedAsset.Response → forma de la UI.
function mapAsset(a) {
  return {
    id: a.assetCode || `AF-${a.id}`,
    apiId: a.id,
    name: a.name,
    cat: a.category || 'computo',
    purchase: Number(a.purchaseCost || 0),
    acquired: a.acquiredDate || '',
    serial: a.serial || '',
    branch: a.branchId ? `#${a.branchId}` : '—',
    status: (a.status === 'retired' || a.status === 'baja') ? 'baja' : (a.status || 'active'),
    notes: a.notes || '',
  };
}

// ── Categorías y tasas SAT (Decreto 26-92, Art. 19) ───────────────────────
const CATEGORIES = [
  { id: 'edificios',    name: 'Edificios e instalaciones',  rate: 0.05,    years: 20, icon: '🏢' },
  { id: 'maquinaria',   name: 'Maquinaria y equipo',        rate: 0.20,    years: 5,  icon: '⚙️' },
  { id: 'vehiculos',    name: 'Vehículos',                  rate: 0.20,    years: 5,  icon: '🚛' },
  { id: 'mobiliario',   name: 'Mobiliario y equipo',        rate: 0.20,    years: 5,  icon: '🪑' },
  { id: 'computo',      name: 'Equipo de cómputo',          rate: 0.3333,  years: 3,  icon: '💻' },
  { id: 'herramientas', name: 'Herramientas y utensilios',  rate: 0.25,    years: 4,  icon: '🔧' },
  { id: 'otros',        name: 'Otros activos',              rate: 0.10,    years: 10, icon: '📦' },
];

const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

const now = new Date();
const CUR_YEAR  = now.getFullYear();
const CUR_MONTH = now.getMonth() + 1; // 1-based

// ── Mock assets ────────────────────────────────────────────────────────────
// (activos vienen del backend)

// ── Cálculo de depreciación (línea recta) ──────────────────────────────────
function calcDepr(asset) {
  const cat       = CAT_MAP[asset.cat];
  const rate      = cat?.rate ?? 0.10;
  const acqDate   = new Date(asset.acquired);
  const acqYear   = acqDate.getFullYear();
  const acqMonth  = acqDate.getMonth() + 1;

  // Meses desde adquisición hasta hoy
  const monthsOwned = (CUR_YEAR - acqYear) * 12 + (CUR_MONTH - acqMonth);

  const deprAnual   = asset.purchase * rate;
  const deprMensual = deprAnual / 12;
  const deprAcum    = Math.min(asset.purchase, deprMensual * Math.max(0, monthsOwned));
  const valorLibros = Math.max(0, asset.purchase - deprAcum);
  const pctDepAcum  = asset.purchase > 0 ? deprAcum / asset.purchase : 0;
  const yearsLeft   = valorLibros > 0 ? valorLibros / deprAnual : 0;
  const fullyDepr   = valorLibros <= 0;

  return { rate, deprAnual, deprMensual, deprAcum, valorLibros, pctDepAcum, yearsLeft, fullyDepr, monthsOwned };
}

const STATUS_LABELS = { active:'Activo', baja:'Dado de baja', mantenimiento:'En mantenimiento' };
const STATUS_PILL   = { active:'success', baja:'danger', mantenimiento:'warning' };

// ══════════════════════════════════════════════════════════════════════════════
export default function FixedAssets({ pushToast }) {
  const { t } = useTranslation();
  const [tab,         setTab]         = useState('activos');
  const [selAsset,    setSelAsset]    = useState(null);
  const [showNew,     setShowNew]     = useState(false);
  const [showBaja,    setShowBaja]    = useState(null);
  const [bajaReason,  setBajaReason]  = useState('Obsolescencia');
  const [bajaBusy,    setBajaBusy]    = useState(false);
  const [showConfig,  setShowConfig]  = useState(false);
  const [search,      setSearch]      = useState('');
  const [catFilter,   setCatFilter]   = useState('todos');
  const [statusFilter,setStatusFilter]= useState('active');
  const [newForm,     setNewForm]     = useState({
    name:'', cat:'computo', purchase:'', acquired:'', serial:'', branch:'Zona 10', notes:''
  });

  const { items: assetsRaw, reload } = useAssets();
  const { items: accounts } = useAccounts();
  const assets = useMemo(() => assetsRaw.map(mapAsset).map(a => ({ ...a, depr: calcDepr(a) })), [assetsRaw]);

  const filtered = assets.filter(a => {
    if (search && !a.name.toLowerCase().includes(search.toLowerCase()) &&
        !a.id.toLowerCase().includes(search.toLowerCase())) return false;
    if (catFilter    !== 'todos'  && a.cat    !== catFilter)    return false;
    if (statusFilter !== 'todos'  && a.status !== statusFilter) return false;
    return true;
  });

  const activeAssets = assets.filter(a => a.status === 'active');

  const assetColumns = [
    { key: 'id', header: t('common.code', 'Código'), render: (a) => <span className="sku">{a.id}</span> },
    { key: 'name', header: t('fixedassets.asset', 'Activo'), sortable: true, render: (a) => (
      <div className="cell-stack"><span className="nm">{a.name}</span>{a.serial && <span className="sku">S/N {a.serial}</span>}</div>
    ) },
    { key: 'cat', header: t('common.category', 'Categoría'), sortable: true, render: (a) => { const cat = CAT_MAP[a.cat]; return <span><span style={{ marginRight: 5 }}>{cat?.icon}</span>{cat?.name}</span>; } },
    { key: 'branch', header: t('common.branch', 'Sucursal'), sortable: true, render: (a) => <span style={{ color: 'var(--muted)' }}>{a.branch}</span> },
    { key: 'purchase', header: t('fixedassets.historicalCostShort', 'Costo histórico'), align: 'right', sortable: true, render: (a) => <span className="num">{Q(a.purchase)}</span> },
    { key: 'deprAcum', header: t('fixedassets.accDeprShort', 'Dep. acumulada'), align: 'right', render: (a) => <span className="num" style={{ color: 'var(--danger)' }}>{a.status === 'active' ? Q(a.depr.deprAcum) : '—'}</span> },
    { key: 'valorLibros', header: t('fixedassets.bookValue', 'Valor en libros'), align: 'right', sortable: true, sortValue: (a) => a.depr.valorLibros, render: (a) => <span className="num" style={{ fontWeight: 600, color: a.depr.fullyDepr ? 'var(--muted)' : undefined }}>{a.status === 'active' ? Q(a.depr.valorLibros) : '—'}</span> },
    { key: 'pctDep', header: t('fixedassets.pctDepr', '% Dep.'), render: (a) => {
      if (a.status !== 'active') return null;
      const barW = Math.round(a.depr.pctDepAcum * 100);
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 120 }}>
          <div className="prog" style={{ width: 90 }}><i style={{ width: `${barW}%`, background: barW >= 90 ? 'var(--danger)' : barW >= 60 ? 'var(--warning)' : 'var(--accent)' }} /></div>
          <span className="sku">{barW}%</span>
        </div>
      );
    } },
    { key: 'status', header: t('common.status', 'Estado'), sortable: true, render: (a) => <span className={`badge-m3 ${a.status === 'active' ? 'success' : a.status === 'baja' ? 'error' : 'warning'}`}>{STATUS_LABELS[a.status]}</span> },
  ];

  const summary = useMemo(() => ({
    totalCosto:   activeAssets.reduce((s, a) => s + a.purchase,        0),
    totalLibros:  activeAssets.reduce((s, a) => s + a.depr.valorLibros, 0),
    totalAcum:    activeAssets.reduce((s, a) => s + a.depr.deprAcum,   0),
    totalMensual: activeAssets.reduce((s, a) => s + a.depr.deprMensual, 0),
    totalAnual:   activeAssets.reduce((s, a) => s + a.depr.deprAnual,  0),
    count:        activeAssets.length,
    bycat: CATEGORIES.map(c => ({
      ...c,
      count: activeAssets.filter(a => a.cat === c.id).length,
      costo: activeAssets.filter(a => a.cat === c.id).reduce((s,a) => s + a.purchase, 0),
      libros:activeAssets.filter(a => a.cat === c.id).reduce((s,a) => s + a.depr.valorLibros, 0),
    })).filter(c => c.count > 0),
  }), [assets]);

  const setNew = (k, v) => setNewForm(f => ({ ...f, [k]: v }));

  const handleSaveNew = async () => {
    if (!newForm.name || !newForm.purchase || !newForm.acquired) {
      pushToast && pushToast('Completa nombre, valor y fecha de adquisición', 'danger');
      return;
    }
    const cat = CAT_MAP[newForm.cat];
    try {
      await createAsset({
        assetCode: newForm.serial || null,
        name: newForm.name,
        category: newForm.cat,
        purchaseCost: parseFloat(newForm.purchase) || 0,
        acquiredDate: newForm.acquired,
        serial: newForm.serial || null,
        branchId: null,
        status: 'active',
        depreciationRate: cat?.rate ?? null,
        usefulLifeYears: cat?.years ?? null,
        notes: newForm.notes || null,
      });
      await reload();
      pushToast && pushToast(`Activo "${newForm.name}" registrado`, 'success');
      setShowNew(false);
      setNewForm({ name:'', cat:'computo', purchase:'', acquired:'', serial:'', branch:'Zona 10', notes:'' });
    } catch (err) {
      pushToast && pushToast('No se pudo registrar el activo: ' + err.message, 'danger');
    }
  };

  const handleBaja = async () => {
    setBajaBusy(true);
    try {
      const res = await disposeAsset(showBaja.apiId, {
        disposalDate: new Date().toISOString().slice(0, 10),
        notes: `Baja: ${bajaReason}`,
      });
      await reload();
      pushToast && pushToast(
        `Activo dado de baja · partida contable #${res.disposalJournalEntryId} generada`,
        'success');
      setShowBaja(null);
      setSelAsset(null);
    } catch (err) {
      pushToast && pushToast('No se pudo dar de baja: ' + err.message, 'danger');
    } finally { setBajaBusy(false); }
  };

  return (
    <div className="page">
      {/* Header */}
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('fixedassets.title', 'Activos Fijos')}</h1>
          <div className="page-subtitle">
            {t('fixedassets.subtitle', 'Depreciación línea recta · Decreto 26-92 ISR Guatemala')} · {CUR_YEAR}
          </div>
        </div>
        <div className="page-head-actions">
          <button className="btn" onClick={() => setShowConfig(true)}>
            <Icon name="settings" size={12}/>{t('fixedassets.accountConfig', 'Configuración contable')}
          </button>
          <button className="btn accent" onClick={() => setShowNew(true)}>
            <Icon name="plus" size={12}/>{t('fixedassets.newAsset', 'Nuevo activo')}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {[
          { id:'activos',      label:`${t('fixedassets.tabs.assets', 'Activos')} (${activeAssets.length})` },
          { id:'depreciacion', label: t('fixedassets.tabs.depreciation', 'Depreciación del período') },
          { id:'categorias',   label: t('fixedassets.tabs.categories', 'Categorías SAT') },
          { id:'bajas',        label: t('fixedassets.tabs.retirements', 'Bajas') },
        ].map(t2 => (
          <button key={t2.id} className={`tab ${tab === t2.id ? 'active':''}`}
            onClick={() => setTab(t2.id)}>{t2.label}
          </button>
        ))}
      </div>

      {/* ── TAB: ACTIVOS ── */}
      {tab === 'activos' && (
        <>
          {/* KPIs */}
          <div className="stat-grid" style={{gridTemplateColumns:'repeat(4,1fr)', marginBottom:16}}>
            <div className="stat">
              <div className="label"><Icon name="box" size={11}/>{t('fixedassets.historicalCost', 'Costo histórico total')}</div>
              <div className="val mono" style={{fontSize:20}}>{Q(summary.totalCosto)}</div>
              <div className="delta" style={{color:'var(--muted)'}}>{summary.count} {t('fixedassets.activeAssets', 'activos activos')}</div>
            </div>
            <div className="stat">
              <div className="label"><Icon name="chart" size={11}/>{t('fixedassets.bookValue', 'Valor en libros')}</div>
              <div className="val mono" style={{fontSize:20}}>{Q(summary.totalLibros)}</div>
              <div className="delta" style={{color:'var(--muted)'}}>
                {pct(summary.totalLibros / summary.totalCosto)} {t('fixedassets.ofCost', 'del costo')}
              </div>
            </div>
            <div className="stat">
              <div className="label"><Icon name="arrowDown" size={11}/>{t('fixedassets.accumulatedDepr', 'Depreciación acumulada')}</div>
              <div className="val mono" style={{fontSize:20, color:'var(--danger)'}}>{Q(summary.totalAcum)}</div>
              <div className="delta" style={{color:'var(--muted)'}}>
                {pct(summary.totalAcum / summary.totalCosto)} {t('fixedassets.depreciated', 'depreciado')}
              </div>
            </div>
            <div className="stat">
              <div className="label"><Icon name="calendar" size={11}/>{t('fixedassets.monthlyDepr', 'Depreciación mensual')}</div>
              <div className="val mono" style={{fontSize:20, color:'var(--accent)'}}>{Q(summary.totalMensual)}</div>
              <div className="delta" style={{color:'var(--muted)'}}>{Q(summary.totalAnual)} {t('fixedassets.annual', 'anual')}</div>
            </div>
          </div>

          {/* Filtros */}
          <div className="toolbar">
            <div className="search-wrap" style={{flex:1, maxWidth:320}}>
              <Icon name="search" size={13} className="icon"/>
              <input className="search-input" placeholder={t('fixedassets.searchPlaceholder', 'Buscar activo…')}
                value={search} onChange={e => setSearch(e.target.value)}/>
            </div>
            <select className="field-input" value={catFilter}
              onChange={e => setCatFilter(e.target.value)} style={{width:'auto'}}>
              <option value="todos">{t('fixedassets.allCategories', 'Todas las categorías')}</option>
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className="field-input" value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)} style={{width:'auto'}}>
              <option value="todos">{t('fixedassets.allStatuses', 'Todos los estados')}</option>
              <option value="active">{t('fixedassets.statusActive', 'Activos')}</option>
              <option value="baja">{t('fixedassets.statusRetired', 'Dados de baja')}</option>
            </select>
            <span className="muted" style={{fontSize:11, marginLeft:'auto'}}>{filtered.length} {t('fixedassets.records', 'registros')}</span>
          </div>

          {/* Tabla */}
          <DataTable
            rowKey={(a) => a.id}
            columns={assetColumns}
            rows={filtered}
            density="compact"
            pageSize={12}
            onRowClick={(a) => setSelAsset(a)}
            onView={(a) => setSelAsset(a)}
            empty={t('fixedassets.noAssets', 'Sin activos')}
          />
        </>
      )}

      {/* ── TAB: DEPRECIACIÓN DEL PERÍODO ── */}
      {tab === 'depreciacion' && (
        <>
          <div className="card" style={{marginBottom:16}}>
            <div className="card-head">
              <div>
                <h3>{t('fixedassets.deprEntry', 'Partida de depreciación')} — {`${String(CUR_MONTH).padStart(2,'0')}/${CUR_YEAR}`}</h3>
                <div className="meta">{t('fixedassets.straightLineMethod', 'Línea recta · Método aceptado SAT Decreto 26-92')}</div>
              </div>
              <div className="row gap-6">
                <button className="btn sm"><Icon name="receipt" size={12}/>{t('fixedassets.registerEntry', 'Registrar partida')}</button>
                <button className="btn sm"><Icon name="download" size={12}/>Excel</button>
              </div>
            </div>
            <div className="tbl-wrap">
              <table className="mtable" style={{fontSize:11.5}}>
                <thead>
                  <tr>
                    <th>{t('common.code', 'Código')}</th>
                    <th>{t('fixedassets.asset', 'Activo')}</th>
                    <th>{t('common.category', 'Categoría')}</th>
                    <th className="num">{t('fixedassets.historicalCostShort', 'Costo histórico')}</th>
                    <th className="num">{t('fixedassets.annualRate', 'Tasa anual')}</th>
                    <th className="num">{t('fixedassets.annualDepr', 'Dep. anual')}</th>
                    <th className="num">{t('fixedassets.monthlyDeprShort', 'Dep. mensual')}</th>
                    <th className="num">{t('fixedassets.accDeprShort', 'Dep. acumulada')}</th>
                    <th className="num">{t('fixedassets.bookValue', 'Valor en libros')}</th>
                  </tr>
                </thead>
                <tbody>
                  {activeAssets.map(a => {
                    const cat = CAT_MAP[a.cat];
                    return (
                      <tr key={a.id}>
                        <td className="mono">{a.id}</td>
                        <td style={{fontWeight:500}}>{a.name}</td>
                        <td><span style={{marginRight:4}}>{cat?.icon}</span>{cat?.name}</td>
                        <td className="num">{Q(a.purchase)}</td>
                        <td className="num mono">{pct(a.depr.rate)}</td>
                        <td className="num">{Q(a.depr.deprAnual)}</td>
                        <td className="num" style={{color:'var(--accent)', fontWeight:600}}>
                          {Q(a.depr.deprMensual)}
                        </td>
                        <td className="num" style={{color:'var(--danger)'}}>{Q(a.depr.deprAcum)}</td>
                        <td className="num" style={{fontWeight:600,
                          color: a.depr.fullyDepr ? 'var(--muted)' : 'var(--text)'}}>
                          {Q(a.depr.valorLibros)}
                          {a.depr.fullyDepr && <span className="pill warning" style={{marginLeft:6, fontSize:9}}>{t('fixedassets.exhausted', 'Agotado')}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{background:'var(--surface-2)', fontWeight:700}}>
                    <td colSpan={3} style={{padding:'8px 12px'}}>{t('fixedassets.totals', 'TOTALES')}</td>
                    <td className="num" style={{padding:'8px 12px'}}>{Q(summary.totalCosto)}</td>
                    <td/>
                    <td className="num" style={{padding:'8px 12px'}}>{Q(summary.totalAnual)}</td>
                    <td className="num" style={{padding:'8px 12px', color:'var(--accent)'}}>{Q(summary.totalMensual)}</td>
                    <td className="num" style={{padding:'8px 12px', color:'var(--danger)'}}>{Q(summary.totalAcum)}</td>
                    <td className="num" style={{padding:'8px 12px'}}>{Q(summary.totalLibros)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Asiento contable sugerido */}
          <div className="card">
            <div className="card-head">
              <h3>{t('fixedassets.suggestedEntry', 'Asiento contable sugerido')}</h3>
              <span className="meta">{`${String(CUR_MONTH).padStart(2,'0')}/${CUR_YEAR}`}</span>
            </div>
            <div className="card-body">
              <table className="mtable">
                <thead>
                  <tr><th>{t('fixedassets.account', 'Cuenta')}</th><th>{t('common.description', 'Descripción')}</th><th className="num">{t('fixedassets.debit', 'Débito')}</th><th className="num">{t('fixedassets.credit', 'Crédito')}</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="mono">6-1-03-001</td>
                    <td>Gasto depreciación — Edificios</td>
                    <td className="num">{Q(activeAssets.filter(a=>a.cat==='edificios').reduce((s,a)=>s+a.depr.deprMensual,0))}</td>
                    <td className="num">—</td>
                  </tr>
                  <tr>
                    <td className="mono">6-1-03-002</td>
                    <td>Gasto depreciación — Maquinaria y equipo</td>
                    <td className="num">{Q(activeAssets.filter(a=>['maquinaria','herramientas'].includes(a.cat)).reduce((s,a)=>s+a.depr.deprMensual,0))}</td>
                    <td className="num">—</td>
                  </tr>
                  <tr>
                    <td className="mono">6-1-03-003</td>
                    <td>Gasto depreciación — Vehículos</td>
                    <td className="num">{Q(activeAssets.filter(a=>a.cat==='vehiculos').reduce((s,a)=>s+a.depr.deprMensual,0))}</td>
                    <td className="num">—</td>
                  </tr>
                  <tr>
                    <td className="mono">6-1-03-004</td>
                    <td>Gasto depreciación — Equipo de cómputo</td>
                    <td className="num">{Q(activeAssets.filter(a=>a.cat==='computo').reduce((s,a)=>s+a.depr.deprMensual,0))}</td>
                    <td className="num">—</td>
                  </tr>
                  <tr>
                    <td className="mono">6-1-03-005</td>
                    <td>Gasto depreciación — Mobiliario</td>
                    <td className="num">{Q(activeAssets.filter(a=>a.cat==='mobiliario').reduce((s,a)=>s+a.depr.deprMensual,0))}</td>
                    <td className="num">—</td>
                  </tr>
                  <tr style={{background:'var(--surface-2)'}}>
                    <td className="mono">1-2-01-099</td>
                    <td>Depreciación acumulada (acumulado del período)</td>
                    <td className="num">—</td>
                    <td className="num" style={{fontWeight:700, color:'var(--accent)'}}>{Q(summary.totalMensual)}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr style={{fontWeight:700}}>
                    <td colSpan={2} style={{padding:'8px 12px'}}>{t('fixedassets.totals', 'TOTALES')}</td>
                    <td className="num" style={{padding:'8px 12px'}}>{Q(summary.totalMensual)}</td>
                    <td className="num" style={{padding:'8px 12px'}}>{Q(summary.totalMensual)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── TAB: CATEGORÍAS SAT ── */}
      {tab === 'categorias' && (
        <div className="grid-2" style={{gridTemplateColumns:'1fr 1fr', gap:16}}>
          {CATEGORIES.map(cat => {
            const info = summary.bycat.find(c => c.id === cat.id);
            return (
              <div className="card" key={cat.id}>
                <div className="card-head">
                  <h3>
                    <span style={{marginRight:8}}>{cat.icon}</span>{cat.name}
                  </h3>
                  <span className="pill accent mono">{pct(cat.rate)}/{t('fixedassets.year', 'año')}</span>
                </div>
                <div className="card-body">
                  <div className="detail-grid">
                    <div className="detail-row">
                      <span className="detail-label">{t('fixedassets.usefulLife', 'Vida útil')}</span>
                      <span className="mono">{cat.years} {t('fixedassets.years', 'años')}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">{t('fixedassets.satAnnualRate', 'Tasa anual SAT')}</span>
                      <span className="mono">{pct(cat.rate)}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">{t('fixedassets.registeredAssets', 'Activos registrados')}</span>
                      <span className="mono">{info?.count ?? 0}</span>
                    </div>
                    {info && (
                      <>
                        <div className="detail-row">
                          <span className="detail-label">{t('fixedassets.totalCost', 'Costo total')}</span>
                          <span className="mono">{Q(info.costo)}</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">{t('fixedassets.bookValue', 'Valor en libros')}</span>
                          <span className="mono" style={{color:'var(--accent)'}}>{Q(info.libros)}</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">{t('fixedassets.totalMonthlyDepr', 'Dep. mensual total')}</span>
                          <span className="mono">{Q(info.costo * cat.rate / 12)}</span>
                        </div>
                      </>
                    )}
                  </div>
                  {info && (
                    <div className="bar" style={{marginTop:10}}>
                      <div style={{width:`${Math.round((1 - info.libros/info.costo)*100)}%`}}/>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {/* Referencia legal */}
          <div className="card" style={{gridColumn:'1 / -1'}}>
            <div className="card-head"><h3>{t('fixedassets.legalReference', 'Referencia legal · Decreto 26-92 Art. 19')}</h3></div>
            <div className="card-body">
              <div className="alert">
                <Icon name="alert" size={13}/>
                {t('fixedassets.legalNote', 'Tasas máximas permitidas por la SAT para el régimen general. El método de línea recta es el más utilizado. La depreciación inicia desde el mes de adquisición. El valor residual para efectos fiscales es Q0.')}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: BAJAS ── */}
      {tab === 'bajas' && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('common.code', 'Código')}</th><th>{t('fixedassets.asset', 'Activo')}</th><th>{t('common.category', 'Categoría')}</th>
                <th className="num">{t('fixedassets.historicalCostShort', 'Costo histórico')}</th>
                <th className="num">{t('fixedassets.accDeprAtRetirement', 'Dep. acumulada al dar de baja')}</th>
                <th className="num">{t('fixedassets.bookValue', 'Valor en libros')}</th>
                <th>{t('fixedassets.reason', 'Motivo')}</th>
              </tr>
            </thead>
            <tbody>
              {assets.filter(a => a.status === 'baja').map(a => {
                const cat = CAT_MAP[a.cat];
                return (
                  <tr key={a.id}>
                    <td className="mono">{a.id}</td>
                    <td style={{fontWeight:500}}>{a.name}</td>
                    <td>{cat?.icon} {cat?.name}</td>
                    <td className="num">{Q(a.purchase)}</td>
                    <td className="num" style={{color:'var(--danger)'}}>{Q(a.depr.deprAcum)}</td>
                    <td className="num">{Q(a.depr.valorLibros)}</td>
                    <td className="muted" style={{maxWidth:220, whiteSpace:'normal'}}>{a.notes}</td>
                  </tr>
                );
              })}
              {assets.filter(a => a.status === 'baja').length === 0 && (
                <tr><td colSpan={7} className="empty">{t('fixedassets.noRetirements', 'Sin activos dados de baja')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── DRAWER: Detalle de activo ── */}
      {selAsset && (
        <>
          <div className="drawer-overlay" onClick={() => setSelAsset(null)}/>
          <div className="drawer" style={{width:540}}>
            <div className="drawer-head">
              <div>
                <div className="drawer-title">{selAsset.name}</div>
                <div className="muted" style={{fontSize:11, marginTop:2}}>
                  {selAsset.id} · {CAT_MAP[selAsset.cat]?.icon} {CAT_MAP[selAsset.cat]?.name}
                </div>
              </div>
              <button className="icon-btn" onClick={() => setSelAsset(null)}><Icon name="x"/></button>
            </div>
            <div className="drawer-body">
              <div className="row" style={{marginBottom:16, gap:8}}>
                <span className={`pill ${STATUS_PILL[selAsset.status]}`}>
                  <span className="dot"/>{STATUS_LABELS[selAsset.status]}
                </span>
                <span className="pill">{selAsset.branch}</span>
              </div>

              {/* Datos */}
              <div style={{fontFamily:'var(--font-mono)', fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8}}>{t('fixedassets.assetData', 'Datos del activo')}</div>
              <div className="detail-grid" style={{marginBottom:20}}>
                {[
                  [t('fixedassets.acquisitionDate', 'Fecha de adquisición'), selAsset.acquired],
                  [t('fixedassets.serialPlate', 'No. serie / placa'),    selAsset.serial || '—'],
                  [t('common.branch', 'Sucursal'),             selAsset.branch],
                  [t('fixedassets.historicalCostShort', 'Costo histórico'),      Q(selAsset.purchase)],
                  [t('common.notes', 'Notas'),                selAsset.notes || '—'],
                ].map(([l,v]) => (
                  <div className="detail-row" key={l}>
                    <span className="detail-label">{l}</span>
                    <span style={{fontSize:12, textAlign:'right', maxWidth:260, wordBreak:'break-word'}}>{v}</span>
                  </div>
                ))}
              </div>

              {/* Depreciación */}
              {selAsset.status === 'active' && (() => {
                const d = selAsset.depr;
                const barW = Math.round(d.pctDepAcum * 100);
                return (
                  <>
                    <div style={{fontFamily:'var(--font-mono)', fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8}}>{t('fixedassets.accumulatedDepr', 'Depreciación acumulada')}</div>
                    <div style={{marginBottom:10}}>
                      <div className="row" style={{justifyContent:'space-between', marginBottom:4, fontSize:11}}>
                        <span className="mono muted">0%</span>
                        <span className="mono" style={{fontWeight:600}}>{barW}% {t('fixedassets.depreciated', 'depreciado')}</span>
                        <span className="mono muted">100%</span>
                      </div>
                      <div className="bar" style={{height:10}}>
                        <div style={{width:`${barW}%`,
                          background: barW >= 90 ? 'var(--danger)' : barW >= 60 ? 'var(--warning)' : 'var(--accent)'}}/>
                      </div>
                    </div>
                    <div className="card" style={{marginBottom:16}}>
                      <div className="card-body" style={{padding:0}}>
                        <table className="mtable" style={{fontSize:12}}>
                          <tbody>
                            <tr><td>{t('fixedassets.deprRate', 'Tasa de depreciación')}</td><td className="num">{pct(d.rate)}/{t('fixedassets.year', 'año')}</td></tr>
                            <tr><td>{t('fixedassets.annualDepr', 'Depreciación anual')}</td><td className="num">{Q(d.deprAnual)}</td></tr>
                            <tr><td>{t('fixedassets.monthlyDeprShort', 'Depreciación mensual')}</td><td className="num" style={{color:'var(--accent)'}}>{Q(d.deprMensual)}</td></tr>
                            <tr><td>{t('fixedassets.monthsInUse', 'Meses en uso')}</td><td className="num">{d.monthsOwned} {t('fixedassets.months', 'meses')}</td></tr>
                            <tr><td>{t('fixedassets.accDeprToDate', 'Dep. acumulada a la fecha')}</td><td className="num" style={{color:'var(--danger)'}}>{Q(d.deprAcum)}</td></tr>
                            <tr style={{background:'var(--surface-2)', fontWeight:700}}>
                              <td style={{padding:'9px 12px'}}>{t('fixedassets.bookValue', 'Valor en libros')}</td>
                              <td className="num" style={{padding:'9px 12px', fontSize:15,
                                color: d.fullyDepr ? 'var(--muted)' : 'var(--text)'}}>
                                {Q(d.valorLibros)}
                                {d.fullyDepr && <span className="pill warning" style={{marginLeft:8, fontSize:9}}>{t('fixedassets.fullyDepreciated', 'Totalmente depreciado')}</span>}
                              </td>
                            </tr>
                            {!d.fullyDepr && (
                              <tr>
                                <td>{t('fixedassets.remainingYears', 'Años restantes (estimado)')}</td>
                                <td className="num">{d.yearsLeft.toFixed(1)} {t('fixedassets.years', 'años')}</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
            <div className="drawer-foot">
              <button className="btn ghost" onClick={() => setSelAsset(null)}>{t('common.close', 'Cerrar')}</button>
              {selAsset.status === 'active' && (
                <button className="btn danger" onClick={() => { setBajaReason('Obsolescencia'); setShowBaja(selAsset); setSelAsset(null); }}>
                  <Icon name="trash" size={12}/>{t('fixedassets.retire', 'Dar de baja')}
                </button>
              )}
              <button className="btn accent"><Icon name="edit" size={12}/>{t('common.edit', 'Editar')}</button>
            </div>
          </div>
        </>
      )}

      {/* ── MODAL: Nuevo activo ── */}
      {showNew && (
        <div className="modal-overlay" onClick={() => setShowNew(false)}>
          <div className="modal" style={{width:560}} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{t('fixedassets.registerNewAsset', 'Registrar nuevo activo fijo')}</h3>
              <button className="icon-btn" onClick={() => setShowNew(false)}><Icon name="x"/></button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="field span-2">
                  <label className="field-label">{t('fixedassets.nameDescription', 'Nombre / descripción')}</label>
                  <input className="field-input" placeholder={t('fixedassets.namePlaceholder', 'Ej. Camión Isuzu 2026')}
                    value={newForm.name} onChange={e => setNew('name', e.target.value)}/>
                </div>
                <div className="field">
                  <label className="field-label">{t('fixedassets.satCategory', 'Categoría SAT')}</label>
                  <select className="field-input" value={newForm.cat} onChange={e => setNew('cat', e.target.value)}>
                    {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="field-label">{t('common.branch', 'Sucursal')}</label>
                  <select className="field-input" value={newForm.branch} onChange={e => setNew('branch', e.target.value)}>
                    {['Zona 10','Central','Zona 1','Zona 15','Mixco'].map(b =>
                      <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="field-label">{t('fixedassets.acquisitionCost', 'Costo de adquisición (Q)')}</label>
                  <input className="field-input mono" type="number" placeholder="0.00"
                    value={newForm.purchase} onChange={e => setNew('purchase', e.target.value)}/>
                </div>
                <div className="field">
                  <label className="field-label">{t('fixedassets.acquisitionDate', 'Fecha de adquisición')}</label>
                  <input className="field-input" type="date"
                    value={newForm.acquired} onChange={e => setNew('acquired', e.target.value)}/>
                </div>
                <div className="field span-2">
                  <label className="field-label">{t('fixedassets.serialPlateOptional', 'No. de serie / placa (opcional)')}</label>
                  <input className="field-input mono" placeholder={t('fixedassets.serialPlaceholder', 'Ej. ABC-1234')}
                    value={newForm.serial} onChange={e => setNew('serial', e.target.value)}/>
                </div>
                <div className="field span-2">
                  <label className="field-label">{t('common.notes', 'Notas')}</label>
                  <input className="field-input" placeholder={t('fixedassets.additionalDesc', 'Descripción adicional…')}
                    value={newForm.notes} onChange={e => setNew('notes', e.target.value)}/>
                </div>
              </div>

              {/* Preview tasa seleccionada */}
              {newForm.cat && newForm.purchase && (
                <div style={{marginTop:16, padding:'12px 14px', background:'var(--accent-soft)', borderRadius:'var(--r-md)'}}>
                  <div style={{fontFamily:'var(--font-mono)', fontSize:10, color:'var(--accent-ink)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6}}>
                    {t('fixedassets.deprPreview', 'Vista previa depreciación')}
                  </div>
                  {(() => {
                    const cat = CAT_MAP[newForm.cat];
                    const val = parseFloat(newForm.purchase) || 0;
                    return (
                      <div className="row" style={{gap:20, flexWrap:'wrap'}}>
                        <span style={{fontSize:12, color:'var(--accent-ink)'}}>
                          {t('fixedassets.rate', 'Tasa')}: <strong>{pct(cat.rate)}/{t('fixedassets.year', 'año')}</strong>
                        </span>
                        <span style={{fontSize:12, color:'var(--accent-ink)'}}>
                          {t('fixedassets.annualDepr', 'Dep. anual')}: <strong>{Q(val * cat.rate)}</strong>
                        </span>
                        <span style={{fontSize:12, color:'var(--accent-ink)'}}>
                          {t('fixedassets.monthlyDeprShort', 'Dep. mensual')}: <strong>{Q(val * cat.rate / 12)}</strong>
                        </span>
                        <span style={{fontSize:12, color:'var(--accent-ink)'}}>
                          {t('fixedassets.usefulLife', 'Vida útil')}: <strong>{cat.years} {t('fixedassets.years', 'años')}</strong>
                        </span>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
            <div className="modal-foot">
              <button className="btn ghost" onClick={() => setShowNew(false)}>{t('common.cancel', 'Cancelar')}</button>
              <button className="btn accent" onClick={handleSaveNew}>
                <Icon name="check" size={12}/>{t('fixedassets.registerAsset', 'Registrar activo')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Baja de activo ── */}
      {showBaja && (
        <div className="modal-overlay" onClick={() => setShowBaja(null)}>
          <div className="modal" style={{width:460}} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{t('fixedassets.retireAsset', 'Dar de baja activo')}</h3>
              <button className="icon-btn" onClick={() => setShowBaja(null)}><Icon name="x"/></button>
            </div>
            <div className="modal-body">
              <div className="alert" style={{marginBottom:16}}>
                <Icon name="alert" size={13}/>
                {t('fixedassets.retireNote', 'Esta acción registrará la baja en contabilidad y lo moverá al historial.')}
              </div>
              <div className="detail-grid">
                <div className="detail-row"><span className="detail-label">{t('fixedassets.asset', 'Activo')}</span>
                  <span style={{fontWeight:600}}>{showBaja.name}</span></div>
                <div className="detail-row"><span className="detail-label">{t('fixedassets.historicalCostShort', 'Costo histórico')}</span>
                  <span className="mono">{Q(showBaja.purchase)}</span></div>
                <div className="detail-row"><span className="detail-label">{t('fixedassets.accDeprShort', 'Dep. acumulada')}</span>
                  <span className="mono" style={{color:'var(--danger)'}}>{Q(showBaja.depr.deprAcum)}</span></div>
                <div className="detail-row"><span className="detail-label">{t('fixedassets.bookValue', 'Valor en libros')}</span>
                  <span className="mono" style={{fontWeight:700}}>{Q(showBaja.depr.valorLibros)}</span></div>
              </div>
              <div className="field" style={{marginTop:16}}>
                <label className="field-label">{t('fixedassets.retirementReason', 'Motivo de la baja')}</label>
                <select className="field-input" value={bajaReason} onChange={e => setBajaReason(e.target.value)}>
                  <option>{t('fixedassets.reasons.obsolescence', 'Obsolescencia')}</option>
                  <option>{t('fixedassets.reasons.irreparableFault', 'Falla irreparable')}</option>
                  <option>{t('fixedassets.reasons.sale', 'Venta del activo')}</option>
                  <option>{t('fixedassets.reasons.theft', 'Robo o pérdida')}</option>
                  <option>{t('fixedassets.reasons.donation', 'Donación')}</option>
                  <option>{t('fixedassets.reasons.other', 'Otro')}</option>
                </select>
              </div>

              {/* Partida contable de disposición (automática) */}
              <div style={{marginTop:16, padding:'10px 14px', background:'var(--surface-2)', borderRadius:'var(--r-md)', fontSize:11.5}}>
                <div style={{fontWeight:600, marginBottom:6}}>
                  <Icon name="receipt" size={12} style={{marginRight:6, verticalAlign:'-1px'}}/>
                  {t('fixedassets.autoEntry', 'Se generará la partida contable automáticamente')}
                </div>
                <div className="row" style={{justifyContent:'space-between', color:'var(--muted)'}}>
                  <span>Dr {t('fixedassets.accDeprShort', 'Dep. acumulada')}</span><span className="mono">{Q(showBaja.depr.deprAcum)}</span>
                </div>
                {showBaja.depr.valorLibros > 0 && (
                  <div className="row" style={{justifyContent:'space-between', color:'var(--muted)'}}>
                    <span>Dr {t('fixedassets.lossShort', 'Pérdida en baja')}</span><span className="mono">{Q(showBaja.depr.valorLibros)}</span>
                  </div>
                )}
                <div className="row" style={{justifyContent:'space-between', color:'var(--muted)'}}>
                  <span>Cr {t('fixedassets.assetCostShort', 'Activo fijo (costo)')}</span><span className="mono">{Q(showBaja.purchase)}</span>
                </div>
                <div style={{marginTop:8, display:'flex', alignItems:'center', justifyContent:'space-between', gap:8}}>
                  <span style={{fontSize:10.5, color:'var(--muted)'}}>
                    {t('fixedassets.usesConfigAccounts', 'Usa las cuentas definidas en Configuración contable.')}
                  </span>
                  <button className="btn sm ghost" onClick={() => { setShowBaja(null); setShowConfig(true); }}>
                    <Icon name="settings" size={11}/>{t('fixedassets.configure', 'Configurar')}
                  </button>
                </div>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn ghost" onClick={() => setShowBaja(null)}>{t('common.cancel', 'Cancelar')}</button>
              <button className="btn danger" disabled={bajaBusy} onClick={handleBaja}>
                <Icon name="trash" size={12}/>{t('fixedassets.confirmRetirement', 'Confirmar baja')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Configuración contable de la baja ── */}
      {showConfig && (
        <DisposalConfigModal accounts={accounts} pushToast={pushToast} onClose={() => setShowConfig(false)} />
      )}
    </div>
  );
}

// ── Configuración contable de la baja de activos ─────────────────────────────
// Guarda en company_settings las 3 cuentas que usará la partida automática.
function DisposalConfigModal({ accounts, pushToast, onClose }) {
  const { t } = useTranslation();
  const [sel, setSel] = useState({ asset: '', depr: '', loss: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async (key) => getSetting(key).then(r => r?.settingValue || '').catch(() => '');
    Promise.all([load(DISPOSAL_KEYS.asset), load(DISPOSAL_KEYS.depr), load(DISPOSAL_KEYS.loss)])
      .then(([asset, depr, loss]) => setSel({ asset, depr, loss }))
      .finally(() => setLoading(false));
  }, []);

  const valid = sel.asset && sel.depr && sel.loss;

  const save = async () => {
    setSaving(true);
    try {
      await Promise.all([
        putSetting(DISPOSAL_KEYS.asset, { settingValue: String(sel.asset), category: 'accounting' }),
        putSetting(DISPOSAL_KEYS.depr,  { settingValue: String(sel.depr),  category: 'accounting' }),
        putSetting(DISPOSAL_KEYS.loss,  { settingValue: String(sel.loss),  category: 'accounting' }),
      ]);
      pushToast && pushToast('Configuración contable guardada', 'success');
      onClose();
    } catch (err) {
      pushToast && pushToast('No se pudo guardar: ' + err.message, 'danger');
    } finally { setSaving(false); }
  };

  const AccountSelect = ({ label, value, onChange }) => (
    <div className="field" style={{ marginBottom: 12 }}>
      <label className="field-label">{label}</label>
      <select className="field-input" value={value} onChange={e => onChange(e.target.value)}>
        <option value="">{t('common.selectDots', 'Seleccionar…')}</option>
        {accounts.map(ac => <option key={ac.id} value={ac.id}>{ac.code} · {ac.name}</option>)}
      </select>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{t('fixedassets.accountConfig', 'Configuración contable — baja de activos')}</h3>
          <button className="icon-btn" onClick={onClose}><Icon name="x" /></button>
        </div>
        <div className="modal-body">
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
            {t('fixedassets.configIntro', 'Estas cuentas se usan para generar automáticamente la partida contable al dar de baja un activo.')}
          </div>
          {loading ? (
            <div className="empty" style={{ padding: 20 }}>{t('common.loading', 'Cargando…')}</div>
          ) : (
            <>
              <AccountSelect label={t('fixedassets.assetAccount', 'Activo fijo — costo (crédito)')} value={sel.asset} onChange={v => setSel(s => ({ ...s, asset: v }))} />
              <AccountSelect label={t('fixedassets.accDepr', 'Depreciación acumulada (débito)')} value={sel.depr} onChange={v => setSel(s => ({ ...s, depr: v }))} />
              <AccountSelect label={t('fixedassets.lossAccount', 'Pérdida en baja de activos (débito)')} value={sel.loss} onChange={v => setSel(s => ({ ...s, loss: v }))} />
            </>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>{t('common.cancel', 'Cancelar')}</button>
          <button className="btn accent" disabled={!valid || saving} onClick={save}>
            <Icon name="check" size={13} /> {t('common.save', 'Guardar')}
          </button>
        </div>
      </div>
    </div>
  );
}
