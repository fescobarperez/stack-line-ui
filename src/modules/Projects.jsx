// Stackline — Proyectos
//
// Seguimiento de rentabilidad por trabajo. Un proyecto nace de una cotización
// aprobada y va acumulando costos; lo que importa no es una cifra sino cuatro:
//
//   Contratado    lo vendido, congelado al convertir la cotización
//   Ejecutado     costo real ya incurrido
//   Comprometido  pedido y aún sin facturar (capa 3)
//   Cobrado       adelantos y pagos recibidos (capa 5)
//
// El margen proyectado descuenta lo comprometido: con una sola cifra de gasto
// el sobrecosto se ve cuando ya ocurrió.
import React, { useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import DataTable from '../components/DataTable.jsx';
import StatCard from '../components/StatCard.jsx';
import { useProjects } from '../hooks/useOperations.js';
import { getProject, addProjectCost, deleteProjectCost, setProjectStatus } from '../api/projects.js';
import { createPayment } from '../api/receivables.js';
import { createSale } from '../api/pos.js';
import { consumeMaterial } from '../api/projects.js';
import { useProducts } from '../hooks/useCatalog.js';
import { useBranches } from '../hooks/useMasters.js';
import useAuthorization from '../hooks/useAuthorization.js';
import AuthorizationDialog from '../components/AuthorizationDialog.jsx';
import { useTranslation } from 'react-i18next';

const Q = (n) => `Q ${Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
  const [form, setForm] = useState({ amount: '', method: 'efectivo', reference: '', paymentDate: '' });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

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
        amount,
        paymentDate: form.paymentDate || new Date().toISOString().slice(0, 10),
        method: form.method,
        reference: form.reference || null,
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
                  <option value="cheque">Cheque</option>
                  <option value="tarjeta">Tarjeta</option>
                </select>
              </div>
            </div>
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

// ── Drawer: detalle y costos ────────────────────────────────────────────────
function ProjectDrawer({ project, onClose, onChanged, pushToast }) {
  const { t } = useTranslation();
  const [costModal, setCostModal] = useState(false);
  const [payModal, setPayModal] = useState(false);
  const [consumeModal, setConsumeModal] = useState(false);
  const st = STATUS[project.status] || { label: project.status, variant: 'neutral' };
  const overrun = project.margin < 0;

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
          ) : project.projectedMargin < 0 && (
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
              label={t('projects.executed', 'Ejecutado')} value={Q(project.executed)}
              foot={project.executedNotInvoiced > 0
                ? <span style={{ color: 'var(--danger)' }}>
                    {Q(project.executedNotInvoiced)} {t('projects.notInvoiced', 'sin facturar')}
                  </span>
                : undefined} />
            <StatCard icon="truck" tone="sec"
              label={t('projects.committed', 'Comprometido')} value={Q(project.committed)}
              foot={t('projects.committedFoot', 'Pedido a proveedores')} />
            <StatCard icon="chart" tone={overrun ? 'err' : 'sec'}
              label={t('projects.margin', 'Margen')} value={Q(project.margin)}
              valueColor={overrun ? 'var(--danger)' : 'var(--success)'}
              foot={`${Number(project.marginPct || 0).toFixed(1)} % · ${t('projects.projected', 'proyectado')} ${Q(project.projectedMargin)}`} />
            <StatCard icon="receipt" tone="pri"
              label={t('projects.invoiced', 'Facturado')} value={Q(project.invoiced)}
              foot={`${t('projects.pendingToInvoice', 'Por facturar')}: ${Q(project.pendingToInvoice)}`} />
            <StatCard icon="card" tone="err"
              label={t('projects.collected', 'Cobrado')} value={Q(project.collected)}
              foot={`${t('projects.pendingToCollect', 'Por cobrar')}: ${Q(project.pendingToCollect)}`} />
          </div>

          <DataTable
            title={t('projects.costs', 'Cargos')}
            columns={[
              { key: 'source', header: t('projects.source', 'Origen'), sortable: true,
                render: (c) => {
                  const src = SOURCES[c.source] || SOURCES.other;
                  return <span className="badge-m3"><Icon name={src.icon} size={14} />{src.label}</span>;
                } },
              { key: 'description', header: t('common.description', 'Descripción'),
                render: (c) => c.description || '—' },
              { key: 'costDate', header: t('common.date', 'Fecha'), sortable: true },
              { key: 'amount', header: t('projects.amount', 'Monto'), align: 'right', sortable: true,
                render: (c) => <span className="num">{Q(c.amount)}</span> },
            ]}
            rows={project.costs || []}
            rowKey={(c) => c.id}
            density="compact"
            empty={t('projects.noCosts', 'Sin cargos todavía')}
            emptyIcon="receipt"
            totals={{ amount: <span className="num">{Q(project.executed)}</span> }}
            toolbar={project.status === 'open' && (
              <>
                <Button size="sm" icon="box" onClick={() => setConsumeModal(true)}>
                  {t('projects.consumeMaterial', 'Consumir material')}
                </Button>
                <Button size="sm" icon="plus" variant="accent" onClick={() => setCostModal(true)}>
                  {t('projects.addCost', 'Registrar cargo')}
                </Button>
              </>
            )}
            onDelete={project.status === 'open' ? (c) => removeCost(c.id) : undefined}
          />

          <DataTable
            title={t('projects.payments', 'Cobros')}
            columns={[
              { key: 'paymentDate', header: t('common.date', 'Fecha'), sortable: true },
              { key: 'method', header: t('projects.method', 'Método'), sortable: true,
                render: (x) => <span className="badge-m3">{x.method || '—'}</span> },
              { key: 'reference', header: t('projects.reference', 'Referencia'),
                render: (x) => x.reference || '—' },
              { key: 'amount', header: t('projects.amount', 'Monto'), align: 'right', sortable: true,
                render: (x) => <span className="num">{Q(x.amount)}</span> },
            ]}
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
      </div>
    </div>
  );
}

export default function Projects({ pushToast }) {
  const { t } = useTranslation();
  const { items: projects, reload } = useProjects();
  const [selected, setSelected] = useState(null);

  const open = async (row) => {
    try { setSelected(await getProject(row.id)); }
    catch (err) { pushToast?.(err.message, 'danger'); }
  };
  const refresh = async () => {
    await reload();
    if (selected) { try { setSelected(await getProject(selected.id)); } catch { setSelected(null); } }
  };

  const totals = useMemo(() => projects.reduce((a, p) => ({
    contracted: a.contracted + Number(p.contracted || 0),
    executed:   a.executed   + Number(p.executed   || 0),
    margin:     a.margin     + Number(p.margin     || 0),
    open:       a.open + (p.status === 'open' ? 1 : 0),
  }), { contracted: 0, executed: 0, margin: 0, open: 0 }), [projects]);

  const columns = [
    { key: 'code', header: t('projects.code', 'Código'), mono: true, sortable: true, width: 110 },
    { key: 'name', header: t('common.name', 'Proyecto'), sortable: true },
    { key: 'clientName', header: t('common.client', 'Cliente'), sortable: true,
      render: (p) => p.clientName || '—' },
    { key: 'contracted', header: t('projects.contracted', 'Contratado'), align: 'right', sortable: true,
      render: (p) => <span className="num">{Q(p.contracted)}</span> },
    { key: 'executed', header: t('projects.executed', 'Ejecutado'), align: 'right', sortable: true,
      render: (p) => <span className="num">{Q(p.executed)}</span> },
    { key: 'margin', header: t('projects.margin', 'Margen'), align: 'right', sortable: true,
      render: (p) => (
        <span className="num" style={{ color: p.margin < 0 ? 'var(--danger)' : 'var(--success)' }}>
          {Q(p.margin)} · {Number(p.marginPct || 0).toFixed(1)}%
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
            {t('projects.subtitle', 'Rentabilidad por trabajo. Se crean desde una cotización aprobada.')}
          </div>
        </div>
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
        empty={t('projects.empty', 'Sin proyectos. Convierte una cotización aprobada para crear el primero.')}
        emptyIcon="box"
      />

      {selected && (
        <ProjectDrawer project={selected} pushToast={pushToast}
          onChanged={refresh} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
