// ERP MAYA — BillingModule (ES module)
// Data-driven: /api/sales (tickets). Lectura + detalle con ítems reales.
import Icon from '../components/Icon.jsx';
import { Ticket } from './POS.jsx';
import { useSales } from '../hooks/useOperations.js';
import { useBranches } from '../hooks/useMasters.js';
import React, { useState as useStateBill, useMemo as useMemoBill } from 'react';
import { useTranslation } from 'react-i18next';

const Q = (v) => `Q ${Number(v || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const Qs = Q;
const pad = (n) => String(n).padStart(2, '0');

// Backend Sale.Response → forma de ticket que usa el componente.
function mapTicket(s) {
  const d = s.saleDate ? new Date(s.saleDate) : null;
  return {
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
  const { items: salesRaw } = useSales();
  const { items: BRANCHES } = useBranches();
  const TICKETS = useMemoBill(() => salesRaw.map(mapTicket), [salesRaw]);
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

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('billing.title', 'Facturación · Tickets de venta')}</h1>
          <div className="page-subtitle">Documentos emitidos hoy · Facturas digitales SAT-FEL · Sucursales activas</div>
        </div>
        <div className="page-head-actions">
          <button className="btn"><Icon name="download"/>{t('billing.exportIva', 'Exportar libro IVA')}</button>
          <button className="btn"><Icon name="print"/>{t('billing.printBatch', 'Imprimir lote')}</button>
          <button className="btn accent"><Icon name="receipt"/>Anular factura</button>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <div className="label"><Icon name="receipt" size={11}/>Facturas emitidas hoy</div>
          <div className="val mono">{TICKETS.filter(ticket => ticket.status === 'paid').length}</div>
          <div className="delta muted">{TICKETS.length} {t('billing.kpis.inTotal', 'en total')}</div>
        </div>
        <div className="stat">
          <div className="label"><Icon name="cash" size={11}/>Total facturado</div>
          <div className="val mono">{Qs(totalDay)}</div>
          <div className="delta up"><Icon name="arrowUp" size={11}/>{t('common.iva', 'IVA')} Q{Qs(totalDay*0.12/1.12)}</div>
        </div>
        <div className="stat">
          <div className="label"><Icon name="return" size={11}/>Anuladas / Devoluciones</div>
          <div className="val mono" style={{color:'var(--danger)'}}>−{Qs(totalRefund)}</div>
          <div className="delta dn">{TICKETS.filter(ticket => ticket.status === 'refunded').length} {t('billing.kpis.refunded', 'documentos')}</div>
        </div>
        <div className="stat">
          <div className="label"><Icon name="shield" size={11}/>Estado SAT-FEL</div>
          <div className="val mono" style={{color:'var(--success)', fontSize:16, marginTop:8}}>
            <span style={{display:'inline-block', width:9, height:9, borderRadius:'50%', background:'var(--success)', marginRight:6, verticalAlign:'middle'}}/>
            Conectado
          </div>
          <div className="delta muted">{t('billing.synced', 'Sincronizado · hace 12s')}</div>
        </div>
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
        <button className="btn sm"><Icon name="calendar" size={12}/>21 May 2026</button>
      </div>

      <div className="card">
        <div className="tbl-wrap" style={{maxHeight:'60vh'}}>
          <table className="tbl">
            <thead>
              <tr>
                <th><input type="checkbox"/></th>
                <th>{t('billing.headers.invoice', 'No. Factura')}</th>
                <th>{t('billing.headers.dateTime', 'Fecha & hora')}</th>
                <th>{t('billing.headers.branch', 'Sucursal')}</th>
                <th>{t('billing.headers.cashier', 'Cajero')}</th>
                <th>{t('billing.headers.clientNit', 'Cliente · NIT')}</th>
                <th className="num">{t('billing.headers.items', 'Items')}</th>
                <th>{t('billing.headers.payment', 'Pago')}</th>
                <th className="num">{t('billing.headers.subtotal', 'Subtotal')}</th>
                <th className="num">{t('billing.headers.iva', 'IVA')}</th>
                <th className="num">{t('billing.headers.total', 'Total')}</th>
                <th>{t('billing.headers.status', 'Estado')}</th>
                <th>{t('billing.headers.fel', 'FEL')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(ticket => {
                const sub = ticket.total / 1.12;
                const iva = ticket.total - sub;
                return (
                  <tr key={ticket.id} onClick={() => setSelected(ticket)} style={{cursor:'pointer'}}>
                    <td><input type="checkbox" onClick={e=>e.stopPropagation()}/></td>
                    <td className="code" style={{fontWeight:600, color:'var(--accent)'}}>{ticket.id}</td>
                    <td className="code">{ticket.date}</td>
                    <td>{ticket.branch}</td>
                    <td>{ticket.cashier}</td>
                    <td>
                      <div>CF · Cliente Final</div>
                      <div className="muted code" style={{fontSize:10.5}}>NIT CF</div>
                    </td>
                    <td className="num">{ticket.items}</td>
                    <td>
                      <span className="pill">
                        <Icon name={ticket.pay === 'Efectivo' ? 'cash' : ticket.pay === 'Tarjeta' ? 'card' : 'transfer'} size={10}/>
                        {ticket.pay}
                      </span>
                    </td>
                    <td className="num">{Q(sub)}</td>
                    <td className="num muted">{Q(iva)}</td>
                    <td className="num" style={{fontWeight:600}}>{Q(ticket.total)}</td>
                    <td>
                      {ticket.status === 'paid' && <span className="pill success"><span className="dot"/>Pagada</span>}
                      {ticket.status === 'refunded' && <span className="pill danger"><span className="dot"/>Anulada</span>}
                    </td>
                    <td>
                      <span className="pill info" title={t('billing.certified', 'Certificada SAT')}>
                        <Icon name="shield" size={9}/>OK
                      </span>
                    </td>
                    <td>
                      <button className="icon-btn" onClick={e=>e.stopPropagation()}><Icon name="print" size={13}/></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{padding:'10px 14px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:12}}>
          <div className="muted">{t('billing.showing', 'Mostrando {{count}} de {{total}} documentos', { count: filtered.length, total: TICKETS.length })}</div>
          <div className="row gap-6">
            <button className="btn sm ghost"><Icon name="chevronLeft" size={11}/></button>
            <span className="mono muted">1 / 14</span>
            <button className="btn sm ghost"><Icon name="chevronRight" size={11}/></button>
          </div>
        </div>
      </div>

      {/* Detail drawer */}
      {selected && (
        <>
          <div className="drawer-overlay" onClick={() => setSelected(null)}/>
          <div className="drawer" style={{width:560}}>
            <div className="drawer-head">
              <div>
                <div className="code muted" style={{fontSize:11}}>FACTURA</div>
                <h3 style={{margin:0, marginTop:2, fontSize:15, color:'var(--accent)'}}>{selected.id}</h3>
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
                  <div className="card-body" style={{display:'grid', gridTemplateColumns:'auto 1fr', gap:'4px 10px', fontSize:12}}>
                    <div className="muted">{t('billing.uuid', 'UUID')}</div><div className="code">0E5F4C9A-26A2-4C7D-A8B1-{selected.id.slice(-12)}</div>
                    <div className="muted">{t('billing.serie', 'Serie')}</div><div className="code">A</div>
                    <div className="muted">{t('billing.authNo', 'No. autorización')}</div><div className="code">{selected.id.replace('T','FEL')}</div>
                    <div className="muted">{t('billing.certDate', 'Fecha certif.')}</div><div className="code">{selected.date}</div>
                    <div className="muted">{t('billing.regime', 'Régimen')}</div><div>{t('billing.general', 'General')}</div>
                    <div className="muted">{t('common.status', 'Estado')}</div><div><span className="pill success"><span className="dot"/>{t('billing.certified', 'Certificada')}</span></div>
                  </div>
                </div>
                <div className="row gap-6">
                  <button className="btn primary" style={{flex:1}}><Icon name="print"/>{t('common.print', 'Reimprimir')}</button>
                  <button className="btn" style={{flex:1}}><Icon name="download"/>{t('common.download', 'PDF')}</button>
                </div>
                <div className="row gap-6">
                  <button className="btn" style={{flex:1}}><Icon name="transfer"/>{t('common.sendEmail', 'Enviar correo')}</button>
                  <button className="btn danger" style={{flex:1}}><Icon name="x"/>Anular</button>
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
