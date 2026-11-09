import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import TimePicker, { ajustar, hora12, leerHora } from './TimePicker.jsx';

describe('TimePicker · lo que se escribe', () => {
  it('entiende las formas comunes de escribir una hora', () => {
    expect(leerHora('9')).toBe(9 * 60);
    expect(leerHora('930')).toBe(9 * 60 + 30);
    expect(leerHora('0930')).toBe(9 * 60 + 30);
    expect(leerHora('9:30')).toBe(9 * 60 + 30);
    expect(leerHora('14.45')).toBe(14 * 60 + 45);
    expect(leerHora('2 pm')).toBe(14 * 60);
    expect(leerHora('2:30 p. m.')).toBe(14 * 60 + 30);
    expect(leerHora('12 am')).toBe(0);
    expect(leerHora('12 pm')).toBe(12 * 60);
    expect(leerHora('25')).toBeNull();
    expect(leerHora('9:75')).toBeNull();
    expect(leerHora('13 pm')).toBeNull();
    expect(leerHora('mañana')).toBeNull();
  });

  it('lleva la hora al paso y al rango', () => {
    expect(ajustar(9 * 60 + 7, 300, 1320, 15)).toBe(9 * 60 + 15 - 15); // 09:07 → 09:00
    expect(ajustar(9 * 60 + 8, 300, 1320, 15)).toBe(9 * 60 + 15);      // 09:08 → 09:15
    expect(ajustar(60, 300, 1320, 15)).toBe(300);                       // antes de las 05:00 → 05:00
    expect(ajustar(1439, 300, 1320, 15)).toBe(1320);                    // después de las 22:00 → 22:00
  });

  it('dice la hora como en Guatemala', () => {
    expect(hora12('09:30')).toBe('9:30 a. m.');
    expect(hora12('14:05')).toBe('2:05 p. m.');
    expect(hora12('00:00')).toBe('12:00 a. m.');
    expect(hora12('12:15')).toBe('12:15 p. m.');
  });
});

function Controlado({ inicial = '', onChange, ...props }) {
  const [v, setV] = useState(inicial);
  return <TimePicker value={v} onChange={(x) => { setV(x); onChange?.(x); }} aria-label="Hora" {...props} />;
}

describe('TimePicker · uso', () => {
  it('se elige en dos toques: la hora y luego los minutos', () => {
    const onChange = vi.fn();
    render(<Controlado onChange={onChange} from="05:00" to="22:00" />);
    fireEvent.focus(screen.getByLabelText('Hora'));
    const panel = screen.getByRole('dialog');
    expect(within(panel).getByText('Mañana')).toBeInTheDocument();
    expect(within(panel).queryByText('23')).toBeNull(); // fuera del rango
    fireEvent.click(within(panel).getByRole('button', { name: '14' }));
    expect(onChange).toHaveBeenLastCalledWith('14:00');
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: ':30' }));
    expect(onChange).toHaveBeenLastCalledWith('14:30');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByLabelText('Hora')).toHaveValue('14:30');
    expect(screen.getByText('p. m.')).toBeInTheDocument();
  });

  it('al cambiar solo la hora conserva los minutos', () => {
    const onChange = vi.fn();
    render(<Controlado inicial="09:45" onChange={onChange} />);
    fireEvent.focus(screen.getByLabelText('Hora'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '10' }));
    expect(onChange).toHaveBeenLastCalledWith('10:45');
  });

  it('en la última hora del rango solo se puede el minuto que cabe', () => {
    const onChange = vi.fn();
    render(<Controlado onChange={onChange} from="05:00" to="22:00" />);
    fireEvent.focus(screen.getByLabelText('Hora'));
    // 22 solo tiene 22:00: se elige directo y se cierra.
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '22' }));
    expect(onChange).toHaveBeenLastCalledWith('22:00');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('se puede escribir y se ajusta al paso', () => {
    const onChange = vi.fn();
    render(<Controlado onChange={onChange} step={15} />);
    const campo = screen.getByLabelText('Hora');
    fireEvent.focus(campo);
    fireEvent.change(campo, { target: { value: '2:37 pm' } });
    fireEvent.keyDown(campo, { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith('14:30');
  });

  it('lo que no se entiende vuelve a la hora anterior', () => {
    const onChange = vi.fn();
    render(<Controlado inicial="08:00" onChange={onChange} />);
    const campo = screen.getByLabelText('Hora');
    fireEvent.change(campo, { target: { value: 'temprano' } });
    fireEvent.blur(campo);
    expect(campo).toHaveValue('08:00');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('las flechas mueven la hora de a un paso', () => {
    const onChange = vi.fn();
    render(<Controlado inicial="08:00" onChange={onChange} step={30} />);
    const campo = screen.getByLabelText('Hora');
    fireEvent.keyDown(campo, { key: 'ArrowUp' });
    expect(onChange).toHaveBeenLastCalledWith('08:30');
    fireEvent.keyDown(campo, { key: 'ArrowDown' });
    fireEvent.keyDown(campo, { key: 'ArrowDown' });
    expect(onChange).toHaveBeenLastCalledWith('07:30');
  });

  it('con allowClear se puede quitar la hora', () => {
    const onChange = vi.fn();
    render(<Controlado inicial="08:00" onChange={onChange} allowClear />);
    fireEvent.click(screen.getByRole('button', { name: 'Quitar hora' }));
    expect(onChange).toHaveBeenLastCalledWith('');
  });
});
