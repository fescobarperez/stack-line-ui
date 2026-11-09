import { describe, expect, it } from 'vitest';
import {
  ageFrom, clientPayload, clinicalAlerts, clinicalPayload, clinicalToForm, consentSignedAt, emptyClinical,
  emptyForm, formFromDetail, hasPerm, normalizeDetail, patientPayload, prefillFromSearch, validateForm,
} from './patients.js';
import { PRESETS, PERM_IDS, aplicarPreset, canView } from './permissions.js';
import { screenEnabled } from './modules.js';

const HOY = '2026-10-30';

const conDatos = (patient = {}, client = {}) => {
  const f = emptyForm({ client: { name: 'Ana López', ...client } });
  return { ...f, patient: { ...f.patient, ...patient } };
};
const llaves = (errs) => errs.map((e) => e.key);

describe('pacientes · edad', () => {
  it('cuenta años cumplidos', () => {
    expect(ageFrom('2008-10-31', HOY)).toBe(17);
    expect(ageFrom('2008-10-30', HOY)).toBe(18);
    expect(ageFrom('', HOY)).toBeNull();
  });
});

describe('pacientes · validación', () => {
  it('un formulario mínimo es válido', () => {
    expect(validateForm(conDatos(), HOY)).toEqual([]);
  });

  it('pide nombre y un DPI de 13 dígitos', () => {
    expect(llaves(validateForm(conDatos({}, { name: ' ' }), HOY))).toContain('name');
    expect(llaves(validateForm(conDatos({ docType: 'DPI', docNumber: '1234' }), HOY))).toContain('dpi');
    expect(validateForm(conDatos({ docType: 'DPI', docNumber: '1234 56789 0101' }), HOY)).toEqual([]);
    expect(llaves(validateForm(conDatos({ docNumber: 'X1' }), HOY))).toContain('docType');
  });

  it('un menor necesita tutor legal y solo hay un pagador', () => {
    const menor = { birthDate: '2015-01-01' };
    const errs = validateForm(conDatos(menor), HOY);
    expect(llaves(errs)).toContain('minorGuardian');
    expect(errs.find((e) => e.key === 'minorGuardian').tab).toBe('guardians');

    const tutor = { clientId: 5, relationship: 'Madre', legalGuardian: true, payer: true };
    expect(validateForm(conDatos({ ...menor, guardians: [tutor] }), HOY)).toEqual([]);

    const dosPagadores = [tutor, { clientId: 6, relationship: 'Padre', legalGuardian: false, payer: true }];
    expect(llaves(validateForm(conDatos({ guardians: dosPagadores }), HOY))).toContain('onePayer');
  });

  it('no deja un responsable sin cliente ni un contacto a medias', () => {
    const vacio = { clientId: null, relationship: '', legalGuardian: true, payer: false };
    expect(llaves(validateForm(conDatos({ guardians: [vacio] }), HOY))).toContain('guardianPick');
    const contacto = { name: 'Luis', relationship: '', phone: '' };
    expect(llaves(validateForm(conDatos({ emergencyContacts: [contacto] }), HOY))).toContain('contact');
  });

  it('no acepta fecha de nacimiento futura', () => {
    expect(llaves(validateForm(conDatos({ birthDate: '2026-11-01' }), HOY))).toContain('birthFuture');
  });
});

describe('pacientes · cuerpos para la API', () => {
  it('conserva los datos del cliente que la ficha no muestra', () => {
    // ClientService reemplaza el cliente completo: sin esto, editar al
    // paciente dejaría su crédito y saldo inicial en cero.
    const detail = {
      client: { id: 9, name: 'Ana', nit: '123', clientType: 'mayorista', creditLimit: 500, paymentTerms: 30, openingBalance: 75.5, status: 'active' },
      patient: { recordNumber: 'EXP-000001', reminderChannel: 'sms', acceptsMessages: true },
      guardians: [], emergencyContacts: [], consents: [],
    };
    const body = clientPayload(formFromDetail(detail).client);
    expect(body).toMatchObject({ clientType: 'mayorista', creditLimit: 500, paymentTerms: 30, openingBalance: 75.5 });
  });

  it('manda null en lo vacío y descarta filas sin datos', () => {
    const f = conDatos({
      docType: 'DPI', docNumber: '1234567890101', primaryProfessionalId: '',
      emergencyContacts: [{ name: '', relationship: '', phone: '' }, { name: 'Luis', relationship: '', phone: '5555' }],
      guardians: [{ clientId: 3, name: 'Eva', relationship: ' Madre ', legalGuardian: true, payer: false }],
    });
    const p = patientPayload(f.patient);
    expect(p.preferredName).toBeNull();
    expect(p.primaryProfessionalId).toBeNull();
    expect(p.emergencyContacts).toEqual([{ name: 'Luis', relationship: null, phone: '5555' }]);
    expect(p.guardians).toEqual([{ clientId: 3, relationship: 'Madre', legalGuardian: true, payer: false }]);
  });

  it('los datos clínicos van y vuelven sin perder filas', () => {
    const c = { ...emptyClinical(), bloodType: 'O+', allergies: [{ kind: 'medicamento', allergen: 'Penicilina', reaction: '', severity: 'severa', notes: '' }, { kind: 'otro', allergen: ' ', reaction: '', severity: '', notes: '' }] };
    const body = clinicalPayload(c);
    expect(body.bloodType).toBe('O+');
    expect(body.religion).toBeNull();
    expect(body.allergies).toEqual([{ kind: 'medicamento', allergen: 'Penicilina', reaction: null, severity: 'severa', notes: null }]);
    expect(clinicalToForm(body).allergies[0].reaction).toBe('');
  });

  it('las alergias y alertas saltan a la vista', () => {
    const alertas = clinicalAlerts({ alerts: 'Marcapasos', allergies: [{ allergen: 'Látex', severity: 'severa' }, { allergen: 'Polen', severity: 'leve' }] });
    expect(alertas.map((a) => a.kind)).toEqual(['alert', 'severe', 'allergy']);
    expect(clinicalAlerts(null)).toEqual([]);
  });

  it('lo buscado se aprovecha en el alta', () => {
    expect(prefillFromSearch('1234 56789 0101')).toEqual({ patient: { docType: 'DPI', docNumber: '1234567890101' } });
    expect(prefillFromSearch('+502 3006-3310')).toEqual({ client: { phone: '+502 3006-3310' } });
    expect(prefillFromSearch(' Ana López ')).toEqual({ client: { name: 'Ana López' } });
  });

  it('la fecha de firma de hoy la pone el servidor', () => {
    expect(consentSignedAt(HOY, HOY)).toBeNull();
    expect(consentSignedAt('2026-10-01', HOY)).toBe('2026-10-01T12:00:00-06:00');
  });
});

describe('pacientes · permisos y plan', () => {
  it('lee permisos con el mismo formato que los roles', () => {
    expect(hasPerm(['*'], 'clinical_record', 'ver')).toBe(true);
    expect(hasPerm(['patients|ver'], 'patients', 'ver')).toBe(true);
    expect(hasPerm(['patients|ver'], 'clinical_record', 'ver')).toBe(false);
  });

  it('la pantalla solo existe con el módulo salud', () => {
    expect(screenEnabled('patients', ['base'])).toBe(false);
    expect(screenEnabled('patients', ['base', 'salud'])).toBe(true);
    expect(canView('patients', ['patients|ver'])).toBe(true);
    expect(canView('patients', ['clients|ver'])).toBe(false);
  });

  it('ningún preset genérico abre el expediente clínico', () => {
    expect(PERM_IDS).toContain('clinical_record');
    for (const id of ['gerente', 'lectura']) {
      const m = aplicarPreset(PRESETS.find((p) => p.id === id));
      expect(m.clinical_record.ver).toBe(false);
    }
    const profesional = aplicarPreset(PRESETS.find((p) => p.id === 'profesional_salud'));
    expect(profesional.clinical_record.editar).toBe(true);
    expect(profesional.patients.ver).toBe(true);
    expect(profesional.patients.crear).toBe(false);
  });
});

describe('pacientes · expediente del backend', () => {
  it('repone las listas que Serde omite cuando vienen vacías', () => {
    const d = normalizeDetail({ client: { id: 1 }, patient: { id: 1 }, clinical: { bloodType: 'O+' } });
    expect(d.guardians).toEqual([]);
    expect(d.emergencyContacts).toEqual([]);
    expect(d.consents).toEqual([]);
    expect(d.patient.specialtyData).toEqual({});
    expect(d.clinical.allergies).toEqual([]);
    expect(d.clinical.vaccines).toEqual([]);
    expect(normalizeDetail({ client: {}, patient: {}, clinical: null }).clinical).toBeNull();
    expect(normalizeDetail(null)).toBeNull();
  });

  it('respeta las listas que sí vienen', () => {
    const g = [{ clientId: 3 }];
    expect(normalizeDetail({ guardians: g, patient: {} }).guardians).toBe(g);
  });
});
