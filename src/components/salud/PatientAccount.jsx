// Pestaña «Cuenta» del paciente (lo que ve caja): saldo de anticipo,
// paquetes con sus sesiones y los cobros de sus citas. Desde aquí se vende
// un paquete o se recibe un anticipo; ambos se facturan en el turno de caja
// abierto de quien cobra.
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../Button.jsx';
import DataTable from '../DataTable.jsx';
import Autocomplete from '../Autocomplete.jsx';
import { addDeposit, getAccount, listPackages, sellPackage } from '../../api/salud.js';
import { CHARGE_METHODS, PAYMENT_METHODS, Q, packageSummary, parseAmount } from '../../lib/caja.js';
import { gtDate, gtTime } from '../../lib/agenda.js';

const fecha = (iso) => {
  if (!iso) return '';
  const d = String(iso).length > 10 ? gtDate(iso) : String(iso);
  const [a, m, dd] = d.split('-');
  return `${dd}/${m}/${a}`;
};

const PK_BADGE = { activo: 'info', agotado: 'neutral', anulado: 'danger' };
const CR_LABEL = { anticipo: 'Anticipo recibido', aplicado: 'Aplicado a cita', reverso: 'Devuelto (cobro anulado)' };

function PayChips({ value, onChange }) {
  const { t } = useTranslation();
  return (
    <div className="ag-segment" role="radiogroup" aria-label={t('caja.paymentMethod', 'Forma de pago')}>
      {PAYMENT_METHODS.map((p) => (
        <button key={p.id} type="button" role="radio" aria-checked={value === p.id}
          className={`chip${value === p.id ? ' active' : ''}`} onClick={() => onChange(p.id)}>{t(`caja.pay.${p.id}`, p.label)}</button>
      ))}
    </div>
  );
}

export default function PatientAccount({ patientId, canCreate, pushToast }) {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [mode, setMode] = useState(null); // 'package' | 'deposit'
  const [catalogo, setCatalogo] = useState([]);
  const [form, setForm] = useState({ packageId: '', amount: '', paymentMethod: 'efectivo', notes: '' });
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(() => {
    getAccount(patientId)
      .then((d) => setData({ ...d, packages: d?.packages || [], charges: d?.charges || [], credits: d?.credits || [] }))
      .catch((err) => { setData({ creditBalance: 0, packages: [], charges: [], credits: [] }); pushToast?.(err.message, 'danger'); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);
  useEffect(() => { cargar(); }, [cargar]);

  const abrir = (m) => {
    setMode(m);
    setForm({ packageId: '', amount: '', paymentMethod: 'efectivo', notes: '' });
    if (m === 'package') listPackages().then((r) => setCatalogo((r || []).filter((p) => p.active))).catch(() => setCatalogo([]));
  };

  const guardar = async () => {
    setSaving(true);
    try {
      if (mode === 'package') {
        await sellPackage(patientId, { packageId: Number(form.packageId), paymentMethod: form.paymentMethod });
        pushToast?.(t('caja.packageSold', 'Paquete vendido'), 'success');
      } else {
        await addDeposit(patientId, { amount: parseAmount(form.amount), paymentMethod: form.paymentMethod, notes: form.notes.trim() || null });
        pushToast?.(t('caja.depositSaved', 'Anticipo recibido'), 'success');
      }
      setMode(null);
      cargar();
    } catch (err) {
      pushToast?.(err.message, 'danger');
    } finally {
      setSaving(false);
    }
  };

  if (!data) return <div className="empty">{t('common.loading', 'Cargando…')}</div>;
  const elegido = catalogo.find((p) => String(p.id) === String(form.packageId));
  const monto = parseAmount(form.amount);
  const listo = mode === 'package' ? !!form.packageId : monto != null && !Number.isNaN(monto) && monto > 0;

  return (
    <div className="salud-stack">
      <div className="cj-account-head">
        <div>
          <span className="muted">{t('caja.balanceLabel', 'Saldo de anticipo')}</span>
          <div className="cj-balance mono">{Q(data.creditBalance)}</div>
        </div>
        {canCreate && !mode && (
          <div className="salud-inline-actions">
            <Button type="button" variant="ghost" icon="cash" onClick={() => abrir('deposit')}>{t('caja.deposit', 'Recibir anticipo')}</Button>
            <Button type="button" variant="tonal" icon="box" onClick={() => abrir('package')}>{t('caja.sellPackage', 'Vender paquete')}</Button>
          </div>
        )}
      </div>

      {mode && (
        <div className="salud-row">
          <div className="form-grid salud-row-fields ag-grow">
            {mode === 'package' ? (
              <div className="field-group span-2">
                <label className="field-label">{t('caja.package', 'Paquete *')}</label>
                <Autocomplete value={form.packageId} onChange={(id) => setForm((f) => ({ ...f, packageId: id ?? '' }))}
                  options={catalogo.map((p) => ({ id: p.id, name: `${p.name} · ${p.sessions} ses. · ${Q(p.price)}` }))}
                  emptyText={t('caja.noPackages', 'No hay paquetes; créalos en Agenda → Configuración')}
                  aria-label={t('caja.package', 'Paquete *')} />
                {elegido && (
                  <span className="muted salud-help">
                    {t('caja.packageHint', '{{type}} · {{q}} por sesión', { type: elegido.typeName || '', q: Q(elegido.sessionPrice) })}
                    {elegido.validDays ? ` · ${t('caja.validDays', 'vence a los {{n}} días', { n: elegido.validDays })}` : ''}
                  </span>
                )}
              </div>
            ) : (
              <>
                <div className="field-group">
                  <label className="field-label">{t('caja.amount', 'Monto *')}</label>
                  <input className="field-input mono" inputMode="decimal" autoFocus value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} aria-label={t('caja.amount', 'Monto *')} />
                </div>
                <div className="field-group">
                  <label className="field-label">{t('caja.notes', 'Nota')}</label>
                  <input className="field-input" value={form.notes} maxLength={300}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} aria-label={t('caja.notes', 'Nota')} />
                </div>
              </>
            )}
            <div className="field-group span-2">
              <span className="field-label">{t('caja.paymentMethod', 'Forma de pago')}</span>
              <PayChips value={form.paymentMethod} onChange={(v) => setForm((f) => ({ ...f, paymentMethod: v }))} />
            </div>
            <span className="muted salud-help span-2">{t('caja.invoiceHint', 'Se factura ahora en tu turno de caja abierto.')}</span>
          </div>
          <div className="salud-inline-actions">
            <Button type="button" variant="ghost" onClick={() => setMode(null)}>{t('common.cancel', 'Cancelar')}</Button>
            <Button type="button" variant="accent" icon="check" disabled={!listo || saving} onClick={guardar}>
              {mode === 'package'
                ? t('caja.sellFor', 'Vender {{q}}', { q: Q(elegido?.price) })
                : t('caja.receive', 'Recibir {{q}}', { q: Q(listo ? monto : 0) })}
            </Button>
          </div>
        </div>
      )}

      <section>
        <h4 className="cj-section-title">{t('caja.packagesTitle', 'Paquetes')}</h4>
        {data.packages.length === 0 ? (
          <div className="muted">{t('caja.noPatientPackages', 'Sin paquetes.')}</div>
        ) : (
          <ul className="cj-pk-list">
            {data.packages.map((p) => (
              <li key={p.id} className="cj-package">
                <span>
                  <strong>{p.name}</strong>
                  <span className="muted">{packageSummary(p)} · {t('caja.boughtOn', 'comprado el {{d}}', { d: fecha(p.purchasedAt) })}</span>
                </span>
                <span className={`badge-m3 ${PK_BADGE[p.status] || 'neutral'}`}>{t(`caja.pkStatus.${p.status}`, p.status)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h4 className="cj-section-title">{t('caja.chargesTitle', 'Cobros de citas')}</h4>
        <DataTable
          columns={[
            { key: 'when', header: t('caja.cols.appointment', 'Cita'), mono: true, card: 'subtitle',
              render: (c) => (c.appointmentStartsAt ? `${fecha(c.appointmentStartsAt)} ${gtTime(c.appointmentStartsAt)}` : '—') },
            { key: 'typeName', header: t('caja.cols.type', 'Tipo'), card: 'title' },
            { key: 'method', header: t('caja.cols.method', 'Cobro'), card: 'badge',
              render: (c) => (
                <span className="salud-badges">
                  <span className={`badge-m3 ${CHARGE_METHODS[c.method]?.badge || 'neutral'}`}>{t(`caja.method.${c.method}`, CHARGE_METHODS[c.method]?.label || c.method)}</span>
                  {c.status === 'anulado' && <span className="badge-m3 danger">{t('caja.voided', 'Anulado')}</span>}
                </span>
              ) },
            { key: 'total', header: t('caja.total', 'Total'), mono: true, align: 'right',
              render: (c) => (c.method === 'paquete' ? c.packageName || '—' : Q(c.total)) },
            { key: 'sale', header: t('caja.cols.invoice', 'Factura'), mono: true, render: (c) => c.saleNumber || '—' },
          ]}
          rows={data.charges} rowKey={(c) => c.id} density="compact"
          empty={t('caja.noCharges', 'Sin cobros todavía')} emptyIcon="receipt"
        />
      </section>

      {data.credits.length > 0 && (
        <section>
          <h4 className="cj-section-title">{t('caja.creditsTitle', 'Movimientos del anticipo')}</h4>
          <DataTable
            columns={[
              { key: 'createdAt', header: t('caja.cols.date', 'Fecha'), mono: true, card: 'subtitle', render: (m) => fecha(m.createdAt) },
              { key: 'kind', header: t('caja.cols.movement', 'Movimiento'), card: 'title', render: (m) => t(`caja.credit.${m.kind}`, CR_LABEL[m.kind] || m.kind) },
              { key: 'amount', header: t('caja.cols.amount', 'Monto'), mono: true, align: 'right', render: (m) => Q(m.amount) },
              { key: 'notes', header: t('caja.notes', 'Nota'), render: (m) => m.notes || '—' },
            ]}
            rows={data.credits} rowKey={(m) => m.id} density="compact" />
        </section>
      )}
    </div>
  );
}
