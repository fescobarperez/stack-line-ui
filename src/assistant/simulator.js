// Stackline — Simulador del agente comercial.
//
// Reproduce el guion del prototipo en 4 turnos (productos → cliente →
// cotización → envío) con la MISMA forma de respuesta que POST /v1/agent/turn.
// Se activa con VITE_AGENT_MOCK=true; el resto del código no sabe si habla con
// el simulador o con el agente real.
//
// Los datos de aquí son del guion de demostración, no del ERP: por eso viven
// en el simulador y no en ninguna pantalla.

const productos = [
  { sku: 'MUE-TV-180', name: 'Mueble de TV flotante 180 cm, pino natural', warehouse: 'Bodega Zona 10', stock_label: '6 en stock', price: 'Q 2,450.00' },
  { sku: 'MUE-TV-150', name: 'Mueble de TV flotante 150 cm, pino natural', warehouse: 'Bodega Mixco', stock_label: '2 en stock', price: 'Q 1,980.00' },
];

const cliente = {
  name: 'Distribuidora La Ceiba, S.A.',
  tax_id_label: 'NIT',
  tax_id: '1234567-8',
  contact: 'Ana López',
  email: 'ana.lopez@laceiba.com.gt',
};

const cotizacion = {
  number: 'COT-2026-0418',
  status: 'Prospecto',
  lines: [
    { id: 'l1', name: 'Mueble de TV flotante 180 cm, pino natural', qty: '4', unit: 'Q 2,450.00', total: 'Q 9,800.00' },
    { id: 'l2', name: 'Instalación en sitio', qty: '1', unit: 'Q 600.00', total: 'Q 600.00' },
  ],
  // El impuesto y su etiqueta llegan del backend; el front no los calcula.
  subtotal: 'Q 9,285.71',
  tax_label: 'IVA 12 % incluido',
  tax: 'Q 1,114.29',
  total: 'Q 10,400.00',
  estimated: true,
};

const pasos = [
  [
    { type: 'text', text: 'Encontré 2 coincidencias en el catálogo. Los precios incluyen IVA y son de la lista vigente.' },
    { type: 'card', card: 'product_results', data: { items: productos } },
    { type: 'choices', items: [{ id: 'c1', label: 'Cotice 4 unidades del de 180 cm para Distribuidora La Ceiba, con instalación.' }] },
  ],
  [
    { type: 'text', text: 'El cliente ya existe en el módulo Clientes. Confirme sus datos en el panel antes de generar la cotización.' },
    { type: 'card', card: 'customer', data: cliente },
    { type: 'choices', items: [{ id: 'c2', label: 'Los datos son correctos, genere la cotización.' }] },
  ],
  [
    { type: 'text', text: 'Cotización generada como prospecto. El precio es estimado y pasará a revisión antes de ser definitivo.' },
    { type: 'card', card: 'quote_preview', data: cotizacion },
    { type: 'document', document: { kind: 'quote_pdf', url: '#' } },
    { type: 'choices', items: [{ id: 'c3', label: 'Envíe la cotización al contacto.' }] },
  ],
  [
    { type: 'text', text: 'Listo. La cotización quedó registrada en el módulo Cotizaciones.' },
    { type: 'card', card: 'quote_sent', data: { number: cotizacion.number, channels: 'correo y WhatsApp', sent_at: '27/09/2026', status: 'Enviada' } },
  ],
];

/**
 * @param {object} opts
 * @param {number} opts.demoraMs  latencia simulada (0 en tests)
 */
export function crearSimulador({ demoraMs = 750 } = {}) {
  const respondidos = new Map();
  let paso = 0;

  return {
    reset() {
      paso = 0;
      respondidos.clear();
    },
    turn(body) {
      return new Promise((resolve) => setTimeout(() => {
        // Idempotencia como la del agente: la misma llave devuelve lo mismo
        // sin avanzar el guion.
        if (respondidos.has(body.idempotency_key)) return resolve(respondidos.get(body.idempotency_key));
        const eventos = pasos[Math.min(paso, pasos.length - 1)];
        if (paso < pasos.length) paso += 1;
        const respuesta = {
          conversation_id: 'cnv_demo',
          turn_id: `trn_${String(paso).padStart(8, '0')}`,
          events: eventos,
          state: { summary_version: 0 },
          usage: { input: 0, cached: 0, output: 0 },
        };
        respondidos.set(body.idempotency_key, respuesta);
        resolve(respuesta);
      }, demoraMs));
    },
  };
}
