import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '../../i18n/index.js';
import i18n from 'i18next';
import { ConfirmProvider } from '../ConfirmDialog.jsx';

vi.mock('../../api/salud.js', () => ({
  getEncounter: vi.fn(), saveEncounter: vi.fn(), signEncounter: vi.fn(), addAddendum: vi.fn(),
  getPrescriptionPdf: vi.fn(), listAppointmentTypes: vi.fn(), searchCie10: vi.fn(),
}));

import { addAddendum, getEncounter, saveEncounter, searchCie10, signEncounter } from '../../api/salud.js';
import EncounterEditor from './EncounterEditor.jsx';

const BORRADOR = {
  id: 7, patientId: 15, patientName: 'Ana López', recordNumber: 'EXP-000015', patientAge: 34, patientSex: 'F',
  appointmentId: 3, professionalId: 4, professionalName: 'Dra. Ruiz', caseId: null, caseTitle: null, newCaseTitle: null,
  status: 'borrador', subjective: 'Dolor de cabeza', vitals: {}, diagnoses: [], prescriptions: [], addenda: [],
  createdAt: '2026-11-03T15:00:00Z', canEdit: true, openCases: [], allergies: ['Penicilina (severa)'],
};
const TIPOS = [{ id: 2, name: 'Control', durationMinutes: 20, active: true }];

const montar = (props = {}) => render(
  <ConfirmProvider>
    <EncounterEditor encounterId={7} types={TIPOS} onClose={vi.fn()} pushToast={vi.fn()} {...props} />
  </ConfirmProvider>,
);

describe('EncounterEditor', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('es');
    getEncounter.mockResolvedValue(BORRADOR);
    searchCie10.mockResolvedValue([{ code: 'G43.9', description: 'Migraña, no especificada' }]);
  });

  it('avisa las alergias del paciente al abrir la consulta', async () => {
    montar();
    expect(await screen.findByRole('alert')).toHaveTextContent('Penicilina (severa)');
    expect(screen.getByLabelText('Motivo de consulta *')).toHaveValue('Dolor de cabeza');
  });

  it('no firma si falta el diagnóstico o el caso, y dice qué falta', async () => {
    montar();
    fireEvent.click(await screen.findByRole('button', { name: /^Firmar$/ }));
    const avisos = await screen.findAllByRole('alert');
    expect(avisos.at(-1)).toHaveTextContent('Agrega un diagnóstico');
    expect(avisos.at(-1)).toHaveTextContent('Indica a qué caso');
    expect(signEncounter).not.toHaveBeenCalled();
  });

  it('con diagnóstico CIE-10, caso nuevo, receta y control se firma', async () => {
    signEncounter.mockResolvedValue({ ...BORRADOR, status: 'firmada', canEdit: false, caseId: 9, caseTitle: 'Migraña', signedAt: '2026-11-03T16:00:00Z' });
    montar();
    await screen.findByLabelText('Motivo de consulta *');
    fireEvent.change(screen.getByLabelText(/Buscar diagnóstico CIE-10/), { target: { value: 'migra' } });
    fireEvent.click(await screen.findByRole('button', { name: /G43.9/ }));
    expect(screen.getByText('Principal')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Nombre del caso'), { target: { value: 'Migraña' } });
    fireEvent.change(screen.getByLabelText('Temperatura'), { target: { value: '36,8' } });
    fireEvent.click(screen.getByRole('radio', { name: '7' }));
    fireEvent.click(screen.getByRole('button', { name: /Agregar medicamento/ }));
    fireEvent.change(screen.getByLabelText('Medicamento y presentación'), { target: { value: 'Ibuprofeno 400 mg' } });
    fireEvent.click(screen.getByLabelText('Programar control'));
    fireEvent.click(screen.getByRole('button', { name: '15 días' }));

    fireEvent.click(screen.getByRole('button', { name: /^Firmar$/ }));
    const dialogo = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Firmar' }));

    await waitFor(() => expect(signEncounter).toHaveBeenCalledTimes(1));
    const [id, body] = signEncounter.mock.calls[0];
    expect(id).toBe(7);
    expect(body).toMatchObject({
      caseId: null, newCaseTitle: 'Migraña', subjective: 'Dolor de cabeza',
      diagnoses: [{ code: 'G43.9', description: 'Migraña, no especificada', primary: true }],
      prescriptions: [{ medication: 'Ibuprofeno 400 mg', route: 'oral' }],
      followUpDays: 15,
    });
    expect(body.vitals).toMatchObject({ temperature: 36.8, painScore: 7 });
    expect(await screen.findByText('Firmada')).toBeInTheDocument();
  });

  it('guarda el borrador solo cuando hay cambios', async () => {
    saveEncounter.mockResolvedValue({ ...BORRADOR, objective: 'Sin hallazgos' });
    montar();
    const guardar = await screen.findByRole('button', { name: 'Guardar borrador' });
    expect(guardar).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Examen físico'), { target: { value: 'Sin hallazgos' } });
    fireEvent.click(guardar);
    await waitFor(() => expect(saveEncounter).toHaveBeenCalledWith(7, expect.objectContaining({ objective: 'Sin hallazgos' })));
  });

  it('firmada es de solo lectura y admite adendas', async () => {
    const firmada = {
      ...BORRADOR, status: 'firmada', canEdit: false, caseId: 9, caseTitle: 'Migraña', signedAt: '2026-11-03T16:00:00Z',
      prescriptions: [{ medication: 'Ibuprofeno 400 mg', dose: '1 tableta', durationDays: 5 }],
      previous: { id: 5, status: 'firmada', signedAt: '2026-10-20T16:00:00Z', professionalName: 'Dra. Ruiz', dxCode: 'G43.9', dxDescription: 'Migraña', rxCount: 1, vitals: { painScore: 7 } },
    };
    getEncounter.mockResolvedValue(firmada);
    addAddendum.mockResolvedValue({ ...firmada, addenda: [{ id: 1, text: 'Corrige dosis', createdAt: '2026-11-04T10:00:00Z', authorName: 'Dra. Ruiz' }] });
    montar();
    expect(await screen.findByRole('button', { name: /Receta PDF/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Firmar$/ })).toBeNull();
    expect(screen.queryByLabelText('Motivo de consulta *')).toBeNull();
    expect(screen.getByText('Consulta anterior')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Nueva adenda'), { target: { value: 'Corrige dosis' } });
    fireEvent.click(screen.getByRole('button', { name: /Agregar adenda/ }));
    await waitFor(() => expect(addAddendum).toHaveBeenCalledWith(7, 'Corrige dosis'));
    expect(await screen.findByText('Corrige dosis')).toBeInTheDocument();
  });
});
