// Comparación de precios por proveedor.
//
// Dos vistas de la misma relación producto ⇄ proveedor: la del producto que se
// abrió —quién lo da más barato— y el ranking global —quién da mejor precio en
// general—. Van juntas porque la pregunta que sigue a "¿le compro al más
// barato?" casi siempre es "¿y en el resto del catálogo?".
import React, { useEffect, useState } from 'react';
import Button from './Button.jsx';
import Icon from './Icon.jsx';
import { getSupplierComparison, getSupplierRanking } from '../api/catalog.js';

const Q = (n) => n == null ? '—'
  : `Q ${Number(n).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const PCT = (n) => n == null ? '—' : `${Number(n) > 0 ? '+' : ''}${Number(n).toFixed(2)}%`;
const FECHA = (iso) => iso ? new Date(iso).toLocaleDateString('es-GT') : '—';

export default function SupplierPriceModal({ product, onClose, pushToast }) {
  const [vista, setVista] = useState('producto');
  const [comparacion, setComparacion] = useState(null);
  const [ranking, setRanking] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    Promise.all([getSupplierComparison(product.id), getSupplierRanking(product.id, 5)])
      .then(([comp, rank]) => { if (vigente) { setComparacion(comp); setRanking(rank); } })
      .catch((error) => { if (vigente) pushToast?.(`No se pudo cargar la comparación: ${error.message}`, 'danger'); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [product.id, pushToast]);

  const filas = comparacion?.suppliers ?? [];
  const sinProveedores = !cargando && filas.length === 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal price-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h3>Precios por proveedor</h3>
            <div className="body-small muted">
              <span className="mono">{product.sku}</span> · {product.name}
            </div>
          </div>
          <Button variant="ghost" iconOnly icon="x" onClick={onClose} />
        </div>

        <div className="tabs price-modal-tabs">
          <button type="button" className={`tab ${vista === 'producto' ? 'active' : ''}`} onClick={() => setVista('producto')}>
            Este producto{filas.length > 0 && <span className="count">{filas.length}</span>}
          </button>
          <button type="button" className={`tab ${vista === 'ranking' ? 'active' : ''}`} onClick={() => setVista('ranking')}>
            Top 5 proveedores{(ranking ?? []).length > 0 && <span className="count">{ranking.length}</span>}
          </button>
        </div>

        <div className="modal-body">
          {cargando && <div className="muted body-small">Cargando comparación…</div>}

          {!cargando && vista === 'producto' && (sinProveedores ? (
            <div className="catalog-empty-inline">Este producto no tiene proveedores asociados todavía.</div>
          ) : (
            <>
              <div className="price-summary">
                <div><span>Mejor precio</span><strong className="mono">{Q(comparacion.bestCost)}</strong></div>
                <div><span>Más caro</span><strong className="mono">{Q(comparacion.worstCost)}</strong></div>
                <div><span>Diferencia</span><strong className="mono">{PCT(comparacion.spreadPct)}</strong></div>
              </div>

              {/* La pregunta que de verdad importa, respondida sin buscarla. */}
              {filas.length > 1 && (
                <div className={`price-verdict ${comparacion.preferredIsCheapest ? 'is-ok' : 'is-warn'}`}>
                  <Icon name={comparacion.preferredIsCheapest ? 'check' : 'alert'} size={15} />
                  {comparacion.preferredIsCheapest
                    ? 'El proveedor preferido es el más barato.'
                    : `El preferido no es el más barato: hay una opción ${PCT(comparacion.spreadPct)} por debajo.`}
                </div>
              )}

              <div className="tbl-wrap">
                <table className="mtable price-table">
                  <thead><tr>
                    <th>Proveedor</th>
                    <th className="r">Costo</th>
                    <th className="r">vs. mejor</th>
                    <th className="r">Precio anterior</th>
                    <th className="r">Cambio</th>
                    <th>Vigente desde</th>
                  </tr></thead>
                  <tbody>
                    {filas.map((fila, indice) => (
                      <tr key={fila.supplierId} className={indice === 0 ? 'is-best' : ''}>
                        <td>
                          {fila.supplierName}
                          {fila.preferred && <span className="badge-m3 accent" style={{ marginLeft: 6 }}>Preferido</span>}
                        </td>
                        <td className="r num">{Q(fila.unitCost)}</td>
                        <td className="r num">{indice === 0 ? <span className="badge-m3 success">Más barato</span> : PCT(fila.diffVsBestPct)}</td>
                        <td className="r num muted">{Q(fila.previousCost)}</td>
                        <td className="r num" style={{ color: fila.changePct == null ? 'inherit' : Number(fila.changePct) > 0 ? 'var(--danger)' : 'var(--success)' }}>
                          {PCT(fila.changePct)}
                        </td>
                        <td className="muted">{FECHA(fila.validFrom)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ))}

          {!cargando && vista === 'ranking' && (
            (ranking ?? []).length === 0 ? (
              <div className="catalog-empty-inline">Este producto no tiene proveedores asociados todavía.</div>
            ) : (
              <>
                <div className="tbl-wrap">
                  <table className="mtable price-table">
                    <thead><tr>
                      <th>#</th>
                      <th>Proveedor</th>
                      <th className="r">Desviación media</th>
                      <th className="r">Gana</th>
                      <th className="r">Compite</th>
                      <th className="r">Productos</th>
                    </tr></thead>
                    <tbody>
                      {ranking.map((fila, indice) => (
                        <tr key={fila.supplierId}>
                          <td className="mono muted">{indice + 1}</td>
                          <td>{fila.supplierName}</td>
                          <td className="r num">{fila.avgDeviationPct == null
                            ? <span className="muted">sin competencia</span>
                            : `${Number(fila.avgDeviationPct).toFixed(2)}%`}</td>
                          <td className="r num">{fila.productsWon}</td>
                          <td className="r num muted">{fila.productsCompeting}</td>
                          <td className="r num muted">{fila.productsQuoted}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="cfg-hint">
                  Solo los proveedores de este producto, pero medidos sobre <b>todo el catálogo</b>: así se ve
                  si el que aquí sale barato lo es también en el resto.{' '}
                  <b>Desviación media</b> es cuánto por encima del mejor precio queda en promedio, contando solo
                  productos donde hay otro proveedor con quien compararlo. Cero significa que siempre es el más
                  barato de los que compiten. <b>Gana</b> cuenta esos productos; <b>Productos</b> incluye también
                  los que surte en exclusiva, donde ser el más barato no dice nada.
                </div>
              </>
            )
          )}
        </div>

        <div className="modal-foot">
          <Button type="button" onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    </div>
  );
}
