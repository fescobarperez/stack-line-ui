// Stackline — Login screen (ES module)
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { login } from '../api/auth.js';
import Logo from '../components/Logo.jsx';

const DEMO_COMPANIES = {
  'FERRETERIA-01': { name: 'Ferretería El Constructor', type: 'Ferretería', tier: 'PRO' },
  'FARMACIA-GT':   { name: 'Farmacias del Valle',       type: 'Farmacia',   tier: 'PRO' },
  'SUPERMERCADO':  { name: 'Supermercado La Familia',   type: 'Retail',     tier: 'ENTERPRISE' },
  'TIENDA-DEMO':   { name: 'Tienda Demo Stackline',      type: 'Demo',       tier: 'DEMO' },
};

function validate(form, t) {
  const errors = {};
  if (!form.companyCode.trim())
    errors.companyCode = t('login.errors.companyRequired');
  if (!form.email.trim())
    errors.email = t('login.errors.emailRequired');
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
    errors.email = t('login.errors.emailInvalid');
  if (!form.password)
    errors.password = t('login.errors.passwordRequired');
  else if (form.password.length < 6)
    errors.password = t('login.errors.passwordShort');
  return errors;
}

export default function Login({ onLogin }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ companyCode: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [companyPreview, setCompanyPreview] = useState(null);
  const companyRef = useRef(null);

  useEffect(() => {
    companyRef.current?.focus();
  }, []);

  useEffect(() => {
    const code = form.companyCode.trim().toUpperCase();
    setCompanyPreview(DEMO_COMPANIES[code] || null);
  }, [form.companyCode]);

  const set = (field, value) => {
    setForm(f => ({ ...f, [field]: value }));
    if (errors[field]) setErrors(e => ({ ...e, [field]: '' }));
    if (loginError) setLoginError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate(form, t);
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    setLoginError('');

    try {
      const session = await login({
        companyCode: form.companyCode,
        email: form.email,
        password: form.password,
      });
      onLogin(session);
    } catch (err) {
      // 401 → credenciales inválidas; otro → error de conexión/servidor.
      setLoginError(
        err.status === 401
          ? (err.message || t('login.errors.invalidCredentials', 'Empresa, usuario o contraseña inválidos.'))
          : (err.message || t('login.errors.connection', 'No se pudo conectar con el servidor.'))
      );
      setLoading(false);
    }
  };

  return (
    <div className="login-root">
      {/* Panel izquierdo — marca */}
      <div className="login-brand">
        <div className="login-brand-inner">
          <div className="login-logo">
            <Logo size={36} className="login-mark" />
            <div>
              <div className="login-logo-name">Stackline</div>
              <div className="login-logo-tier">STACKLINE · RETAIL v4.0</div>
            </div>
          </div>

          <div className="login-headline">
            Sistema de gestión<br />para retail guatemalteco
          </div>
          <div className="login-subheadline">
            POS · Inventario · Contabilidad · SAT-FEL
          </div>

          <ul className="login-features">
            {[
              ['Facturación electrónica SAT-FEL', 'Emisión de DTE en tiempo real'],
              ['Multi-sucursal en tiempo real', 'Consolidado de todas tus tiendas'],
              ['Contabilidad integrada', 'Plan de cuentas Guatemala + IVA 12%'],
              ['Inventario inteligente', 'PEPS, promedio, lotes, vencimientos'],
            ].map(([title, desc]) => (
              <li key={title} className="login-feature-item">
                <span className="login-feature-dot" />
                <span>
                  <strong>{title}</strong>
                  <span className="login-feature-desc"> · {desc}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="login-brand-footer">
          <span className="login-brand-legal">
            © 2026 Stackline · Guatemala · Todos los derechos reservados
          </span>
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div className="login-form-panel">
        <div className="login-card">
          <div className="login-card-head">
            <h1 className="login-title">{t('login.title')}</h1>
            <p className="login-desc">{t('login.description')}</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            {/* Código de empresa */}
            <div className={`login-field ${errors.companyCode ? 'has-error' : ''}`}>
              <label htmlFor="companyCode" className="login-label">
                {t('login.companyCode')}
              </label>
              <div className="login-input-wrap">
                <span className="login-input-icon">
                  <BuildingIcon />
                </span>
                <input
                  ref={companyRef}
                  id="companyCode"
                  type="text"
                  className="login-input mono-input"
                  placeholder={t('login.companyCodePlaceholder')}
                  value={form.companyCode}
                  onChange={e => set('companyCode', e.target.value)}
                  autoComplete="organization"
                  spellCheck={false}
                />
              </div>
              {errors.companyCode && (
                <span className="login-error">{errors.companyCode}</span>
              )}
              {companyPreview && !errors.companyCode && (
                <div className="login-company-preview">
                  <span className="login-company-dot" />
                  <span className="login-company-name">{companyPreview.name}</span>
                  <span className="login-company-type">{companyPreview.type}</span>
                  <span className="login-tier-badge">{companyPreview.tier}</span>
                </div>
              )}
            </div>

            {/* Correo */}
            <div className={`login-field ${errors.email ? 'has-error' : ''}`}>
              <label htmlFor="email" className="login-label">
                {t('login.email')}
              </label>
              <div className="login-input-wrap">
                <span className="login-input-icon">
                  <MailIcon />
                </span>
                <input
                  id="email"
                  type="email"
                  className="login-input"
                  placeholder={t('login.emailPlaceholder')}
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  autoComplete="email"
                />
              </div>
              {errors.email && (
                <span className="login-error">{errors.email}</span>
              )}
            </div>

            {/* Contraseña */}
            <div className={`login-field ${errors.password ? 'has-error' : ''}`}>
              <div className="login-label-row">
                <label htmlFor="password" className="login-label">{t('login.password')}</label>
                <button type="button" className="login-forgot">
                  {t('login.forgotPassword')}
                </button>
              </div>
              <div className="login-input-wrap">
                <span className="login-input-icon">
                  <LockIcon />
                </span>
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  className="login-input"
                  placeholder={t('login.passwordPlaceholder')}
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="login-eye"
                  onClick={() => setShowPass(s => !s)}
                  tabIndex={-1}
                  aria-label={showPass ? t('login.hidePassword') : t('login.showPassword')}
                >
                  {showPass ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              {errors.password && (
                <span className="login-error">{errors.password}</span>
              )}
            </div>

            {loginError && (
              <div className="login-alert">{loginError}</div>
            )}

            <button
              type="submit"
              className="login-submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="login-spinner" />
                  {t('login.submitting')}
                </>
              ) : (
                t('login.submit')
              )}
            </button>
          </form>

          <div className="login-demo-hint">
            <span className="login-demo-label">{t('login.demoAccess')}</span>
            <div className="login-demo-codes">
              {Object.entries(DEMO_COMPANIES).map(([code, co]) => (
                <button
                  key={code}
                  type="button"
                  className="login-demo-chip"
                  onClick={() => {
                    set('companyCode', code);
                    set('email', 'admin@' + code.toLowerCase().replace(/-/g, '') + '.com');
                    set('password', 'demo123');
                  }}
                >
                  {code}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Inline SVG icons ────────────────────────────────────────────────────────

function BuildingIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="3" width="12" height="12" rx="1"/>
      <path d="M6 15V9h4v6M1 7h14"/>
      <path d="M5 3V2M8 3V2M11 3V2"/>
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="3" width="14" height="10" rx="1.5"/>
      <path d="M1 4l7 5 7-5"/>
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="7" width="10" height="8" rx="1.5"/>
      <path d="M5 7V5a3 3 0 016 0v2"/>
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/>
      <circle cx="8" cy="8" r="2"/>
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 2l12 12M6.5 6.6A2 2 0 0010 10M4.3 4.4C2.7 5.5 1 8 1 8s2.5 5 7 5c1.4 0 2.7-.4 3.7-1M8 3c4.5 0 7 5 7 5s-.7 1.3-1.9 2.6"/>
    </svg>
  );
}
