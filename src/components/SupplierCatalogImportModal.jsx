import React, { useEffect, useMemo, useState } from 'react';
import Autocomplete from './Autocomplete.jsx';
import Button from './Button.jsx';
import DataTable from './DataTable.jsx';
import { listSupplierWebsites, previewCatalogImport, approveCatalogImport, rejectCatalogImport, applyCatalogImport, updateCatalogImportDecision, excludeCatalogImportItem } from '../api/supplierIngestion.js';
import { parseCatalogCsv } from '../lib/catalogImportCsv.js';

const price = (value) => value == null ? '—'
  : `Q ${Number(value).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const confidence = (item) => {
  const value = Number(item.confidence?.match ?? item.confidence?.action ?? 0);
  return `${Math.round(value * 100)}%`;
};

export default function SupplierCatalogImportModal({ suppliers, initialSupplierId, onClose, pushToast }) {
  const [supplierId, setSupplierId] = useState(initialSupplierId != null ? String(initialSupplierId) : '');
  const [websiteId, setWebsiteId] = useState('');
  const [websites, setWebsites] = useState([]);
  const [file, setFile] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [parsedRows, setParsedRows] = useState([]);
  const [batch, setBatch] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setWebsiteId('');
    if (!supplierId) { setWebsites([]); return undefined; }
    let active = true;
    listSupplierWebsites(supplierId).then((rows) => {
      if (active) setWebsites(Array.isArray(rows) ? rows : []);
    }).catch((err) => {
      if (active) setError(err.message);
    });
    return () => { active = false; };
  }, [supplierId]);

  const supplierOptions = useMemo(() => (suppliers || []).map((supplier) => ({
    id: String(supplier.id), name: supplier.name,
  })), [suppliers]);
  const websiteOptions = useMemo(() => websites.map((website) => ({
    id: String(website.id), name: `${website.name} · ${website.baseUrl}`,
  })), [websites]);

  const chooseFile = async (event) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    setError('');
    setFile(selected);
    try {
      setParsedRows(parseCatalogCsv(await selected.text()));
    } catch (err) {
      setParsedRows([]);
      setError(err.message);
    }
  };

  const createPreview = async () => {
    if (!supplierId || !websiteId || !parsedRows.length) {
      setError('Selecciona proveedor, sitio web y un CSV con productos.');
      return;
    }
    setBusy(true); setError('');
    try {
      const response = await previewCatalogImport({
        supplierId: Number(supplierId),
        supplierWebsiteId: Number(websiteId),
        sourceType: 'csv',
        sourceReference: file?.name || 'carga.csv',
        userPrompt: prompt.trim() || null,
        items: parsedRows,
      });
      setBatch(response);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const review = async (kind) => {
    if (!batch) return;
    setBusy(true); setError('');
    try {
      const response = kind === 'approve'
        ? await approveCatalogImport(batch.id)
        : await rejectCatalogImport(batch.id);
      setBatch(response);
      pushToast?.(kind === 'approve' ? 'Propuestas aprobadas' : 'Propuestas rechazadas', 'success');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!batch) return;
    setBusy(true); setError('');
    try {
      setBatch(await applyCatalogImport(batch.id));
      pushToast?.('Carga aplicada al catálogo', 'success');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const chooseCandidate = async (row, productId) => {
    if (!batch || !productId) return;
    setBusy(true); setError('');
    try {
      setBatch(await updateCatalogImportDecision(batch.id, row.id, {
        action: 'LINK_EXISTING_PRODUCT', targetProductId: Number(productId),
      }));
      pushToast?.('Candidato actualizado', 'success');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const chooseCreate = async (row) => {
    if (!batch) return;
    setBusy(true); setError('');
    try {
      setBatch(await updateCatalogImportDecision(batch.id, row.id, { action: 'CREATE', targetProductId: null }));
      pushToast?.('La fila quedó propuesta como producto nuevo', 'success');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const excludeRow = async (row) => {
    if (!batch || !window.confirm(`Excluir de esta carga: ${row.sourceProductName || 'esta fila'}?`)) return;
    setBusy(true); setError('');
    try {
      setBatch(await excludeCatalogImportItem(batch.id, row.id));
      pushToast?.('Fila excluida de esta carga', 'success');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    { key: 'rowNumber', header: '#', width: 54, mono: true },
    { key: 'name', header: 'Producto', render: (row) => row.sourceProductName || row.rawPayload?.name || row.name || '—' },
    { key: 'action', header: 'Acción', render: (row) => <span className={`badge-m3 ${row.action === 'REVIEW' ? 'warning' : row.action === 'CREATE' ? 'accent' : 'success'}`}>{row.action}</span> },
    { key: 'confidence', header: 'Conf.', render: confidence },
    { key: 'targetProductId', header: 'Match', render: (row) => {
      const alternatives = row.alternativeCandidates || [];
      if (!alternatives.length) return row.targetProductId ? `#${row.targetProductId}` : '—';
      return (
        <select className="tbl-page-size" value={row.targetProductId || ''}
          onChange={(event) => chooseCandidate(row, event.target.value)} disabled={busy}>
          <option value="">Seleccionar…</option>
          {alternatives.map((candidate) => (
            <option key={candidate.productId} value={candidate.productId}>
              #{candidate.productId} · {candidate.name}
            </option>
          ))}
        </select>
      );
    }},
    { key: 'decisionAction', header: 'Decidir', render: (row) => row.action === 'REVIEW' ? (
      <span className="row-actions" style={{ display: 'inline-flex', gap: 6 }}>
        <Button size="sm" variant="tonal" disabled={busy || !row.targetProductId}
          onClick={() => chooseCandidate(row, row.targetProductId)}>Vincular</Button>
        <Button size="sm" variant="ghost" disabled={busy}
          onClick={() => chooseCreate(row)}>Crear</Button>
      </span>
    ) : <span className="muted">—</span> },
    { key: 'categories', header: 'Categorías', render: (row) => (
      <div className="body-small" style={{ lineHeight: 1.35 }}>
        <div><span className="muted">Actual:</span> {row.currentCategoryPath?.length ? row.currentCategoryPath.join(' › ') : '—'}</div>
        <div><span className="muted">Web:</span> {row.proposedCategoryPath?.length ? row.proposedCategoryPath.join(' › ') : '—'}</div>
      </div>
    )},
    { key: 'currentUnitCost', header: 'Precio actual', align: 'right', render: (row) => <span className="num">{price(row.currentUnitCost)}</span> },
    { key: 'proposedUnitCost', header: 'Nuevo', align: 'right', render: (row) => <span className="num" style={{ fontWeight: 600 }}>{price(row.proposedUnitCost)}</span> },
    { key: 'decisionReason', header: 'Motivo', render: (row) => <span className="muted">{row.decisionReason || '—'}</span> },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 'min(1100px, 96vw)' }} onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h3>Importar catálogo del proveedor</h3>
            <div className="muted body-small">La carga siempre pasa por pre-autorización antes de modificar el catálogo.</div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <div className="modal-body">
          {!batch && (
            <div className="form-grid">
              <div className="field">
                <label className="field-label">Proveedor *</label>
                <Autocomplete value={supplierId} onChange={(value) => setSupplierId(value == null ? '' : String(value))}
                  options={supplierOptions} allowClear={false} placeholder="Seleccionar proveedor…" emptyText="Sin proveedores" />
              </div>
              <div className="field">
                <label className="field-label">Sitio web *</label>
                <Autocomplete value={websiteId} onChange={(value) => setWebsiteId(value == null ? '' : String(value))}
                  options={websiteOptions} allowClear={false} placeholder="Seleccionar sitio…" emptyText="Registra primero un sitio" />
              </div>
              <div className="field span-2">
                <label className="field-label">Archivo CSV *</label>
                <input className="field-input" type="file" accept=".csv,text/csv" onChange={chooseFile} />
                {file && <div className="muted body-small" style={{ marginTop: 6 }}>{file.name} · {parsedRows.length} productos detectados</div>}
              </div>
              <div className="field span-2">
                <label className="field-label">Instrucciones opcionales para esta carga</label>
                <textarea className="field-input" rows="3" value={prompt} onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Ej. Solo importar Madera > Pino; ignorar herramientas y productos agotados." />
              </div>
            </div>
          )}
          {batch && (
            <>
              <div className="import-summary-strip" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                <span className="badge-m3">Filas <b>{batch.itemCount}</b></span>
                <span className="badge-m3">Estado <b>{batch.status}</b></span>
                <span className="badge-m3 accent">Crear <b>{batch.items.filter((row) => row.action === 'CREATE').length}</b></span>
                <span className="badge-m3 warning">Revisión <b>{batch.items.filter((row) => row.action === 'REVIEW').length}</b></span>
              </div>
              <div className="cfg-hint" style={{ marginBottom: 10 }}>
                <b>BD</b> = costo vigente del proveedor · <b>Nuevo</b> = costo detectado · <b>Match</b> = producto candidato · <b>Motivo</b> = explicación de la decisión.
              </div>
              <DataTable rowKey={(row) => row.id} columns={columns} rows={batch.items} density="compact" pageSize={12}
                actions={(row) => (
                  <Button variant="icon" icon="trash" title="Excluir de esta carga" aria-label="Excluir de esta carga"
                    disabled={busy} onClick={() => excludeRow(row)} />
                )}
                empty="Sin decisiones" />
            </>
          )}
          {error && <div className="alert danger" style={{ marginTop: 12 }}>{error}</div>}
        </div>
        <div className="modal-foot">
          <Button variant="ghost" onClick={onClose}>Cerrar</Button>
          {!batch && <Button icon="upload" variant="accent" disabled={busy || !parsedRows.length} onClick={createPreview}>{busy ? 'Analizando…' : 'Generar pre-autorización'}</Button>}
          {batch?.status === 'preview' && <>
            <Button variant="danger" disabled={busy} onClick={() => review('reject')}>Rechazar propuestas</Button>
            <Button variant="accent" disabled={busy || batch.items.some((row) => row.action === 'REVIEW')} onClick={() => review('approve')}>Aprobar propuestas</Button>
          </>}
          {batch?.status === 'approved' && <Button icon="check" variant="accent" disabled={busy} onClick={apply}>Aplicar carga</Button>}
        </div>
      </div>
    </div>
  );
}
