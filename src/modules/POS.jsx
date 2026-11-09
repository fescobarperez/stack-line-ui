// Stackline — POSModule (ES module)
// Data-driven: productos/categorías reales; el cobro crea una venta real
// (POST /api/sales) contra la caja abierta y descuenta stock en el backend.
import Icon from '../components/Icon.jsx';
import Autocomplete from '../components/Autocomplete.jsx';
import Button from '../components/Button.jsx';
import { applyPromotions } from '../api/marketing.js';
import { useProducts, useCategories } from '../hooks/useCatalog.js';
import ProductThumb from '../components/ProductThumb.jsx';
import { useCashRegisters } from '../hooks/useOperations.js';
import { sessionUser } from '../api/auth.js';
import useAuthorization from '../hooks/useAuthorization.js';
import AuthorizationDialog from '../components/AuthorizationDialog.jsx';
import { createSale } from '../api/pos.js';
import { listClients } from '../api/partners.js';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import React, { useState as useStatePOS, useMemo as useMemoPOS, useEffect as useEffectPOS, useRef as useRefPOS } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { hoyISO } from '../lib/fechas.js';
import { useLayout, useMediaQuery } from '../hooks/useLayout.js';

const Q = (v) => `Q ${Number(v || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const EMPTY_PROMOS = { promotions: [], lines: [], totalDiscount: 0 };
const PAY_METHOD_MAP = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia' };

function POSModule({ pushToast }) {
  const { t } = useTranslation();
  // Solo vendibles: la materia prima se consume en proyectos y los servicios
  // (mano de obra) no se cobran por caja.
  const { items: products, reload: reloadProducts } = useProducts({ itemType: 'sellable' });
  const rawCats = useCategories();
  const CATEGORIES = useMemoPOS(() => [{ id: 'todos', name: 'Todos', icon: '' }, ...rawCats], [rawCats]);
  const { items: registers } = useCashRegisters();
  // El turno del cajero que está usando el POS. Antes era `find(status==='open')`
  // a secas: cogía cualquier turno abierto, incluido el que quedó de ayer, y las
  // ventas de hoy se acumulaban en el arqueo de ese día.
  const user  = useMemoPOS(() => sessionUser(), []);
  const today = hoyISO();
  const openRegister = useMemoPOS(
    () => registers.find((r) => r.status === 'open' && r.userId === user?.id && r.businessDate === today),
    [registers, user, today],
  );

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
  // id = cliente del catálogo (va en la venta); sin id es consumidor final.
  const [client, setClient]         = useStatePOS(() => clienteCF(t));
  const [showClient, setShowClient] = useStatePOS(false);
  const [showDiscount, setShowDiscount] = useStatePOS(false);
  const searchRef = useRefPOS(null);
  const navigate = useNavigate();
  const confirm = useConfirm();

  // ── Modo táctil ──────────────────────────────────────────────────────────
  // Tablet y teléfono arrancan en modo táctil; en el teléfono no hay otro.
  const layout = useLayout();
  const [modoTactil, setTouchMode]  = useStatePOS(() => layout !== 'desktop');
  const touchMode = modoTactil || layout === 'phone';
  // Con 900 px o más (tablet horizontal) caben productos y carrito juntos;
  // más angosto se ve uno a la vez con las pestañas de abajo.
  const dosPaneles = useMediaQuery('(min-width: 900px)', true);
  const unaVista = touchMode && !dosPaneles;
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
    if (unaVista) setTouchView('cart');
  };
  const changeQty = (sku, delta) =>
    setCart(c => c.map(i => i.sku === sku ? { ...i, qty: Math.max(0, i.qty + delta) } : i).filter(i => i.qty > 0));
  const removeItem = (sku) => setCart(c => c.filter(i => i.sku !== sku));

  // Las promociones las calcula el backend contra el catálogo real. Antes se
  // evaluaban en el navegador sobre tres promociones quemadas, así que las que
  // se configuraban en /promotions no se aplicaban nunca.
  const [promoResult, setPromoResult] = useStatePOS(EMPTY_PROMOS);
  useEffectPOS(() => {
    if (!cart.length) { setPromoResult(EMPTY_PROMOS); return undefined; }
    let cancelled = false;
    applyPromotions({
      clientType: client.type,
      branchId: openRegister?.branchId ?? null,
      items: cart.map((i) => ({
        productId: products.find((p) => p.sku === i.sku)?.id ?? null,
        name: i.name, category: i.cat,
        quantity: i.qty, unitPrice: i.price,
      })).filter((i) => i.productId != null),
    })
      .then((r) => { if (!cancelled) setPromoResult(r); })
      // Si el motor falla no se bloquea la venta: se cobra sin promociones.
      .catch(() => { if (!cancelled) setPromoResult(EMPTY_PROMOS); });
    return () => { cancelled = true; };
  }, [cart, client.type, products, openRegister]);

  const appliedPromos = promoResult.promotions || [];
  const totalPromoDiscount = Number(promoResult.totalDiscount || 0);
  // Descuento por renglón, para pintar el precio efectivo en el carrito.
  const lineDiscount = useMemoPOS(() => {
    const m = new Map();
    (promoResult.lines || []).forEach((l) => m.set(l.productId, l));
    return m;
  }, [promoResult]);
  const cartWithPromos = useMemoPOS(() => cart.map((i) => {
    const pid = products.find((p) => p.sku === i.sku)?.id;
    const l = pid != null ? lineDiscount.get(pid) : null;
    const disc = Number(l?.discount || 0);
    return {
      ...i,
      promoTag: disc > 0 ? l.promotionId : null,
      promoPrice: disc > 0 && i.qty > 0 ? (i.price * i.qty - disc) / i.qty : null,
      freeQty: 0,
    };
  }), [cart, products, lineDiscount]);

  const subtotal    = cart.reduce((s, i) => s + i.price * i.qty, 0);
  // Acotado al subtotal: sin esto un 150% o un monto mayor da un total negativo.
  const descManual  = Math.min(
    discountType === '%' ? subtotal * (discount / 100) : discount,
    subtotal,
  );
  // Lo que evalúa la regla de autorización: Q500 sobre una compra de Q600 es 83%.
  const descManualPct = subtotal > 0 ? (descManual / subtotal) * 100 : 0;
  const descTotal   = descManual + totalPromoDiscount;
  const netGravable = (subtotal - descTotal) / 1.12;
  const iva         = (subtotal - descTotal) - netGravable;
  const total       = subtotal - descTotal;
  const change      = parseFloat(cashGiven || 0) - total;
  const totalItems  = cart.reduce((s, i) => s + i.qty, 0);

  const { require: requireAuth, prompt: authPrompt } = useAuthorization();

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
    // El descuento manual puede requerir autorización. El POS no conoce los
    // umbrales: pregunta al motor y este decide si hace falta y de qué nivel.
    let authId = null;
    if (descManual > 0) {
      try {
        const auth = await requireAuth({
          type: 'pos_discount',
          branchId: openRegister.branchId,
          amount: descManual,
          percent: Number(descManualPct.toFixed(3)),
          payload: { items: cart.length, subtotal, descManual },
          reference: openRegister.id ? `TURNO-${openRegister.id}` : null,
        });
        if (!auth.granted) {
          pushToast && pushToast(auth.pending
            ? t('pos.authPending', 'Descuento enviado a autorización')
            : t('pos.authDenied', 'Descuento no autorizado'), 'danger');
          return;
        }
        authId = auth.id;
      } catch (err) {
        pushToast && pushToast(err.message, 'danger');
        return;
      }
    }
    // Mapea el carrito a líneas con productId real (precio base; las promos son del front).
    const items = cart.map((i) => {
      const product = products.find((p) => p.sku === i.sku);
      // El descuento de promoción viene del motor del backend, ya repartido
      // por renglón y con el id real de la promoción que lo originó.
      const l = product ? lineDiscount.get(product.id) : null;
      const disc = Number(l?.discount || 0);
      return {
        productId: product?.id, quantity: i.qty, unitPrice: i.price,
        discount: disc,
        discountSource: disc > 0 ? 'promo' : 'none',
        promotionId: disc > 0 ? l.promotionId : null,
      };
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
        clientId: client.id ?? null,
        discountTotal: descManual,
        authorizationId: authId,
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
      setShowDiscount(false);
      setClient(clienteCF(t));
      setCashGiven('');
      if (unaVista) setTouchView('products');
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

  // Lector de códigos: escribe el SKU en el buscador y manda Enter. Con Enter
  // se agrega el producto exacto (o el único resultado) y el buscador se limpia.
  const agregarDesdeBusqueda = () => {
    const q = query.trim();
    if (!q) return;
    const exacto = products.find((p) => p.sku?.toLowerCase() === q.toLowerCase());
    const elegido = exacto || (filtered.length === 1 ? filtered[0] : null);
    if (!elegido) {
      pushToast && pushToast(t('pos.noExactMatch', 'Hay varios productos: elige uno de la lista'), 'danger');
      return;
    }
    addToCart(elegido);
    setQuery('');
  };

  const puedeCobrar = cart.length > 0 && !!openRegister;
  const abrirCobro = () => {
    if (!cart.length) return;
    if (!openRegister) { navigate('/cash'); return; }
    setShowCharge(true);
  };
  const vaciar = async () => {
    if (!cart.length) return;
    const ok = await confirm({
      title: t('pos.clearTitle', 'Vaciar la venta'),
      message: t('pos.clearMsg', 'Se quitan todos los productos del carrito.'),
      confirmLabel: t('pos.clear', 'Vaciar'), danger: true,
    });
    if (ok) { setCart([]); setDiscount(0); setShowDiscount(false); }
  };

  // Atajos de escritorio: F2 buscar, F9 cobrar.
  useEffectPOS(() => {
    if (touchMode) return undefined;
    const onKey = (e) => {
      if (e.key === 'F2') { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'F9') { e.preventDefault(); if (!showCharge) abrirCobro(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className={`pos-v2 ${touchMode ? `pos-touch-layout${unaVista ? '' : ' split'}` : 'pos-layout'}`}>

      {/* ── Panel de productos ── */}
      <div
        className="pos-products"
        style={unaVista && touchView !== 'products' ? { display: 'none' } : {}}
      >
        <div className="pos-search-bar">
          <div className="pos-search-field">
            <Icon name="search" size={20} className="icon" />
            <input
              ref={searchRef}
              type="text"
              placeholder={t('pos.searchOrScan', 'Busca un producto o escanea su código')}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregarDesdeBusqueda(); } }}
              aria-label={t('pos.searchOrScan', 'Busca un producto o escanea su código')}
              autoFocus={!touchMode}
            />
            {!touchMode && <kbd className="pos-kbd">F2</kbd>}
          </div>
          {layout !== 'phone' && (
            <button type="button" className={`pos-mode${touchMode ? ' on' : ''}`} onClick={toggleTouchMode}
              title={touchMode ? t('pos.desktopMode', 'Modo escritorio') : t('pos.touchMode', 'Modo táctil')}>
              <Icon name={touchMode ? 'desktop_windows' : 'touch_app'} size={20} />
              <span>{touchMode ? t('pos.desktopModeShort', 'Escritorio') : t('pos.touchModeShort', 'Táctil')}</span>
            </button>
          )}
        </div>

        <div className="pos-cats">
          {CATEGORIES.map(c => (
            <button key={c.id} className={`pos-cat ${cat === c.id ? 'active' : ''}`} onClick={() => setCat(c.id)}>
              {c.name}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="pos-noresults">
            <Icon name="search_off" size={32} />
            <div>{t('pos.noResults', 'Ningún producto coincide')}</div>
          </div>
        ) : (
          <div className={touchMode ? 'pos-touch-grid' : 'pos-grid'}>
            {filtered.slice(0, 120).map(p => {
              const enCarrito = cart.find((i) => i.sku === p.sku)?.qty;
              const bajo = p.tracksStock !== false && p.stock < p.min;
              return (
                <button key={p.sku} className={`pos-prod${enCarrito ? ' in-cart' : ''}`} onClick={() => addToCart(p)}>
                  <div className="pos-prod-top">
                    <ProductThumb product={p} className="pos-prod-ini" />
                    {enCarrito ? <span className="pos-prod-qty">×{enCarrito}</span>
                      : bajo ? <span className="pos-prod-low">{t('pos.lowStock', 'Quedan {{n}}', { n: p.stock })}</span> : null}
                  </div>
                  <div className="nm">{p.name}</div>
                  <div className="pr">{Q(p.price)}</div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Carrito ── */}
      <div
        className={touchMode ? 'pos-touch-cart' : 'pos-cart'}
        style={unaVista && touchView !== 'cart' ? { display: 'none' } : {}}
      >
        <div className="pos-cart-head">
          <div className="pos-cart-title">
            {t('pos.currentSale', 'Venta actual')}
            {totalItems > 0 && <span className="pos-cart-count">{t('pos.itemsCount', '{{n}} artículos', { n: totalItems })}</span>}
          </div>
          {cart.length > 0 && (
            <button type="button" className="pos-link danger" onClick={vaciar}>
              <Icon name="trash" size={16} /> {t('pos.clear', 'Vaciar')}
            </button>
          )}
        </div>

        {openRegister ? (
          <div className="pos-register ok">
            <Icon name="cash" size={16} />
            {t('pos.registerOpen', 'Caja {{name}} · turno #{{id}}', { name: openRegister.branchName || '', id: openRegister.id })}
          </div>
        ) : (
          <div className="pos-register warn" role="status">
            <Icon name="alert" size={16} />
            <span className="txt">{t('pos.noRegister', 'Sin caja abierta: arma la venta y ábrela para cobrar.')}</span>
            <button type="button" className="pos-link" onClick={() => navigate('/cash')}>{t('pos.openRegister', 'Abrir caja')}</button>
          </div>
        )}

        {/* Cliente */}
        <button type="button" className="pos-client" onClick={() => setShowClient(true)}>
          <span className="pos-client-av" aria-hidden="true"><Icon name="user" size={18} /></span>
          <span className="pos-client-txt">
            <span className="nm">{client.name}</span>
            <span className="sub">NIT {client.nit} · {client.type}</span>
          </span>
          <span className="pos-link">{t('pos.changeClient', 'Cambiar')}</span>
        </button>

        {/* Items */}
        {cart.length === 0 ? (
          <div className="pos-cart-empty">
            <Icon name="shopping_cart" size={36} />
            <div>{t('pos.emptyCart', 'Sin productos en el carrito')}</div>
            <div className="hint">{touchMode ? t('pos.emptyCartTouch', 'Toca un producto para agregarlo') : t('pos.emptyCartDesk', 'Haz clic en un producto o escanea su código')}</div>
          </div>
        ) : (
          <div className="pos-cart-items">
            {cartWithPromos.map(i => {
              const hasPromo  = i.promoTag !== null;
              const effPrice  = i.promoPrice ?? i.price;
              const lineTotal = effPrice * i.qty;
              return (
                <div key={i.sku} className={`pos-line${hasPromo ? ' promo' : ''}`}>
                  <div className="pos-line-name" title={i.name}>{i.name}</div>
                  <div className="pos-line-meta">
                    {hasPromo ? (
                      <><s>{Q(i.price)}</s> <span className="promo-price">{Q(i.promoPrice)}</span> <span className="pos-tag">{t('pos.promo', 'Promo')}</span></>
                    ) : <>{Q(i.price)} {t('pos.each', 'c/u')}</>}
                  </div>
                  <div className="pos-stepper" role="group" aria-label={t('pos.qtyOf', 'Cantidad de {{name}}', { name: i.name })}>
                    <button type="button" onClick={() => changeQty(i.sku, -1)} aria-label={i.qty === 1 ? t('pos.remove', 'Quitar') : t('pos.less', 'Uno menos')}>
                      {i.qty === 1 ? <Icon name="trash" size={16} /> : '−'}
                    </button>
                    <span className="n">{i.qty}</span>
                    <button type="button" onClick={() => changeQty(i.sku, +1)} aria-label={t('pos.more', 'Uno más')}>+</button>
                  </div>
                  <div className="pos-line-total">{Q(lineTotal)}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Totales */}
        <div className="pos-totals">
          <div className="row"><span>{t('common.subtotal', 'Subtotal')}</span><span className="v">{Q(subtotal)}</span></div>
          {appliedPromos.map((ap, idx) => (
            <div key={idx} className="row promo"><span>{ap.label}</span><span className="v">−{Q(ap.discount)}</span></div>
          ))}
          {showDiscount || descManual > 0 ? (
            <div className="row pos-discount">
              <span className="pos-discount-ctl">
                {t('pos.discount', 'Descuento')}
                <span className="pos-seg" role="radiogroup" aria-label={t('pos.discountType', 'Tipo de descuento')}>
                  {['%', 'Q'].map((k) => (
                    <button key={k} type="button" role="radio" aria-checked={discountType === k} className={discountType === k ? 'on' : ''} onClick={() => setDiscountType(k)}>{k}</button>
                  ))}
                </span>
                <input type="number" min="0" step="0.01" inputMode="decimal" autoFocus={showDiscount && !descManual}
                  max={discountType === '%' ? 100 : subtotal} value={discount || ''} placeholder="0"
                  aria-label={t('pos.discount', 'Descuento')}
                  onChange={e => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))} />
                <button type="button" className="icon-btn sm" aria-label={t('pos.removeDiscount', 'Quitar descuento')}
                  onClick={() => { setDiscount(0); setShowDiscount(false); }}><Icon name="x" size={16} /></button>
              </span>
              <span className="v neg">−{Q(descManual)}</span>
            </div>
          ) : (
            cart.length > 0 && (
              <button type="button" className="pos-link pos-add-discount" onClick={() => setShowDiscount(true)}>
                <Icon name="plus" size={16} /> {t('pos.addDiscount', 'Agregar descuento')}
              </button>
            )
          )}
          <div className="row total"><span>{t('common.total', 'Total')}</span><span className="v">{Q(total)}</span></div>
          <div className="row tax"><span>{t('pos.ivaIncluded', 'IVA incluido (12%)')}</span><span className="v">{Q(iva)}</span></div>
        </div>

        <button
          className={`pos-charge${touchMode ? ' pos-touch-charge' : ''}${cart.length && !openRegister ? ' needs-register' : ''}`}
          disabled={!cart.length}
          onClick={abrirCobro}
        >
          {cart.length && !openRegister ? (
            <span className="pos-charge-reg"><Icon name="cash" size={20} />{t('pos.openRegisterToCharge', 'Abre una caja para cobrar')}</span>
          ) : (
            <>
              <span>{t('pos.charge', 'Cobrar')}{!touchMode && <kbd className="pos-kbd on-accent">F9</kbd>}</span>
              <span className="amt">{Q(total)}</span>
            </>
          )}
        </button>
      </div>

      {/* ── Tab bar (modo táctil con una vista a la vez) ── */}
      {unaVista && (
        <div className="pos-touch-tab-bar">
          <button className={`pos-touch-tab ${touchView === 'products' ? 'active' : ''}`} onClick={() => setTouchView('products')}>
            <Icon name="box" size={20} />
            <span>{t('pos.products', 'Productos')}</span>
          </button>
          <button className={`pos-touch-tab ${touchView === 'cart' ? 'active' : ''}`} onClick={() => setTouchView('cart')}>
            <Icon name="receipt" size={20} />
            <span>
              {t('pos.cart', 'Carrito')}
              {totalItems > 0 && <span className="pos-touch-cart-badge">{totalItems}</span>}
            </span>
          </button>
        </div>
      )}

      {showClient && (
        <ClientDialog current={client} touchMode={touchMode} onClose={() => setShowClient(false)}
          onSelect={(c) => { setClient(c); setShowClient(false); }} />
      )}

      {/* ── Modal: Cobro ── */}
      {showCharge && (
        <div className="modal-overlay" onClick={() => setShowCharge(false)}>
          <div className={`modal ${touchMode ? 'modal-sm' : 'modal-pay'}`} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{t('pos.paymentTitle', { amount: Q(total) })}</h3>
              <button className="icon-btn" onClick={() => setShowCharge(false)}><Icon name="x" /></button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>
                {t('pos.paymentMethod', 'Método de pago')}
              </div>
              <div className="pay-methods">
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
                        <Button key={i} style={{ flex: 1 }} onClick={() => setCashGiven(v.toFixed(2))}>{Q(v)}</Button>
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
              <Button onClick={() => setShowCharge(false)}>{t('common.cancel', 'Cancelar')}</Button>
              <Button icon="check" variant="accent" size="lg" style={touchMode ? { fontSize: 16, padding: '14px 24px' } : {}} onClick={handleCharge}>{t('pos.confirmCharge', { amount: Q(total) })}
              </Button>
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
              <Button icon="print" variant="tonal">{t('common.print', 'Imprimir')}</Button>
              <Button icon="download">{t('common.download', 'Descargar PDF')}</Button>
              <Button icon="transfer">{t('common.sendEmail', 'Enviar por correo')}</Button>
              <Button icon="x" variant="ghost" onClick={() => setShowReceipt(null)}>{t('common.close', 'Cerrar')}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Diálogo de autorización en sitio. Se monta una vez; el hook decide
          cuándo aparece y qué nivel exige. */}
      <AuthorizationDialog prompt={authPrompt} />
    </div>
  );
}

/** Consumidor final: sin cliente del catálogo. */
function clienteCF(t) {
  return { id: null, name: t('pos.clientTypes.cf', 'Consumidor final'), nit: 'CF', type: t('pos.clientTypes.cf', 'Consumidor final') };
}

// ── Elegir cliente ───────────────────────────────────────────────────────────
// Busca en el catálogo de clientes (por nombre o NIT) o vuelve a consumidor
// final. El tipo de cliente decide qué promociones aplican.
function ClientDialog({ current, touchMode, onClose, onSelect }) {
  const { t } = useTranslation();
  const [q, setQ] = useStatePOS('');
  const [rows, setRows] = useStatePOS([]);
  const [loading, setLoading] = useStatePOS(false);
  const [tipo, setTipo] = useStatePOS(current.type);
  const tipos = [
    t('pos.clientTypes.cf', 'Consumidor final'), t('pos.clientTypes.retail', 'Minorista'),
    t('pos.clientTypes.wholesale', 'Mayorista'), t('pos.clientTypes.exempt', 'Exento'),
  ];

  useEffectPOS(() => {
    const texto = q.trim();
    if (texto.length < 2) { setRows([]); return undefined; }
    let vivo = true;
    setLoading(true);
    const h = setTimeout(() => {
      listClients({ search: texto, size: 8 })
        .then((r) => { if (vivo) setRows(Array.isArray(r) ? r : (r?.content ?? [])); })
        .catch(() => { if (vivo) setRows([]); })
        .finally(() => { if (vivo) setLoading(false); });
    }, 250);
    return () => { vivo = false; clearTimeout(h); };
  }, [q]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal ${touchMode ? 'modal-sm' : ''} pos-client-modal`} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t('pos.clientTitle', 'Cliente de la venta')}>
        <div className="modal-head">
          <h3>{t('pos.clientTitle', 'Cliente de la venta')}</h3>
          <button className="icon-btn" onClick={onClose} aria-label={t('common.close', 'Cerrar')}><Icon name="x" /></button>
        </div>
        <div className="modal-body">
          <button type="button" className={`pos-client-opt${current.id == null ? ' on' : ''}`} onClick={() => onSelect({ ...clienteCF(t), type: tipo })}>
            <Icon name="user" size={18} />
            <span><strong>{t('pos.clientTypes.cf', 'Consumidor final')}</strong><span className="sub">NIT CF</span></span>
          </button>
          <div className="pos-search-field pos-client-search">
            <Icon name="search" size={18} className="icon" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('pos.clientSearch', 'Buscar cliente por nombre o NIT')}
              aria-label={t('pos.clientSearch', 'Buscar cliente por nombre o NIT')} />
          </div>
          <div className="pos-client-list">
            {loading && <div className="muted pos-client-hint">{t('common.loading', 'Cargando…')}</div>}
            {!loading && q.trim().length >= 2 && rows.length === 0 && (
              <div className="muted pos-client-hint">{t('pos.clientNone', 'Sin clientes con ese nombre o NIT')}</div>
            )}
            {rows.map((c) => (
              <button key={c.id} type="button" className={`pos-client-opt${current.id === c.id ? ' on' : ''}`}
                onClick={() => onSelect({ id: c.id, name: c.name, nit: c.nit || 'CF', type: tipo })}>
                <Icon name="user" size={18} />
                <span><strong>{c.name}</strong><span className="sub">NIT {c.nit || 'CF'}</span></span>
              </button>
            ))}
          </div>
          <div className="field pos-client-type">
            <label>{t('pos.clientType', 'Tipo de cliente (para promociones)')}</label>
            <div className="pos-seg wide">
              {tipos.map((x) => (
                <button key={x} type="button" className={tipo === x ? 'on' : ''} onClick={() => setTipo(x)}>{x}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <Button onClick={onClose}>{t('common.cancel', 'Cancelar')}</Button>
          <Button variant="accent" onClick={() => onSelect({ ...current, type: tipo })}>{t('pos.keepClient', 'Usar este tipo')}</Button>
        </div>
      </div>
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
          <Button size="sm" key={i} style={{ flex: 1 }} onClick={() => onChange(v.toFixed(2))}>
            Q{Number.isInteger(v) ? v : v.toFixed(2)}
          </Button>
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
