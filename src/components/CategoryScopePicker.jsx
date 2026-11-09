import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Button from './Button.jsx';
import Icon from './Icon.jsx';
import { startCategoryDiscovery, getCategoryDiscovery, saveCategorySelection } from '../api/supplierIngestion.js';
import styles from './CategoryScopePicker.module.css';

const POLL_MS = 2000;
const MAX_WAIT_MS = 10 * 60 * 1000;

function IndeterminateCheckbox({ state, onChange, label }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === 'some';
  }, [state]);
  return (
    <input ref={ref} type="checkbox" className={styles.checkbox} checked={state === 'all'}
      onChange={onChange} aria-label={label} />
  );
}

// External category tree exposed by the site crawler. Selecting a parent selects
// all descendants recursively. It is not mapped to Stackline's internal categories.
export default function CategoryScopePicker({ websiteId, onScopeChange, discoverRequested = 0, onDiscoveryPhaseChange,
  initialNodes = null, initialScope = null, initialRunId = null }) {
  const [phase, setPhase] = useState('idle'); // idle | discovering | ready | error
  const [nodes, setNodes] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [activeRunId, setActiveRunId] = useState(initialRunId);
  const [expanded, setExpanded] = useState(() => new Set());
  const [error, setError] = useState('');
  const aliveRef = useRef(true);
  const lastRequestRef = useRef(0);

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);
  useEffect(() => {
    console.info('[category-discovery] phase:', phase, 'websiteId:', websiteId);
    onDiscoveryPhaseChange?.(phase);
  }, [phase, websiteId, onDiscoveryPhaseChange]);
  useEffect(() => { // changing the site invalidates the tree
    lastRequestRef.current = 0;
    setActiveRunId(null);
    setPhase('idle'); setNodes([]); setSelected(new Set()); setExpanded(new Set()); setError('');
  }, [websiteId]);

  useEffect(() => {
    if (!initialNodes?.length) return;
    setActiveRunId(initialRunId || null);
    setNodes(initialNodes);
    setSelected(new Set((initialScope || []).map((item) => item.id)));
    setExpanded(new Set(initialNodes.filter((node) => !node.parentId).map((node) => node.id)));
    setPhase('ready');
  }, [initialNodes, initialScope, initialRunId]);

  const { byId, childrenOf, roots } = useMemo(() => {
    const map = new Map(nodes.map((node) => [node.id, node]));
    const kids = new Map();
    const top = [];
    nodes.forEach((node) => {
      if (node.parentId && map.has(node.parentId)) {
        if (!kids.has(node.parentId)) kids.set(node.parentId, []);
        kids.get(node.parentId).push(node);
      } else {
        top.push(node);
      }
    });
    return { byId: map, childrenOf: kids, roots: top };
  }, [nodes]);

  const descendantsOf = useCallback((id) => {
    const out = [];
    const stack = [...(childrenOf.get(id) || [])];
    while (stack.length) {
      const node = stack.pop();
      out.push(node.id);
      stack.push(...(childrenOf.get(node.id) || []));
    }
    return out;
  }, [childrenOf]);

  const stateOf = useCallback((id) => {
    const ids = [id, ...descendantsOf(id)];
    const count = ids.filter((item) => selected.has(item)).length;
    if (count === 0) return 'none';
    return count === ids.length ? 'all' : 'some';
  }, [descendantsOf, selected]);

  // Emit the selected external scope with its path from the root.
  useEffect(() => {
    if (phase !== 'ready' || selected.size === 0) { onScopeChange?.(null); return; }
    const pathOf = (node) => {
      const path = [];
      let current = node;
      while (current) { path.unshift(current.name); current = current.parentId ? byId.get(current.parentId) : null; }
      return path;
    };
    const scope = nodes.filter((node) => selected.has(node.id)).map((node) => ({
      id: node.id, url: node.url, path: pathOf(node),
    }));
    onScopeChange?.(scope);
    if (activeRunId) {
      const tree = nodes.map((node) => ({ id: node.id, name: node.name, url: node.url, parentId: node.parentId || null }));
      saveCategorySelection(Number(websiteId), activeRunId, scope, tree)
        .then(() => console.info('[category-discovery] selection saved', { websiteId, runId: activeRunId, count: scope.length }))
        .catch((err) => console.error('[category-discovery] selection save failed', { websiteId, runId: activeRunId, message: err?.message }));
    }
  }, [phase, selected, nodes, byId, onScopeChange, activeRunId, websiteId]);

  const toggle = (id) => {
    const ids = [id, ...descendantsOf(id)];
    setSelected((current) => {
      const next = new Set(current);
      const fullySelected = ids.every((item) => next.has(item));
      ids.forEach((item) => (fullySelected ? next.delete(item) : next.add(item)));
      return next;
    });
  };

  const toggleExpanded = (id) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const discoveryStorageKey = websiteId ? `stackline:category-discovery-run:${websiteId}` : null;

  const pollDiscovery = async (discoveryRunId) => {
    console.info('[category-discovery] polling started', { websiteId, runId: discoveryRunId });
    const deadline = Date.now() + MAX_WAIT_MS;
    let state = { status: 'RUNNING' };
    const statusOf = (value) => String(value?.status || value?.result?.status || '').toUpperCase();
    while (aliveRef.current && statusOf(state) === 'RUNNING') {
      if (Date.now() > deadline) throw new Error('El descubrimiento de categorías tardó demasiado.');
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      if (!aliveRef.current) return;
      console.info('[category-discovery] GET status request', { websiteId, runId: discoveryRunId });
      state = await getCategoryDiscovery(Number(websiteId), discoveryRunId, { silent: true });
      console.info('[category-discovery] GET status response', {
        websiteId,
        runId: discoveryRunId,
        status: state?.status,
        categoryCount: Array.isArray(state?.categories) ? state.categories.length : Array.isArray(state?.result?.categories) ? state.result.categories.length : 0,
      });
    }
    if (!aliveRef.current) return;
    const categories = Array.isArray(state.categories)
      ? state.categories
      : Array.isArray(state.result?.categories) ? state.result.categories : [];
    if (statusOf(state) !== 'COMPLETED' && !categories.length) {
      throw new Error(state.error || state.result?.error?.message || 'No se pudieron descubrir las categorías.');
    }
    if (discoveryStorageKey) window.localStorage.removeItem(discoveryStorageKey);
    setSelected(new Set(categories.map((node) => node.id)));
    console.info('[category-discovery] completed; rendering category tree', {
      websiteId,
      runId: discoveryRunId,
      categoryCount: categories.length,
    });
    setNodes(categories);
    setExpanded(new Set(categories.filter((node) => !node.parentId).map((node) => node.id)));
    setPhase('ready');
  };

  const discover = async () => {
    let discoveryRunId = null;
    setPhase('discovering'); setError(''); setNodes([]); setSelected(new Set());
    try {
      const started = await startCategoryDiscovery(Number(websiteId));
      discoveryRunId = started.runId || started.run_id;
      if (!discoveryRunId) throw new Error('El backend no devolvió el run_id del descubrimiento.');
      setActiveRunId(discoveryRunId);
      if (discoveryStorageKey) window.localStorage.setItem(discoveryStorageKey, discoveryRunId);
      await pollDiscovery(discoveryRunId);
    } catch (err) {
      console.error('[category-discovery] polling failed', {
        websiteId,
        runId: discoveryRunId,
        message: err?.message,
        status: err?.status,
      });
      if (!aliveRef.current) return;
      if (discoveryStorageKey) window.localStorage.removeItem(discoveryStorageKey);
      setError(err.message); setPhase('error');
    }
  };

  useEffect(() => {
    const storedRunId = discoveryStorageKey && window.localStorage.getItem(discoveryStorageKey);
    if (!storedRunId || !websiteId) return undefined;
    setActiveRunId(storedRunId);
    setPhase('discovering');
    pollDiscovery(storedRunId).catch((err) => {
      console.error('[category-discovery] resume polling failed', {
        websiteId,
        runId: storedRunId,
        message: err?.message,
        status: err?.status,
      });
      if (!aliveRef.current) return;
      window.localStorage.removeItem(discoveryStorageKey);
      setError(err.message); setPhase('error');
    });
    return undefined;
  }, [websiteId, discoveryStorageKey]);

  useEffect(() => {
    if (!discoverRequested || discoverRequested === lastRequestRef.current || !websiteId) return;
    lastRequestRef.current = discoverRequested;
    if (discoverRequested === 0) return;
    console.info('[category-discovery] start requested by Execute crawling', { websiteId, request: discoverRequested });
    discover();
  }, [discoverRequested, websiteId]);

  const renderNode = (node, depth) => {
    const kids = childrenOf.get(node.id) || [];
    const open = expanded.has(node.id);
    return (
      <li key={node.id} role="treeitem" aria-expanded={kids.length ? open : undefined}>
        <div className={styles.row} style={{ paddingLeft: depth * 20 }}>
          {kids.length ? (
            <button type="button" className={`${styles.expander} ${open ? styles.open : ''}`}
              onClick={() => toggleExpanded(node.id)} aria-label={open ? 'Contraer' : 'Expandir'}>
              <Icon name="chevronRight" size={14} />
            </button>
          ) : <span className={styles.expanderSpace} />}
          <label className={styles.label}>
            <IndeterminateCheckbox state={stateOf(node.id)} onChange={() => toggle(node.id)} label={`Incluir ${node.name}`} />
            <Icon name={kids.length ? 'folder' : 'box'} size={14} />
            <span>{node.name}</span>
          </label>
        </div>
        {kids.length > 0 && open && <ul role="group" className={styles.list}>{kids.map((child) => renderNode(child, depth + 1))}</ul>}
      </li>
    );
  };

  const setAll = (value) => setSelected(value ? new Set(nodes.map((node) => node.id)) : new Set());

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div>
          <b>Alcance por categorías</b>
          <div className="muted body-small">
            Al ejecutar el crawling se descubren primero las categorías del sitio. Después eliges de cuáles bajar productos.
          </div>
        </div>
      </div>
      {phase === 'discovering' && <div className="muted body-small" role="status">Explorando las categorías del sitio… puede tardar unos minutos la primera vez.</div>}
      {phase === 'error' && <div className="cfg-hint" role="alert">{error}</div>}
      {phase === 'ready' && (
        <>
          <div className={styles.toolbar}>
            <span className="badge-m3">Categorías <b>{nodes.length}</b></span>
            <span className="badge-m3">Seleccionadas <b>{selected.size}</b></span>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAll(true)}>Seleccionar todas</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAll(false)}>Limpiar</Button>
          </div>
          <ul role="tree" className={`${styles.list} ${styles.tree}`}>{roots.map((node) => renderNode(node, 0))}</ul>
        </>
      )}
    </div>
  );
}
