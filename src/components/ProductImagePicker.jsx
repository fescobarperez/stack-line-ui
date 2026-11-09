// Foto en el formulario del producto. No sube nada: arma el cambio y el
// formulario lo aplica al guardar (al crear, primero hace falta el id).
// value: null (sin cambios) | { kind: 'set', upload, previewUrl } | { kind: 'remove' }
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from './Icon.jsx';
import Button from './Button.jsx';
import ProductThumb from './ProductThumb.jsx';
import { ACCEPT, prepararImagen, validarArchivo } from '../lib/productImage.js';

export default function ProductImagePicker({ product, value, onChange, disabled }) {
  const { t } = useTranslation();
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [over, setOver] = useState(false);

  const tieneActual = product?.imageVersion != null && value?.kind !== 'remove';
  const muestra = value?.kind === 'set' ? 'new' : tieneActual ? 'current' : 'none';

  const elegir = async (file) => {
    setError(null);
    const err = validarArchivo(file);
    if (err) {
      setError(err === 'productImage.err.type'
        ? t('productImage.err.type', 'Usa una foto JPG, PNG o WebP.')
        : err === 'productImage.err.size'
          ? t('productImage.err.size', 'La foto pasa de 15 MB.')
          : t('productImage.err.none', 'No se eligió ninguna foto.'));
      return;
    }
    setBusy(true);
    try {
      const prep = await prepararImagen(file);
      if (value?.kind === 'set') URL.revokeObjectURL(value.previewUrl);
      onChange({ kind: 'set', ...prep });
    } catch {
      setError(t('productImage.err.read', 'No se pudo leer la foto. Prueba con otra.'));
    } finally {
      setBusy(false);
    }
  };

  const quitar = () => {
    if (value?.kind === 'set') URL.revokeObjectURL(value.previewUrl);
    setError(null);
    onChange(product?.imageVersion != null ? { kind: 'remove' } : null);
  };

  const abrir = () => { if (!disabled && !busy) input.current?.click(); };
  const bloqueado = disabled || busy;

  return (
    <div className="prod-img-picker">
      <div
        className={`prod-img-drop${over ? ' over' : ''}${muestra !== 'none' ? ' filled' : ''}`}
        role="button" tabIndex={bloqueado ? -1 : 0}
        aria-label={muestra === 'none' ? t('productImage.add', 'Agregar foto') : t('productImage.change', 'Cambiar foto')}
        onClick={abrir}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); } }}
        onDragOver={(e) => { e.preventDefault(); if (!bloqueado) setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (!bloqueado) elegir(e.dataTransfer.files?.[0]); }}
      >
        {busy ? (
          <span className="prod-img-empty"><Icon name="hourglass_empty" size={22} />{t('productImage.processing', 'Preparando…')}</span>
        ) : muestra === 'new' ? (
          <img src={value.previewUrl} alt={t('productImage.preview', 'Vista previa')} />
        ) : muestra === 'current' ? (
          <ProductThumb product={product} size="full" className="prod-img-current" />
        ) : (
          <span className="prod-img-empty">
            <Icon name="add_a_photo" size={24} />
            {t('productImage.add', 'Agregar foto')}
          </span>
        )}
      </div>
      <div className="prod-img-side">
        <div className="prod-img-title">{t('productImage.title', 'Foto del producto')}</div>
        <div className="cfg-hint">
          {value?.kind === 'remove'
            ? t('productImage.willRemove', 'Se quitará al guardar.')
            : value?.kind === 'set'
              ? t('productImage.willUpload', 'Se sube al guardar.')
              : t('productImage.hint', 'Arrástrala aquí o elígela. En el celular puedes tomarla con la cámara. Se ve en el punto de venta.')}
        </div>
        <div className="row gap-6 prod-img-actions">
          <Button size="sm" icon={muestra === 'none' ? 'upload' : 'sync'} onClick={abrir} disabled={bloqueado}>
            {muestra === 'none' ? t('productImage.choose', 'Elegir foto') : t('productImage.change', 'Cambiar foto')}
          </Button>
          {muestra !== 'none' && (
            <Button size="sm" variant="ghost" icon="delete" onClick={quitar} disabled={bloqueado}>
              {t('productImage.remove', 'Quitar')}
            </Button>
          )}
          {value?.kind === 'remove' && (
            <Button size="sm" variant="ghost" icon="undo" onClick={() => onChange(null)} disabled={bloqueado}>
              {t('productImage.undo', 'Deshacer')}
            </Button>
          )}
        </div>
        {error && <div className="field-error" role="alert">{error}</div>}
      </div>
      <input ref={input} type="file" accept={ACCEPT} hidden
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) elegir(f); }} />
    </div>
  );
}
