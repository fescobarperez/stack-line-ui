import { sessionCompany } from '../api/auth.js';

const DEFAULT_LOGO_URL = 'https://stackline-client-logos-460005624841.s3.us-east-1.amazonaws.com/logos/madera-viva-mv.png';

const PALETTE = {
  ink: '#25242a',
  muted: '#726a72',
  border: '#e8dfe3',
  paper: '#ffffff',
  page: '#fbf8f9',
  corinto: '#8b1e3f',
  corintoSoft: '#f8e9ee',
  terracotta: '#d47a5a',
  terracottaSoft: '#fdf0eb',
  success: '#2f7d65',
};

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[char]));

// Tinte suave (fondo claro) derivado de un color hex #rrggbb, para que los
// colores de marca personalizados tengan un fondo que combine.
const softTint = (hex, alpha = 0.1) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
};

const money = (value) => `Q ${Number(value || 0).toLocaleString('es-GT', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

const date = (value) => {
  if (!value) return '—';
  const parsed = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? String(value)
    : parsed.toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' });
};

const lineAmount = (item) => {
  const quantity = Number(item.qty || 0);
  const unitPrice = Number(item.unitPrice || 0);
  const discount = Number(item.discount || 0);
  return quantity * unitPrice * (1 - discount / 100);
};

function quoteRows(quote, charges) {
  const productRows = (quote.items || []).map((item) => ({
    description: item.name || 'Línea de cotización',
    detail: item.uom ? `${item.uom}${item.discount > 0 ? ` · Descuento ${item.discount}%` : ''}` : (item.discount > 0 ? `Descuento ${item.discount}%` : ''),
    qty: Number(item.qty || 0),
    unitPrice: Number(item.unitPrice || 0) * (1 - Number(item.discount || 0) / 100),
    total: lineAmount(item),
  }));

  const chargeRows = (charges?.charges || []).map((charge) => ({
    description: charge.description || 'Cargo adicional',
    detail: charge.category || 'Cargo de la propuesta',
    qty: 1,
    unitPrice: Number(charge.computedAmount || 0),
    total: Number(charge.computedAmount || 0),
    isCharge: true,
  }));

  return [...productRows, ...chargeRows];
}

function buildTotals(quote, charges, taxRate) {
  const productSubtotal = (quote.items || []).reduce((sum, item) => sum + lineAmount(item), 0);
  const chargesSubtotal = Number(charges?.fixedTotal || 0) + Number(charges?.percentTotal || 0);
  const profit = Number(quote.profitAmount || 0);
  const subtotal = productSubtotal + chargesSubtotal + profit;
  const iva = subtotal * (Number(taxRate || 12) / 100);
  return { productSubtotal, chargesSubtotal, profit, subtotal, iva, total: subtotal + iva };
}

function renderRows(rows) {
  if (!rows.length) {
    return '<tr><td colspan="4" class="empty">No hay líneas en esta cotización.</td></tr>';
  }
  return rows.map((row) => `
    <tr class="${row.isCharge ? 'charge-row' : ''}">
      <td>
        <strong>${esc(row.description)}</strong>
        ${row.detail ? `<small>${esc(row.detail)}</small>` : ''}
      </td>
      <td class="center">${row.qty}</td>
      <td class="money">${money(row.unitPrice)}</td>
      <td class="money strong">${money(row.total)}</td>
    </tr>`).join('');
}

function documentHtml(quote, { company, charges, branding, taxRate = quote.taxRate || 12 } = {}) {
  const co = company || sessionCompany() || {};
  const brand = branding || {};
  const rows = quoteRows(quote, charges);
  const totals = buildTotals(quote, charges, taxRate);
  const client = quote.client || {};
  const notes = quote.notes?.trim() || 'Propuesta preparada según el alcance acordado con el cliente.';
  const companyName = co.name || 'NOMBRE DE EMPRESA';
  const companyCode = co.code ? `Código de empresa: ${co.code}` : 'Soluciones que construyen confianza';
  const logoUrl = brand.logoUrl || co.logoUrl || DEFAULT_LOGO_URL;
  // Colores de marca por empresa (company_settings) con fallback al PALETTE base.
  const palette = {
    ...PALETTE,
    corinto: brand.primaryColor || PALETTE.corinto,
    terracotta: brand.secondaryColor || PALETTE.terracotta,
    corintoSoft: brand.primaryColor ? (softTint(brand.primaryColor) || PALETTE.corintoSoft) : PALETTE.corintoSoft,
    terracottaSoft: brand.secondaryColor ? (softTint(brand.secondaryColor) || PALETTE.terracottaSoft) : PALETTE.terracottaSoft,
  };

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${esc(quote.id || 'Cotización')} · ${esc(companyName)}</title>
  <style>
    :root{color-scheme:light;--ink:${palette.ink};--muted:${palette.muted};--border:${palette.border};--paper:${palette.paper};--page:${palette.page};--corinto:${palette.corinto};--corinto-soft:${palette.corintoSoft};--terracotta:${palette.terracotta};--terracotta-soft:${palette.terracottaSoft};--success:${palette.success}}
    *{box-sizing:border-box}
    @page{size:A4;margin:13mm 14mm}
    html,body{margin:0;padding:0;background:var(--page);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;font-size:11px;line-height:1.4}
    body{padding:20px}
    .doc{max-width:182mm;min-height:270mm;margin:0 auto;background:var(--paper);padding:14mm 14mm 10mm;box-shadow:0 10px 36px rgba(50,20,30,.10)}
    .topbar{height:7px;background:linear-gradient(90deg,var(--corinto) 0 70%,var(--terracotta) 70% 100%);margin:-14mm -14mm 25px}
    .header{display:flex;justify-content:space-between;align-items:flex-start;gap:28px;padding-bottom:20px;border-bottom:1px solid var(--border)}
    .brand{display:flex;align-items:flex-start;gap:12px;min-width:0}.logo-frame{width:48px;height:48px;border-radius:9px;background:#0a090c;display:flex;align-items:center;justify-content:center;overflow:hidden;flex:none;-webkit-print-color-adjust:exact;print-color-adjust:exact}.logo-img{width:100%;height:100%;object-fit:cover;display:block}.logo-placeholder{width:72px;height:42px;border:1.5px dashed var(--corinto);border-radius:7px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--corinto);font-size:9px;font-weight:800;letter-spacing:.12em;line-height:1.2;flex:none}.logo-placeholder span{font-size:6px;letter-spacing:.08em;color:var(--muted);margin-top:2px}.company-name{font-size:17px;font-weight:800;letter-spacing:-.025em;color:var(--ink);margin:2px 0 2px}.company-sub{font-size:9px;color:var(--muted)}
    .doc-meta{text-align:right;min-width:135px}.doc-type{font-size:23px;line-height:1;font-weight:900;letter-spacing:-.055em;color:var(--corinto)}.doc-number{font:700 11px ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--ink);margin-top:7px}.doc-date{font-size:9px;color:var(--muted);margin-top:3px}.status{display:inline-block;margin-top:9px;padding:5px 8px;border-radius:999px;background:var(--corinto-soft);color:var(--corinto);font-size:8px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
    .client-card{display:grid;grid-template-columns:1.35fr .65fr;gap:20px;background:var(--corinto-soft);border-left:4px solid var(--corinto);border-radius:0 9px 9px 0;padding:14px 16px;margin:22px 0 24px}.eyebrow{font-size:8px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--corinto);margin-bottom:4px}.client-name{font-size:14px;font-weight:800;color:var(--ink)}.client-meta{font-size:9px;color:var(--muted);margin-top:3px}.client-date{text-align:right}.client-date strong{display:block;color:var(--ink);font-size:10px}.client-date span{display:block;color:var(--muted);font-size:9px;margin-top:3px}
    .section-label{display:flex;align-items:center;gap:8px;color:var(--corinto);font-size:9px;font-weight:900;letter-spacing:.13em;text-transform:uppercase;margin-bottom:9px}.section-label:after{content:"";height:1px;flex:1;background:var(--border)}
    table{width:100%;border-collapse:collapse}.items th{padding:9px 7px;background:var(--corinto-soft);color:var(--corinto);font-size:8px;letter-spacing:.08em;text-transform:uppercase;text-align:left}.items th:first-child{border-radius:6px 0 0 6px}.items th:last-child{border-radius:0 6px 6px 0}.items th:nth-child(2),.items td:nth-child(2){width:46px;text-align:center}.items th:nth-child(3),.items th:nth-child(4),.items td:nth-child(3),.items td:nth-child(4){width:94px;text-align:right}.items td{padding:11px 7px;border-bottom:1px solid var(--border);vertical-align:top}.items td strong{display:block;font-size:10px;color:var(--ink)}.items td small{display:block;font-size:8px;color:var(--muted);margin-top:3px}.items .money{white-space:nowrap}.items .strong{font-weight:800}.items .center{text-align:center}.items .charge-row td{background:var(--terracotta-soft)}.items .charge-row td:first-child{border-left:3px solid var(--terracotta)}.empty{text-align:center;color:var(--muted);padding:22px}
    .summary{display:grid;grid-template-columns:1fr 210px;gap:28px;align-items:start;margin-top:22px}.notes{padding:13px 14px;background:var(--terracotta-soft);border-radius:8px;border-top:3px solid var(--terracotta);font-size:9px;color:var(--muted);min-height:82px}.notes strong{display:block;color:var(--ink);font-size:9px;text-transform:uppercase;letter-spacing:.1em;margin-bottom:5px}.totals{padding:2px 0}.total-row{display:flex;justify-content:space-between;gap:16px;padding:5px 0;color:var(--muted);font-size:10px}.total-row strong{color:var(--ink);font-weight:700}.total-final{display:flex;justify-content:space-between;gap:12px;align-items:center;background:var(--corinto);color:white;border-radius:7px;margin-top:7px;padding:12px 13px;font-size:11px;font-weight:800}.total-final strong{font-size:16px;letter-spacing:-.03em}
    .footer{display:flex;justify-content:space-between;gap:20px;border-top:1px solid var(--border);margin-top:34px;padding-top:12px;color:var(--muted);font-size:8px}.footer strong{color:var(--corinto)}.legal{margin-top:18px;color:var(--muted);font-size:8px;line-height:1.45;text-align:center}
    @media print{html,body{background:white}body{padding:0}.doc{max-width:none;min-height:0;box-shadow:none;padding:0}.topbar{margin:0 0 25px}.items tr{break-inside:avoid}.summary,.footer,.legal{break-inside:avoid}}
    @media(max-width:680px){body{padding:8px}.doc{padding:24px 18px}.topbar{margin:-24px -18px 22px}.header,.client-card,.summary{grid-template-columns:1fr;display:grid}.doc-meta,.client-date{text-align:left}.items th:nth-child(3),.items th:nth-child(4),.items td:nth-child(3),.items td:nth-child(4){width:auto}.items{font-size:10px}}
  </style>
</head>
<body>
  <main class="doc">
    <div class="topbar"></div>
    <header class="header">
      <div class="brand">
        <div class="logo-frame"><img class="logo-img" src="${esc(logoUrl)}" alt="${esc(companyName)}" onerror="this.parentNode.outerHTML='&lt;div class=&quot;logo-placeholder&quot;&gt;LOGO&lt;span&gt;PLACEHOLDER&lt;/span&gt;&lt;/div&gt;'" /></div>
        <div><div class="company-name">${esc(companyName)}</div><div class="company-sub">${esc(companyCode)}</div></div>
      </div>
      <div class="doc-meta"><div class="doc-type">COTIZACIÓN</div><div class="doc-number">${esc(quote.id || '—')}</div><div class="doc-date">Emitida el ${esc(date(quote.date))}</div><div class="status">${esc(quote.status || 'Vigente')}</div></div>
    </header>

    <section class="client-card">
      <div><div class="eyebrow">Preparado para</div><div class="client-name">${esc(client.name || 'Cliente sin nombre')}</div><div class="client-meta">${esc(client.contact || '')}${client.email ? ` · ${esc(client.email)}` : ''}${client.nit ? ` · NIT ${esc(client.nit)}` : ''}</div></div>
      <div class="client-date"><div class="eyebrow">Vigencia</div><strong>Hasta ${esc(date(quote.validUntil))}</strong><span>Propuesta comercial</span></div>
    </section>

    <section>
      <div class="section-label">Resumen de propuesta</div>
      <table class="items"><thead><tr><th>Descripción</th><th>Cant.</th><th>Precio unitario</th><th>Total</th></tr></thead><tbody>${renderRows(rows)}</tbody></table>
    </section>

    <section class="summary">
      <div class="notes"><strong>Notas y condiciones</strong>${esc(notes).replace(/\n/g, '<br>')}<br><br><span>Este documento es una propuesta comercial y no constituye una factura fiscal.</span></div>
      <div class="totals"><div class="total-row"><span>Subtotal</span><strong>${money(totals.subtotal)}</strong></div><div class="total-row"><span>IVA (${Number(taxRate)}%)</span><strong>${money(totals.iva)}</strong></div><div class="total-final"><span>Total</span><strong>${money(totals.total)}</strong></div></div>
    </section>

    <footer class="footer"><span><strong>${esc(companyName)}</strong><br>Gracias por confiar en nosotros</span><span style="text-align:right">Documento generado desde Stackline<br>Válido según las condiciones indicadas</span></footer>
    <div class="legal">Los precios y condiciones de esta cotización corresponden al alcance descrito. Cualquier modificación deberá ser aprobada por ambas partes.</div>
  </main>
  <script>window.addEventListener('load',function(){setTimeout(function(){window.focus();window.print();},180);});</script>
</body>
</html>`;
}

export function openQuotePdfWindow() {
  const popup = window.open('', '_blank', 'width=920,height=900');
  if (!popup) return null;
  popup.document.write('<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Generando PDF…</title></head><body style="font-family:system-ui;padding:32px;color:#555">Generando PDF…</body></html>');
  popup.document.close();
  return popup;
}

export function renderQuotePdfWindow(popup, quote, options = {}) {
  if (!popup || popup.closed) return;
  popup.document.open();
  popup.document.write(documentHtml(quote, options));
  popup.document.close();
}
