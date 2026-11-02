// Cobro de una cita. Ofrece lo que tiene el paciente: un paquete que sirve
// para este tipo de cita (descuenta una sesión), su saldo de anticipo, o
// facturar en la caja abierta de quien cobra. La cortesía no cobra pero pide
// motivo. Si la cita ya está cobrada, muestra el cobro y permite anularlo.
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../Button.jsx';
import Icon from '../Icon.jsx';
import { chargeAppointment, getChargeOptions, voidCharge } from '../../api/salud.js';
import {
  CHARGE_METHODS, PAYMENT_METHODS, Q, chargeErrors, chargePayload, initialCharge, packageSummary, parseAmount, split,
} from '../../lib/caja.js';

function Linea({ label, value, strong }) {
  return (
    <div className={`cj-line${strong ? ' is-strong' : ''}`}>
      <span>{label}</span>
      <span className="mono">{value}</span>
    </div>
  );
}

/** Lo cobrado: método, montos, factura o paquete. */
export function ChargeSummary({ charge: c }) {
  const { t } = useTranslation();
  const m = CHARGE_METHODS[c.method] || {};
  return (
    <div className="cj-summary">
      <div className="salud-badges">
        <span className={`badge-m3 ${m.badge || 'neutral'}`}>{t(`caja.method.${c.method}`, m.label || c.method)}</span>
        {c.status === 'anulado' && <span className="badge-m3 danger">{t('caja.voided', 'Anulado')}</span>}
      </div>
      {c.method === 'paquete' ? (
        <Linea label={t('caja.packageUsed', 'Sesión del paquete')} value={c.packageName || '—'} />
      ) : (
        <>
          <Linea label={t('caja.price', 'Precio')} value={Q(c.price)} />
          {Number(c.discount) > 0 && <Linea label={t('caja.discount', 'Descuento')} value={`− ${Q(c.discount)}`} />}
          {Number(c.creditAmount) > 0 && <Linea label={t('caja.fromCredit', 'Del anticipo')} value={Q(c.creditAmount)} />}
          {Number(c.cashAmount) > 0 && <Linea label={t('caja.invoiced', 'Facturado')} value={Q(c.cashAmount)} />}
          <Linea label={t('caja.total', 'Total')} value={Q(c.total)} strong />
        </>
      )}
      {c.saleNumber && <div className="muted">{t('caja.invoice', 'Factura {{n}}', { n: c.saleNumber })}{c.paymentMethod ? ` · ${c.paymentMethod}` : ''}</div>}
      {c.notes && <div className="muted">{c.notes}</div>}
      {c.voidReason && <div className="muted">{t('caja.voidReason', 'Motivo de anulación: {{r}}', { r: c.voidReason })}</div>}
    </div>
  );
}

export default function ChargeDialog({ appointmentId, canVoid = false, canCourtesy = false, onDone, onClose, pushToast }) {
  const { t } = useTranslation();
  const [opts, setOpts] = useState(null);
  const [f, setF] = useState(null);
  const [saving, setSaving] = useState(false);
  const [anular, setAnular] = useState(null); // motivo en edición

  const cargar = () => getChargeOptions(appointmentId)
    .then((o) => { setOpts({ ...o, packages: o?.packages || [] }); setF(initialCharge({ ...o, packages: o?.packages || [] })); })
    .catch((err) => { pushToast?.(err.message, 'danger'); onClose(); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { cargar(); }, [appointmentId]);

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const cobrar = async () => {
    const errs = chargeErrors(f, opts);
    if (errs.length) { pushToast?.(errs[0], 'info'); return; }
    setSaving(true);
    try {
      const c = await chargeAppointment(appointmentId, chargePayload(f));
      pushToast?.(t('caja.charged', 'Cita cobrada'), 'success');
      onDone?.(c);
    } catch (err) {
      pushToast?.(err.message, 'danger');
    } finally {
      setSaving(false);
    }
  };

  const confirmarAnulacion = async () => {
    setSaving(true);
    try {
      const r = await voidCharge(opts.charge.id, anular.trim());
      pushToast?.(r?.warning || t('caja.voidedOk', 'Cobro anulado'), r?.warning ? 'info' : 'success');
      onDone?.(r?.charge);
    } catch (err) {
      pushToast?.(err.message, 'danger');
    } finally {
      setSaving(false);
    }
  };

  const modos = opts ? [
    ...(opts.packages.length ? [{ id: 'paquete', label: t('caja.mode.package', 'Paquete') }] : []),
    { id: 'venta', label: t('caja.mode.sale', 'Cobrar') },
    ...(canCourtesy ? [{ id: 'cortesia', label: t('caja.mode.courtesy', 'Cortesía') }] : []),
  ] : [];
  const precio = f ? parseAmount(f.price) : null;
  const descuento = f ? parseAmount(f.discount) : null;
  const r = f && f.mode === 'venta' && precio != null && !Number.isNaN(precio)
    ? split(precio, Number.isNaN(descuento) ? 0 : descuento ?? 0, opts.creditBalance, f.useCredit) : null;
  const errores = f ? chargeErrors(f, opts) : [];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t('caja.title', 'Cobro de la cita')}>
        <div className="modal-head">
          <h3>{t('caja.title', 'Cobro de la cita')}</h3>
          <button className="icon-btn" type="button" onClick={onClose} aria-label={t('common.close', 'Cerrar')}><Icon name="close" /></button>
        </div>
        {!opts || !f ? (
          <div className="modal-body"><div className="empty">{t('common.loading', 'Cargando…')}</div></div>
        ) : (
          <>
            <div className="modal-body salud-stack">
              <div className="cj-head">
                <strong>{opts.patientName}</strong>
                <span className="muted">{opts.typeName}{opts.price != null ? ` · ${Q(opts.price)}` : ''}</span>
                {Number(opts.creditBalance) > 0 && (
                  <span className="badge-m3 info">{t('caja.balance', 'Saldo a favor {{q}}', { q: Q(opts.creditBalance) })}</span>
                )}
              </div>

              {opts.charge ? (
                <>
                  <ChargeSummary charge={opts.charge} />
                  {canVoid && anular == null && (
                    <Button type="button" variant="ghost" icon="x" onClick={() => setAnular('')}>{t('caja.void', 'Anular cobro')}</Button>
                  )}
                  {anular != null && (
                    <div className="field-group">
                      <label className="field-label">{t('caja.voidReasonLabel', 'Motivo de la anulación *')}</label>
                      <input className="field-input" autoFocus value={anular} maxLength={300} onChange={(e) => setAnular(e.target.value)}
                        aria-label={t('caja.voidReasonLabel', 'Motivo de la anulación *')} />
                      <span className="muted salud-help">
                        {opts.charge.saleId
                          ? t('caja.voidInvoiceHint', 'La factura no se anula aquí: emite la nota de crédito en Facturación.')
                          : t('caja.voidHint', 'Se devuelve la sesión del paquete o el anticipo aplicado.')}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="ag-segment" role="radiogroup" aria-label={t('caja.howTo', 'Cómo se cobra')}>
                    {modos.map((m) => (
                      <button key={m.id} type="button" role="radio" aria-checked={f.mode === m.id}
                        className={`chip${f.mode === m.id ? ' active' : ''}`} onClick={() => set('mode', m.id)}>{m.label}</button>
                    ))}
                  </div>

                  {f.mode === 'paquete' && (
                    <div className="cj-packages" role="radiogroup" aria-label={t('caja.packages', 'Paquetes del paciente')}>
                      {opts.packages.map((p) => (
                        <label key={p.id} className={`cj-package${String(f.patientPackageId) === String(p.id) ? ' is-active' : ''}`}>
                          <input type="radio" name="pk" checked={String(f.patientPackageId) === String(p.id)}
                            onChange={() => set('patientPackageId', p.id)} />
                          <span>
                            <strong>{p.name}</strong>
                            <span className="muted">{packageSummary(p)}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  )}

                  {f.mode === 'venta' && (
                    <div className="form-grid">
                      <div className="field-group">
                        <label className="field-label">{t('caja.price', 'Precio')}</label>
                        <input className="field-input mono" inputMode="decimal" value={f.price} onChange={(e) => set('price', e.target.value)}
                          aria-label={t('caja.price', 'Precio')} />
                      </div>
                      <div className="field-group">
                        <label className="field-label">{t('caja.discount', 'Descuento')}</label>
                        <input className="field-input mono" inputMode="decimal" value={f.discount} placeholder="0.00"
                          onChange={(e) => set('discount', e.target.value)} aria-label={t('caja.discount', 'Descuento')} />
                      </div>
                      {Number(opts.creditBalance) > 0 && (
                        <label className="salud-check span-2">
                          <input type="checkbox" checked={f.useCredit} onChange={(e) => set('useCredit', e.target.checked)} />
                          {t('caja.useCredit', 'Usar el anticipo ({{q}} disponible)', { q: Q(opts.creditBalance) })}
                        </label>
                      )}
                      {r?.cash > 0 && (
                        <div className="field-group span-2">
                          <span className="field-label">{t('caja.paymentMethod', 'Forma de pago')}</span>
                          <div className="ag-segment" role="radiogroup" aria-label={t('caja.paymentMethod', 'Forma de pago')}>
                            {PAYMENT_METHODS.map((p) => (
                              <button key={p.id} type="button" role="radio" aria-checked={f.paymentMethod === p.id}
                                className={`chip${f.paymentMethod === p.id ? ' active' : ''}`} onClick={() => set('paymentMethod', p.id)}>
                                {t(`caja.pay.${p.id}`, p.label)}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {r && (
                        <div className="cj-summary span-2">
                          {r.credit > 0 && <Linea label={t('caja.fromCredit', 'Del anticipo')} value={Q(r.credit)} />}
                          <Linea label={t('caja.toInvoice', 'A facturar')} value={Q(r.cash)} />
                          <Linea label={t('caja.total', 'Total')} value={Q(r.total)} strong />
                        </div>
                      )}
                    </div>
                  )}

                  {f.mode === 'cortesia' && (
                    <div className="field-group">
                      <label className="field-label">{t('caja.courtesyReason', 'Motivo de la cortesía *')}</label>
                      <input className="field-input" value={f.notes} maxLength={300} onChange={(e) => set('notes', e.target.value)}
                        aria-label={t('caja.courtesyReason', 'Motivo de la cortesía *')} />
                    </div>
                  )}

                  {f.mode === 'venta' && !opts.cashRegisterOpen && r?.cash > 0 && (
                    <div className="alert" role="note">
                      <Icon name="info" size={16} />
                      <span>{t('caja.noRegister', 'No tienes un turno de caja abierto. Ábrelo en Caja y Cortes para facturar.')}</span>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="modal-foot">
              <Button type="button" variant="ghost" onClick={onClose}>{t('common.close', 'Cerrar')}</Button>
              {opts.charge ? (
                anular != null && (
                  <Button type="button" variant="danger" icon="x" disabled={saving || !anular.trim()} onClick={confirmarAnulacion}>
                    {t('caja.void', 'Anular cobro')}
                  </Button>
                )
              ) : (
                <Button type="button" variant="accent" icon={f.mode === 'paquete' ? 'check' : 'cash'} disabled={saving || errores.length > 0}
                  title={errores[0]} onClick={cobrar}>
                  {f.mode === 'paquete' ? t('caja.usePackage', 'Descontar sesión')
                    : f.mode === 'cortesia' ? t('caja.registerCourtesy', 'Registrar cortesía')
                      : r?.cash > 0 ? t('caja.chargeAmount', 'Cobrar {{q}}', { q: Q(r.cash) }) : t('caja.applyCredit', 'Aplicar anticipo')}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
