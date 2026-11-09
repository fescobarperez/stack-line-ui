import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import '../../i18n/index.js';
import i18n from 'i18next';
import { ConfirmProvider } from '../ConfirmDialog.jsx';

vi.mock('../../api/salud.js', () => ({
  getClinicalHistory: vi.fn(), closeCase: vi.fn(), reopenCase: vi.fn(), cancelFollowUp: vi.fn(),
  getEncounter: vi.fn(), listAppointmentTypes: vi.fn(), searchCie10: vi.fn(),
  listPlans: vi.fn(), createPlan: vi.fn(), cancelPlan: vi.fn(), listProfessionals: vi.fn(),
}));

import {
  cancelFollowUp, closeCase, createPlan, getClinicalHistory, listAppointmentTypes, listPlans, listProfessionals,
} from '../../api/salud.js';
import ClinicalHistory from './ClinicalHistory.jsx';

const HISTORIA = {
  cases: [{
    id: 9, title: 'Migraña', status: 'abierto', openedAt: '2026-10-20T16:00:00Z',
    encounters: [
      { id: 8, status: 'firmada', signedAt: '2026-11-03T16:00:00Z', createdAt: '2026-11-03T15:00:00Z', professionalName: 'Dra. Ruiz', dxCode: 'G43.9', dxDescription: 'Migraña', response: 'mejoro', rxCount: 1, vitals: { painScore: 3 } },
      { id: 5, status: 'firmada', signedAt: '2026-10-20T16:00:00Z', createdAt: '2026-10-20T15:00:00Z', professionalName: 'Dra. Ruiz', dxCode: 'G43.9', dxDescription: 'Migraña', rxCount: 2, vitals: { painScore: 7 } },
    ],
    followUps: [{ id: 4, caseId: 9, dueOn: '2026-10-30', typeId: 2, professionalId: 4, status: 'pendiente', daysLeft: -2, notes: 'Ver dolor' }],
  }],
};

let destino = null;
function Agenda() { destino = useLocation().state; return <div>agenda</div>; }

const montar = () => render(
  <MemoryRouter initialEntries={['/patients']}>
    <ConfirmProvider>
      <Routes>
        <Route path="/patients" element={<ClinicalHistory canEdit canSchedule pushToast={vi.fn()}
          patient={{ id: 15, name: 'Ana López', recordNumber: 'EXP-000015', phone: '5555-1234' }} />} />
        <Route path="/agenda" element={<Agenda />} />
      </Routes>
    </ConfirmProvider>
  </MemoryRouter>,
);

describe('ClinicalHistory', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    destino = null;
    await i18n.changeLanguage('es');
    getClinicalHistory.mockResolvedValue(HISTORIA);
    listPlans.mockResolvedValue([]);
    listAppointmentTypes.mockResolvedValue([{ id: 3, name: 'Fisioterapia', active: true }]);
    listProfessionals.mockResolvedValue([{ userId: 4, name: 'Dra. Ruiz', configured: true, active: true }]);
  });

  it('muestra el caso con sus consultas, la evolución del dolor y el control vencido', async () => {
    montar();
    expect(await screen.findByText('Migraña', { selector: 'h4' })).toBeInTheDocument();
    expect(screen.getByText(/dolor 7 → 3/)).toBeInTheDocument();
    expect(screen.getByText('Mejoró')).toBeInTheDocument();
    expect(screen.getByText(/Venció hace 2 días/)).toBeInTheDocument();
  });

  it('agendar el control lleva a la agenda con el paciente y el control', async () => {
    montar();
    fireEvent.click(await screen.findByRole('button', { name: /Agendar/ }));
    expect(await screen.findByText('agenda')).toBeInTheDocument();
    expect(destino.newForPatient).toMatchObject({ id: 15, name: 'Ana López' });
    expect(destino.followUp).toMatchObject({ id: 4, caseTitle: 'Migraña', typeId: 2, professionalId: 4 });
  });

  it('indica un plan de tratamiento en el caso y agenda su siguiente sesión', async () => {
    createPlan.mockResolvedValue({ id: 3 });
    montar();
    fireEvent.click(await screen.findByRole('button', { name: /Indicar plan de tratamiento/ }));
    fireEvent.change(screen.getByLabelText('Plan *'), { target: { value: 'Fisioterapia lumbar' } });
    const tipo = screen.getByLabelText('Tipo de cita *');
    fireEvent.focus(tipo);
    fireEvent.mouseDown(await screen.findByRole('option', { name: 'Fisioterapia' }));
    fireEvent.click(screen.getByRole('button', { name: /Indicar plan$/ }));
    await waitFor(() => expect(createPlan).toHaveBeenCalledWith(9, {
      title: 'Fisioterapia lumbar', typeId: 3, professionalId: null, sessions: 10, intervalDays: 7, notes: null,
    }));
  });

  it('el plan muestra su avance y agenda la sesión sugerida', async () => {
    listPlans.mockResolvedValue([{ id: 3, caseId: 9, title: 'Fisioterapia lumbar', typeId: 3, typeName: 'Fisioterapia',
      professionalId: 4, professionalName: 'Dra. Ruiz', sessions: 10, done: 3, scheduled: 1, remaining: 6, intervalDays: 3,
      status: 'activo', nextDate: '2026-11-20' }]);
    montar();
    expect(await screen.findByText('3 de 10 sesiones atendidas · 1 agendada(s)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Agendar sesión/ }));
    expect(await screen.findByText('agenda')).toBeInTheDocument();
    expect(destino.plan).toMatchObject({ id: 3, typeId: 3, professionalId: 4, date: '2026-11-20' });
  });

  it('cancelar el control y cerrar el caso van al backend', async () => {
    cancelFollowUp.mockResolvedValue({});
    closeCase.mockResolvedValue({});
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(cancelFollowUp).toHaveBeenCalledWith(4));
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar caso' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cerrar caso' }));
    await waitFor(() => expect(closeCase).toHaveBeenCalledWith(9, null));
  });

  it('sin consultas explica dónde se abren', async () => {
    getClinicalHistory.mockResolvedValue({});
    montar();
    expect(await screen.findByText(/se abre desde la cita en la agenda/)).toBeInTheDocument();
  });
});
