import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '../../i18n/index.js';
import i18n from 'i18next';

vi.mock('../../api/salud.js', () => ({ getChargeOptions: vi.fn(), chargeAppointment: vi.fn(), voidCharge: vi.fn() }));

import { chargeAppointment, getChargeOptions, voidCharge } from '../../api/salud.js';
import ChargeDialog from './ChargeDialog.jsx';

const BASE = {
  appointmentId: 50, appointmentStatus: 'completada', patientId: 7, patientName: 'Ana López', typeId: 3,
  typeName: 'Fisioterapia', price: 200, creditBalance: 0, packages: [], cashRegisterOpen: true,
};
const PAQUETE = { id: 4, name: '10 sesiones', typeId: 3, sessionsTotal: 10, sessionsUsed: 3, sessionsLeft: 7, status: 'activo', usable: true };

const montar = (props = {}) => {
  const onDone = vi.fn();
  render(<ChargeDialog appointmentId={50} canVoid canCourtesy pushToast={vi.fn()} onClose={vi.fn()} onDone={onDone} {...props} />);
  return onDone;
};

describe('ChargeDialog', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('es');
    chargeAppointment.mockResolvedValue({ id: 1 });
  });

  it('con un paquete que sirve, lo propone y descuenta la sesión', async () => {
    getChargeOptions.mockResolvedValue({ ...BASE, packages: [PAQUETE] });
    const onDone = montar();
    expect(await screen.findByText('7 de 10 sesiones disponibles')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Descontar sesión/ }));
    await waitFor(() => expect(chargeAppointment).toHaveBeenCalledWith(50, { patientPackageId: 4, notes: null }));
    expect(onDone).toHaveBeenCalled();
  });

  it('aplica el anticipo y factura el resto con la forma de pago elegida', async () => {
    getChargeOptions.mockResolvedValue({ ...BASE, creditBalance: 50 });
    montar();
    expect(await screen.findByText('Saldo a favor Q 50.00')).toBeInTheDocument();
    expect(screen.getByLabelText(/Usar el anticipo/)).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: 'Tarjeta' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cobrar Q 150.00' }));
    await waitFor(() => expect(chargeAppointment).toHaveBeenCalledWith(50, {
      price: 200, discount: null, useCredit: true, paymentMethod: 'tarjeta', notes: null,
    }));
  });

  it('sin turno de caja no deja facturar', async () => {
    getChargeOptions.mockResolvedValue({ ...BASE, cashRegisterOpen: false });
    montar();
    expect(await screen.findByText(/No tienes un turno de caja abierto/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cobrar Q 200.00' })).toBeDisabled();
  });

  it('la cortesía pide motivo', async () => {
    getChargeOptions.mockResolvedValue(BASE);
    montar();
    fireEvent.click(await screen.findByRole('radio', { name: 'Cortesía' }));
    const boton = screen.getByRole('button', { name: 'Registrar cortesía' });
    expect(boton).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Motivo de la cortesía *'), { target: { value: 'Familiar del doctor' } });
    fireEvent.click(boton);
    await waitFor(() => expect(chargeAppointment).toHaveBeenCalledWith(50, { courtesy: true, price: 200, notes: 'Familiar del doctor' }));
  });

  it('una cita cobrada se muestra y se puede anular con motivo', async () => {
    getChargeOptions.mockResolvedValue({ ...BASE, charge: {
      id: 9, method: 'venta', price: 200, discount: 0, total: 200, creditAmount: 0, cashAmount: 200, saleId: 77, saleNumber: 'A-000123',
      status: 'vigente', paymentMethod: 'efectivo',
    } });
    voidCharge.mockResolvedValue({ charge: { id: 9, status: 'anulado' }, warning: 'La factura A-000123 sigue vigente' });
    const onDone = montar();
    expect(await screen.findByText(/Factura A-000123/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Anular cobro/ }));
    expect(screen.getByText(/emite la nota de crédito en Facturación/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Motivo de la anulación *'), { target: { value: 'Cobro duplicado' } });
    fireEvent.click(screen.getAllByRole('button', { name: /Anular cobro/ }).at(-1));
    await waitFor(() => expect(voidCharge).toHaveBeenCalledWith(9, 'Cobro duplicado'));
    expect(onDone).toHaveBeenCalled();
  });
});
