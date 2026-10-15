import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import '../i18n/index.js';
import i18n from 'i18next';

vi.mock('../api/activation.js', async (orig) => ({
  ...(await orig()),
  getActivation: vi.fn(),
  activateAccount: vi.fn(),
}));
import { getActivation, activateAccount, passwordOk } from '../api/activation.js';
import Activate from './Activate.jsx';

function LoginStub() {
  const { state } = useLocation();
  return <div>login {state?.companyCode} {state?.email}</div>;
}

function montar(url = '/activar?t=abc') {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/activar" element={<Activate />} />
        <Route path="/login" element={<LoginStub />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Activar cuenta', () => {
  beforeEach(async () => { vi.clearAllMocks(); await i18n.changeLanguage('es'); });

  it('la contraseña pide 8 caracteres con letras y números', () => {
    expect(passwordOk('madera2026')).toBe(true);
    expect(passwordOk('12345678')).toBe(false);
    expect(passwordOk('corta1')).toBe(false);
  });

  it('muestra la empresa y al activar va al login con código y correo', async () => {
    getActivation.mockResolvedValue({ name: 'Ana', email: 'ana@mv.gt', companyName: 'Madera Viva', companyCode: 'MADERAVIVA' });
    activateAccount.mockResolvedValue({ name: 'Ana', email: 'ana@mv.gt', companyName: 'Madera Viva', companyCode: 'MADERAVIVA' });
    montar();
    expect(await screen.findByText('Madera Viva')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'madera2026' } });
    fireEvent.change(screen.getByLabelText('Repite la contraseña'), { target: { value: 'madera2027' } });
    fireEvent.click(screen.getByRole('button', { name: 'Activar y continuar' }));
    expect(await screen.findByText('Las contraseñas no coinciden.')).toBeInTheDocument();
    expect(activateAccount).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Repite la contraseña'), { target: { value: 'madera2026' } });
    fireEvent.click(screen.getByRole('button', { name: 'Activar y continuar' }));
    await waitFor(() => expect(activateAccount).toHaveBeenCalledWith('abc', 'madera2026'));
    expect(await screen.findByText(/login MADERAVIVA ana@mv.gt/)).toBeInTheDocument();
  });

  it('un enlace vencido o usado solo ofrece volver al login', async () => {
    getActivation.mockRejectedValue(Object.assign(new Error('El enlace ya no es válido.'), { status: 410 }));
    montar();
    expect(await screen.findByRole('alert')).toHaveTextContent('El enlace ya no es válido.');
    expect(screen.queryByLabelText('Contraseña')).not.toBeInTheDocument();
  });
});
