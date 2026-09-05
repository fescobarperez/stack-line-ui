// Stackline — Diálogo de autorización en sitio
//
// Lo usa cualquier módulo junto con useAuthorization(): un superior teclea su
// correo y contraseña sin cerrar la sesión del cajero. El diálogo no sabe qué
// se está autorizando; solo recoge la credencial y devuelve el resultado.
//
//   const { require: requireAuth, prompt } = useAuthorization();
//   ...
//   <AuthorizationDialog prompt={prompt} />
import React, { useState } from 'react';
import Icon from './Icon.jsx';
import Button from './Button.jsx';
import { useTranslation } from 'react-i18next';

export default function AuthorizationDialog({ prompt }) {
  const { t } = useTranslation();
  const [email, setEmail]     = useState('');
  const [password, setPass]   = useState('');
  const [error, setError]     = useState('');
  const [busy, setBusy]       = useState(false);

  if (!prompt) return null;

  const close = () => { setEmail(''); setPass(''); setError(''); prompt.onCancel(); };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await prompt.onSubmit(email.trim(), password);
      setEmail(''); setPass('');
    } catch (err) {
      // El backend explica el motivo: credencial inválida, nivel insuficiente,
      // sin alcance sobre la sucursal, o autorizarse a uno mismo.
      setError(err.message || t('auth.failed', 'No se pudo autorizar'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{t('auth.title', 'Autorización requerida')}</h3>
          <Button variant="ghost" iconOnly icon="x" onClick={close} title={t('common.close', 'Cerrar')} />
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            <div className="alert" style={{ marginBottom: 16 }}>
              <Icon name="shield" size={18} />
              <span>
                {t('auth.needsLevel', 'Esta operación requiere autorización de')}{' '}
                <strong>{prompt.level}</strong>{t('auth.orHigher', ' o superior')}.
              </span>
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label className="field-label">{t('auth.approverEmail', 'Correo del autorizador')}</label>
              <input className="field-input" type="email" autoFocus required
                value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label">{t('auth.approverPassword', 'Contraseña')}</label>
              <input className="field-input" type="password" required
                value={password} onChange={e => setPass(e.target.value)} />
            </div>
            {error && (
              <div className="alert" style={{ marginTop: 12, color: 'var(--danger)' }}>
                <Icon name="alert" size={16} />{error}
              </div>
            )}
          </div>
          <div className="modal-foot">
            <Button type="button" onClick={close}>{t('common.cancel', 'Cancelar')}</Button>
            <Button icon="check" variant="accent" type="submit" disabled={busy}>
              {busy ? t('auth.checking', 'Verificando…') : t('auth.approve', 'Autorizar')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export { AuthorizationDialog };
