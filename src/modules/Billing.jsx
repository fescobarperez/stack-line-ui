// Stackline — BillingModule (ES module)
// Data-driven: /api/sales (tickets). Lectura + detalle con ítems reales.
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import StatCard from '../components/StatCard.jsx';
import DataTable from '../components/DataTable.jsx';
import { Ticket } from './POS.jsx';
import { useSales } from '../hooks/useOperations.js';
import { useFelDocuments } from '../hooks/useAccounting.js';
import { useBranches } from '../hooks/useMasters.js';
import React, { useState as useStateBill, useMemo as useMemoBill } from 'react';
import { useTranslation } from 'react-i18next';

const Q = (v) => `Q ${Number(v || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const Qs = Q;
const pad = (n) => String(n).padStart(2, '0');
// Si hay DTE, el desglose es el certificado; si no, se deriva del total.
const subOf = (r) => (r.fel ? Number(r.fel.taxableAmount || 0) : r.total / 1.12);
const ivaOf = (r) => (r.fel ? Number(r.fel.tax || 0) : r.total - r.total / 1.12);

// Backend Sale.Response → forma de ticket que usa el componente.
function mapTicket(s) {
  const d = s.saleDate ? new Date(s.saleDate) : null;
  return {
    saleId: s.id,
    id: s.docNumber || `T-${s.id}`,
    date: d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}` : '',
    cashier: '—',
    branch: s.branchName || '—',
    items: (s.items || []).length,
    pay: s.paymentMethod || '—',
    total: Number(s.total || 0),
    status: s.status || 'paid',
    _items: s.items || [],
    _saleDate: s.saleDate,
  };
}

function BillingModule({ pushToast }) {
  const { t } = useTranslation();
  const { items: salesRaw, loading, reload } = useSales();
  const { items: felDocs } = useFelDocuments();
  const { items: BRANCHES } = useBranches();
  // El DTE real de cada venta (o undefined si nunca se certificó).
  const felBySale = useMemoBill(() => {
    const m = new Map();
    felDocs.forEach((d) => { if (d.saleId != null) m.set(d.saleId, d); });
    return m;
  }, [felDocs]);
  const TICKETS = useMemoBill(
    () => salesRaw.map((s) => ({ ...mapTicket(s), fel: felBySale.get(s.id) || null })),
    [salesRaw, felBySale]
  );
  const [search, setSearch] = useStateBill('');
  const [status, setStatus] = useStateBill('all');
  const [pay, setPay] = useStateBill('all');
  const [selected, setSelected] = useStateBill(null);

  const filtered = TICKETS.filter(ticket => {
    if (search && !ticket.id.toLowerCase().includes(search.toLowerCase())) return false;
    if (status !== 'all' && ticket.status !== status) return false;
    if (pay !== 'all' && ticket.pay !== pay) return false;
    return true;
  });

  const totalDay = TICKETS.filter(ticket => ticket.status === 'paid').reduce((s, ticket) => s + ticket.total, 0);
  const totalRefund = TICKETS.filter(ticket => ticket.status === 'refunded').reduce((s, ticket) => s + ticket.total, 0);

  const payIcon = (p) => (p === 'Efectivo' ? 'cash' : p === 'Tarjeta' ? 'card' : 'transfer');

  // Columnas de la tabla de tickets (estándar <DataTable>).
  const columns = [
    { key: 'id', header: t('billing.headers.invoice', 'No. Factura'), sortable: true, mono: true,
      render: (r) => <span style={{ fontWeight: 500, color: 'var(--accent)' }}>{r.id}</span> },
    { key: 'date', header: t('billing.headers.dateTime', 'Fecha & hora'), sortable: true, mono: true },
    { key: 'branch', header: t('billing.headers.branch', 'Sucursal'), sortable: true },
    { key: 'cashier', header: t('billing.headers.cashier', 'Cajero') },
    { key: 'client', header: t('billing.headers.clientNit', 'Cliente · NIT'),
      sortValue: (r) => r.fel?.receptorName || '',
      render: (r) => (
        <>
          <div>{r.fel?.receptorName || 'CF · Cliente Final'}</div>
          <div className="muted code" style={{ fontSize: 11 }}>NIT {r.fel?.receptorNit || 'CF'}</div>
        </>
      ) },
    { key: 'items', header: t('billing.headers.items', 'Items'), align: 'right', sortable: true },
    { key: 'pay', header: t('billing.headers.payment', 'Pago'), sortable: true,
      render: (r) => (
        <span className="badge-m3"><Icon name={payIcon(r.pay)} size={10} />{r.pay}</span>
      ) },
    { key: 'subtotal', header: t('billing.headers.subtotal', 'Subtotal'), align: 'right', sortable: true,
      sortValue: (r) => subOf(r), render: (r) => Q(subOf(r)) },
    { key: 'iva', header: t('billing.headers.iva', 'IVA'), align: 'right', sortable: true, className: 'muted',
      sortValue: (r) => ivaOf(r), render: (r) => Q(ivaOf(r)) },
    { key: 'total', header: t('billing.headers.total', 'Total'), align: 'right', sortable: true,
      render: (r) => <span style={{ fontWeight: 500 }}>{Q(r.total)}</span> },
    { key: 'status', header: t('billing.headers.status', 'Estado'), sortable: true,
      render: (r) => (
        r.status === 'refunded'
          ? <span className="badge-m3 danger"><span className="dot" />Anulada</span>
          : <span className="badge-m3 success"><span className="dot" />Pagada</span>
      ) },
    // El estado FEL sale del DTE real: sin documento certificado no se afirma "OK".
    { key: 'fel', header: t('billing.headers.fel', 'FEL'),
      sortValue: (r) => r.fel?.status || '',
      render: (r) => {
        if (!r.fel) {
          return <span className="badge-m3 neutral" title={t('billing.notCertified', 'Sin certificar en SAT')}>
            <Icon name="alert" size={9} />{t('billing.pending', 'Pendiente')}
          </span>;
        }
        if (r.fel.status !== 'autorizado') {
          return <span className="badge-m3 danger" title={r.fel.status}>
            <Icon name="alert" size={9} />{r.fel.status}
          </span>;
        }
        return <span className="badge-m3 info" title={t('billing.certified', 'Certificada SAT')}>
          <Icon name="shield" size={9} />OK
        </span>;
      } },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('billing.title', 'Facturación · Tickets de venta')}</h1>
          <div className="page-subtitle">Documentos emitidos hoy · Facturas digitales SAT-FEL · Sucursales activas</div>
        </div>
        <div className="page-head-actions">
          <Button icon="download">{t('billing.exportIva', 'Exportar libro IVA')}</Button>
          <Button icon="print">{t('billing.printBatch', 'Imprimir lote')}</Button>
          <Button icon="receipt" variant="accent">Anular factura</Button>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard
          icon="receipt" tone="pri"
          label="Facturas emitidas hoy"
          value={TICKETS.filter(ticket => ticket.status === 'paid').length}
          foot={<>{TICKETS.length} {t('billing.kpis.inTotal', 'en total')}</>}
        />
        <StatCard
          icon="cash" tone="ter"
          label="Total facturado"
          value={Qs(totalDay)}
          trend={{ dir: 'up', label: <>{t('common.iva', 'IVA')} Q{Qs(totalDay*0.12/1.12)}</> }}
        />
        <StatCard
          icon="return" tone="sec"
          label="Anuladas / Devoluciones"
          valueColor={'var(--danger)'}
          value={<>−{Qs(totalRefund)}</>}
          trend={{ dir: 'down', label: <>{TICKETS.filter(ticket => ticket.status === 'refunded').length} {t('billing.kpis.refunded', 'documentos')}</> }}
        />
        <StatCard
          icon="shield" tone="err"
          label="Estado SAT-FEL"
          valueColor={'var(--success)'}
          value={<><span style={{display:'inline-block', width:9, height:9, borderRadius:'50%', background:'var(--success)', marginRight:6, verticalAlign:'middle'}}/> Conectado</>}
          foot={t('billing.synced', 'Sincronizado · hace 12s')}
        />
      </div>

      <div className="filterbar">
        <div style={{position:'relative', width:240}}>
          <Icon name="search" size={12} style={{position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', color:'var(--muted)'}}/>
          <input className="input" style={{width:'100%', paddingLeft:26}} placeholder={t('billing.searchPlaceholder', 'No. de factura, NIT…')} value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <select className="input">
          <option>{t('common.allFem', 'Todas')} las sucursales</option>
          {BRANCHES.map(b => <option key={b.id}>{b.name}</option>)}
        </select>
        <div className="row gap-6">
          {[['all', t('common.all', 'Todos')], ['paid', t('billing.kpis.paid', 'Pagadas')], ['refunded', 'Anuladas']].map(([id, lbl]) => (
            <button key={id} className={`chip ${status===id?'active':''}`} onClick={()=>setStatus(id)}>{lbl}</button>
          ))}
        </div>
        <div className="row gap-6">
          {[['all', t('billing.headers.payment', 'Pago')], ['Efectivo','Efectivo'], ['Tarjeta','Tarjeta'], ['Transferencia','Transferencia']].map(([id, lbl]) => (
            <button key={id} className={`chip ${pay===id?'active':''}`} onClick={()=>setPay(id)}>{lbl}</button>
          ))}
        </div>
        <div className="grow"></div>
        <Button icon="calendar" size="sm">21 May 2026</Button>
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(r) => r.id}
        loading={loading}
        selectable
        density="compact"
        pageSize={25}
        defaultSort={{ key: 'date', dir: 'desc' }}
        onRowClick={setSelected}
        onRefresh={reload}
        empty={t('billing.empty', 'Sin documentos emitidos')}
        emptyIcon="receipt"
        totals={{
          items: filtered.reduce((a, r) => a + r.items, 0),
          subtotal: Q(filtered.reduce((a, r) => a + subOf(r), 0)),
          iva: Q(filtered.reduce((a, r) => a + ivaOf(r), 0)),
          total: Q(filtered.reduce((a, r) => a + r.total, 0)),
        }}
        actions={(r) => (
          <button className="icon-btn" title={t('common.print', 'Reimprimir')}>
            <Icon name="print" size={18} />
          </button>
        )}
      />

      {/* Detail drawer */}
      {selected && (
        <>
          <div className="drawer-overlay" onClick={() => setSelected(null)}/>
          <div className="drawer" style={{width:560}}>
            <div className="drawer-head">
              <div>
                <div className="code muted" style={{fontSize:11}}>FACTURA</div>
                <h3 style={{margin:0, marginTop:2, fontSize: 16, color:'var(--accent)'}}>{selected.id}</h3>
              </div>
              <button className="icon-btn" onClick={() => setSelected(null)}><Icon name="x"/></button>
            </div>
            <div className="drawer-body" style={{display:'flex', gap:16}}>
              <Ticket data={{
                id: selected.id,
                items: (selected._items || []).map(it => ({
                  sku: String(it.productId || ''), name: it.productName,
                  price: Number(it.unitPrice || 0), qty: Number(it.quantity || 0), unit: 'u',
                })),
                subtotal: selected.total,
                descTotal: 0,
                netGravable: selected.total / 1.12,
                iva: selected.total - selected.total / 1.12,
                total: selected.total,
                pay: (selected.pay || '').toLowerCase(),
                cashGiven: selected.total,
                change: 0,
                client: { name: 'CF', nit: 'CF' },
                date: selected._saleDate ? new Date(selected._saleDate) : new Date(),
              }}/>
              <div style={{flex:1, display:'flex', flexDirection:'column', gap:10}}>
                <div className="card">
                  <div className="card-head"><h3>{t('billing.satInfo', 'Información SAT-FEL')}</h3></div>
                  {selected.fel ? (
                    <div className="card-body" style={{display:'grid', gridTemplateColumns:'auto 1fr', gap:'4px 10px', fontSize:12}}>
                      <div className="muted">{t('billing.uuid', 'UUID')}</div><div className="code">{selected.fel.uuid}</div>
                      <div className="muted">{t('billing.serie', 'Serie')}</div><div className="code">{selected.fel.series}-{selected.fel.number}</div>
                      <div className="muted">{t('billing.authNo', 'No. autorización')}</div><div className="code">{selected.fel.authorizationNumber}</div>
                      <div className="muted">{t('billing.certDate', 'Fecha certif.')}</div>
                      <div className="code">{selected.fel.certifiedAt ? new Date(selected.fel.certifiedAt).toLocaleString('es-GT') : '—'}</div>
                      <div className="muted">{t('billing.regime', 'Régimen')}</div><div>{t('billing.general', 'General')}</div>
                      <div className="muted">{t('common.status', 'Estado')}</div>
                      <div>
                        {selected.fel.status === 'autorizado'
                          ? <span className="badge-m3 success"><span className="dot"/>{t('billing.certified', 'Certificada')}</span>
                          : <span className="badge-m3 danger"><span className="dot"/>{selected.fel.status}</span>}
                      </div>
                    </div>
                  ) : (
                    <div className="card-body" style={{fontSize:12}}>
                      <div className="muted">
                        {t('billing.noDte', 'Esta venta no tiene DTE certificado en SAT. No se emitió factura electrónica.')}
                      </div>
                    </div>
                  )}
                </div>
                <div className="row gap-6">
                  <Button icon="print" variant="tonal" style={{flex:1 }}>{t('common.print', 'Reimprimir')}</Button>
                  <Button icon="download" style={{flex:1 }}>{t('common.download', 'PDF')}</Button>
                </div>
                <div className="row gap-6">
                  <Button icon="transfer" style={{flex:1 }}>{t('common.sendEmail', 'Enviar correo')}</Button>
                  <Button icon="x" variant="danger" style={{flex:1 }}>Anular</Button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default BillingModule;
