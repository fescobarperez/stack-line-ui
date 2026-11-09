import { describe, expect, it } from 'vitest';
import { layoutFor, sidebarMode, PHONE_MAX, TABLET_MAX } from './breakpoints.js';

/**
 * Puntos de corte y presentación del menú lateral. Los mismos números viven
 * en los @media de global.css: si este test cambia, aquel también.
 */
describe('layoutFor', () => {
  it('separa teléfono, tablet y escritorio', () => {
    expect(layoutFor(375)).toBe('phone');
    expect(layoutFor(PHONE_MAX)).toBe('phone');
    expect(layoutFor(PHONE_MAX + 1)).toBe('tablet');
    expect(layoutFor(768)).toBe('tablet');
    expect(layoutFor(TABLET_MAX)).toBe('tablet');
    expect(layoutFor(TABLET_MAX + 1)).toBe('desktop');
    expect(layoutFor(1440)).toBe('desktop');
  });
});

describe('sidebarMode', () => {
  it('en escritorio respeta la preferencia del usuario', () => {
    expect(sidebarMode('desktop')).toBe('expanded');
    expect(sidebarMode('desktop', { collapsed: true })).toBe('collapsed');
    // El cajón no aplica en escritorio aunque haya quedado abierto.
    expect(sidebarMode('desktop', { drawerOpen: true })).toBe('expanded');
  });

  it('en tablet es un riel de iconos que se abre encima', () => {
    expect(sidebarMode('tablet')).toBe('collapsed');
    expect(sidebarMode('tablet', { drawerOpen: true })).toBe('drawer');
  });

  it('en teléfono está oculto y se abre como cajón', () => {
    expect(sidebarMode('phone')).toBe('hidden');
    expect(sidebarMode('phone', { drawerOpen: true })).toBe('drawer');
    expect(sidebarMode('phone', { collapsed: true })).toBe('hidden');
  });
});
