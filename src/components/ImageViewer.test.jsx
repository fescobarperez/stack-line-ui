import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ImageViewer from './ImageViewer.jsx';

describe('ImageViewer', () => {
  it('abre a pantalla completa con el título y el foco en cerrar', () => {
    render(<ImageViewer src="blob:foto" title="Cocina Contemporánea" onClose={() => {}} />);
    const dialogo = screen.getByRole('dialog', { name: 'Cocina Contemporánea' });
    expect(dialogo.parentElement).toBe(document.body);
    expect(screen.getByRole('img', { name: 'Cocina Contemporánea' })).toHaveAttribute('src', 'blob:foto');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cerrar' }));
  });

  it('acerca, aleja y vuelve al 100 %', () => {
    render(<ImageViewer src="blob:foto" title="Foto" onClose={() => {}} />);
    const pct = screen.getByRole('button', { name: 'Ajustar a la pantalla' });
    fireEvent.click(screen.getByRole('button', { name: 'Acercar' }));
    expect(pct).toHaveTextContent('150%');
    fireEvent.click(screen.getByRole('button', { name: 'Alejar' }));
    expect(pct).toHaveTextContent('100%');
    fireEvent.click(screen.getByRole('button', { name: 'Acercar' }));
    fireEvent.click(pct);
    expect(pct).toHaveTextContent('100%');
  });

  it('cierra con Esc o con la ✕ y devuelve el scroll de la página', () => {
    const onClose = vi.fn();
    const { unmount } = render(<ImageViewer src="blob:foto" title="Foto" onClose={onClose} />);
    expect(document.documentElement.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalledTimes(2);
    unmount();
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('el tabulador no saca el foco del visor', () => {
    render(<ImageViewer src="blob:foto" title="Foto" onClose={() => {}} />);
    const cerrar = screen.getByRole('button', { name: 'Cerrar' });
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Alejar' }));
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(cerrar);
  });
});
