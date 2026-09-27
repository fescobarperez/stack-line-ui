// Stackline — Asistente comercial de IA (diseño B · chat + panel).
//
// Widget flotante abajo a la derecha, sobre cualquier pantalla del ERP. No
// decide nada de negocio: pinta los eventos del agente y le manda acciones.
// Abierto/cerrado y la conversación sobreviven a la navegación entre módulos.
//
// No es modal: no atrapa el foco del resto del ERP. Esc lo colapsa.
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from '../components/Icon.jsx';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import ChatColumn from './ChatColumn.jsx';
import { useAgentConversation } from './useAgentConversation.js';

const CLAVE_ABIERTO = 'maya_assistant_open';

function leerAbierto() {
  try { return sessionStorage.getItem(CLAVE_ABIERTO) === '1'; } catch { return false; }
}

export default function AssistantWidget({ cliente }) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const conversacion = useAgentConversation(cliente ? { cliente } : undefined);
  const [abierto, setAbierto] = useState(leerAbierto);
  const lanzador = useRef(null);
  const widget = useRef(null);
  const recienAbierto = useRef(false);

  useEffect(() => {
    try { sessionStorage.setItem(CLAVE_ABIERTO, abierto ? '1' : '0'); } catch { /* sin almacenamiento */ }
  }, [abierto]);

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

  if (!abierto) {
    return (
      <button
        ref={lanzador}
        type="button"
        className="fab assistant-fab"
        onClick={abrir}
        aria-label={t('assistant.open', 'Abrir asistente comercial')}
      >
        <Icon name="smart_toy" size={24} />
        <span>{t('assistant.fab', 'Asistente')}</span>
      </button>
    );
  }

  return (
    <div
      ref={widget}
      className="assistant"
      role="complementary"
      aria-label={t('assistant.title', 'Asistente comercial')}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); colapsar(); } }}
    >
      <ChatColumn conversacion={conversacion} onNueva={nueva} onColapsar={colapsar} />
    </div>
  );
}
