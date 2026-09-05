// Stackline — Bandeja de autorizaciones
//
// La otra mitad del motor: lo que no se resuelve con credencial en sitio
// (POS) queda aquí para que un superior lo apruebe o rechace. La pantalla es
// genérica a propósito: muestra tipo, solicitante, monto o porcentaje y el
// payload, sin saber qué significa ninguno.
import React, { useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import DataTable from '../components/DataTable.jsx';
import StatCard from '../components/StatCard.jsx';
import { usePendingAuthorizations } from '../hooks/useOperations.js';
import { resolveAuthorization } from '../api/authorizations.js';
import { useTranslation } from 'react-i18next';

const fmtDateTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString('es-GT')} ${d.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}`;
};

// El umbral puede ser porcentaje o monto: se muestra el que traiga la solicitud.
const fmtValue = (r) => {
  if (r.percent != null) return `${Number(r.percent).toFixed(2)} %`;
  if (r.amount != null) return `${r.currency || ''} ${Number(r.amount).toFixed(2)}`.trim();
  return '—';
};

function DecisionModal({ request, decision, onDone, onClose, pushToast }) {
  const { t } = useTranslation();
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const approving = decision === 'approved';

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await resolveAuthorization(request.id, { decision, comment: comment.trim() || null });
      pushToast?.(approving
        ? t('authz.approved', 'Autorización aprobada')
        : t('authz.rejected', 'Autorización rechazada'), approving ? 'success' : '');
      // Resuelta (aprobada o rechazada) deja de estar pendiente: refresca todas
      // las instancias, incluido el contador del escudo en la barra superior.
      usePendingAuthorizations.refresh();
      onDone();
    } catch (err) {
      // Nivel insuficiente, sin alcance sobre la sucursal, o es tu propia solicitud.
      pushToast?.(err.message, 'danger');
    } finally { setBusy(false); }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{approving ? t('authz.approve', 'Aprobar') : t('authz.reject', 'Rechazar')}</h3>
          <Button variant="ghost" iconOnly icon="x" onClick={onClose} />
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            <div className="detail-grid" style={{ marginBottom: 12 }}>
              <div className="detail-row">
                <span className="detail-label">{t('authz.type', 'Tipo')}</span><span>{request.typeName}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">{t('authz.requester', 'Solicitante')}</span><span>{request.requestedByName || '—'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">{t('authz.value', 'Valor')}</span><span className="mono">{fmtValue(request)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">{t('authz.level', 'Nivel requerido')}</span><span>{request.levelName || '—'}</span>
              </div>
            </div>
            <div className="field">
              <label className="field-label">{t('authz.comment', 'Comentario')}</label>
              <textarea className="field-input" rows={3} value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder={approving ? '' : t('authz.reasonHint', 'Motivo del rechazo')} />
            </div>
          </div>
          <div className="modal-foot">
            <Button type="button" onClick={onClose}>{t('common.cancel', 'Cancelar')}</Button>
            <Button icon={approving ? 'check' : 'x'} variant={approving ? 'accent' : 'error'}
              type="submit" disabled={busy}>
              {approving ? t('authz.approve', 'Aprobar') : t('authz.reject', 'Rechazar')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Authorizations({ pushToast }) {
  const { t } = useTranslation();
  const { items: pending, reload } = usePendingAuthorizations();
  const [modal, setModal] = useState(null);

  const byType = useMemo(() => {
    const m = new Map();
    pending.forEach(r => m.set(r.typeName, (m.get(r.typeName) || 0) + 1));
    return [...m.entries()];
  }, [pending]);

  const columns = [
    { key: 'id', header: '#', mono: true, width: 70, sortable: true },
    { key: 'typeName', header: t('authz.type', 'Tipo'), sortable: true },
    { key: 'requestedByName', header: t('authz.requester', 'Solicitante'), sortable: true,
      render: (r) => r.requestedByName || '—' },
    { key: 'value', header: t('authz.value', 'Valor'), align: 'right',
      render: (r) => <span className="num">{fmtValue(r)}</span> },
    { key: 'levelName', header: t('authz.level', 'Nivel requerido'),
      render: (r) => <span className="badge-m3">{r.levelName || '—'}</span> },
    { key: 'createdAt', header: t('authz.requested', 'Solicitada'),
      render: (r) => fmtDateTime(r.createdAt) },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('authz.title', 'Autorizaciones')}</h1>
          <div className="page-subtitle">
            {t('authz.subtitle', 'Solicitudes pendientes de aprobación')}
          </div>
        </div>
        <div className="page-head-actions">
          <Button icon="refresh" onClick={reload}>{t('common.refresh', 'Refrescar')}</Button>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard icon="clock" tone="pri"
          label={t('authz.pending', 'Pendientes')} value={pending.length}
          foot={t('authz.pendingFoot', 'Esperando decisión')} />
        {byType.slice(0, 3).map(([name, n], i) => (
          <StatCard key={name} icon="shield" tone={['ter', 'sec', 'err'][i]}
            label={name} value={n} foot={t('authz.ofThisType', 'de este tipo')} />
        ))}
      </div>

      <DataTable
        title={t('authz.queue', 'Bandeja')}
        columns={columns}
        rows={pending}
        rowKey={(r) => r.id}
        pageSize={12}
        empty={t('authz.empty', 'No hay solicitudes pendientes')}
        emptyIcon="check"
        onRefresh={reload}
        actions={(r) => (
          <>
            <Button size="sm" icon="check" variant="accent"
              onClick={() => setModal({ request: r, decision: 'approved' })}>
              {t('authz.approve', 'Aprobar')}
            </Button>
            <Button size="sm" icon="x" variant="danger"
              onClick={() => setModal({ request: r, decision: 'rejected' })}>
              {t('authz.reject', 'Rechazar')}
            </Button>
          </>
        )}
      />

      {modal && (
        <DecisionModal
          request={modal.request} decision={modal.decision} pushToast={pushToast}
          onDone={() => setModal(null)}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
