// Hora de la agenda: el TimePicker de la app con el rango de una clínica
// (05:00 a 22:00, cada 15 minutos) para no repetirlo en cada pantalla.
import React from 'react';
import TimePicker from '../TimePicker.jsx';

export default function TimeSelect({ from = '05:00', to = '22:00', step = 15, ...props }) {
  return <TimePicker from={from} to={to} step={step} {...props} />;
}
