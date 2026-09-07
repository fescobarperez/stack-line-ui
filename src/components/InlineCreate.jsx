import React from 'react';
import Button from './Button.jsx';

/** Formulario compacto de "crear y continuar" dentro del diálogo padre. */
export default function InlineCreate({ title, children, onSubmit, onCancel, busy = false, submitLabel = 'Guardar' }) {
  return (
    <div
      role="region"
      aria-label={title}
      style={{
        marginTop: 10,
        padding: 12,
        border: '1px solid var(--md-sys-color-outline-variant)',
        borderRadius: 'var(--shape-md)',
        background: 'var(--md-sys-color-surface-container-low)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
        <strong>{title}</strong>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancelar</Button>
      </div>
      <div onKeyDown={(event) => {
        const tag = event.target.tagName;
        if (!event.defaultPrevented && event.key === 'Enter' && (tag === 'INPUT' || tag === 'TEXTAREA')) {
          event.preventDefault();
          onSubmit(event);
        }
      }}>
        {children}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
          <Button type="button" size="sm" variant="accent" onClick={onSubmit} disabled={busy}>{submitLabel}</Button>
        </div>
      </div>
    </div>
  );
}
