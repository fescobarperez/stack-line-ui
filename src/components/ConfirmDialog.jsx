// Stackline — Diálogo de confirmación reutilizable (Material Design 3)
// Reemplaza a window.confirm con un patrón promise-based:
//
//   const confirm = useConfirm();
//   const ok = await confirm({ title: '¿Eliminar?', message: '…', danger: true });
//   if (!ok) return;
//
// Requiere envolver la app con <ConfirmProvider> (ver main.jsx).
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [options, setOptions] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback((opts) => new Promise((resolve) => {
    resolver.current = resolve;
    setOptions(opts || {});
  }), []);

  const close = useCallback((result) => {
    if (resolver.current) resolver.current(result);
    resolver.current = null;
    setOptions(null);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && (
        <ConfirmDialog {...options} onConfirm={() => close(true)} onCancel={() => close(false)} />
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm debe usarse dentro de <ConfirmProvider>');
  return ctx;
}

export function ConfirmDialog({
  title = '¿Confirmar acción?',
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  icon,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onCancel();
      else if (e.key === 'Enter') onConfirm();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onConfirm, onCancel]);

  const iconName = icon || (danger ? 'alert' : 'check');

  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-dialog" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-head">
          <div className={`confirm-icon${danger ? ' danger' : ''}`}>
            <Icon name={iconName} size={24} />
          </div>
          <h3 className="confirm-title">{title}</h3>
        </div>
        {message && <div className="confirm-message">{message}</div>}
        <div className="confirm-actions">
          <button className="btn btn-text" onClick={onCancel}>{cancelLabel}</button>
          <button className={`btn ${danger ? 'filled-error' : 'accent'}`} onClick={onConfirm} autoFocus>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
