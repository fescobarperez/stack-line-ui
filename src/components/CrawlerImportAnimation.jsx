import styles from './CrawlerImportAnimation.module.css';

const STATUS_LABELS = {
  queued: 'En cola',
  running: 'Extrayendo datos',
  extracting: 'Extrayendo datos',
  validating: 'Validando resultados',
};

const labelForStatus = (status) => STATUS_LABELS[status] || 'Crawling activo';

export default function CrawlerImportAnimation({ crawlResult }) {
  const status = crawlResult?.status;
  const label = labelForStatus(status);

  return (
    <div className={styles.root}>
      <div className={styles.animation} role="img" aria-label="Nexo recoge datos de una página web y los deposita en una caja">
        <svg className={styles.scene} viewBox="0 0 760 285" aria-hidden="true" focusable="false">
          <g className={styles.sourcePage}>
            <rect className={styles.surface} x="22" y="43" width="198" height="145" rx="12" />
            <path className={styles.browserTop} d="M22 55a12 12 0 0 1 12-12h174a12 12 0 0 1 12 12v22H22z" />
            <circle className={styles.browserDot} cx="39" cy="57" r="3" />
            <circle className={styles.browserDot} cx="49" cy="57" r="3" />
            <circle className={styles.browserDot} cx="59" cy="57" r="3" />
            <rect className={styles.surface} x="78" y="50" width="125" height="13" rx="6" />
            <text x="86" y="59">stackline.com</text>
            <text className={styles.strong} x="39" y="91">Catálogo del proveedor</text>
            <g className={styles.dataRow}>
              <rect x="39" y="101" width="164" height="21" rx="6" />
              <circle className={styles.dataMark} cx="51" cy="111.5" r="4" />
              <text className={styles.strong} x="62" y="115">Cemento gris</text>
              <text x="171" y="115">Q 82</text>
            </g>
            <g className={styles.dataRow}>
              <rect x="39" y="128" width="164" height="21" rx="6" />
              <circle className={styles.dataMark} cx="51" cy="138.5" r="4" />
              <text className={styles.strong} x="62" y="142">Tornillo hex.</text>
              <text x="171" y="142">Q 3</text>
            </g>
            <g className={styles.dataRow}>
              <rect x="39" y="155" width="164" height="21" rx="6" />
              <circle className={styles.dataMark} cx="51" cy="165.5" r="4" />
              <text className={styles.strong} x="62" y="169">Pintura interior</text>
              <text x="171" y="169">Q 129</text>
            </g>
          </g>

          <g className={`${styles.paper} ${styles.paperOne}`}>
            <rect x="143" y="101" width="23" height="17" rx="3" />
            <path className={styles.paperLine} d="M148 107h13M148 112h9" />
          </g>
          <g className={`${styles.paper} ${styles.paperTwo}`}>
            <rect x="143" y="128" width="23" height="17" rx="3" />
            <path className={styles.paperLine} d="M148 134h13M148 139h9" />
          </g>
          <g className={`${styles.paper} ${styles.paperThree}`}>
            <rect x="143" y="155" width="23" height="17" rx="3" />
            <path className={styles.paperLine} d="M148 161h13M148 166h9" />
          </g>

          <g className={styles.destinationCube}>
            <path className={styles.cubeFront} d="M610 108h78v80h-78z" />
            <path className={styles.cubeSide} d="M688 108l40-20v80l-40 20z" />
            <path className={styles.cubeTop} d="M610 108l40-20h78l-40 20z" />
          </g>

          <g className={styles.nexo}>
            <ellipse className={styles.shadow} cx="267" cy="247" rx="51" ry="7" />
            <path className={styles.nexoArm} d="M250 184L208 167" />
            <path className={styles.nexoArm} d="M322 184L354 202" />
            <rect className={styles.nexoShell} x="240" y="166" width="92" height="75" rx="24" />
            <rect className={styles.nexoLight} x="251" y="181" width="70" height="42" rx="14" />
            <text className={styles.brandMark} x="286" y="212">S</text>
            <path className={styles.nexoShell} d="M257 166v-19q0-14 14-20h30q14 6 14 20v19z" />
            <rect className={styles.nexoLight} x="265" y="140" width="42" height="26" rx="9" />
            <circle className={styles.eye} cx="277" cy="152" r="3.5" />
            <circle className={styles.eye} cx="295" cy="152" r="3.5" />
            <path className={styles.smile} d="M277 157q9 7 18 0" />
            <path className={styles.antenna} d="M286 127v-12" />
            <circle className={styles.eye} cx="286" cy="111" r="4" />
            <path className={`${styles.foot} ${styles.footLeft}`} d="M258 239l-10 10" />
            <path className={`${styles.foot} ${styles.footRight}`} d="M314 239l10 10" />
          </g>
        </svg>
      </div>
      <div className={styles.status} aria-live="polite">
        <span className={styles.statusDot} />
        <span>{label}</span>
      </div>
    </div>
  );
}
