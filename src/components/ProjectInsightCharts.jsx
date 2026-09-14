// Gráficas del proyecto: en qué se fue el dinero y cómo entró contra cómo salió.
//
// SVG a mano, como AreaChart y DonutChart del Dashboard: el proyecto no tiene
// librería de gráficas y meter una por dos figuras engordaría un bundle que ya
// supera los 2 MB.
//
// La composición suma EXACTAMENTE el ejecutado que reporta el backend —cargos
// del proyecto más cargos de cotizaciones aprobadas—. Si aquí se colara el
// material planificado, la gráfica contradiría la tarjeta de arriba, que es el
// problema que este módulo ya tuvo una vez.
import React, { useMemo } from 'react';

const Q = (v) => `Q ${Number(v || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const Qk = (v) => {
  const n = Number(v || 0);
  return Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toFixed(0);
};

/** Estados de cotización que cuentan como firmes. Igual que en el backend. */
const APROBADAS = new Set(['aprobada', 'convertida']);

const ETIQUETA_ORIGEN = {
  material: 'Materiales consumidos',
  labor: 'Mano de obra',
  purchase: 'Compras',
  other: 'Otros',
};

const PALETA = [
  'var(--md-sys-color-primary)',
  'var(--warning)',
  'var(--md-sys-color-tertiary, var(--accent))',
  'var(--success)',
  'var(--danger)',
  'var(--md-sys-color-outline)',
];

/** Agrupa el ejecutado por concepto, en el mismo orden que lo suma el backend. */
function composicion(project) {
  const partes = new Map();
  const suma = (etiqueta, monto) => {
    const v = Number(monto || 0);
    if (v <= 0) return;
    partes.set(etiqueta, (partes.get(etiqueta) || 0) + v);
  };

  for (const costo of project.costs || []) {
    suma(ETIQUETA_ORIGEN[costo.source] || 'Otros', costo.amount);
  }
  for (const cot of project.quotes || []) {
    if (!APROBADAS.has(String(cot.status || '').toLowerCase())) continue;
    for (const cargo of cot.charges || []) {
      suma(cargo.category || 'Cargos de cotización', cargo.computedAmount);
    }
  }
  return [...partes.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

export function CostCompositionChart({ project }) {
  const partes = useMemo(() => composicion(project), [project]);
  const total = partes.reduce((s, p) => s + p.value, 0);

  if (total <= 0) {
    return <div className="chart-empty">Todavía no hay gasto ejecutado que desglosar.</div>;
  }

  let acumulado = 0;
  const segmentos = partes.map((p, i) => {
    const inicio = (acumulado / total) * 100;
    acumulado += p.value;
    return { ...p, inicio, ancho: (p.value / total) * 100, color: PALETA[i % PALETA.length] };
  });

  return (
    <>
      <div className="comp-bar" role="img" aria-label={`Composición del gasto, total ${Q(total)}`}>
        {segmentos.map((s) => (
          <span key={s.label} className="comp-seg" title={`${s.label}: ${Q(s.value)}`}
            style={{ left: `${s.inicio}%`, width: `${s.ancho}%`, background: s.color }} />
        ))}
      </div>
      <ul className="comp-legend">
        {segmentos.map((s) => (
          <li key={s.label}>
            <span className="comp-dot" style={{ background: s.color }} />
            <span className="comp-name">{s.label}</span>
            <span className="comp-amount num">{Q(s.value)}</span>
            <span className="comp-pct muted">{s.ancho.toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * Cobros contra gastos, acumulados en el tiempo.
 *
 * Acumulado y no por día a propósito: en un proyecto los movimientos son pocos
 * y espaciados, y un gráfico de barras diarias sale casi todo en cero. Lo que
 * interesa es si la línea de cobros va por encima de la de gastos —el proyecto
 * se financia solo— o por debajo —lo estás pagando de tu bolsa—.
 */
/**
 * Barras horizontales para una distribución. Horizontales y no verticales
 * porque las etiquetas de los tramos («0.25 a 0.40») no caben giradas bajo una
 * barra vertical sin volverse ilegibles.
 */
export function DistributionChart({ buckets }) {
  const filas = buckets || [];
  const max = Math.max(1, ...filas.map((b) => Number(b.count || 0)));
  if (filas.every((b) => Number(b.count || 0) === 0)) {
    return <div className="chart-empty">Sin proyectos que distribuir con el filtro actual.</div>;
  }
  return (
    <ul className="dist-list">
      {filas.map((b, i) => (
        <li key={b.label}>
          <span className="dist-label">{b.label}</span>
          <span className="dist-track">
            <span className="dist-fill"
              style={{ width: `${(Number(b.count || 0) / max) * 100}%`,
                       background: i === 0 ? 'var(--danger)' : PALETA[i % PALETA.length] }} />
          </span>
          <span className="dist-count num">{b.count}</span>
        </li>
      ))}
    </ul>
  );
}

/** Igual que CostCompositionChart pero sobre porciones ya agregadas. */
export function CompositionBars({ slices }) {
  const partes = (slices || []).map((s) => ({ label: s.label, value: Number(s.amount || 0) }));
  const total = partes.reduce((s, p) => s + p.value, 0);
  if (total <= 0) return <div className="chart-empty">Sin gasto ejecutado en el período.</div>;

  let acumulado = 0;
  const segmentos = partes.map((p, i) => {
    const inicio = (acumulado / total) * 100;
    acumulado += p.value;
    return { ...p, inicio, ancho: (p.value / total) * 100, color: PALETA[i % PALETA.length] };
  });
  return (
    <>
      <div className="comp-bar" role="img" aria-label={`Composición del gasto, total ${Q(total)}`}>
        {segmentos.map((s) => (
          <span key={s.label} className="comp-seg" title={`${s.label}: ${Q(s.value)}`}
            style={{ left: `${s.inicio}%`, width: `${s.ancho}%`, background: s.color }} />
        ))}
      </div>
      <ul className="comp-legend">
        {segmentos.map((s) => (
          <li key={s.label}>
            <span className="comp-dot" style={{ background: s.color }} />
            <span className="comp-name">{s.label}</span>
            <span className="comp-amount num">{Q(s.value)}</span>
            <span className="comp-pct muted">{s.ancho.toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </>
  );
}

/** El mismo dibujo del flujo, sobre una serie ya acumulada por el backend. */
export function CashflowSeriesChart({ points, height = 220 }) {
  const serie = (points || []).map((p) => ({
    fecha: p.date, cobro: Number(p.collected || 0), gasto: Number(p.spent || 0),
  }));
  return <LineasFlujo serie={serie} height={height} />;
}

export function CashflowChart({ project, height = 200 }) {
  const serie = useMemo(() => {
    const eventos = [
      ...(project.costs || []).map((c) => ({ fecha: c.costDate, gasto: Number(c.amount || 0), cobro: 0 })),
      ...(project.payments || []).map((p) => ({ fecha: p.paymentDate, gasto: 0, cobro: Number(p.amount || 0) })),
    ].filter((e) => e.fecha).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));

    let gasto = 0, cobro = 0;
    const porFecha = new Map();
    for (const e of eventos) {
      gasto += e.gasto;
      cobro += e.cobro;
      porFecha.set(e.fecha, { fecha: e.fecha, gasto, cobro });
    }
    return [...porFecha.values()];
  }, [project]);

  return <LineasFlujo serie={serie} height={height} />;
}

/** Dibujo compartido: dos líneas acumuladas, cobros en verde y gastos en rojo. */
function LineasFlujo({ serie, height }) {
  const w = 800, pad = { l: 44, r: 12, t: 12, b: 26 };
  const innerW = w - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;

  if (serie.length < 2) {
    return (
      <div className="chart-empty">
        {serie.length === 0
          ? 'Sin cobros ni gastos registrados todavía.'
          : 'Hace falta más de un movimiento para dibujar la evolución.'}
      </div>
    );
  }

  const max = Math.max(...serie.map((p) => Math.max(p.gasto, p.cobro))) * 1.1 || 1;
  const paso = innerW / (serie.length - 1);
  const puntos = (campo) => serie.map((p, i) => [
    pad.l + i * paso,
    pad.t + innerH - (p[campo] / max) * innerH,
  ]);
  const linea = (pts) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
  const gastos = puntos('gasto');
  const cobros = puntos('cobro');
  const ticks = 4;

  return (
    <>
      <svg viewBox={`0 0 ${w} ${height}`} style={{ width: '100%', height, display: 'block' }}>
        {Array.from({ length: ticks + 1 }).map((_, i) => {
          const y = pad.t + (innerH / ticks) * i;
          return (
            <g key={i}>
              <line x1={pad.l} x2={w - pad.r} y1={y} y2={y} stroke="var(--border)" strokeWidth="1"
                strokeDasharray={i === ticks ? '' : '2,3'} />
              <text x={pad.l - 6} y={y + 3} textAnchor="end" fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--muted)">
                {Qk(max - (max / ticks) * i)}
              </text>
            </g>
          );
        })}
        {serie.map((p, i) => (i === 0 || i === serie.length - 1) && (
          <text key={i} x={pad.l + i * paso} y={height - 8}
            textAnchor={i === 0 ? 'start' : 'end'}
            fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--muted)">
            {String(p.fecha).slice(5)}
          </text>
        ))}
        <path d={linea(gastos)} fill="none" stroke="var(--danger)" strokeWidth="1.8" />
        <path d={linea(cobros)} fill="none" stroke="var(--success)" strokeWidth="1.8" />
        {[[gastos, 'var(--danger)'], [cobros, 'var(--success)']].map(([pts, color]) => (
          <circle key={color} cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3.5"
            fill="var(--surface)" stroke={color} strokeWidth="1.8" />
        ))}
      </svg>
      <div className="chart-legend">
        <span><i style={{ background: 'var(--success)' }} /> Cobrado {Q(serie[serie.length - 1].cobro)}</span>
        <span><i style={{ background: 'var(--danger)' }} /> Gastado {Q(serie[serie.length - 1].gasto)}</span>
      </div>
    </>
  );
}
