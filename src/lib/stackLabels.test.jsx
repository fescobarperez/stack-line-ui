import React, { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { etiquetarTabla, useStackLabels, vigilarTablasApiladas } from './stackLabels.js';

/**
 * Tablas hechas a mano que se apilan en el teléfono: cada celda toma la
 * etiqueta de su encabezado sin escribirla a mano.
 */
function tabla(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.querySelector('table');
}

describe('etiquetarTabla', () => {
  it('copia el encabezado a cada celda; la primera es el título y la sin encabezado, acciones', () => {
    const t = tabla(`<table><thead><tr><th>Producto</th><th>Cant.</th><th>Total</th><th></th></tr></thead>
      <tbody><tr><td>Silla</td><td>2</td><td>Q 1,300</td><td><button>x</button></td></tr></tbody></table>`);
    etiquetarTabla(t);
    const [nombre, cant, total, acc] = t.querySelectorAll('td');
    expect(nombre.classList.contains('stack-title')).toBe(true);
    expect(cant.dataset.label).toBe('Cant.');
    expect(total.dataset.label).toBe('Total');
    expect(acc.classList.contains('stack-actions')).toBe(true);
  });

  it('respeta data-title-col, colspan y lo que ya viene marcado', () => {
    const t = tabla(`<table data-title-col="1"><thead><tr><th></th><th>Producto</th><th>Stock</th></tr></thead>
      <tbody><tr><td><input type="checkbox"></td><td>Silla</td><td data-label="Existencia">4</td></tr>
      <tr><td colspan="3">Sin datos</td></tr></tbody></table>`);
    etiquetarTabla(t);
    const [check, nombre, stock, vacia] = t.querySelectorAll('td');
    expect(check.classList.contains('stack-actions')).toBe(true);
    expect(nombre.classList.contains('stack-title')).toBe(true);
    expect(stock.dataset.label).toBe('Existencia');
    expect(vacia.dataset.label).toBeUndefined();
  });
});

describe('etiquetarTabla · pie', () => {
  it('un total simple queda igual y uno con varios montos se etiqueta', () => {
    const t = tabla(`<table><thead><tr><th>Empleado</th><th>Salario</th><th>Neto</th><th>Costo</th></tr></thead>
      <tbody><tr><td>Ana</td><td>1</td><td>2</td><td>3</td></tr></tbody>
      <tfoot><tr><td colspan="3">Subtotal</td><td>Q 9</td></tr>
      <tr><td>TOTALES</td><td>Q 1</td><td>Q 2</td><td>Q 3</td></tr></tfoot></table>`);
    etiquetarTabla(t);
    const [simple, varios] = t.querySelectorAll('tfoot tr');
    expect(simple.classList.contains('stack-card')).toBe(false);
    expect(simple.querySelector('td:last-child').dataset.label).toBeUndefined();
    expect(varios.classList.contains('stack-card')).toBe(true);
    // «TOTALES» es el título de la tarjeta; los montos llevan su etiqueta.
    expect(varios.querySelector('td').classList.contains('stack-title')).toBe(true);
    expect([...varios.querySelectorAll('td')].map((td) => td.dataset.label)).toEqual([undefined, 'Salario', 'Neto', 'Costo']);
  });
});

describe('useStackLabels', () => {
  function Lista() {
    const stack = useStackLabels();
    const [filas, setFilas] = useState(['Silla']);
    return (<>
      <button onClick={() => setFilas((f) => [...f, 'Mesa'])}>agregar</button>
      <table ref={stack}><thead><tr><th>Producto</th><th>Cant.</th></tr></thead>
        <tbody>{filas.map((f) => <tr key={f}><td>{f}</td><td>1</td></tr>)}</tbody></table>
    </>);
  }

  it('etiqueta también las filas que llegan después', async () => {
    const { container, getByText } = render(<Lista />);
    fireEvent.click(getByText('agregar'));
    await waitFor(() => {
      const cant = [...container.querySelectorAll('tbody td:nth-child(2)')];
      expect(cant).toHaveLength(2);
      expect(cant.every((td) => td.dataset.label === 'Cant.')).toBe(true);
    });
  });
});

describe('vigilarTablasApiladas', () => {
  it('etiqueta las tablas .tbl-stack que aparecen en el documento', async () => {
    const parar = vigilarTablasApiladas(document.body);
    const div = document.createElement('div');
    div.innerHTML = '<table class="tbl-stack"><thead><tr><th>Producto</th><th>Cant.</th></tr></thead><tbody><tr><td>Silla</td><td>2</td></tr></tbody></table>'
      + '<table><thead><tr><th>Otra</th><th>Cant.</th></tr></thead><tbody><tr><td>x</td><td>1</td></tr></tbody></table>';
    document.body.appendChild(div);
    await waitFor(() => expect(div.querySelector('.tbl-stack td:nth-child(2)').dataset.label).toBe('Cant.'));
    // Una tabla sin la clase no se toca.
    expect(div.querySelector('table:not(.tbl-stack) td:nth-child(2)').dataset.label).toBeUndefined();
    parar();
    div.remove();
  });
});
