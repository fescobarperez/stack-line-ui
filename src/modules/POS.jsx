// Stackline — POSModule (ES module)
// Data-driven: productos/categorías reales; el cobro crea una venta real
// (POST /api/sales) contra la caja abierta y descuenta stock en el backend.
import Icon from '../components/Icon.jsx';
import { applyPromotions } from '../data/promotions.js';
import { useProducts, useCategories } from '../hooks/useCatalog.js';
import { useCashRegisters } from '../hooks/useOperations.js';
import { createSale } from '../api/pos.js';
import React, { useState as useStatePOS, useMemo as useMemoPOS } from 'react';
import { useTranslation } from 'react-i18next';

const Q = (v) => `Q ${Number(v || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const PAY_METHOD_MAP = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia' };

function POSModule({ pushToast }) {
  const { t } = useTranslation();
  const { items: products, reload: reloadProducts } = useProducts();
  const rawCats = useCategories();
  const CATEGORIES = useMemoPOS(() => [{ id: 'todos', name: 'Todos', icon: '' }, ...rawCats], [rawCats]);
  const { items: registers } = useCashRegisters();
  const openRegister = useMemoPOS(() => registers.find((r) => r.status === 'open'), [registers]);

  // ── Lógica de venta ──────────────────────────────────────────────────────
  const [cat, setCat]               = useStatePOS('todos');
  const [query, setQuery]           = useStatePOS('');
  const [cart, setCart]             = useStatePOS([]);
  const [discount, setDiscount]     = useStatePOS(0);
  const [discountType, setDiscountType] = useStatePOS('%');
  const [showCharge, setShowCharge] = useStatePOS(false);
  const [showReceipt, setShowReceipt] = useStatePOS(null);
  const [pay, setPay]               = useStatePOS('efectivo');
  const [cashGiven, setCashGiven]   = useStatePOS('');
  const [client, setClient]         = useStatePOS({ name: 'CF', nit: 'CF', type: 'Consumidor final' });

  // ── Modo táctil ──────────────────────────────────────────────────────────
  const [touchMode, setTouchMode]   = useStatePOS(false);
  const [touchView, setTouchView]   = useStatePOS('products'); // 'products' | 'cart'

  const filtered = useMemoPOS(() => {
    let p = products;
    if (cat !== 'todos') p = p.filter(x => x.cat === cat);
    if (query) {
      const q = query.toLowerCase();
      p = p.filter(x => x.name.toLowerCase().includes(q) || x.sku.includes(query));
    }
    return p;
  }, [cat, query, products]);

  const addToCart = (p) => {
    setCart(c => {
      const found = c.find(i => i.sku === p.sku);
      if (found) return c.map(i => i.sku === p.sku ? { ...i, qty: i.qty + 1 } : i);
      return [...c, { sku: p.sku, name: p.name, price: p.price, cat: p.cat, qty: 1, unit: p.unit }];
    });
    if (touchMode) setTouchView('cart');
  };
  const changeQty = (sku, delta) =>
    setCart(c => c.map(i => i.sku === sku ? { ...i, qty: Math.max(0, i.qty + delta) } : i).filter(i => i.qty > 0));
  const removeItem = (sku) => setCart(c => c.filter(i => i.sku !== sku));

  const { appliedPromos, totalPromoDiscount, cartWithPromos } = useMemoPOS(
    () => applyPromotions(cart, client.type),
    [cart, client.type]
  );

  const subtotal    = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const descManual  = discountType === '%' ? subtotal * (discount / 100) : discount;
  const descTotal   = descManual + totalPromoDiscount;
  const netGravable = (subtotal - descTotal) / 1.12;
  const iva         = (subtotal - descTotal) - netGravable;
  const total       = subtotal - descTotal;
  const change      = parseFloat(cashGiven || 0) - total;
  const totalItems  = cart.reduce((s, i) => s + i.qty, 0);

  const handleCharge = async () => {
    if (!cart.length) return;
    if (pay === 'efectivo' && (cashGiven === '' || parseFloat(cashGiven) < total)) {
      pushToast && pushToast(t('pos.insufficientCash', 'Efectivo insuficiente'), 'danger');
      return;
    }
    if (!openRegister) {
      pushToast && pushToast('Abre una caja antes de cobrar', 'danger');
      return;
    }
    // Mapea el carrito a líneas con productId real (precio base; las promos son del front).
    const items = cart.map((i) => {
      const product = products.find((p) => p.sku === i.sku);
      return { productId: product?.id, quantity: i.qty, unitPrice: i.price, discount: 0 };
    });
    if (items.some((it) => !it.productId)) {
      pushToast && pushToast('Algún producto no existe en el catálogo real', 'danger');
      return;
    }
    try {
      const sale = await createSale({
        branchId: openRegister.branchId,
        cashRegisterId: openRegister.id,
        paymentMethod: PAY_METHOD_MAP[pay] || pay,
        items,
      });
      setShowReceipt({
        id: sale.docNumber || `T-${sale.id}`,
        items: cartWithPromos,
        subtotal, descManual, totalPromoDiscount, descTotal, iva, netGravable, total,
        appliedPromos, pay, cashGiven: parseFloat(cashGiven || 0), change, client,
        date: new Date(),
      });
      setShowCharge(false);
      setCart([]);
      setDiscount(0);
      setCashGiven('');
      if (touchMode) setTouchView('products');
      await reloadProducts();
      pushToast && pushToast(t('pos.saleRegistered', { id: sale.docNumber || sale.id }), 'success');
    } catch (err) {
      pushToast && pushToast('No se pudo registrar la venta: ' + err.message, 'danger');
    }
  };

  const toggleTouchMode = () => {
    setTouchMode(m => !m);
    setTouchView('products');
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className={touchMode ? 'pos-touch-layout' : 'pos-layout'}>

      {/* ── Panel de productos ── */}
      <div
        className="pos-products"
        style={touchMode && touchView !== 'products' ? { display: 'none' } : {}}
      >
        <div className="pos-search-bar">
          <div className="pos-search-field">
            <Icon name="search" size={20} className="icon" />
            <input
              type="text"
              placeholder={t('pos.searchPlaceholder', 'Buscar por nombre o código de barras…')}
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus={!touchMode}
            />
          </div>
          <button className="btn"><Icon name="barcode" size={14} />{t('pos.scan', 'Escanear')}</button>
          <button
            className={`btn${touchMode ? ' accent' : ''}`}
            title={touchMode ? t('pos.desktopMode', 'Modo escritorio') : t('pos.touchMode', 'Modo táctil')}
            onClick={toggleTouchMode}
          >
            <Icon name="pos" size={14} />
            {touchMode ? t('pos.desktopMode', 'Escritorio') : t('pos.touchMode', 'Táctil')}
          </button>
        </div>

        <div className="pos-cats">
          {CATEGORIES.map(c => (
            <button
              key={c.id}
              className={`pos-cat ${cat === c.id ? 'active' : ''}`}
              onClick={() => setCat(c.id)}
            >
              {c.icon && <span>{c.icon}</span>}
              {c.name}
              {c.count != null && <span className="n">{c.count}</span>}
            </button>
          ))}
        </div>

        <div className={touchMode ? 'pos-touch-grid' : 'pos-grid'}>
          {filtered.slice(0, 80).map(p => (
            <button key={p.sku} className="pos-prod" onClick={() => addToCart(p)}>
              <div className="img">{p.initials || (p.name || '').slice(0, 2).toUpperCase()}</div>
              <div>
                <div className="nm">{p.name}</div>
                {!touchMode && <div className="sk">{p.sku.slice(-6)}</div>}
              </div>
              <div className="pr">{Q(p.price)}</div>
              {p.stock < p.min && <span className="stock-low">{p.stock}u</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ── Carrito ── */}
      <div
        className={touchMode ? 'pos-touch-cart' : 'pos-cart'}
        style={touchMode && touchView !== 'cart' ? { display: 'none' } : {}}
      >
        <div className="pos-cart-head">
          <div>
            <div className="pos-cart-title">{t('pos.currentSale', 'Venta actual')}</div>
            <div className={`pos-cart-sub${openRegister ? '' : ' alert'}`}>
              {openRegister ? `${openRegister.branchName || 'Caja'} · #${openRegister.id}` : 'Sin caja abierta'}
            </div>
          </div>
          <div className="row gap-6">
            <button className="icon-btn" title={t('common.delete', 'Eliminar')} onClick={() => setCart([])}><Icon name="trash" /></button>
            <button className="icon-btn" title={t('common.client', 'Cliente')}><Icon name="user" /></button>
          </div>
        </div>

        {/* Cliente */}
        <div className="pos-cart-client">
          <Icon name="user" size={14} style={{ color: 'var(--muted)' }} />
          <div className="who">
            <span className="lbl">{t('common.client', 'Cliente')}:</span>{' '}
            <span className="nm">{client.name}</span>
            <span className="nit mono">NIT {client.nit}</span>
          </div>
          <select
            value={client.type}
            onChange={e => setClient(c => ({ ...c, type: e.target.value }))}
          >
            <option>{t('pos.clientTypes.cf', 'Consumidor final')}</option>
            <option>{t('pos.clientTypes.retail', 'Minorista')}</option>
            <option>{t('pos.clientTypes.wholesale', 'Mayorista')}</option>
            <option>{t('pos.clientTypes.exempt', 'Exento')}</option>
          </select>
          <button className="btn sm ghost">{t('pos.changeClient', 'Cambiar')}</button>
        </div>

        {/* Items */}
        {cart.length === 0 ? (
          <div className="pos-cart-empty">
            <div className="big">∅</div>
            <div>{t('pos.emptyCart', 'Sin productos en el carrito')}</div>
            <div className="hint">{t('pos.emptyCartHint', 'Toca un producto o escanea')}</div>
          </div>
        ) : (
          <div className="pos-cart-items">
            {cartWithPromos.map(i => {
              const hasPromo  = i.promoTag !== null;
              const effPrice  = i.promoPrice ?? i.price;
              const lineTotal = effPrice * (i.qty - (i.freeQty || 0));
              return (
                <div
                  key={i.sku}
                  className={`pos-cart-item${touchMode ? ' pos-touch-item' : ''}`}
                  style={hasPromo ? { background: 'var(--success-soft)' } : {}}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="nm">
                      {i.name}
                      {hasPromo && <span className="pos-tag">PROMO</span>}
                    </div>
                    <div className="meta">
                      {i.promoPrice !== null ? (
                        <>
                          <span style={{ textDecoration: 'line-through', color: 'var(--muted)' }}>{Q(i.price)}</span>
                          <span style={{ color: 'var(--success)', fontWeight: 600 }}>{Q(i.promoPrice)}</span>
                        </>
                      ) : (
                        <span>{Q(i.price)}</span>
                      )}
                      <span style={{ color: 'var(--muted)' }}>· {i.unit}</span>
                      {i.freeQty > 0 && <span className="pos-tag">+{i.freeQty} GRATIS</span>}
                    </div>
                  </div>

                  <div className="pr" style={hasPromo ? { color: 'var(--success)' } : {}}>{Q(lineTotal)}</div>

                  {touchMode ? (
                    <div className="pos-touch-qty">
                      <button className="pos-touch-qty-btn" onClick={() => changeQty(i.sku, -1)}>−</button>
                      <span className="n">{i.qty}</span>
                      <button className="pos-touch-qty-btn" onClick={() => changeQty(i.sku, +1)}>+</button>
                    </div>
                  ) : (
                    <div className="qty">
                      <button onClick={() => changeQty(i.sku, -1)}>−</button>
                      <span className="n">{i.qty}</span>
                      <button onClick={() => changeQty(i.sku, +1)}>+</button>
                    </div>
                  )}

                  <button className="remove" onClick={() => removeItem(i.sku)}>
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Totales */}
        <div className="pos-totals">
          <div className="row"><span>{t('common.subtotal', 'Subtotal')} ({totalItems} items)</span><span className="v">{Q(subtotal)}</span></div>
          {appliedPromos.map((ap, idx) => (
            <div key={idx} className="row promo">
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="pos-tag">PROMO</span>
                {ap.label}
              </span>
              <span className="v">−{Q(ap.discount)}</span>
            </div>
          ))}
          <div className="row" style={{ opacity: 0.4, pointerEvents: 'none' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {t('pos.manualDiscount', 'Descuento manual')}
              <select value={discountType} onChange={() => {}}>
                <option value="%">%</option>
                <option value="Q">Q</option>
              </select>
              <input type="number" value={discount} min="0" readOnly />
            </span>
            <span className="v" style={{ color: 'var(--danger)' }}>−{Q(descManual)}</span>
          </div>
          <div className="row muted"><span>{t('pos.ivaIncluded', 'IVA incluido (12%)')}</span><span className="v">{Q(iva)}</span></div>
          <div className="row total"><span>{t('common.total', 'TOTAL')}</span><span className="v">{Q(total)}</span></div>
        </div>

        <button
          className={`pos-charge${touchMode ? ' pos-touch-charge' : ''}`}
          disabled={!cart.length}
          onClick={() => setShowCharge(true)}
        >
          <span>{t('pos.charge', 'Cobrar')}</span>
          <span className="amt">{Q(total)}</span>
        </button>
      </div>

      {/* ── Tab bar (solo touch mode) ── */}
      {touchMode && (
        <div className="pos-touch-tab-bar">
          <button
            className={`pos-touch-tab ${touchView === 'products' ? 'active' : ''}`}
            onClick={() => setTouchView('products')}
          >
            <Icon name="box" size={20} />
            <span>{t('pos.products', 'Productos')}</span>
          </button>
          <button
            className={`pos-touch-tab ${touchView === 'cart' ? 'active' : ''}`}
            onClick={() => setTouchView('cart')}
          >
            <Icon name="receipt" size={20} />
            <span>
              {t('pos.cart', 'Carrito')}
              {totalItems > 0 && (
                <span className="pos-touch-cart-badge">{totalItems}</span>
              )}
            </span>
          </button>
        </div>
      )}

      {/* ── Modal: Cobro ── */}
      {showCharge && (
        <div className="modal-overlay" onClick={() => setShowCharge(false)}>
          <div className="modal" style={{ width: touchMode ? 420 : 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{t('pos.paymentTitle', { amount: Q(total) })}</h3>
              <button className="icon-btn" onClick={() => setShowCharge(false)}><Icon name="x" /></button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>
                {t('pos.paymentMethod', 'Método de pago')}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
                {[
                  { id: 'efectivo',      label: t('pos.paymentMethods.cash', 'Efectivo'),       icon: 'cash' },
                  { id: 'tarjeta',       label: t('pos.paymentMethods.card', 'Tarjeta'),         icon: 'card' },
                  { id: 'transferencia', label: t('pos.paymentMethods.transfer', 'Transferencia'), icon: 'transfer' },
                ].map(m => (
                  <button
                    key={m.id}
                    onClick={() => setPay(m.id)}
                    style={{
                      padding: touchMode ? '16px 8px' : '12px 8px',
                      border: pay === m.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                      background: pay === m.id ? 'var(--accent-soft)' : 'var(--surface)',
                      color: pay === m.id ? 'var(--accent-ink)' : 'var(--text)',
                      borderRadius: 'var(--r-md)',
                      cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                      fontFamily: 'inherit', fontSize: touchMode ? 14 : 13, fontWeight: pay === m.id ? 600 : 500,
                    }}
                  >
                    <Icon name={m.icon} size={touchMode ? 28 : 20} />
                    {m.label}
                  </button>
                ))}
              </div>

              {pay === 'efectivo' && (
                touchMode ? (
                  <TouchNumpad value={cashGiven} onChange={setCashGiven} total={total} Q={Q} />
                ) : (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>
                      {t('pos.amountReceived', 'Monto recibido')}
                    </div>
                    <input
                      type="number"
                      value={cashGiven}
                      onChange={e => setCashGiven(e.target.value)}
                      placeholder={total.toFixed(2)}
                      style={{ width: '100%', fontSize: 26, fontFamily: 'var(--font-mono)', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', textAlign: 'right', background: 'var(--surface-2)', color: 'var(--text)' }}
                      autoFocus
                    />
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      {[total, Math.ceil(total / 50) * 50, Math.ceil(total / 100) * 100, Math.ceil(total / 100) * 100 + 100].map((v, i) => (
                        <button key={i} className="btn" style={{ flex: 1 }} onClick={() => setCashGiven(v.toFixed(2))}>{Q(v)}</button>
                      ))}
                    </div>
                    {cashGiven && parseFloat(cashGiven) >= total && (
                      <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--success-soft)', color: 'var(--success)', borderRadius: 'var(--r-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600 }}>{t('pos.change', 'Cambio')}</span>
                        <span className="mono" style={{ fontSize: 22, fontWeight: 700 }}>{Q(change)}</span>
                      </div>
                    )}
                  </div>
                )
              )}

              {pay === 'tarjeta' && (
                <div style={{ padding: 24, textAlign: 'center', border: '2px dashed var(--border)', borderRadius: 'var(--r-md)' }}>
                  <Icon name="card" size={32} />
                  <div style={{ marginTop: 8, fontSize: 13 }}>{t('pos.waitingCard', 'Esperando lectura del POS bancario…')}</div>
                  <div className="mono muted" style={{ fontSize: 11, marginTop: 4 }}>{t('pos.insertCard', 'Insertar / acercar tarjeta')}</div>
                </div>
              )}

              {pay === 'transferencia' && (
                <div style={{ padding: '16px' }}>
                  <div className="field">
                    <label>{t('pos.authNumber', 'No. autorización / boleta')}</label>
                    <input type="text" placeholder="Ej. 8472395" />
                  </div>
                  <div className="field" style={{ marginTop: 10 }}>
                    <label>{t('pos.bank', 'Banco')}</label>
                    <select>
                      <option>Banco Industrial</option>
                      <option>BAC Credomatic</option>
                      <option>G&amp;T Continental</option>
                      <option>Banrural</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setShowCharge(false)}>{t('common.cancel', 'Cancelar')}</button>
              <button
                className="btn accent lg"
                style={touchMode ? { fontSize: 16, padding: '14px 24px' } : {}}
                onClick={handleCharge}
              >
                <Icon name="check" />{t('pos.confirmCharge', { amount: Q(total) })}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Ticket ── */}
      {showReceipt && (
        <div className="modal-overlay" onClick={() => setShowReceipt(null)}>
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }} onClick={e => e.stopPropagation()}>
            <Ticket data={showReceipt} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 24 }}>
              <button className="btn primary"><Icon name="print" />{t('common.print', 'Imprimir')}</button>
              <button className="btn"><Icon name="download" />{t('common.download', 'Descargar PDF')}</button>
              <button className="btn"><Icon name="transfer" />{t('common.sendEmail', 'Enviar por correo')}</button>
              <button className="btn ghost" onClick={() => setShowReceipt(null)}><Icon name="x" />{t('common.close', 'Cerrar')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Numpad táctil ────────────────────────────────────────────────────────────
function TouchNumpad({ value, onChange, total, Q }) {
  const { t } = useTranslation();
  const handleKey = (key) => {
    if (key === '⌫') { onChange(v => v.slice(0, -1)); return; }
    if (key === '.' && value.includes('.')) return;
    if (value.includes('.') && value.split('.')[1]?.length >= 2) return;
    onChange(v => (v === '0' ? (key === '.' ? '0.' : key) : v + key));
  };

  const numVal  = parseFloat(value) || 0;
  const vchange  = numVal - total;
  const keys    = ['7','8','9','4','5','6','1','2','3','.','0','⌫'];

  const quickAmounts = [
    total,
    Math.ceil(total / 50) * 50,
    Math.ceil(total / 100) * 100,
    Math.ceil(total / 100) * 100 + 100,
  ].filter((v, i, a) => a.indexOf(v) === i && v >= total);

  return (
    <div>
      <div className="pos-touch-numpad-display">
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{t('pos.amountReceived', 'Monto recibido')}</div>
        <div className="pos-touch-numpad-value">Q {value || '0'}</div>
        {numVal >= total && (
          <div className="pos-touch-numpad-change">
            {t('pos.change', 'Cambio')}: <strong>Q {vchange.toFixed(2)}</strong>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {quickAmounts.map((v, i) => (
          <button key={i} className="btn" style={{ flex: 1, fontSize: 13 }} onClick={() => onChange(v.toFixed(2))}>
            Q{Number.isInteger(v) ? v : v.toFixed(2)}
          </button>
        ))}
      </div>

      <div className="pos-touch-numpad">
        {keys.map(k => (
          <button
            key={k}
            className={`pos-touch-numpad-key${k === '⌫' ? ' del' : ''}`}
            onClick={() => handleKey(k)}
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Ticket de venta ──────────────────────────────────────────────────────────
function Ticket({ data }) {
  const { t } = useTranslation();
  return (
    <div className="ticket">
      <div className="center">
        <div className="biz-name">Stackline · TIENDA</div>
        <div className="biz-info">
          Sucursal Zona 10<br />
          5a Av. 10-25, Z.10, Guatemala<br />
          NIT 8745619-2 · Tel +502 2235-4400
        </div>
      </div>
      <div className="sep"></div>
      <div className="row"><span>FACTURA</span><span>{data.id}</span></div>
      <div className="row"><span>{t('common.date', 'Fecha')}</span><span>{data.date.toLocaleDateString('es-GT')} {data.date.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}</span></div>
      <div className="row"><span>Cajero</span><span>Carlos M.</span></div>
      <div className="row"><span>{t('common.client', 'Cliente')}</span><span>{data.client.name}</span></div>
      <div className="row"><span>NIT</span><span>{data.client.nit}</span></div>
      <div className="sep"></div>
      <div className="row" style={{ fontWeight: 700 }}><span>DESCRIPCIÓN</span><span>{t('common.total', 'TOTAL')}</span></div>
      <div className="sep" style={{ borderTopStyle: 'solid', borderWidth: '0.5px' }}></div>
      {data.items.map(i => {
        const effPrice = i.promoPrice ?? i.price;
        const payQty   = i.qty - (i.freeQty || 0);
        return (
          <div key={i.sku} className="item-row">
            <div>{i.name}{i.promoTag ? ' *' : ''}</div>
            <div>{Q(effPrice * payQty)}</div>
            <div className="meta">  {i.qty} {i.unit || 'u'} x {Q(effPrice)}{i.freeQty > 0 ? ` (+${i.freeQty} gratis)` : ''}</div>
          </div>
        );
      })}
      <div className="sep"></div>
      <div className="row"><span>{t('common.subtotal', 'Subtotal')}</span><span>{Q(data.subtotal)}</span></div>
      {(data.appliedPromos || []).map((ap, i) => (
        <div key={i} className="row"><span>* {ap.label}</span><span>−{Q(ap.discount)}</span></div>
      ))}
      {data.descManual > 0 && <div className="row"><span>Desc. manual</span><span>−{Q(data.descManual)}</span></div>}
      <div className="row"><span>Gravable</span><span>{Q(data.netGravable)}</span></div>
      <div className="row"><span>{t('common.iva', 'IVA')} 12%</span><span>{Q(data.iva)}</span></div>
      <div className="sep"></div>
      <div className="row" style={{ fontWeight: 700, fontSize: 13 }}><span>{t('common.total', 'TOTAL')} Q</span><span>{Q(data.total)}</span></div>
      <div className="sep"></div>
      <div className="row"><span>Pago: {data.pay.toUpperCase()}</span><span>{Q(data.pay === 'efectivo' ? data.cashGiven : data.total)}</span></div>
      {data.pay === 'efectivo' && <div className="row"><span>{t('pos.change', 'Cambio')}</span><span>{Q(data.change)}</span></div>}
      <div className="sep"></div>
      <div className="center" style={{ fontSize: 9 }}>
        DTE-FEL · Serie A · No. {data.id.slice(-5)}<br />
        Autorización SAT: 0E5F4C9A-2026<br />
        Resol. SAT 2026-43-XX-0042
      </div>
      <div className="barcode"></div>
      <div className="center" style={{ fontSize: 9, marginTop: 6 }}>
        ¡GRACIAS POR SU COMPRA!<br />
        www.stackline.gt
      </div>
    </div>
  );
}

export default POSModule;
export { Ticket };
