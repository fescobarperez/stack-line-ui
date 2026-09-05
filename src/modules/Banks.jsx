// Stackline — Bancos & Cuentas. Datos reales del backend (sin mock):
//  · Cuentas   → /api/bank-accounts (useBankAccounts + createBankAccount)
//  · Movimientos → /api/bank-accounts/{id}/movements (merge de todas las cuentas)
//  · Transferencias → se registran como 2 movimientos (−origen / +destino) con una
//    referencia compartida; el historial se deriva de esos movimientos.
// El catálogo de bancos (con SWIFT/país) NO lo modela el backend: el banco es texto
// libre en la cuenta, por eso ese tab está oculto (pendiente backend).
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Icon from '../components/Icon.jsx';
import { useTranslation } from 'react-i18next';
import { useBankAccounts } from '../hooks/useOperations.js';
import { createBankAccount, bankMovements, addBankMovement } from '../api/wave3.js';

const Qf = (n) => 'Q ' + Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const USDf = (n) => '$ ' + Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (a) => (a?.moneda === 'USD' ? USDf(a?.saldo) : Qf(a?.saldo));
const TODAY = new Date().toISOString().slice(0, 10);

// Backend AccountResponse → shape del componente.
function mapAccount(a) {
  return {
    id: a.id,
    banco: a.bankName || '',
    tipo: a.accountType || 'monetaria',
    moneda: a.currency || 'GTQ',
    numero: a.accountNumber || a.accountCode || '',
    alias: a.alias || a.accountCode || '',
    saldo: Number(a.balance || 0),
    saldoContable: Number(a.bookBalance ?? a.balance ?? 0),
    estado: /inact/i.test(a.status || '') ? 'inactiva' : 'activa',
    fechaApertura: a.openedDate || '',
    ultimoMov: a.lastMovementDate || '',
  };
}

// Backend MovementResponse → shape del componente (amount con signo).
function mapMovement(m, accountId) {
  return {
    id: m.id,
    cuenta: m.bankAccountId ?? accountId,
    fecha: m.movementDate || '',
    descripcion: m.description || '',
    referencia: m.reference || '',
    tipo: m.movementType || '',
    monto: Number(m.amount || 0),
    saldo: Number(m.runningBalance || 0),
  };
}

const TIPO_PILL  = { deposito:'success', retiro:'danger', transferencia:'accent', debito:'warning', interes:'info', impuesto:'' };
const TIPO_LABEL = { deposito:'Depósito', retiro:'Retiro', transferencia:'Transferencia', debito:'Débito auto.', interes:'Interés', impuesto:'Impuesto' };

const EMPTY_CTA = { banco:'', tipo:'monetaria', moneda:'GTQ', numero:'', alias:'', saldo:'' };
const EMPTY_TRF = { origen:'', destino:'', monto:'', concepto:'', fecha:'' };

export default function Banks({ pushToast }) {
  const { t } = useTranslation();
  const [tab, setTab]   = useState('cuentas');
  const [search, setSearch]           = useState('');
  const [filterCuenta, setFilterCuenta] = useState('');
  const [filterTipo, setFilterTipo]     = useState('');
  const [drawerCuenta, setDrawerCuenta] = useState(null);
  const [showNuevaCuenta, setShowNuevaCuenta]               = useState(false);
  const [showNuevaTransferencia, setShowNuevaTransferencia] = useState(false);
  const [formCuenta, setFormCuenta] = useState(EMPTY_CTA);
  const [formTrf, setFormTrf]       = useState(EMPTY_TRF);
  const [saving, setSaving]         = useState(false);

  const { items: accountsRaw, loading, reload: reloadAccounts } = useBankAccounts();
  const accounts = useMemo(() => accountsRaw.map(mapAccount), [accountsRaw]);
  const accountIds = useMemo(() => accountsRaw.map(a => a.id).join(','), [accountsRaw]);

  // Movimientos de TODAS las cuentas (merge). Se recarga tras crear transferencia.
  const [movements, setMovements] = useState([]);
  const reloadMovements = useCallback(async () => {
    if (!accountsRaw.length) { setMovements([]); return; }
    const lists = await Promise.all(accountsRaw.map(a =>
      bankMovements(a.id)
        .then(r => (Array.isArray(r) ? r : (r?.content ?? [])).map(m => mapMovement(m, a.id)))
        .catch(() => [])
    ));
    setMovements(lists.flat());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountIds]);
  useEffect(() => { reloadMovements(); }, [reloadMovements]);

  const acctById = useMemo(() => Object.fromEntries(accounts.map(a => [a.id, a])), [accounts]);

  // Transferencias derivadas: movimientos tipo 'transferencia' agrupados por referencia.
  const transfers = useMemo(() => {
    const byRef = {};
    movements
      .filter(m => /transfer/i.test(m.tipo) && m.referencia)
      .forEach(m => { (byRef[m.referencia] ??= []).push(m); });
    return Object.entries(byRef).map(([ref, ms]) => {
      const out = ms.find(x => x.monto < 0);
      const inc = ms.find(x => x.monto > 0);
      const base = out || inc || ms[0];
      return {
        id: ref,
        fecha: base?.fecha || '',
        origen: out?.cuenta,
        destino: inc?.cuenta,
        monto: Math.abs(base?.monto || 0),
        concepto: base?.descripcion || '',
        estado: 'completada',
      };
    }).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  }, [movements]);

  const totalGTQ    = accounts.filter(a => a.moneda === 'GTQ' && a.estado === 'activa').reduce((s, a) => s + a.saldo, 0);
  const totalUSD    = accounts.filter(a => a.moneda === 'USD' && a.estado === 'activa').reduce((s, a) => s + a.saldo, 0);
  const diferencias = accounts.filter(a => a.saldo !== a.saldoContable && a.estado === 'activa').length;
  const movsHoy     = movements.filter(m => m.fecha === TODAY).length;

  const filteredMovs = useMemo(() => movements.filter(m => {
    if (filterCuenta && String(m.cuenta) !== String(filterCuenta)) return false;
    if (filterTipo   && m.tipo   !== filterTipo)   return false;
    const q = search.toLowerCase();
    if (q && !m.descripcion.toLowerCase().includes(q) && !m.referencia.toLowerCase().includes(q)) return false;
    return true;
  }).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')), [movements, search, filterCuenta, filterTipo]);

  const movsDeCuenta = drawerCuenta
    ? movements.filter(m => String(m.cuenta) === String(drawerCuenta.id))
        .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')).slice(0, 8)
    : [];

  const canTransfer = formTrf.origen && formTrf.destino && formTrf.monto && formTrf.concepto
    && formTrf.origen !== formTrf.destino;

  const saveAccount = async () => {
    setSaving(true);
    try {
      await createBankAccount({
        accountCode: (formCuenta.numero || formCuenta.alias || '').trim(),
        bankName: formCuenta.banco.trim(),
        accountType: formCuenta.tipo,
        currency: formCuenta.moneda,
        accountNumber: formCuenta.numero.trim(),
        alias: formCuenta.alias.trim(),
        balance: Number(formCuenta.saldo || 0),
        status: 'activa',
      });
      pushToast(t('banks.accountCreated', 'Cuenta creada correctamente'), 'success');
      setShowNuevaCuenta(false);
      await reloadAccounts();
    } catch (err) {
      pushToast((t('banks.accountCreateError', 'No se pudo crear la cuenta') + ': ' + err.message), 'error');
    } finally { setSaving(false); }
  };

  const saveTransfer = async () => {
    setSaving(true);
    const ref = `TRF-${Date.now()}`;
    const amount = Math.abs(Number(formTrf.monto || 0));
    const movementDate = formTrf.fecha || TODAY;
    try {
      await addBankMovement(formTrf.origen, { amount: -amount, movementType: 'transferencia', description: formTrf.concepto, reference: ref, movementDate });
      await addBankMovement(formTrf.destino, { amount:  amount, movementType: 'transferencia', description: formTrf.concepto, reference: ref, movementDate });
      pushToast(t('banks.transferRegistered', 'Transferencia registrada'), 'success');
      setShowNuevaTransferencia(false);
      await reloadAccounts();
      await reloadMovements();
    } catch (err) {
      pushToast((t('banks.transferError', 'No se pudo registrar la transferencia') + ': ' + err.message), 'error');
    } finally { setSaving(false); }
  };

  return (
    <div className="page">
      {/* Header */}
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('banks.title', 'Bancos & Cuentas')}</h1>
          <p className="page-sub">{t('banks.subtitle', 'Gestión de cuentas bancarias y movimientos')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn ghost sm" onClick={() => { setFormTrf(EMPTY_TRF); setShowNuevaTransferencia(true); }}>
            <Icon name="transfer" size={12} /> {t('banks.newTransfer', 'Transferencia')}
          </button>
          <button className="btn sm" onClick={() => { setFormCuenta(EMPTY_CTA); setShowNuevaCuenta(true); }}>
            <Icon name="plus" size={12} /> {t('banks.newAccount', 'Nueva cuenta')}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat">
          <div className="label">{t('banks.totalGTQ', 'Saldo total GTQ')}</div>
          <div className="val mono">{Qf(totalGTQ)}</div>
          <div className="delta up">
            {accounts.filter(a => a.moneda === 'GTQ' && a.estado === 'activa').length} {t('banks.activeAccounts', 'cuentas activas')}
          </div>
        </div>
        <div className="stat">
          <div className="label">{t('banks.totalUSD', 'Saldo total USD')}</div>
          <div className="val mono">{USDf(totalUSD)}</div>
          <div className="delta up">
            {accounts.filter(a => a.moneda === 'USD' && a.estado === 'activa').length} {t('banks.activeAccounts', 'cuentas activas')}
          </div>
        </div>
        <div className="stat">
          <div className="label">{t('banks.accountingDiffs', 'Diferencias contables')}</div>
          <div className="val mono">{diferencias}</div>
          <div className={`delta ${diferencias > 0 ? 'dn' : 'up'}`}>
            {diferencias > 0 ? t('banks.requireReconciliation', 'Requieren conciliación') : t('banks.allReconciled', 'Todo conciliado')}
          </div>
        </div>
        <div className="stat">
          <div className="label">{t('banks.movementsToday', 'Movimientos hoy')}</div>
          <div className="val mono">{movsHoy}</div>
          <div className="delta up">{movements.length} {t('banks.totalMovements', 'en total')}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <div className={`tab ${tab === 'cuentas'        ? 'active' : ''}`} onClick={() => setTab('cuentas')}>
          {t('banks.tabs.accounts', 'Cuentas')} <span className="count">{accounts.filter(a => a.estado === 'activa').length}</span>
        </div>
        <div className={`tab ${tab === 'movimientos'    ? 'active' : ''}`} onClick={() => setTab('movimientos')}>
          {t('banks.tabs.movements', 'Movimientos')} <span className="count">{movements.length}</span>
        </div>
        <div className={`tab ${tab === 'transferencias' ? 'active' : ''}`} onClick={() => setTab('transferencias')}>
          {t('banks.tabs.transfers', 'Transferencias')} <span className="count">{transfers.length}</span>
        </div>
      </div>

      {/* ── Cuentas ────────────────────────────────────────────── */}
      {tab === 'cuentas' && (
        <>
          {loading && accounts.length === 0 && <div className="empty" style={{ padding: 24 }}>{t('common.loading', 'Cargando…')}</div>}
          {!loading && accounts.length === 0 && <div className="empty" style={{ padding: 24 }}>{t('banks.noAccounts', 'Sin cuentas bancarias. Crea la primera con “Nueva cuenta”.')}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {accounts.map(a => {
              const diff = Math.abs(a.saldo - a.saldoContable);
              return (
                <div
                  key={a.id}
                  className="card"
                  style={{ cursor: 'pointer', opacity: a.estado === 'inactiva' ? 0.55 : 1, padding: 16 }}
                  onClick={() => setDrawerCuenta(a)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{a.alias}</div>
                      <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>
                        {a.banco} · {a.tipo} · {a.moneda}
                      </div>
                    </div>
                    {a.estado === 'inactiva'
                      ? <span className="pill">{t('common.inactive', 'Inactiva')}</span>
                      : <span className="pill success"><span className="dot" />{t('common.active', 'Activa')}</span>}
                  </div>
                  <div className="code" style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
                    {a.numero}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>
                    {fmt(a)}
                  </div>
                  {diff > 0 && (
                    <div className="delta dn" style={{ marginTop: 6 }}>
                      {t('banks.accountingDiff', 'Diferencia contable')}: {Qf(diff)}
                    </div>
                  )}
                  {a.ultimoMov && <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>{t('banks.lastMov', 'Último mov.')}: {a.ultimoMov}</div>}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Movimientos ────────────────────────────────────────── */}
      {tab === 'movimientos' && (
        <div className="card">
          <div className="filterbar">
            <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Icon name="search" size={13} style={{ position: 'absolute', left: 9, color: 'var(--muted)', pointerEvents: 'none' }} />
              <input
                className="input"
                style={{ paddingLeft: 28, width: '100%' }}
                placeholder={t('banks.searchMovements', 'Buscar descripción o referencia…')}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select className="input" value={filterCuenta} onChange={e => setFilterCuenta(e.target.value)}>
              <option value="">{t('banks.allAccounts', 'Todas las cuentas')}</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.alias}</option>)}
            </select>
            <select className="input" value={filterTipo} onChange={e => setFilterTipo(e.target.value)}>
              <option value="">{t('banks.allTypes', 'Todos los tipos')}</option>
              {Object.entries(TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button className="btn ghost sm"><Icon name="download" size={12} /> {t('common.export', 'Exportar')}</button>
          </div>
          <table className="mtable">
            <thead>
              <tr>
                <th>{t('common.date', 'Fecha')}</th>
                <th>{t('banks.account', 'Cuenta')}</th>
                <th>{t('common.description', 'Descripción')}</th>
                <th>{t('common.reference', 'Referencia')}</th>
                <th>{t('common.type', 'Tipo')}</th>
                <th className="num">{t('common.amount', 'Monto')}</th>
                <th className="num">{t('banks.balance', 'Saldo')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredMovs.map(m => {
                const cta = acctById[m.cuenta];
                return (
                  <tr key={m.id}>
                    <td className="muted">{m.fecha}</td>
                    <td style={{ fontSize: 12 }}>{cta?.alias || m.cuenta}</td>
                    <td style={{ fontWeight: 500 }}>{m.descripcion}</td>
                    <td className="code muted">{m.referencia}</td>
                    <td><span className={`pill ${TIPO_PILL[m.tipo] || ''}`}>{TIPO_LABEL[m.tipo] || m.tipo}</span></td>
                    <td className="num" style={{ fontWeight: 600, color: m.monto >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                      {m.monto >= 0 ? '+' : ''}{Qf(Math.abs(m.monto))}
                    </td>
                    <td className="num mono">{Qf(m.saldo)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredMovs.length === 0 && (
            <div className="muted" style={{ textAlign: 'center', padding: '32px 0', fontSize: 13 }}>
              {t('banks.noMovementsFilter', 'Sin movimientos para los filtros seleccionados.')}
            </div>
          )}
        </div>
      )}

      {/* ── Transferencias ─────────────────────────────────────── */}
      {tab === 'transferencias' && (
        <div className="card">
          <div className="card-head">
            <h3>{t('banks.transferHistory', 'Historial de transferencias')}</h3>
            <button className="btn sm" onClick={() => { setFormTrf(EMPTY_TRF); setShowNuevaTransferencia(true); }}>
              <Icon name="plus" size={12} /> {t('banks.newTransfer', 'Nueva transferencia')}
            </button>
          </div>
          <table className="mtable">
            <thead>
              <tr>
                <th>{t('common.reference', 'Referencia')}</th>
                <th>{t('common.date', 'Fecha')}</th>
                <th>{t('banks.origin', 'Origen')}</th>
                <th>{t('banks.destination', 'Destino')}</th>
                <th>{t('banks.concept', 'Concepto')}</th>
                <th className="num">{t('common.amount', 'Monto')}</th>
                <th>{t('common.status', 'Estado')}</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map(t_ => (
                <tr key={t_.id}>
                  <td className="code">{t_.id}</td>
                  <td className="muted">{t_.fecha}</td>
                  <td>{acctById[t_.origen]?.alias || t_.origen || '—'}</td>
                  <td>{acctById[t_.destino]?.alias || t_.destino || '—'}</td>
                  <td>{t_.concepto}</td>
                  <td className="num mono">{Qf(t_.monto)}</td>
                  <td><span className="pill success"><span className="dot" />{t('banks.completed', 'Completada')}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {transfers.length === 0 && (
            <div className="muted" style={{ textAlign: 'center', padding: '32px 0', fontSize: 13 }}>
              {t('banks.noTransfers', 'Sin transferencias registradas.')}
            </div>
          )}
        </div>
      )}

      {/* ── Drawer: Detalle de cuenta ─────────────────────────── */}
      {drawerCuenta && (
        <div className="drawer-overlay" onClick={() => setDrawerCuenta(null)}>
          <div className="drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-head">
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{drawerCuenta.alias}</div>
                <div className="muted" style={{ fontSize: 11.5 }}>
                  {drawerCuenta.banco} · {drawerCuenta.tipo} · {drawerCuenta.moneda}
                </div>
              </div>
              <button className="icon-btn" aria-label={t('common.close', 'Cerrar')} onClick={() => setDrawerCuenta(null)}><Icon name="close" /></button>
            </div>
            <div className="drawer-body">
              <div className="stat" style={{ marginBottom: 20 }}>
                <div className="label">{t('banks.currentBalance', 'Saldo actual')}</div>
                <div className="val mono" style={{ fontSize: 24 }}>{fmt(drawerCuenta)}</div>
                {drawerCuenta.saldo !== drawerCuenta.saldoContable && (
                  <div className="delta dn">{t('banks.bookBalance', 'Saldo contable')}: {Qf(drawerCuenta.saldoContable)}</div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', fontSize: 12.5, marginBottom: 20 }}>
                <div className="muted">{t('banks.accountNumber', 'N.° de cuenta')}</div>  <div className="code">{drawerCuenta.numero}</div>
                <div className="muted">{t('common.type', 'Tipo')}</div>            <div style={{ textTransform: 'capitalize' }}>{drawerCuenta.tipo}</div>
                <div className="muted">{t('banks.currency', 'Moneda')}</div>          <div>{drawerCuenta.moneda}</div>
                <div className="muted">{t('common.status', 'Estado')}</div>          <div style={{ textTransform: 'capitalize' }}>{drawerCuenta.estado}</div>
                <div className="muted">{t('banks.openingDate', 'Apertura')}</div>        <div>{drawerCuenta.fechaApertura || '—'}</div>
                <div className="muted">{t('banks.lastMov', 'Último mov.')}</div>     <div>{drawerCuenta.ultimoMov || '—'}</div>
              </div>

              <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8 }}>{t('banks.recentMovements', 'Últimos movimientos')}</div>
              <table className="mtable" style={{ fontSize: 11.5 }}>
                <thead><tr><th>{t('common.date', 'Fecha')}</th><th>{t('common.description', 'Descripción')}</th><th className="num">{t('common.amount', 'Monto')}</th></tr></thead>
                <tbody>
                  {movsDeCuenta.map(m => (
                    <tr key={m.id}>
                      <td className="muted">{m.fecha}</td>
                      <td>{m.descripcion}</td>
                      <td className="num" style={{ fontWeight: 600, color: m.monto >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {m.monto >= 0 ? '+' : ''}{Qf(Math.abs(m.monto))}
                      </td>
                    </tr>
                  ))}
                  {movsDeCuenta.length === 0 && (
                    <tr><td colSpan={3} className="muted" style={{ textAlign: 'center', padding: '12px 0' }}>{t('banks.noMovements', 'Sin movimientos')}</td></tr>
                  )}
                </tbody>
              </table>

              <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                <button
                  className="btn sm ghost"
                  style={{ flex: 1 }}
                  onClick={() => { setDrawerCuenta(null); setFormTrf({ ...EMPTY_TRF, origen: drawerCuenta.id }); setShowNuevaTransferencia(true); }}
                >
                  <Icon name="transfer" size={12} /> {t('banks.transfer', 'Transferir')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Nueva cuenta ───────────────────────────────── */}
      {showNuevaCuenta && (
        <div className="modal-overlay" onClick={() => setShowNuevaCuenta(false)}>
          <div className="modal" style={{ width: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <span>{t('banks.newBankAccount', 'Nueva cuenta bancaria')}</span>
              <button className="icon-btn" aria-label={t('common.close', 'Cerrar')} onClick={() => setShowNuevaCuenta(false)}><Icon name="close" /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="field span-2">
                  <label>{t('banks.aliasName', 'Alias / Nombre')}</label>
                  <input
                    placeholder={t('banks.aliasPlaceholder', 'Ej. Cuenta Principal GTQ')}
                    value={formCuenta.alias}
                    onChange={e => setFormCuenta(f => ({ ...f, alias: e.target.value }))}
                  />
                </div>
                <div className="field">
                  <label>{t('banks.bank', 'Banco')}</label>
                  <input
                    placeholder={t('banks.bankPlaceholder', 'Ej. Banco Industrial')}
                    value={formCuenta.banco}
                    onChange={e => setFormCuenta(f => ({ ...f, banco: e.target.value }))}
                  />
                </div>
                <div className="field">
                  <label>{t('common.type', 'Tipo')}</label>
                  <select value={formCuenta.tipo} onChange={e => setFormCuenta(f => ({ ...f, tipo: e.target.value }))}>
                    <option value="monetaria">{t('banks.types.monetary', 'Monetaria')}</option>
                    <option value="ahorro">{t('banks.types.savings', 'Ahorro')}</option>
                    <option value="inversion">{t('banks.types.investment', 'Inversión')}</option>
                  </select>
                </div>
                <div className="field">
                  <label>{t('banks.accountNumber', 'N.° de cuenta')}</label>
                  <input
                    placeholder="0000000-0"
                    value={formCuenta.numero}
                    onChange={e => setFormCuenta(f => ({ ...f, numero: e.target.value }))}
                  />
                </div>
                <div className="field">
                  <label>{t('banks.currency', 'Moneda')}</label>
                  <select value={formCuenta.moneda} onChange={e => setFormCuenta(f => ({ ...f, moneda: e.target.value }))}>
                    <option value="GTQ">GTQ — Quetzal</option>
                    <option value="USD">USD — Dólar</option>
                  </select>
                </div>
                <div className="field span-2">
                  <label>{t('banks.openingBalance', 'Saldo inicial')}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={formCuenta.saldo}
                    onChange={e => setFormCuenta(f => ({ ...f, saldo: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn ghost" onClick={() => setShowNuevaCuenta(false)}>{t('common.cancel', 'Cancelar')}</button>
              <button
                className="btn"
                disabled={saving || !formCuenta.alias || !formCuenta.banco || !formCuenta.numero}
                onClick={saveAccount}
              >
                {t('banks.createAccount', 'Crear cuenta')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Nueva transferencia ────────────────────────── */}
      {showNuevaTransferencia && (
        <div className="modal-overlay" onClick={() => setShowNuevaTransferencia(false)}>
          <div className="modal" style={{ width: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <span>{t('banks.newTransfer', 'Nueva transferencia')}</span>
              <button className="icon-btn" aria-label={t('common.close', 'Cerrar')} onClick={() => setShowNuevaTransferencia(false)}><Icon name="close" /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="field span-2">
                  <label>{t('banks.originAccount', 'Cuenta origen')}</label>
                  <select value={formTrf.origen} onChange={e => setFormTrf(f => ({ ...f, origen: e.target.value }))}>
                    <option value="">{t('common.selectDots', 'Seleccionar…')}</option>
                    {accounts.filter(a => a.estado === 'activa').map(a => (
                      <option key={a.id} value={a.id}>{a.alias} ({a.moneda})</option>
                    ))}
                  </select>
                </div>
                <div className="field span-2">
                  <label>{t('banks.destinationAccount', 'Cuenta destino')}</label>
                  <select value={formTrf.destino} onChange={e => setFormTrf(f => ({ ...f, destino: e.target.value }))}>
                    <option value="">{t('common.selectDots', 'Seleccionar…')}</option>
                    {accounts.filter(a => a.estado === 'activa' && String(a.id) !== String(formTrf.origen)).map(a => (
                      <option key={a.id} value={a.id}>{a.alias} ({a.moneda})</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>{t('common.amount', 'Monto')}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={formTrf.monto}
                    onChange={e => setFormTrf(f => ({ ...f, monto: e.target.value }))}
                  />
                  {formTrf.origen && acctById[formTrf.origen] && (
                    <div className="muted" style={{ fontSize: 11 }}>
                      {t('banks.available', 'Disponible')}: {fmt(acctById[formTrf.origen])}
                    </div>
                  )}
                </div>
                <div className="field">
                  <label>{t('common.date', 'Fecha')}</label>
                  <input
                    type="date"
                    value={formTrf.fecha}
                    onChange={e => setFormTrf(f => ({ ...f, fecha: e.target.value }))}
                  />
                </div>
                <div className="field span-2">
                  <label>{t('banks.concept', 'Concepto')}</label>
                  <input
                    placeholder={t('banks.conceptPlaceholder', 'Descripción del traslado…')}
                    value={formTrf.concepto}
                    onChange={e => setFormTrf(f => ({ ...f, concepto: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn ghost" onClick={() => setShowNuevaTransferencia(false)}>{t('common.cancel', 'Cancelar')}</button>
              <button
                className="btn"
                disabled={saving || !canTransfer}
                onClick={saveTransfer}
              >
                {t('banks.register', 'Registrar')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
