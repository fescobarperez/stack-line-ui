import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Autocomplete from './Autocomplete.jsx';
import Button from './Button.jsx';
import DataTable from './DataTable.jsx';
import CrawlerImportAnimation from './CrawlerImportAnimation.jsx';
import { listSupplierWebsites, listCatalogImportBatches, listPendingCatalogImportBatches, startSupplierWebsiteCrawl, getCrawlRun, getCatalogImportBatch, deleteCatalogImport, previewCatalogImport, approveCatalogImport, rejectCatalogImport, applyCatalogImport, saveCatalogImportProgress, excludeCatalogImportItem } from '../api/supplierIngestion.js';
import { parseCatalogCsv } from '../lib/catalogImportCsv.js';

const price = (value) => value == null ? '—'
  : `Q ${Number(value).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatElapsed = (seconds) => {
  if (seconds == null) return '—';
  const total = Math.max(0, Math.round(Number(seconds)));
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return minutes ? `${minutes}m ${remainder}s` : `${remainder}s`;
};

const formatHeartbeat = (epochSeconds) => {
  if (epochSeconds == null) return '—';
  const date = new Date(Number(epochSeconds) * 1000);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleTimeString();
};

const confidence = (item) => {
  const rawValue = item?.confidence?.match ?? item?.confidence;
  const numericValue = Number(rawValue);
  if (!Number.isFinite(numericValue)) return '—';
  const percentage = Math.max(0, Math.min(1, numericValue)) * 100;
  return `${Math.round(percentage)}%`;
};

export default function SupplierCatalogImportModal({ suppliers, initialSupplierId, onClose, pushToast }) {
  const [supplierId, setSupplierId] = useState(initialSupplierId != null ? String(initialSupplierId) : '');
  const [websiteId, setWebsiteId] = useState('');
  const [websites, setWebsites] = useState([]);
  const [pendingBatches, setPendingBatches] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [mode, setMode] = useState('csv');
  const [categoryUrl, setCategoryUrl] = useState('');
  const [maxPages, setMaxPages] = useState('');
  const [file, setFile] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [parsedRows, setParsedRows] = useState([]);
  const [crawlResult, setCrawlResult] = useState(null);
  const [crawlRunId, setCrawlRunId] = useState(null);
  const [batch, setBatch] = useState(null);
  const [dirtyDecisions, setDirtyDecisions] = useState({});
  const [savingProgress, setSavingProgress] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dirtyDecisionsRef = useRef({});
  const savingProgressRef = useRef(false);

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


  useEffect(() => {
    setPendingBatches([]);
    if (!websiteId) return undefined;
    let active = true;
    setPendingLoading(true);
    const timeout = window.setTimeout(() => {
      if (!active) return;
      active = false;
      setPendingLoading(false);
      setError('La búsqueda de propuestas tardó demasiado. Verifica que el backend esté respondiendo y vuelve a seleccionar el sitio.');
    }, 15000);
    listPendingCatalogImportBatches(websiteId, { silent: true }).then((rows) => {
      if (!active) return;
      setPendingBatches(Array.isArray(rows) ? rows : []);
    }).catch((err) => {
      if (active) setError(`No se pudieron cargar las propuestas pendientes: ${err.message}`);
    }).finally(() => {
      window.clearTimeout(timeout);
      if (active) setPendingLoading(false);
    });
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [websiteId]);
  const crawlStorageKey = websiteId ? `stackline:crawl-run:${websiteId}` : null;

  useEffect(() => {
    if (!crawlStorageKey || batch) return undefined;
    const stored = window.localStorage.getItem(crawlStorageKey);
    if (stored) {
      setCrawlRunId(Number(stored));
      setBusy(true);
    }
    return undefined;
  }, [crawlStorageKey, batch]);

  useEffect(() => {
    if (!crawlRunId || batch) return undefined;
    let active = true;
    const terminalStatuses = ['completed', 'execution_failed', 'quality_failed', 'failed', 'cancelled'];
    const clearRun = () => {
      setBusy(false);
      if (crawlStorageKey) window.localStorage.removeItem(crawlStorageKey);
      setCrawlRunId(null);
    };
    const loadCompletedBatch = async (current) => {
      let completedBatch = current.importBatchId
        ? await getCatalogImportBatch(current.importBatchId, { silent: true })
        : null;
      if (!completedBatch) {
        const rows = await listCatalogImportBatches({ silent: true });
        completedBatch = (Array.isArray(rows) ? rows : []).find((row) =>
          row.status === 'preview' && Number(row.crawlRunId) === Number(current.crawlRunId));
      }
      if (!active) return;
      if (!completedBatch) {
        setError('El crawling terminó, pero no se encontró su propuesta de importación. Revisa el listado de importaciones.');
        clearRun();
        return;
      }
      setBatch(completedBatch);
      setDirtyDecisions({});
      clearRun();
      pushToast?.(`Crawling terminado: ${current.productsExtracted} productos extraídos`, 'success');
    };
    const poll = async () => {
      let current = null;
      try {
        current = await getCrawlRun(crawlRunId, { silent: true });
        if (!active) return;
        setCrawlResult(current);
        if (current.status === 'completed') {
          await loadCompletedBatch(current);
        } else if (terminalStatuses.includes(current.status)) {
          setError(current.errorMessage || current.qualityReport?.error?.message || 'El crawling no pudo completarse. Revisa el resultado de calidad.');
          clearRun();
        }
      } catch (err) {
        if (!active) return;
        setError(err.message);
        // No dejar la UI en el estado de crawling si el servidor ya marcó la corrida como terminal.
        if (current && terminalStatuses.includes(current.status)) clearRun();
      }
    };
    poll();
    const timer = window.setInterval(poll, 2000);
    return () => { active = false; window.clearInterval(timer); };
  }, [crawlRunId, batch, crawlStorageKey, pushToast]);

  const supplierOptions = useMemo(() => (suppliers || []).map((supplier) => ({
    id: String(supplier.id), name: supplier.name,
  })), [suppliers]);
  const websiteOptions = useMemo(() => websites.map((website) => ({
    id: String(website.id), name: `${website.name} · ${website.baseUrl}`,
  })), [websites]);
  const dirtyCount = Object.keys(dirtyDecisions).length;

  useEffect(() => {
    dirtyDecisionsRef.current = dirtyDecisions;
  }, [dirtyDecisions]);

  const saveProgress = useCallback(async ({ notify = false } = {}) => {
    if (!batch || savingProgressRef.current) return true;
    const snapshot = dirtyDecisionsRef.current;
    const decisions = Object.values(snapshot);
    if (!decisions.length) return true;
    savingProgressRef.current = true;
    setSavingProgress(true);
    setError('');
    try {
      const response = await saveCatalogImportProgress(batch.id, decisions);
      setBatch(response);
      setDirtyDecisions((current) => Object.fromEntries(
        Object.entries(current).filter(([itemId, decision]) =>
          JSON.stringify(decision) !== JSON.stringify(snapshot[itemId]))
      ));
      if (notify) pushToast?.('Progreso guardado', 'success');
      return true;
    } catch (err) {
      setError(`No se pudo guardar el progreso: ${err.message}`);
      return false;
    } finally {
      savingProgressRef.current = false;
      setSavingProgress(false);
    }
  }, [batch, pushToast]);

  useEffect(() => {
    if (!batch || !dirtyCount) return undefined;
    const timer = window.setInterval(() => { saveProgress(); }, 15000);
    return () => window.clearInterval(timer);
  }, [batch, dirtyCount, saveProgress]);

  const setLocalDecision = (row, action, targetProductId = null) => {
    if (!batch || busy || savingProgress) return;
    const decision = { itemId: row.id, action, targetProductId };
    setBatch((current) => current ? {
      ...current,
      items: current.items.map((item) => item.id === row.id
        ? { ...item, action, targetProductId }
        : item),
    } : current);
    setDirtyDecisions((current) => ({ ...current, [row.id]: decision }));
  };

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

  const openPendingBatch = async (pending) => {
    setBusy(true); setError('');
    try {
      const response = await getCatalogImportBatch(pending.id, { silent: true });
      setBatch(response);
      setCrawlResult(null);
      setCrawlRunId(null);
      setDirtyDecisions({});
      if (crawlStorageKey) window.localStorage.removeItem(crawlStorageKey);
    } catch (err) {
      setError(`No se pudo abrir la propuesta: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const deleteProposal = async (proposal = batch) => {
    if (!proposal?.id) return;
    const reference = proposal.sourceReference || 'esta propuesta';
    if (!window.confirm(`Eliminar la propuesta de ${reference}? Esta acción no se puede deshacer.`)) return;
    setBusy(true); setError('');
    try {
      await deleteCatalogImport(proposal.id);
      setPendingBatches((current) => current.filter((pending) => pending.id !== proposal.id));
      if (batch?.id === proposal.id) {
        setBatch(null);
        setDirtyDecisions({});
        setCrawlResult(null);
      }
      pushToast?.('Propuesta eliminada', 'success');
    } catch (err) {
      setError(`No se pudo eliminar la propuesta: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const createCrawl = async () => {
    if (!supplierId || !websiteId) {
      setError('Selecciona proveedor y sitio web.');
      return;
    }
    setBusy(true); setError('');
    try {
      const response = await startSupplierWebsiteCrawl(Number(websiteId), {
        categoryUrls: categoryUrl.trim() ? [categoryUrl.trim()] : [],
        userPrompt: prompt,
        maxPages,
      });
      setCrawlResult(response);
      setCrawlRunId(response.crawlRunId);
      window.localStorage.setItem(crawlStorageKey, String(response.crawlRunId));

    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
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
      setDirtyDecisions({});
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const review = async (kind) => {
    if (!batch) return;
    if (!await saveProgress()) return;
    setBusy(true); setError('');
    try {
      const response = kind === 'approve'
        ? await approveCatalogImport(batch.id)
        : await rejectCatalogImport(batch.id);
      setBatch(response);
      setDirtyDecisions({});
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

  const chooseCandidate = (row, productId) => {
    if (!productId) return;
    setLocalDecision(row, 'LINK_EXISTING_PRODUCT', Number(productId));
  };

  const chooseCreate = (row) => {
    setLocalDecision(row, 'CREATE');
  };

  const excludeRow = async (row) => {
    if (!batch || !window.confirm(`Excluir de esta carga: ${row.sourceProductName || 'esta fila'}?`)) return;
    setBusy(true); setError('');
    try {
      setBatch(await excludeCatalogImportItem(batch.id, row.id));
      setDirtyDecisions((current) => {
        const next = { ...current };
        delete next[row.id];
        return next;
      });
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
          onChange={(event) => chooseCandidate(row, event.target.value)} disabled={busy || savingProgress}>
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
        <Button size="sm" variant="tonal" disabled={busy || savingProgress || !row.targetProductId}
          onClick={() => chooseCandidate(row, row.targetProductId)}>Vincular</Button>
        <Button size="sm" variant="ghost" disabled={busy || savingProgress}
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
          {!batch && !crawlRunId && (
            <div className="form-grid">
              <div className="field span-2">
                <label className="field-label">Origen del catálogo</label>
                <div className="row-actions" style={{ display: 'flex', gap: 8 }}>
                  <Button type="button" variant={mode === 'csv' ? 'accent' : 'tonal'} onClick={() => setMode('csv')}>Archivo CSV</Button>
                  <Button type="button" variant={mode === 'web' ? 'accent' : 'tonal'} onClick={() => setMode('web')}>Sitio web</Button>
                </div>
              </div>
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
              {mode === 'csv' ? (
                <div className="field span-2">
                  <label className="field-label">Archivo CSV *</label>
                  <input className="field-input" type="file" accept=".csv,text/csv" onChange={chooseFile} />
                  {file && <div className="muted body-small" style={{ marginTop: 6 }}>{file.name} · {parsedRows.length} productos detectados</div>}
                </div>
              ) : (
                <>
                  <div className="field span-2">
                    <label className="field-label">URL de categoría o catálogo (opcional)</label>
                    <input className="field-input" type="url" value={categoryUrl} onChange={(event) => setCategoryUrl(event.target.value)}
                      placeholder="Vacío = usar la URL base del sitio" />
                  </div>
                  <div className="field">
                    <label className="field-label">Máximo de páginas (opcional)</label>
                    <input className="field-input" type="number" min="1" value={maxPages} onChange={(event) => setMaxPages(event.target.value)}
                      placeholder="Sin límite artificial" />
                  </div>
                </>
              )}
              <div className="field span-2">
                <label className="field-label">Instrucciones opcionales para esta carga</label>
                <textarea className="field-input" rows="3" value={prompt} onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Ej. Solo importar Madera > Pino; ignorar herramientas y productos agotados." />
              </div>
            </div>
          )}
          {!batch && !crawlRunId && mode === 'web' && websiteId && (pendingLoading || pendingBatches.length > 0) && (
            <div className="cfg-hint" style={{ marginTop: 12 }} aria-live="polite">
              <b>Propuestas pendientes de este sitio</b>
              {pendingLoading && <div className="muted body-small" role="status" style={{ marginTop: 6 }}>Cargando propuestas pendientes… El botón de ejecutar crawling se habilitará al terminar.</div>}
              {!pendingLoading && pendingBatches.map((pending) => (
                <div key={pending.id} className="row-actions" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 8 }}>
                  <span className="body-small">
                    {pending.sourceReference || 'Página sin URL registrada'} · {pending.itemCount} filas
                  </span>
                  <span className="row-actions" style={{ display: 'inline-flex', gap: 8 }}>
                    <Button size="sm" variant="tonal" disabled={busy} onClick={() => openPendingBatch(pending)}>
                      Abrir propuesta
                    </Button>
                    <Button size="sm" variant="danger" disabled={busy} onClick={() => deleteProposal(pending)}>
                      Eliminar
                    </Button>
                  </span>
                </div>
              ))}
              {!pendingLoading && pendingBatches.length > 1 && (
                <div className="muted body-small" style={{ marginTop: 8 }}>
                  Puedes iniciar un crawling para otra página; el bloqueo aplica únicamente a la URL de cada propuesta.
                </div>
              )}
            </div>
          )}
          {!batch && crawlRunId && (
            <div className="cfg-hint" style={{ minHeight: 260, display: 'grid', placeItems: 'center', textAlign: 'center', padding: 32 }}>
              <div>
                <CrawlerImportAnimation crawlResult={crawlResult} />
                <h3>Estamos recorriendo el catálogo</h3>
                <p className="muted" style={{ maxWidth: 560, margin: '8px auto 16px' }}>
                  Este proceso puede tardar varios minutos. Puedes cerrar o actualizar esta ventana; la corrida continuará en el servidor.
                </p>
                <div className="import-summary-strip" style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <span className="badge-m3">Estado <b>{crawlResult?.status || 'queued'}</b></span>
                  <span className="badge-m3">Run ID <b style={{ fontFamily: 'monospace', fontSize: 12 }}>{crawlRunId}</b></span>
                  {crawlResult?.pagesVisited != null && <span className="badge-m3">Páginas <b>{crawlResult.pagesVisited}/{crawlResult.pagesDiscovered}</b></span>}
                  {crawlResult?.productsExtracted != null && <span className="badge-m3">Productos <b>{crawlResult.productsExtracted}</b></span>}
                </div>
                <div className="import-summary-strip" style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  <span className="badge-m3">Etapa <b>{crawlResult?.stage || 'initializing'}</b></span>
                  <span className="badge-m3">Tiempo <b>{formatElapsed(crawlResult?.elapsedSeconds)}</b></span>
                  <span className="badge-m3">Última actividad <b>{formatHeartbeat(crawlResult?.lastHeartbeatAt)}</b></span>
                </div>
                <p className="muted body-small" style={{ marginTop: 16 }}>No se puede iniciar otra corrida para este sitio mientras esta esté activa.</p>
              </div>
            </div>
          )}
          {batch && (
            <>
              {crawlResult && (
                <div className="import-summary-strip" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                  <span className="badge-m3">Páginas <b>{crawlResult.pagesVisited}/{crawlResult.pagesDiscovered}</b></span>
                  <span className="badge-m3">Productos <b>{crawlResult.productsExtracted}</b></span>
                  <span className={`badge-m3 ${crawlResult.qualityStatus === 'complete' ? 'success' : 'warning'}`}>Calidad <b>{crawlResult.qualityStatus}</b></span>
                  {crawlResult.pagesFailed > 0 && <span className="badge-m3 warning">Fallidas <b>{crawlResult.pagesFailed}</b></span>}
                </div>
              )}
              <div className="import-summary-strip" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                <span className="badge-m3">Filas <b>{batch.itemCount}</b></span>
                <span className="badge-m3">Estado <b>{batch.status}</b></span>
                <span className="badge-m3 accent">Crear <b>{batch.items.filter((row) => row.action === 'CREATE').length}</b></span>
                <span className="badge-m3 warning">Revisión <b>{batch.items.filter((row) => row.action === 'REVIEW').length}</b></span>
              </div>
              <div className="cfg-hint" style={{ marginBottom: 10 }}>
                <b>BD</b> = costo vigente del proveedor · <b>Nuevo</b> = costo detectado · <b>Match</b> = producto candidato · <b>Motivo</b> = explicación de la decisión.
                <div className="muted body-small" style={{ marginTop: 6 }}>
                  {savingProgress ? 'Guardando progreso…' : dirtyCount ? `${dirtyCount} decisión(es) pendiente(s) de guardar. Se guardan automáticamente cada 15 segundos.` : 'Progreso guardado.'}
                </div>
              </div>
              <DataTable rowKey={(row) => row.id} columns={columns} rows={batch.items} density="compact" pageSize={12}
                actions={(row) => (
                  <Button variant="icon" icon="trash" title="Excluir de esta carga" aria-label="Excluir de esta carga"
                    disabled={busy || savingProgress} onClick={() => excludeRow(row)} />
                )}
                empty="Sin decisiones" />
            </>
          )}
          {error && <div className="alert danger" style={{ marginTop: 12 }}>{error}</div>}
        </div>
        <div className="modal-foot">
          <Button variant="ghost" onClick={onClose}>Cerrar</Button>
          {!batch && !crawlRunId && mode === 'csv' && <Button icon="upload" variant="accent" disabled={busy || !parsedRows.length} onClick={createPreview}>{busy ? 'Analizando…' : 'Generar pre-autorización'}</Button>}
          {!batch && !crawlRunId && mode === 'web' && <Button icon="search" variant="accent" disabled={busy || pendingLoading || !websiteId} onClick={createCrawl}>{pendingLoading ? 'Cargando propuestas…' : busy ? 'Ejecutando crawling…' : 'Ejecutar crawling'}</Button>}
          {batch?.status === 'preview' && <>
            <Button variant="tonal" disabled={busy || savingProgress || !dirtyCount} onClick={() => saveProgress({ notify: true })}>
              {savingProgress ? 'Guardando…' : dirtyCount ? `Guardar progreso (${dirtyCount})` : 'Progreso guardado'}
            </Button>
            <Button variant="danger" disabled={busy || savingProgress} onClick={() => deleteProposal()}>Eliminar propuesta</Button>
            <Button variant="danger" disabled={busy || savingProgress} onClick={() => review('reject')}>Rechazar propuestas</Button>
            <Button variant="accent" disabled={busy || savingProgress || batch.items.some((row) => row.action === 'REVIEW')} onClick={() => review('approve')}>Aprobar propuestas</Button>
          </>}
          {batch?.status === 'approved' && <Button icon="check" variant="accent" disabled={busy} onClick={apply}>Aplicar carga</Button>}
        </div>
      </div>
    </div>
  );
}
