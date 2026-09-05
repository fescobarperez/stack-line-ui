// Stackline — Búsqueda global ⌘K
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from './Icon.jsx';
import { getSearch } from '../api/search.js';

const Q = (v) => `Q ${Number(v || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function computeResults(query, navItems, t, remote) {
  const q = query.toLowerCase().trim();

  const QUICK_ACTIONS = [
    { key: 'qa-pos',       title: t('search.qa.newSale'),     subtitle: t('search.qa.newSaleDesc'),       icon: 'pos',     route: 'pos',       tag: t('search.tags.quickAction') },
    { key: 'qa-billing',   title: t('search.qa.newInvoice'),  subtitle: t('search.qa.newInvoiceDesc'),    icon: 'receipt', route: 'billing',   tag: t('search.tags.quickAction') },
    { key: 'qa-client',    title: t('search.qa.newClient'),   subtitle: t('search.qa.newClientDesc'),     icon: 'user',    route: 'clients',   tag: t('search.tags.quickAction') },
    { key: 'qa-purchase',  title: t('search.qa.newPurchase'), subtitle: t('search.qa.newPurchaseDesc'),   icon: 'truck',   route: 'purchases', tag: t('search.tags.quickAction') },
    { key: 'qa-inventory', title: t('search.qa.viewInventory'), subtitle: t('search.qa.viewInventoryDesc'), icon: 'box',  route: 'inventory', tag: t('search.tags.quickAction') },
    { key: 'qa-quotes',    title: t('search.qa.newQuote'),    subtitle: t('search.qa.newQuoteDesc'),      icon: 'receipt', route: 'quotes',    tag: t('search.tags.quickAction') },
  ];

  if (!q) {
    return [{ label: t('search.groups.quickActions'), items: QUICK_ACTIONS }];
  }

  const groups = [];

  const navMatches = navItems
    .filter(n => n.label.toLowerCase().includes(q))
    .slice(0, 6)
    .map(n => ({
      key: 'nav-' + n.id,
      title: n.label,
      subtitle: n.section,
      icon: n.icon,
      route: n.id,
      tag: t('search.tags.module'),
    }));
  if (navMatches.length) groups.push({ label: t('search.groups.modules'), items: navMatches });

  const actionMatches = QUICK_ACTIONS.filter(
    a => a.title.toLowerCase().includes(q) || a.subtitle.toLowerCase().includes(q)
  );
  if (actionMatches.length) groups.push({ label: t('search.groups.actions'), items: actionMatches });

  // Productos y clientes vienen del backend (búsqueda global), con fallback al mock.
  const productMatches = (remote?.products || []).slice(0, 5).map(p => ({
    key: 'prod-' + p.id,
    title: p.name,
    subtitle: 'SKU ' + p.sku + ' · ' + Q(p.price),
    icon: 'box',
    route: 'inventory',
    tag: t('search.tags.product'),
  }));
  if (productMatches.length) groups.push({ label: t('search.groups.products'), items: productMatches });

  const clientMatches = (remote?.clients || []).slice(0, 5).map(c => ({
    key: 'client-' + c.id,
    title: c.name,
    subtitle: 'NIT ' + c.nit,
    icon: 'user',
    route: 'clients',
    tag: t('search.tags.client'),
  }));
  if (clientMatches.length) groups.push({ label: t('search.groups.clients'), items: clientMatches });

  return groups;
}

export function GlobalSearch({ navItems, onClose, onNavigate }) {
  const { t } = useTranslation();
  const [query, setQuery]       = useState('');
  const [remote, setRemote]     = useState({ products: [], clients: [] });
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef  = useRef(null);
  const resultsRef = useRef(null);
  const activeRef  = useRef(null);

  // Busca productos/clientes en el backend (debounced). Si falla, cae al mock local.
  useEffect(() => {
    const q = query.trim();
    if (!q) { setRemote({ products: [], clients: [] }); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await getSearch(q);
        if (!cancelled) setRemote({ products: res.products || [], clients: res.clients || [] });
      } catch {
        if (!cancelled) setRemote({ products: [], clients: [] });
      }
    }, 200);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query]);

  const results   = useMemo(() => computeResults(query, navItems, t, remote), [query, navItems, t, remote]);
  const flatItems = useMemo(() => results.flatMap(g => g.items), [results]);

  // Reset active cuando cambia el query
  useEffect(() => { setActiveIdx(0); }, [query]);

  // Scroll al ítem activo
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  // Keyboard: ↑↓ Enter Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx(i => Math.min(i + 1, flatItems.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx(i => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const item = flatItems[activeIdx];
        if (item) handleSelect(item);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [flatItems, activeIdx]);

  const handleSelect = (item) => {
    onNavigate(item.route);
    onClose();
  };

  let globalIdx = -1;

  return (
    <div className="gsearch-overlay" onMouseDown={onClose}>
      <div className="gsearch-box" onMouseDown={e => e.stopPropagation()}>

        {/* Input */}
        <div className="gsearch-header">
          <Icon name="search" size={16} style={{ color: 'var(--muted)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('search.placeholder')}
            className="gsearch-input"
          />
          {query && (
            <button
              className="icon-btn"
              style={{ flexShrink: 0 }}
              onClick={() => { setQuery(''); inputRef.current?.focus(); }}
            >
              <Icon name="x" size={12} />
            </button>
          )}
          <span className="kbd" style={{ flexShrink: 0 }}>Esc</span>
        </div>

        {/* Resultados */}
        <div className="gsearch-results" ref={resultsRef}>
          {results.length === 0 ? (
            <div className="gsearch-empty">
              <Icon name="search" size={24} style={{ color: 'var(--border-strong)', marginBottom: 8 }} />
              <div>{t('search.noResults')} <strong>"{query}"</strong></div>
              <div style={{ fontSize: 11, marginTop: 4 }}>{t('search.noResultsHint')}</div>
            </div>
          ) : results.map(group => (
            <div key={group.label}>
              <div className="gsearch-group">{group.label}</div>
              {group.items.map(item => {
                globalIdx++;
                const idx = globalIdx;
                const isActive = idx === activeIdx;
                return (
                  <div
                    key={item.key}
                    ref={isActive ? activeRef : null}
                    className={`gsearch-item${isActive ? ' active' : ''}`}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setActiveIdx(idx)}
                  >
                    <span className="gsearch-item-icon">
                      <Icon name={item.icon} size={14} />
                    </span>
                    <div className="gsearch-item-text">
                      <span className="gsearch-item-title">{item.title}</span>
                      {item.subtitle && (
                        <span className="gsearch-item-sub">{item.subtitle}</span>
                      )}
                    </div>
                    {item.alert && (
                      <span className="gsearch-item-alert">{item.alert}</span>
                    )}
                    <span className="gsearch-item-tag">{item.tag}</span>
                    {isActive && (
                      <span className="gsearch-item-enter">
                        <Icon name="return" size={11} />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer de atajos */}
        <div className="gsearch-footer">
          <span><kbd>↑↓</kbd> {t('search.hints.navigate')}</span>
          <span><kbd>Enter</kbd> {t('search.hints.open')}</span>
          <span><kbd>Esc</kbd> {t('search.hints.close')}</span>
          <span style={{ marginLeft: 'auto', opacity: 0.6 }}>
            {flatItems.length} resultado{flatItems.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}

export default GlobalSearch;
