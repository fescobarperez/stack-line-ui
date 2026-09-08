// Stackline — Proyectos
//
// Proyecto central: seguimiento de rentabilidad, materiales y cotizaciones ancladas.
//
//   Contratado    lo vendido, congelado al convertir la cotización
//   Ejecutado     costo real ya incurrido
//   Comprometido  pedido y aún sin facturar (capa 3)
//   Cobrado       adelantos y pagos recibidos (capa 5)
//
// El margen proyectado descuenta lo comprometido: con una sola cifra de gasto
// el sobrecosto se ve cuando ya ocurrió.
import React, { useEffect, useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import InlineCreate from '../components/InlineCreate.jsx';
import DataTable from '../components/DataTable.jsx';
import StatCard from '../components/StatCard.jsx';
import { useProjects, useAging, useBankAccounts } from '../hooks/useOperations.js';
import { useAccounts } from '../hooks/useAccounting.js';
import { getProject, createProject, addProjectCost, deleteProjectCost, setProjectStatus } from '../api/projects.js';
import { createPayment } from '../api/receivables.js';
import { createSale } from '../api/pos.js';
import { printReceipt } from '../lib/receipt.js';
import { consumeMaterial } from '../api/projects.js';
import ProjectMaterialsPanel from '../components/ProjectMaterialsPanel.jsx';
import QuoteBuilderModal from '../components/QuoteBuilderModal.jsx';
import { useProducts } from '../hooks/useCatalog.js';
import { useBranches, useClients } from '../hooks/useMasters.js';
import { createClient } from '../api/partners.js';
import useAuthorization from '../hooks/useAuthorization.js';
import AuthorizationDialog from '../components/AuthorizationDialog.jsx';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const Q = (n) => `Q ${Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const aggregateCost = (project) => Number(project.executed || 0) + Number(project.materialsCost || 0);
const aggregateMargin = (project) => Number(project.contracted || 0) - aggregateCost(project);

// Debe coincidir con BANK_METHODS de PaymentService.
const NEEDS_BANK = new Set(['transferencia', 'deposito']);
// Métodos que entran a una cuenta de caja (no a un banco). El cheque se trata
// como caja: está en la gaveta hasta que se deposite.
const CASH_METHODS = new Set(['efectivo', 'cheque']);
// Una cuenta de caja/activo donde puede entrar el efectivo: cuenta de detalle
// con saldo normal débito.
const isCashAccount = (a) => a.allowsEntries && a.normalBalance === 'debit';

const STATUS = {
  draft:     { label: 'Borrador',  variant: 'neutral' },
  open:      { label: 'Abierto',   variant: 'success' },
  closed:    { label: 'Cerrado',   variant: 'neutral' },
  cancelled: { label: 'Cancelado', variant: 'danger'  },
};

const SOURCES = {
  purchase: { label: 'Compra',        icon: 'truck'    },
  material: { label: 'Materia prima', icon: 'box'      },
  labor:    { label: 'Mano de obra',  icon: 'users'    },
  other:    { label: 'Otro',          icon: 'receipt'  },
};

// ── Modal: cargo manual al proyecto ─────────────────────────────────────────
function CostModal({ project, onDone, onClose, pushToast }) {
  const { t } = useTranslation();
  const { require: requireAuth, prompt: authPrompt } = useAuthorization();
  const [form, setForm] = useState({ source: 'labor', amount: '', description: '', costDate: '' });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!(amount > 0)) { pushToast?.(t('projects.amountRequired', 'Indica un monto mayor a cero'), 'danger'); return; }
    setBusy(true);
    try {
      const auth = await authorizeIfNeeded(requireAuth, project, amount);
      if (!auth.granted) {
        pushToast?.(auth.pending
          ? t('projects.authPending', 'Cargo enviado a autorización')
          : t('projects.authDenied', 'Cargo no autorizado'), 'danger');
        return;
      }
      await addProjectCost(project.id, {
        source: form.source, amount,
        description: form.description.trim() || null,
        costDate: form.costDate || null,
        authorizationId: auth.id,
      });
      pushToast?.(t('projects.costAdded', 'Cargo registrado'), 'success');
      onDone();
    } catch (err) {
      pushToast?.(err.message, 'danger');
    } finally { setBusy(false); }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 600 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{t('projects.addCost', 'Registrar cargo')}</h3>
          <Button variant="ghost" iconOnly icon="x" onClick={onClose} />
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            <div className="field-row">
              <div className="field">
                <label className="field-label">{t('projects.source', 'Origen')}</label>
                <select className="field-input" value={form.source} onChange={(e) => set('source', e.target.value)}>
                  {Object.entries(SOURCES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="field-label">{t('projects.amount', 'Monto')} *</label>
                <input className="field-input mono" type="number" min="0" step="0.01" autoFocus
                  value={form.amount} onChange={(e) => set('amount', e.target.value)} />
              </div>
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label className="field-label">{t('common.description', 'Descripción')}</label>
              <input className="field-input" value={form.description}
                onChange={(e) => set('description', e.target.value)} />
            </div>
            {/* La fecha sola ocupa media fila: un input de tipo date estirado a
                todo el ancho del diálogo se ve peor que uno a la mitad. */}
            <div className="field-row" style={{ marginBottom: 0 }}>
              <div className="field">
                <label className="field-label">{t('projects.costDate', 'Fecha')}</label>
                <input className="field-input" type="date" value={form.costDate}
                  onChange={(e) => set('costDate', e.target.value)} />
              </div>
            </div>
          </div>
          <div className="modal-foot">
            <Button type="button" onClick={onClose}>{t('common.cancel', 'Cancelar')}</Button>
            <Button icon="check" variant="accent" type="submit" disabled={busy}>
              {t('common.save', 'Guardar')}
            </Button>
          </div>
        </form>
      </div>
      <AuthorizationDialog prompt={authPrompt} />
    </div>
  );
}

/**
 * Pide autorización si el cargo llevaría el proyecto sobre el umbral.
 * El porcentaje se calcula igual que en el backend (ejecutado + nuevo sobre
 * contratado); el motor decide si hace falta y de qué nivel.
 */
async function authorizeIfNeeded(requireAuth, project, amount) {
  const contracted = Number(project.contracted || 0);
  if (!(contracted > 0) || !(amount > 0)) return { granted: true, id: null };
  const pct = ((Number(project.executed || 0) + amount) / contracted) * 100;
  const auth = await requireAuth({
    type: 'project_overrun',
    amount, currency: project.currency, percent: Number(pct.toFixed(3)),
    payload: { projectId: project.id, code: project.code, amount },
    reference: project.code,
  });
  return auth;
}

// ── Modal: consumo de materia prima ─────────────────────────────────────────
// El costo se toma del promedio de bodega en el momento del consumo, no de la
// compra: si se imputara la compra, el primer proyecto cargaría con el lote
// entero y los siguientes consumirían gratis.
function ConsumeModal({ project, onDone, onClose, pushToast }) {
  const { t } = useTranslation();
  const { require: requireAuth, prompt: authPrompt } = useAuthorization();
  const { items: materials } = useProducts({ itemType: 'raw_material' });
  const { items: branches } = useBranches();
  const [form, setForm] = useState({ productId: '', branchId: '', quantity: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const chosen = materials.find((m) => String(m.id) === String(form.productId));
  const unitCost = chosen ? Number(chosen.avgCost || chosen.cost || 0) : 0;
  const estimate = unitCost * (parseFloat(form.quantity) || 0);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.productId || !form.branchId) {
      pushToast?.(t('projects.pickMaterial', 'Elige el material y la sucursal'), 'danger'); return;
    }
    setBusy(true);
    try {
      const auth = await authorizeIfNeeded(requireAuth, project, estimate);
      if (!auth.granted) {
        pushToast?.(auth.pending
          ? t('projects.authPending', 'Consumo enviado a autorización')
          : t('projects.authDenied', 'Consumo no autorizado'), 'danger');
        return;
      }
      await consumeMaterial(project.id, {
        productId: Number(form.productId),
        branchId: Number(form.branchId),
        quantity: parseFloat(form.quantity),
        notes: form.notes || null,
        authorizationId: auth.id,
      });
      pushToast?.(t('projects.consumed', 'Consumo registrado'), 'success');
      onDone();
    } catch (err) {
      // El backend rechaza si no hay existencias suficientes.
      pushToast?.(err.message, 'danger');
    } finally { setBusy(false); }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 600 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{t('projects.consumeMaterial', 'Consumir materia prima')}</h3>
          <Button variant="ghost" iconOnly icon="x" onClick={onClose} />
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {materials.length === 0 && (
              <div className="alert" style={{ marginBottom: 12 }}>
                <Icon name="alert" size={16} />
                {t('projects.noMaterials', 'No hay artículos marcados como materia prima en Inventario.')}
              </div>
            )}
            <div className="field" style={{ marginBottom: 12 }}>
              <label className="field-label">{t('projects.material', 'Material')} *</label>
              <select className="field-input" value={form.productId}
                onChange={(e) => set('productId', e.target.value)}>
                <option value="">{t('common.select', 'Seleccionar…')}</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>{m.sku} · {m.name}</option>
                ))}
              </select>
            </div>
            {/* El material se queda a lo ancho: la opción es "SKU · nombre" y
                a media fila se corta. Bodega y cantidad sí caben en pareja. */}
            <div className="field-row">
              <div className="field">
                <label className="field-label">{t('common.branch', 'Bodega / sucursal')} *</label>
                <select className="field-input" value={form.branchId}
                  onChange={(e) => set('branchId', e.target.value)}>
                  <option value="">{t('common.select', 'Seleccionar…')}</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="field-label">{t('projects.quantity', 'Cantidad')} *</label>
                <input className="field-input mono" type="number" min="0" step="0.001"
                  value={form.quantity} onChange={(e) => set('quantity', e.target.value)} />
              </div>
            </div>
            {chosen && (
              <div className="detail-row" style={{ marginBottom: 12 }}>
                <span className="detail-label">{t('projects.estimatedCost', 'Costo estimado')}</span>
                <span className="mono">{Q(estimate)} <span className="muted">({Q(unitCost)} / {chosen.unit})</span></span>
              </div>
            )}
            <div className="field">
              <label className="field-label">{t('common.notes', 'Notas')}</label>
              <input className="field-input" value={form.notes}
                onChange={(e) => set('notes', e.target.value)} />
            </div>
          </div>
          <div className="modal-foot">
            <Button type="button" onClick={onClose}>{t('common.cancel', 'Cancelar')}</Button>
            <Button icon="check" variant="accent" type="submit" disabled={busy || !materials.length}>
              {t('common.save', 'Guardar')}
            </Button>
          </div>
        </form>
      </div>
      <AuthorizationDialog prompt={authPrompt} />
    </div>
  );
}

// ── Modal: cobro del cliente ────────────────────────────────────────────────
// Sin modalidad impuesta: adelanto antes de empezar, cobros por avance o uno
// solo al final. El sistema registra y muestra el pendiente; la disciplina la
// pone el usuario.
/**
 * Se abre solo cuando el backend rechaza el cierre por costo sin facturar.
 * No se pide la justificación de entrada: en el caso normal —todo facturado—
 * cerrar es un clic y no hay nada que justificar.
 */
function CloseNoteModal({ reason, onConfirm, onClose }) {
  const { t } = useTranslation();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { await onConfirm(note.trim()); } finally { setBusy(false); }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{t('projects.closeAnyway', 'Cerrar con costo sin facturar')}</h3>
          <Button variant="ghost" iconOnly icon="x" onClick={onClose} />
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            <p className="body-small" style={{ margin: '0 0 14px', color: 'var(--muted)' }}>{reason}</p>
            <div className="field">
              <label className="field-label">{t('projects.closeNote', 'Justificación')} *</label>
              <textarea className="field-input" rows={3} autoFocus value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('projects.closeNotePh', 'Garantía absorbida, descuento pactado…')} />
            </div>
          </div>
          <div className="modal-foot">
            <Button variant="ghost" type="button" onClick={onClose}>{t('common.cancel', 'Cancelar')}</Button>
            <Button variant="accent" type="submit" disabled={busy || !note.trim()}>
              {t('projects.close', 'Cerrar proyecto')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Emite un documento contra el proyecto.
 *
 * Va aquí y no en el POS a propósito: facturar un avance es trabajo de
 * oficina, casi siempre a crédito, y no debería exigir una caja abierta.
 * El backend lo permite desde la 048 —el turno solo es obligatorio si hay
 * dinero de por medio—.
 *
 * El renglón es un servicio con el monto libre: se le factura al cliente lo
 * contratado, no los materiales que se gastaron.
 */
function InvoiceModal({ project, onDone, onClose, pushToast }) {
  const { t } = useTranslation();
  const pending = Number(project.pendingToInvoice) || 0;
  const [form, setForm] = useState({
    amount: pending > 0 ? String(pending) : '',
    credit: true,
    concept: '',
  });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const amount = parseFloat(form.amount);
  const excess = amount > 0 && amount > pending;

  const submit = async (e) => {
    e.preventDefault();
    if (!(amount > 0)) {
      pushToast?.(t('projects.amountRequired', 'Indica un monto mayor a cero'), 'danger');
      return;
    }
    setBusy(true);
    try {
      await createSale({
        clientId: project.clientId,
        projectId: project.id,
        credit: form.credit,
        paymentMethod: form.credit ? 'credito' : 'efectivo',
        items: [{
          productId: null,
          quantity: 1,
          unitPrice: amount,
          concept: form.concept.trim()
            || `${project.code} — ${t('projects.progressBilling', 'avance de proyecto')}`,
        }],
      });
      pushToast?.(t('projects.invoiced', 'Documento emitido'), 'success');
      onDone();
    } catch (err) {
      pushToast?.(err.message, 'danger');
    } finally { setBusy(false); }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 600 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{t('projects.invoice', 'Facturar proyecto')}</h3>
          <Button variant="ghost" iconOnly icon="x" onClick={onClose} />
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            <div className="detail-row" style={{ marginBottom: 12 }}>
              <span className="detail-label">{t('projects.pendingToInvoice', 'Pendiente de facturar')}</span>
              <span className="mono">{Q(project.pendingToInvoice)}</span>
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label className="field-label">{t('projects.amount', 'Monto')} *</label>
              <input className="field-input mono" type="number" min="0" step="0.01" autoFocus
                value={form.amount} onChange={(e) => set('amount', e.target.value)} />
              {excess && (
                <span className="body-small" style={{ color: 'var(--danger)' }}>
                  {t('projects.overbill', 'Excede lo contratado; puede requerir autorización')}
                </span>
              )}
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label className="field-label">{t('projects.concept', 'Concepto')}</label>
              <input className="field-input" value={form.concept}
                onChange={(e) => set('concept', e.target.value)}
                placeholder={`${project.code} — ${t('projects.progressBilling', 'avance de proyecto')}`} />
            </div>
            {/* A crédito por defecto: si el dinero entra ahora, el cobro se
                registra aparte y con su propio recibo. */}
            <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={form.credit}
                onChange={(e) => set('credit', e.target.checked)} />
              {t('projects.onCredit', 'A crédito (genera cuenta por cobrar)')}
            </label>
          </div>
          <div className="modal-foot">
            <Button variant="ghost" type="button" onClick={onClose}>{t('common.cancel', 'Cancelar')}</Button>
            <Button variant="accent" type="submit" disabled={busy}>
              {t('projects.emit', 'Emitir')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PaymentModal({ project, onDone, onClose, pushToast }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    amount: '', method: 'efectivo', reference: '', paymentDate: '',
    bankAccountId: '', cashAccountId: '', saleId: '',
  });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const { items: BANK_ACCOUNTS } = useBankAccounts();
  const { items: ACCOUNTS } = useAccounts();
  const CASH_ACCOUNTS = (ACCOUNTS || []).filter(isCashAccount);

  // Autoselección de la caja: preferimos la cuenta 110101 (Caja) si existe, si
  // no la primera cuenta de detalle de activo. Así el flujo funciona sin que el
  // usuario tenga que elegir, pero deja cambiarla.
  useEffect(() => {
    if (!CASH_METHODS.has(form.method)) return;
    if (form.cashAccountId) return;
    if (!CASH_ACCOUNTS.length) return;
    const preferida = CASH_ACCOUNTS.find((a) => a.code === '110101') || CASH_ACCOUNTS[0];
    set('cashAccountId', String(preferida.id));
  }, [form.method, form.cashAccountId, CASH_ACCOUNTS]);

  // Documentos abiertos de este cliente. Aplicar el cobro a uno hace que baje
  // la antigüedad de ese documento; dejarlo "a cuenta" baja el saldo del
  // cliente pero no señala cuál factura se está pagando.
  const { data: aging } = useAging();
  const openDocs = ((aging?.invoices) || []).filter((i) => i.clientId === project.clientId);

  const submit = async (e) => {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!(amount > 0)) { pushToast?.(t('projects.amountRequired', 'Indica un monto mayor a cero'), 'danger'); return; }
    setBusy(true);
    try {
      // Es un cobro del cliente además de un cobro del proyecto: aparece en CxC
      // y descuenta su saldo, igual que cualquier otro pago.
      await createPayment({
        clientId: project.clientId,
        projectId: project.id,
        saleId: form.saleId ? Number(form.saleId) : null,
        amount,
        paymentDate: form.paymentDate || new Date().toISOString().slice(0, 10),
        method: form.method,
        reference: form.reference || null,
        bankAccountId: form.bankAccountId ? Number(form.bankAccountId) : null,
        cashAccountId: form.cashAccountId ? Number(form.cashAccountId) : null,
      });
      pushToast?.(t('projects.paymentAdded', 'Cobro registrado'), 'success');
      onDone();
    } catch (err) {
      pushToast?.(err.message, 'danger');
    } finally { setBusy(false); }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 600 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{t('projects.addPayment', 'Registrar cobro')}</h3>
          <Button variant="ghost" iconOnly icon="x" onClick={onClose} />
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            <div className="detail-row" style={{ marginBottom: 12 }}>
              <span className="detail-label">{t('projects.pendingToCollect', 'Pendiente de cobrar')}</span>
              <span className="mono">{Q(project.pendingToCollect)}</span>
            </div>
            <div className="field-row">
              <div className="field">
                <label className="field-label">{t('projects.amount', 'Monto')} *</label>
                <input className="field-input mono" type="number" min="0" step="0.01" autoFocus
                  value={form.amount} onChange={(e) => set('amount', e.target.value)} />
              </div>
              <div className="field">
                <label className="field-label">{t('projects.method', 'Método')}</label>
                <select className="field-input" value={form.method} onChange={(e) => set('method', e.target.value)}>
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="deposito">Depósito</option>
                  <option value="cheque">Cheque</option>
                  <option value="tarjeta">Tarjeta</option>
                </select>
              </div>
            </div>
            {/* El backend exige la cuenta en transferencia y depósito: sin ella
                el cobro baja CxC pero no aparece en ningún extracto. */}
            {NEEDS_BANK.has(form.method) && (
              <div className="field" style={{ marginBottom: 12 }}>
                <label className="field-label">{t('projects.bankAccount', 'Cuenta bancaria')} *</label>
                <select className="field-input" value={form.bankAccountId}
                  onChange={(e) => set('bankAccountId', e.target.value)}>
                  <option value="">{t('common.select', 'Seleccionar…')}</option>
                  {BANK_ACCOUNTS.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.bankName || a.accountCode} · {a.accountNumber || a.alias} ({a.currency})
                    </option>
                  ))}
                </select>
              </div>
            )}
            {/* Efectivo y cheque entran a una cuenta de caja. Elegir cuál es lo
                que resuelve el error 'posting.cash' sin ir a Configuración: la
                cuenta elegida es contra la que se asienta el débito del cobro. */}
            {CASH_METHODS.has(form.method) && (
              <div className="field" style={{ marginBottom: 12 }}>
                <label className="field-label">{t('projects.cashAccount', 'Cuenta de caja')}</label>
                {CASH_ACCOUNTS.length > 0 ? (
                  <select className="field-input" value={form.cashAccountId}
                    onChange={(e) => set('cashAccountId', e.target.value)}>
                    {CASH_ACCOUNTS.map((a) => (
                      <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
                    ))}
                  </select>
                ) : (
                  <div className="field-hint" style={{ color: 'var(--danger)' }}>
                    {t('projects.noCashAccount', 'No hay cuentas de caja de detalle. Crea una cuenta de activo (débito) en Contabilidad.')}
                  </div>
                )}
              </div>
            )}
            {/* Aplicar a un documento hace que baje la antigüedad de ESA
                factura. Sin documento el cobro queda a cuenta: baja el saldo
                del cliente pero no dice cuál factura se está pagando. */}
            {openDocs.length > 0 && (
              <div className="field" style={{ marginBottom: 12 }}>
                <label className="field-label">{t('projects.applyTo', 'Aplicar a documento')}</label>
                <select className="field-input" value={form.saleId}
                  onChange={(e) => set('saleId', e.target.value)}>
                  <option value="">{t('projects.onAccount', 'A cuenta (sin documento)')}</option>
                  {openDocs.map((d) => (
                    <option key={d.saleId} value={d.saleId}>
                      {d.docNumber} · pendiente {Q(d.outstanding)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="field-row" style={{ marginBottom: 0 }}>
              <div className="field">
                <label className="field-label">{t('projects.reference', 'Referencia')}</label>
                <input className="field-input" value={form.reference}
                  onChange={(e) => set('reference', e.target.value)} />
              </div>
              <div className="field">
                <label className="field-label">{t('common.date', 'Fecha')}</label>
                <input className="field-input" type="date" value={form.paymentDate}
                  onChange={(e) => set('paymentDate', e.target.value)} />
              </div>
            </div>
          </div>
          <div className="modal-foot">
            <Button type="button" onClick={onClose}>{t('common.cancel', 'Cancelar')}</Button>
            <Button icon="check" variant="accent" type="submit" disabled={busy}>
              {t('common.save', 'Guardar')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateClientInline({ onCreated, onCancel, pushToast }) {
  const [form, setForm] = useState({ name: '', nit: 'CF', phone: '' });
  const [busy, setBusy] = useState(false);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) {
      pushToast?.('Indica el nombre del cliente', 'danger');
      return;
    }
    setBusy(true);
    try {
      const created = await createClient({
        name: form.name.trim(), nit: form.nit.trim() || 'CF', clientType: 'CF',
        phone: form.phone.trim() || null, address: null, email: null,
        creditLimit: 0, paymentTerms: 0, status: 'active',
      });
      if (!created?.id) throw new Error('El cliente fue creado, pero la respuesta no devolvió su identificador');
      onCreated({ ...created, name: created.name || form.name.trim(), nit: created.nit || form.nit.trim() || 'CF' });
    } catch (error) {
      pushToast?.(`No se pudo crear el cliente: ${error.message}`, 'danger');
    } finally { setBusy(false); }
  };

  return (
    <InlineCreate title="Crear cliente" onSubmit={submit} onCancel={onCancel} busy={busy} submitLabel="Guardar cliente">
      <div className="field-row">
        <div className="field"><label>Nombre *</label><input autoFocus value={form.name} onChange={(event) => set('name', event.target.value)} placeholder="Ej. Pérez y Asociados" /></div>
        <div className="field"><label>NIT</label><input className="mono" value={form.nit} onChange={(event) => set('nit', event.target.value)} placeholder="CF" /></div>
      </div>
      <div className="field" style={{ marginTop: 10 }}><label>Teléfono</label><input value={form.phone} onChange={(event) => set('phone', event.target.value)} /></div>
    </InlineCreate>
  );
}

function CreateProjectModal({ clients, onDone, onClose, pushToast }) {
  const [form, setForm] = useState({ name: '', clientId: '' });
  const [availableClients, setAvailableClients] = useState(clients);
  const [creatingClient, setCreatingClient] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setAvailableClients(clients); }, [clients]);

  const submit = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.clientId) {
      pushToast?.('Indica el nombre del proyecto y el cliente', 'danger');
      return;
    }
    setBusy(true);
    try {
      await createProject({ name: form.name.trim(), clientId: Number(form.clientId), startDate: new Date().toISOString().slice(0, 10) });
      pushToast?.('Proyecto creado', 'success');
      onDone();
    } catch (error) { pushToast?.(error.message, 'danger'); }
    finally { setBusy(false); }
  };

  const handleClientCreated = (client) => {
    setAvailableClients((current) => [client, ...current.filter((item) => item.id !== client.id)]);
    setForm((current) => ({ ...current, clientId: String(client.id) }));
    setCreatingClient(false);
    pushToast?.('Cliente creado y seleccionado', 'success');
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={(event) => event.stopPropagation()}>
        <div className="modal-head"><h3>Nuevo proyecto</h3><Button variant="ghost" iconOnly icon="x" onClick={onClose} /></div>
        <form onSubmit={submit}>
          <div className="modal-body">
            <div className="field" style={{ marginBottom: 12 }}><label>Nombre del proyecto *</label><input autoFocus value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ej. Cocina Casa Pérez" /></div>
            <div className="field-row" style={{ alignItems: 'flex-end' }}>
              <div className="field" style={{ flex: 1 }}><label>Cliente *</label><select value={form.clientId} onChange={(event) => setForm((current) => ({ ...current, clientId: event.target.value }))}><option value="">Seleccionar cliente…</option>{availableClients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></div>
              <Button type="button" size="sm" icon="plus" onClick={() => setCreatingClient((current) => !current)}>{creatingClient ? 'Cerrar' : 'Crear cliente'}</Button>
            </div>
            {creatingClient && <CreateClientInline onCreated={handleClientCreated} onCancel={() => setCreatingClient(false)} pushToast={pushToast} />}
            <div className="cfg-hint" style={{ marginTop: 10 }}>Después podrás agregar materiales y crear una o varias cotizaciones desde este proyecto.</div>
          </div>
          <div className="modal-foot"><Button type="button" onClick={onClose}>Cancelar</Button><Button variant="accent" type="submit" disabled={busy || creatingClient}>Crear proyecto</Button></div>
        </form>
      </div>
    </div>
  );
}

// ── Drawer: detalle y costos ────────────────────────────────────────────────
function ProjectDrawer({ project, onClose, onChanged, pushToast }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [costModal, setCostModal] = useState(false);
  const [payModal, setPayModal] = useState(false);
  const [consumeModal, setConsumeModal] = useState(false);
  const [quoteBuilder, setQuoteBuilder] = useState(false);
  const [materialsCost, setMaterialsCost] = useState(0);
  const [materialsLoading, setMaterialsLoading] = useState(true);
  const st = STATUS[project.status] || { label: project.status, variant: 'neutral' };
  const materialTotal = materialsCost > 0 ? materialsCost : Number(project.materialsCost || 0);
  const executedTotal = Number(project.executed || 0) + materialTotal;
  const contractedTotal = Number(project.contracted || 0);
  const invoicedTotal = Number(project.invoiced || 0);
  const marginTotal = contractedTotal - executedTotal;
  const projectedMarginTotal = marginTotal - Number(project.committed || 0);
  const marginPctTotal = contractedTotal > 0 ? (marginTotal / contractedTotal) * 100 : 0;
  const executedNotInvoicedTotal = Math.max(executedTotal - invoicedTotal, 0);
  const totalSpinner = <span className="material-total-spinner" role="status" aria-label="Calculando materiales" />;
  const overrun = !materialsLoading && marginTotal < 0;

  const removeCost = async (costId) => {
    try {
      await deleteProjectCost(project.id, costId);
      onChanged();
    } catch (err) { pushToast?.(err.message, 'danger'); }
  };

  const [closeBlocked, setCloseBlocked] = useState(null);
  const [invoiceModal, setInvoiceModal] = useState(false);

  // Se puede facturar mientras quede saldo del contrato. La condición es el
  // pendiente y no "¿ya hay alguna factura?": con anticipo más avances hay
  // varias facturas contra el mismo proyecto y todas son legítimas. Cuando se
  // facturó el total —que es el caso de una sola factura por el contrato
  // completo— el pendiente llega a cero y el botón desaparece solo.
  //
  // Un proyecto sin monto contratado no tiene techo contra el cual medir, así
  // que ahí se deja disponible; el backend tampoco le aplica umbral.
  const materialsCostRowId = 'project-materials-total';
  const costRows = useMemo(() => {
    const actualCosts = (project.costs || []).filter((cost) => cost.id !== materialsCostRowId);
    if (!(materialsCost > 0)) return actualCosts;
    return [{
      id: materialsCostRowId,
      source: 'material',
      description: 'Materiales',
      costDate: '—',
      amount: materialsCost,
      isMaterialsTotal: true,
    }, ...actualCosts];
  }, [materialsCost, project.costs]);
  const costTotal = costRows.reduce((sum, cost) => sum + Number(cost.amount || 0), 0);

  const contracted = Number(project.contracted) || 0;
  const canInvoice = contracted <= 0 || (Number(project.pendingToInvoice) || 0) > 0;

  // Se intenta cerrar en seco. El backend es quien sabe si falta facturar
  // —tiene los cargos y las ventas—, así que no se replica esa cuenta aquí:
  // se pide la justificación solo cuando él la exige.
  const closeProject = async () => {
    try {
      await setProjectStatus(project.id, 'closed');
      pushToast?.(t('projects.statusChanged', 'Estado actualizado'), 'success');
      onChanged();
    } catch (err) {
      if (/sin facturar/i.test(err.message || '')) setCloseBlocked(err.message);
      else pushToast?.(err.message, 'danger');
    }
  };

  const changeStatus = async (status, note) => {
    try {
      await setProjectStatus(project.id, status, note);
      pushToast?.(t('projects.statusChanged', 'Estado actualizado'), 'success');
      onChanged();
    } catch (err) { pushToast?.(err.message, 'danger'); }
  };

  return (
    <div className="drawer-overlay" onClick={onClose}>
      {/* Ancho holgado: cuatro tarjetas de KPI a 640px salen a ~140px cada una,
          demasiado estrecho para el contenedor del icono más la cifra. */}
      <div className="drawer" style={{ width: 'min(960px, 94vw)' }} onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <div className="drawer-title">{project.code} · {project.name}</div>
            <div className="body-small muted">
              {project.clientName}
              {project.quoteNumber ? ` · ${t('projects.fromQuote', 'de')} ${project.quoteNumber}` : ''}
            </div>
          </div>
          <span className={`badge-m3 ${st.variant}`}>{st.label}</span>
        </div>

        <div className="drawer-body">
          {overrun ? (
            <div className="alert" style={{ marginBottom: 16 }}>
              <Icon name="alert" size={18} />
              {t('projects.overrun', 'El costo ejecutado supera lo contratado: el proyecto va en pérdida.')}
            </div>
          ) : !materialsLoading && projectedMarginTotal < 0 && (
            // Todavía en positivo, pero lo ya pedido se lo come: es el aviso que
            // llega a tiempo, cuando aún se puede cancelar una orden.
            <div className="alert" style={{ marginBottom: 16 }}>
              <Icon name="alert" size={18} />
              {t('projects.projectedOverrun', 'Con lo comprometido el proyecto quedaría en pérdida.')}
            </div>
          )}

          <div className="stat-grid" style={{ marginBottom: 16 }}>
            <StatCard icon="receipt" tone="pri"
              label={t('projects.contracted', 'Contratado')} value={Q(project.contracted)} />
            {/* El costo sin facturar va al pie y no en tarjeta propia: es un
                calificador de lo ejecutado, y ya son seis tarjetas en la fila.
                Solo aparece cuando hay algo que avisar. */}
            <StatCard icon="cash" tone="ter"
              label={t('projects.executed', 'Ejecutado')} value={materialsLoading ? totalSpinner : Q(executedTotal)}
              foot={materialsLoading
                ? <span className="muted">Calculando materiales…</span>
                : executedNotInvoicedTotal > 0
                  ? <span style={{ color: 'var(--danger)' }}>
                      {Q(executedNotInvoicedTotal)} {t('projects.notInvoiced', 'sin facturar')}
                    </span>
                  : undefined} />
            <StatCard icon="truck" tone="sec"
              label={t('projects.committed', 'Comprometido')} value={Q(project.committed)}
              foot={t('projects.committedFoot', 'Pedido a proveedores')} />
            <StatCard icon="chart" tone={overrun ? 'err' : 'sec'}
              label={t('projects.margin', 'Margen')} value={materialsLoading ? totalSpinner : Q(marginTotal)}
              valueColor={overrun ? 'var(--danger)' : 'var(--success)'}
              foot={materialsLoading
                ? <span className="muted">Calculando materiales…</span>
                : `${marginPctTotal.toFixed(1)} % · ${t('projects.projected', 'proyectado')} ${Q(projectedMarginTotal)}`} />
            <StatCard icon="receipt" tone="pri"
              label={t('projects.invoiced', 'Facturado')} value={Q(project.invoiced)}
              foot={`${t('projects.pendingToInvoice', 'Por facturar')}: ${Q(project.pendingToInvoice)}`} />
            <StatCard icon="card" tone="err"
              label={t('projects.collected', 'Cobrado')} value={Q(project.collected)}
              foot={`${t('projects.pendingToCollect', 'Por cobrar')}: ${Q(project.pendingToCollect)}`} />
          </div>

          <ProjectMaterialsPanel project={project} pushToast={pushToast} onMaterialsTotalChange={setMaterialsCost} onMaterialsLoadingChange={setMaterialsLoading} />

          <DataTable
            title={t('projects.quotes', 'Cotizaciones asociadas')}
            columns={[
              { key: 'docNumber', header: t('projects.quote', 'Cotización'), sortable: true,
                render: (q) => <strong>{q.docNumber}</strong> },
              { key: 'status', header: t('common.status', 'Estado'), sortable: true,
                render: (q) => {
                  const cls = STATUS[q.status]?.variant || 'neutral';
                  const label = STATUS[q.status]?.label || q.status;
                  return <span className={`badge-m3 ${cls}`}>{label}</span>;
                } },
              { key: 'included', header: t('projects.included', 'En agregado'), align: 'center',
                render: (q) => q.included ? <Icon name="check" size={15} /> : <span className="muted">—</span> },
              { key: 'operatingCost', header: t('projects.operatingCosts', 'Costos'), align: 'right',
                render: (q) => <span className="num">{Q(q.operatingCost)}</span> },
              { key: 'profitAmount', header: t('projects.profit', 'Ganancia'), align: 'right',
                render: (q) => <span className="num" style={{ color: 'var(--success)' }}>{Q(q.profitAmount)}</span> },
              { key: 'subtotal', header: t('quotes.subtotalNoIva', 'Subtotal'), align: 'right', sortable: true,
                render: (q) => <span className="num">{Q(q.subtotal)}</span> },
              { key: 'tax', header: t('common.iva', 'IVA'), align: 'right',
                render: (q) => <span className="num muted">{Q(q.tax)}</span> },
              { key: 'total', header: t('common.total', 'Total'), align: 'right', sortable: true,
                render: (q) => <span className="num" style={{ fontWeight: 600 }}>{Q(q.total)}</span> },
              { key: 'actions', header: '', align: 'right',
                render: (q) => (
                  <Button size="sm" variant="ghost" icon="eye"
                    onClick={(e) => { e.stopPropagation(); navigate('/quotes', { state: { openQuoteId: q.quoteId } }); }}>
                    {t('projects.viewQuote', 'Ver cotización')}
                  </Button>
                ) },
            ]}
            rows={project.quotes || []}
            rowKey={(q) => q.quoteId}
            density="compact"
            empty={t('projects.noQuotes', 'Este proyecto aún no tiene cotizaciones. Créalas desde la pantalla de Cotizaciones eligiendo este proyecto.')}
            emptyIcon="receipt"
          />

          {/* Gastos derivados: por cada cotización, materiales + cargos. */}
          <DataTable
            title={t('projects.operatingCosts', 'Costos operativos')}
            columns={[
              { key: 'quote', header: t('projects.quote', 'Cotización'),
                render: (r) => r.quoteDoc ? <span className="badge-m3 info">{r.quoteDoc}</span> : '' },
              { key: 'concept', header: t('common.description', 'Concepto'),
                render: (r) => r.kind === 'materials'
                  ? <span className="badge-m3"><Icon name="box" size={13} /> {t('quotes.materials', 'Materiales')}</span>
                  : <span>{r.description}{r.category ? <span className="muted"> · {r.category}</span> : ''}</span> },
              { key: 'calc', header: t('quotes.chargeCalc', 'Cálculo'),
                render: (r) => r.kind === 'materials'
                  ? <span className="muted">{t('quotes.derived', 'derivado')}</span>
                  : (r.calcType === 'percent' ? <span className="muted">%</span> : <span className="muted">{t('quotes.fixed', 'fijo')}</span>) },
              { key: 'amount', header: t('projects.amount', 'Monto'), align: 'right',
                render: (r) => <span className="num">{Q(r.amount)}</span> },
            ]}
            rows={(project.quotes || []).flatMap((q) => {
              const rows = [];
              if (Number(q.materialsCost || 0) !== 0) rows.push({ id: `m-${q.quoteId}`, quoteDoc: q.docNumber, kind: 'materials', amount: q.materialsCost });
              (q.charges || []).forEach((c, i) => rows.push({ id: `c-${q.quoteId}-${i}`, quoteDoc: rows.length ? '' : q.docNumber, kind: 'charge', description: c.description, category: c.category, calcType: c.calcType, amount: c.computedAmount }));
              return rows;
            })}
            rowKey={(r) => r.id}
            density="compact"
            empty={t('projects.noOperatingCosts', 'Sin costos operativos. Se derivan de los materiales y cargos de las cotizaciones del proyecto.')}
            emptyIcon="cash"
            totals={{ amount: <span className="num">{Q((project.quotes || []).reduce((s, q) => s + Number(q.expenseTotal || 0), 0))}</span> }}
          />

          <DataTable
            title={t('projects.payments', 'Cobros')}
            columns={[
              { key: 'receiptNumber', header: t('cxc.receipt', 'Recibo'), sortable: true,
                render: (x) => <span className="mono">{x.receiptNumber || '—'}</span> },
              { key: 'paymentDate', header: t('common.date', 'Fecha'), sortable: true },
              { key: 'method', header: t('projects.method', 'Método'), sortable: true,
                render: (x) => <span className="badge-m3">{x.method || '—'}</span> },
              { key: 'quoteId', header: t('projects.quote', 'Cotización'), sortable: true,
                render: (x) => {
                  if (!x.quoteId) return <span className="muted">—</span>;
                  const q = (project.quotes || []).find((qq) => qq.quoteId === x.quoteId);
                  return <span className="badge-m3 info">{q ? q.docNumber : `COT-${x.quoteId}`}</span>;
                } },
              { key: 'reference', header: t('projects.reference', 'Referencia'),
                render: (x) => x.reference || '—' },
              { key: 'amount', header: t('projects.amount', 'Monto'), align: 'right', sortable: true,
                render: (x) => <span className="num">{Q(x.amount)}</span> },
            ]}
            actions={(x) => (
              <Button variant="icon" icon="print"
                title={t('cxc.printReceipt', 'Imprimir recibo')}
                onClick={() => printReceipt({ ...x, clientName: project.clientName })} />
            )}
            rows={project.payments || []}
            rowKey={(x) => x.id}
            density="compact"
            empty={t('projects.noPayments', 'Sin cobros registrados')}
            emptyIcon="card"
            totals={{ amount: <span className="num">{Q(project.collected)}</span> }}
            toolbar={project.status === 'open' && (
              <Button size="sm" icon="cash" variant="accent" onClick={() => setPayModal(true)}>
                {t('projects.addPayment', 'Registrar cobro')}
              </Button>
            )}
          />
        </div>

        <div className="drawer-foot">
          <Button onClick={onClose}>{t('common.close', 'Cerrar')}</Button>
          <Button icon="receipt" onClick={() => setQuoteBuilder(true)}>
            Nueva cotización
          </Button>
          {project.status === 'draft' && (
            <>
              <Button variant="danger" onClick={() => changeStatus('cancelled')}>
                {t('projects.cancel', 'Cancelar proyecto')}
              </Button>
              <Button icon="check" variant="accent" onClick={() => changeStatus('open')}>
                {t('projects.approve', 'Aprobar proyecto')}
              </Button>
            </>
          )}
          {project.status === 'open' && (
            <>
              <Button variant="danger" onClick={() => changeStatus('cancelled')}>
                {t('projects.cancel', 'Cancelar proyecto')}
              </Button>
              {canInvoice && (
                <Button icon="receipt" onClick={() => setInvoiceModal(true)}>
                  {t('projects.invoice', 'Facturar')}
                </Button>
              )}
              <Button icon="check" variant="accent" onClick={closeProject}>
                {t('projects.close', 'Cerrar proyecto')}
              </Button>
            </>
          )}
        </div>

        {invoiceModal && (
          <InvoiceModal project={project} pushToast={pushToast}
            onDone={() => { setInvoiceModal(false); onChanged(); }}
            onClose={() => setInvoiceModal(false)} />
        )}

        {closeBlocked && (
          <CloseNoteModal reason={closeBlocked}
            onClose={() => setCloseBlocked(null)}
            onConfirm={async (note) => {
              await changeStatus('closed', note);
              setCloseBlocked(null);
            }} />
        )}

        {costModal && (
          <CostModal project={project} pushToast={pushToast}
            onDone={() => { setCostModal(false); onChanged(); }}
            onClose={() => setCostModal(false)} />
        )}
        {payModal && (
          <PaymentModal project={project} pushToast={pushToast}
            onDone={() => { setPayModal(false); onChanged(); }}
            onClose={() => setPayModal(false)} />
        )}
        {consumeModal && (
          <ConsumeModal project={project} pushToast={pushToast}
            onDone={() => { setConsumeModal(false); onChanged(); }}
            onClose={() => setConsumeModal(false)} />
        )}
        {quoteBuilder && (
          <QuoteBuilderModal project={project} pushToast={pushToast}
            onCreated={() => { setQuoteBuilder(false); onChanged(); }}
            onClose={() => setQuoteBuilder(false)} />
        )}
      </div>
    </div>
  );
}

export default function Projects({ pushToast }) {
  const { t } = useTranslation();
  const { items: projects, reload } = useProjects();
  const { items: clients } = useClients();
  const [selected, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const open = async (row) => {
    try { setSelected(await getProject(row.id)); }
    catch (err) { pushToast?.(err.message, 'danger'); }
  };

  // Abrir un proyecto concreto al llegar desde "Ir al proyecto" en la cotización.
  useEffect(() => {
    const openId = location.state?.openProjectId;
    if (!openId) return;
    getProject(openId).then(setSelected).catch(() => {});
    navigate(location.pathname, { replace: true, state: null });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);
  const refresh = async () => {
    await reload();
    if (selected) { try { setSelected(await getProject(selected.id)); } catch { setSelected(null); } }
  };

  const totals = useMemo(() => projects.reduce((a, p) => ({
    contracted: a.contracted + Number(p.contracted || 0),
    executed:   a.executed   + aggregateCost(p),
    margin:     a.margin     + aggregateMargin(p),
    open:       a.open + (p.status === 'open' ? 1 : 0),
  }), { contracted: 0, executed: 0, margin: 0, open: 0 }), [projects]);

  const columns = [
    { key: 'code', header: t('projects.code', 'Código'), mono: true, sortable: true, width: 110 },
    { key: 'name', header: t('common.name', 'Proyecto'), sortable: true },
    { key: 'clientName', header: t('common.client', 'Cliente'), sortable: true,
      render: (p) => p.clientName || '—' },
    { key: 'quoteCount', header: t('projects.quotes', 'Cotizaciones'), align: 'center', sortable: true,
      render: (p) => Number(p.quoteCount || 0) > 0
        ? <span className="badge-m3 info">{p.quoteCount}</span>
        : <span className="muted">—</span> },
    { key: 'contracted', header: t('projects.contracted', 'Contratado'), align: 'right', sortable: true,
      render: (p) => <span className="num">{Q(p.contracted)}</span> },
    { key: 'executed', header: t('projects.executed', 'Ejecutado'), align: 'right', sortable: true,
      render: (p) => <span className="num">{Q(aggregateCost(p))}</span> },
    { key: 'margin', header: t('projects.margin', 'Margen'), align: 'right', sortable: true,
      render: (p) => (
        <span className="num" style={{ color: aggregateMargin(p) < 0 ? 'var(--danger)' : 'var(--success)' }}>
          {Q(aggregateMargin(p))} · {Number(p.contracted || 0) > 0 ? ((aggregateMargin(p) / Number(p.contracted)) * 100).toFixed(1) : '0.0'}%
        </span>
      ) },
    { key: 'status', header: t('common.status', 'Estado'),
      render: (p) => {
        const st = STATUS[p.status] || { label: p.status, variant: 'neutral' };
        return <span className={`badge-m3 ${st.variant}`}>{st.label}</span>;
      } },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('projects.title', 'Proyectos')}</h1>
          <div className="page-subtitle">
            {t('projects.subtitle', 'Entidad central: materiales, cotizaciones, compras y rentabilidad por trabajo.')}
          </div>
        </div>
        <div className="page-head-actions"><Button icon="plus" variant="accent" onClick={() => setShowCreate(true)}>Nuevo proyecto</Button></div>
      </div>

      <div className="stat-grid">
        <StatCard icon="box" tone="pri"
          label={t('projects.openCount', 'Proyectos abiertos')} value={totals.open}
          foot={`${projects.length} ${t('projects.inTotal', 'en total')}`} />
        <StatCard icon="receipt" tone="ter"
          label={t('projects.contracted', 'Contratado')} value={Q(totals.contracted)} />
        <StatCard icon="cash" tone="sec"
          label={t('projects.executed', 'Ejecutado')} value={Q(totals.executed)} />
        <StatCard icon="chart" tone="err"
          label={t('projects.margin', 'Margen acumulado')} value={Q(totals.margin)}
          valueColor={totals.margin < 0 ? 'var(--danger)' : 'var(--success)'} />
      </div>

      <DataTable
        title={t('projects.list', 'Proyectos')}
        columns={columns}
        rows={projects}
        rowKey={(p) => p.id}
        pageSize={12}
        onRowClick={open}
        onRefresh={reload}
        empty={t('projects.empty', 'Sin proyectos. Crea el primero para organizar materiales y cotizaciones.')}
        emptyIcon="box"
      />

      {showCreate && <CreateProjectModal clients={clients} pushToast={pushToast} onDone={async () => { setShowCreate(false); await reload(); }} onClose={() => setShowCreate(false)} />}

      {selected && (
        <ProjectDrawer project={selected} pushToast={pushToast}
          onChanged={refresh} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
