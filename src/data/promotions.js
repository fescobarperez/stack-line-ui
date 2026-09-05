// Stackline — Promotions data + engine (shared between POS and Promotions module)

const today = new Date();
const fmtDate = (d) => d.toISOString().slice(0, 10);
const addDays  = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

// ── Catálogo de promociones activas ────────────────────────────────────────
export const PROMOS = [
  {
    id: 'PRO-001', name: 'Descuento abarrotes fin de semana',
    type: 'pct_desc', value: 10, status: 'active',
    category: 'abarrotes', product: null,
    clientType: 'Todos', branches: 'Todas',
    dias: [0, 6], horaInicio: '', horaFin: '',
    minCompra: 0, nxm_n: null, nxm_m: null,
    dateStart: fmtDate(addDays(today, -15)), dateEnd: fmtDate(addDays(today, 15)),
    uses: 284, savings: 1820.50,
    desc: '10% de descuento en toda la categoría Abarrotes los fines de semana.',
  },
  {
    id: 'PRO-002', name: '2×1 en bebidas carbonatadas',
    type: 'nxm', value: null, status: 'active',
    category: 'bebidas', product: 'Coca-Cola 600ml',
    clientType: 'Todos', branches: 'Zona 10',
    dias: [0, 1, 2, 3, 4, 5, 6], horaInicio: '14:00', horaFin: '18:00',
    minCompra: 0, nxm_n: 2, nxm_m: 1,
    dateStart: fmtDate(addDays(today, -5)), dateEnd: fmtDate(addDays(today, 10)),
    uses: 96, savings: 960.00,
    desc: 'Lleva 2 Coca-Cola 600ml y paga solo 1.',
  },
  {
    id: 'PRO-003', name: 'Q50 descuento mayorista > Q500',
    type: 'min_compra', value: 50, status: 'active',
    category: null, product: null,
    clientType: 'Mayorista', branches: 'Todas',
    dias: [0, 1, 2, 3, 4, 5, 6], horaInicio: '', horaFin: '',
    minCompra: 500, nxm_n: null, nxm_m: null,
    dateStart: fmtDate(addDays(today, -30)), dateEnd: fmtDate(addDays(today, 30)),
    uses: 42, savings: 2100.00,
    desc: 'Q50 de descuento para clientes mayoristas con ticket mayor a Q500.',
  },
  {
    id: 'PRO-004', name: 'Precio especial Ariel 1kg',
    type: 'precio_esp', value: 32.00, status: 'active',
    category: 'limpieza', product: 'Detergente Ariel 1kg',
    clientType: 'Todos', branches: 'Todas',
    dias: [0, 1, 2, 3, 4, 5, 6], horaInicio: '', horaFin: '',
    minCompra: 0, nxm_n: null, nxm_m: null,
    dateStart: fmtDate(addDays(today, -3)), dateEnd: fmtDate(addDays(today, 7)),
    uses: 118, savings: 767.00,
    desc: 'Precio especial Q32.00 en Detergente Ariel 1kg (regular Q38.50).',
  },
  {
    id: 'PRO-005', name: 'Combo desayuno 15%',
    type: 'combo', value: 15, status: 'scheduled',
    category: null, product: 'Pan Francés 4pz,Leche Foremost 1L,Café Soluble Frasco 200g',
    clientType: 'Todos', branches: 'Zona 10',
    dias: [0, 1, 2, 3, 4, 5, 6], horaInicio: '06:00', horaFin: '10:00',
    minCompra: 0, nxm_n: null, nxm_m: null,
    dateStart: fmtDate(addDays(today, 3)), dateEnd: fmtDate(addDays(today, 33)),
    uses: 0, savings: 0,
    desc: '15% al comprar Pan Francés + Leche Foremost + Café Soluble juntos.',
  },
  {
    id: 'PRO-006', name: '5% clientes minoristas',
    type: 'pct_desc', value: 5, status: 'paused',
    category: null, product: null,
    clientType: 'Minorista', branches: 'Todas',
    dias: [0, 1, 2, 3, 4, 5, 6], horaInicio: '', horaFin: '',
    minCompra: 0, nxm_n: null, nxm_m: null,
    dateStart: fmtDate(addDays(today, -60)), dateEnd: fmtDate(addDays(today, 30)),
    uses: 320, savings: 4800.00,
    desc: '5% descuento general para clientes Minoristas.',
  },
];

// ── Motor de aplicación ────────────────────────────────────────────────────
// cart items: [{ sku, name, price, qty, cat, unit }]
// clientType: 'Consumidor final' | 'Minorista' | 'Mayorista' | 'Exento'
// Retorna: { appliedPromos: [...], totalPromoDiscount: number, cartWithPromos: [...] }

export function applyPromotions(cart, clientType = 'Consumidor final', now = new Date()) {
  if (!cart.length) return { appliedPromos: [], totalPromoDiscount: 0, cartWithPromos: cart };

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const nowDate  = now.toISOString().slice(0, 10);
  const nowDay   = now.getDay(); // 0 = dom

  // Hora actual como número para comparar (ej. "14:30" → 14.5)
  const nowHour = now.getHours() + now.getMinutes() / 60;
  const toHour  = (str) => { if (!str) return null; const [h, m] = str.split(':').map(Number); return h + m / 60; };

  const activePromos = PROMOS.filter(p => {
    if (p.status !== 'active') return false;
    if (nowDate < p.dateStart || nowDate > p.dateEnd) return false;
    if (!p.dias.includes(nowDay)) return false;
    if (p.horaInicio && p.horaFin) {
      const start = toHour(p.horaInicio);
      const end   = toHour(p.horaFin);
      if (nowHour < start || nowHour > end) return false;
    }
    // Tipo de cliente
    if (p.clientType !== 'Todos' && p.clientType !== clientType) return false;
    return true;
  });

  const appliedPromos = [];
  // Mutable copy for price overrides
  let cartWithPromos = cart.map(i => ({ ...i, promoPrice: null, promoTag: null }));

  for (const promo of activePromos) {
    switch (promo.type) {

      case 'precio_esp': {
        // Sobreescribe el precio de un producto específico
        let totalDiscount = 0;
        cartWithPromos = cartWithPromos.map(item => {
          if (item.name === promo.product && item.promoPrice === null) {
            const disc = (item.price - promo.value) * item.qty;
            if (disc > 0) {
              totalDiscount += disc;
              return { ...item, promoPrice: promo.value, promoTag: promo.id };
            }
          }
          return item;
        });
        if (totalDiscount > 0) {
          appliedPromos.push({ promo, discount: totalDiscount,
            label: `Precio especial: ${promo.product}` });
        }
        break;
      }

      case 'nxm': {
        // Por cada N unidades del producto, M son gratis
        const n = promo.nxm_n;
        const m = promo.nxm_m;
        let totalDiscount = 0;
        cartWithPromos = cartWithPromos.map(item => {
          const matchByName = promo.product && item.name === promo.product;
          const matchByCat  = !promo.product && promo.category && item.cat === promo.category;
          if ((matchByName || matchByCat) && item.qty >= n && item.promoTag === null) {
            const sets    = Math.floor(item.qty / n);
            const freeQty = sets * m;
            const disc    = freeQty * (item.promoPrice ?? item.price);
            totalDiscount += disc;
            return { ...item, promoTag: promo.id, freeQty };
          }
          return item;
        });
        if (totalDiscount > 0) {
          appliedPromos.push({ promo, discount: totalDiscount,
            label: `${n}×${n - m}: ${promo.product || promo.category}` });
        }
        break;
      }

      case 'pct_desc': {
        // % de descuento sobre categoría o todo el carrito
        let base = 0;
        if (promo.category) {
          base = cartWithPromos
            .filter(i => i.cat === promo.category)
            .reduce((s, i) => s + (i.promoPrice ?? i.price) * i.qty, 0);
        } else if (promo.clientType === 'Todos' || promo.clientType === clientType) {
          base = cartWithPromos.reduce((s, i) => s + (i.promoPrice ?? i.price) * i.qty, 0);
        }
        const discount = base * (promo.value / 100);
        if (discount > 0) {
          appliedPromos.push({ promo, discount,
            label: `${promo.value}% desc${promo.category ? ` en ${promo.category}` : ''}` });
        }
        break;
      }

      case 'monto_fijo': {
        const discount = promo.value;
        appliedPromos.push({ promo, discount,
          label: `Descuento fijo Q${promo.value}` });
        break;
      }

      case 'min_compra': {
        if (subtotal >= promo.minCompra) {
          appliedPromos.push({ promo, discount: promo.value,
            label: `Desc. mín. compra (>${promo.minCompra})` });
        }
        break;
      }

      case 'combo': {
        const products = (promo.product || '').split(',').map(s => s.trim());
        const allInCart = products.every(p => cartWithPromos.some(i => i.name === p));
        if (allInCart) {
          const comboSubtotal = cartWithPromos
            .filter(i => products.includes(i.name))
            .reduce((s, i) => s + (i.promoPrice ?? i.price) * i.qty, 0);
          const discount = comboSubtotal * (promo.value / 100);
          if (discount > 0) {
            appliedPromos.push({ promo, discount,
              label: `Combo ${promo.value}%: ${products.join(' + ')}` });
          }
        }
        break;
      }

      default: break;
    }
  }

  const totalPromoDiscount = appliedPromos.reduce((s, p) => s + p.discount, 0);
  return { appliedPromos, totalPromoDiscount, cartWithPromos };
}
