// Stackline — símbolo de marca «S calada»
// Dos elementos: un path con fill-rule="evenodd" (cuadrado redondeado + los dos
// cortes que abren la S en negativo) y un rect que pinta el tramo central en el
// color primario. Los huecos son transparencia real: no rellenarlos ni usar <mask>.
// Los cortes terminan EN el borde del cuerpo (x=41 / x=7; small: x=42 / x=6): si lo
// sobrepasan, evenodd los pinta como rebabas sueltas en vez de restarlos.
export default function Logo({ size = 40, className = '' }) {
  const small = size <= 24;
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={className}
         role="img" aria-label="Stackline">
      <path
        fillRule="evenodd"
        fill="currentColor"
        d={small
          ? 'M14.5 6 H33.5 A8.5 8.5 0 0 1 42 14.5 V33.5 A8.5 8.5 0 0 1 33.5 42 H14.5 A8.5 8.5 0 0 1 6 33.5 V14.5 A8.5 8.5 0 0 1 14.5 6 Z M19 12.4 H42 V20.6 H19 Z M6 27.4 H29 V35.6 H6 Z'
          : 'M14.5 7 H33.5 A7.5 7.5 0 0 1 41 14.5 V33.5 A7.5 7.5 0 0 1 33.5 41 H14.5 A7.5 7.5 0 0 1 7 33.5 V14.5 A7.5 7.5 0 0 1 14.5 7 Z M19.5 13.2 H41 V20.4 H19.5 Z M7 27.6 H28.5 V34.8 H7 Z'}
      />
      {small
        ? <rect x="19" y="20.6" width="10" height="6.8" fill="var(--md-primary)"/>
        : <rect x="19.5" y="20.4" width="9" height="7.2" fill="var(--md-primary)"/>}
    </svg>
  );
}
