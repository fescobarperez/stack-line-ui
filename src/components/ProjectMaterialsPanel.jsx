import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Button from './Button.jsx';
import InlineCreate from './InlineCreate.jsx';
import Icon from './Icon.jsx';
import TreeView from './TreeView.jsx';
import treeStyles from './TreeView.module.css';
import projectTreeStyles from './ProjectMaterialsTree.module.css';
import useTreeSelection from '../hooks/useTreeSelection.js';
import StatCard from './StatCard.jsx';
import { createSupplier } from '../api/partners.js';
import { copyProjectMaterial, copyProjectMaterialGroup, createProjectMaterial, createProjectMaterialGroup, getProjectMaterials, moveProjectMaterial, moveProjectMaterialGroup, renameProjectMaterialGroup } from '../api/projectMaterials.js';
import { useProducts } from '../hooks/useCatalog.js';
import { useSuppliers } from '../hooks/useMasters.js';


function CreateProductInline({ suppliers, onCreate, onCreateSupplier, onCreated, onCancel, pushToast }) {
  const [form, setForm] = useState({ name: '', sku: '', unit: 'unid', supplierId: '', cost: '' });
  const [availableSuppliers, setAvailableSuppliers] = useState(suppliers);
  const [creatingSupplier, setCreatingSupplier] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  useEffect(() => { setAvailableSuppliers(suppliers); }, [suppliers]);

  const submit = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.sku.trim()) {
      pushToast?.('Indica el nombre y el SKU del producto', 'danger');
      return;
    }
    if (!form.supplierId || !(Number(form.cost) > 0)) {
      pushToast?.('Selecciona un proveedor e indica el costo para ese proveedor', 'danger');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: form.name.trim(), sku: form.sku.trim(), unit: form.unit.trim() || 'unid',
        itemType: 'raw_material', categoryId: null, purchaseUnit: null,
        purchaseFactor: 1, cost: Number(form.cost), supplierId: Number(form.supplierId),
        supplierCost: Number(form.cost), price: 0, minStock: 0, status: 'ACTIVE',
      };
      const created = await onCreate(payload);
      if (!created?.id) throw new Error('El producto fue creado, pero la respuesta no devolvió su identificador');
      onCreated({ ...payload, ...created, itemType: 'raw_material', avgCost: created.avgCost ?? payload.cost, cost: created.cost ?? payload.cost });
    } catch (error) {
      pushToast?.(`No se pudo crear el producto: ${error.message}`, 'danger');
    } finally { setBusy(false); }
  };

  const handleSupplierCreated = (supplier) => {
    setAvailableSuppliers((current) => [supplier, ...current.filter((item) => item.id !== supplier.id)]);
    set('supplierId', String(supplier.id));
    setCreatingSupplier(false);
    pushToast?.('Proveedor creado y seleccionado', 'success');
  };

  return (
    <InlineCreate title="Crear producto de materia prima" onSubmit={submit} onCancel={onCancel} busy={busy} submitLabel="Guardar producto">
      <div className="field-row">
        <div className="field"><label>Nombre *</label><input autoFocus value={form.name} onChange={(event) => set('name', event.target.value)} placeholder="Ej. Tablero MDF" /></div>
        <div className="field"><label>SKU *</label><input className="mono" value={form.sku} onChange={(event) => set('sku', event.target.value)} placeholder="MDF-18" /></div>
      </div>
      <div className="field-row" style={{ marginTop: 10 }}>
        <div className="field"><label>Unidad</label><input value={form.unit} onChange={(event) => set('unit', event.target.value)} placeholder="unid" /></div>
        <div className="field"><label>Costo para el proveedor *</label><input className="mono" type="number" min="0.01" step="0.01" value={form.cost} onChange={(event) => set('cost', event.target.value)} placeholder="0.00" /></div>
      </div>
      <div className="field" style={{ marginTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          <div className="field" style={{ flex: 1 }}><label>Proveedor *</label><select value={form.supplierId} onChange={(event) => set('supplierId', event.target.value)}><option value="">Seleccionar proveedor…</option>{availableSuppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></div>
          <Button type="button" size="sm" icon="plus" onClick={() => setCreatingSupplier((current) => !current)}>{creatingSupplier ? 'Cerrar' : 'Crear proveedor'}</Button>
        </div>
        {creatingSupplier && <CreateSupplierInline onCreate={onCreateSupplier} onCreated={handleSupplierCreated} onCancel={() => setCreatingSupplier(false)} pushToast={pushToast} />}
      </div>
    </InlineCreate>
  );
}

function CreateSupplierInline({ onCreate, onCreated, onCancel, pushToast }) {
  const [form, setForm] = useState({ name: '', nit: '', phone: '' });
  const [busy, setBusy] = useState(false);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) {
      pushToast?.('Indica el nombre del proveedor', 'danger');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: form.name.trim(), nit: form.nit.trim() || null, contact: null,
        phone: form.phone.trim() || null, paymentTerms: null, balance: 0, status: 'active',
      };
      const created = await onCreate(payload);
      if (!created?.id) throw new Error('El proveedor fue creado, pero la respuesta no devolvió su identificador');
      onCreated({ ...payload, ...created });
    } catch (error) {
      pushToast?.(`No se pudo crear el proveedor: ${error.message}`, 'danger');
    } finally { setBusy(false); }
  };

  return (
    <InlineCreate title="Crear proveedor" onSubmit={submit} onCancel={onCancel} busy={busy} submitLabel="Guardar proveedor">
      <div className="field-row">
        <div className="field"><label>Nombre *</label><input autoFocus value={form.name} onChange={(event) => set('name', event.target.value)} placeholder="Ej. Proveedor ABC" /></div>
        <div className="field"><label>NIT</label><input className="mono" value={form.nit} onChange={(event) => set('nit', event.target.value)} /></div>
      </div>
      <div className="field" style={{ marginTop: 10 }}><label>Teléfono</label><input value={form.phone} onChange={(event) => set('phone', event.target.value)} /></div>
    </InlineCreate>
  );
}
const Q = (n) => `Q ${Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function MaterialModal({ project, products, suppliers, onCreateProduct, onCreateSupplier, onRefresh, onClose, pushToast }) {
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [supplierSelections, setSupplierSelections] = useState({});
  const [search, setSearch] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [inlineCreate, setInlineCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const catalogProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((product) => !term || `${product.sku} ${product.name}`.toLowerCase().includes(term));
  }, [products, search]);

  const toggleSelected = (key) => setSelectedKeys((current) => current.includes(key)
    ? current.filter((item) => item !== key)
    : [...current, key]);
  const cheapestSupplier = (product) => (product?.suppliers || [])
    .reduce((lowest, supplier) => !lowest || Number(supplier.unitCost) < Number(lowest.unitCost)
      ? supplier : lowest, null);
  const selectedSupplier = (product) => {
    const selectedId = supplierSelections[product.id];
    return product?.suppliers?.find((supplier) => String(supplier.supplierId) === String(selectedId))
      || cheapestSupplier(product);
  };

  const addSelectedToRoot = async () => {
    const amount = Number(quantity);
    if (!(amount > 0)) {
      pushToast?.('Indica una cantidad mayor que cero antes de agregar materiales', 'danger');
      return;
    }
    setBusy(true);
    const skipped = [];
    try {
      for (const key of selectedKeys) {
        const product = products.find((item) => Number(item.id) === Number(key.slice(8)));
        const supplier = product && selectedSupplier(product);
        if (!product || !supplier) {
          skipped.push(product?.name || `#${key.slice(8)}`);
          continue;
        }
        await createProjectMaterial(project.id, {
          productId: Number(product.id), groupId: null, quantityPlanned: amount,
          supplierId: Number(supplier.supplierId), uom: product.unit || 'unid', notes: null,
        });
      }
      if (skipped.length) pushToast?.(`No se agregaron: ${skipped.join(', ')}. Asocia un proveedor primero.`, 'danger');
      if (selectedKeys.length > skipped.length) {
        pushToast?.(`${selectedKeys.length - skipped.length} material(es) agregado(s) a Raíz`, 'success');
        await onRefresh();
      }
      setSelectedKeys([]);
    } catch (error) {
      pushToast?.(`No se pudieron agregar los materiales: ${error.message}`, 'danger');
    } finally { setBusy(false); }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal material-picker-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head"><div><h3>Agregar material al proyecto</h3><div className="body-small muted">Selecciona materias primas del catálogo. Después podrás organizarlas desde Materiales de proyecto.</div></div><Button variant="ghost" iconOnly icon="x" onClick={onClose} /></div>
        <div className="material-picker-toolbar"><div className="material-picker-search"><Icon name="search" size={17} /><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar materia prima por SKU o nombre…" /></div><div className="material-picker-actions"><label className="material-quantity">Cantidad <input className="mono" type="number" min="0.001" step="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label><Button type="button" size="sm" icon="plus" onClick={() => setInlineCreate((current) => !current)}>{inlineCreate ? 'Cerrar' : 'Crear producto'}</Button></div></div>
        {inlineCreate && <div style={{ padding: '0 18px 12px' }}><CreateProductInline suppliers={suppliers} onCreate={onCreateProduct} onCreateSupplier={onCreateSupplier} onCreated={() => { setInlineCreate(false); pushToast?.('Producto creado; ya puedes seleccionarlo en el catálogo', 'success'); }} onCancel={() => setInlineCreate(false)} pushToast={pushToast} /></div>}
        <div className="material-picker-hint"><Icon name="info" size={15} />{selectedKeys.length ? `${selectedKeys.length} seleccionado(s)` : 'Selecciona una o varias materias primas para agregarlas a Raíz.'}</div>
        <div className="modal-body material-picker-body">
          <div className="material-catalog-list">
            {!catalogProducts.length && <div className="material-empty-row">No hay materias primas que coincidan con la búsqueda.</div>}
            {catalogProducts.map((product) => {
              const key = `product:${product.id}`;
              const options = [...(product.suppliers || [])].sort((left, right) => Number(left.unitCost) - Number(right.unitCost));
              const supplier = selectedSupplier(product);
              return <div className={`material-catalog-row${selectedKeys.includes(key) ? ' selected' : ''}`} key={key}>
                <input type="checkbox" checked={selectedKeys.includes(key)} onChange={() => toggleSelected(key)} aria-label={`Seleccionar ${product.name}`} />
                <Icon name="box" size={17} />
                <span className={treeStyles.label}><strong>{product.name}</strong><span className="muted">{product.sku || 'Sin SKU'} · {product.unit || 'unid'} · {supplier ? `Costo ${Q(supplier.unitCost)}` : 'Sin proveedor'}</span></span>
                <span className="material-catalog-supplier-slot">
                  {options.length ? <select className="material-catalog-supplier" value={supplier?.supplierId || ''} onChange={(event) => { event.stopPropagation(); setSupplierSelections((current) => ({ ...current, [product.id]: event.target.value })); }} onClick={(event) => event.stopPropagation()} aria-label={`Proveedor para ${product.name}`}>
                    {options.map((option) => <option key={option.supplierId} value={option.supplierId}>{option.supplierName} · {Q(option.unitCost)}</option>)}
                  </select> : <span className="material-source-label">SIN PROVEEDOR</span>}
                </span>
              </div>;
            })}
          </div>
        </div>
        <div className="modal-foot material-picker-foot"><span className="muted">{selectedKeys.length ? `${selectedKeys.length} seleccionado(s)` : 'Selecciona materiales para agregarlos'}</span><div><Button type="button" onClick={onClose}>Cerrar</Button><Button type="button" variant="accent" icon="plus" onClick={addSelectedToRoot} disabled={!selectedKeys.length || busy}>Agregar a Raíz</Button></div></div>
      </div>
    </div>
  );
}

function ProjectMaterialTree({ project, plan, groups, onCreateGroup, onRefresh, pushToast, canEdit }) {
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [creatingFolderFor, setCreatingFolderFor] = useState(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [renamingFolderId, setRenamingFolderId] = useState(null);
  const [renameFolderName, setRenameFolderName] = useState('');
  const [busy, setBusy] = useState(false);
  const materialsByGroup = useMemo(() => groups.reduce((acc, group) => {
    acc[group.id] = group.materials || [];
    return acc;
  }, {}), [groups]);
  const groupCosts = useMemo(() => {
    const directCosts = new Map(groups.map((group) => [Number(group.id), (materialsByGroup[group.id] || [])
      .reduce((sum, material) => sum + Number(material.estimatedAmount || 0), 0)]));
    const childrenByGroup = groups.reduce((acc, group) => {
      if (group.parentGroupId != null) {
        const parentId = Number(group.parentGroupId);
        acc[parentId] = [...(acc[parentId] || []), Number(group.id)];
      }
      return acc;
    }, {});
    const memo = new Map();
    const calculate = (groupId, visiting = new Set()) => {
      if (memo.has(groupId)) return memo.get(groupId);
      if (visiting.has(groupId)) return 0;
      const nextVisiting = new Set(visiting).add(groupId);
      const childrenTotal = (childrenByGroup[groupId] || []).reduce((sum, childId) => sum + calculate(childId, nextVisiting), 0);
      const total = (directCosts.get(groupId) || 0) + childrenTotal;
      memo.set(groupId, total);
      return total;
    };
    groups.forEach((group) => calculate(Number(group.id)));
    return memo;
  }, [groups, materialsByGroup]);
  const ungrouped = useMemo(() => plan.ungrouped || [], [plan.ungrouped]);
  const tree = useMemo(() => {
    const rows = [{ id: 'project-root', parent: 0, text: 'Raíz del proyecto', droppable: true, data: { kind: 'root' } }];
    ungrouped.forEach((material) => rows.push({
      id: `material:${material.id}`, parent: 'project-root', text: material.productName || material.sku || `Producto ${material.productId}`,
      data: { kind: 'material', materialId: material.id, material },
    }));
    groups.forEach((group) => {
      rows.push({ id: `group:${group.id}`, parent: group.parentGroupId == null ? 'project-root' : `group:${group.parentGroupId}`, text: group.name, droppable: true, data: { kind: 'group', groupId: group.id, group } });
      (materialsByGroup[group.id] || []).forEach((material) => rows.push({
        id: `material:${material.id}`, parent: `group:${group.id}`, text: material.productName || material.sku || `Producto ${material.productId}`,
        data: { kind: 'material', materialId: material.id, material },
      }));
    });
    return rows;
  }, [groups, materialsByGroup, ungrouped]);
  const materialNodes = tree.filter((node) => node.data?.kind === 'material');
  const { select: selectMaterial, extend: extendMaterialSelection } = useTreeSelection(materialNodes, {
    selectedKeys,
    getKey: (node) => String(node.id),
    onChange: (keys) => setSelectedKeys(keys),
  });

  const selectedKeysFor = (sourceKey) => {
    const selected = selectedKeys.filter((key) => key.startsWith('material:'));
    return sourceKey.startsWith('material:') && selected.includes(sourceKey) ? selected : [sourceKey];
  };
  const wouldCreateCycle = (sourceId, targetId) => {
    const byId = new Map(groups.map((group) => [Number(group.id), group]));
    let cursor = targetId;
    while (cursor != null) {
      if (Number(cursor) === Number(sourceId)) return true;
      cursor = byId.get(Number(cursor))?.parentGroupId ?? null;
    }
    return false;
  };
  const getDropGroupId = (dropTargetId, dropTarget) => {
    const target = dropTarget || (dropTargetId === 0 ? { data: { kind: 'root' } } : tree.find((node) => String(node.id) === String(dropTargetId)));
    if (target?.data?.kind === 'root' || String(dropTarget?.id || dropTargetId) === 'project-root') return null;
    if (target?.data?.kind !== 'group') return undefined;
    const rawGroupId = target.data.groupId ?? String(target.id || dropTargetId).replace(/^group:/, '');
    const groupId = Number(rawGroupId);
    return Number.isFinite(groupId) ? groupId : undefined;
  };
  const moveMaterialsToGroup = async (materialIds, groupId) => {
    setBusy(true);
    try {
      for (const materialId of materialIds) await moveProjectMaterial(project.id, materialId, groupId ? Number(groupId) : null);
      pushToast?.(`${materialIds.length} material(es) movido(s)${groupId ? ' al folder' : ' a Raíz'}`, 'success');
      await onRefresh();
      setSelectedKeys([]);
    } catch (error) {
      pushToast?.(`No se pudieron mover los materiales: ${error.message}`, 'danger');
    } finally { setBusy(false); }
  };
  const moveGroupToParent = async (groupId, parentGroupId) => {
    const sourceId = Number(groupId);
    const targetId = parentGroupId == null ? null : Number(parentGroupId);
    if (!Number.isFinite(sourceId) || (targetId != null && !Number.isFinite(targetId))) {
      pushToast?.('No se pudo identificar el folder de origen o destino', 'danger');
      return;
    }
    if (targetId != null && wouldCreateCycle(sourceId, targetId)) {
      pushToast?.('No puedes mover un folder dentro de sí mismo o de un subfolder propio', 'danger');
      return;
    }
    setBusy(true);
    try {
      await moveProjectMaterialGroup(project.id, groupId, targetId);
      pushToast?.(`Folder movido${targetId ? ' al folder seleccionado' : ' a Raíz'}`, 'success');
      await onRefresh();
    } catch (error) {
      const message = error.status === 404
        ? 'El backend activo no tiene publicada la ruta de movimiento de folders. Recompila y reinicia stack-line-services.'
        : error.message;
      pushToast?.(`No se pudo mover el folder: ${message}`, 'danger');
    } finally { setBusy(false); }
  };
  const copyMaterial = async (materialId) => {
    setBusy(true);
    try {
      await copyProjectMaterial(project.id, materialId);
      pushToast?.('Material copiado en la misma ubicación', 'success');
      await onRefresh();
      setSelectedKeys([]);
    } catch (error) {
      pushToast?.(`No se pudo copiar el material: ${error.message}`, 'danger');
    } finally { setBusy(false); }
  };
  const copyGroup = async (groupId) => {
    setBusy(true);
    try {
      await copyProjectMaterialGroup(project.id, groupId);
      pushToast?.('Folder y su contenido copiados en la misma ubicación', 'success');
      await onRefresh();
    } catch (error) {
      pushToast?.(`No se pudo copiar el folder: ${error.message}`, 'danger');
    } finally { setBusy(false); }
  };
  const startRename = (group) => {
    setCreatingFolderFor(null);
    setRenamingFolderId(group.id);
    setRenameFolderName(group.name || '');
  };
  const submitRename = async (groupId) => {
    const name = renameFolderName.trim();
    if (!name) {
      pushToast?.('Indica el nombre del folder', 'danger');
      return;
    }
    setBusy(true);
    try {
      await renameProjectMaterialGroup(project.id, groupId, name);
      setRenamingFolderId(null);
      setRenameFolderName('');
      await onRefresh();
      pushToast?.('Folder renombrado', 'success');
    } catch (error) {
      pushToast?.(`No se pudo renombrar el folder: ${error.message}`, 'danger');
    } finally { setBusy(false); }
  };
  const handleTreeDrop = async (_nextTree, { dragSourceId, dropTargetId, dragSource, dropTarget }) => {
    if (dragSourceId == null) return;
    const source = dragSource || tree.find((node) => String(node.id) === String(dragSourceId));
    const sourceKind = source?.data?.kind;
    const groupId = getDropGroupId(dropTargetId, dropTarget);
    if (groupId === undefined) {
      pushToast?.('Selecciona un folder o Raíz como destino', 'danger');
      return;
    }
    if (sourceKind === 'material') await moveMaterialsToGroup(selectedKeysFor(String(dragSourceId)).map((key) => Number(key.slice(9))), groupId);
    if (sourceKind === 'group') {
      const sourceGroupId = Number(source.data.groupId ?? String(dragSourceId).replace(/^group:/, ''));
      await moveGroupToParent(sourceGroupId, groupId);
    }
  };
  const canDrop = (_currentTree, { dragSourceId, dropTargetId, dragSource, dropTarget }) => {
    if (dragSourceId == null) return false;
    const source = dragSource || tree.find((node) => String(node.id) === String(dragSourceId));
    const target = dropTarget || (dropTargetId === 0 ? { data: { kind: 'root' } } : tree.find((node) => String(node.id) === String(dropTargetId)));
    if (!source || !target || !['root', 'group'].includes(target.data?.kind)) return false;
    if (source.data?.kind === 'group' && target.data.kind === 'group') return !wouldCreateCycle(source.data.groupId, target.data.groupId);
    return ['group', 'material'].includes(source.data?.kind);
  };
  const submitFolder = async (parentGroupId) => {
    if (!newFolderName.trim()) return;
    setBusy(true);
    try {
      await onCreateGroup({ name: newFolderName.trim(), parentGroupId: parentGroupId ? Number(parentGroupId) : null });
      setNewFolderName('');
      setCreatingFolderFor(null);
      await onRefresh();
      pushToast?.('Folder creado', 'success');
    } catch (error) { pushToast?.(`No se pudo crear el folder: ${error.message}`, 'danger'); }
    finally { setBusy(false); }
  };
  const renderNode = (node, { depth, isOpen, onToggle, isDragging, isDropTarget, handleRef }) => {
    const kind = node.data?.kind;
    const selected = selectedKeys.includes(String(node.id));
    const isFolder = kind === 'group';
    const isRoot = kind === 'root';
    const material = node.data?.material;
    const rowClass = [
      treeStyles.row,
      selected && treeStyles.selected,
      isDropTarget && treeStyles.dropTarget,
      isDragging && treeStyles.dragging,
    ].filter(Boolean).join(' ');
    const toggle = isFolder || isRoot ? <button type="button" className={treeStyles.toggle} onMouseDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onToggle?.(); }} aria-label={isOpen ? 'Colapsar' : 'Expandir'}><Icon name={isOpen ? 'chevronDown' : 'chevronRight'} size={17} /></button> : <span className={treeStyles.toggleSpacer} />;
    const leading = isRoot ? <Icon name="home" size={18} /> : <Icon name={isFolder ? 'folder' : 'box'} size={17} fill={isFolder} />;
    const label = isRoot ? <><strong>Raíz del proyecto</strong><span className="muted">Destino predeterminado · {plan.materialCount || 0} materiales</span></> : <><strong>{node.text}</strong><span className="muted">{isFolder ? `${(materialsByGroup[node.data.groupId] || []).length} materiales · ${Q(groupCosts.get(Number(node.data.groupId)) || 0)}` : `${material?.sku || ''} · ${material?.quantityPlanned} ${material?.uom}`}</span></>;
    const handleKeyDown = (event) => {
      if (kind === 'material') extendMaterialSelection(node, event);
    };
    return <React.Fragment key={node.id}>
      <div ref={handleRef} className={`tree-row ${rowClass}`} style={{ paddingLeft: 12 + depth * 22 }} onClick={kind === 'material' ? (event) => selectMaterial(node, event) : undefined} onKeyDown={handleKeyDown} tabIndex={kind === 'material' ? 0 : undefined} role={kind === 'material' ? 'option' : undefined} aria-selected={kind === 'material' ? selected : undefined}>
        {toggle}
        {leading}<span className={treeStyles.label}>{label}</span>
        {kind === 'material' && <span className={`mono ${projectTreeStyles.cost}`}>{Q(material?.estimatedAmount)}</span>}
        {isRoot && <span className={`mono ${projectTreeStyles.cost}`}>{Q(plan.estimatedCost)}</span>}
        {isFolder && <div className={`${treeStyles.actions} ${projectTreeStyles.actions}`} onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
          <Button type="button" variant="ghost" size="sm" icon="copy" title="Copiar folder" aria-label="Copiar folder" onClick={() => copyGroup(node.data.groupId)} disabled={!canEdit || busy}>Copiar</Button>
          <Button type="button" variant="ghost" size="sm" icon="edit" title="Renombrar folder" aria-label="Renombrar folder" onClick={() => startRename(node.data.group)} disabled={!canEdit || busy}>Renombrar</Button>
          <Button type="button" variant="ghost" size="sm" icon="plus" onClick={() => setCreatingFolderFor(node.data.groupId)} disabled={!canEdit || busy}>Crear subfolder</Button>
        </div>}
        {kind === 'material' && <div className={`${treeStyles.actions} ${projectTreeStyles.actions}`} onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
          <Button type="button" variant="ghost" size="sm" icon="copy" title="Copiar material" aria-label="Copiar material" onClick={() => copyMaterial(node.data.materialId)} disabled={!canEdit || busy}>Copiar</Button>
        </div>}
      </div>
      {creatingFolderFor === node.data?.groupId && isFolder && <div className={projectTreeStyles.inlineFolder} style={{ marginLeft: 42 + depth * 22 }}><input autoFocus value={newFolderName} onChange={(event) => setNewFolderName(event.target.value)} placeholder="Nombre del subfolder" onKeyDown={(event) => { if (event.key === 'Enter') submitFolder(node.data.groupId); }} /><Button type="button" size="sm" variant="accent" onClick={() => submitFolder(node.data.groupId)} disabled={busy}>Crear</Button><Button type="button" size="sm" variant="ghost" onClick={() => setCreatingFolderFor(null)}>Cancelar</Button></div>}
      {renamingFolderId === node.data?.groupId && isFolder && <div className={projectTreeStyles.inlineFolder} style={{ marginLeft: 42 + depth * 22 }}><input autoFocus value={renameFolderName} onChange={(event) => setRenameFolderName(event.target.value)} placeholder="Nombre del folder" onKeyDown={(event) => { if (event.key === 'Enter') submitRename(node.data.groupId); }} /><Button type="button" size="sm" variant="accent" onClick={() => submitRename(node.data.groupId)} disabled={busy}>Guardar</Button><Button type="button" size="sm" variant="ghost" onClick={() => setRenamingFolderId(null)}>Cancelar</Button></div>}
    </React.Fragment>;
  };

  return <div className="project-material-tree">
    <div className={projectTreeStyles.sectionHead}><div className="body-small muted"><Icon name="info" size={15} /> Arrastra materiales a folders, folders a otros folders o cualquier elemento a Raíz.</div>{selectedKeys.length > 0 && <div className={projectTreeStyles.selectionStatus}><span className="badge accent">{selectedKeys.length} material{selectedKeys.length === 1 ? '' : 'es'} seleccionado{selectedKeys.length === 1 ? '' : 's'}</span><Button type="button" size="sm" variant="ghost" icon="arrowDown" onClick={() => moveMaterialsToGroup(selectedKeys.map((key) => Number(key.slice(9))), null)} disabled={busy}>Mover selección a Raíz</Button></div>}</div>
  return <TreeView className={projectTreeStyles.tree} tree={tree} rootId={0} initialOpen sort={false} insertDroppableFirst={false} dropTargetOffset={0} canDrag={(node) => canEdit && ['group', 'material'].includes(node?.data?.kind)} canDrop={canDrop} onDrop={handleTreeDrop} render={renderNode} />;
  </div>;
}

export default function ProjectMaterialsPanel({ project, pushToast, onMaterialsTotalChange, onMaterialsLoadingChange }) {
  const [plan, setPlan] = useState({ groups: [], ungrouped: [], estimatedCost: 0, materialCount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [materialModal, setMaterialModal] = useState(false);
  const { items: products, reload: reloadProducts, create: createProduct } = useProducts({ itemType: 'raw_material' });
  const { items: suppliers, reload: reloadSuppliers } = useSuppliers();
  const createSupplierInline = useCallback(async (payload) => {
    const created = await createSupplier(payload);
    await reloadSuppliers();
    return created;
  }, [reloadSuppliers]);
  const canEdit = project.status === 'draft' || project.status === 'open';

  const reload = useCallback(async () => {
    setLoading(true);
    try { setPlan(await getProjectMaterials(project.id)); setError(null); }
    catch (loadError) { setError(loadError); }
    finally { setLoading(false); }
  }, [project.id]);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { onMaterialsLoadingChange?.(loading); }, [loading, onMaterialsLoadingChange]);
  useEffect(() => { onMaterialsTotalChange?.(Number(plan.estimatedCost || 0)); }, [onMaterialsTotalChange, plan.estimatedCost]);

  const groups = useMemo(() => plan.groups || [], [plan.groups]);
  const openMaterialModal = async () => {
    await Promise.all([reloadProducts(), reloadSuppliers()]);
    setMaterialModal(true);
  };

  return (
    <section className="card project-materials-panel" style={{ marginBottom: 16 }}>
      <div className="card-head"><div><h3>Materiales del proyecto</h3><div className="body-small muted">La Raíz del proyecto existe automáticamente; organiza los materiales dentro de subfolders.</div></div><div style={{ display: 'flex', gap: 8 }}><Button size="sm" icon="box" variant="accent" onClick={openMaterialModal} disabled={!canEdit}>Agregar material</Button></div></div>
      <div className="card-body">
        {error && <div className="alert" style={{ marginBottom: 12 }}><Icon name="alert" size={16} />No se pudo cargar la planificación: {error.message}</div>}
        {loading ? <div className="muted">Cargando materiales…</div> : (
          <>
            <div className="stat-grid" style={{ marginBottom: 14 }}><StatCard icon="box" tone="pri" size="title" label="Materiales planificados" value={plan.materialCount || 0} /><StatCard icon="cash" tone="sec" size="title" label="Costo planificado" value={Q(plan.estimatedCost)} /><StatCard icon="folder" tone="ter" size="title" label="Grupos" value={groups.length} /></div>
            <ProjectMaterialTree project={project} plan={plan} groups={groups} onCreateGroup={(payload) => createProjectMaterialGroup(project.id, payload)} onRefresh={reload} pushToast={pushToast} canEdit={canEdit} />
          </>
        )}
      </div>
      {materialModal && <MaterialModal project={project} products={products} suppliers={suppliers} onCreateProduct={createProduct} onCreateSupplier={createSupplierInline} onRefresh={reload} pushToast={pushToast} onClose={() => setMaterialModal(false)} />}
    </section>
  );
}
