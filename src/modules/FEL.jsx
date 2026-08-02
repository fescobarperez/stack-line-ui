// ERP MAYA — FEL · SAT Panel
// Data-driven: documentos FEL desde /api/fel/documents (hook useFelDocuments).
import React, { useState, useMemo } from 'react';
import Icon from '../components/Icon.jsx';
import { useFelDocuments } from '../hooks/useAccounting.js';
import { useTranslation } from 'react-i18next';

const pad2 = (n) => String(n).padStart(2, '0');
const EST_MAP = { certified: 'autorizado', certificada: 'autorizado', anulado: 'anulado', cancelled: 'anulado', rejected: 'rechazado', rechazado: 'rechazado', pending: 'pendiente' };

// Backend FelDocument.Response → forma de la UI.
function mapDte(d) {
  const iss = d.issuedAt ? new Date(d.issuedAt) : null;
  const cert = d.certifiedAt ? new Date(d.certifiedAt) : null;
  return {
    id: d.number ? `DTE-${d.number}` : `DTE-${d.id}`,
    tipo: d.dteType || 'FACT',
    serie: d.series || 'A',
    numero: d.number || String(d.id),
    fecha: iss ? `${iss.getFullYear()}-${pad2(iss.getMonth() + 1)}-${pad2(iss.getDate())}` : '',
    hora: iss ? `${pad2(iss.getHours())}:${pad2(iss.getMinutes())}` : '',
    receptor: d.receptorName || 'Consumidor Final',
    nit: d.receptorNit || 'CF',
    afecto: Number(d.taxableAmount || 0),
    exento: Number(d.exemptAmount || 0),
    iva: Number(d.tax || 0),
    total: Number(d.total || 0),
    estado: EST_MAP[d.status] || d.status || 'autorizado',
    uuid: d.uuid || '',
    certTs: cert ? `${pad2(cert.getHours())}:${pad2(cert.getMinutes())}:${pad2(cert.getSeconds())}` : '',
  };
}

const Q   = (n) => `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const Qs  = (n) => `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

// ── Tipos de DTE ───────────────────────────────────────────────────────────
const TIPOS = {
  FACT: { label: 'Factura',          pill: 'accent'  },
  NCRE: { label: 'Nota de Crédito',  pill: 'warning' },
  NDEB: { label: 'Nota de Débito',   pill: 'info'    },
};

const ESTADOS = {
  autorizado: { label: 'Autorizado', pill: 'success' },
  anulado:    { label: 'Anulado',    pill: 'danger'  },
  rechazado:  { label: 'Rechazado',  pill: 'danger'  },
  pendiente:  { label: 'Pendiente',  pill: 'warning' },
};

// (los DTE vienen del backend)

const CERTIFIER = {
  nombre: 'Infile, S.A.',
  endpoint: 'https://fel.infile.com.gt/api/v2',
  token: '••••••••••••••••••••••••••••••••',
  serie: 'A',
  resolucion: '2026-43-XX-0042',
  online: true,
  pingMs: 142,
  cola: 0,
  ultimaSync: '2026-05-23 14:32:18',
  certHoy: 12,
  rechHoy: 1,
};

const EMISOR = {
  nit: '8745619-2',
  razon: 'ERP Maya Distribuidora, S.A.',
  comercial: 'ERP Maya · Tienda',
  regimen: 'General sobre Utilidades',
  categoria: 'Definitivo IVA',
  direccion: '5a Av. 10-25, Zona 10, Guatemala, Guatemala',
  establecimiento: 'Comercio al por menor · Est. 001',
};

// ── Componente ─────────────────────────────────────────────────────────────
export default function FEL({ pushToast }) {
  const { t } = useTranslation();
  const [tab, setTab]         = useState('dtes');
  const [search, setSearch]   = useState('');
  const [tipoFiltro, setTipoFiltro]   = useState('todos');
  const [estadoFiltro, setEstadoFiltro] = useState('todos');
  const [drawer, setDrawer]   = useState(null);
  const [showAnul, setShowAnul] = useState(null);
  const [motivoAnul, setMotivoAnul] = useState('');

  // Documentos FEL reales del backend.
  const { items: felRaw } = useFelDocuments();
  const dtes = useMemo(() => felRaw.map(mapDte), [felRaw]);

  // KPIs
  const mesActual = dtes;
  const autorizados = mesActual.filter(d => d.estado === 'autorizado');
  const totalFact   = autorizados.filter(d => d.tipo === 'FACT').reduce((s, d) => s + d.total, 0);
  const totalIVA    = autorizados.reduce((s, d) => s + d.iva, 0);
  const totalAnul   = mesActual.filter(d => d.estado === 'anulado').length;

  // Filtered DTEs
  const filtered = useMemo(() => {
    let list = dtes;
    if (tipoFiltro !== 'todos')   list = list.filter(d => d.tipo === tipoFiltro);
    if (estadoFiltro !== 'todos') list = list.filter(d => d.estado === estadoFiltro);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(d => d.receptor.toLowerCase().includes(q) || d.nit.includes(q) || d.numero.includes(q));
    }
    return list;
  }, [dtes, tipoFiltro, estadoFiltro, search]);

  // Libro de ventas (solo autorizados y FACT/NDEB)
  const libroVentas = dtes
    .filter(d => d.estado === 'autorizado' && d.tipo !== 'NCRE')
    .sort((a, b) => a.numero.localeCompare(b.numero));

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-title">{t('fel.title', 'FEL · SAT')}</div>
          <div className="muted" style={{fontSize:12}}>
            Factura Electrónica en Línea · NIT {EMISOR.nit} · Certificador: {CERTIFIER.nombre}
          </div>
        </div>
        <div className="row gap-8">
          <span className={`pill ${CERTIFIER.online ? 'success' : 'danger'}`}>
            <span className="dot"/>
            {CERTIFIER.online ? `En línea · ${CERTIFIER.pingMs}ms` : 'Sin conexión'}
          </span>
          <button className="btn" onClick={() => pushToast?.('Sincronizando con SAT…', '')}>
            <Icon name="transfer" size={13}/>Sincronizar
          </button>
        </div>
      </div>

      <div className="tabs" style={{marginBottom:20}}>
        {[
          { id:'dtes',        label: t('fel.tabs.pending', 'DTEs emitidos') },
          { id:'anulaciones', label: t('fel.tabs.errors', 'Anulaciones') },
          { id:'libro',       label:'Libro de ventas' },
          { id:'certificador',label:'Certificador' },
          { id:'config',      label: t('nav.config', 'Configuración') },
        ].map(tabItem => (
          <button key={tabItem.id} className={`tab ${tab===tabItem.id?'active':''}`} onClick={() => setTab(tabItem.id)}>
            {tabItem.label}
          </button>
        ))}
      </div>

      {/* ── DTEs emitidos ────────────────────────────────────────────────── */}
      {tab === 'dtes' && (
        <div>
          <div className="stat-grid" style={{marginBottom:16}}>
            <div className="stat">
              <div className="label">DTEs emitidos (mayo)</div>
              <div className="val">{mesActual.length}</div>
              <div className="delta up">{autorizados.length} autorizados</div>
            </div>
            <div className="stat">
              <div className="label">Total facturado</div>
              <div className="val mono">{Qs(totalFact)}</div>
              <div className="delta up">Facturas autorizadas</div>
            </div>
            <div className="stat">
              <div className="label">IVA generado</div>
              <div className="val mono">{Qs(totalIVA)}</div>
              <div className="delta">12% sobre afecto</div>
            </div>
            <div className="stat">
              <div className="label">Anulados</div>
              <div className="val">{totalAnul}</div>
              <div className={`delta ${totalAnul > 0 ? 'dn' : ''}`}>
                {totalAnul > 0 ? 'Requieren revisión' : 'Sin anulaciones'}
              </div>
            </div>
          </div>

          <div className="filterbar">
            <Icon name="search" size={13} style={{color:'var(--muted)'}}/>
            <input className="input grow" placeholder={t('billing.searchPlaceholder', 'Buscar por receptor, NIT o correlativo…')}
              value={search} onChange={e => setSearch(e.target.value)}/>
            <select className="input" value={tipoFiltro} onChange={e => setTipoFiltro(e.target.value)}>
              <option value="todos">Todos los tipos</option>
              {Object.entries(TIPOS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select className="input" value={estadoFiltro} onChange={e => setEstadoFiltro(e.target.value)}>
              <option value="todos">Todos los estados</option>
              {Object.entries(ESTADOS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>

          <div className="card" style={{padding:0, overflow:'hidden'}}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Correlativo</th>
                  <th>{t('common.type', 'Tipo')}</th>
                  <th>{t('common.date', 'Fecha')}</th>
                  <th>Receptor</th>
                  <th>NIT</th>
                  <th className="num">Afecto</th>
                  <th className="num">{t('common.iva', 'IVA')}</th>
                  <th className="num">{t('common.total', 'Total')}</th>
                  <th>{t('common.status', 'Estado')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(d => {
                  const tipo   = TIPOS[d.tipo];
                  const estado = ESTADOS[d.estado];
                  return (
                    <tr key={d.id} className="clickable" onClick={() => setDrawer(d)}>
                      <td>
                        <div className="code">{d.serie}-{d.numero}</div>
                        <div style={{fontSize:9.5, color:'var(--muted)'}}>{d.hora}</div>
                      </td>
                      <td><span className={`pill ${tipo.pill}`} style={{fontSize:10}}>{tipo.label}</span></td>
                      <td style={{fontSize:12}}>{d.fecha}</td>
                      <td>
                        <div style={{fontWeight:500, fontSize:12}}>{d.receptor}</div>
                      </td>
                      <td className="code">{d.nit}</td>
                      <td className="num">{Q(d.afecto)}</td>
                      <td className="num">{Q(d.iva)}</td>
                      <td className="num" style={{fontWeight:600}}>{Q(d.total)}</td>
                      <td><span className={`pill ${estado.pill}`} style={{fontSize:10}}>{estado.label}</span></td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{display:'flex'}}>
                          <button className="icon-btn" title={t('common.download', 'Descargar XML')}
                            onClick={() => pushToast?.(`Descargando ${d.serie}-${d.numero}.xml`, '')}><Icon name="download"/></button>
                          <button className="icon-btn" title={t('common.sendEmail', 'Reenviar correo')}
                            onClick={() => pushToast?.(`DTE reenviado a ${d.receptor}`, 'success')}><Icon name="transfer"/></button>
                          {d.estado === 'autorizado' && d.tipo === 'FACT' && (
                            <button className="icon-btn" title="Anular" style={{color:'var(--danger)'}}
                              onClick={() => { setShowAnul(d); setMotivoAnul(''); }}><Icon name="x"/></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={10} style={{textAlign:'center', padding:28, color:'var(--muted)'}}>{t('common.noResults', 'Sin resultados')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── ANULACIONES ──────────────────────────────────────────────────── */}
      {tab === 'anulaciones' && (
        <div>
          <div style={{padding:'12px 16px', background:'var(--warning-soft)', border:'1px solid var(--warning)', borderRadius:'var(--r-lg)', marginBottom:16, fontSize:12, color:'var(--warning)'}}>
            <strong>Plazo legal:</strong> Las facturas pueden anularse dentro de las <strong>48 horas</strong> siguientes a su emisión (Art. 36 Acuerdo SAT-DSI-G-01-2021). Las notas de crédito aplican hasta 30 días.
          </div>
          <div className="card" style={{padding:0, overflow:'hidden'}}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Correlativo</th>
                  <th>Fecha anulación</th>
                  <th>Receptor</th>
                  <th className="num">{t('common.total', 'Total')}</th>
                  <th>Motivo</th>
                  <th>{t('common.status', 'Estado')}</th>
                </tr>
              </thead>
              <tbody>
                {dtes.filter(d => d.estado === 'anulado').map(d => (
                  <tr key={d.id}>
                    <td className="code">{d.serie}-{d.numero}</td>
                    <td style={{fontSize:12}}>{d.fecha}</td>
                    <td style={{fontWeight:500, fontSize:12}}>{d.receptor}</td>
                    <td className="num" style={{color:'var(--danger)'}}>{Q(d.total)}</td>
                    <td style={{fontSize:12, color:'var(--muted)'}}>{d.motivoAnul ?? '—'}</td>
                    <td><span className="pill danger" style={{fontSize:10}}>Anulado</span></td>
                  </tr>
                ))}
                {dtes.filter(d => d.estado === 'anulado').length === 0 && (
                  <tr><td colSpan={6} style={{textAlign:'center', padding:28, color:'var(--muted)'}}>Sin anulaciones registradas</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{marginTop:16}}>
            <div style={{fontWeight:600, fontSize:13, marginBottom:10}}>DTEs anulables (emitidos hoy)</div>
            <div className="card" style={{padding:0, overflow:'hidden'}}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Correlativo</th>
                    <th>Hora emisión</th>
                    <th>Receptor</th>
                    <th className="num">{t('common.total', 'Total')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {dtes.filter(d => d.estado === 'autorizado' && d.tipo === 'FACT' && d.fecha === '2026-05-23').map(d => (
                    <tr key={d.id}>
                      <td className="code">{d.serie}-{d.numero}</td>
                      <td style={{fontSize:12}}>{d.hora}</td>
                      <td style={{fontWeight:500, fontSize:12}}>{d.receptor}</td>
                      <td className="num" style={{fontWeight:600}}>{Q(d.total)}</td>
                      <td>
                        <button className="btn sm danger" onClick={() => { setShowAnul(d); setMotivoAnul(''); }}>
                          Anular
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── LIBRO DE VENTAS ──────────────────────────────────────────────── */}
      {tab === 'libro' && (
        <div>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14}}>
            <div>
              <div style={{fontWeight:600, fontSize:13}}>Libro de Ventas — Mayo 2026</div>
              <div className="muted" style={{fontSize:11}}>Formato SAT · Art. 37 Ley del IVA</div>
            </div>
            <div className="row gap-8">
              <select className="filterbar" style={{margin:0, padding:'6px 10px', fontSize:12}}>
                <option>Mayo 2026</option>
                <option>Abril 2026</option>
                <option>Marzo 2026</option>
              </select>
              <button className="btn" onClick={() => pushToast?.('Exportando libro de ventas…', '')}>
                <Icon name="download" size={13}/>{t('common.export', 'Exportar')} Excel
              </button>
            </div>
          </div>

          <div className="card" style={{padding:0, overflowX:'auto'}}>
            <table className="tbl" style={{minWidth:860}}>
              <thead>
                <tr>
                  <th>No.</th>
                  <th>{t('common.date', 'Fecha')}</th>
                  <th>Serie-Número</th>
                  <th>UUID (corto)</th>
                  <th>NIT receptor</th>
                  <th>Nombre receptor</th>
                  <th className="num">Afecto</th>
                  <th className="num">Exento</th>
                  <th className="num">IVA 12%</th>
                  <th className="num">{t('common.total', 'Total')}</th>
                </tr>
              </thead>
              <tbody>
                {libroVentas.map((d, i) => (
                  <tr key={d.id}>
                    <td className="code">{String(i + 1).padStart(3, '0')}</td>
                    <td style={{fontSize:12}}>{d.fecha}</td>
                    <td className="code">{d.serie}-{d.numero}</td>
                    <td className="code" style={{fontSize:10}}>{d.uuid.slice(0, 8)}…</td>
                    <td className="code">{d.nit}</td>
                    <td style={{fontSize:12}}>{d.receptor}</td>
                    <td className="num">{Q(d.afecto)}</td>
                    <td className="num" style={{color:'var(--muted)'}}>{d.exento > 0 ? Q(d.exento) : '—'}</td>
                    <td className="num">{Q(d.iva)}</td>
                    <td className="num" style={{fontWeight:600}}>{Q(d.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{fontWeight:700, borderTop:'2px solid var(--border)'}}>
                  <td colSpan={6}>TOTALES</td>
                  <td className="num">{Q(libroVentas.reduce((s,d) => s+d.afecto, 0))}</td>
                  <td className="num">—</td>
                  <td className="num">{Q(libroVentas.reduce((s,d) => s+d.iva, 0))}</td>
                  <td className="num">{Q(libroVentas.reduce((s,d) => s+d.total, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── CERTIFICADOR ─────────────────────────────────────────────────── */}
      {tab === 'certificador' && (
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
          <div className="card" style={{padding:20}}>
            <div style={{fontWeight:600, fontSize:13, marginBottom:16}}>Estado de conexión</div>
            <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:20}}>
              <div style={{width:48, height:48, borderRadius:'50%',
                background: CERTIFIER.online ? 'var(--success-soft)' : 'var(--danger-soft)',
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:22}}>
                {CERTIFIER.online ? '●' : '○'}
              </div>
              <div>
                <div style={{fontWeight:700, fontSize:15, color: CERTIFIER.online ? 'var(--success)' : 'var(--danger)'}}>
                  {CERTIFIER.online ? 'En línea' : 'Sin conexión'}
                </div>
                <div className="muted" style={{fontSize:12}}>{CERTIFIER.nombre} · {CERTIFIER.pingMs}ms</div>
              </div>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
              {[
                { label:'Certificados hoy',   val: CERTIFIER.certHoy,   color:'var(--success)' },
                { label:'Rechazados hoy',     val: CERTIFIER.rechHoy,   color:'var(--danger)'  },
                { label:'En cola',            val: CERTIFIER.cola,      color:'var(--muted)'   },
                { label:'Última sincronía',   val: CERTIFIER.ultimaSync.split(' ')[1], color:'var(--muted)' },
              ].map(s => (
                <div key={s.label} className="card" style={{padding:12}}>
                  <div style={{fontSize:10, color:'var(--muted)', marginBottom:4}}>{s.label}</div>
                  <div style={{fontFamily:'var(--font-mono)', fontWeight:700, fontSize:16, color:s.color}}>{s.val}</div>
                </div>
              ))}
            </div>
            <button className="btn" style={{width:'100%', marginTop:14}} onClick={() => pushToast?.('Sincronizando…', '')}>
              <Icon name="transfer" size={13}/>Forzar sincronización
            </button>
          </div>

          <div className="card" style={{padding:20}}>
            <div style={{fontWeight:600, fontSize:13, marginBottom:16}}>Log de certificaciones</div>
            {dtes.slice(0, 8).map(d => {
              const estado = ESTADOS[d.estado];
              return (
                <div key={d.id} style={{display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom:'1px solid var(--border)', fontSize:12}}>
                  <span className={`pill ${estado.pill}`} style={{fontSize:9, minWidth:68, justifyContent:'center'}}>{estado.label}</span>
                  <div style={{flex:1}}>
                    <div className="code" style={{fontSize:11}}>{d.serie}-{d.numero} · {d.tipo}</div>
                    <div style={{fontSize:10.5, color:'var(--muted)'}}>{d.fecha} {d.certTs}</div>
                  </div>
                  <div style={{fontFamily:'var(--font-mono)', fontSize:11, color:'var(--muted)'}}>
                    {Q(d.total)}
                  </div>
                </div>
              );
            })}
          </div>

          {dtes.filter(d => d.estado === 'rechazado').length > 0 && (
            <div className="card" style={{padding:20, gridColumn:'1/-1', borderColor:'var(--danger)'}}>
              <div style={{fontWeight:600, fontSize:13, marginBottom:12, color:'var(--danger)'}}>
                DTEs rechazados — requieren reintento
              </div>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Correlativo</th>
                    <th>Receptor</th>
                    <th className="num">{t('common.total', 'Total')}</th>
                    <th>Error SAT</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {dtes.filter(d => d.estado === 'rechazado').map(d => (
                    <tr key={d.id}>
                      <td className="code">{d.serie}-{d.numero}</td>
                      <td style={{fontWeight:500, fontSize:12}}>{d.receptor}</td>
                      <td className="num">{Q(d.total)}</td>
                      <td style={{fontSize:11, color:'var(--danger)'}}>{d.errorMsg}</td>
                      <td>
                        <button className="btn sm accent" onClick={() => pushToast?.('Reintentando certificación…', '')}>
                          Reintentar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── CONFIGURACIÓN ────────────────────────────────────────────────── */}
      {tab === 'config' && (
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
          <div className="card" style={{padding:20}}>
            <div style={{fontWeight:600, fontSize:13, marginBottom:16}}>Datos del emisor (SAT)</div>
            {[
              ['NIT',              EMISOR.nit],
              ['Razón social',     EMISOR.razon],
              ['Nombre comercial', EMISOR.comercial],
              ['Régimen fiscal',   EMISOR.regimen],
              ['Categoría SAT',    EMISOR.categoria],
              ['Establecimiento',  EMISOR.establecimiento],
              ['Dirección fiscal', EMISOR.direccion],
            ].map(([k, v]) => (
              <div key={k} style={{display:'flex', gap:12, padding:'7px 0', borderBottom:'1px solid var(--border)', fontSize:12}}>
                <div style={{minWidth:130, color:'var(--muted)'}}>{k}</div>
                <div style={{fontWeight:500, flex:1}}>{v}</div>
              </div>
            ))}
            <button className="btn" style={{marginTop:14}} onClick={() => pushToast?.('Abriendo edición de emisor…', '')}>
              <Icon name="edit" size={13}/>{t('common.edit', 'Editar')} datos
            </button>
          </div>

          <div className="card" style={{padding:20}}>
            <div style={{fontWeight:600, fontSize:13, marginBottom:16}}>Certificador / Proveedor FEL</div>
            <div className="field" style={{marginBottom:12}}>
              <label>Proveedor certificador</label>
              <select defaultValue="infile">
                <option value="infile">Infile, S.A.</option>
                <option value="g4s">Megapyme (ex G4S)</option>
                <option value="digifact">Digifact</option>
              </select>
            </div>
            <div className="field" style={{marginBottom:12}}>
              <label>Endpoint API</label>
              <input type="text" defaultValue={CERTIFIER.endpoint} style={{fontFamily:'var(--font-mono)', fontSize:11}}/>
            </div>
            <div className="field" style={{marginBottom:12}}>
              <label>Token de autenticación</label>
              <input type="password" defaultValue="supersecreto123" style={{fontFamily:'var(--font-mono)'}}/>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
              <div className="field" style={{marginBottom:12}}>
                <label>Serie activa</label>
                <input type="text" defaultValue={CERTIFIER.serie} style={{fontFamily:'var(--font-mono)'}}/>
              </div>
              <div className="field" style={{marginBottom:12}}>
                <label>Resolución SAT</label>
                <input type="text" defaultValue={CERTIFIER.resolucion} style={{fontFamily:'var(--font-mono)', fontSize:11}}/>
              </div>
            </div>
            <div style={{display:'flex', gap:8, marginTop:4}}>
              <button className="btn" onClick={() => pushToast?.(`Ping: ${CERTIFIER.pingMs}ms ✓`, 'success')}>
                <Icon name="transfer" size={13}/>Probar conexión
              </button>
              <button className="btn accent" onClick={() => pushToast?.('Configuración guardada', 'success')}>
                <Icon name="check" size={13}/>{t('common.save', 'Guardar')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DRAWER: detalle DTE ───────────────────────────────────────────── */}
      {drawer && (
        <div className="drawer-overlay" onClick={() => setDrawer(null)}>
          <div className="drawer" onClick={e => e.stopPropagation()} style={{width:440}}>
            <div className="drawer-head">
              <div>
                <div style={{fontWeight:700, fontSize:15}}>{drawer.serie}-{drawer.numero}</div>
                <div className="muted" style={{fontSize:11}}>{TIPOS[drawer.tipo].label} · {drawer.fecha} {drawer.hora}</div>
              </div>
              <button className="icon-btn" onClick={() => setDrawer(null)}><Icon name="x"/></button>
            </div>
            <div className="drawer-body" style={{padding:20}}>
              <div style={{display:'flex', gap:8, marginBottom:20}}>
                <span className={`pill ${TIPOS[drawer.tipo].pill}`}>{TIPOS[drawer.tipo].label}</span>
                <span className={`pill ${ESTADOS[drawer.estado].pill}`}>{ESTADOS[drawer.estado].label}</span>
              </div>

              {[
                ['Receptor',   drawer.receptor],
                ['NIT',        drawer.nit],
                ['Afecto IVA', Q(drawer.afecto)],
                ['IVA 12%',    Q(drawer.iva)],
                [t('common.total', 'Total'), Q(drawer.total)],
                ['Hora cert.', drawer.certTs],
                ['DTE ref.',   drawer.refDTE ?? '—'],
              ].map(([k, v]) => (
                <div key={k} style={{display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border)', fontSize:12}}>
                  <span style={{color:'var(--muted)'}}>{k}</span>
                  <span style={{fontWeight:500, fontFamily: v?.startsWith('Q') ? 'var(--font-mono)' : 'inherit'}}>{v}</span>
                </div>
              ))}

              <div style={{marginTop:16}}>
                <div style={{fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6, fontFamily:'var(--font-mono)'}}>UUID SAT</div>
                <div className="code" style={{fontSize:10.5, padding:'8px 10px', background:'var(--surface-2)', borderRadius:'var(--r-md)', wordBreak:'break-all'}}>
                  {drawer.uuid}
                </div>
              </div>

              {drawer.errorMsg && (
                <div style={{marginTop:12, padding:'10px 12px', background:'var(--danger-soft)', borderRadius:'var(--r-md)', fontSize:12, color:'var(--danger)'}}>
                  <strong>Error SAT:</strong> {drawer.errorMsg}
                </div>
              )}
              {drawer.motivoAnul && (
                <div style={{marginTop:12, padding:'10px 12px', background:'var(--surface-2)', borderRadius:'var(--r-md)', fontSize:12, color:'var(--muted)'}}>
                  <strong>Motivo anulación:</strong> {drawer.motivoAnul}
                </div>
              )}

              <div style={{display:'flex', gap:8, marginTop:20}}>
                <button className="btn" style={{flex:1}} onClick={() => pushToast?.(`Descargando XML…`, '')}>
                  <Icon name="download" size={13}/>XML
                </button>
                <button className="btn" style={{flex:1}} onClick={() => pushToast?.(`DTE reenviado`, 'success')}>
                  <Icon name="transfer" size={13}/>Reenviar
                </button>
                {drawer.estado === 'autorizado' && drawer.tipo === 'FACT' && (
                  <button className="btn" style={{flex:1, color:'var(--danger)', borderColor:'var(--danger)'}}
                    onClick={() => { setDrawer(null); setShowAnul(drawer); setMotivoAnul(''); }}>
                    Anular
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: anulación ─────────────────────────────────────────────── */}
      {showAnul && (
        <div className="modal-overlay" onClick={() => setShowAnul(null)}>
          <div className="modal" style={{width:440}} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Anular DTE</h3>
              <button className="icon-btn" onClick={() => setShowAnul(null)}><Icon name="x"/></button>
            </div>
            <div className="modal-body">
              <div style={{padding:'10px 14px', background:'var(--danger-soft)', borderRadius:'var(--r-md)', fontSize:12, color:'var(--danger)', marginBottom:14}}>
                Esta acción es <strong>irreversible</strong>. Se enviará el DTE de anulación al certificador SAT.
              </div>
              <div style={{fontSize:12, marginBottom:14}}>
                <div style={{display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid var(--border)'}}>
                  <span className="muted">DTE</span><span className="code">{showAnul.serie}-{showAnul.numero}</span>
                </div>
                <div style={{display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid var(--border)'}}>
                  <span className="muted">Receptor</span><span style={{fontWeight:500}}>{showAnul.receptor}</span>
                </div>
                <div style={{display:'flex', justifyContent:'space-between', padding:'6px 0'}}>
                  <span className="muted">{t('common.total', 'Total')}</span><span style={{fontWeight:700, fontFamily:'var(--font-mono)'}}>{Q(showAnul.total)}</span>
                </div>
              </div>
              <div className="field">
                <label>Motivo de anulación *</label>
                <input type="text" value={motivoAnul} onChange={e => setMotivoAnul(e.target.value)}
                  placeholder="Ej. Error en productos facturados"/>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setShowAnul(null)}>{t('common.cancel', 'Cancelar')}</button>
              <button
                className="btn danger"
                disabled={!motivoAnul.trim()}
                onClick={() => { pushToast?.(`DTE ${showAnul.serie}-${showAnul.numero} anulado`, 'success'); setShowAnul(null); }}
              >
                <Icon name="check" size={13}/>{t('common.confirm', 'Confirmar')} anulación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
