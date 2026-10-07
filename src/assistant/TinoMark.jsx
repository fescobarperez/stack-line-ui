// Stackline — Tino, el símbolo del agente de cotizaciones.
//
// Una burbuja con la esquina superior izquierda recta (la cola) y un ojo. Solo
// cambia el ojo entre estados: la silueta siempre se reconoce. Un solo gesto a
// la vez, y ninguno con prefers-reduced-motion (lo apaga el CSS).
//
//   <TinoMark state="thinking" size={24} />
//   <TinoMark state="idle" size={36} container />   ← dentro del círculo de acento
//
// Geometría y animaciones: design_handoff_agente_tino (referencia.html).
import React from 'react';

export const TINO_STATES = ['idle', 'listening', 'thinking', 'responding', 'happy', 'confused'];

const CUERPO = 'M12 4a8 8 0 1 1-8 8V4z';

/** En tamaños chicos el ojo crece para que se lea. */
function radioOjo(size) {
  if (size <= 16) return 2.6;
  if (size <= 24) return 2.4;
  return 2;
}

function Ojo({ state, size, animado }) {
  const a = (clase) => (animado ? clase : undefined);
  switch (state) {
    case 'listening':
      return (
        <>
          <circle className={a('tino-fb tino-listen')} cx="13" cy="11" r="2.4" fill="none" stroke="var(--agent-accent)" strokeWidth=".6" />
          <circle cx="13" cy="11" r="2.4" fill="var(--agent-accent)" />
        </>
      );
    case 'thinking':
      return (
        <>
          <circle className={a('tino-look')} cx="14.6" cy="9.4" r="1.7" fill="var(--agent-accent)" />
          <circle className={a('tino-fade')} cx="11" cy="13.6" r=".75" fill="var(--agent-accent)" />
          <circle className={a('tino-fade tino-d2')} cx="9.4" cy="15.2" r=".5" fill="var(--agent-accent)" />
        </>
      );
    case 'responding':
      return <rect className={a('tino-fb tino-talk')} x="10.4" y="10" width="5.2" height="2" rx="1" fill="var(--agent-accent)" />;
    case 'happy':
      return (
        <path
          className={a('tino-hop')}
          d="M10.9 11.9q2.1-2.8 4.2 0"
          fill="none"
          stroke="var(--agent-accent)"
          strokeWidth={size <= 24 ? 1.8 : 1.6}
          strokeLinecap="round"
        />
      );
    case 'confused':
      return (
        <>
          <path className={a('tino-fb tino-tilt')} d="M11.4 8.3l3.2-.9" fill="none" stroke="var(--agent-accent)" strokeWidth="1.1" strokeLinecap="round" />
          <circle className={a('tino-peek')} cx="12.6" cy="11.4" r="1.5" fill="var(--agent-accent)" />
        </>
      );
    default:
      return <circle className={a('tino-fb tino-blink')} cx="13" cy="11" r={radioOjo(size)} fill="var(--agent-accent)" />;
  }
}

/**
 * @param {object}  props
 * @param {string}  props.state      uno de TINO_STATES
 * @param {number}  props.size       lado del símbolo en px
 * @param {boolean} props.animated   anima el gesto del estado
 * @param {boolean} props.container  lo pinta dentro del círculo de acento (el
 *   símbolo ocupa ~60 % del diámetro, que es `size`)
 * @param {'ink'|'paper'|'on-accent'} props.tone  color del cuerpo: tinta, papel
 *   sobre fondo oscuro, u on-accent sobre el acento (dentro del contenedor lo
 *   toma solo)
 */
export default function TinoMark({ state = 'idle', size = 24, animated = true, container = false, tone = 'ink', className = '' }) {
  const estado = TINO_STATES.includes(state) ? state : 'idle';
  const lado = container ? Math.round(size * 0.6) : size;
  const tono = container ? 'on-accent' : tone;
  const cuerpo = { paper: 'var(--agent-paper)', 'on-accent': 'var(--agent-on-accent)' }[tono] ?? 'var(--agent-ink)';
  // El grupo respira en reposo (lento) y al estar contento (rápido).
  const respira = animated && (estado === 'idle' ? 'tino-fb tino-breathe' : estado === 'happy' ? 'tino-fb tino-breathe-fast' : undefined);

  const svg = (
    <svg
      viewBox="0 0 24 24"
      width={lado}
      height={lado}
      className="tino-svg"
      data-state={estado}
      aria-hidden="true"
      focusable="false"
    >
      <g className={respira || undefined}>
        <path d={CUERPO} fill={cuerpo} />
        <Ojo state={estado} size={lado} animado={animated} />
      </g>
    </svg>
  );

  if (!container) return <span className={`tino-mark ${className}`.trim()}>{svg}</span>;
  return (
    <span className={`tino-mark tino-container ${className}`.trim()} style={{ width: size, height: size }}>
      {svg}
    </span>
  );
}
