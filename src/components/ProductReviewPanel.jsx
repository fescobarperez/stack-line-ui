// Productos que propuso el asistente de WhatsApp y esperan revisión.
//
// El asistente los crea sin precio cuando el cliente pide algo que no está en
// el catálogo (y la empresa lo permite). Mientras están aquí no aparecen en el
// POS ni en las búsquedas, y las líneas que los usan quedan «por cotizar».
// Aprobar = ponerle precio (y si se quiere, categoría y SKU definitivos).
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from './Button.jsx';
import Icon from './Icon.jsx';
import Autocomplete from './Autocomplete.jsx';
import { useConfirm } from './ConfirmDialog.jsx';
import { listProducts, reviewProduct } from '../api/catalog.js';
import { approvalPayload, dimensionsText, validateApproval } from '../lib/productReview.js';
import { fechaISO } from '../lib/fechas.js';

export default function ProductReviewPanel({ categories = [], pushToast, onChanged }) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const [items, setItems] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [aprobando, setAprobando] = useState(null);

  const cargar = useCallback(() => {
    setCargando(true);
    return listProducts({ review: 'pending', size: 100 })
      .then((page) => setItems(page?.content ?? []))
      .catch((e) => pushToast?.(t('productReview.loadError', 'No se pudieron cargar los productos por revisar: {{msg}}', { msg: e.message }), 'danger'))
      .finally(() => setCargando(false));
  }, [pushToast, t]);

  useEffect(() => { cargar(); }, [cargar]);

  const despues = () => { cargar(); onChanged?.(); };

  const descartar = async (p) => {
    const ok = await confirm({
      title: t('productReview.discardTitle', 'Descartar producto'),
      message: t('productReview.discardMessage', '«{{name}}» no se agregará al catálogo. Las cotizaciones que lo usan seguirán con la línea por cotizar.', { name: p.name }),
      confirmLabel: t('productReview.discard', 'Descartar'),
      danger: true,
      icon: 'trash',
    });
    if (!ok) return;
    try {
      await reviewProduct(p.id, { action: 'discard' });
      pushToast?.(t('productReview.discarded', '«{{name}}» descartado', { name: p.name }), 'success');
      despues();
    } catch (e) {
      pushToast?.(e.message || t('productReview.error', 'No se pudo guardar la revisión'), 'danger');
    }
  };

  const nombreCategoria = (id) => categories.find((c) => String(c.id) === String(id))?.name;

  if (cargando && items.length === 0) {
    return <div className="card"><div className="empty card-body">{t('common.loading', 'Cargando…')}</div></div>;
  }
  if (items.length === 0) {
    return (
      <div className="card">
        <div className="empty card-body review-empty">
          <Icon name="check" size={20} />
          <div>{t('productReview.empty', 'No hay productos por revisar.')}</div>
          <div className="muted">{t('productReview.emptyHint', 'Cuando el asistente registre un producto que no está en el catálogo, aparecerá aquí para ponerle precio.')}</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="cfg-hint review-intro">
        {t('productReview.intro', 'Productos que el asistente registró porque el cliente pidió algo fuera del catálogo. No se venden ni aparecen en búsquedas hasta que los apruebes con un precio; mientras tanto, sus líneas en las cotizaciones quedan por cotizar.')}
      </div>
      <div className="review-grid">
        {items.map((p) => {
          const medidas = dimensionsText(p);
          return (
            <div key={p.id} className="card review-card">
              <div className="card-head">
                <div>
                  <h3>{p.name}</h3>
                  <div className="mono muted">{p.sku}</div>
                </div>
                <span className="badge-m3 info">{t('productReview.fromAssistant', 'Asistente')}</span>
              </div>
              <div className="card-body review-body">
                <div className="review-facts">
                  <div><div className="muted">{t('inventory.headers.category', 'Categoría')}</div><div>{nombreCategoria(p.categoryId) || p.categoryName || '—'}</div></div>
                  <div><div className="muted">{t('productReview.dimensions', 'Medidas')}</div><div className="mono">{medidas || '—'}</div></div>
                  <div><div className="muted">{t('productReview.createdAt', 'Registrado')}</div><div className="mono">{p.createdAt ? fechaISO(p.createdAt) : '—'}</div></div>
                </div>
                {p.reviewNotes && (
                  <div className="review-notes">
                    <div className="muted">{t('productReview.notes', 'Lo que pidió el cliente')}</div>
                    <p>{p.reviewNotes}</p>
                  </div>
                )}
              </div>
              <div className="review-actions">
                <Button icon="trash" variant="ghost" onClick={() => descartar(p)}>{t('productReview.discard', 'Descartar')}</Button>
                <Button icon="check" variant="accent" onClick={() => setAprobando(p)}>{t('productReview.approve', 'Aprobar')}</Button>
              </div>
            </div>
          );
        })}
      </div>

      {aprobando && (
        <ApproveDialog
          product={aprobando}
          categories={categories}
          onClose={() => setAprobando(null)}
          onDone={() => { setAprobando(null); despues(); }}
          pushToast={pushToast}
        />
      )}
    </>
  );
}

function ApproveDialog({ product, categories, onClose, onDone, pushToast }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    price: '',
    categoryId: product.categoryId != null ? String(product.categoryId) : '',
    sku: product.sku ?? '',
  });
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    const e = validateApproval(form);
    setErrores(e);
    if (Object.keys(e).length) return;
    setGuardando(true);
    try {
      await reviewProduct(product.id, approvalPayload(form, product.sku));
      pushToast?.(t('productReview.approved', '«{{name}}» aprobado y agregado al catálogo', { name: product.name }), 'success');
      onDone();
    } catch (err) {
      pushToast?.(err.message || t('productReview.error', 'No se pudo guardar la revisión'), 'danger');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={() => !guardando && onClose()}>
      <div className="modal review-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h3>{t('productReview.approveTitle', 'Aprobar producto')}</h3>
            <div className="muted">{product.name}</div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label={t('common.close', 'Cerrar')}><Icon name="x" /></button>
        </div>
        <div className="modal-body review-form">
          <div className="field">
            <label>{t('productReview.price', 'Precio de venta (Q)')} *</label>
            <input inputMode="decimal" value={form.price} autoFocus
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
            {errores.price && <span className="field-error">{t(errores.price, 'Ingresa un precio mayor que cero')}</span>}
          </div>
          <div className="field">
            <label>{t('inventory.headers.category', 'Categoría')}</label>
            <Autocomplete value={form.categoryId}
              onChange={(id) => setForm((f) => ({ ...f, categoryId: id == null ? '' : String(id) }))}
              options={categories.map((c) => ({ id: String(c.id), name: c.name }))}
              emptyText={t('common.noResults', 'Sin coincidencias')}
              aria-label={t('inventory.headers.category', 'Categoría')} />
          </div>
          <div className="field">
            <label>{t('productReview.sku', 'SKU / código')}</label>
            <input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} />
            <span className="cfg-hint">{t('productReview.skuHint', 'El asistente le puso uno provisional; puedes cambiarlo.')}</span>
            {errores.sku && <span className="field-error">{t(errores.sku, 'Máximo 40 caracteres')}</span>}
          </div>
        </div>
        <div className="modal-foot">
          <Button onClick={onClose} disabled={guardando}>{t('common.cancel', 'Cancelar')}</Button>
          <Button icon="check" variant="accent" onClick={guardar} disabled={guardando}>
            {guardando ? t('common.saving', 'Guardando…') : t('productReview.approve', 'Aprobar')}
          </Button>
        </div>
      </div>
    </div>
  );
}
