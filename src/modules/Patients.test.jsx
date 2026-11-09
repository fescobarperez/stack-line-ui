import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../i18n/index.js';
import i18n from 'i18next';
import { ConfirmProvider } from '../components/ConfirmDialog.jsx';

vi.mock('../api/salud.js', () => ({
  listPatients: vi.fn(), findCandidates: vi.fn(), getPatient: vi.fn(), createPatient: vi.fn(),
  createPatientFromClient: vi.fn(), updatePatient: vi.fn(), updateClinical: vi.fn(),
  changePatientStatus: vi.fn(), addConsent: vi.fn(), revokeConsent: vi.fn(), getAccessLog: vi.fn(),
  listAppointments: vi.fn(),
}));
vi.mock('../api/partners.js', () => ({ getClient: vi.fn(), listClients: vi.fn(), createClient: vi.fn() }));
vi.mock('../hooks/useMasters.js', () => ({ useUsers: () => ({ items: [{ id: 4, name: 'Dra. Ruiz', status: 'active' }] }) }));
vi.mock('../api/auth.js', () => ({ sessionUser: vi.fn() }));

import { listPatients, findCandidates, getPatient, createPatient } from '../api/salud.js';
import { sessionUser } from '../api/auth.js';
import Patients from './Patients.jsx';

const DETALLE = {
  client: { id: 7, name: 'Ana López', nit: 'CF', phone: '5555-1234', email: null, address: null,
    clientType: 'CF', creditLimit: 0, paymentTerms: 0, openingBalance: 0, status: 'active' },
  patient: { id: 7, recordNumber: 'EXP-000007', docType: 'DPI', docNumber: '1234567890101', birthDate: '2015-02-01',
    age: 11, sex: 'F', status: 'activo', reminderChannel: 'whatsapp', acceptsMessages: true, specialtyData: {},
    createdAt: '2026-10-30T15:00:00Z' },
  guardians: [{ clientId: 3, name: 'Eva López', nit: 'CF', phone: null, relationship: 'Madre', legalGuardian: true, payer: true }],
  emergencyContacts: [], consents: [],
  clinicalVisible: true,
  clinical: { bloodType: 'O+', alerts: 'Asma', allergies: [{ kind: 'medicamento', allergen: 'Penicilina', reaction: null, severity: 'severa', notes: null }],
    history: [], medications: [], vaccines: [] },
  clinicalUpdatedAt: null,
};

const montar = () => render(
  <MemoryRouter initialEntries={['/patients']}>
    <ConfirmProvider><Patients pushToast={vi.fn()} /></ConfirmProvider>
  </MemoryRouter>,
);

describe('Pacientes', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('es');
    sessionUser.mockReturnValue({ perms: ['*'] });
    listPatients.mockResolvedValue({ content: [{ id: 7, recordNumber: 'EXP-000007', name: 'Ana López', docType: 'DPI',
      docNumber: '1234567890101', age: 11, status: 'activo' }], totalSize: 1 });
    getPatient.mockResolvedValue(DETALLE);
  });

  it('lista y abre el expediente con sus alertas clínicas', async () => {
    montar();
    fireEvent.click(await screen.findByText('Ana López'));
    expect(await screen.findByText('EXP-000007')).toBeInTheDocument();
    expect(screen.getByText(/Alergia: Penicilina/)).toBeInTheDocument();
    expect(screen.getByText('Menor de edad')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Datos clínicos/ }));
    expect(await screen.findByText('O+')).toBeInTheDocument();
  });

  it('abre el expediente aunque el backend omita las listas vacías', async () => {
    // Micronaut Serde no manda las listas vacías: llegan sin guardians, consents…
    const sinListas = { ...DETALLE, clinical: { bloodType: 'O+' } };
    ['guardians', 'emergencyContacts', 'consents'].forEach((k) => delete sinListas[k]);
    getPatient.mockResolvedValue(sinListas);
    montar();
    fireEvent.click(await screen.findByText('Ana López'));
    expect(await screen.findByText('EXP-000007')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Responsables/ }));
    expect(await screen.findByText(/Sin responsables/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Datos clínicos/ }));
    expect(await screen.findByText('O+')).toBeInTheDocument();
  });

  it('recepción no ve la pestaña clínica ni la bitácora', async () => {
    sessionUser.mockReturnValue({ perms: ['patients|ver', 'patients|crear'] });
    getPatient.mockResolvedValue({ ...DETALLE, clinicalVisible: false, clinical: null });
    montar();
    fireEvent.click(await screen.findByText('Ana López'));
    await screen.findByText('EXP-000007');
    expect(screen.queryByRole('button', { name: /Datos clínicos/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Bitácora/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Editar/ })).toBeNull();
  });

  it('busca antes de crear y ofrece abrir al que ya es paciente', async () => {
    findCandidates.mockResolvedValue([{ clientId: 7, name: 'Ana López', nit: 'CF', phone: null, patient: true, recordNumber: 'EXP-000007' }]);
    montar();
    fireEvent.click(await screen.findByRole('button', { name: /Nuevo paciente/ }));
    fireEvent.change(screen.getByLabelText('Nombre, teléfono, DPI o NIT…'), { target: { value: 'Ana' } });
    expect(await screen.findByRole('button', { name: /Abrir expediente/ })).toBeInTheDocument();
  });

  it('el alta nueva crea cliente y paciente en una llamada', async () => {
    findCandidates.mockResolvedValue([]);
    createPatient.mockResolvedValue(DETALLE);
    montar();
    fireEvent.click(await screen.findByRole('button', { name: /Nuevo paciente/ }));
    fireEvent.change(screen.getByLabelText('Nombre, teléfono, DPI o NIT…'), { target: { value: 'Luis Pérez' } });
    fireEvent.click(screen.getByRole('button', { name: /Registrar paciente nuevo/ }));
    expect(screen.getByLabelText('Nombre completo *')).toHaveValue('Luis Pérez');
    fireEvent.click(screen.getByRole('button', { name: /Registrar paciente$/ }));
    await waitFor(() => expect(createPatient).toHaveBeenCalledTimes(1));
    const body = createPatient.mock.calls[0][0];
    expect(body.client.name).toBe('Luis Pérez');
    expect(body.patient.reminderChannel).toBe('whatsapp');
    expect(body.clinical).toBeNull();
  });

  it('un DPI escrito en la búsqueda pasa al documento del alta', async () => {
    findCandidates.mockResolvedValue([]);
    montar();
    fireEvent.click(await screen.findByRole('button', { name: /Nuevo paciente/ }));
    fireEvent.change(screen.getByLabelText('Nombre, teléfono, DPI o NIT…'), { target: { value: '1234 56789 0101' } });
    fireEvent.click(screen.getByRole('button', { name: /Registrar paciente nuevo/ }));
    expect(screen.getByLabelText('Número de documento')).toHaveValue('1234567890101');
    fireEvent.change(screen.getByLabelText('Nombre completo *'), { target: { value: 'Niño' } });
    fireEvent.click(screen.getByRole('button', { name: /Registrar paciente$/ }));
    await waitFor(() => expect(createPatient).toHaveBeenCalledTimes(1));
    expect(createPatient.mock.calls[0][0].patient).toMatchObject({ docType: 'DPI', docNumber: '1234567890101' });
  });
});
