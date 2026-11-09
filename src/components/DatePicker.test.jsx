import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import DatePicker, { leerFecha } from './DatePicker.jsx';

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

describe('DatePicker · lo que se escribe', () => {
  const hoy = new Date(2026, 9, 31); // 31 de octubre de 2026

  it('entiende las formas comunes de escribir una fecha', () => {
    expect(iso(leerFecha('15/11/2026', hoy))).toBe('2026-11-15');
    expect(iso(leerFecha('5-1-27', hoy))).toBe('2027-01-05');
    expect(iso(leerFecha('15.11.2026', hoy))).toBe('2026-11-15');
    expect(iso(leerFecha('15112026', hoy))).toBe('2026-11-15');
    expect(iso(leerFecha('15/11', hoy))).toBe('2026-11-15');
    expect(iso(leerFecha('hoy', hoy))).toBe('2026-10-31');
    expect(iso(leerFecha('mañana', hoy))).toBe('2026-11-01');
    expect(iso(leerFecha('ayer', hoy))).toBe('2026-10-30');
  });

  it('rechaza lo que no es una fecha real', () => {
    expect(leerFecha('31/02/2026', hoy)).toBeNull();
    expect(leerFecha('13/13/2026', hoy)).toBeNull();
    expect(leerFecha('pronto', hoy)).toBeNull();
    expect(leerFecha('', hoy)).toBeNull();
  });
});

function Controlado({ inicial = '', onChange, ...props }) {
  const [v, setV] = useState(inicial);
  return <DatePicker value={v} onChange={(x) => { setV(x); onChange?.(x); }} aria-label="Día" {...props} />;
}

describe('DatePicker · uso', () => {
  it('distingue los días del mes de los de los meses vecinos', () => {
    render(<Controlado inicial="2026-10-31" />);
    fireEvent.click(screen.getByRole('button', { name: 'Día' }));
    const panel = screen.getByRole('dialog');
    expect(within(panel).getByRole('button', { name: '28 de septiembre de 2026' })).toHaveClass('is-outside');
    expect(within(panel).getByRole('button', { name: '15 de octubre de 2026' })).toHaveClass('is-current');
    expect(within(panel).getByRole('button', { name: '31 de octubre de 2026' })).toHaveClass('is-selected');
  });

  it('del mes se pasa a los doce meses y del año a los años', () => {
    const onChange = vi.fn();
    render(<Controlado inicial="2026-10-31" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Día' }));
    let panel = screen.getByRole('dialog');

    fireEvent.click(within(panel).getByRole('button', { name: 'Elegir año' }));
    panel = screen.getByRole('dialog');
    expect(within(panel).getByText('2016 – 2027')).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole('button', { name: 'Siguiente grupo de años' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '2030' }));

    // Del año se baja a los meses de ese año…
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Marzo 2030' }));
    // …y del mes a sus días.
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '12 de marzo de 2030' }));
    expect(onChange).toHaveBeenLastCalledWith('2030-03-12');
  });

  it('el nombre del mes abre los meses del año a la vista', () => {
    render(<Controlado inicial="2026-10-31" />);
    fireEvent.click(screen.getByRole('button', { name: 'Día' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Elegir mes' }));
    const panel = screen.getByRole('dialog');
    expect(within(panel).getByRole('button', { name: 'Octubre 2026' })).toHaveClass('is-selected');
    fireEvent.click(within(panel).getByRole('button', { name: 'Enero 2026' }));
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Elegir mes' })).toHaveTextContent('Enero');
  });

  it('se puede escribir la fecha y Enter la elige', () => {
    const onChange = vi.fn();
    render(<Controlado onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Día' }));
    const campo = within(screen.getByRole('dialog')).getByLabelText('Escribir fecha');
    fireEvent.change(campo, { target: { value: '15/11/2026' } });
    fireEvent.keyDown(campo, { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith('2026-11-15');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('una fecha escrita fuera del rango se avisa y no se elige', () => {
    const onChange = vi.fn();
    render(<Controlado onChange={onChange} min="2026-11-01" />);
    fireEvent.click(screen.getByRole('button', { name: 'Día' }));
    const campo = within(screen.getByRole('dialog')).getByLabelText('Escribir fecha');
    fireEvent.change(campo, { target: { value: '15/10/2026' } });
    fireEvent.keyDown(campo, { key: 'Enter' });
    expect(screen.getByRole('alert')).toHaveTextContent('fuera del rango');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('los meses sin días dentro del rango no se pueden elegir', () => {
    render(<Controlado inicial="2026-11-15" min="2026-11-01" max="2027-02-28" />);
    fireEvent.click(screen.getByRole('button', { name: 'Día' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Elegir mes' }));
    const panel = screen.getByRole('dialog');
    expect(within(panel).getByRole('button', { name: 'Octubre 2026' })).toBeDisabled();
    expect(within(panel).getByRole('button', { name: 'Noviembre 2026' })).toBeEnabled();
  });

  it('Escape vuelve un nivel antes de cerrar', () => {
    render(<Controlado inicial="2026-10-31" />);
    fireEvent.click(screen.getByRole('button', { name: 'Día' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Elegir año' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Octubre 2026' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Elegir mes' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('la semana va de domingo a sábado', () => {
    render(<Controlado inicial="2026-11-09" />);
    fireEvent.click(screen.getByRole('button', { name: 'Día' }));
    const panel = screen.getByRole('dialog');
    const dias = within(panel).getAllByRole('button', { name: /de \w+ de 2026$/ });
    // noviembre 2026 empieza en domingo: la primera celda es el 1 y la séptima el sábado 7
    expect(dias[0]).toHaveAccessibleName('1 de noviembre de 2026');
    expect(dias[6]).toHaveAccessibleName('7 de noviembre de 2026');
    expect(panel.querySelector('.datepicker-weekdays').textContent).toBe('DLMMJVS');
  });
});
