// Solicitudes de cambio del cliente sobre una cotización que ya tomó un
// vendedor. El asistente las registra (no toca la cotización); aquí el
// vendedor responde cada una —aceptar, ajustar, rechazar o responder— y
// pulsa «Aplicar»: el ERP aplica lo aceptado, recalcula y le avisa al cliente
// con un mensaje de formato fijo que detalla qué se aplicó y qué no.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from './Button.jsx';
import { listQuoteChangeRequests, applyQuoteChangeRequests, listChangeRequestReasons } from '../api/wave2.js';

const TIPO = {
  agregar: 'Agregar', quitar: 'Quitar', cantidad: 'Cantidad', descuento: 'Descuento',
  condiciones: 'Condiciones', otro: 'Otro', consulta: 'Consulta',
};
const tipo = (t, kind) => (TIPO[kind] ? t(`changeRequests.kind.${kind}`, TIPO[kind]) : kind);

/**
 * Fuera de React (funciones puras y sus tests) no hay `t`: se usa el texto en
 * español con las variables {{x}} resueltas, igual que haría i18next.
 */
const sinTraducir = (key, def, vars) => String(def).replace(/\{\{(\w+)\}\}/g, (_, x) => vars?.[x] ?? '');
// Con 'otro' (sin explicación propia) el comentario es lo que lee el cliente.
const MIN_COMENTARIO_OTRO = 15;
const ESTADO = {
  pendiente: { label: 'Pendiente', clase: 'warning' },
  aplicada: { label: 'Aplicada', clase: 'success' },
  ajustada: { label: 'Ajustada', clase: 'info' },
  rechazada: { label: 'Rechazada', clase: 'danger' },
  respondida: { label: 'Respondida', clase: 'neutral' },
};
const estado = (t, status) => (ESTADO[status] ? t(`changeRequests.status.${status}`, ESTADO[status].label) : status);
// Lo que cambia la cotización admite aceptar/ajustar; lo que es pregunta, responder.
const CAMBIA_LINEAS = new Set(['agregar', 'quitar', 'cantidad', 'descuento']);

const DECISION = { aceptar: 'Aceptar', ajustar: 'Ajustar', rechazar: 'Rechazar', responder: 'Responder' };

function opciones(kind, t) {
  const op = (v) => [v, t(`changeRequests.decision.${v}`, DECISION[v])];
  if (kind === 'consulta') return [op('responder')];
  if (!CAMBIA_LINEAS.has(kind)) return [op('responder'), op('rechazar')];
  if (kind === 'quitar') return [op('aceptar'), op('rechazar')];
  return [op('aceptar'), op('ajustar'), op('rechazar')];
}

/**
 * Lo que falta para poder aplicar esa decisión, o null si está completa.
 * `motivos` es el catálogo: rechazar y ajustar exigen un motivo, y el motivo
 * sin explicación propia ('otro') exige un comentario que la sustituya.
 */
export function faltante(s, d, motivos = [], t = sinTraducir) {
  if (!d?.decision) return null; // sin decisión: se queda pendiente, no bloquea
  const texto = (d.response || '').trim();
  if (d.decision === 'responder' && !texto) return t('changeRequests.missing.response', 'Escribe la respuesta para el cliente');
  if (d.decision === 'rechazar' || d.decision === 'ajustar') {
    const motivo = motivos.find((m) => m.code === d.reasonCode);
    if (!motivo) {
      return d.decision === 'rechazar'
        ? t('changeRequests.missing.rejectReason', 'Elige el motivo del rechazo')
        : t('changeRequests.missing.adjustReason', 'Elige el motivo del ajuste');
    }
    if (!motivo.clientText && texto.length < MIN_COMENTARIO_OTRO) {
      return t('changeRequests.missing.explain', 'Explica el motivo al cliente (al menos {{min}} caracteres)', { min: MIN_COMENTARIO_OTRO });
    }
  }
  if (d.decision === 'ajustar') {
    if (s.kind === 'descuento' && !(Number(d.adjustedDiscountPct) >= 0 && d.adjustedDiscountPct !== '')) {
      return t('changeRequests.missing.discount', 'Indica el descuento ajustado');
    }
    if ((s.kind === 'agregar' || s.kind === 'cantidad') && !(Number(d.adjustedQuantity) > 0)) {
      return t('changeRequests.missing.quantity', 'Indica la cantidad ajustada');
    }
  }
  return null;
}

export default function QuoteChangeRequestsPanel({ quote, pushToast, onApplied }) {
  const { t } = useTranslation();
  const quoteId = quote.backendId;
  const [solicitudes, setSolicitudes] = useState(null);
  const [motivos, setMotivos] = useState([]);
  const [decisiones, setDecisiones] = useState({});
  const [aplicando, setAplicando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setSolicitudes(await listQuoteChangeRequests(quoteId));
    } catch (err) {
      setSolicitudes([]);
      pushToast?.(t('changeRequests.loadFailed', 'No se pudieron cargar las solicitudes: ') + err.message, 'danger');
    }
  }, [quoteId, pushToast, t]);

  useEffect(() => { setDecisiones({}); cargar(); }, [cargar]);
  useEffect(() => {
    listChangeRequestReasons(quoteId).then((r) => setMotivos(r || [])).catch(() => setMotivos([]));
  }, [quoteId]);

  const pendientes = useMemo(() => (solicitudes || []).filter((s) => s.status === 'pendiente'), [solicitudes]);
  const resueltas = useMemo(() => (solicitudes || []).filter((s) => s.status !== 'pendiente'), [solicitudes]);
  const setD = (id, k, v) => setDecisiones((prev) => ({ ...prev, [id]: { ...prev[id], [k]: v } }));

  const elegidas = pendientes.filter((s) => decisiones[s.id]?.decision);
  const problemas = elegidas.map((s) => faltante(s, decisiones[s.id], motivos, t)).filter(Boolean);
  const porId = useMemo(() => Object.fromEntries((solicitudes || []).map((s) => [s.id, s])), [solicitudes]);
  const editable = !['prospecto', 'abierta'].includes(quote.status);

  const aplicar = async () => {
    if (elegidas.length === 0 || problemas.length > 0) return;
    setAplicando(true);
    try {
      const r = await applyQuoteChangeRequests(quoteId, {
        decisions: elegidas.map((s) => {
          const d = decisiones[s.id];
          return {
            id: s.id,
            decision: d.decision,
            response: (d.response || '').trim() || null,
            reasonCode: d.decision === 'rechazar' || d.decision === 'ajustar' ? d.reasonCode : null,
            adjustedQuantity: d.decision === 'ajustar' && d.adjustedQuantity !== undefined && d.adjustedQuantity !== '' ? Number(d.adjustedQuantity) : null,
            adjustedDiscountPct: d.decision === 'ajustar' && d.adjustedDiscountPct !== undefined && d.adjustedDiscountPct !== '' ? Number(d.adjustedDiscountPct) : null,
          };
        }),
      });
      setSolicitudes(r.requests || []);
      setDecisiones({});
      pushToast?.(r.clientNotified
        ? t('changeRequests.appliedNotified', 'Cambios aplicados; se le avisará al cliente.')
        : t('changeRequests.applied', 'Cambios aplicados.'), 'success');
      onApplied?.(r.quote);
    } catch (err) {
      pushToast?.(t('changeRequests.applyFailed', 'No se pudieron aplicar: ') + err.message, 'danger');
    } finally {
      setAplicando(false);
    }
  };

  if (solicitudes === null) return <div className="muted" style={{ padding: 16 }}>{t('changeRequests.loading', 'Cargando solicitudes…')}</div>;
  if (solicitudes.length === 0) {
    return <div className="muted" style={{ padding: 16 }}>{t('changeRequests.empty', 'El cliente no ha pedido cambios en esta cotización.')}</div>;
  }

  return (
    <div className="quote-change-requests" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {pendientes.length > 0 && (
        <section>
          <div style={{ fontWeight: 500, marginBottom: 8 }}>{t('changeRequests.pending', 'Pendientes ({{count}})', { count: pendientes.length })}</div>
          {pendientes.map((s) => {
            const d = decisiones[s.id] || {};
            const problema = faltante(s, d, motivos, t);
            const motivoElegido = motivos.find((m) => m.code === d.reasonCode);
            const padre = s.parentId ? porId[s.parentId] : null;
            return (
              <div key={s.id} className="card" data-testid={`solicitud-${s.id}`}
                   style={{ padding: 12, marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <span className="badge-m3 neutral" style={{ marginRight: 8 }}>{tipo(t, s.kind)}</span>
                    <span style={{ fontWeight: 500 }}>{s.summary}</span>
                    {s.detail && s.detail !== s.summary && s.kind !== 'consulta' && (
                      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>«{s.detail}»</div>
                    )}
                    {padre && (
                      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                        {t('changeRequests.about', 'Sobre:')} {padre.summary} — {estado(t, padre.status)}
                        {padre.clientMessage ? ` («${padre.clientMessage}»)` : ''}
                      </div>
                    )}
                  </div>
                </div>
                <div role="radiogroup" aria-label={t('changeRequests.decisionLabel', 'Decisión')} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {opciones(s.kind, t).map(([valor, etiqueta]) => (
                    <Button key={valor} size="sm" variant={d.decision === valor ? 'accent' : 'outlined'}
                            aria-pressed={d.decision === valor}
                            onClick={() => setD(s.id, 'decision', d.decision === valor ? undefined : valor)}>
                      {etiqueta}
                    </Button>
                  ))}
                </div>
                {(d.decision === 'rechazar' || d.decision === 'ajustar') && (
                  <label className="field">
                    <span className="field-label">{t('changeRequests.reason', 'Motivo')}</span>
                    <select className="field-input" value={d.reasonCode || ''}
                            onChange={(e) => setD(s.id, 'reasonCode', e.target.value || undefined)}>
                      <option value="">{t('changeRequests.chooseReason', 'Elige un motivo…')}</option>
                      {motivos.map((m) => <option key={m.code} value={m.code}>{m.label}</option>)}
                    </select>
                    {motivoElegido?.clientText && (
                      <span className="muted" style={{ fontSize: 12 }}>{t('changeRequests.clientWillRead', 'El cliente leerá:')} «{motivoElegido.clientText}»</span>
                    )}
                  </label>
                )}
                {d.decision === 'ajustar' && s.kind === 'descuento' && (
                  <label className="field">
                    <span className="field-label">{t('changeRequests.appliedDiscount', 'Descuento que se aplica (%)')}</span>
                    <input className="field-input mono" type="number" min="0" max="100" step="0.5"
                           value={d.adjustedDiscountPct ?? ''} onChange={(e) => setD(s.id, 'adjustedDiscountPct', e.target.value)} />
                  </label>
                )}
                {d.decision === 'ajustar' && (s.kind === 'agregar' || s.kind === 'cantidad') && (
                  <label className="field">
                    <span className="field-label">{t('changeRequests.appliedQuantity', 'Cantidad que se aplica')}</span>
                    <input className="field-input mono" type="number" min="0" step="1"
                           value={d.adjustedQuantity ?? ''} onChange={(e) => setD(s.id, 'adjustedQuantity', e.target.value)} />
                  </label>
                )}
                {d.decision && (
                  <label className="field">
                    <span className="field-label">
                      {(d.decision === 'rechazar' || d.decision === 'ajustar') && motivoElegido?.clientText
                        ? t('changeRequests.extraComment', 'Comentario adicional (opcional)')
                        : d.decision === 'aceptar'
                          ? t('changeRequests.clientMessageOptional', 'Mensaje para el cliente (opcional)')
                          : t('changeRequests.clientMessage', 'Mensaje para el cliente')}
                    </span>
                    <input className="field-input" value={d.response || ''} maxLength={300}
                           placeholder={d.decision === 'rechazar' ? t('changeRequests.rejectPlaceholder', 'Motivo del rechazo') : ''}
                           onChange={(e) => setD(s.id, 'response', e.target.value)} />
                  </label>
                )}
                {problema && <div style={{ color: 'var(--danger)', fontSize: 12 }}>{problema}</div>}
              </div>
            );
          })}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-end' }}>
            <span className="muted" style={{ fontSize: 12 }}>
              {t('changeRequests.progress', '{{done}} de {{total}} respondidas · las demás quedan pendientes', { done: elegidas.length, total: pendientes.length })}
            </span>
            <Button variant="accent" icon="check"
                    disabled={!editable || aplicando || elegidas.length === 0 || problemas.length > 0}
                    title={editable ? '' : t('changeRequests.openFirst', 'Abre la cotización para revisarla antes de aplicar cambios')}
                    onClick={aplicar}>
              {aplicando ? t('changeRequests.applying', 'Aplicando…') : t('changeRequests.apply', 'Aplicar')}
            </Button>
          </div>
        </section>
      )}

      {resueltas.length > 0 && (
        <section>
          <div style={{ fontWeight: 500, marginBottom: 8 }}>{t('changeRequests.resolved', 'Resueltas')}</div>
          {resueltas.map((s) => (
            <div key={s.id} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <span className={`badge-m3 ${ESTADO[s.status]?.clase || 'neutral'}`}>{estado(t, s.status)}</span>
              <div style={{ flex: 1 }}>
                <div>{s.summary}</div>
                {s.reasonLabel && <div className="muted" style={{ fontSize: 12 }}>{t('changeRequests.reason', 'Motivo')}: {s.reasonLabel}</div>}
                {(s.clientMessage || s.response) && (
                  <div className="muted" style={{ fontSize: 12 }}>{s.clientMessage || s.response}</div>
                )}
              </div>
              <div className="muted" style={{ fontSize: 12 }}>{s.resolvedBy}</div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
