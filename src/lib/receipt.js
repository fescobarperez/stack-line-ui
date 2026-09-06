// Recibo de caja.
//
// Es el papel que el cliente recibe por cada abono cuando la factura ya se
// emitió y quedó en cuentas por cobrar. Es interno y NO fiscal: el hecho
// generador ya lo cubrió la factura, así que aquí no se desglosa IVA ni se
// certifica nada ante SAT.
//
// Se imprime en una ventana aparte con solo este contenido — mismo patrón que
// las boletas de Payroll — para no mandar la aplicación entera a la impresora.
import { markReceiptPrinted } from '../api/receivables.js';
import { sessionCompany } from '../api/auth.js';

const money = (n) =>
  `Q ${Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Cantidad en letras: en un recibo es lo que evita que le agreguen un cero. */
function enLetras(n) {
  const U = ['CERO', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ',
    'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
  const D = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const C = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS',
    'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

  const chicos = (x) => {
    if (x < 20) return U[x];
    if (x < 30) return x === 20 ? 'VEINTE' : `VEINTI${U[x % 10].toLowerCase().toUpperCase()}`;
    if (x < 100) return D[Math.floor(x / 10)] + (x % 10 ? ` Y ${U[x % 10]}` : '');
    if (x === 100) return 'CIEN';
    return C[Math.floor(x / 100)] + (x % 100 ? ` ${chicos(x % 100)}` : '');
  };
  const miles = (x) => {
    if (x < 1000) return chicos(x);
    const m = Math.floor(x / 1000), r = x % 1000;
    const pre = m === 1 ? 'MIL' : `${chicos(m)} MIL`;
    return pre + (r ? ` ${chicos(r)}` : '');
  };
  const millones = (x) => {
    if (x < 1000000) return miles(x);
    const m = Math.floor(x / 1000000), r = x % 1000000;
    return `${m === 1 ? 'UN MILLÓN' : `${miles(m)} MILLONES`}${r ? ` ${miles(r)}` : ''}`;
  };

  const entero = Math.floor(Math.abs(n));
  const cent = Math.round((Math.abs(n) - entero) * 100);
  return `${millones(entero)} QUETZALES CON ${String(cent).padStart(2, '0')}/100`;
}

const esc = (v) => String(v ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

/**
 * Abre la ventana de impresión y marca el recibo como impreso.
 *
 * El marcado no bloquea la impresión: si la llamada falla el papel ya salió,
 * y negarle el recibo al cliente por un error de red sería peor que perder el
 * dato de cuándo se imprimió.
 */
export function printReceipt(payment, company) {
  const co = company || sessionCompany() || {};
  const w = window.open('', '_blank', 'width=720,height=640');
  if (!w) { alert('Permite las ventanas emergentes para imprimir.'); return; }

  const html = `
    <div class="doc">
      <div class="head">
        <div>
          <h1>${esc(co.name || 'Recibo de caja')}</h1>
          ${co.nit ? `<div class="sub">NIT ${esc(co.nit)}</div>` : ''}
          ${co.address ? `<div class="sub">${esc(co.address)}</div>` : ''}
        </div>
        <div class="right">
          <div class="tag">RECIBO DE CAJA</div>
          <div class="num">${esc(payment.receiptNumber || '—')}</div>
          <div class="sub">${esc(payment.paymentDate || '')}</div>
        </div>
      </div>

      <table class="kv">
        <tr><th>Recibí de</th><td>${esc(payment.clientName || '—')}</td></tr>
        <tr><th>La cantidad de</th><td class="letras">${esc(enLetras(payment.amount))}</td></tr>
        <tr><th>Por concepto de</th><td>${esc(payment.notes || 'Abono a cuenta')}</td></tr>
        <tr><th>Forma de pago</th><td>${esc(payment.method || '—')}${
          payment.reference ? ` · Ref. ${esc(payment.reference)}` : ''}</td></tr>
        ${payment.saleId ? `<tr><th>Aplicado a</th><td>Documento ${esc(payment.saleId)}</td></tr>` : ''}
      </table>

      <div class="total"><span>TOTAL</span><strong>${money(payment.amount)}</strong></div>

      <!-- No fiscal a propósito: la factura ya devengó el IVA. Decirlo en el
           papel evita que alguien lo presente como comprobante de crédito. -->
      <div class="foot">
        <div class="firma">Firma y sello</div>
        <div class="nota">Documento interno sin valor fiscal. El comprobante tributario es la factura correspondiente.</div>
      </div>
    </div>`;

  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Recibo ${esc(payment.receiptNumber || '')}</title>
    <style>
      *{box-sizing:border-box;} body{font-family:system-ui,-apple-system,Arial,sans-serif;color:#111;margin:0;padding:28px;font-size:12px;}
      .doc{max-width:640px;margin:0 auto;border:1px solid #ccc;padding:24px;}
      .head{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;border-bottom:2px solid #111;padding-bottom:14px;margin-bottom:18px;}
      h1{font-size:16px;margin:0 0 2px;} .sub{color:#666;font-size:11px;}
      .right{text-align:right;}
      .tag{font-size:10px;letter-spacing:.08em;color:#666;}
      .num{font:700 20px/1.2 ui-monospace,monospace;margin:2px 0 4px;}
      table.kv{width:100%;border-collapse:collapse;margin-bottom:18px;}
      table.kv th{text-align:left;width:130px;color:#666;font-size:10px;letter-spacing:.05em;text-transform:uppercase;font-weight:600;padding:7px 0;vertical-align:top;}
      table.kv td{padding:7px 0;border-bottom:1px solid #eee;}
      td.letras{font-weight:600;}
      .total{display:flex;justify-content:space-between;align-items:center;background:#f4f4f4;padding:12px 14px;font-size:13px;}
      .total strong{font:700 18px ui-monospace,monospace;}
      .foot{margin-top:44px;}
      .firma{border-top:1px solid #111;width:230px;padding-top:6px;font-size:11px;color:#666;}
      .nota{margin-top:16px;font-size:10px;color:#888;}
      @media print{body{padding:0;} .doc{border:none;}}
    </style></head><body>${html}<script>window.onload=function(){window.print();}<\/script></body></html>`);
  w.document.close();

  markReceiptPrinted(payment.id).catch(() => {});
}
