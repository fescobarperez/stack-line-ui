import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import '../i18n/index.js';
import i18n from 'i18next';

vi.mock('../api/salud.js', () => ({ listFollowUps: vi.fn(), listProfessionals: vi.fn(), saveFeedback: vi.fn() }));
vi.mock('../api/auth.js', () => ({ sessionUser: vi.fn() }));

import { listFollowUps, listProfessionals, saveFeedback } from '../api/salud.js';
import { sessionUser } from '../api/auth.js';
import SaludFollowUps from './SaludFollowUps.jsx';

let destino = null;
function Agenda() {
  destino = useLocation().state;
  return <div>agenda</div>;
}

const VENCIDO = {
  id: 9, patientId: 15, patientName: 'Ana López', recordNumber: 'EXP-000015', patientPhone: '5555-1234',
  professionalId: 4, professionalName: 'Dra. Ruiz', typeId: 3, typeName: 'Control', dueOn: '2026-10-30', daysLeft: -3,
  reminderStatus: 'enviado', answered: true, caseId: 2, caseTitle: 'Lumbalgia', feeling: 'peor',
};
const SEMANA = { ...VENCIDO, id: 10, patientId: 16, patientName: 'Luis Pérez', daysLeft: 2, answered: false, feeling: null, reminderStatus: null };

const montar = () => render(
  <MemoryRouter initialEntries={['/salud_followup']}>
    <Routes>
      <Route path="/salud_followup" element={<SaludFollowUps pushToast={vi.fn()} />} />
      <Route path="/agenda" element={<Agenda />} />
    </Routes>
  </MemoryRouter>,
);

describe('SaludFollowUps', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    destino = null;
    await i18n.changeLanguage('es');
    sessionUser.mockReturnValue({ perms: ['*'] });
    listProfessionals.mockResolvedValue([]);
    listFollowUps.mockResolvedValue([VENCIDO, SEMANA]);
    saveFeedback.mockResolvedValue({});
  });

  it('separa vencidos y de esta semana, y muestra lo que contestó el paciente', async () => {
    montar();
    expect(await screen.findByText('Ana López')).toBeInTheDocument();
    expect(screen.getByText('Venció hace 3 días')).toBeInTheDocument();
    expect(screen.getByText('Peor')).toBeInTheDocument();
    expect(screen.getAllByText('Lumbalgia').length).toBeGreaterThan(0);
    expect(listFollowUps).toHaveBeenCalledWith({ days: 30, professionalId: '' });
  });

  it('recepción sin permiso clínico no ve el caso ni la respuesta, solo que respondió', async () => {
    sessionUser.mockReturnValue({ perms: ['salud_followup|ver', 'agenda|ver', 'agenda|crear'] });
    listFollowUps.mockResolvedValue([{ ...VENCIDO, caseTitle: undefined, feeling: undefined }]);
    montar();
    expect(await screen.findByText('Respondió')).toBeInTheDocument();
    expect(screen.queryByText('Caso')).toBeNull();
  });

  it('agendar lleva a la agenda con el paciente y el control', async () => {
    montar();
    const fila = (await screen.findByText('Ana López')).closest('tr');
    fireEvent.click(within(fila).getByRole('button', { name: /Agendar/ }));
    await waitFor(() => expect(destino?.followUp?.id).toBe(9));
    expect(destino.newForPatient).toMatchObject({ id: 15, name: 'Ana López' });
    expect(destino.followUp).toMatchObject({ typeId: 3, professionalId: 4 });
  });

  it('recepción registra cómo sigue el paciente', async () => {
    montar();
    const fila = (await screen.findByText('Luis Pérez')).closest('tr');
    fireEvent.click(within(fila).getByTitle('Registrar cómo sigue'));
    fireEvent.click(screen.getByRole('radio', { name: 'Igual' }));
    fireEvent.change(screen.getByLabelText('Lo que contó el paciente'), { target: { value: 'Sigue con dolor al caminar' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar/ }));
    await waitFor(() => expect(saveFeedback).toHaveBeenCalledWith(10, { feeling: 'igual', note: 'Sigue con dolor al caminar' }));
  });
});
