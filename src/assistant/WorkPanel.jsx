// Stackline — Asistente: panel de trabajo.
//
// Decide qué mostrar a partir de las tarjetas recibidas (vistaPanel): vacío,
// resultados del catálogo, datos del cliente o cotización en construcción.
import React from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../components/Button.jsx';
import { vistaPanel } from './agentReducer.js';
import TinoCharacter from './TinoCharacter.jsx';
import ProductResults from './ProductResults.jsx';
import CustomerCard from './CustomerCard.jsx';
import QuotePreview from './QuotePreview.jsx';

export default function WorkPanel({ conversacion, onColapsar }) {
  const { t } = useTranslation();
  const { state, enviarAccion, pedirConfirmacion, cancelarConfirmacion } = conversacion;
  const { panel, pending } = state;
  const vista = vistaPanel(panel);

  const encabezado = {
    vacio: [t('assistant.panelEmptyTitle', 'Panel de trabajo'), t('assistant.panelEmptyHint', 'Sin contexto')],
    productos: [
      t('assistant.panelProductsTitle', 'Resultados del catálogo'),
      t('assistant.matches', { count: panel.products?.length ?? 0 }),
    ],
    cliente: [t('assistant.panelCustomerTitle', 'Datos del cliente'), t('assistant.panelCustomerHint', 'Por confirmar')],
    cotizacion: [t('assistant.panelQuoteTitle', 'Cotización en construcción'), panel.quote?.number],
  }[vista];

  const enviar = () => {
    if (!state.confirmSend) return pedirConfirmacion();
    enviarAccion('send_quote', { number: panel.quote.number });
  };

  return (
    <aside className="assistant-panel" aria-label={t('assistant.panelLabel', 'Panel de trabajo')}>
      <header className="assistant-panel-head">
        <div className="title-small assistant-grow">{encabezado[0]}</div>
        <span className="assistant-code">{encabezado[1]}</span>
        {onColapsar && (
          <Button variant="icon" size="sm" icon="right_panel_close" title={t('assistant.hidePanel', 'Ocultar panel')} onClick={onColapsar} />
        )}
      </header>

      <div className="assistant-panel-body">
        {vista === 'vacio' && (
          <div className="assistant-empty body-medium">
            <div className="assistant-empty-inner">
              {/* Saluda mientras no hay nada; busca con la lupa mientras espera al agente. */}
              <TinoCharacter pose={pending ? 'thinking' : 'hello'} size={112} />
              <p>{t('assistant.panelEmpty', 'Los resultados del catálogo y la cotización en construcción aparecerán aquí, editables, mientras conversa.')}</p>
            </div>
          </div>
        )}

        {vista === 'productos' && (
          <ProductResults
            productos={panel.products}
            deshabilitado={pending}
            // El id es lo que identifica al producto en el ERP; el SKU va de respaldo.
            onAgregar={(p) => enviarAccion('add_line', p.id != null ? { product_id: p.id, sku: p.sku } : { sku: p.sku })}
          />
        )}

        {vista === 'cliente' && <CustomerCard cliente={panel.customer} />}

        {vista === 'cotizacion' && (
          <>
            {panel.customer && <CustomerCard cliente={panel.customer} />}
            <QuotePreview
              cotizacion={panel.quote}
              enviada={panel.sent}
              pdfUrl={panel.pdfUrl}
              pendiente={pending}
              confirmando={state.confirmSend}
              onEditar={(l) => enviarAccion('edit_line', { line_id: l.id })}
              onEnviar={enviar}
              onCancelarEnvio={cancelarConfirmacion}
            />
          </>
        )}
      </div>
    </aside>
  );
}
