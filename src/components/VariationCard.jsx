// Coeficiente de variación del proyecto: (Pactado − Ejecutado) / Pactado.
//
// Es el margen expresado como coeficiente en vez de porcentaje —donde el
// sistema dice 40.00 %, aquí dice 0.40—. No se recalcula: sale de marginPct y
// projectedMarginPct del backend, para que no vuelva a haber dos números
// distintos del mismo proyecto en pantallas distintas.
//
// El nombre es el que usa el negocio. En estadística «coeficiente de
// variación» es otra cosa (desviación estándar sobre la media); esto es una
// variación presupuestaria: lo pactado contra lo que costó.
import React from 'react';
import Icon from './Icon.jsx';

const Q = (v) => `Q ${Number(v || 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const COEF = (pct) => (Number(pct || 0) / 100).toFixed(2);

export default function VariationCard({ project, loading = false }) {
  const pactado = Number(project.contracted || 0);
  const ejecutado = Number(project.executed || 0);
  const real = Number(project.marginPct || 0) / 100;
  const proyectado = Number(project.projectedMarginPct || 0) / 100;

  // Sin monto pactado no hay contra qué medir: el coeficiente sería una
  // división por cero, y mostrar 0.00 haría creer que el proyecto va parejo.
  const sinBase = pactado <= 0;
  const tono = sinBase ? 'is-neutral' : real < 0 ? 'is-negative' : 'is-positive';
  const difiere = Math.abs(real - proyectado) >= 0.005;

  return (
    <div className={`card variation-card ${tono}`}>
      <div className="card-body">
        <div className="variation-head">
          <span className="variation-label">Coeficiente de variación</span>
          <Icon name={sinBase ? 'info' : real < 0 ? 'alert' : 'chart'} size={15} />
        </div>

        {sinBase ? (
          <div className="variation-empty">
            Este proyecto no tiene monto pactado, así que no hay contra qué medir lo ejecutado.
          </div>
        ) : (
          <>
            <div className="variation-value">{loading ? '—' : COEF(project.marginPct)}</div>
            <div className="variation-formula">
              ({Q(pactado)} − {Q(ejecutado)}) / {Q(pactado)}
            </div>
            {difiere && (
              <div className="variation-projected">
                Proyectado <strong>{COEF(project.projectedMarginPct)}</strong>
                <small>
                  {proyectado < real
                    ? 'con lo que falta por gastar'
                    : 'con lo comprometido liberado'}
                </small>
              </div>
            )}
            <div className="variation-scale" aria-hidden="true">
              {/* El cero al centro: a la derecha se gana, a la izquierda se pierde. */}
              <span className="variation-zero" />
              <span
                className="variation-marker"
                style={{ left: `${Math.min(Math.max((real + 1) / 2, 0), 1) * 100}%` }}
              />
            </div>
            <div className="variation-legend">
              <span>−1.0</span><span>0</span><span>+1.0</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
