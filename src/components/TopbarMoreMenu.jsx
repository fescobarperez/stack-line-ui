// Stackline — Menú «más» de la barra superior (solo teléfono).
//
// En el teléfono la barra superior no tiene espacio para el estado SAT, el
// idioma, el tema, la ayuda y el usuario: se juntan aquí, detrás de un botón
// ⋮. En tablet y escritorio el botón no se muestra (lo oculta el CSS) y esas
// opciones siguen en la barra.
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from './Icon.jsx';

export default function TopbarMoreMenu({
  user,                 // { name, initials, role, branch }
  language,             // 'es' | 'en'
  theme,                // 'light' | 'dark'
  satOnline = true,
  onToggleLanguage,
  onToggleTheme,
  onHelp,
  onLogout,
}) {
  const { t } = useTranslation();
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef(null);

  // Se cierra con un toque fuera o con Escape.
  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => { if (raiz.current && !raiz.current.contains(e.target)) setAbierto(false); };
    const tecla = (e) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('pointerdown', fuera);
    window.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('pointerdown', fuera);
      window.removeEventListener('keydown', tecla);
    };
  }, [abierto]);

  // Cada opción hace lo suyo y cierra el menú.
  const elegir = (accion) => () => { setAbierto(false); accion?.(); };

  return (
    <div className="topbar-more" ref={raiz}>
      <button
        type="button"
        className="icon-btn"
        aria-label={t('shell.moreOptions', 'Más opciones')}
        aria-haspopup="menu"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
      >
        <Icon name="dots" size={24} />
      </button>

      {abierto && (
        <div className="topbar-more-panel" role="menu" aria-label={t('shell.moreOptions', 'Más opciones')}>
          <div className="topbar-more-user">
            <div className="avatar">{user?.initials}</div>
            <div className="topbar-more-user-text">
              <div className="title-small">{user?.name}</div>
              <div className="body-small muted">{[user?.role, user?.branch].filter(Boolean).join(' · ')}</div>
            </div>
          </div>

          <div className="topbar-more-status">
            <span className={`badge-m3 ${satOnline ? 'success' : 'danger'}`}>
              <span className="dot" />
              {satOnline ? t('shell.satOnline', 'SAT-FEL en línea') : t('shell.satOffline', 'SAT-FEL sin conexión')}
            </span>
          </div>

          <button type="button" role="menuitem" className="topbar-more-item" onClick={elegir(onToggleLanguage)}>
            <Icon name="language" size={20} />
            <span>{t('common.language', 'Idioma')}</span>
            <span className="topbar-more-value">{language === 'es' ? 'Español' : 'English'}</span>
          </button>
          <button type="button" role="menuitem" className="topbar-more-item" onClick={elegir(onToggleTheme)}>
            <Icon name={theme === 'dark' ? 'light_mode' : 'moon'} size={20} />
            <span>{t('common.theme', 'Tema')}</span>
            <span className="topbar-more-value">
              {theme === 'dark' ? t('shell.themeDark', 'Oscuro') : t('shell.themeLight', 'Claro')}
            </span>
          </button>
          <button type="button" role="menuitem" className="topbar-more-item" onClick={elegir(onHelp)}>
            <Icon name="help" size={20} />
            <span>{t('common.help', 'Ayuda')}</span>
          </button>
          <button type="button" role="menuitem" className="topbar-more-item danger" onClick={elegir(onLogout)}>
            <Icon name="lock" size={20} />
            <span>{t('common.logout', 'Cerrar sesión')}</span>
          </button>
        </div>
      )}
    </div>
  );
}
