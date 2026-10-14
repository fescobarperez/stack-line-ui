// Stackline — DataTable genérico (Material Design 3)
// Renderiza el markup `.tbl` para heredar todo el CSS M3 (densidad, sticky,
// state layers, selección, totales, paginación). Es opt-in: las tablas
// existentes escritas a mano siguen funcionando igual.
//
// Uso mínimo:
//   <DataTable
//     rowKey={(r) => r.sku}
//     columns={[
//       { key: 'sku',   header: 'SKU',      sortable: true, mono: true },
//       { key: 'name',  header: 'Producto', sortable: true },
//       { key: 'stock', header: 'Stock',    sortable: true, align: 'right' },
//       { key: 'status', header: 'Estado', align: 'center',
//         render: (r) => <span className="badge-m3 success">Activo</span> },
//     ]}
//     rows={productos}
//     selectable pageSize={20} density="compact"
//     totals={{ stock: 1234 }}
//     actions={(r) => <button className="icon-btn"><Icon name="edit" size={18}/></button>}
//   />
//
// En el teléfono (≤ 599 px) cada fila se muestra como tarjeta. Cada columna
// puede decir qué papel tiene en la tarjeta con `card`:
//   'title'    → encabezado en negrita (por defecto, la primera columna)
//   'subtitle' → línea debajo del título
//   'badge'    → a la derecha del título (estado)
//   'amount'   → monto destacado al pie
//   'meta'     → par «etiqueta: valor» (por defecto, el resto)
//   'hide'     → no sale en la tarjeta
// `cardLabel` cambia la etiqueta del par. `cards={false}` deja la tabla;
// `cards="tablet"` usa tarjetas también en tablet (dos por fila).
// `hideOnTablet: true` oculta la columna en tablet (≤ 1024 px), donde no
// caben todas: para lo secundario, nunca para montos ni estados.
// `hideOnLaptop: true` la oculta además en laptops (< 1440 px).
import React, { useMemo, useState } from 'react';
import Icon from './Icon.jsx';
import { useLayout } from '../hooks/useLayout.js';

/** Papel de cada columna en la tarjeta: lo declarado o el de por defecto. */
export function cardRoles(columns) {
  const declarado = columns.some((c) => c.card === 'title');
  return columns.map((c, i) => c.card || (!declarado && i === 0 ? 'title' : 'meta'));
}

const vacio = (v) => v == null || v === '' || v === false;

const alignClass = (a) => (a === 'right' ? 'num' : a === 'center' ? 'center' : '');

export default function DataTable({
  columns = [],
  rows = [],
  rowKey,
  density = 'comfortable',     // 'comfortable' | 'compact'
  sortable = true,            // habilita orden (por columna con col.sortable)
  defaultSort = null,        // { key, dir: 'asc' | 'desc' }
  selectable = false,
  selected,                  // controlado: array de keys (si se omite, es interno)
  onSelectedChange,
  pageSize = 0,              // 0 = sin paginación; si >0 es el valor inicial
  pageSizeOptions = [12, 25, 50, 100],
  skeletonRows = 6,
  loading = false,
  empty = 'Sin datos',
  emptyIcon = 'box',
  totals = null,             // { [colKey]: node }
  stickyFirst = false,
  zebra = false,
  actions = null,            // (row) => node  → columna de acciones custom al hover
  onView,                    // (row) => void  → botón ver (ojito) por fila
  onEdit,                    // (row) => void  → botón editar por fila
  onDelete,                  // (row) => void  → botón eliminar por fila
  onRefresh,                 // () => void     → botón refrescar en la toolbar
  title,                     // encabezado de la toolbar
  toolbar,                   // nodos extra en la toolbar (derecha)
  onRowClick,
  className = '',
  cards = true,              // true: tarjetas en el teléfono · 'tablet': también en tablet · false: nunca
}) {
  const layout = useLayout();
  const comoTarjetas = cards === 'tablet' ? layout !== 'desktop' : Boolean(cards) && layout === 'phone';
  const [sort, setSort] = useState(defaultSort);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(pageSize || 0);
  const [selInternal, setSelInternal] = useState(() => new Set());

  const keyOf = rowKey || ((_, i) => i);

  const selSet = useMemo(() => {
    if (selected == null) return selInternal;
    return selected instanceof Set ? selected : new Set(selected);
  }, [selected, selInternal]);

  const setSel = (next) => {
    if (onSelectedChange) onSelectedChange(Array.from(next));
    else setSelInternal(next);
  };

  // Orden
  const sorted = useMemo(() => {
    if (!sort || !sort.key) return rows;
    const col = columns.find((c) => c.key === sort.key);
    const get = (col && col.sortValue) || ((r) => r[sort.key]);
    const dir = sort.dir === 'desc' ? -1 : 1;
    return [...rows].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb), 'es', { numeric: true }) * dir;
    });
  }, [rows, sort, columns]);

  // Paginación
  const paginated = rowsPerPage > 0;
  const totalPages = paginated ? Math.max(1, Math.ceil(sorted.length / rowsPerPage)) : 1;
  const curPage = Math.min(page, totalPages - 1);
  const pageRows = paginated
    ? sorted.slice(curPage * rowsPerPage, curPage * rowsPerPage + rowsPerPage)
    : sorted;

  const changeRowsPerPage = (n) => {
    // Mantiene visible la primera fila actual al cambiar el tamaño de página.
    const firstRow = curPage * rowsPerPage;
    setRowsPerPage(n);
    setPage(Math.floor(firstRow / n));
  };

  const toggleSort = (col) => {
    if (!sortable || !col.sortable) return;
    setSort((prev) => {
      if (!prev || prev.key !== col.key) return { key: col.key, dir: 'asc' };
      if (prev.dir === 'asc') return { key: col.key, dir: 'desc' };
      return null; // 3er click: limpia el orden
    });
    setPage(0);
  };

  // Selección
  const pageKeys = pageRows.map((r, i) => keyOf(r, i));
  const allSelected = pageKeys.length > 0 && pageKeys.every((k) => selSet.has(k));
  const someSelected = pageKeys.some((k) => selSet.has(k));

  const toggleAll = () => {
    const next = new Set(selSet);
    if (allSelected) pageKeys.forEach((k) => next.delete(k));
    else pageKeys.forEach((k) => next.add(k));
    setSel(next);
  };
  const toggleOne = (k) => {
    const next = new Set(selSet);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setSel(next);
  };

  // Columna de acciones: custom (`actions`) o auto a partir de onView/onEdit/onDelete.
  const rowActions = actions || ((onView || onEdit || onDelete)
    ? (row) => (
        <>
          {onView && (
            <button className="icon-btn" title="Ver" aria-label="Ver"
              onClick={() => onView(row)}><Icon name="eye" size={18} /></button>
          )}
          {onEdit && (
            <button className="icon-btn" title="Editar" aria-label="Editar"
              onClick={() => onEdit(row)}><Icon name="edit" size={18} /></button>
          )}
          {onDelete && (
            <button className="icon-btn" title="Eliminar" aria-label="Eliminar"
              onClick={() => onDelete(row)}><Icon name="trash" size={18} /></button>
          )}
        </>
      )
    : null);

  const showToolbar = title || toolbar;
  // El pie existe si hay algo que poner en él: paginación, el refrescar, o
  // ambos. Con onRefresh y sin paginar, el botón se queda solo a la izquierda.
  const showFooter = onRefresh || (paginated && !loading && sorted.length > 0);

  const cls = ['tbl', density, stickyFirst && 'sticky-1', zebra && 'zebra', className]
    .filter(Boolean)
    .join(' ');

  const celda = (col, row, i) => (col.render ? col.render(row, i) : row[col.key]);
  const roles = cardRoles(columns);
  const ordenables = sortable ? columns.filter((c) => c.sortable) : [];

  const tarjetas = (
    <div className="tbl-cards">
      {ordenables.length > 0 && !loading && pageRows.length > 1 && (
        <label className="tbl-cards-sort">
          <Icon name="arrowDown" size={18} />
          <select
            value={sort ? `${sort.key}:${sort.dir}` : ''}
            onChange={(e) => {
              const [key, dir] = e.target.value.split(':');
              setSort(key ? { key, dir } : null);
              setPage(0);
            }}
            aria-label="Ordenar"
          >
            <option value="">Sin orden</option>
            {ordenables.map((c) => (
              <React.Fragment key={c.key}>
                <option value={`${c.key}:asc`}>{c.cardLabel || c.header} ↑</option>
                <option value={`${c.key}:desc`}>{c.cardLabel || c.header} ↓</option>
              </React.Fragment>
            ))}
          </select>
        </label>
      )}
      {loading
        ? Array.from({ length: Math.min(skeletonRows, 3) }).map((_, i) => (
            <div key={i} className="tbl-card"><div className="tbl-skel" style={{ width: '60%' }} /><div className="tbl-skel" style={{ width: '40%' }} /></div>
          ))
        : pageRows.map((row, i) => {
            const k = keyOf(row, i);
            const sel = selSet.has(k);
            const de = (rol) => columns.filter((_, j) => roles[j] === rol);
            const metas = de('meta').map((c) => [c, celda(c, row, i)]).filter(([, v]) => !vacio(v));
            const montos = de('amount').map((c) => celda(c, row, i)).filter((v) => !vacio(v));
            return (
              <div
                key={k}
                className={['tbl-card', sel && 'selected', onRowClick && 'clickable'].filter(Boolean).join(' ')}
                aria-selected={sel || undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                <div className="tbl-card-head">
                  {selectable && (
                    <input type="checkbox" checked={sel} onChange={() => toggleOne(k)}
                      onClick={(e) => e.stopPropagation()} aria-label="Seleccionar fila" />
                  )}
                  <div className="tbl-card-title">{de('title').map((c) => <span key={c.key}>{celda(c, row, i)}</span>)}</div>
                  {de('badge').map((c) => <span key={c.key} className="tbl-card-badge">{celda(c, row, i)}</span>)}
                </div>
                {de('subtitle').map((c) => {
                  const v = celda(c, row, i);
                  return vacio(v) ? null : <div key={c.key} className="tbl-card-sub">{v}</div>;
                })}
                {metas.length > 0 && (
                  <dl className="tbl-card-meta">
                    {metas.map(([c, v]) => (
                      <div key={c.key}><dt>{c.cardLabel || c.header}</dt><dd className={c.mono ? 'code' : undefined}>{v}</dd></div>
                    ))}
                  </dl>
                )}
                {(montos.length > 0 || rowActions) && (
                  <div className="tbl-card-foot">
                    <span className="tbl-card-amount">{montos.map((v, j) => <span key={j}>{v}</span>)}</span>
                    {rowActions && (
                      <span className="tbl-card-actions" onClick={(e) => e.stopPropagation()}>{rowActions(row, i)}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
      {totals && !loading && pageRows.length > 0 && (
        <dl className="tbl-card tbl-card-totals">
          {/* El valor de la columna título (p. ej. «Total») es el encabezado. */}
          {columns.map((c, j) => (totals[c.key] == null ? null : roles[j] === 'title' || roles[j] === 'subtitle'
            ? <div key={c.key} className="tbl-card-totals-head">{totals[c.key]}</div>
            : <div key={c.key}><dt>{c.cardLabel || c.header}</dt><dd>{totals[c.key]}</dd></div>))}
        </dl>
      )}
    </div>
  );

  return (
    <div className={['datatable', comoTarjetas && 'as-cards'].filter(Boolean).join(' ')}>
      {showToolbar && (
        <div className="tbl-toolbar">
          {title && <span className="tbl-title">{title}</span>}
          <span className="tbl-toolbar-actions">{toolbar}</span>
        </div>
      )}
      {comoTarjetas ? tarjetas : (
      <div className="tbl-scroll">
        <table className={cls}>
          <thead>
            <tr>
              {selectable && (
                <th className="check">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = !allSelected && someSelected; }}
                    onChange={toggleAll}
                    aria-label="Seleccionar todo"
                  />
                </th>
              )}
              {columns.map((col) => {
                const isSorted = sort && sort.key === col.key;
                const canSort = sortable && col.sortable;
                return (
                  <th
                    key={col.key}
                    className={[alignClass(col.align), canSort && 'sortable', isSorted && 'sorted', col.hideOnTablet && 'hide-tablet', col.hideOnLaptop && 'hide-laptop', col.headClassName]
                      .filter(Boolean)
                      .join(' ')}
                    style={col.width ? { width: col.width } : undefined}
                    onClick={canSort ? () => toggleSort(col) : undefined}
                  >
                    {col.header}
                    {canSort && (
                      <Icon
                        className="sort-ic"
                        name={isSorted && sort.dir === 'desc' ? 'arrowDown' : 'arrowUp'}
                        size={18}
                      />
                    )}
                  </th>
                );
              })}
              {rowActions && <th className="actions" aria-label="Acciones"/>}
            </tr>
          </thead>

          {loading ? (
            <tbody>
              {Array.from({ length: skeletonRows }).map((_, i) => (
                <tr key={i}>
                  {selectable && <td className="check"><div className="tbl-skel" style={{ width: 18 }}/></td>}
                  {columns.map((col) => (
                    <td key={col.key} className={[col.hideOnTablet && 'hide-tablet', col.hideOnLaptop && 'hide-laptop'].filter(Boolean).join(' ') || undefined}><div className="tbl-skel" style={{ width: `${45 + ((col.key.length * 11) % 40)}%` }}/></td>
                  ))}
                  {rowActions && <td className="actions"/>}
                </tr>
              ))}
            </tbody>
          ) : (
            <tbody>
              {pageRows.map((row, i) => {
                const k = keyOf(row, i);
                const sel = selSet.has(k);
                return (
                  <tr
                    key={k}
                    className={sel ? 'selected' : ''}
                    aria-selected={sel || undefined}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    style={onRowClick ? { cursor: 'pointer' } : undefined}
                  >
                    {selectable && (
                      <td className="check" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={sel} onChange={() => toggleOne(k)} aria-label="Seleccionar fila" />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={[alignClass(col.align), col.mono && 'code', col.hideOnTablet && 'hide-tablet', col.hideOnLaptop && 'hide-laptop', col.className].filter(Boolean).join(' ')}
                      >
                        {col.render ? col.render(row, i) : row[col.key]}
                      </td>
                    ))}
                    {rowActions && (
                      <td className="actions" onClick={(e) => e.stopPropagation()}>
                        <span className="row-actions">{rowActions(row, i)}</span>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          )}

          {totals && !loading && pageRows.length > 0 && (
            <tfoot>
              <tr>
                {selectable && <td className="check"/>}
                {columns.map((col) => (
                  <td key={col.key} className={[alignClass(col.align), col.hideOnTablet && 'hide-tablet', col.hideOnLaptop && 'hide-laptop'].filter(Boolean).join(' ')}>
                    {totals[col.key] != null ? totals[col.key] : ''}
                  </td>
                ))}
                {rowActions && <td className="actions"/>}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      )}

      {!loading && pageRows.length === 0 && (
        <div className="tbl-empty">
          <Icon name={emptyIcon} size={40} />
          <div>{empty}</div>
        </div>
      )}

      {showFooter && (
        <div className="tbl-footer">
          <div className="tbl-footer-left">
            {onRefresh && (
              <button className="icon-btn" title="Refrescar" aria-label="Refrescar"
                onClick={onRefresh}><Icon name="refresh" size={20} /></button>
            )}
          </div>
          {paginated && !loading && sorted.length > 0 && (
          <div className="tbl-pagination">
          <label className="rows">
            Filas por página:{' '}
            <select
              className="tbl-page-size"
              value={rowsPerPage}
              onChange={(e) => changeRowsPerPage(Number(e.target.value))}
              aria-label="Filas por página"
            >
              {pageSizeOptions.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <span className="tbl-range">
            {curPage * rowsPerPage + 1}–{Math.min((curPage + 1) * rowsPerPage, sorted.length)} de {sorted.length}
          </span>
          <button
            className="icon-btn"
            disabled={curPage === 0}
            onClick={() => setPage(0)}
            aria-label="Primera página"
          >
            <Icon name="first_page" size={20} />
          </button>
          <button
            className="icon-btn"
            disabled={curPage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            aria-label="Página anterior"
          >
            <Icon name="chevronLeft" size={20} />
          </button>
          <span className="tbl-page">{curPage + 1} / {totalPages}</span>
          <button
            className="icon-btn"
            disabled={curPage >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            aria-label="Página siguiente"
          >
            <Icon name="chevronRight" size={20} />
          </button>
          <button
            className="icon-btn"
            disabled={curPage >= totalPages - 1}
            onClick={() => setPage(totalPages - 1)}
            aria-label="Última página"
          >
            <Icon name="last_page" size={20} />
          </button>
          </div>
          )}
        </div>
      )}
    </div>
  );
}

export { DataTable };
