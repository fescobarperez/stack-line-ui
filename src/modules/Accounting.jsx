// Stackline — Módulo de Contabilidad
import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import DataTable from '../components/DataTable.jsx';
import StatCard from '../components/StatCard.jsx';
import { useAccounts, useJournalEntries, usePeriods } from '../hooks/useAccounting.js';
import { createAccount, createJournalEntry } from '../api/accounting.js';

const LEVEL_INDENT = { 1: 0, 2: 16, 3: 32, 4: 48, 5: 64 };
// Jerarquía del árbol de cuentas sobre la escala M3: con solo dos pesos (400/500)
// los 5 niveles se separan por peso, luego por tamaño y al final por color.
const LEVEL_STYLE  = {
  1: { fontWeight: 500, fontSize: 14, textTransform: 'uppercase', color: 'var(--text)' },
  2: { fontWeight: 500, fontSize: 14, color: 'var(--text)' },
  3: { fontWeight: 400, fontSize: 14, color: 'var(--text)' },
  4: { fontWeight: 400, fontSize: 12, color: 'var(--text)' },
  5: { fontWeight: 400, fontSize: 12, color: 'var(--muted)' },
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
          <h3>{t('accounting.newAccountTitle', 'Nueva cuenta contable')}</h3>
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
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.allowsEntries} onChange={e => set('allowsEntries', e.target.checked)} />
                  {t('accounting.allowsEntries', 'Permite registrar partidas directamente (cuenta de detalle)')}
                </label>
              </div>
            </div>
          </div>
          <div className="modal-foot">
            <Button type="button" onClick={onClose}>{t('common.cancel', 'Cancelar')}</Button>
            <Button icon="check" variant="accent" type="submit">{t('accounting.createAccount', 'Crear cuenta')}</Button>
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
          <h3>{t('accounting.newEntryTitle', 'Nueva partida de diario (manual)')}</h3>
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
                      <input type="number" min="0" step="0.01" className="field-input mono" style={{ textAlign: 'right', padding: '4px 8px', fontSize: 14 }}
                        value={line.debit} onChange={e => setLine(idx, 'debit', e.target.value)} placeholder="0.00" />
                    </td>
                    <td>
                      <input type="number" min="0" step="0.01" className="field-input mono" style={{ textAlign: 'right', padding: '4px 8px', fontSize: 14 }}
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
                  <td style={{ padding: '8px 12px', fontWeight: 500, color: 'var(--muted)' }}>{t('accounting.totals', 'TOTALES')}</td>
                  <td className="right mono" style={{ fontWeight: 500, padding: '8px 12px', color: totalDebit> 0 ? 'var(--text)' : 'var(--muted)' }}>{fmt(totalDebit)}</td>
                  <td className="right mono" style={{ fontWeight: 500, padding: '8px 12px', color: totalCredit> 0 ? 'var(--text)' : 'var(--muted)' }}>{fmt(totalCredit)}</td>
                  <td colSpan={2}>
                    {totalDebit > 0 && (
                      <span className={`badge-m3 ${balanced ? 'success' : 'danger'}`}>
                        {balanced ? t('accounting.balanced', 'Balanceada') : `${t('accounting.difference', 'Diferencia')}: ${fmt(Math.abs(totalDebit - totalCredit))}`}
                      </span>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
            <Button size="sm" icon="plus" type="button" onClick={addLine}>{t('accounting.addLine', 'Agregar línea')}
            </Button>
          </div>
          <div className="modal-foot">
            <Button type="button" onClick={onClose}>{t('common.cancel', 'Cancelar')}</Button>
            <Button icon="check" variant="accent" type="submit" disabled={!balanced}>{t('accounting.registerEntry', 'Registrar partida')}
            </Button>
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
            <Button style={{ color: 'var(--danger)' }} onClick={() => onReverse(entry)}>{t('accounting.reverse', 'Revertir')}</Button>
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
            <span className={`badge-m3 ${ENTRY_STATUS[entry.status]}`}>{entry.status}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">{t('accounting.totalDebit', 'Total débito')}</span>
            <span className="mono" style={{ fontWeight: 500 }}>{fmt(entry.totalDebit)}</span>
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
                <td className="mono">{line.accountCode}</td>
                <td>{line.name}</td>
                <td className="right mono">
                  {line.debit > 0 ? <span style={{ color: 'var(--accent)', fontWeight: 500 }}>{fmt(line.debit)}</span> : <span className="muted">—</span>}
                </td>
                <td className="right mono">
                  {line.credit > 0 ? <span style={{ color: 'var(--danger)', fontWeight: 500 }}>{fmt(line.credit)}</span> : <span className="muted">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} style={{ padding: '8px 12px', fontWeight: 500, color: 'var(--muted)', textAlign: 'right' }}>{t('accounting.totals', 'TOTALES')}</td>
              <td className="right mono" style={{ fontWeight: 500 }}>{fmt(entry.totalDebit)}</td>
              <td className="right mono" style={{ fontWeight: 500 }}>{fmt(entry.totalCredit)}</td>
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
  const { items: apiAccounts, reload: reloadAccounts } = useAccounts();
  const { items: apiEntries, reload: reloadEntries } = useJournalEntries();
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

  // Antes esto solo hacía setAccounts() en memoria: la cuenta desaparecía al
  // recargar. Crear una cuenta contable no puede fingirse.
  const handleNewAccount = async (form) => {
    try {
      const parent = form.parentCode
        ? accounts.find(a => a.code === form.parentCode) : null;
      await createAccount({
        code: form.code.trim(),
        name: form.name.trim(),
        parentId: parent?.id ?? null,
        level: parseInt(form.level) || null,
        normalBalance: form.normalBalance,
        allowsEntries: !!form.allowsEntries,
      });
      await reloadAccounts();
      setShowNewAccount(false);
      pushToast?.(t('accounting.accountCreated', `Cuenta ${form.code} creada`), 'success');
    } catch (err) {
      pushToast?.(t('accounting.accountFailed', 'No se pudo crear la cuenta: ') + err.message, 'danger');
    }
  };

  // Una partida de diario es libro mayor: fingir que se registró era lo más
  // grave de la auditoría. El backend recibe accountId, no el código.
  const handleNewEntry = async (form) => {
    const lines = form.lines
      .filter(l => l.accountCode)
      .map(l => ({
        accountId: accounts.find(a => a.code === l.accountCode)?.id ?? null,
        debit: parseFloat(l.debit) || 0,
        credit: parseFloat(l.credit) || 0,
      }));
    if (lines.some(l => l.accountId == null)) {
      pushToast?.(t('accounting.unknownAccount', 'Hay renglones con una cuenta que no existe'), 'danger');
      return;
    }
    try {
      const saved = await createJournalEntry({
        periodId: form.periodId ? parseInt(form.periodId) : null,
        entryDate: form.date,
        entryType: 'manual',
        description: form.description,
        reference: form.reference || null,
        lines,
      });
      await reloadEntries();
      setShowNewEntry(false);
      pushToast?.(t('accounting.entryCreated', `Partida #${saved.id} registrada`), 'success');
    } catch (err) {
      // El backend rechaza la partida descuadrada o el período cerrado.
      pushToast?.(t('accounting.entryFailed', 'No se pudo registrar la partida: ') + err.message, 'danger');
    }
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
            <Button icon="plus" variant="accent" onClick={() => setShowNewAccount(true)}>{t('accounting.newAccount', 'Nueva cuenta')}
            </Button>
          )}
          {tab === 'partidas' && (
            <Button icon="plus" variant="accent" onClick={() => setShowNewEntry(true)}>{t('accounting.newEntry', 'Nueva partida')}
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <StatCard
          icon="receipt" tone="pri"
          label={t('accounting.statVouchers', 'Comprobantes (período)')}
          value={entries.length}
          foot={`${entries.filter(e => e.type === 'auto').length} ${t('accounting.automatic', 'automáticas')} · ${entries.filter(e => e.type === 'manual').length} ${t('accounting.manual', 'manuales')}`}
        />
        <StatCard
          icon="cash" tone="ter"
          label={t('accounting.statDebits', 'Total débitos registrados')}
          value={`Q ${(totalAutoDebits / 1000).toFixed(0)}k`}
          foot={t('accounting.automaticEntries', 'Partidas automáticas')}
        />
        <StatCard
          icon="tag" tone="sec"
          label={t('accounting.statAccounts', 'Cuentas en el catálogo')}
          value={accounts.length}
          foot={`${accounts.filter(a => a.allowsEntries).length} ${t('accounting.detailAccounts', 'cuentas de detalle')}`}
        />
        <StatCard
          icon="calendar" tone="err"
          label={t('accounting.statCurrentPeriod', 'Período actual')}
          value={openPeriod?.name || '—'}
          foot={`${periods.filter(p => p.status === 'closed').length} ${t('accounting.closedPeriods', 'períodos cerrados')}`}
        />
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
                    <td className="muted">{t('accounting.levelN', 'Nivel')} {a.level}</td>
                    <td>
                      <span className={`badge-m3 ${a.normalBalance === 'debit' ? 'info' : 'warning'}`}>
                        {a.normalBalance === 'debit' ? t('accounting.debitLabel', 'Débito') : t('accounting.creditLabel', 'Crédito')}
                      </span>
                    </td>
                    <td>
                      {a.allowsEntries
                        ? <span className="badge-m3 success">{t('accounting.detail', 'Detalle')}</span>
                        : <span className="badge-m3 neutral">{t('accounting.grouping', 'Agrupadora')}</span>}
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
          <DataTable
            columns={[
              { key: 'id', header: '#', width: 70, mono: true, sortable: true,
                render: (e) => `#${e.id}` },
              { key: 'date', header: t('common.date', 'Fecha'), mono: true, sortable: true,
                render: (e) => fmtDate(e.date) },
              { key: 'description', header: t('common.description', 'Descripción'), sortable: true },
              { key: 'reference', header: t('common.reference', 'Referencia'), mono: true,
                render: (e) => e.reference || '—' },
              { key: 'type', header: t('common.type', 'Tipo'), sortable: true,
                render: (e) => (
                  <span className={`badge-m3 ${e.type === 'auto' ? 'info' : 'neutral'}`}>
                    {TYPE_LABEL[e.type]}
                  </span>
                ) },
              { key: 'totalDebit', header: t('common.total', 'Total'), align: 'right', sortable: true,
                render: (e) => <span className="num">{fmt(e.totalDebit)}</span> },
              { key: 'status', header: t('common.status', 'Estado'), sortable: true,
                render: (e) => <span className={`badge-m3 ${ENTRY_STATUS[e.status]}`}>{e.status}</span> },
            ]}
            rows={filteredEntries}
            rowKey={(e) => e.id}
            pageSize={15}
            onRowClick={setSelected}
            onRefresh={reloadEntries}
            empty={t('accounting.noEntries', 'Sin partidas')}
            emptyIcon="receipt"
            totals={{ totalDebit: <span className="num">{fmt(filteredEntries.reduce((a, e) => a + Number(e.totalDebit || 0), 0))}</span> }}
          />
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
                  <td style={{ fontWeight: 500 }}>{p.name}</td>
                  <td className="mono muted">{p.startDate}</td>
                  <td className="mono muted">{p.endDate}</td>
                  <td>
                    <span className={`badge-m3 ${PERIOD_STATUS[p.status]}`}>
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
