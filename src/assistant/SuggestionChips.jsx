// Stackline — Asistente: sugerencias como chips de sugerencia M3.
import React from 'react';

export default function SuggestionChips({ opciones, deshabilitado, onElegir }) {
  if (!opciones?.length) return null;
  return (
    <div className="assistant-chips">
      {opciones.map((o) => (
        <button
          key={o.id}
          type="button"
          className="chip assistant-chip"
          disabled={deshabilitado}
          onClick={() => onElegir(o)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
