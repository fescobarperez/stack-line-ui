// Stackline — Módulo de Contabilidad
import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from '../components/Icon.jsx';
import { useAccounts, useJournalEntries, usePeriods } from '../hooks/useAccounting.js';

const LEVEL_INDENT = { 1: 0, 2: 16, 3: 32, 4: 48, 5: 64 };
const LEVEL_STYLE  = {
  1: { fontWeight: 800, fontSize: 13, textTransform: 'uppercase', color: 'var(--text)' },
  2: { fontWeight: 700, fontSize: 12.5, color: 'var(--text)' },
  3: { fontWeight: 600, fontSize: 12, color: 'var(--text)' },
  4: { fontWeight: 400, fontSize: 12, color: 'var(--text)' },
  5: { fontWeight: 400, fontSize: 11.5, color: 'var(--muted)' },
};
const PERIOD_STATUS = { open: 'success', closed: 'neutral', locked: 'danger' };
const ENTRY_STATUS  = { posted: 'success', draft: 'warning', reversed: 'neutral' };
const TYPE_LABEL    = { auto: 'Automática', manual: 'Manual' };

function fmt(n) { return `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fmtDate(d) { return String(d).slice(0, 10); }

// ── Modal: Nueva cuenta ───────────────────────────────────────────────────────
function NewAccountModal({ accounts, onSave, onClose }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ code: '', parentCode: '', name: '', level: '4', normalBalance: 'debit', allowsEntries: true });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.code || !form.name) return;
    onSave(form);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">{t('accounting.newAccountTitle', 'Nueva cuenta contable')}</div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">
              <div className="field">
                <label className="field-label">{t('accounting.codeRequired', 'Código *')}</label>
                <input className="field-input mono" placeholder="Ej: 110104" value={form.code}
                  onChange={e => set('code', e.target.value)} required />
              </div>
              <div className="field">
                <label className="field-label">{t('accounting.parentAccount', 'Cuenta padre')}</label>
                <select className="field-input" value={form.parentCode} onChange={e => set('parentCode', e.target.value)}>
                  <option value="">{t('accounting.root', '— Raíz —')}</option>
                  {accounts.map(a => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}
                </select>
              </div>
              <div className="field span-2">
                <label className="field-label">{t('accounting.nameRequired', 'Nombre *')}</label>
                <input className="field-input" value={form.name} onChange={e => set('name', e.target.value)} required />
              </div>
              <div className="field">
                <label className="field-label">{t('accounting.level', 'Nivel')}</label>
                <select className="field-input" value={form.level} onChange={e => set('level', e.target.value)}>
                  <option value="1">{t('accounting.level1', '1 — Clase')}</option>
                  <option value="2">{t('accounting.level2', '2 — Grupo')}</option>
                  <option value="3">{t('accounting.level3', '3 — Cuenta')}</option>
                  <option value="4">{t('accounting.level4', '4 — Subcuenta')}</option>
                  <option value="5">{t('accounting.level5', '5 — Auxiliar')}</option>
                </select>
              </div>
              <div className="field">
                <label className="field-label">{t('accounting.normalBalance', 'Saldo normal')}</label>
                <select className="field-input" value={form.normalBalance} onChange={e => set('normalBalance', e.target.value)}>
                  <option value="debit">{t('accounting.debit', 'Débito (Activo/Gasto)')}</option>
                  <option value="credit">{t('accounting.credit', 'Crédito (Pasivo/Ingreso)')}</option>
                </select>
              </div>
              <div className="field span-2">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.allowsEntries} onChange={e => set('allowsEntries', e.target.checked)} />
                  {t('accounting.allowsEntries', 'Permite registrar partidas directamente (cuenta de detalle)')}
                </label>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose}>{t('common.cancel', 'Cancelar')}</button>
            <button type="submit" className="btn accent"><Icon name="check" size={12} />{t('accounting.createAccount', 'Crear cuenta')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal: Nueva partida manual ───────────────────────────────────────────────
function NewEntryModal({ accounts, periods, onSave, onClose }) {
  const { t } = useTranslation();
  const leafAccounts = accounts.filter(a => a.allowsEntries);
  const openPeriod   = periods.find(p => p.status === 'open');
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), periodId: openPeriod?.id || '', description: '', reference: '' });
  const [lines, setLines] = useState([
    { accountCode: '', debit: '', credit: '', description: '' },
    { accountCode: '', debit: '', credit: '', description: '' },
  ]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setLine = (idx, k, v) => setLines(prev => prev.map((l, i) => i === idx ? { ...l, [k]: v } : l));
  const addLine = () => setLines(prev => [...prev, { accountCode: '', debit: '', credit: '', description: '' }]);
  const removeLine = (idx) => setLines(prev => prev.filter((_, i) => i !== idx));

  const totalDebit  = lines.reduce((s, l) => s + (parseFloat(l.debit)  || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const balanced    = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!balanced || !form.description) return;
    onSave({ ...form, lines, totalDebit, totalCredit });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 760 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">{t('accounting.newEntryTitle', 'Nueva partida de diario (manual)')}</div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid" style={{ marginBottom: 16 }}>
              <div className="field">
                <label className="field-label">{t('accounting.dateRequired', 'Fecha *')}</label>
                <input className="field-input" type="date" value={form.date} onChange={e => set('date', e.target.value)} required />
              </div>
              <div className="field">
                <label className="field-label">{t('accounting.period', 'Período')}</label>
                <select className="field-input" value={form.periodId} onChange={e => set('periodId', e.target.value)}>
                  {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="field span-2">
                <label className="field-label">{t('accounting.descriptionRequired', 'Descripción *')}</label>
                <input className="field-input" value={form.description} onChange={e => set('description', e.target.value)} required placeholder={t('accounting.descriptionPlaceholder', 'Concepto de la partida...')} />
              </div>
              <div className="field">
                <label className="field-label">{t('common.reference', 'Referencia')}</label>
                <input className="field-input mono" value={form.reference} onChange={e => set('reference', e.target.value)} placeholder="Ej: FAC-001, CHQ-322..." />
              </div>
            </div>

            <table className="data-table" style={{ marginBottom: 8 }}>
              <thead>
                <tr>
                  <th style={{ width: '35%' }}>{t('accounting.account', 'Cuenta')}</th>
                  <th className="right" style={{ width: 130 }}>{t('accounting.debitCol', 'Débito')}</th>
                  <th className="right" style={{ width: 130 }}>{t('accounting.creditCol', 'Crédito')}</th>
                  <th>{t('accounting.note', 'Nota')}</th>
                  <th style={{ width: 36 }}></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => (
                  <tr key={idx}>
                    <td>
                      <select className="field-input" style={{ fontSize: 12 }} value={line.accountCode}
                        onChange={e => setLine(idx, 'accountCode', e.target.value)}>
                        <option value="">{t('accounting.selectAccount', '— Seleccionar cuenta —')}</option>
                        {leafAccounts.map(a => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}
                      </select>
                    </td>
                    <td>
                      <input type="number" min="0" step="0.01" className="field-input mono" style={{ textAlign: 'right', padding: '4px 8px', fontSize: 13 }}
                        value={line.debit} onChange={e => setLine(idx, 'debit', e.target.value)} placeholder="0.00" />
                    </td>
                    <td>
                      <input type="number" min="0" step="0.01" className="field-input mono" style={{ textAlign: 'right', padding: '4px 8px', fontSize: 13 }}
                        value={line.credit} onChange={e => setLine(idx, 'credit', e.target.value)} placeholder="0.00" />
                    </td>
                    <td>
                      <input className="field-input" style={{ fontSize: 12 }} value={line.description}
                        onChange={e => setLine(idx, 'description', e.target.value)} />
                    </td>
                    <td>
                      {lines.length > 2 && (
                        <button type="button" className="icon-btn" onClick={() => removeLine(idx)}>
                          <Icon name="x" size={11} style={{ color: 'var(--danger)' }} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td style={{ padding: '8px 12px', fontWeight: 600, fontSize: 12, color: 'var(--muted)' }}>{t('accounting.totals', 'TOTALES')}</td>
                  <td className="right mono" style={{ fontWeight: 700, padding: '8px 12px', color: totalDebit > 0 ? 'var(--text)' : 'var(--muted)' }}>{fmt(totalDebit)}</td>
                  <td className="right mono" style={{ fontWeight: 700, padding: '8px 12px', color: totalCredit > 0 ? 'var(--text)' : 'var(--muted)' }}>{fmt(totalCredit)}</td>
                  <td colSpan={2}>
                    {totalDebit > 0 && (
                      <span className={`pill ${balanced ? 'success' : 'danger'}`} style={{ fontSize: 10 }}>
                        {balanced ? t('accounting.balanced', 'Balanceada') : `${t('accounting.difference', 'Diferencia')}: ${fmt(Math.abs(totalDebit - totalCredit))}`}
                      </span>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
            <button type="button" className="btn" style={{ fontSize: 12 }} onClick={addLine}>
              <Icon name="plus" size={11} />{t('accounting.addLine', 'Agregar línea')}
            </button>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose}>{t('common.cancel', 'Cancelar')}</button>
            <button type="submit" className="btn accent" disabled={!balanced}>
              <Icon name="check" size={12} />{t('accounting.registerEntry', 'Registrar partida')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Panel detalle de comprobante ──────────────────────────────────────────────
function EntryDetail({ entry, onClose, onReverse }) {
  const { t } = useTranslation();
  return (
    <div className="drawer">
      <div className="drawer-head">
        <div>
          <div className="drawer-title">{t('accounting.voucher', 'Comprobante')} #{entry.id}</div>
          <div className="muted" style={{ fontSize: 12 }}>{fmtDate(entry.date)} · {TYPE_LABEL[entry.type]}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {entry.status === 'posted' && (
            <button className="btn" style={{ color: 'var(--danger)' }} onClick={() => onReverse(entry)}>{t('accounting.reverse', 'Revertir')}</button>
          )}
          <button className="icon-btn" onClick={onClose}><Icon name="x" /></button>
        </div>
      </div>

      <div className="drawer-body" style={{ overflowY: 'auto' }}>
        <div className="detail-grid" style={{ marginBottom: 16 }}>
          <div className="detail-row">
            <span className="detail-label">{t('common.description', 'Descripción')}</span>
            <span>{entry.description}</span>
          </div>
          {entry.reference && (
            <div className="detail-row">
              <span className="detail-label">{t('common.reference', 'Referencia')}</span>
              <span className="mono">{entry.reference}</span>
            </div>
          )}
          <div className="detail-row">
            <span className="detail-label">{t('common.status', 'Estado')}</span>
            <span className={`pill ${ENTRY_STATUS[entry.status]}`} style={{ fontSize: 10 }}>{entry.status}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">{t('accounting.totalDebit', 'Total débito')}</span>
            <span className="mono" style={{ fontWeight: 600 }}>{fmt(entry.totalDebit)}</span>
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>{t('accounting.account', 'Cuenta')}</th>
              <th>{t('common.name', 'Nombre')}</th>
              <th className="right">{t('accounting.debitCol', 'Débito')}</th>
              <th className="right">{t('accounting.creditCol', 'Crédito')}</th>
            </tr>
          </thead>
          <tbody>
            {entry.lines.map((line, idx) => (
              <tr key={idx}>
                <td className="mono" style={{ fontSize: 11 }}>{line.accountCode}</td>
                <td style={{ fontSize: 13 }}>{line.name}</td>
                <td className="right mono">
                  {line.debit > 0 ? <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{fmt(line.debit)}</span> : <span className="muted">—</span>}
                </td>
                <td className="right mono">
                  {line.credit > 0 ? <span style={{ color: 'var(--danger)', fontWeight: 600 }}>{fmt(line.credit)}</span> : <span className="muted">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} style={{ padding: '8px 12px', fontWeight: 600, fontSize: 12, color: 'var(--muted)', textAlign: 'right' }}>{t('accounting.totals', 'TOTALES')}</td>
              <td className="right mono" style={{ fontWeight: 700 }}>{fmt(entry.totalDebit)}</td>
              <td className="right mono" style={{ fontWeight: 700 }}>{fmt(entry.totalCredit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ── Módulo principal ──────────────────────────────────────────────────────────
export default function Accounting({ pushToast }) {
  const { t } = useTranslation();
  // Plan de cuentas, pólizas y períodos desde el backend (con fallback al mock).
  const { items: apiAccounts } = useAccounts();
  const { items: apiEntries } = useJournalEntries();
  const periods = usePeriods();
  const [tab, setTab]         = useState('plan');
  const [search, setSearch]   = useState('');
  const [selected, setSelected] = useState(null);
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [showNewEntry, setShowNewEntry]     = useState(false);
  const [accounts, setAccounts]   = useState(apiAccounts);
  const [entries, setEntries]     = useState(apiEntries);
  // Sincroniza las listas locales cuando llegan datos del backend.
  useEffect(() => { setAccounts(apiAccounts); }, [apiAccounts]);
  useEffect(() => { setEntries(apiEntries); }, [apiEntries]);
  const [entrySearch, setEntrySearch] = useState('');
  const [entryType, setEntryType]     = useState('all');

  const filteredAccounts = useMemo(() => {
    if (!search) return accounts;
    const q = search.toLowerCase();
    return accounts.filter(a => a.code.includes(q) || a.name.toLowerCase().includes(q));
  }, [accounts, search]);

  const filteredEntries = useMemo(() => {
    let e = entries;
    if (entryType !== 'all') e = e.filter(x => x.type === entryType);
    if (entrySearch) {
      const q = entrySearch.toLowerCase();
      e = e.filter(x => x.description.toLowerCase().includes(q) || (x.reference || '').toLowerCase().includes(q) || String(x.id).includes(q));
    }
    return e;
  }, [entries, entryType, entrySearch]);

  const openPeriod = periods.find(p => p.status === 'open');
  const totalAutoDebits = entries.filter(e => e.type === 'auto').reduce((s, e) => s + e.totalDebit, 0);

  const handleNewAccount = (form) => {
    setAccounts(prev => [...prev, { ...form, level: parseInt(form.level), allowsEntries: form.allowsEntries, isActive: true }]
      .sort((a, b) => a.code.localeCompare(b.code)));
    setShowNewAccount(false);
    pushToast?.(`Cuenta ${form.code} creada`, 'success');
  };

  const handleNewEntry = (form) => {
    const newEntry = {
      id: Math.max(...entries.map(e => e.id)) + 1,
      date: form.date,
      periodId: parseInt(form.periodId),
      type: 'manual',
      description: form.description,
      reference: form.reference || null,
      sourceType: null,
      totalDebit: form.totalDebit,
      totalCredit: form.totalCredit,
      status: 'posted',
      lines: form.lines.filter(l => l.accountCode).map(l => ({
        accountCode: l.accountCode,
        name: accounts.find(a => a.code === l.accountCode)?.name || l.accountCode,
        debit: parseFloat(l.debit) || 0,
        credit: parseFloat(l.credit) || 0,
      })),
    };
    setEntries(prev => [newEntry, ...prev]);
    setShowNewEntry(false);
    pushToast?.(`Partida #${newEntry.id} registrada`, 'success');
  };

  const handleReverse = (entry) => {
    setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, status: 'reversed' } : e));
    setSelected(null);
    pushToast?.(`Comprobante #${entry.id} revertido`, '');
  };

  const selectedEntry = selected ? entries.find(e => e.id === selected.id) : null;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('accounting.title', 'Contabilidad')}</h1>
          <div className="page-subtitle">
            {t('accounting.activePeriod', 'Período activo')}: <strong>{openPeriod?.name || '—'}</strong> · {entries.length} {t('accounting.vouchers', 'comprobantes')}
          </div>
        </div>
        <div className="page-head-actions">
          {tab === 'plan' && (
            <button className="btn accent" onClick={() => setShowNewAccount(true)}>
              <Icon name="plus" size={12} />{t('accounting.newAccount', 'Nueva cuenta')}
            </button>
          )}
          {tab === 'partidas' && (
            <button className="btn accent" onClick={() => setShowNewEntry(true)}>
              <Icon name="plus" size={12} />{t('accounting.newEntry', 'Nueva partida')}
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <div className="stat">
          <div className="label"><Icon name="receipt" size={11} />{t('accounting.statVouchers', 'Comprobantes (período)')}</div>
          <div className="val mono">{entries.length}</div>
          <div className="delta muted">{entries.filter(e => e.type === 'auto').length} {t('accounting.automatic', 'automáticas')} · {entries.filter(e => e.type === 'manual').length} {t('accounting.manual', 'manuales')}</div>
        </div>
        <div className="stat">
          <div className="label"><Icon name="cash" size={11} />{t('accounting.statDebits', 'Total débitos registrados')}</div>
          <div className="val mono">{`Q ${(totalAutoDebits / 1000).toFixed(0)}k`}</div>
          <div className="delta muted">{t('accounting.automaticEntries', 'Partidas automáticas')}</div>
        </div>
        <div className="stat">
          <div className="label"><Icon name="tag" size={11} />{t('accounting.statAccounts', 'Cuentas en el catálogo')}</div>
          <div className="val mono">{accounts.length}</div>
          <div className="delta muted">{accounts.filter(a => a.allowsEntries).length} {t('accounting.detailAccounts', 'cuentas de detalle')}</div>
        </div>
        <div className="stat">
          <div className="label"><Icon name="calendar" size={11} />{t('accounting.statCurrentPeriod', 'Período actual')}</div>
          <div className="val" style={{ fontSize: 15 }}>{openPeriod?.name || '—'}</div>
          <div className="delta muted">{periods.filter(p => p.status === 'closed').length} {t('accounting.closedPeriods', 'períodos cerrados')}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <div className={`tab ${tab === 'plan' ? 'active' : ''}`} onClick={() => setTab('plan')}>
          {t('accounting.tabs.accounts', 'Plan de cuentas')} <span className="count">{accounts.length}</span>
        </div>
        <div className={`tab ${tab === 'partidas' ? 'active' : ''}`} onClick={() => setTab('partidas')}>
          {t('accounting.tabs.journal', 'Partidas de diario')} <span className="count">{entries.length}</span>
        </div>
        <div className={`tab ${tab === 'periodos' ? 'active' : ''}`} onClick={() => setTab('periodos')}>
          {t('accounting.periodsTab', 'Períodos contables')} <span className="count">{periods.length}</span>
        </div>
      </div>

      {/* ── Plan de cuentas ── */}
      {tab === 'plan' && (
        <>
          <div className="toolbar">
            <div className="search-wrap" style={{ flex: 1, maxWidth: 320 }}>
              <Icon name="search" className="icon" size={13} />
              <input className="search-input" placeholder={t('accounting.searchAccounts', 'Buscar por código o nombre…')}
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <span className="muted" style={{ fontSize: 12 }}>{filteredAccounts.length} {t('accounting.accountsCount', 'cuentas')}</span>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('common.code', 'Código')}</th>
                  <th>{t('common.name', 'Nombre')}</th>
                  <th>{t('accounting.level', 'Nivel')}</th>
                  <th>{t('accounting.normalBalance', 'Saldo normal')}</th>
                  <th>{t('common.type', 'Tipo')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredAccounts.map(a => (
                  <tr key={a.code}>
                    <td>
                      <span className="mono" style={{ paddingLeft: LEVEL_INDENT[a.level] || 0, display: 'block', ...LEVEL_STYLE[a.level] }}>
                        {a.code}
                      </span>
                    </td>
                    <td style={{ paddingLeft: LEVEL_INDENT[a.level] || 0, ...LEVEL_STYLE[a.level] }}>{a.name}</td>
                    <td className="muted" style={{ fontSize: 11 }}>{t('accounting.levelN', 'Nivel')} {a.level}</td>
                    <td>
                      <span className={`pill ${a.normalBalance === 'debit' ? 'info' : 'warning'}`} style={{ fontSize: 10 }}>
                        {a.normalBalance === 'debit' ? t('accounting.debitLabel', 'Débito') : t('accounting.creditLabel', 'Crédito')}
                      </span>
                    </td>
                    <td>
                      {a.allowsEntries
                        ? <span className="pill success" style={{ fontSize: 10 }}>{t('accounting.detail', 'Detalle')}</span>
                        : <span className="pill neutral" style={{ fontSize: 10 }}>{t('accounting.grouping', 'Agrupadora')}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Partidas de diario ── */}
      {tab === 'partidas' && (
        <>
          <div className="toolbar">
            <div className="search-wrap" style={{ flex: 1, maxWidth: 300 }}>
              <Icon name="search" className="icon" size={13} />
              <input className="search-input" placeholder={t('accounting.searchEntries', 'Buscar partida o referencia…')}
                value={entrySearch} onChange={e => setEntrySearch(e.target.value)} />
            </div>
            <select className="field-input" style={{ width: 'auto' }} value={entryType} onChange={e => setEntryType(e.target.value)}>
              <option value="all">{t('accounting.allTypes', 'Todos los tipos')}</option>
              <option value="auto">{t('accounting.automaticPlural', 'Automáticas')}</option>
              <option value="manual">{t('accounting.manualPlural', 'Manuales')}</option>
            </select>
            <span className="muted" style={{ fontSize: 12 }}>{filteredEntries.length} {t('accounting.voucherCount', 'comprobante')}{filteredEntries.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>#</th>
                  <th>{t('common.date', 'Fecha')}</th>
                  <th>{t('common.description', 'Descripción')}</th>
                  <th>{t('common.reference', 'Referencia')}</th>
                  <th>{t('common.type', 'Tipo')}</th>
                  <th className="right">{t('common.total', 'Total')}</th>
                  <th>{t('common.status', 'Estado')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.length === 0 ? (
                  <tr><td colSpan={7} className="empty">{t('accounting.noEntries', 'Sin partidas')}</td></tr>
                ) : filteredEntries.map(e => (
                  <tr key={e.id} className="clickable" onClick={() => setSelected(e)}>
                    <td className="mono muted" style={{ fontSize: 11 }}>#{e.id}</td>
                    <td className="mono muted">{fmtDate(e.date)}</td>
                    <td style={{ fontWeight: 500 }}>{e.description}</td>
                    <td className="mono muted" style={{ fontSize: 11 }}>{e.reference || '—'}</td>
                    <td>
                      <span className={`pill ${e.type === 'auto' ? 'info' : 'neutral'}`} style={{ fontSize: 10 }}>
                        {TYPE_LABEL[e.type]}
                      </span>
                    </td>
                    <td className="right mono">{fmt(e.totalDebit)}</td>
                    <td>
                      <span className={`pill ${ENTRY_STATUS[e.status]}`} style={{ fontSize: 10 }}>{e.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Períodos ── */}
      {tab === 'periodos' && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('accounting.periodCol', 'Período')}</th>
                <th>{t('accounting.startDate', 'Inicio')}</th>
                <th>{t('accounting.endDate', 'Fin')}</th>
                <th>{t('common.status', 'Estado')}</th>
                <th>{t('accounting.vouchers', 'Comprobantes')}</th>
              </tr>
            </thead>
            <tbody>
              {periods.map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td className="mono muted">{p.startDate}</td>
                  <td className="mono muted">{p.endDate}</td>
                  <td>
                    <span className={`pill ${PERIOD_STATUS[p.status]}`} style={{ fontSize: 10 }}>
                      {p.status === 'open' ? t('accounting.open', 'Abierto') : p.status === 'closed' ? t('accounting.closed', 'Cerrado') : t('accounting.locked', 'Bloqueado')}
                    </span>
                  </td>
                  <td className="mono muted">{entries.filter(e => e.periodId === p.id).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Panel detalle comprobante */}
      {selectedEntry && !showNewEntry && (
        <div className="drawer-overlay">
          <EntryDetail entry={selectedEntry} onClose={() => setSelected(null)} onReverse={handleReverse} />
        </div>
      )}

      {showNewAccount && (
        <NewAccountModal accounts={accounts} onSave={handleNewAccount} onClose={() => setShowNewAccount(false)} />
      )}

      {showNewEntry && (
        <NewEntryModal accounts={accounts} periods={periods} onSave={handleNewEntry} onClose={() => setShowNewEntry(false)} />
      )}
    </div>
  );
}
