// Stackline — Tino de cuerpo completo.
//
// Para estados vacíos, errores y celebraciones. El launcher y los avatares
// siguen usando solo el símbolo (TinoMark).
//
//   <TinoCharacter pose="hello" size={140} />
//   <TinoCharacter pose="done" size={120} halo />   ← sobre fondo vino
//
// Base: design_handoff_agente_tino ("Personaje"), con ajustes de legibilidad:
// brazos más largos y poses que se distinguen por la silueta, cuerpo un poco
// más alto, insignia del pecho al doble y halo opcional para fondos oscuros.
// La cabeza es el símbolo ×2.5; su esquina recta apunta al chat.
import React, { useId } from 'react';

export const TINO_POSES = ['idle', 'hello', 'thinking', 'quoting', 'done', 'confused'];

// viewBox -6 -4 76 84: deja aire para brazos levantados, salto y destellos.
const ANCHO = 76;
const ALTO = 84;

/**
 * Cada pose: ojo, inclinación de cabeza (grados), brazos [izq, der] en grados
 * (0 = colgando; + gira a la izquierda del dibujo, - a la derecha) y el
 * movimiento del cuerpo.
 */
const POSES = {
  idle: { ojo: 'idle', cabeza: 0, brazos: [8, -8], cuerpo: 'tino-c-bob-slow' },
  hello: { ojo: 'happy', cabeza: -6, brazos: [22, -145], saluda: true },
  thinking: { ojo: 'think', cabeza: 7, brazos: [6, -128], lupa: true, cuerpo: 'tino-c-bob' },
  quoting: { ojo: 'work', cabeza: 0, brazos: [-40, 40], doc: true, cuerpo: 'tino-c-bob-fast' },
  done: { ojo: 'happy', cabeza: -4, brazos: [138, -138], cuerpo: 'tino-c-jump', destellos: true },
  confused: { ojo: 'doubt', cabeza: -9, brazos: [8, -178], manoEnCabeza: true },
};

const C = {
  contorno: 'var(--tino-outline, #63092A)',
  blanco: 'var(--tino-body, #FFFFFF)',
  visor: 'var(--tino-visor, #17151C)',
  brillo: 'var(--tino-visor-shine, #3A3540)',
  ojo: 'var(--tino-eye, #E7BCC3)',
  marca: 'var(--tino-badge, #893149)',
  sombra: 'var(--tino-shadow, rgba(99, 9, 42, .22))',
};
const TRAZO = 1.6;

function Ojo({ tipo, a }) {
  switch (tipo) {
    case 'happy':
      return <path className={a('tino-hop')} d="M28 27q5-6 10 0" fill="none" stroke={C.ojo} strokeWidth="2.6" strokeLinecap="round" />;
    case 'think':
      return (
        <>
          <circle className={a('tino-look')} cx="36" cy="22.5" r="3" fill={C.ojo} />
          <circle className={a('tino-fade')} cx="28" cy="29" r="1.3" fill={C.ojo} />
          <circle className={a('tino-fade tino-d2')} cx="25" cy="31" r="1" fill={C.ojo} />
        </>
      );
    case 'work':
      return <rect className={a('tino-fb tino-blink-fast')} x="28" y="26" width="10" height="3.4" rx="1.7" fill={C.ojo} />;
    case 'doubt':
      return (
        <>
          <path className={a('tino-fb tino-tilt')} d="M27 20l8-2.2" fill="none" stroke={C.ojo} strokeWidth="2" strokeLinecap="round" />
          <circle className={a('tino-peek')} cx="31.5" cy="26.5" r="3" fill={C.ojo} />
        </>
      );
    default:
      return <circle className={a('tino-fb tino-blink')} cx="33" cy="25" r="3.6" fill={C.ojo} />;
  }
}

/** Brazo de 6×16 que gira desde el hombro. `extra` va en la mano (lupa). */
function Brazo({ x, angulo, clase, extra }) {
  return (
    <g style={{ transformBox: 'view-box', transformOrigin: `${x + 3}px 47px`, transform: `rotate(${angulo}deg)` }}>
      <g className={clase} style={{ transformBox: 'view-box', transformOrigin: `${x + 3}px 47px` }}>
        <rect x={x} y="44" width="6" height="16" rx="3" fill={C.blanco} stroke={C.contorno} strokeWidth={TRAZO} />
        {extra}
      </g>
    </g>
  );
}

/** La lupa en la mano: el oficio de buscar precios y stock. */
function Lupa({ x }) {
  const cx = x + 3;
  return (
    <g>
      <rect x={cx - 1} y="58" width="2" height="5" rx="1" fill={C.contorno} />
      <circle cx={cx} cy="67.5" r="4.6" fill={C.blanco} stroke={C.contorno} strokeWidth={TRAZO} />
      <circle cx={cx} cy="67.5" r="2.6" fill={C.ojo} />
      <rect x={cx - 1.9} y="65.3" width="1.6" height="1" rx=".5" fill={C.blanco} />
    </g>
  );
}

function Documento() {
  return (
    <g>
      <rect x="23" y="47" width="18" height="15" rx="2" fill={C.ojo} stroke={C.contorno} strokeWidth={TRAZO} />
      <rect x="26" y="50.5" width="12" height="1.8" rx=".9" fill={C.marca} />
      <rect x="26" y="54.2" width="8" height="1.8" rx=".9" fill={C.marca} />
      <rect x="26" y="57.9" width="10" height="1.8" rx=".9" fill={C.marca} />
    </g>
  );
}

function Destellos({ a }) {
  const estrella = 'M0-3.2L.9-.9 3.2 0 .9.9 0 3.2-.9.9-3.2 0-.9-.9z';
  return (
    <g fill={C.marca}>
      <path className={a('tino-fb tino-c-spark')} d={estrella} transform="translate(8 14) scale(1.1)" />
      <path className={a('tino-fb tino-c-spark tino-d2')} d={estrella} transform="translate(59 10)" />
      <path className={a('tino-fb tino-c-spark tino-d3')} d={estrella} transform="translate(62 30) scale(.8)" />
    </g>
  );
}

/**
 * @param {object} props
 * @param {'idle'|'hello'|'thinking'|'quoting'|'done'|'confused'} props.pose
 * @param {number}  props.size      ancho en px; el alto sale de la proporción
 * @param {boolean} props.animated  false para dibujarlo quieto
 * @param {boolean} props.halo      contorno claro para fondos oscuros
 * @param {string}  props.title     texto accesible; sin él es decorativo
 */
export default function TinoCharacter({ pose = 'idle', size = 120, animated = true, halo = false, title, className = '' }) {
  const p = POSES[pose] ?? POSES.idle;
  const a = (clase) => (animated ? clase : undefined);
  const filtro = `tino-halo-${useId().replace(/:/g, '')}`;
  const [izq, der] = p.brazos;

  const brazoDer = (
    <Brazo
      x={43}
      angulo={der}
      clase={a(p.saluda ? 'tino-c-wave' : undefined)}
      extra={p.lupa ? <Lupa x={43} /> : null}
    />
  );
  const brazoIzq = <Brazo x={15} angulo={izq} />;

  return (
    <svg
      className={`tino-character ${className}`.trim()}
      viewBox={`-6 -4 ${ANCHO} ${ALTO}`}
      width={size}
      height={(size * ALTO) / ANCHO}
      role={title ? 'img' : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      data-pose={pose}
    >
      {halo && (
        <defs>
          <filter id={filtro} x="-20%" y="-20%" width="140%" height="140%">
            <feMorphology in="SourceAlpha" operator="dilate" radius="1.6" result="borde" />
            <feFlood floodColor="var(--tino-halo, #F6F2EA)" />
            <feComposite in2="borde" operator="in" result="halo" />
            <feMerge>
              <feMergeNode in="halo" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      )}

      <ellipse className={a(p.cuerpo === 'tino-c-jump' ? 'tino-fb tino-c-shadow' : undefined)} cx="32" cy="76" rx="15" ry="2.4" fill={C.sombra} />
      {p.destellos && <Destellos a={a} />}

      <g filter={halo ? `url(#${filtro})` : undefined}>
        <g className={a(p.cuerpo)}>
          {/* Piernas */}
          <rect x="24" y="61" width="6.5" height="13" rx="3.2" fill={C.blanco} stroke={C.contorno} strokeWidth={TRAZO} />
          <rect x="33.5" y="61" width="6.5" height="13" rx="3.2" fill={C.blanco} stroke={C.contorno} strokeWidth={TRAZO} />

          {/* Brazos por detrás del cuerpo, salvo cuando sostiene el documento
              o se rasca la cabeza */}
          {!p.doc && brazoIzq}
          {!p.doc && !p.manoEnCabeza && brazoDer}

          {/* Cuerpo e insignia (el símbolo, más grande que en la lámina) */}
          <rect x="20.5" y="41" width="23" height="22" rx="8.5" fill={C.blanco} stroke={C.contorno} strokeWidth={TRAZO} />
          <path d="M12 4a8 8 0 1 1-8 8V4z" transform="translate(26.5 46.5) scale(.46)" fill={C.marca} />

          {p.doc && <Documento />}
          {p.doc && brazoIzq}
          {p.doc && brazoDer}

          {/* Cabeza: el símbolo ×2.5, con el visor donde vive el ojo */}
          <g style={{ transformBox: 'view-box', transformOrigin: '32px 42px', transform: `rotate(${p.cabeza}deg)` }}>
            <path d="M32 6a20 20 0 1 1-20 20V6z" fill={C.blanco} stroke={C.contorno} strokeWidth={TRAZO} strokeLinejoin="round" />
            <rect x="18" y="15" width="28" height="20" rx="7" fill={C.visor} />
            <rect x="21" y="18" width="5" height="2.2" rx="1.1" fill={C.brillo} />
            <Ojo tipo={p.ojo} a={a} />
          </g>
          {p.manoEnCabeza && brazoDer}
        </g>
      </g>
    </svg>
  );
}
