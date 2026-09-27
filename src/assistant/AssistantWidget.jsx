// Stackline — Asistente comercial de IA (diseño B · chat + panel).
//
// Widget flotante abajo a la derecha, sobre cualquier pantalla del ERP. No
// decide nada de negocio: pinta los eventos del agente y le manda acciones.
// Abierto/cerrado y la conversación sobreviven a la navegación entre módulos.
//
// No es modal: no atrapa el foco del resto del ERP. Esc lo colapsa.
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import TinoMark from './TinoMark.jsx';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import ChatColumn from './ChatColumn.jsx';
import WorkPanel from './WorkPanel.jsx';
import { vistaPanel } from './agentReducer.js';
import { useAgentConversation } from './useAgentConversation.js';

const CLAVE_ABIERTO = 'maya_assistant_open';
const CLAVE_PANEL = 'maya_assistant_panel';

function leerBandera(clave) {
  try { return sessionStorage.getItem(clave) === '1'; } catch { return false; }
}

function guardarBandera(clave, valor) {
  try { sessionStorage.setItem(clave, valor ? '1' : '0'); } catch { /* sin almacenamiento */ }
}

export default function AssistantWidget({ cliente }) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const conversacion = useAgentConversation(cliente ? { cliente } : undefined);
  const [abierto, setAbierto] = useState(() => leerBandera(CLAVE_ABIERTO));
  const [panelVisible, setPanelVisible] = useState(() => leerBandera(CLAVE_PANEL));
  const lanzador = useRef(null);
  const widget = useRef(null);
  const recienAbierto = useRef(false);

  useEffect(() => guardarBandera(CLAVE_ABIERTO, abierto), [abierto]);
  useEffect(() => guardarBandera(CLAVE_PANEL, panelVisible), [panelVisible]);

  // El panel se abre solo cuando llega la primera tarjeta que lo alimenta, o
  // cuando cambia de contenido (de productos a cotización). Después el
  // usuario lo puede ocultar.
  const vista = vistaPanel(conversacion.state.panel);
  const vistaAnterior = useRef(vista);
  useEffect(() => {
    if (vista !== vistaAnterior.current && vista !== 'vacio') setPanelVisible(true);
    if (vista === 'vacio') setPanelVisible(false);
    vistaAnterior.current = vista;
  }, [vista]);

  // Al abrir, el foco va al campo de texto; al colapsar, vuelve al lanzador.
  useEffect(() => {
    if (!recienAbierto.current) return;
    recienAbierto.current = false;
    if (abierto) widget.current?.querySelector('textarea')?.focus();
    else lanzador.current?.focus();
  }, [abierto]);

  const abrir = () => { recienAbierto.current = true; setAbierto(true); };
  const colapsar = () => { recienAbierto.current = true; setAbierto(false); };

  const nueva = async () => {
    if (conversacion.hayBorrador) {
      const ok = await confirm({
        title: t('assistant.discardTitle', '¿Empezar una nueva conversación?'),
        message: t('assistant.discardMessage', 'Hay una cotización en prospecto sin enviar. Si continúa, se descarta de esta conversación.'),
        confirmLabel: t('assistant.discardConfirm', 'Descartar y empezar'),
      });
      if (!ok) return;
    }
    conversacion.nueva();
  };

  // El lanzador siempre está: abre con Tino y, abierto, se vuelve una X.
  const lanzadorBoton = (
    <button
      ref={lanzador}
      type="button"
      className={`assistant-launcher${abierto ? ' open' : ''}`}
      onClick={abierto ? colapsar : abrir}
      aria-expanded={abierto}
      aria-label={abierto ? t('assistant.close', 'Cerrar asistente') : t('assistant.open', 'Abrir asistente comercial')}
    >
      {abierto ? (
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
          <path d="M7 7l10 10M17 7L7 17" fill="none" stroke="var(--agent-paper)" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ) : (
        <TinoMark state="idle" size={36} tone="on-accent" />
      )}
    </button>
  );

  if (!abierto) return lanzadorBoton;

  return (
    <>
      <div
        ref={widget}
      className="assistant"
      role="complementary"
      aria-label={t('assistant.title', 'Asistente comercial')}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); colapsar(); } }}
    >
      <ChatColumn
        conversacion={conversacion}
        onNueva={nueva}
        panelVisible={panelVisible}
        onMostrarPanel={vista !== 'vacio' ? () => setPanelVisible(true) : null}
      />
      {panelVisible && <WorkPanel conversacion={conversacion} onColapsar={() => setPanelVisible(false)} />}
    </div>
    {lanzadorBoton}
    </>
  );
}
