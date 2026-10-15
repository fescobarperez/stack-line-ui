// Activar cuenta: el administrador invitado abre el enlace de la consola de
// Stackline, ve a qué empresa entra y define su contraseña. Después va al
// login con el código y el correo ya escritos.
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Logo from '../components/Logo.jsx';
import { getActivation, activateAccount, passwordOk } from '../api/activation.js';

export default function Activate() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('t') || '';
  const [info, setInfo] = useState(null);
  const [fatal, setFatal] = useState(null);
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) { setFatal(t('activate.invalid', 'El enlace ya no es válido. Pide uno nuevo al administrador de Stackline.')); return; }
    getActivation(token).then(setInfo).catch((e) => setFatal(e.message));
  }, [token, t]);

  const enviar = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!passwordOk(pass)) errs.pass = t('activate.passRule', 'Mínimo 8 caracteres, con letras y números.');
    else if (pass !== pass2) errs.pass2 = t('activate.mismatch', 'Las contraseñas no coinciden.');
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const r = await activateAccount(token, pass);
      navigate('/login', { replace: true, state: { companyCode: r.companyCode, email: r.email, activated: true } });
    } catch (err) {
      if (err.status === 410) setFatal(err.message);
      else setErrors({ form: err.message });
      setBusy(false);
    }
  };

  return (
    <div className="login-root activate-root">
      <div className="login-form-panel">
        <div className="login-card">
          <div className="login-logo activate-logo">
            <Logo size={36} />
            <div className="login-logo-name">Stackline</div>
          </div>

          {!info && !fatal && <p className="login-desc">{t('activate.loading', 'Revisando el enlace…')}</p>}

          {fatal && (
            <>
              <div className="login-card-head">
                <h1 className="login-title">{t('activate.title', 'Activa tu cuenta')}</h1>
              </div>
              <div className="login-alert" role="alert">{fatal}</div>
              <button type="button" className="login-submit" onClick={() => navigate('/login', { replace: true })}>
                {t('activate.toLogin', 'Ir al inicio de sesión')}
              </button>
            </>
          )}

          {info && !fatal && (
            <>
              <div className="login-card-head">
                <h1 className="login-title">{t('activate.title', 'Activa tu cuenta')}</h1>
                <p className="login-desc">
                  {t('activate.desc', 'Hola, {{name}}. Define tu contraseña para entrar a {{company}}.', { name: info.name, company: info.companyName })}
                </p>
              </div>
              <div className="login-company-preview activate-who">
                <span className="login-company-dot" />
                <span className="login-company-name">{info.companyName}</span>
                <span className="login-tier-badge">{info.companyCode}</span>
              </div>
              <p className="login-desc activate-email">{info.email}</p>

              <form className="login-form" onSubmit={enviar} noValidate>
                <div className={`login-field ${errors.pass ? 'has-error' : ''}`}>
                  <label htmlFor="act-pass" className="login-label">{t('activate.password', 'Contraseña')}</label>
                  <div className="login-input-wrap">
                    <input id="act-pass" type="password" className="login-input" value={pass} autoComplete="new-password"
                      onChange={(e) => { setPass(e.target.value); setErrors({}); }} />
                  </div>
                  {errors.pass
                    ? <span className="login-error">{errors.pass}</span>
                    : <span className="login-hint">{t('activate.passRule', 'Mínimo 8 caracteres, con letras y números.')}</span>}
                </div>
                <div className={`login-field ${errors.pass2 ? 'has-error' : ''}`}>
                  <label htmlFor="act-pass2" className="login-label">{t('activate.password2', 'Repite la contraseña')}</label>
                  <div className="login-input-wrap">
                    <input id="act-pass2" type="password" className="login-input" value={pass2} autoComplete="new-password"
                      onChange={(e) => { setPass2(e.target.value); setErrors({}); }} />
                  </div>
                  {errors.pass2 && <span className="login-error">{errors.pass2}</span>}
                </div>
                {errors.form && <div className="login-alert" role="alert">{errors.form}</div>}
                <button type="submit" className="login-submit" disabled={busy}>
                  {busy ? <><span className="login-spinner" />{t('activate.saving', 'Activando…')}</> : t('activate.submit', 'Activar y continuar')}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
