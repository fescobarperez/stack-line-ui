// Stackline — Asistente: columna del chat (encabezado, conversación y pie).
//
// En el diseño B el chat solo lleva texto, sugerencias y confirmaciones: las
// tarjetas de productos, cliente y cotización van al panel de trabajo.
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../components/Button.jsx';
import MessageBubble, { ErrorBubble, TypingBubble } from './MessageBubble.jsx';
import SuggestionChips from './SuggestionChips.jsx';
import TinoMark from './TinoMark.jsx';
import { useTinoState } from './useTinoState.js';

export default function ChatColumn({ conversacion, onNueva, panelVisible, onMostrarPanel }) {
  const { t } = useTranslation();
  const { state, enviarTexto, reintentar } = conversacion;
  const [texto, setTexto] = useState('');
  const lista = useRef(null);
  const campo = useRef(null);
  const tino = useTinoState(state, texto.trim().length > 0);
  // El último mensaje del asistente lleva la expresión del momento.
  const ultimoBot = [...state.messages].reverse().find((m) => m.role === 'bot')?.id;

  // Se pega al final cuando llega algo nuevo o cambia el indicador.
  useEffect(() => {
    const el = lista.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.messages.length, state.pending, state.error]);

  // El campo crece con el texto hasta su alto máximo (lo fija el CSS).
  useEffect(() => {
    const el = campo.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [texto]);

  const enviar = (e) => {
    e?.preventDefault();
    if (state.pending || !texto.trim()) return;
    enviarTexto(texto);
    setTexto('');
  };

  const alTeclear = (e) => {
    // Enter envía; Shift+Enter es salto de línea.
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      enviar();
    }
  };

  return (
    <section className="assistant-chat" aria-label={t('assistant.chatLabel', 'Chat del asistente')}>
      <header className="assistant-head">
        <TinoMark state={tino} size={36} container className="assistant-avatar" />
        <div className="assistant-head-text">
          <div className="title-small">{t('assistant.name', 'Tino')}</div>
          <div className="assistant-sub body-small">
            {t('assistant.subtitle', 'Conectado a Productos · Clientes · Cotizaciones')}
          </div>
        </div>
        <span className="badge-m3">{t('assistant.internal', 'Interno')}</span>
        {!panelVisible && onMostrarPanel && (
          <Button variant="icon" icon="right_panel_open" title={t('assistant.showPanel', 'Mostrar panel de trabajo')} onClick={onMostrarPanel} />
        )}
        <Button variant="icon" icon="add_comment" title={t('assistant.newConversation', 'Nueva conversación')} onClick={onNueva} disabled={state.pending} />
      </header>

      <div className="assistant-messages" ref={lista} role="log" aria-live="polite">
        {state.messages.map((m) => (
          <MessageBubble key={m.id} mensaje={m} estadoAvatar={m.id === ultimoBot && !state.pending ? tino : 'idle'} />
        ))}
        {state.pending && <TypingBubble />}
        {state.error && <ErrorBubble tipo={state.error} onReintentar={reintentar} />}
      </div>

      <footer className="assistant-foot">
        <SuggestionChips
          opciones={state.choices}
          deshabilitado={state.pending}
          onElegir={(o) => enviarTexto(o.label)}
        />
        <form className="assistant-composer" onSubmit={enviar}>
          <textarea
            ref={campo}
            rows={1}
            className="body-medium"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={alTeclear}
            placeholder={t('assistant.placeholder', 'Escriba una consulta o instrucción…')}
            aria-label={t('assistant.messageLabel', 'Mensaje para el asistente')}
            disabled={state.pending}
          />
          <Button type="submit" variant="accent" icon="send" disabled={state.pending || !texto.trim()}>
            {t('assistant.send', 'Enviar')}
          </Button>
        </form>
      </footer>
    </section>
  );
}
