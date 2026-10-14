import { describe, expect, it, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DataTable, { cardRoles } from './DataTable.jsx';

/**
 * En el teléfono cada fila es una tarjeta; cada columna dice qué papel
 * tiene (título, estado, monto, par etiqueta/valor u oculta).
 */
const columnas = [
  { key: 'doc', header: 'Cotización', card: 'title', sortable: true },
  { key: 'cliente', header: 'Cliente', card: 'subtitle' },
  { key: 'estado', header: 'Estado', card: 'badge' },
  { key: 'fecha', header: 'Fecha' },
  { key: 'interno', header: 'Interno', card: 'hide' },
  { key: 'total', header: 'Total', card: 'amount', align: 'right', sortable: true },
];
const filas = [
  { doc: 'COT-9', cliente: 'Cristina Corado', estado: 'Prospecto', fecha: '13/10', interno: 'x', total: 'Q 29,120.00' },
  { doc: 'COT-8', cliente: 'El Ángel', estado: 'Enviada', fecha: '', interno: 'y', total: 'Q 1,800.00' },
];

const ancho = (w) => { window.innerWidth = w; };
afterEach(() => ancho(1024));

describe('cardRoles', () => {
  it('sin declarar: la primera columna es el título y el resto pares', () => {
    expect(cardRoles([{ key: 'a' }, { key: 'b' }, { key: 'c', card: 'amount' }])).toEqual(['title', 'meta', 'amount']);
  });
  it('si alguna se declara título, la primera ya no lo es por defecto', () => {
    expect(cardRoles([{ key: 'a' }, { key: 'b', card: 'title' }])).toEqual(['meta', 'title']);
  });
});

describe('DataTable en el teléfono', () => {
  it('muestra una tarjeta por fila con cada columna en su lugar', () => {
    ancho(375);
    const { container } = render(<DataTable columns={columnas} rows={filas} rowKey={(r) => r.doc} />);
    expect(container.querySelector('table')).toBeNull();
    const tarjetas = container.querySelectorAll('.tbl-card');
    expect(tarjetas).toHaveLength(2);
    const [primera, segunda] = tarjetas;
    expect(primera.querySelector('.tbl-card-title').textContent).toBe('COT-9');
    expect(primera.querySelector('.tbl-card-sub').textContent).toBe('Cristina Corado');
    expect(primera.querySelector('.tbl-card-badge').textContent).toBe('Prospecto');
    expect(primera.querySelector('.tbl-card-amount').textContent).toBe('Q 29,120.00');
    expect(primera.querySelector('dt').textContent).toBe('Fecha');
    expect(primera.textContent).not.toContain('Interno');
    // Un valor vacío no deja la etiqueta sola.
    expect(segunda.querySelector('.tbl-card-meta')).toBeNull();
  });

  it('las acciones y el clic de la fila funcionan en la tarjeta', () => {
    ancho(375);
    const vistos = [];
    render(<DataTable columns={columnas} rows={filas} rowKey={(r) => r.doc}
      onRowClick={(r) => vistos.push(`fila ${r.doc}`)} onEdit={(r) => vistos.push(`editar ${r.doc}`)} />);
    fireEvent.click(screen.getAllByLabelText('Editar')[0]);
    fireEvent.click(screen.getByText('COT-8'));
    expect(vistos).toEqual(['editar COT-9', 'fila COT-8']);
  });

  it('ordena desde el selector', () => {
    ancho(375);
    const { container } = render(<DataTable columns={columnas} rows={filas} rowKey={(r) => r.doc} />);
    fireEvent.change(screen.getByLabelText('Ordenar'), { target: { value: 'doc:asc' } });
    expect([...container.querySelectorAll('.tbl-card-title')].map((e) => e.textContent)).toEqual(['COT-8', 'COT-9']);
  });

  it('con cards="tablet" también usa tarjetas en tablet, pero no en escritorio', () => {
    ancho(768);
    const { container, unmount } = render(<DataTable columns={columnas} rows={filas} cards="tablet" />);
    expect(container.querySelector('table')).toBeNull();
    unmount();
    ancho(1280);
    const otra = render(<DataTable columns={columnas} rows={filas} cards="tablet" />);
    expect(otra.container.querySelector('table')).not.toBeNull();
  });

  it('con cards={false} o fuera del teléfono es una tabla', () => {
    ancho(375);
    const { container, unmount } = render(<DataTable columns={columnas} rows={filas} cards={false} />);
    expect(container.querySelector('table')).not.toBeNull();
    unmount();
    ancho(768);
    const otra = render(<DataTable columns={columnas} rows={filas} />);
    expect(otra.container.querySelector('table')).not.toBeNull();
  });
});

describe('DataTable · columnas secundarias', () => {
  it('marca las columnas que se ocultan en tablet y en laptop', () => {
    ancho(1280);
    const { container } = render(<DataTable rows={filas} rowKey={(r) => r.doc} columns={[
      { key: 'doc', header: 'Cotización' },
      { key: 'fecha', header: 'Fecha', hideOnTablet: true },
      { key: 'interno', header: 'Interno', hideOnLaptop: true },
    ]} />);
    const [doc, fecha, interno] = container.querySelectorAll('thead th');
    expect(doc.className).not.toMatch(/hide-/);
    expect(fecha.className).toContain('hide-tablet');
    expect(interno.className).toContain('hide-laptop');
    expect(container.querySelector('tbody td.hide-laptop')).not.toBeNull();
  });
});

describe('DataTable · totales en tarjetas', () => {
  it('el total de la columna título es el encabezado, no un par', () => {
    ancho(375);
    const { container } = render(<DataTable rows={filas} rowKey={(r) => r.doc} columns={columnas}
      totals={{ doc: 'Total', total: 'Q 30,920.00' }} />);
    const caja = container.querySelector('.tbl-card-totals');
    expect(caja.querySelector('.tbl-card-totals-head').textContent).toBe('Total');
    expect([...caja.querySelectorAll('dt')].map((d) => d.textContent)).toEqual(['Total']);
    expect(caja.querySelector('dd').textContent).toBe('Q 30,920.00');
  });
});
