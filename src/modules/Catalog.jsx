import React, { useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import InlineCreate from '../components/InlineCreate.jsx';
import TreeView from '../components/TreeView.jsx';
import treeStyles from '../components/TreeView.module.css';
import catalogStyles from './CatalogTree.module.css';
import useTreeSelection from '../hooks/useTreeSelection.js';
import { addProductSupplier, copyCategory, createCategory, moveProduct, updateCategory, updateProduct } from '../api/catalog.js';
import { createSupplier } from '../api/partners.js';
import { useCategoryTree, useProducts } from '../hooks/useCatalog.js';
import { useSuppliers } from '../hooks/useMasters.js';

const Q = (value) => `Q ${Number(value || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ITEM_TYPES = {
  sellable: { label: 'Vendible', variant: 'success' },
  raw_material: { label: 'Materia prima', variant: 'info' },
  service: { label: 'Servicio', variant: 'warning' },
};

function descendantsOf(categories, categoryId) {
  const ids = new Set([String(categoryId)]);
  let changed = true;
  while (changed) {
    changed = false;
    categories.forEach((category) => {
      if (category.parentId != null && ids.has(String(category.parentId)) && !ids.has(String(category.id))) {
        ids.add(String(category.id));
        changed = true;
      }
    });
  }
  return ids;
}

function categoryPath(categories, categoryId) {
  const byId = new Map(categories.map((category) => [String(category.id), category]));
  const path = [];
  let current = categoryId == null ? null : byId.get(String(categoryId));
  const seen = new Set();
  while (current && !seen.has(String(current.id))) {
    seen.add(String(current.id));
    path.unshift(current.name);
    current = current.parentId == null ? null : byId.get(String(current.parentId));
  }
  return path.join(' / ');
}

function buildCatalogTree(categories, products, search) {
  const query = search.trim().toLowerCase();
  const matchesProduct = (product) => !query || `${product.name} ${product.sku}`.toLowerCase().includes(query);
  const visibleProducts = products.filter(matchesProduct);
  const visibleCategoryIds = new Set();
  const addCategoryPath = (categoryId) => {
    let current = categories.find((category) => String(category.id) === String(categoryId));
    const seen = new Set();
    while (current && !seen.has(String(current.id))) {
      seen.add(String(current.id));
      visibleCategoryIds.add(String(current.id));
      current = current.parentId == null ? null : categories.find((category) => String(category.id) === String(current.parentId));
    }
  };
  if (query) {
    visibleProducts.forEach((product) => addCategoryPath(product.cat));
    categories.filter((category) => category.name.toLowerCase().includes(query)).forEach((category) => addCategoryPath(category.id));
  }
  const visibleCategories = query ? categories.filter((category) => visibleCategoryIds.has(String(category.id))) : categories;
  const rows = [{ id: 'catalog-root', parent: 0, text: 'Raíz del catálogo', droppable: true, data: { kind: 'root' } }];
  const sortedCategories = [...visibleCategories].sort((left, right) => left.name.localeCompare(right.name, 'es'));
  sortedCategories.forEach((category) => rows.push({
    id: `category:${category.id}`,
    parent: category.parentId == null ? 'catalog-root' : `category:${category.parentId}`,
    text: category.name,
    droppable: true,
    data: { kind: 'category', categoryId: category.id, category },
  }));
  const categoryIds = new Set(visibleCategories.map((category) => String(category.id)));
  products.filter((product) => matchesProduct(product) && (product.cat == null || categoryIds.has(String(product.cat)))).forEach((product) => rows.push({
    id: `product:${product.id}`,
    parent: product.cat == null ? 'catalog-root' : `category:${product.cat}`,
    text: product.name,
    droppable: false,
    data: { kind: 'product', productId: product.id, product },
  }));
  return rows;
}

function productPayload(product, categoryId) {
  const preferred = product.suppliers?.find((supplier) => supplier.preferred) || product.suppliers?.[0];
  return {
    name: product.name,
    sku: product.sku,
    categoryId: categoryId == null ? null : Number(categoryId),
    unit: product.unit || 'Unidad',
    purchaseUnit: product.purchaseUnit || null,
    purchaseFactor: Number(product.purchaseFactor) || 1,
    itemType: product.itemType || 'sellable',
    cost: Number(preferred?.unitCost ?? product.cost ?? 0),
    price: Number(product.price || 0),
    supplierId: preferred?.supplierId ?? null,
    supplierCost: preferred?.unitCost ? Number(preferred.unitCost) : null,
    minStock: Number(product.min || 0),
    status: product.status || 'ACTIVE',
  };
}

async function moveCatalogProduct(product, categoryId) {
  const normalizedCategoryId = categoryId == null ? null : Number(categoryId);
  try {
    return await moveProduct(product.id, normalizedCategoryId);
  } catch (error) {
    if (error.status !== 404) throw error;
    return updateProduct(product.id, productPayload(product, normalizedCategoryId));
  }
}

function SupplierRows({ rows, setRows, suppliers, onCreateSupplier, pushToast }) {
  const [creatingSupplier, setCreatingSupplier] = useState(false);
  const [supplierForm, setSupplierForm] = useState({ name: '', nit: '', phone: '' });
  const setRow = (index, key, value) => setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row));
  const addRow = () => setRows((current) => [...current, { supplierId: '', unitCost: '', preferred: false }]);
  const removeRow = (index) => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
  const submitSupplier = async (event) => {
    event.preventDefault();
    if (!supplierForm.name.trim()) { pushToast?.('Indica el nombre del proveedor', 'danger'); return; }
    try {
      const supplier = await onCreateSupplier({ name: supplierForm.name.trim(), nit: supplierForm.nit.trim() || null, phone: supplierForm.phone.trim() || null, contact: null, paymentTerms: null, balance: 0, status: 'active' });
      setRows((current) => {
        const index = current.findIndex((row) => !row.supplierId);
        if (index < 0) return [...current, { supplierId: String(supplier.id), unitCost: '', preferred: current.length === 0 }];
        return current.map((row, rowIndex) => rowIndex === index ? { ...row, supplierId: String(supplier.id) } : row);
      });
      setSupplierForm({ name: '', nit: '', phone: '' });
      setCreatingSupplier(false);
      pushToast?.('Proveedor creado y seleccionado', 'success');
    } catch (error) { pushToast?.(`No se pudo crear el proveedor: ${error.message}`, 'danger'); }
  };
  return <div className="catalog-supplier-editor">
    <div className="catalog-section-heading"><div><strong>Precios por proveedor</strong><span>El costo global conserva el precio del proveedor preferido.</span></div><Button type="button" size="sm" variant="ghost" icon="plus" onClick={addRow}>Agregar proveedor</Button></div>
    <div className="catalog-supplier-table">
      <div className="catalog-supplier-header"><span>Proveedor</span><span>Costo unitario</span><span>Preferido</span><span /></div>
      {rows.map((row, index) => {
        const usedByOthers = rows.filter((_, rowIndex) => rowIndex !== index).map((item) => String(item.supplierId));
        const options = suppliers.filter((supplier) => !usedByOthers.includes(String(supplier.id)) || String(supplier.id) === String(row.supplierId));
        return <div className="catalog-supplier-line" key={`${index}-${row.supplierId}`}>
          <select className="input" value={row.supplierId} onChange={(event) => setRow(index, 'supplierId', event.target.value)} aria-label={`Proveedor ${index + 1}`}><option value="">Seleccionar proveedor…</option>{options.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select>
          <input className="input mono" type="number" min="0.01" step="0.01" placeholder="0.00" value={row.unitCost} onChange={(event) => setRow(index, 'unitCost', event.target.value)} aria-label={`Costo del proveedor ${index + 1}`} />
          <label className="catalog-preferred"><input type="radio" name="catalog-preferred" checked={!!row.preferred} onChange={() => setRows((current) => current.map((item, rowIndex) => ({ ...item, preferred: rowIndex === index })))} /> Sí</label>
          <Button type="button" variant="ghost" size="sm" icon="x" aria-label="Quitar proveedor" onClick={() => removeRow(index)} disabled={rows.length === 1} />
        </div>;
      })}
    </div>
    <Button type="button" size="sm" variant="ghost" onClick={() => setCreatingSupplier((current) => !current)}>{creatingSupplier ? 'Cerrar creación inline' : 'Crear proveedor nuevo'}</Button>
    {creatingSupplier && <InlineCreate title="Crear proveedor y continuar" onSubmit={submitSupplier} onCancel={() => setCreatingSupplier(false)} submitLabel="Guardar proveedor"><div className="field-row"><div className="field"><label>Nombre *</label><input autoFocus value={supplierForm.name} onChange={(event) => setSupplierForm((current) => ({ ...current, name: event.target.value }))} /></div><div className="field"><label>NIT</label><input className="mono" value={supplierForm.nit} onChange={(event) => setSupplierForm((current) => ({ ...current, nit: event.target.value }))} /></div></div><div className="field" style={{ marginTop: 10 }}><label>Teléfono</label><input value={supplierForm.phone} onChange={(event) => setSupplierForm((current) => ({ ...current, phone: event.target.value }))} /></div></InlineCreate>}
  </div>;
}

function ProductModal({ product, categories, suppliers, selectedCategoryId, onClose, onSave, onCreateSupplier, pushToast }) {
  const existingRows = product?.suppliers?.length ? product.suppliers.map((supplier, index) => ({ supplierId: String(supplier.supplierId), unitCost: String(supplier.unitCost ?? ''), preferred: index === 0 || !!supplier.preferred })) : [{ supplierId: '', unitCost: '', preferred: true }];
  const [form, setForm] = useState({ name: product?.name || '', sku: product?.sku || '', categoryId: product?.cat ?? selectedCategoryId ?? '', unit: product?.unit || 'Unidad', purchaseUnit: product?.purchaseUnit || '', purchaseFactor: product?.purchaseFactor ?? 1, itemType: product?.itemType || 'sellable', price: product?.price ?? '', minStock: product?.min ?? '', status: product?.status || 'ACTIVE' });
  const [supplierRows, setSupplierRows] = useState(existingRows);
  const [saving, setSaving] = useState(false);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const save = async () => {
    if (!form.name.trim() || !form.sku.trim()) { pushToast?.('Nombre y SKU son obligatorios', 'danger'); return; }
    const validRows = supplierRows.filter((row) => row.supplierId || row.unitCost);
    if (form.itemType === 'raw_material' && !validRows.some((row) => row.supplierId && Number(row.unitCost) > 0)) { pushToast?.('La materia prima requiere al menos un proveedor con costo mayor que cero', 'danger'); return; }
    if (validRows.some((row) => !row.supplierId || !(Number(row.unitCost) > 0))) { pushToast?.('Completa proveedor y costo en cada fila o elimina la fila vacía', 'danger'); return; }
    const preferred = validRows.find((row) => row.preferred) || validRows[0];
    setSaving(true);
    try {
      await onSave({ id: product?.id, payload: { name: form.name.trim(), sku: form.sku.trim(), categoryId: form.categoryId === '' ? null : Number(form.categoryId), unit: form.unit, purchaseUnit: form.purchaseUnit.trim() || null, purchaseFactor: Number(form.purchaseFactor) || 1, itemType: form.itemType, cost: Number(preferred?.unitCost) || 0, price: Number(form.price) || 0, supplierId: preferred?.supplierId ? Number(preferred.supplierId) : null, supplierCost: preferred?.unitCost ? Number(preferred.unitCost) : null, minStock: Number(form.minStock) || 0, status: form.status }, supplierRows: validRows });
      onClose();
    } catch (error) { pushToast?.(`No se pudo guardar el producto: ${error.message}`, 'danger'); }
    finally { setSaving(false); }
  };
  return <div className="modal-overlay" onClick={() => !saving && onClose()}><div className="modal catalog-product-modal" onClick={(event) => event.stopPropagation()}><div className="modal-head"><div><h3>{product ? 'Editar producto' : 'Nuevo producto'}</h3><div className="body-small muted">El producto conserva su ID al moverse entre carpetas.</div></div><Button type="button" variant="ghost" iconOnly icon="x" onClick={onClose} /></div><div className="modal-body"><div className="form-grid"><div className="field span-2"><label>Nombre del producto *</label><input autoFocus value={form.name} onChange={(event) => set('name', event.target.value)} placeholder="Ej. Corredera telescópica 45 cm" /></div><div className="field"><label>SKU / código *</label><input className="mono" value={form.sku} onChange={(event) => set('sku', event.target.value)} placeholder="COR-45" /></div><div className="field"><label>Categoría</label><select className="input" value={form.categoryId} onChange={(event) => set('categoryId', event.target.value)}><option value="">Sin categoría</option>{categories.map((category) => <option key={category.id} value={category.id}>{categoryPath(categories, category.id)}</option>)}</select></div><div className="field"><label>Tipo de artículo</label><select className="input" value={form.itemType} onChange={(event) => set('itemType', event.target.value)}><option value="sellable">Vendible (POS)</option><option value="raw_material">Materia prima</option><option value="service">Servicio / mano de obra</option></select></div><div className="field"><label>Unidad</label><select className="input" value={form.unit} onChange={(event) => set('unit', event.target.value)}><option>Unidad</option><option>Paquete</option><option>Kg</option><option>Libra</option><option>Litro</option></select></div><div className="field"><label>Precio de venta (Q)</label><input className="mono" type="number" min="0" step="0.01" value={form.price} onChange={(event) => set('price', event.target.value)} /></div><div className="field"><label>Stock mínimo</label><input className="mono" type="number" min="0" step="0.001" value={form.minStock} onChange={(event) => set('minStock', event.target.value)} /></div><div className="field"><label>Unidad de compra</label><input value={form.purchaseUnit} onChange={(event) => set('purchaseUnit', event.target.value)} placeholder="Caja, paquete…" /></div><div className="field"><label>Unidades por compra</label><input className="mono" type="number" min="0.000001" step="0.001" value={form.purchaseFactor} onChange={(event) => set('purchaseFactor', event.target.value)} /></div></div><SupplierRows rows={supplierRows} setRows={setSupplierRows} suppliers={suppliers} onCreateSupplier={onCreateSupplier} pushToast={pushToast} /></div><div className="modal-foot"><Button type="button" onClick={onClose} disabled={saving}>Cancelar</Button><Button type="button" variant="accent" icon="check" onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar producto'}</Button></div></div></div>;
}

function CategoryModal({ category, initialParentId, categories, onClose, onSave }) {
  const [name, setName] = useState(category?.name || '');
  const [parentId, setParentId] = useState(category?.parentId ?? initialParentId ?? '');
  const [saving, setSaving] = useState(false);
  const blocked = category ? descendantsOf(categories, category.id) : new Set();
  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await onSave({ name: name.trim(), icon: category?.icon || null, parentId: parentId === '' ? null : Number(parentId) });
    setSaving(false);
  };
  return <div className="modal-overlay" onClick={onClose}><div className="modal catalog-category-modal" onClick={(event) => event.stopPropagation()}><div className="modal-head"><div><h3>{category ? 'Renombrar carpeta' : 'Nueva carpeta'}</h3><div className="body-small muted">Las carpetas pueden anidarse y moverse con drag-and-drop.</div></div><Button type="button" variant="ghost" iconOnly icon="x" onClick={onClose} /></div><div className="modal-body"><div className="field"><label>Nombre *</label><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Herrajes" /></div><div className="field" style={{ marginTop: 12 }}><label>Carpeta padre</label><select className="input" value={parentId} onChange={(event) => setParentId(event.target.value)}><option value="">Sin padre · Raíz</option>{categories.filter((item) => !blocked.has(String(item.id))).map((item) => <option key={item.id} value={item.id}>{categoryPath(categories, item.id)}</option>)}</select></div></div><div className="modal-foot"><Button type="button" onClick={onClose}>Cancelar</Button><Button type="button" variant="accent" icon="check" onClick={submit} disabled={!name.trim() || saving}>{saving ? 'Guardando…' : 'Guardar carpeta'}</Button></div></div></div>;
}

function UnifiedCatalogTree({ categories, products, search, selectedProductIds, selectedCategoryId, onSelectProducts, onSelectCategory, onCopyCategory, onEditCategory, onCreateSubcategory, onCreateProduct, onDrop, canDrop, canEdit, busy }) {
  const tree = useMemo(() => buildCatalogTree(categories, products, search), [categories, products, search]);
  const productCount = (categoryId) => products.filter((product) => String(product.cat) === String(categoryId)).length;
  const productNodes = useMemo(() => tree.filter((node) => node.data?.kind === 'product'), [tree]);
  const { select: selectProductRange, extend: extendProductSelection } = useTreeSelection(productNodes, {
    selectedKeys: [...selectedProductIds],
    getKey: (node) => String(node.data.productId),
    onChange: (ids, primaryNode) => onSelectProducts(ids, primaryNode?.data?.product || null),
  });
  const renderNode = (node, { depth, isOpen, onToggle, isDragging, isDropTarget, handleRef }) => {
    const kind = node.data?.kind;
    const isFolder = kind === 'category' || kind === 'root';
    const category = node.data?.category;
    const product = node.data?.product;
    const selected = kind === 'product' ? selectedProductIds.has(String(node.data.productId)) : kind === 'category' && String(selectedCategoryId) === String(node.data.categoryId);
    const count = kind === 'category' ? productCount(node.data.categoryId) : null;
    const handleKeyDown = (event) => {
      if (kind === 'product') extendProductSelection(node, event);
    };
    const rowClass = [
      treeStyles.row,
      selected && treeStyles.selected,
      isDropTarget && treeStyles.dropTarget,
      isDragging && treeStyles.dragging,
    ].filter(Boolean).join(' ');
    return <React.Fragment key={node.id}><div ref={handleRef} className={rowClass} style={{ paddingLeft: 12 + depth * 22 }} onClick={(event) => {
      if (kind === 'product') selectProductRange(node, event);
      else if (kind === 'category') onSelectCategory(category.id);
      else onSelectCategory(null);
    }} onKeyDown={handleKeyDown} tabIndex={kind === 'product' ? 0 : undefined} role={kind === 'product' ? 'option' : undefined} aria-selected={kind === 'product' ? selected : undefined}>
      {isFolder ? <button type="button" className={treeStyles.toggle} onMouseDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onToggle?.(); }} aria-label={isOpen ? 'Colapsar' : 'Expandir'}><Icon name={isOpen ? 'chevronDown' : 'chevronRight'} size={16} /></button> : <span className={treeStyles.toggleSpacer} />}
      <Icon name={kind === 'root' ? 'home' : isFolder ? 'folder' : 'box'} size={18} fill={isFolder && kind !== 'root'} />
      <span className={treeStyles.label}><strong>{node.text}</strong><small>{kind === 'root' ? `${products.length} productos · ${categories.length} carpetas` : isFolder ? `${count} productos directos · ${categoryPath(categories, category.id)}` : `${product.sku || 'Sin SKU'} · ${product.suppliers?.length || 0} proveedores · stock ${product.stock ?? 0}`}</small></span>
      {kind === 'product' && <span className={`mono ${catalogStyles.cost}`}>{product.suppliers?.length ? Q(Math.min(...product.suppliers.map((supplier) => Number(supplier.unitCost)))) : '—'}</span>}
      {isFolder && <span className="badge neutral">{count ?? products.length}</span>}
      {kind === 'root' && <div className={`${treeStyles.actions} ${catalogStyles.actions} ${catalogStyles.rootActions}`} onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}><Button type="button" variant="ghost" size="sm" icon="plus" onClick={() => onCreateSubcategory(null)} disabled={!canEdit || busy}>Carpeta</Button><Button type="button" variant="accent" size="sm" icon="plus" onClick={onCreateProduct} disabled={!canEdit || busy}>Producto</Button></div>}
      {kind === 'category' && <div className={`${treeStyles.actions} ${catalogStyles.actions}`} onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}><Button type="button" variant="ghost" size="sm" icon="copy" title="Copiar carpeta" aria-label="Copiar carpeta" onClick={() => onCopyCategory(category)} disabled={!canEdit || busy}>Copiar</Button><Button type="button" variant="ghost" size="sm" icon="edit" title="Renombrar carpeta" aria-label="Renombrar carpeta" onClick={() => onEditCategory(category)} disabled={!canEdit || busy}>Renombrar</Button><Button type="button" variant="ghost" size="sm" icon="plus" title="Crear subcarpeta" aria-label="Crear subcarpeta" onClick={() => onCreateSubcategory(category.id)} disabled={!canEdit || busy}>Crear subfolder</Button></div>}
    </div></React.Fragment>;
  };
  return <TreeView className={catalogStyles.tree} tree={tree} rootId={0} initialOpen sort={false} insertDroppableFirst={false} dropTargetOffset={0} canDrag={(node) => canEdit && ['category', 'product'].includes(node?.data?.kind)} canDrop={canDrop} onDrop={onDrop} render={renderNode} />;
}

export default function CatalogModule({ pushToast }) {
  const { items: products, loading: productsLoading, error: productsError, reload: reloadProducts, create: createProductApi } = useProducts({ size: 200 });
  const { items: categories, loading: categoriesLoading, error: categoriesError, reload: reloadCategories } = useCategoryTree();
  const { items: suppliers, reload: reloadSuppliers } = useSuppliers();
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedProductIds, setSelectedProductIds] = useState(() => new Set());
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [productModal, setProductModal] = useState(null);
  const [categoryModal, setCategoryModal] = useState(null);
  const [busy, setBusy] = useState(false);

  const selectedCategory = categories.find((category) => String(category.id) === String(selectedCategoryId));
  const handleSelectProducts = (ids, primaryProduct) => {
    setSelectedProductIds(new Set(ids));
    setSelectedProduct(primaryProduct || null);
    setSelectedCategoryId(primaryProduct?.cat ?? null);
  };
  const handleSelectCategory = (categoryId) => {
    setSelectedCategoryId(categoryId);
    setSelectedProduct(null);
    setSelectedProductIds(new Set());
  };
  const handleCreateSupplier = async (payload) => { const supplier = await createSupplier(payload); await reloadSuppliers(); return supplier; };
  const handleSaveProduct = async ({ id, payload, supplierRows }) => {
    setBusy(true);
    try {
      const saved = id ? await updateProduct(id, payload) : await createProductApi(payload);
      const existingIds = new Set((id ? (products.find((item) => item.id === id)?.suppliers ?? []) : []).map((supplier) => String(supplier.supplierId)));
      for (const row of supplierRows) if (!existingIds.has(String(row.supplierId)) && String(row.supplierId) !== String(payload.supplierId)) await addProductSupplier(saved.id, { supplierId: Number(row.supplierId), unitCost: Number(row.unitCost), preferred: !!row.preferred });
      await reloadProducts();
      setSelectedProduct(null);
      setSelectedProductIds(new Set());
      pushToast?.(`Producto ${id ? 'actualizado' : 'creado'} correctamente`, 'success');
    } finally { setBusy(false); }
  };
  const handleSaveCategory = async (payload) => {
    try {
      if (categoryModal?.category) await updateCategory(categoryModal.category.id, payload);
      else await createCategory(payload);
      await reloadCategories();
      setCategoryModal(null);
      pushToast?.(`Carpeta ${categoryModal?.category ? 'renombrada' : 'creada'}`, 'success');
    } catch (error) { pushToast?.(`No se pudo guardar la carpeta: ${error.message}`, 'danger'); }
  };
  const moveProducts = async (items, categoryId) => {
    if (!items.length) return;
    setBusy(true);
    try {
      for (const item of items) await moveCatalogProduct(item, categoryId);
      await reloadProducts();
      setSelectedProduct((current) => current ? { ...current, cat: categoryId == null ? null : Number(categoryId) } : current);
      pushToast?.(`${items.length} producto${items.length === 1 ? '' : 's'} movido${items.length === 1 ? '' : 's'} de carpeta`, 'success');
    } catch (error) { pushToast?.(`No se pudieron mover los productos: ${error.message}`, 'danger'); }
    finally { setBusy(false); }
  };
  const moveCategory = async (category, parentId) => {
    setBusy(true);
    try { await updateCategory(category.id, { name: category.name, icon: category.icon || null, parentId }); await reloadCategories(); setSelectedCategoryId(category.id); pushToast?.('Carpeta movida', 'success'); }
    catch (error) { pushToast?.(`No se pudo mover la carpeta: ${error.message}`, 'danger'); }
    finally { setBusy(false); }
  };
  const copyCategoryAction = async (category) => {
    setBusy(true);
    try { await copyCategory(category.id); await reloadCategories(); pushToast?.('Carpeta y subcarpetas copiadas. Los productos no se duplicaron.', 'success'); }
    catch (error) { pushToast?.(`No se pudo copiar la carpeta: ${error.message}`, 'danger'); }
    finally { setBusy(false); }
  };
  const tree = useMemo(() => buildCatalogTree(categories, products, search), [categories, products, search]);
  const resolveTreeNode = (id) => tree.find((node) => String(node.id) === String(id));
  const wouldCreateCycle = (sourceId, targetId) => targetId != null && descendantsOf(categories, sourceId).has(String(targetId));
  const canDrop = (_currentTree, { dragSourceId, dropTargetId, dragSource, dropTarget }) => {
    const source = dragSource || resolveTreeNode(dragSourceId);
    const target = dropTarget || (dropTargetId === 0 ? resolveTreeNode('catalog-root') : resolveTreeNode(dropTargetId));
    if (!source || !target || !['root', 'category'].includes(target.data?.kind)) return false;
    if (source.data?.kind === 'category' && target.data?.kind === 'category') return String(source.data.categoryId) !== String(target.data.categoryId) && !wouldCreateCycle(source.data.categoryId, target.data.categoryId);
    return ['category', 'product'].includes(source.data?.kind);
  };
  const handleDrop = async (_nextTree, { dragSourceId, dropTargetId, dragSource, dropTarget }) => {
    const source = dragSource || resolveTreeNode(dragSourceId);
    const target = dropTarget || (dropTargetId === 0 ? resolveTreeNode('catalog-root') : resolveTreeNode(dropTargetId));
    if (!source || !target) return;
    const targetCategoryId = target.data?.kind === 'category' ? target.data.categoryId : null;
    if (source.data?.kind === 'product') {
      const selectedIds = selectedProductIds.has(String(source.data.productId)) ? selectedProductIds : new Set([String(source.data.productId)]);
      await moveProducts(products.filter((product) => selectedIds.has(String(product.id))), targetCategoryId);
    }
    if (source.data?.kind === 'category') await moveCategory(source.data.category, targetCategoryId);
  };
  const openNewProduct = () => setProductModal({ product: null });
  const openNewCategory = (parentId = null) => setCategoryModal({ category: null, parentId });
  const selectedProductsInCategory = selectedCategoryId == null ? products.length : products.filter((product) => String(product.cat) === String(selectedCategoryId)).length;

  return <div className="page catalog-page"><div className="page-head"><div><h1 className="page-title">Catálogo de productos</h1><div className="page-subtitle">Organiza folders y productos en un solo árbol. Arrastra para mover; copia o renombra carpetas desde cada nodo.</div></div><div className="page-head-actions"><Button icon="plus" variant="accent" onClick={openNewProduct}>Nuevo producto</Button></div></div>
    {(productsError || categoriesError) && <div className="alert" style={{ marginBottom: 12 }}><Icon name="alert" size={16} />No se pudo cargar todo el catálogo. Verifica que el backend tenga aplicada la migración 057.</div>}
    <div className="catalog-stats"><div className="stat"><span>Productos</span><strong>{products.length}</strong></div><div className="stat"><span>Carpetas</span><strong>{categories.length}</strong></div><div className="stat"><span>Proveedores asociados</span><strong>{products.reduce((total, product) => total + (product.suppliers?.length || 0), 0)}</strong></div><div className="stat"><span>En vista seleccionada</span><strong>{selectedProductsInCategory}</strong></div></div>
    <div className="catalog-unified-layout"><section className="card catalog-unified-card"><div className="card-head"><div><h3>Árbol del catálogo</h3><span className="body-small muted">Misma interacción que Materiales: arrastra folders y productos entre destinos.</span></div></div><div className="catalog-tree-toolbar"><div className="catalog-search"><Icon name="search" size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar SKU, nombre o carpeta…" /></div><span className="muted mono">{selectedProductIds.size > 1 ? `${selectedProductIds.size} productos seleccionados` : search ? 'Filtro activo' : `${products.length} productos · ${categories.length} carpetas`}</span></div><div className="catalog-tree-hint"><Icon name="info" size={15} />Arrastra productos a carpetas, carpetas a otras carpetas o cualquier elemento a Raíz. Copiar una carpeta conserva su estructura, pero no duplica productos.</div>{productsLoading || categoriesLoading ? <div className="catalog-empty">Cargando catálogo…</div> : <UnifiedCatalogTree categories={categories} products={products} search={search} selectedProductIds={selectedProductIds} selectedCategoryId={selectedCategoryId} onSelectProducts={handleSelectProducts} onSelectCategory={handleSelectCategory} onCopyCategory={copyCategoryAction} onEditCategory={(category) => setCategoryModal({ category, parentId: category.parentId })} onCreateSubcategory={openNewCategory} onCreateProduct={openNewProduct} onDrop={handleDrop} canDrop={canDrop} canEdit={!busy} busy={busy} />}</section>
      <aside className="card catalog-unified-inspector"><div className="card-head"><h3>{selectedProduct ? 'Detalle del producto' : selectedCategory ? 'Detalle de carpeta' : 'Inspector'}</h3>{selectedProduct && <Button type="button" variant="ghost" size="sm" icon="edit" onClick={() => setProductModal({ product: selectedProduct })}>Editar</Button>}</div>{selectedProduct ? <div className="card-body"><div className="catalog-detail-title"><div className="catalog-product-icon"><Icon name="box" size={20} /></div><div><h3>{selectedProduct.name}</h3><span className="mono muted">{selectedProduct.sku}</span></div></div><div className="catalog-detail-section"><div className="catalog-detail-heading"><strong>Precios por proveedor</strong><span className="badge accent">{selectedProduct.suppliers?.length || 0}</span></div>{selectedProduct.suppliers?.length ? [...selectedProduct.suppliers].sort((left, right) => Number(left.unitCost) - Number(right.unitCost)).map((supplier) => <div className="catalog-price-row" key={supplier.supplierId}><div><strong>{supplier.supplierName}</strong><small>{supplier.preferred ? 'Proveedor preferido' : 'Precio asociado'}</small></div><span className="mono">{Q(supplier.unitCost)}</span></div>) : <div className="catalog-empty-inline">Este producto aún no tiene proveedor asociado.</div>}<Button type="button" size="sm" variant="ghost" icon="plus" onClick={() => setProductModal({ product: selectedProduct })}>Asociar proveedor</Button></div><div className="catalog-detail-section"><div className="catalog-detail-grid"><div><span>Carpeta</span><strong>{categoryPath(categories, selectedProduct.cat) || 'Raíz'}</strong></div><div><span>Tipo</span><strong>{ITEM_TYPES[selectedProduct.itemType]?.label || 'Producto'}</strong></div><div><span>Stock</span><strong className="mono">{selectedProduct.stock ?? 0}</strong></div><div><span>Precio venta</span><strong className="mono">{Q(selectedProduct.price)}</strong></div></div></div><div className="catalog-detail-section"><div className="catalog-inspector-note"><Icon name="info" size={15} />Mueve este producto directamente desde el árbol para conservar su ID y sus proveedores.</div></div></div> : selectedCategory ? <div className="card-body"><div className="catalog-detail-title"><div className="catalog-product-icon"><Icon name="folder" size={20} /></div><div><h3>{selectedCategory.name}</h3><span className="muted">{categoryPath(categories, selectedCategory.id)}</span></div></div><div className="catalog-detail-section"><div className="catalog-detail-grid"><div><span>Productos directos</span><strong>{products.filter((product) => String(product.cat) === String(selectedCategory.id)).length}</strong></div><div><span>Subcarpetas</span><strong>{categories.filter((category) => String(category.parentId) === String(selectedCategory.id)).length}</strong></div></div></div><div className="catalog-detail-section catalog-inspector-actions"><Button type="button" size="sm" variant="ghost" icon="edit" onClick={() => setCategoryModal({ category: selectedCategory, parentId: selectedCategory.parentId })}>Renombrar</Button><Button type="button" size="sm" variant="ghost" icon="copy" onClick={() => copyCategoryAction(selectedCategory)}>Copiar</Button><Button type="button" size="sm" variant="accent" icon="plus" onClick={() => openNewProduct()}>Producto aquí</Button></div></div> : <div className="catalog-empty detail-empty"><Icon name="drag_handle" size={28} /><strong>Selecciona un producto o carpeta</strong><span>El detalle y las acciones aparecerán aquí.</span></div>}</aside></div>
    {productModal && <ProductModal product={productModal.product} categories={categories} suppliers={suppliers} selectedCategoryId={selectedCategoryId} onClose={() => setProductModal(null)} onSave={handleSaveProduct} onCreateSupplier={handleCreateSupplier} pushToast={pushToast} />}
    {categoryModal && <CategoryModal category={categoryModal.category} initialParentId={categoryModal.parentId} categories={categories} onClose={() => setCategoryModal(null)} onSave={handleSaveCategory} />}
  </div>;
}
