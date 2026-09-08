// Constructor de cotización desde materiales del proyecto (modelo
// cotización-céntrico, Fase 1). Reutiliza el MISMO árbol de "Materiales del
// proyecto": carpetas y subcarpetas, selección múltiple (shift/ctrl + clic,
// shift + flechas) y la posibilidad de tomar una carpeta entera como línea.
// El cliente solo ve la descripción y el precio; los materiales quedan
// internos. No hay entrada manual de productos.
import React, { useEffect, useMemo, useState } from 'react';
import Button from '../components/Button.jsx';
import Icon from '../components/Icon.jsx';
import TreeView from './TreeView.jsx';
import treeStyles from './TreeView.module.css';
import useTreeSelection from '../hooks/useTreeSelection.js';
import { getProjectMaterials, createProjectQuoteFromMaterials, appendProjectQuoteLines } from '../api/projectMaterials.js';
import { addQuoteCharge, listQuotes } from '../api/wave2.js';
import { useTranslation } from 'react-i18next';

const Q = (n) => `Q ${Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const matAmount = (m) => Number(m.estimatedAmount || 0);

export default function QuoteBuilderModal({ project, onClose, onCreated, pushToast }) {
  const { t } = useTranslation();
  const [plan, setPlan] = useState(null);
  const [draftQuotes, setDraftQuotes] = useState([]);
  const [targetQuoteId, setTargetQuoteId] = useState('new');
  const [targetLineId, setTargetLineId] = useState('new');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedKeys, setSelectedKeys] = useState([]);
  // Líneas: { key, description, sourceGroupId, sellPrice, cost, materialIds[], materialLabels[] }
  const [lines, setLines] = useState([]);
  // Cargos manuales que se agregarán tras crear la cotización.
  // { key, calcType: 'fixed'|'percent', category, description, value }
  const [charges, setCharges] = useState([]);
  const [validUntil, setValidUntil] = useState('');
  const today = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const [profit, setProfit] = useState({ calcType: 'fixed', value: '' });
  const setProfitField = (k, v) => setProfit((f) => ({ ...f, [k]: v }));
  const [charge, setCharge] = useState({ calcType: 'fixed', category: '', description: '', value: '' });
  const setCh = (k, v) => setCharge((f) => ({ ...f, [k]: v }));
  const addCharge = () => {
    const value = parseFloat(charge.value);
    if (!charge.description.trim() || !(value >= 0)) return;
    setCharges((prev) => [...prev, { key: Date.now() + Math.random(), calcType: charge.calcType, category: charge.category.trim(), description: charge.description.trim(), value }]);
    setCharge({ calcType: 'fixed', category: '', description: '', value: '' });
  };
  const removeCharge = (key) => setCharges((prev) => prev.filter((c) => c.key !== key));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getProjectMaterials(project.id)
      .then((p) => { if (alive) { setPlan(p); setError(null); } })
      .catch((err) => { if (alive) setError(err); })
      .finally(() => { if (alive) setLoading(false); });
    listQuotes({ partyType: 'client', size: 200 })
      .then((page) => {
        if (!alive) return;
        const rows = Array.isArray(page) ? page : (page?.content || []);
        setDraftQuotes(rows.filter((quote) => Number(quote.projectId) === Number(project.id)
          && ['borrador', 'draft'].includes(String(quote.status).toLowerCase())));
      })
      .catch(() => { if (alive) setDraftQuotes([]); });
    return () => { alive = false; };
  }, [project.id]);

  const groups = useMemo(() => (plan?.groups || []), [plan]);
  const ungrouped = useMemo(() => (plan?.ungrouped || []), [plan]);

  // Materiales por grupo, solo los disponibles (quote_id == null) y no usados
  // por una línea en construcción.
  const usedIds = useMemo(() => {
    const s = new Set();
    lines.forEach((l) => l.materialIds.forEach((id) => s.add(id)));
    return s;
  }, [lines]);
  const isAvailable = (m) => m.quoteId == null && !usedIds.has(m.id);

  const materialsByGroup = useMemo(() => groups.reduce((acc, g) => {
    acc[g.id] = (g.materials || []);
    return acc;
  }, {}), [groups]);

  // Costo recursivo de una carpeta (directos + subcarpetas), solo disponibles.
  const childrenByGroup = useMemo(() => groups.reduce((acc, g) => {
    if (g.parentGroupId != null) {
      const pid = Number(g.parentGroupId);
      acc[pid] = [...(acc[pid] || []), Number(g.id)];
    }
    return acc;
  }, {}), [groups]);
  const materialIdsOfGroup = (groupId, visiting = new Set()) => {
    if (visiting.has(groupId)) return [];
    const next = new Set(visiting).add(groupId);
    const direct = (materialsByGroup[groupId] || []).filter(isAvailable).map((m) => m.id);
    const nested = (childrenByGroup[Number(groupId)] || []).flatMap((c) => materialIdsOfGroup(c, next));
    return [...direct, ...nested];
  };

  // Árbol para TreeView, con solo materiales disponibles bajo cada carpeta.
  const tree = useMemo(() => {
    const rows = [{ id: 'project-root', parent: 0, text: 'Raíz del proyecto', droppable: true, data: { kind: 'root' } }];
    ungrouped.filter(isAvailable).forEach((m) => rows.push({
      id: `material:${m.id}`, parent: 'project-root',
      text: m.productName || m.sku || `#${m.id}`, data: { kind: 'material', material: m },
    }));
    groups.forEach((g) => {
      rows.push({ id: `group:${g.id}`, parent: g.parentGroupId == null ? 'project-root' : `group:${g.parentGroupId}`, text: g.name, droppable: true, data: { kind: 'group', groupId: g.id, group: g } });
      (materialsByGroup[g.id] || []).filter(isAvailable).forEach((m) => rows.push({
        id: `material:${m.id}`, parent: `group:${g.id}`,
        text: m.productName || m.sku || `#${m.id}`, data: { kind: 'material', material: m },
      }));
    });
    return rows;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, materialsByGroup, ungrouped, usedIds]);

  const materialNodes = tree.filter((n) => n.data?.kind === 'material');
  const { select, extend } = useTreeSelection(materialNodes, {
    selectedKeys,
    getKey: (node) => String(node.id),
    onChange: (keys) => setSelectedKeys(keys),
  });

  const selectedMaterialIds = selectedKeys
    .filter((k) => k.startsWith('material:'))
    .map((k) => Number(k.slice('material:'.length)));
  const allMaterials = useMemo(() => {
    const flat = [...ungrouped.map((m) => ({ ...m, groupId: m.groupId ?? null }))];
    groups.forEach((g) => (g.materials || []).forEach((m) => flat.push({ ...m, groupId: g.id })));
    return new Map(flat.map((m) => [m.id, m]));
  }, [groups, ungrouped]);
  const selectedCost = selectedMaterialIds.reduce((s, id) => s + matAmount(allMaterials.get(id) || {}), 0);

  const addLine = (description, sourceGroupId, materialIds) => {
    const ids = materialIds.filter((id) => isAvailable(allMaterials.get(id) || { quoteId: 1 }));
    if (ids.length === 0) return;
    const cost = ids.reduce((s, id) => s + matAmount(allMaterials.get(id) || {}), 0);
    setLines((prev) => [...prev, {
      key: Date.now() + Math.random(),
      targetItemId: null,
      description: description || '',
      sourceGroupId: sourceGroupId ?? null,
      sellPrice: cost,
      cost,
      materialIds: ids,
      materialLabels: ids.map((id) => allMaterials.get(id)?.productName || `#${id}`),
    }]);
    setSelectedKeys([]);
  };

  const addMaterialsToLine = (lineKey, materialIds) => {
    const ids = materialIds.filter((id) => isAvailable(allMaterials.get(id) || { quoteId: 1 }));
    if (ids.length === 0) return;
    const addedCost = ids.reduce((s, id) => s + matAmount(allMaterials.get(id) || {}), 0);
    setLines((prev) => prev.map((line) => String(line.key) === String(lineKey) ? {
      ...line,
      sellPrice: Number(line.sellPrice || 0) + addedCost,
      cost: Number(line.cost || 0) + addedCost,
      materialIds: [...line.materialIds, ...ids],
      materialLabels: [...line.materialLabels, ...ids.map((id) => allMaterials.get(id)?.productName || `#${id}`)],
    } : line));
    setSelectedKeys([]);
  };

  const addMaterialsToDraftLine = (itemId, materialIds) => {
    const draftItem = (draftQuotes.find((draft) => String(draft.id) === String(targetQuoteId))?.items || [])
      .find((item) => String(item.id) === String(itemId));
    if (!draftItem) return;
    const pendingKey = `draft:${itemId}`;
    const existingPending = lines.find((line) => line.key === pendingKey);
    if (existingPending) {
      addMaterialsToLine(pendingKey, materialIds);
      return;
    }
    const ids = materialIds.filter((id) => isAvailable(allMaterials.get(id) || { quoteId: 1 }));
    if (ids.length === 0) return;
    const addedCost = ids.reduce((s, id) => s + matAmount(allMaterials.get(id) || {}), 0);
    setLines((prev) => [...prev, {
      key: pendingKey,
      targetItemId: Number(itemId),
      description: draftItem.productName || `Línea ${itemId}`,
      sourceGroupId: null,
      sellPrice: addedCost,
      cost: addedCost,
      materialIds: ids,
      materialLabels: ids.map((id) => allMaterials.get(id)?.productName || `#${id}`),
    }]);
    setSelectedKeys([]);
  };

  const addSelectionAsLine = () => {
    const ids = selectedMaterialIds;
    if (ids.length === 0) return;
    if (targetLineId.startsWith('draft:')) {
      addMaterialsToDraftLine(targetLineId.slice('draft:'.length), ids);
      return;
    }
    if (targetLineId.startsWith('local:')) {
      addMaterialsToLine(targetLineId.slice('local:'.length), ids);
      return;
    }
    // Si todos son de una misma carpeta, esa es el origen (default de descripción).
    const groupIds = [...new Set(ids.map((id) => allMaterials.get(id)?.groupId).filter((g) => g != null))];
    const sole = groupIds.length === 1 ? groupIds[0] : null;
    const name = sole != null ? (groups.find((g) => g.id === sole)?.name || '') : '';
    addLine(name, sole, ids);
  };

  const addFolderAsLine = (group) => {
    const ids = materialIdsOfGroup(group.id);
    if (ids.length === 0) {
      pushToast?.(t('quotes.folderEmpty', 'Esa carpeta no tiene materiales disponibles'), 'danger');
      return;
    }
    addLine(group.name, group.id, ids);
  };

  const setLine = (key, k, v) => setLines((prev) => prev.map((l) => l.key === key ? { ...l, [k]: v } : l));
  const removeLine = (key) => setLines((prev) => prev.filter((l) => l.key !== key));

  const total = lines.reduce((s, l) => s + Number(l.sellPrice || 0), 0);
  const appendingToDraft = targetQuoteId !== 'new';
  const canSave = (appendingToDraft || (Boolean(validUntil) && validUntil >= today))
    && lines.length > 0
    && lines.every((l) => Number(l.sellPrice) >= 0 && l.materialIds.length > 0);

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      const payload = {
        ...(appendingToDraft ? {} : { quoteDate: today, validUntil }),
        lines: lines.map((l) => ({
          description: (l.description || '').trim() || null,
          sourceGroupId: l.sourceGroupId ?? null,
          targetItemId: l.targetItemId ?? null,
          uom: 'servicio',
          sellPrice: Number(l.sellPrice) || 0,
          materialIds: l.materialIds,
        })),
        ...(appendingToDraft ? {} : {
          profitCalcType: profit.calcType,
          profitValue: Number(profit.value) || 0,
        }),
      };
      const res = appendingToDraft
        ? await appendProjectQuoteLines(project.id, Number(targetQuoteId), payload)
        : await createProjectQuoteFromMaterials(project.id, payload);
      const quoteId = res?.quoteId;
      // Persistir los cargos manuales capturados en el builder.
      if (!appendingToDraft && quoteId && charges.length) {
        for (const c of charges) {
          await addQuoteCharge(quoteId, {
            calcType: c.calcType,
            category: c.category || null,
            description: c.description,
            value: c.value,
          });
        }
      }
      pushToast?.(appendingToDraft
        ? t('quotes.linesAddedToDraft', 'Líneas agregadas al borrador')
        : t('quotes.builderCreated', 'Cotización creada desde materiales'), 'success');
      onCreated?.(quoteId);
    } catch (err) {
      pushToast?.(t('quotes.builderFailed', 'No se pudo crear la cotización: ') + err.message, 'danger');
    } finally { setBusy(false); }
  };

  const renderNode = (node, { depth, isOpen, onToggle, handleRef }) => {
    const kind = node.data?.kind;
    const selected = selectedKeys.includes(String(node.id));
    const isFolder = kind === 'group';
    const isRoot = kind === 'root';
    const material = node.data?.material;
    const rowClass = [treeStyles.row, selected && treeStyles.selected].filter(Boolean).join(' ');
    const toggle = (isFolder || isRoot)
      ? <button type="button" className={treeStyles.toggle} onClick={(e) => { e.stopPropagation(); onToggle?.(); }} aria-label={isOpen ? 'Colapsar' : 'Expandir'}><Icon name={isOpen ? 'chevronDown' : 'chevronRight'} size={17} /></button>
      : <span className={treeStyles.toggleSpacer} />;
    const leading = isRoot ? <Icon name="home" size={18} /> : <Icon name={isFolder ? 'folder' : 'box'} size={17} fill={isFolder} />;
    const folderCost = isFolder ? materialIdsOfGroup(node.data.groupId).reduce((s, id) => s + matAmount(allMaterials.get(id) || {}), 0) : 0;
    const label = isRoot
      ? <><strong>Raíz del proyecto</strong><span className="muted">{materialNodes.length} disponibles</span></>
      : <><strong>{node.text}</strong><span className="muted">{isFolder
          ? `${materialIdsOfGroup(node.data.groupId).length} disponibles · ${Q(folderCost)}`
          : `${material?.sku || ''} · ${material?.quantityPlanned} ${material?.uom}`}</span></>;
    const onKeyDown = (e) => { if (kind === 'material') extend(node, e); };
    return (
      <div ref={handleRef} className={`tree-row ${rowClass}`} style={{ paddingLeft: 12 + depth * 22 }}
        onClick={kind === 'material' ? (e) => select(node, e) : undefined}
        onKeyDown={onKeyDown} tabIndex={kind === 'material' ? 0 : undefined}
        role={kind === 'material' ? 'option' : undefined} aria-selected={kind === 'material' ? selected : undefined}>
        {toggle}
        {leading}<span className={treeStyles.label}>{label}</span>
        {kind === 'material' && <span className="mono" style={{ fontSize: 12, opacity: .8 }}>{Q(material?.estimatedAmount)}</span>}
        {isFolder && (
          <div className={treeStyles.actions} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
            <Button type="button" variant="ghost" size="sm" icon="plus"
              onClick={() => addFolderAsLine(node.data.group)}>
              {t('quotes.folderAsLine', 'Carpeta como línea')}
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 900, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{appendingToDraft ? t('quotes.appendDraftTitle', 'Agregar líneas a cotización') : t('quotes.builderTitle', 'Nueva cotización desde materiales')} · {project.code}</h3>
          <button className="icon-btn" onClick={onClose}><Icon name="close" /></button>
        </div>

        <div className="modal-body" style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
          {/* Árbol de materiales disponibles */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', color: 'var(--muted)', marginBottom: 8 }}>
              {t('quotes.availableMaterials', 'MATERIALES DISPONIBLES')}
            </div>
            <div className="body-small muted" style={{ marginBottom: 8 }}>
              <Icon name="info" size={14} /> {t('quotes.treeHint', 'Selecciona materiales (shift/ctrl + clic) y créalos como línea, o toma una carpeta entera.')}
            </div>
            {loading && <div className="muted" style={{ fontSize: 12 }}>{t('common.loading', 'Cargando…')}</div>}
            {error && <div style={{ color: 'var(--danger)', fontSize: 12 }}>{t('quotes.materialsError', 'No se pudieron cargar los materiales.')}</div>}
            {!loading && !error && materialNodes.length === 0 && (
              <div className="muted" style={{ fontSize: 12 }}>
                {t('quotes.noAvailable', 'No hay materiales disponibles. Ya están en otra cotización o el proyecto no tiene materiales.')}
              </div>
            )}
            {!loading && !error && tree.length > 1 && (
              <TreeView tree={tree} rootId={0} initialOpen sort={false} canDrag={() => false} render={renderNode} />
            )}
            {selectedMaterialIds.length > 0 && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, marginBottom: 6 }}>
                  {selectedMaterialIds.length} {t('quotes.selected', 'seleccionados')} · {t('quotes.cost', 'costo')} {Q(selectedCost)}
                </div>
                <div className="field-group" style={{ marginBottom: 8 }}>
                  <label className="field-label">{t('quotes.lineDestination', 'Línea destino')}</label>
                  <select
                    className="field-input"
                    value={targetLineId}
                    onChange={(e) => setTargetLineId(e.target.value)}
                  >
                    <option value="new">{t('quotes.createNewLine', 'Crear una línea nueva')}</option>
                    {appendingToDraft && (draftQuotes.find((draft) => String(draft.id) === String(targetQuoteId))?.items || []).map((item) => (
                      <option key={`draft:${item.id}`} value={`draft:${item.id}`}>
                        {t('quotes.addToLine', 'Agregar a')} · {item.productName || `Línea ${item.id}`}
                      </option>
                    ))}
                    {lines.map((line, index) => (
                      <option key={`local:${line.key}`} value={`local:${line.key}`}>
                        {t('quotes.addToLine', 'Agregar a')} · {line.description || `${t('quotes.line', 'Línea')} ${index + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
                <Button icon="plus" variant="accent" onClick={addSelectionAsLine}>
                  {targetLineId === 'new' ? t('quotes.makeLine', 'Crear línea con la selección') : t('quotes.addMaterialsToLine', 'Agregar materiales a la línea')}
                </Button>
              </div>
            )}
          </div>

          {/* Líneas de la cotización */}
          <div>
            <div className="field-group" style={{ marginBottom: 16 }}>
              <label className="field-label">{t('quotes.lineDestination', 'Destino de las líneas')}</label>
              <select className="field-input" value={targetQuoteId} onChange={(e) => { setTargetQuoteId(e.target.value); setTargetLineId('new'); }}>
                <option value="new">{t('quotes.createNewQuote', 'Crear una cotización nueva')}</option>
                {draftQuotes.map((draft) => (
                  <option key={draft.id} value={draft.id}>{draft.docNumber} · {draft.clientName || 'Borrador'}</option>
                ))}
              </select>
            </div>
            {!appendingToDraft && (
              <div className="field-group" style={{ marginBottom: 16 }}>
                <label className="field-label">{t('quotes.validUntil', 'Fecha de expiración')} *</label>
                <input
                  className="field-input"
                  type="date"
                  value={validUntil}
                  min={today}
                  onChange={(e) => setValidUntil(e.target.value)}
                  required
                />
                <div className="cfg-hint">{t('quotes.validUntilHint', 'Después de esta fecha la cotización ya no será válida para el cliente.')}</div>
              </div>
            )}
            {appendingToDraft && (
              <div className="cfg-hint" style={{ marginBottom: 16 }}>
                {t('quotes.appendDraftHint', 'Las líneas se agregarán al borrador seleccionado y conservarán su fecha de expiración.')}
              </div>
            )}
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', color: 'var(--muted)', marginBottom: 8 }}>
              {t('quotes.lines', 'LÍNEAS DE LA COTIZACIÓN')}
            </div>
            {lines.length === 0 && (
              <div className="muted" style={{ fontSize: 12 }}>
                {t('quotes.noLinesYet', 'Crea líneas desde el árbol. El cliente solo verá la descripción y el precio.')}
              </div>
            )}
            {lines.map((l) => (
              <div key={l.key} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  <input className="field-input" style={{ flex: 1, padding: '4px 8px' }}
                    value={l.description}
                    placeholder={t('quotes.lineDescription', 'Descripción para el cliente')}
                    onChange={(e) => setLine(l.key, 'description', e.target.value)} />
                  <button className="icon-btn" onClick={() => removeLine(l.key)}><Icon name="close" size={12} /></button>
                </div>
                <div className="muted" style={{ fontSize: 11, marginBottom: 6 }}>
                  {l.materialLabels.length} {t('quotes.materialsInLine', 'materiales')} · {t('quotes.cost', 'costo')} {Q(l.cost)}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{t('quotes.sellPrice', 'Precio de venta')}</span>
                  <input className="field-input mono" type="number" min="0" step="0.01" style={{ width: 130, padding: '4px 8px', textAlign: 'right' }}
                    value={l.sellPrice} onChange={(e) => setLine(l.key, 'sellPrice', e.target.value)} />
                </div>
              </div>
            ))}
            {lines.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: 14, borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
                <span>{t('common.total', 'TOTAL')}</span><span className="mono">{Q(total)}</span>
              </div>
            )}

            {!appendingToDraft && (
              <div style={{ marginTop: 16, padding: '10px 0', borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', color: 'var(--muted)', marginBottom: 8 }}>
                {t('quotes.companyProfit', 'GANANCIA DE LA EMPRESA')}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <select className="field-input" style={{ width: 100 }} value={profit.calcType} onChange={(e) => setProfitField('calcType', e.target.value)}>
                  <option value="fixed">{t('quotes.fixed', 'Fijo')}</option>
                  <option value="percent">%</option>
                </select>
                <input className="field-input mono" type="number" min="0" step="0.01" style={{ width: 120 }} value={profit.value} onChange={(e) => setProfitField('value', e.target.value)} placeholder={profit.calcType === 'percent' ? '%' : 'Q'} />
              </div>

            {/* Costos operativos adicionales */}
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', color: 'var(--muted)', margin: '16px 0 8px' }}>
              {t('quotes.operatingCosts', 'COSTOS OPERATIVOS ADICIONALES')}
            </div>
            {charges.map((c) => (
              <div key={c.key} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, padding: '4px 0' }}>
                <span style={{ flex: 1 }}>{c.description} {c.category && <span className="muted">· {c.category}</span>}</span>
                <span className="muted">{c.calcType === 'percent' ? `${c.value}%` : Q(c.value)}</span>
                <button className="icon-btn" onClick={() => removeCharge(c.key)}><Icon name="close" size={12} /></button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', marginTop: 6, flexWrap: 'wrap' }}>
              <select className="field-input" style={{ width: 90 }} value={charge.calcType} onChange={(e) => setCh('calcType', e.target.value)}>
                <option value="fixed">{t('quotes.fixed', 'Fijo')}</option>
                <option value="percent">{t('quotes.percent', '%')}</option>
              </select>
              <input className="field-input" style={{ flex: 1, minWidth: 120 }} placeholder={t('quotes.chargeDescPh', 'Descripción (mano de obra…)')}
                value={charge.description} onChange={(e) => setCh('description', e.target.value)} />
              <input className="field-input mono" type="number" min="0" step="0.01" style={{ width: 90 }} placeholder={charge.calcType === 'percent' ? '%' : 'Q'}
                value={charge.value} onChange={(e) => setCh('value', e.target.value)} />
              <Button icon="plus" onClick={addCharge}>{t('common.add', 'Agregar')}</Button>
            </div>
            </div>
            )}
          </div>
        </div>

        <div className="modal-foot">
          <Button variant="ghost" onClick={onClose}>{t('common.cancel', 'Cancelar')}</Button>
          <Button icon="check" variant="accent" disabled={!canSave || busy} onClick={save}>
            {appendingToDraft ? t('quotes.appendLines', 'Agregar líneas') : t('quotes.createQuote', 'Crear cotización')}
          </Button>
        </div>
      </div>
    </div>
  );
}
