// Stackline — Tarjeta de KPI (Material Design 3)
//
// Componente único para las tarjetas de indicador de toda la app. Sustituye al
// bloque `.stat` escrito a mano (label + val + delta): eran el mismo dato con
// otra estructura —icono de 11px pegado al texto y caja con borde en vez de
// elevada—, así que por muchos ajustes de tipografía nunca llegaban a parecerse
// a las de Dashboard. Ahora Dashboard y los módulos renderizan esto mismo.
//
//   <StatCard icon="cash" tone="pri"
//             label="Ventas del día" value={Q(total)}
//             trend={{ dir: 'up', label: '12 %' }} foot="vs. ayer" />
//
//   <StatCard icon="calendar" tone="err" size="headline"
//             label="Período actual" value="Mayo 2026" />
//
//   <StatCard icon="receipt" tone="ter"
//             label="Total débitos registrados" value="Q 0k"
//             foot="Partidas automáticas" />
//
// La cifra NO lleva monoespaciada: `.kpi-val` ya trae font-variant-numeric:
// tabular-nums, que es la razón real por la que se usaba mono (alinear dígitos).
// Roboto la soporta, así que el mono solo rompía la consistencia con Dashboard.
import React from 'react';
import Icon from './Icon.jsx';

export default function StatCard({
  icon,                 // nombre de <Icon>; sin él la tarjeta va sin contenedor
  tone = 'pri',         // pri | sec | ter | err — color del contenedor del icono
  label,
  value,
  size = 'headline',    // headline (24, estándar) | display (36) | title (16)
  valueColor = null,    // color semántico de la cifra (var(--success|danger|warning|accent))
  trend = null,         // { dir: 'up' | 'down' | null, label, icon? }
                        // dir fuera de up/down = neutro (sin color ni flecha);
                        // el icono solo se dibuja si se pasa trend.icon
  style = null,         // solo layout (margin/padding); la tipografía va por props
  foot = null,          // texto de apoyo (prosa)
  className = '',
  children,             // escape hatch: contenido extra al pie de la tarjeta
}) {
  const dir = trend && (trend.dir === 'up' || trend.dir === 'down') ? trend.dir : null;
  return (
    <div className={['card card-elevated kpi', className].filter(Boolean).join(' ')} style={style || undefined}>
      <div className="kpi-top">
        {icon && (
          <div className={`kpi-ic ${tone}`}><Icon name={icon} size={24} /></div>
        )}
        <div className="kpi-label label-large">{label}</div>
      </div>
      <div
        className={['kpi-val', size !== 'display' && `sz-${size}`].filter(Boolean).join(' ')}
        style={valueColor ? { color: valueColor } : undefined}
      >{value}</div>
      {(trend || foot) && (
        <div className="kpi-foot body-small">
          {trend && (
            <span className={dir ? `trend ${dir}` : undefined}>
              {trend.icon && <Icon name={trend.icon} size={16} />}{trend.label}
            </span>
          )}
          {foot && <span>{foot}</span>}
        </div>
      )}
      {children}
    </div>
  );
}

export { StatCard };
