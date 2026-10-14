import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '../i18n/index.js';
import i18n from 'i18next';
import TopbarMoreMenu from './TopbarMoreMenu.jsx';

/**
 * Menú ⋮ del teléfono: junta lo que no cabe en la barra superior (estado
 * SAT, idioma, tema, ayuda, usuario y cerrar sesión).
 */
function montar(props = {}) {
  const acciones = { onToggleLanguage: vi.fn(), onToggleTheme: vi.fn(), onHelp: vi.fn(), onLogout: vi.fn() };
  render(<TopbarMoreMenu user={{ name: 'Fernando Escobar', initials: 'FE', role: 'Admin', branch: 'Central' }}
    language="es" theme="light" {...acciones} {...props} />);
  return acciones;
}

describe('TopbarMoreMenu', () => {
  beforeEach(async () => { await i18n.changeLanguage('es'); });

  it('está cerrado hasta tocar ⋮ y muestra usuario, estado y opciones', () => {
    montar();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Más opciones' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByText('Fernando Escobar')).toBeInTheDocument();
    expect(screen.getByText('Admin · Central')).toBeInTheDocument();
    expect(screen.getByText('Español')).toBeInTheDocument();
    expect(screen.getByText('Claro')).toBeInTheDocument();
  });

  it('cada opción ejecuta su acción y cierra el menú', () => {
    const acciones = montar();
    const abrir = () => fireEvent.click(screen.getByRole('button', { name: 'Más opciones' }));
    abrir(); fireEvent.click(screen.getByRole('menuitem', { name: /Idioma/ }));
    expect(acciones.onToggleLanguage).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    abrir(); fireEvent.click(screen.getByRole('menuitem', { name: /Tema/ }));
    abrir(); fireEvent.click(screen.getByRole('menuitem', { name: /Cerrar sesión/ }));
    expect(acciones.onToggleTheme).toHaveBeenCalledTimes(1);
    expect(acciones.onLogout).toHaveBeenCalledTimes(1);
  });

  it('se cierra con Escape y con un toque fuera', () => {
    montar();
    const abrir = () => fireEvent.click(screen.getByRole('button', { name: 'Más opciones' }));
    abrir(); fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    abrir(); fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
