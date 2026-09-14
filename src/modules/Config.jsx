// Stackline — Módulo de Configuración del sistema
import React, { useState, useEffect } from 'react';
import Autocomplete from '../components/Autocomplete.jsx';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import { useTranslation } from 'react-i18next';
import { listSettings, putSetting, uploadCompanyLogo, getMailSettings, saveMailSettings, testMailSettings } from '../api/wave2.js';

// Clave en company_settings de cada campo. Lo que no esté aquí no se persiste.
// `tax.iva_rate` es la que consume TaxService en el backend.
const SETTING_KEYS = {
  nit: 'company.nit', address: 'company.address', phone: 'company.phone', email: 'company.email',
  logoUrl: 'company.logo_url', primaryColor: 'brand.primary_color', secondaryColor: 'brand.secondary_color',
  felProvider: 'fel.provider', felUser: 'fel.user', felEnvironment: 'fel.environment',
  felEndpoint: 'fel.endpoint', felSeries: 'fel.series', felResolution: 'fel.resolution',
  satCategory: 'fel.sat_category', establishment: 'fel.establishment',
  taxRegime: 'tax.regime', ivaRate: 'tax.iva_rate',
  ticketPrefix: 'seq.ticket_prefix', ocPrefix: 'seq.oc_prefix', transferPrefix: 'seq.transfer_prefix',
  valuationMethod: 'inventory.valuation_method', lowStockThreshold: 'inventory.low_stock_threshold',
};
const CATEGORY_OF = (key) => key.split('.')[0];

const MOCK_CONFIG = {
  legalName: 'Supermercado Stackline, S.A.',
  tradeName: 'Stackline Retail',
  nit: '4521789-3',
  address: '5a Calle 12-34, Zona 1, Guatemala, Guatemala',
  phone: '+502 2238-1100',
  email: 'admin@stackline.gt',
  logoUrl: '',
  primaryColor: '#8b1e3f',
  secondaryColor: '#d47a5a',
  felProvider: 'infile',
  felUser: 'feluser@stackline.gt',
  hasFelKey: true,
  felEnvironment: 'sandbox',
  felEndpoint: 'https://fel.infile.com.gt/api/v2',
  felSeries: 'A',
  felResolution: '2026-43-XX-0042',
  satCategory: 'Definitivo IVA',
  establishment: 'Comercio al por menor · Est. 001',
  taxRegime: 'General',
  ivaRate: '12',   // porcentaje, no fracción
  ticketPrefix: 'T',
  ocPrefix: 'OC',
  transferPrefix: 'TR',
  valuationMethod: 'average',
  lowStockThreshold: '0.20',
};

function Section({ title, icon, children }) {
  return (
    <div className="cfg-section">
      <div className="cfg-section-head">
        <Icon name={icon} size={18} />
        <span className="cfg-section-title">{title}</span>
      </div>
      <div className="form-grid">{children}</div>
    </div>
  );
}

/**
 * Campo de secreto con el ojo para mostrar y ocultar.
 *
 * El `type` alterna en vez de usar un input de texto aparte: cambiar de
 * elemento haría que el navegador perdiera el cursor y el historial de
 * deshacer a cada clic.
 */
function SecretInput({ value, onChange, placeholder, mono = false, autoComplete = 'new-password' }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="secret-field">
      <input
        className={`field-input${mono ? ' mono' : ''}`}
        type={visible ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
      />
      <button type="button" className="secret-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ocultar' : 'Mostrar'}
        title={visible ? 'Ocultar' : 'Mostrar'}>
        <Icon name={visible ? 'eyeOff' : 'eye'} size={16} />
      </button>
    </div>
  );
}

function Field({ label, hint, span = 1, children }) {
  return (
    <div className={`field${span === 2 ? ' span-2' : ''}`}>
      <label className="field-label">{label}</label>
      {children}
      {hint && <div className="cfg-hint">{hint}</div>}
    </div>
  );
}

export default function Config({ pushToast }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState('empresa');
  const [config, setConfig] = useState(MOCK_CONFIG);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Carga lo guardado. Antes la pantalla arrancaba siempre con los valores de
  // ejemplo y no reflejaba nada de lo que hubiera en la base.
  useEffect(() => {
    let cancelled = false;
    listSettings()
      .then((rows) => {
        if (cancelled || !Array.isArray(rows)) return;
        const byKey = Object.fromEntries(rows.map((r) => [r.settingKey, r.settingValue]));
        setConfig((c) => {
          const next = { ...c };
          Object.entries(SETTING_KEYS).forEach(([field, key]) => {
            if (byKey[key] != null) next[field] = byKey[key];
          });
          return next;
        });
      })
      .catch(() => { /* sin conexión se queda con los valores por defecto */ });
    return () => { cancelled = true; };
  }, []);

  const set = (k, v) => setConfig((prev) => ({ ...prev, [k]: v }));

  // Sube el archivo elegido a S3 (URL prefirmada) y guarda la URL pública.
  // No persiste el resto de la config; el usuario aún debe 'Guardar cambios'.
  const handleLogoFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';           // permite re-elegir el mismo archivo
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) {
      pushToast?.(t('config.branding.badFormat', 'Formato no permitido. Usa PNG, JPG, WEBP o SVG.'), 'danger');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      pushToast?.(t('config.branding.tooBig', 'El archivo supera 2 MB.'), 'danger');
      return;
    }
    setUploadingLogo(true);
    try {
      const url = await uploadCompanyLogo(file);
      set('logoUrl', url);
      pushToast?.(t('config.branding.uploaded', 'Logo subido. No olvides Guardar cambios.'), 'success');
    } catch (err) {
      pushToast?.(t('config.branding.uploadFailed', 'No se pudo subir el logo: ') + err.message, 'danger');
    } finally {
      setUploadingLogo(false);
    }
  };

  // Antes esto solo mostraba un toast de éxito sin guardar nada: se podía
  // poner el IVA al 5% y seguía facturando al 12%.
  // El correo no vive en company_settings: tiene su propia tabla y su propio
  // endpoint, porque la contraseña no puede salir en el GET que devuelve
  // todos los ajustes. Por eso también su propio estado y su propio guardado.
  const [mail, setMail] = useState({
    host: '', port: 587, username: '', password: '',
    fromEmail: '', fromName: '', security: 'starttls', enabled: false,
  });
  const [hasPassword, setHasPassword] = useState(false);
  // Copia de lo último que se guardó, para saber si la prueba aplica a lo que
  // el usuario tiene en pantalla o a otra cosa.
  const [mailGuardado, setMailGuardado] = useState(null);
  const [probando, setProbando] = useState(false);
  const [prueba, setPrueba] = useState(null);   // { ok, message }
  const setM = (k, v) => setMail((m) => ({ ...m, [k]: v }));

  useEffect(() => {
    let vigente = true;
    getMailSettings()
      .then((d) => {
        if (!vigente || !d) return;
        setMail({
          host: d.host || '', port: d.port ?? 587, username: d.username || '',
          password: '', fromEmail: d.fromEmail || '', fromName: d.fromName || '',
          security: d.security || 'starttls', enabled: !!d.enabled,
        });
        setHasPassword(!!d.hasPassword);
        setMailGuardado({
          host: d.host || '', port: d.port ?? 587, username: d.username || '',
          fromEmail: d.fromEmail || '', fromName: d.fromName || '',
          security: d.security || 'starttls', enabled: !!d.enabled,
        });
      })
      .catch(() => { /* sin configurar: se queda el formulario vacío */ });
    return () => { vigente = false; };
  }, []);

  /**
   * Prueba la configuración GUARDADA, sin tocar nada.
   *
   * No guarda antes a propósito: probar no debería escribir. Lo que sí hace
   * es avisar cuando lo que hay en pantalla difiere de lo guardado, para que
   * el resultado no se lea como si aplicara a lo que el usuario está viendo.
   */
  // Solo los campos que el servidor usa para conectar. La contraseña cuenta
  // aparte: en blanco significa «conserva la guardada», no «cambió».
  const correoSinGuardar = !mailGuardado
    || !!mail.password
    || ['host', 'username', 'fromEmail', 'fromName', 'security'].some(
        (k) => String(mail[k] ?? '') !== String(mailGuardado[k] ?? ''))
    || Number(mail.port) !== Number(mailGuardado.port)
    || !!mail.enabled !== !!mailGuardado.enabled;

  const probarCorreo = async () => {
    setProbando(true);
    setPrueba(null);
    try {
      setPrueba(await testMailSettings());
    } catch (err) {
      setPrueba({ ok: false, message: err.message });
    } finally { setProbando(false); }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await Promise.all(Object.entries(SETTING_KEYS).map(([field, key]) =>
        putSetting(key, { settingValue: String(config[field] ?? ''), category: CATEGORY_OF(key) })));
      // La contraseña en blanco conserva la guardada: el backend solo la
      // reemplaza si viene con algo.
      const guardado = await saveMailSettings({
        host: mail.host, port: Number(mail.port) || 587, username: mail.username,
        password: mail.password || null, fromEmail: mail.fromEmail,
        fromName: mail.fromName, security: mail.security, enabled: mail.enabled,
      });
      setHasPassword(!!guardado?.hasPassword);
      setMail((m) => ({ ...m, password: '' }));
      setMailGuardado({
        host: guardado?.host || '', port: guardado?.port ?? 587,
        username: guardado?.username || '', fromEmail: guardado?.fromEmail || '',
        fromName: guardado?.fromName || '', security: guardado?.security || 'starttls',
        enabled: !!guardado?.enabled,
      });
      pushToast?.(t('config.saved', 'Configuración guardada correctamente'), 'success');
    } catch (err) {
      pushToast?.(t('config.saveFailed', 'No se pudo guardar: ') + err.message, 'danger');
    } finally {
      setSaving(false);
    }
  };

  const TABS = [
    { id: 'empresa',    label: t('config.tabs.company', 'Empresa'),      icon: 'settings' },
    { id: 'fel',        label: 'FEL / SAT',                              icon: 'receipt'  },
    { id: 'impuestos',  label: t('config.tabs.taxes', 'Impuestos'),      icon: 'tag'      },
    { id: 'inventario', label: t('config.tabs.inventory', 'Inventario'), icon: 'box'      },
    { id: 'smtp',       label: t('config.tabs.smtp', 'Correo SMTP'),     icon: 'bell'     },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('config.title', 'Configuración del sistema')}</h1>
          <div className="page-subtitle">{t('config.subtitle', 'Datos de la empresa, credenciales FEL, impuestos y parámetros globales')}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {/* Nav lateral */}
        <div style={{ minWidth: 180, flexShrink: 0 }}>
          {TABS.map(t2 => (
            <div key={t2.id}
              className={`nav-item ${tab === t2.id ? 'active' : ''}`}
              style={{ marginBottom: 2 }}
              onClick={() => setTab(t2.id)}>
              <Icon name={t2.icon} size={13} className="icon" />
              {t2.label}
            </div>
          ))}
        </div>

        {/* Contenido */}
        <form style={{ flex: 1 }} onSubmit={handleSave}>

          {tab === 'empresa' && (
            <div className="card cfg-card">
              <Section title={t('config.companyData', 'Datos de la empresa')} icon="settings">
                <Field label={t('config.fields.legalName', 'Razón social *')} span={2}>
                  <input className="field-input" value={config.legalName} onChange={e => set('legalName', e.target.value)} required />
                </Field>
                <Field label={t('config.fields.tradeName', 'Nombre comercial')}>
                  <input className="field-input" value={config.tradeName} onChange={e => set('tradeName', e.target.value)} />
                </Field>
                <Field label={t('config.fields.nit', 'NIT *')}>
                  <input className="field-input mono" value={config.nit} onChange={e => set('nit', e.target.value)} required />
                </Field>
                <Field label={t('config.fields.fiscalAddress', 'Dirección fiscal')} span={2}>
                  <input className="field-input" value={config.address} onChange={e => set('address', e.target.value)} />
                </Field>
                <Field label={t('common.phone', 'Teléfono')}>
                  <input className="field-input" value={config.phone} onChange={e => set('phone', e.target.value)} />
                </Field>
                <Field label={t('config.fields.contactEmail', 'Correo de contacto')}>
                  <input className="field-input" type="email" value={config.email} onChange={e => set('email', e.target.value)} />
                </Field>
              </Section>

              <Section title={t('config.docSeries', 'Series de documentos')} icon="tag">
                <Field label={t('config.fields.ticketPrefix', 'Prefijo tickets (POS)')} hint={t('config.fields.ticketPrefixHint', 'Ej: T → T-2026-00001')}>
                  <input className="field-input mono" value={config.ticketPrefix} onChange={e => set('ticketPrefix', e.target.value)} maxLength={5} />
                </Field>
                <Field label={t('config.fields.ocPrefix', 'Prefijo órdenes de compra')} hint={t('config.fields.ocPrefixHint', 'Ej: OC → OC-2026-00001')}>
                  <input className="field-input mono" value={config.ocPrefix} onChange={e => set('ocPrefix', e.target.value)} maxLength={5} />
                </Field>
                <Field label={t('config.fields.transferPrefix', 'Prefijo transferencias')} hint={t('config.fields.transferPrefixHint', 'Ej: TR → TR-00001')}>
                  <input className="field-input mono" value={config.transferPrefix} onChange={e => set('transferPrefix', e.target.value)} maxLength={5} />
                </Field>
              </Section>

              <Section title={t('config.branding.sectionTitle', 'Marca / Branding')} icon="tag">
                <Field label={t('config.branding.logo', 'Logo de la empresa')} span={2}
                  hint={t('config.branding.logoHint', 'PNG, JPG, WEBP o SVG (máx 2 MB). Se sube a S3 y se usa en el encabezado del PDF de cotización.')}>
                  <div className="cfg-logo-upload">
                    <label className={`btn-file${uploadingLogo ? ' is-loading' : ''}`}>
                      <Icon name={uploadingLogo ? 'clock' : 'upload'} size={14} />
                      {uploadingLogo
                        ? t('config.branding.uploading', 'Subiendo…')
                        : (config.logoUrl ? t('config.branding.replaceLogo', 'Cambiar logo') : t('config.branding.chooseLogo', 'Seleccionar imagen'))}
                      <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        hidden disabled={uploadingLogo} onChange={handleLogoFile} />
                    </label>
                    {config.logoUrl && (
                      <a className="cfg-logo-url mono" href={config.logoUrl} target="_blank" rel="noreferrer">
                        {config.logoUrl}
                      </a>
                    )}
                  </div>
                </Field>
                <Field label={t('config.branding.primaryColor', 'Color primario')}
                  hint={t('config.branding.primaryColorHint', 'Acento principal del PDF (títulos, total).')}>
                  <div className="cfg-color-row">
                    <input type="color" className="cfg-color-swatch" value={config.primaryColor}
                      onChange={e => set('primaryColor', e.target.value)} />
                    <input className="field-input mono" value={config.primaryColor}
                      onChange={e => set('primaryColor', e.target.value)} maxLength={7} placeholder="#8b1e3f" />
                  </div>
                </Field>
                <Field label={t('config.branding.secondaryColor', 'Color secundario')}
                  hint={t('config.branding.secondaryColorHint', 'Acento secundario del PDF (cargos, notas).')}>
                  <div className="cfg-color-row">
                    <input type="color" className="cfg-color-swatch" value={config.secondaryColor}
                      onChange={e => set('secondaryColor', e.target.value)} />
                    <input className="field-input mono" value={config.secondaryColor}
                      onChange={e => set('secondaryColor', e.target.value)} maxLength={7} placeholder="#d47a5a" />
                  </div>
                </Field>
              </Section>

              <div className="cfg-preview">
                <div className="cfg-preview-title">{t('config.branding.preview', 'Vista previa — encabezado del PDF')}</div>
                <div className="cfg-brand-preview" style={{ borderTop: `4px solid ${config.primaryColor}` }}>
                  <div className="cfg-brand-logoframe">
                    {config.logoUrl
                      ? <img src={config.logoUrl} alt="logo"
                          onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }} />
                      : null}
                    <div className="cfg-brand-logofallback"
                      style={{ display: config.logoUrl ? 'none' : 'flex', borderColor: config.primaryColor, color: config.primaryColor }}>
                      LOGO
                    </div>
                  </div>
                  <div className="cfg-brand-meta">
                    <div className="cfg-brand-name">{config.tradeName || config.legalName || t('config.branding.companyName', 'Nombre de empresa')}</div>
                    <div className="cfg-brand-doc" style={{ color: config.primaryColor }}>COTIZACIÓN</div>
                    <span className="cfg-brand-chip" style={{ background: config.secondaryColor }}>Cargo adicional</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'fel' && (
            <div className="card cfg-card">
              <div className="cfg-note warn">
                <Icon name="alert" size={18} />
                {t('config.fel.credentialsNote', 'Las credenciales FEL se almacenan cifradas. Contacta a tu certificador SAT para obtener tu clave de API.')}
              </div>
              <Section title={t('config.fel.sectionTitle', 'Certificador FEL (SAT Guatemala)')} icon="receipt">
                <Field label={t('config.fel.provider', 'Certificador')}>
                  <Autocomplete value={config.felProvider}
                    onChange={(id) => set('felProvider', id == null ? '' : String(id))}
                    options={[{ id: 'infile', name: 'Infile' }, { id: 'g4s', name: 'G4S' }, { id: 'ecofactura', name: 'Ecofactura' }, { id: 'digifact', name: 'Digifact' }]}
                    placeholder={t('config.fel.noProvider', '— Sin configurar —')}
                    emptyText="Sin coincidencias"
                    aria-label="Proveedor FEL" />
                </Field>
                <Field label={t('config.fel.environment', 'Ambiente')}>
                  <Autocomplete value={config.felEnvironment}
                    onChange={(id) => set('felEnvironment', id == null ? '' : String(id))}
                    options={[{ id: 'sandbox', name: t('config.fel.sandbox', 'Pruebas (sandbox)') }, { id: 'produccion', name: t('config.fel.production', 'Producción') }]}
                    allowClear={false}
                    emptyText="Sin coincidencias"
                    aria-label="Ambiente" />
                </Field>
                <Field label={t('config.fel.felUser', 'Usuario FEL')} span={2}>
                  <input className="field-input" type="email" value={config.felUser} onChange={e => set('felUser', e.target.value)} />
                </Field>
                <Field label={t('config.fel.apiKey', 'Clave API / Token')} span={2} hint={config.hasFelKey ? t('config.fel.existingKeyHint', 'Ya hay una clave guardada. Déjalo vacío para no cambiarla.') : t('config.fel.newKeyHint', 'Ingresa la clave proporcionada por tu certificador.')}>
                  <SecretInput mono
                    value={config.felKey ?? ''}
                    onChange={(e) => set('felKey', e.target.value)}
                    placeholder={config.hasFelKey ? '••••••••••••••••' : t('config.fel.pasteKeyPlaceholder', 'Pegar clave API aquí')} />
                </Field>
                <Field label={t('config.fel.endpoint', 'Endpoint API')} span={2} hint={t('config.fel.endpointHint', 'URL del servicio de certificación del proveedor.')}>
                  <input className="field-input mono" value={config.felEndpoint} onChange={e => set('felEndpoint', e.target.value)} />
                </Field>
                <Field label={t('config.fel.series', 'Serie activa')}>
                  <input className="field-input mono" value={config.felSeries} onChange={e => set('felSeries', e.target.value)} maxLength={5} />
                </Field>
                <Field label={t('config.fel.resolution', 'Resolución SAT')}>
                  <input className="field-input mono" value={config.felResolution} onChange={e => set('felResolution', e.target.value)} />
                </Field>
              </Section>

              <Section title={t('config.fel.issuerTitle', 'Datos del emisor (SAT)')} icon="shield">
                <Field label={t('config.fel.satCategory', 'Categoría SAT')}>
                  <input className="field-input" value={config.satCategory} onChange={e => set('satCategory', e.target.value)} />
                </Field>
                <Field label={t('config.fel.establishment', 'Establecimiento')}>
                  <input className="field-input" value={config.establishment} onChange={e => set('establishment', e.target.value)} />
                </Field>
                <Field label={t('config.fel.issuerNote', 'Identidad fiscal')} span={2}
                  hint={t('config.fel.issuerHint', 'El NIT, la razón social y la dirección fiscal se editan en la pestaña Empresa; el régimen fiscal, en Impuestos.')}>
                  <div className="cfg-readonly">
                    {config.nit} · {config.legalName} · {config.taxRegime}
                  </div>
                </Field>
              </Section>
            </div>
          )}

          {tab === 'impuestos' && (
            <div className="card cfg-card">
              <Section title={t('config.taxes.sectionTitle', 'Configuración de impuestos (Guatemala)')} icon="tag">
                <Field label={t('config.taxes.regime', 'Régimen fiscal')}>
                  <Autocomplete value={config.taxRegime}
                    onChange={(id) => set('taxRegime', id == null ? '' : String(id))}
                    options={[{ id: 'General', name: t('config.taxes.regimeGeneral', 'Régimen General (IVA 12%)') }, { id: 'PequenioContribuyente', name: t('config.taxes.regimeSmall', 'Pequeño Contribuyente (5% sobre ventas)') }, { id: 'Exento', name: t('config.taxes.regimeExempt', 'Exento de IVA') }]}
                    allowClear={false}
                    emptyText="Sin coincidencias"
                    aria-label="Régimen fiscal" />
                </Field>
                <Field label={t('config.taxes.ivaRate', 'Tasa IVA (%)')}
                  hint={t('config.taxes.ivaRateHint', 'Porcentaje: 12 = 12%. Se aplica a ventas y cotizaciones nuevas.')}>
                  <input className="field-input mono" type="number" min="0" max="100" step="0.001"
                    value={config.ivaRate}
                    onChange={e => set('ivaRate', e.target.value)}
                    placeholder="12" />
                </Field>
              </Section>

              <div className="cfg-preview">
                <div className="cfg-preview-title">{t('config.taxes.preview', 'Vista previa — desglose de IVA')}</div>
                {(() => {
                  const pct  = parseFloat(config.ivaRate);
                  const rate = (Number.isFinite(pct) ? pct : 12) / 100;
                  const salePrice = 100;
                  const base = salePrice / (1 + rate);
                  const tax = salePrice - base;
                  return (
                    <div>
                      <div className="cfg-preview-row">
                        <span className="muted">{t('config.taxes.exampleSalePrice', 'Precio de venta (ejemplo)')}</span>
                        <span className="mono">Q 100.00</span>
                      </div>
                      <div className="cfg-preview-row">
                        <span className="muted">{t('config.taxes.taxBase', 'Base imponible')}</span>
                        <span className="mono">Q {base.toFixed(2)}</span>
                      </div>
                      <div className="cfg-preview-row">
                        <span className="muted">{t('common.iva', 'IVA')} ({(rate * 100).toFixed(0)}%)</span>
                        <span className="mono" style={{ color: 'var(--md-sys-color-primary)' }}>Q {tax.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {tab === 'inventario' && (
            <div className="card cfg-card">
              <Section title={t('config.inventory.sectionTitle', 'Parámetros de inventario')} icon="box">
                <Field label={t('config.inventory.valuationMethod', 'Método de valoración de inventario')} span={2} hint={t('config.inventory.valuationMethodHint', 'Afecta el costo calculado para el kardex y los estados financieros.')}>
                  <Autocomplete value={config.valuationMethod}
                    onChange={(id) => set('valuationMethod', id == null ? '' : String(id))}
                    options={[{ id: 'average', name: t('config.inventory.methodAverage', 'Promedio Ponderado (recomendado)') }, { id: 'fifo', name: t('config.inventory.methodFifo', 'PEPS — Primero en Entrar, Primero en Salir') }]}
                    allowClear={false}
                    emptyText="Sin coincidencias"
                    aria-label="Método de valuación" />
                </Field>
                <Field label={t('config.inventory.lowStockThreshold', 'Umbral de alerta de stock bajo')} hint={t('config.inventory.lowStockHint', 'Fracción del stock mínimo. 0.20 = alerta cuando stock ≤ 20% del mínimo.')}>
                  <input className="field-input mono" value={config.lowStockThreshold}
                    onChange={e => set('lowStockThreshold', e.target.value)} placeholder="0.20" />
                </Field>
              </Section>

              <div className="cfg-preview">
                <div className="cfg-preview-title">{t('config.inventory.methodDifference', 'Diferencia entre métodos')}</div>
                <div className="cfg-readonly" style={{ fontFamily: 'var(--font-sans)', lineHeight: 1.7 }}>
                  <strong>{t('config.inventory.weightedAverage', 'Promedio Ponderado')}:</strong> {t('config.inventory.weightedAverageDesc', 'el costo unitario se recalcula cada vez que entra mercancía nueva. Más simple y estable.')}<br />
                  <strong>{t('config.inventory.fifo', 'PEPS')}:</strong> {t('config.inventory.fifoDesc', 'se vende primero el lote más antiguo. Refleja mejor el valor real en contextos inflacionarios. Requiere control de lotes.')}
                </div>
              </div>
            </div>
          )}

          {tab === 'smtp' && (
            <div className="card cfg-card">
              <div className="cfg-note info">
                <Icon name="bell" size={18} />
                {t('config.smtp.note', 'El correo SMTP se usa para enviar facturas en PDF al cliente al momento del cierre de venta.')}
              </div>
              <Section title={t('config.smtp.sectionTitle', 'Servidor de correo saliente (SMTP)')} icon="bell">
                <Field label={t('config.smtp.host', 'Host SMTP')}>
                  <input className="field-input mono" placeholder="smtp.ejemplo.com"
                    value={mail.host} onChange={(e) => setM('host', e.target.value)} />
                </Field>
                <Field label={t('config.smtp.port', 'Puerto')} hint="587 con STARTTLS · 465 con SSL">
                  <input className="field-input mono" type="number" min="1" max="65535" placeholder="587"
                    value={mail.port} onChange={(e) => setM('port', e.target.value)} />
                </Field>
                <Field label={t('config.smtp.security', 'Cifrado')}>
                  <Autocomplete value={mail.security} onChange={(id) => setM('security', id || 'starttls')}
                    options={[
                      { id: 'starttls', name: 'STARTTLS (recomendado)' },
                      { id: 'ssl', name: 'SSL/TLS' },
                      { id: 'none', name: 'Sin cifrado' },
                    ]}
                    allowClear={false} emptyText="Sin opciones" aria-label="Cifrado" />
                </Field>
                <Field label={t('config.smtp.enabled', 'Estado')}>
                  <Autocomplete value={mail.enabled ? 'on' : 'off'} onChange={(id) => setM('enabled', id === 'on')}
                    options={[{ id: 'off', name: 'Desactivado' }, { id: 'on', name: 'Activo' }]}
                    allowClear={false} emptyText="Sin opciones" aria-label="Estado del correo" />
                </Field>
                <Field label={t('config.smtp.user', 'Usuario SMTP')} span={2}>
                  <input className="field-input" type="email" autoComplete="username"
                    value={mail.username} onChange={(e) => setM('username', e.target.value)} />
                </Field>
                <Field label={t('config.smtp.password', 'Contraseña SMTP')} span={2}
                  hint={hasPassword
                    ? t('config.smtp.existingCredHint', 'Ya hay credenciales guardadas. Déjalo vacío para no cambiarlas.')
                    : t('config.smtp.noCredHint', 'Aún no hay contraseña guardada.')}>
                  <SecretInput
                    value={mail.password}
                    onChange={(e) => setM('password', e.target.value)}
                    placeholder={hasPassword ? '••••••••' : ''} />
                </Field>
                <Field label={t('config.smtp.fromEmail', 'Correo remitente (From)')}
                  hint={t('config.smtp.fromEmailHint', 'Ej: facturas@tuempresa.gt')}>
                  <input className="field-input" type="email"
                    value={mail.fromEmail} onChange={(e) => setM('fromEmail', e.target.value)} />
                </Field>
                <Field label={t('config.smtp.fromName', 'Nombre del remitente')}
                  hint={t('config.smtp.fromNameHint', 'Lo que ve el cliente como emisor')}>
                  <input className="field-input"
                    value={mail.fromName} onChange={(e) => setM('fromName', e.target.value)} />
                </Field>
              </Section>

              {/* Guarda y autentica contra el servidor sin mandar ningún
                  mensaje. Sin esto, la primera noticia de que la contraseña
                  está mal sería una factura que no llegó. */}
              <div className="mail-test">
                <Button type="button" icon="bolt" onClick={probarCorreo} disabled={probando}>
                  {probando ? 'Probando…' : 'Probar conexión'}
                </Button>
                {correoSinGuardar && (
                  <span className="mail-test-result is-warn">
                    <Icon name="info" size={15} />
                    Se prueba la configuración guardada. Hay cambios sin guardar que no entran en la prueba.
                  </span>
                )}
                {prueba && (
                  <span className={`mail-test-result ${prueba.ok ? 'is-ok' : 'is-fail'}`}>
                    <Icon name={prueba.ok ? 'check' : 'alert'} size={15} />
                    {prueba.message}
                  </span>
                )}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <Button icon="check" variant="accent" type="submit" disabled={saving}>
              {saving ? t('config.saving', 'Guardando…') : t('config.saveChanges', 'Guardar cambios')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
