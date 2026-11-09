import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../i18n/index.js';
import i18n from 'i18next';
import { ConfirmProvider } from '../components/ConfirmDialog.jsx';

vi.mock('../api/salud.js', () => ({
  listProfessionals: vi.fn(), listResources: vi.fn(), listAppointmentTypes: vi.fn(), listAppointments: vi.fn(),
  listBlocks: vi.fn(), deleteBlock: vi.fn(), createAppointment: vi.fn(), getAvailability: vi.fn(),
  changeAppointmentStatus: vi.fn(), rescheduleAppointment: vi.fn(), updateAppointmentNotes: vi.fn(), createBlock: vi.fn(),
  listPatients: vi.fn(), saveProfessional: vi.fn(), saveSchedule: vi.fn(), createResource: vi.fn(), updateResource: vi.fn(),
  createAppointmentType: vi.fn(), updateAppointmentType: vi.fn(), getSaludSettings: vi.fn(), saveSaludSettings: vi.fn(),
  openEncounter: vi.fn(), getEncounter: vi.fn(), searchCie10: vi.fn(),
  listPlans: vi.fn(), listPackages: vi.fn(), createPackage: vi.fn(), updatePackage: vi.fn(), getAppointment: vi.fn(),
  getChargeOptions: vi.fn(), chargeAppointment: vi.fn(), voidCharge: vi.fn(),
}));
vi.mock('../api/auth.js', () => ({ sessionUser: vi.fn() }));
vi.mock('../hooks/useLayout.js', () => ({ useLayout: () => 'desktop', useMediaQuery: () => true }));

import {
  listProfessionals, listResources, listAppointmentTypes, listAppointments, listBlocks, getAvailability,
  changeAppointmentStatus, createAppointment, getSaludSettings, saveSaludSettings, openEncounter,
  listPlans, listPackages, getChargeOptions, chargeAppointment, getAppointment,
} from '../api/salud.js';
import { sessionUser } from '../api/auth.js';
import { todayGt, toInstant } from '../lib/agenda.js';
import Agenda from './Agenda.jsx';

const HOY = todayGt();
const PROF = { userId: 4, name: 'Dra. Ruiz', configured: true, active: true, specialty: 'Odontología', color: '#1E88E5',
  schedule: [1, 2, 3, 4, 5, 6, 7].map((d) => ({ weekday: d, start: '08:00:00', end: '12:00:00', resourceId: null })) };
const CITA = {
  id: 50, patientId: 7, patientName: 'Ana López', recordNumber: 'EXP-000007', patientPhone: '5555-1234',
  professionalId: 4, professionalName: 'Dra. Ruiz', typeId: 1, typeName: 'Consulta', typeColor: '#43A047',
  resourceId: null, resourceName: null, startsAt: toInstant(HOY, '09:00'), endsAt: toInstant(HOY, '09:30'),
  status: 'confirmada', source: 'recepcion', nextStatuses: ['en_sala', 'cancelada', 'no_asistio'],
};

const montar = () => render(
  <MemoryRouter initialEntries={['/agenda']}>
    <ConfirmProvider><Agenda pushToast={vi.fn()} /></ConfirmProvider>
  </MemoryRouter>,
);

describe('Agenda', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('es');
    sessionUser.mockReturnValue({ perms: ['*'] });
    listProfessionals.mockResolvedValue([PROF, { userId: 9, name: 'Recepción', configured: false, active: false, schedule: [] }]);
    listResources.mockResolvedValue([]);
    listAppointmentTypes.mockResolvedValue([{ id: 1, name: 'Consulta', durationMinutes: 30, active: true, requiresResource: false }]);
    listAppointments.mockResolvedValue([CITA]);
    listBlocks.mockResolvedValue([]);
    getSaludSettings.mockResolvedValue({ remindersEnabled: true, reminderHours: 24 });
    getAvailability.mockResolvedValue({ slots: [{ startsAt: toInstant(HOY, '10:00'), endsAt: toInstant(HOY, '10:30'), resourceId: null }] });
    listPlans.mockResolvedValue([]);
    listPackages.mockResolvedValue([]);
  });

  it('pinta la columna del profesional con su cita y abre el detalle', async () => {
    montar();
    fireEvent.click(await screen.findByRole('radio', { name: 'Día' }));
    expect(await screen.findByText('Dra. Ruiz', { selector: '.ag-head-label' })).toBeInTheDocument();
    fireEvent.click(await screen.findByText('Ana López'));
    expect(await screen.findByRole('button', { name: /Llegó/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reprogramar/ })).toBeInTheDocument();
  });

  it('una cita atendida sin cobro se cobra desde el detalle', async () => {
    listAppointments.mockResolvedValue([{ ...CITA, status: 'completada', nextStatuses: [], price: 200 }]);
    getChargeOptions.mockResolvedValue({ appointmentId: 50, appointmentStatus: 'completada', patientId: 7, patientName: 'Ana López',
      typeId: 1, typeName: 'Consulta', price: 200, creditBalance: 0, packages: [], cashRegisterOpen: true });
    chargeAppointment.mockResolvedValue({ id: 1 });
    getAppointment.mockResolvedValue({ ...CITA, status: 'completada', nextStatuses: [], chargeId: 1, chargeMethod: 'venta', chargeTotal: 200 });
    montar();
    expect(await screen.findByText('Por cobrar')).toBeInTheDocument();
    fireEvent.click(await screen.findByText('Ana López'));
    expect(await screen.findByText('Pendiente de cobro')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cobrar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cobrar Q 200.00' }));
    await waitFor(() => expect(chargeAppointment).toHaveBeenCalledWith(50, expect.objectContaining({ price: 200, paymentMethod: 'efectivo' })));
    expect(await screen.findByText('Cobrada')).toBeInTheDocument();
  });

  it('marcar la llegada manda el estado al backend', async () => {
    changeAppointmentStatus.mockResolvedValue({ ...CITA, status: 'en_sala', nextStatuses: ['en_atencion', 'cancelada'] });
    montar();
    fireEvent.click(await screen.findByText('Ana López'));
    fireEvent.click(await screen.findByRole('button', { name: /Llegó/ }));
    await waitFor(() => expect(changeAppointmentStatus).toHaveBeenCalledWith(50, 'en_sala'));
    expect(await screen.findByRole('button', { name: /Pasar a atención/ })).toBeInTheDocument();
  });

  it('cancelar pide el motivo', async () => {
    montar();
    fireEvent.click(await screen.findByText('Ana López'));
    fireEvent.click(await screen.findByRole('button', { name: /Cancelar cita/ }));
    const enviar = screen.getAllByRole('button', { name: /Cancelar cita/ }).at(-1);
    expect(enviar).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Motivo de la cancelación *'), { target: { value: 'Viaje' } });
    fireEvent.click(enviar);
    await waitFor(() => expect(changeAppointmentStatus).toHaveBeenCalledWith(50, 'cancelada', 'Viaje'));
  });

  it('una cita nueva toma el horario libre y se agenda confirmada', async () => {
    createAppointment.mockResolvedValue(CITA);
    const { listPatients } = await import('../api/salud.js');
    listPatients.mockResolvedValue({ content: [{ id: 7, name: 'Ana López', recordNumber: 'EXP-000007' }], totalSize: 1 });
    montar();
    fireEvent.click(await screen.findByRole('button', { name: /Nueva cita/ }));
    fireEvent.change(screen.getByLabelText(/Buscar paciente/), { target: { value: 'Ana' } });
    // el resultado del buscador (lleva el expediente; la cita del calendario no)
    fireEvent.click(await screen.findByRole('button', { name: /Ana López EXP-000007/ }));
    // elegir profesional: el Autocomplete tiene el nombre accesible del campo
    const prof = screen.getAllByLabelText('Profesional *').at(-1);
    fireEvent.focus(prof);
    fireEvent.click(prof);
    fireEvent.mouseDown(await screen.findByRole('option', { name: /Dra. Ruiz · Odontología/ }));
    fireEvent.click(await screen.findByRole('option', { name: '10:00' }));
    fireEvent.click(screen.getByRole('button', { name: /^Agendar$/ }));
    await waitFor(() => expect(createAppointment).toHaveBeenCalledTimes(1));
    expect(createAppointment.mock.calls[0][0]).toMatchObject({
      patientId: 7, professionalId: 4, typeId: 1, startsAt: toInstant(HOY, '10:00'), status: 'confirmada',
    });
  });

  it('sin permiso de configuración no aparece la pestaña', async () => {
    sessionUser.mockReturnValue({ perms: ['agenda|ver', 'agenda|crear', 'agenda|editar'] });
    montar();
    await screen.findByText('Ana López');
    expect(screen.queryByRole('button', { name: 'Configuración' })).toBeNull();
  });

  it('el detalle dice si el recordatorio ya salió', async () => {
    listAppointments.mockResolvedValue([{ ...CITA, reminderStatus: 'enviado', reminderSentAt: toInstant(HOY, '07:00') }]);
    montar();
    fireEvent.click(await screen.findByText('Ana López'));
    expect(await screen.findByText('Enviado')).toBeInTheDocument();
  });

  it('si el recordatorio falló sugiere llamar al paciente', async () => {
    listAppointments.mockResolvedValue([{ ...CITA, reminderStatus: 'fallido' }]);
    montar();
    fireEvent.click(await screen.findByText('Ana López'));
    expect(await screen.findByText(/Conviene llamar al paciente/)).toBeInTheDocument();
  });

  it('en Configuración se apagan los recordatorios', async () => {
    saveSaludSettings.mockResolvedValue({ remindersEnabled: false, reminderHours: 24 });
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Configuración' }));
    const check = await screen.findByLabelText('Enviar recordatorio antes de cada cita');
    expect(check).toBeChecked();
    expect(screen.queryByRole('button', { name: /Guardar/ })).toBeNull();
    fireEvent.click(check);
    fireEvent.click(screen.getByRole('button', { name: /Guardar/ }));
    await waitFor(() => expect(saveSaludSettings).toHaveBeenCalledWith({
      remindersEnabled: false, reminderHours: 24, controlRemindersEnabled: true, controlReminderDays: 2,
    }));
  });

  it('abre en la vista de mes y el número del día lleva a ese día', async () => {
    montar();
    await screen.findByText('Ana López');
    expect(screen.getByRole('radio', { name: 'Mes' })).toHaveAttribute('aria-checked', 'true');
    const celda = await screen.findByRole('button', { name: `Ver el día ${HOY}` });
    expect(celda.closest('.ag-month-cell')).toHaveClass('is-today');
    expect(screen.getByText('Ana López').closest('.ag-month-appt')).toBeInTheDocument();
    fireEvent.click(celda);
    expect(await screen.findByText('Dra. Ruiz', { selector: '.ag-head-label' })).toBeInTheDocument();
  });

  it('con el paciente en sala, «Atender» abre la consulta', async () => {
    listAppointments.mockResolvedValue([{ ...CITA, status: 'en_sala', nextStatuses: ['en_atencion', 'cancelada'] }]);
    openEncounter.mockResolvedValue({
      id: 7, patientId: 7, patientName: 'Ana López', professionalId: 4, professionalName: 'Dra. Ruiz', status: 'borrador',
      subjective: null, vitals: {}, diagnoses: [], prescriptions: [], addenda: [], createdAt: CITA.startsAt,
      canEdit: true, openCases: [], allergies: [],
    });
    montar();
    fireEvent.click(await screen.findByText('Ana López'));
    fireEvent.click(await screen.findByRole('button', { name: /Atender/ }));
    await waitFor(() => expect(openEncounter).toHaveBeenCalledWith(50));
    expect(await screen.findByRole('dialog', { name: 'Consulta' })).toBeInTheDocument();
  });

  it('sin permiso clínico no se ofrece «Atender»', async () => {
    sessionUser.mockReturnValue({ perms: ['agenda|ver', 'agenda|editar'] });
    listAppointments.mockResolvedValue([{ ...CITA, status: 'en_sala', nextStatuses: ['en_atencion', 'cancelada'] }]);
    montar();
    fireEvent.click(await screen.findByText('Ana López'));
    await screen.findByRole('button', { name: /Reprogramar|Notas/ });
    expect(screen.queryByRole('button', { name: /Atender/ })).toBeNull();
  });

  it('al agendar un control la cita lleva el control y avisa el caso', async () => {
    createAppointment.mockResolvedValue(CITA);
    render(
      <MemoryRouter initialEntries={[{ pathname: '/agenda', state: {
        newForPatient: { id: 7, name: 'Ana López', recordNumber: 'EXP-000007' },
        followUp: { id: 4, caseTitle: 'Migraña', typeId: 1, professionalId: 4, date: HOY },
      } }]}>
        <ConfirmProvider><Agenda pushToast={vi.fn()} /></ConfirmProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText(/Control del caso «Migraña»/)).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('option', { name: '10:00' }));
    fireEvent.click(screen.getByRole('button', { name: /^Agendar$/ }));
    await waitFor(() => expect(createAppointment).toHaveBeenCalledTimes(1));
    expect(createAppointment.mock.calls[0][0]).toMatchObject({ patientId: 7, professionalId: 4, typeId: 1, followUpId: 4 });
  });
});
