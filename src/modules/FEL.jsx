// Stackline — FEL · SAT Panel
// Data-driven: documentos FEL desde /api/fel/documents (hook useFelDocuments).
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import StatCard from '../components/StatCard.jsx';
import DataTable from '../components/DataTable.jsx';
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
  razon: 'Stackline Distribuidora, S.A.',
  comercial: 'Stackline · Tienda',
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
  const navigate = useNavigate();
  const { items: felRaw, loading, reload } = useFelDocuments();
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

  // ── Columnas (estándar <DataTable>) ──────────────────────────────────────
  const colCorrelativo = {
    key: 'numero', header: 'Correlativo', sortable: true, mono: true,
    render: (d) => (
      <>
        <div className="code">{d.serie}-{d.numero}</div>
        <div className="sku">{d.hora}</div>
      </>
    ),
  };
  const colReceptor = { key: 'receptor', header: 'Receptor', sortable: true,
    render: (d) => <span className="nm">{d.receptor}</span> };
  const colTotal = { key: 'total', header: t('common.total', 'Total'), align: 'right', sortable: true,
    render: (d) => <span className="nm">{Q(d.total)}</span> };

  const dteColumns = [
    colCorrelativo,
    { key: 'tipo', header: t('common.type', 'Tipo'), sortable: true,
      sortValue: (d) => TIPOS[d.tipo]?.label,
      render: (d) => <span className={`badge-m3 ${TIPOS[d.tipo].pill}`}>{TIPOS[d.tipo].label}</span> },
    { key: 'fecha', header: t('common.date', 'Fecha'), sortable: true, mono: true },
    colReceptor,
    { key: 'nit', header: 'NIT', sortable: true, mono: true },
    { key: 'afecto', header: 'Afecto', align: 'right', sortable: true, render: (d) => Q(d.afecto) },
    { key: 'iva', header: t('common.iva', 'IVA'), align: 'right', sortable: true, render: (d) => Q(d.iva) },
    colTotal,
    { key: 'estado', header: t('common.status', 'Estado'), sortable: true,
      sortValue: (d) => ESTADOS[d.estado]?.label,
      render: (d) => <span className={`badge-m3 ${ESTADOS[d.estado].pill}`}>{ESTADOS[d.estado].label}</span> },
  ];

  const anuladasColumns = [
    { ...colCorrelativo, render: (d) => <span className="code">{d.serie}-{d.numero}</span> },
    { key: 'fecha', header: 'Fecha anulación', sortable: true, mono: true },
    colReceptor,
    { key: 'total', header: t('common.total', 'Total'), align: 'right', sortable: true,
      render: (d) => <span style={{ color: 'var(--md-sys-color-error)' }}>{Q(d.total)}</span> },
    { key: 'motivoAnul', header: 'Motivo', className: 'muted', render: (d) => d.motivoAnul ?? '—' },
    { key: 'estado', header: t('common.status', 'Estado'),
      render: () => <span className="badge-m3 danger">Anulado</span> },
  ];

  const anulablesColumns = [
    { ...colCorrelativo, render: (d) => <span className="code">{d.serie}-{d.numero}</span> },
    { key: 'hora', header: 'Hora emisión', sortable: true, mono: true },
    colReceptor,
    colTotal,
  ];

  const libroColumns = [
    { key: 'no', header: 'No.', mono: true, width: 64,
      render: (_d, i) => String(i + 1).padStart(3, '0') },
    { key: 'fecha', header: t('common.date', 'Fecha'), sortable: true, mono: true },
    { key: 'numero', header: 'Serie-Número', sortable: true, mono: true,
      render: (d) => `${d.serie}-${d.numero}` },
    { key: 'uuid', header: 'UUID (corto)', mono: true,
      render: (d) => (d.uuid ? `${d.uuid.slice(0, 8)}…` : '—') },
    { key: 'nit', header: 'NIT receptor', sortable: true, mono: true },
    { key: 'receptor', header: 'Nombre receptor', sortable: true },
    { key: 'afecto', header: 'Afecto', align: 'right', sortable: true, render: (d) => Q(d.afecto) },
    { key: 'exento', header: 'Exento', align: 'right', sortable: true, className: 'muted',
      render: (d) => (d.exento > 0 ? Q(d.exento) : '—') },
    { key: 'iva', header: 'IVA 12%', align: 'right', sortable: true, render: (d) => Q(d.iva) },
    colTotal,
  ];

  const rechazadosColumns = [
    { ...colCorrelativo, render: (d) => <span className="code">{d.serie}-{d.numero}</span> },
    colReceptor,
    { key: 'total', header: t('common.total', 'Total'), align: 'right', sortable: true, render: (d) => Q(d.total) },
    { key: 'errorMsg', header: 'Error SAT',
      render: (d) => <span className="fel-err-cell">{d.errorMsg || '—'}</span> },
  ];

  const anuladas   = useMemo(() => dtes.filter(d => d.estado === 'anulado'), [dtes]);
  const rechazados = useMemo(() => dtes.filter(d => d.estado === 'rechazado'), [dtes]);
  // Anulables: FACT autorizadas dentro del plazo legal de 48 h (Art. 36 SAT-DSI-G-01-2021).
  const anulables = useMemo(() => {
    const limite = Date.now() - 48 * 60 * 60 * 1000;
    return dtes.filter(d => d.estado === 'autorizado' && d.tipo === 'FACT'
      && d.fecha && new Date(`${d.fecha}T${d.hora || '00:00'}`).getTime() >= limite);
  }, [dtes]);

  // Libro de ventas (solo autorizados y FACT/NDEB)
  const libroVentas = dtes
    .filter(d => d.estado === 'autorizado' && d.tipo !== 'NCRE')
    .sort((a, b) => a.numero.localeCompare(b.numero));

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="page-title">{t('fel.title', 'FEL · SAT')}</div>
          <div className="page-subtitle">
            Factura Electrónica en Línea · NIT {EMISOR.nit} · Certificador: {CERTIFIER.nombre}
          </div>
        </div>
        <div className="row gap-8">
          <span className={`badge-m3 ${CERTIFIER.online ? 'success' : 'danger'}`}>
            <span className="dot"/>
            {CERTIFIER.online ? `En línea · ${CERTIFIER.pingMs}ms` : 'Sin conexión'}
          </span>
          <Button icon="transfer" onClick={() => pushToast?.('Sincronizando con SAT…', '')}>Sincronizar
          </Button>
        </div>
      </div>

      <div className="tabs" style={{marginBottom:20}}>
        {[
          { id:'dtes',        label: t('fel.tabs.documents', 'DTEs emitidos') },
          { id:'anulaciones', label: t('fel.tabs.cancellations', 'Anulaciones') },
          { id:'libro',       label: t('fel.tabs.book', 'Libro de ventas') },
          { id:'certificador',label: t('fel.tabs.certifier', 'Certificador / Emisor') },
        ].map(tabItem => (
          <button key={tabItem.id} className={`tab ${tab===tabItem.id?'active':''}`} onClick={() => setTab(tabItem.id)}>
            {tabItem.label}
          </button>
        ))}
      </div>

      {/* ── DTEs emitidos ────────────────────────────────────────────────── */}
      {tab === 'dtes' && (
        <div>
          <div className="stat-grid">
            <StatCard
              tone="pri"
              label="DTEs emitidos (mayo)"
              value={mesActual.length}
              trend={{ dir: 'up', label: <>{autorizados.length} autorizados</> }}
            />
            <StatCard
              tone="ter"
              label="Total facturado"
              value={Qs(totalFact)}
              trend={{ dir: 'up', label: "Facturas autorizadas" }}
            />
            <StatCard
              tone="sec"
              label="IVA generado"
              value={Qs(totalIVA)}
              foot="12% sobre afecto"
            />
            <StatCard
              tone="err"
              label="Anulados"
              value={totalAnul}
              trend={{ dir: totalAnul > 0 ? 'down' : '', label: totalAnul > 0 ? 'Requieren revisión' : 'Sin anulaciones' }}
            />
          </div>

          <div className="filterbar">
            <Icon name="search" size={18} style={{color:'var(--md-sys-color-on-surface-variant)'}}/>
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

          <DataTable
            columns={dteColumns}
            rows={filtered}
            rowKey={(d) => d.id}
            loading={loading}
            pageSize={25}
            defaultSort={{ key: 'fecha', dir: 'desc' }}
            onRowClick={setDrawer}
            onRefresh={reload}
            empty={t('common.noResults', 'Sin resultados')}
            emptyIcon="receipt"
            totals={{
              afecto: Q(filtered.reduce((a, d) => a + d.afecto, 0)),
              iva: Q(filtered.reduce((a, d) => a + d.iva, 0)),
              total: Q(filtered.reduce((a, d) => a + d.total, 0)),
            }}
            actions={(d) => (
              <>
                <button className="icon-btn" disabled
                  title={t('fel.downloadPending', 'Descargar XML — pendiente de implementar')}><Icon name="download" size={18}/></button>
                <button className="icon-btn" disabled
                  title={t('fel.resendPending', 'Reenviar DTE — pendiente de implementar')}><Icon name="transfer" size={18}/></button>
                {d.estado === 'autorizado' && d.tipo === 'FACT' && (
                  <button className="icon-btn" title="Anular" style={{color:'var(--md-sys-color-error)'}}
                    onClick={() => { setShowAnul(d); setMotivoAnul(''); }}><Icon name="x" size={18}/></button>
                )}
              </>
            )}
          />
        </div>
      )}

      {/* ── ANULACIONES ──────────────────────────────────────────────────── */}
      {tab === 'anulaciones' && (
        <div>
          <div className="fel-note warn" style={{marginBottom:16}}>
            <strong>Plazo legal:</strong> Las facturas pueden anularse dentro de las <strong>48 horas</strong> siguientes a su emisión (Art. 36 Acuerdo SAT-DSI-G-01-2021). Las notas de crédito aplican hasta 30 días.
          </div>
          <DataTable
            columns={anuladasColumns}
            rows={anuladas}
            rowKey={(d) => d.id}
            loading={loading}
            pageSize={25}
            defaultSort={{ key: 'fecha', dir: 'desc' }}
            empty="Sin anulaciones registradas"
            emptyIcon="x"
          />

          <div style={{marginTop:16}}>
            <div className="fel-panel-title">DTEs anulables (dentro del plazo de 48 h)</div>
            <DataTable
              columns={anulablesColumns}
              rows={anulables}
              rowKey={(d) => d.id}
              loading={loading}
              defaultSort={{ key: 'hora', dir: 'desc' }}
              empty="Sin DTEs anulables dentro del plazo"
              emptyIcon="clock"
              actions={(d) => (
                <Button variant="danger" size="sm" onClick={() => { setShowAnul(d); setMotivoAnul(''); }}>
                  Anular
                </Button>
              )}
            />
          </div>
        </div>
      )}

      {/* ── LIBRO DE VENTAS ──────────────────────────────────────────────── */}
      {tab === 'libro' && (
        <div>
          <div className="fel-section-head">
            <div>
              <div className="fel-section-title">Libro de Ventas — Mayo 2026</div>
              <div className="fel-section-sub">Formato SAT · Art. 37 Ley del IVA</div>
            </div>
            <div className="row gap-8">
              <select className="input">
                <option>Mayo 2026</option>
                <option>Abril 2026</option>
                <option>Marzo 2026</option>
              </select>
              <Button icon="download" onClick={() => pushToast?.('Exportando libro de ventas…', '')}>{t('common.export', 'Exportar')} Excel
              </Button>
            </div>
          </div>

          <DataTable
            columns={libroColumns}
            rows={libroVentas}
            rowKey={(d) => d.id}
            loading={loading}
            pageSize={50}
            empty="Sin documentos en el período"
            emptyIcon="chart"
            totals={{
              no: 'TOTALES',
              afecto: Q(libroVentas.reduce((s2, d) => s2 + d.afecto, 0)),
              exento: '—',
              iva: Q(libroVentas.reduce((s2, d) => s2 + d.iva, 0)),
              total: Q(libroVentas.reduce((s2, d) => s2 + d.total, 0)),
            }}
          />
        </div>
      )}

      {/* ── CERTIFICADOR ─────────────────────────────────────────────────── */}
      {tab === 'certificador' && (
        <div className="fel-grid">
          <div className="fel-card">
            <div className="fel-panel-title">Estado de conexión</div>
            <div className={`fel-conn${CERTIFIER.online ? '' : ' is-off'}`}>
              <div className="fel-conn-dot">{CERTIFIER.online ? '●' : '○'}</div>
              <div>
                <div className="fel-conn-state">{CERTIFIER.online ? 'En línea' : 'Sin conexión'}</div>
                <div className="fel-conn-meta">{CERTIFIER.nombre} · {CERTIFIER.pingMs}ms</div>
              </div>
            </div>
            <div className="fel-mini-grid">
              {[
                { label:'Certificados hoy', val: CERTIFIER.certHoy, tone:'ok'  },
                { label:'Rechazados hoy',   val: CERTIFIER.rechHoy, tone:'err' },
                { label:'En cola',          val: CERTIFIER.cola,    tone:''    },
                { label:'Última sincronía', val: CERTIFIER.ultimaSync.split(' ')[1], tone:'' },
              ].map(m => (
                <div key={m.label} className="fel-mini">
                  <div className="k">{m.label}</div>
                  <div className={`v ${m.tone}`}>{m.val}</div>
                </div>
              ))}
            </div>
            <Button icon="transfer" full onClick={() => pushToast?.('Sincronizando…', '')}>Forzar sincronización
            </Button>
            <div className="fel-divider">
              <div className="fel-kv compact">
                {[
                  ['Proveedor',      CERTIFIER.nombre],
                  ['Endpoint',       CERTIFIER.endpoint],
                  ['Serie activa',   CERTIFIER.serie],
                  ['Resolución SAT', CERTIFIER.resolucion],
                ].map(([k, v]) => (
                  <div key={k} className="fel-kv-row">
                    <div className="fel-kv-k">{k}</div>
                    <div className="fel-kv-v mono">{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="fel-card">
            <div className="fel-panel-title">Log de certificaciones</div>
            {dtes.slice(0, 8).map(d => {
              const estado = ESTADOS[d.estado];
              return (
                <div key={d.id} className="fel-log-row">
                  <span className={`badge-m3 ${estado.pill}`}>{estado.label}</span>
                  <div className="fel-log-main">
                    <div className="fel-log-ref">{d.serie}-{d.numero} · {d.tipo}</div>
                    <div className="fel-log-ts">{d.fecha} {d.certTs}</div>
                  </div>
                  <div className="fel-log-amt">{Q(d.total)}</div>
                </div>
              );
            })}
          </div>

          {/* Datos del emisor — sólo lectura. Se editan en Configuración (/config). */}
          <div className="fel-card span-all">
            <div className="fel-panel-head">
              <div className="fel-panel-title">Datos del emisor (SAT)</div>
              <Button icon="settings" size="sm" onClick={() => navigate('/config')}>{t('fel.editInConfig', 'Editar en Configuración')}
              </Button>
            </div>
            <div className="fel-kv cols">
              {[
                ['NIT',              EMISOR.nit],
                ['Razón social',     EMISOR.razon],
                ['Nombre comercial', EMISOR.comercial],
                ['Régimen fiscal',   EMISOR.regimen],
                ['Categoría SAT',    EMISOR.categoria],
                ['Establecimiento',  EMISOR.establecimiento],
                ['Dirección fiscal', EMISOR.direccion],
              ].map(([k, v]) => (
                <div key={k} className="fel-kv-row">
                  <div className="fel-kv-k">{k}</div>
                  <div className="fel-kv-v">{v}</div>
                </div>
              ))}
            </div>
          </div>

          {rechazados.length > 0 && (
            <div className="fel-card span-all is-error">
              <div className="fel-panel-title is-error">
                DTEs rechazados — requieren reintento
              </div>
              <DataTable
                columns={rechazadosColumns}
                rows={rechazados}
                rowKey={(d) => d.id}
                actions={() => (
                  <Button variant="accent" size="sm" onClick={() => pushToast?.('Reintentando certificación…', '')}>
                    Reintentar
                  </Button>
                )}
              />
            </div>
          )}
        </div>
      )}

      {/* ── CONFIGURACIÓN ────────────────────────────────────────────────── */}
      {/* ── DRAWER: detalle DTE ───────────────────────────────────────────── */}
      {drawer && (
        <div className="drawer-overlay" onClick={() => setDrawer(null)}>
          <div className="drawer" onClick={e => e.stopPropagation()} style={{width:440}}>
            <div className="drawer-head">
              <div>
                <div className="fel-drawer-title">{drawer.serie}-{drawer.numero}</div>
                <div className="fel-drawer-sub">{TIPOS[drawer.tipo].label} · {drawer.fecha} {drawer.hora}</div>
              </div>
              <button className="icon-btn" onClick={() => setDrawer(null)}><Icon name="x"/></button>
            </div>
            <div className="drawer-body" style={{padding:20}}>
              <div className="fel-pills">
                <span className={`badge-m3 ${TIPOS[drawer.tipo].pill}`}>{TIPOS[drawer.tipo].label}</span>
                <span className={`badge-m3 ${ESTADOS[drawer.estado].pill}`}>{ESTADOS[drawer.estado].label}</span>
              </div>

              <div className="fel-kv between">
              {[
                ['Receptor',   drawer.receptor],
                ['NIT',        drawer.nit],
                ['Afecto IVA', Q(drawer.afecto)],
                ['IVA 12%',    Q(drawer.iva)],
                [t('common.total', 'Total'), Q(drawer.total)],
                ['Hora cert.', drawer.certTs],
                ['DTE ref.',   drawer.refDTE ?? '—'],
              ].map(([k, v]) => (
                <div key={k} className="fel-kv-row">
                  <span className="fel-kv-k">{k}</span>
                  <span className={`fel-kv-v${v?.startsWith('Q') ? ' mono' : ''}`}>{v}</span>
                </div>
              ))}
              </div>

              <div style={{marginTop:20}}>
                <div className="fel-field-label">UUID SAT</div>
                <div className="fel-uuid">{drawer.uuid}</div>
              </div>

              {drawer.errorMsg && (
                <div className="fel-note err" style={{marginTop:12}}>
                  <strong>Error SAT:</strong> {drawer.errorMsg}
                </div>
              )}
              {drawer.motivoAnul && (
                <div className="fel-note neutral" style={{marginTop:12}}>
                  <strong>Motivo anulación:</strong> {drawer.motivoAnul}
                </div>
              )}

              <div className="fel-actions">
                <Button icon="download" disabled title={t('fel.downloadPending', 'Pendiente de implementar')}>XML
                </Button>
                <Button icon="transfer" disabled title={t('fel.resendPending', 'Pendiente de implementar')}>Reenviar
                </Button>
                {drawer.estado === 'autorizado' && drawer.tipo === 'FACT' && (
                  <Button variant="danger-outline" onClick={() => { setDrawer(null); setShowAnul(drawer); setMotivoAnul(''); }}>
                    Anular
                  </Button>
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
              <div className="fel-note err" style={{marginBottom:16}}>
                Esta acción es <strong>irreversible</strong>. Se enviará el DTE de anulación al certificador SAT.
              </div>
              <div className="fel-kv between" style={{marginBottom:16}}>
                <div className="fel-kv-row">
                  <span className="fel-kv-k">DTE</span>
                  <span className="fel-kv-v mono">{showAnul.serie}-{showAnul.numero}</span>
                </div>
                <div className="fel-kv-row">
                  <span className="fel-kv-k">Receptor</span>
                  <span className="fel-kv-v">{showAnul.receptor}</span>
                </div>
                <div className="fel-kv-row">
                  <span className="fel-kv-k">{t('common.total', 'Total')}</span>
                  <span className="fel-kv-v mono">{Q(showAnul.total)}</span>
                </div>
              </div>
              <div className="field">
                <label>Motivo de anulación *</label>
                <input type="text" value={motivoAnul} onChange={e => setMotivoAnul(e.target.value)}
                  placeholder="Ej. Error en productos facturados"/>
              </div>
            </div>
            <div className="modal-foot">
              <Button onClick={() => setShowAnul(null)}>{t('common.cancel', 'Cancelar')}</Button>
              {/* Anular un DTE es una operación fiscal ante el SAT: requiere llamar
                  al certificador. Deshabilitado hasta implementarlo — antes solo
                  mostraba "anulado" sin anular nada. */}
              <Button icon="check" variant="error" disabled
                title={t('fel.annulPending', 'Anulación ante el SAT — pendiente de implementar')}>{t('common.confirm', 'Confirmar')} anulación
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
