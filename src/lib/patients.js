// Stackline Salud — reglas y transformaciones del paciente, sin React.
//
// Un paciente es un cliente: lo que es de Cliente (nombre, NIT, teléfono,
// correo, dirección) viaja en `client` con el formato de /api/clients y lo
// guarda ClientService; lo demás es del paciente. El backend repite estas
// validaciones: aquí están para avisar antes de enviar, no para protegerse.

/** Listas cerradas. `label` es el texto en español; la pantalla lo pasa por i18n. */
export const OPTIONS = {
  docType: [
    { id: 'DPI', label: 'DPI' },
    { id: 'PASAPORTE', label: 'Pasaporte' },
    { id: 'OTRO', label: 'Otro documento' },
  ],
  sex: [
    { id: 'F', label: 'Femenino' },
    { id: 'M', label: 'Masculino' },
    { id: 'I', label: 'Intersexual' },
  ],
  maritalStatus: [
    { id: 'soltero', label: 'Soltero(a)' },
    { id: 'casado', label: 'Casado(a)' },
    { id: 'unido', label: 'Unido(a)' },
    { id: 'divorciado', label: 'Divorciado(a)' },
    { id: 'viudo', label: 'Viudo(a)' },
  ],
  status: [
    { id: 'activo', label: 'Activo' },
    { id: 'inactivo', label: 'Inactivo' },
    { id: 'fallecido', label: 'Fallecido' },
  ],
  reminderChannel: [
    { id: 'whatsapp', label: 'WhatsApp' },
    { id: 'sms', label: 'SMS' },
    { id: 'email', label: 'Correo' },
    { id: 'ninguno', label: 'No enviar' },
  ],
  bloodType: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((id) => ({ id, label: id })),
  allergyKind: [
    { id: 'medicamento', label: 'Medicamento' },
    { id: 'alimento', label: 'Alimento' },
    { id: 'latex', label: 'Látex' },
    { id: 'ambiental', label: 'Ambiental' },
    { id: 'otro', label: 'Otro' },
  ],
  severity: [
    { id: 'leve', label: 'Leve' },
    { id: 'moderada', label: 'Moderada' },
    { id: 'severa', label: 'Severa' },
  ],
  historyKind: [
    { id: 'cronica', label: 'Enfermedad crónica' },
    { id: 'quirurgico', label: 'Cirugía' },
    { id: 'hospitalizacion', label: 'Hospitalización' },
    { id: 'traumatico', label: 'Traumatismo' },
    { id: 'familiar', label: 'Familiar' },
    { id: 'gineco_obstetrico', label: 'Gineco-obstétrico' },
    { id: 'otro', label: 'Otro' },
  ],
  consentKind: [
    { id: 'datos', label: 'Tratamiento de datos' },
    { id: 'tratamiento', label: 'Consentimiento informado' },
    { id: 'fotos', label: 'Fotos clínicas' },
    { id: 'comunicacion', label: 'Mensajes y recordatorios' },
    { id: 'directivas', label: 'Directivas anticipadas' },
    { id: 'otro', label: 'Otro' },
  ],
};

export const STATUS_CLASS = { activo: 'success', inactivo: 'neutral', fallecido: 'danger' };

export const labelOf = (group, id) => OPTIONS[group]?.find((o) => o.id === id)?.label ?? id ?? '';

export const MAYORIA_DE_EDAD = 18;

/** Permiso "clave|acción" o "*". Mismo formato que Role.permissions. */
export const hasPerm = (perms = [], key, action) =>
  perms.includes('*') || perms.includes(`${key}|${action}`);

const vacio = (v) => (v == null ? '' : String(v));
const texto = (v) => {
  const t = vacio(v).trim();
  return t === '' ? null : t;
};

/** Hoy en ISO (YYYY-MM-DD) según el reloj local. */
export const hoyIso = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Edad cumplida en años a partir de fechas ISO; null sin fecha. */
export function ageFrom(birthIso, todayIso = hoyIso()) {
  if (!birthIso) return null;
  const [by, bm, bd] = birthIso.slice(0, 10).split('-').map(Number);
  const [ty, tm, td] = todayIso.slice(0, 10).split('-').map(Number);
  let edad = ty - by;
  if (tm < bm || (tm === bm && td < bd)) edad -= 1;
  return edad;
}

export const dpiDigits = (v) => vacio(v).replace(/[\s-]/g, '');

// ── Formulario ─────────────────────────────────────────────────────────

export const emptyGuardian = () => ({ clientId: null, name: '', nit: '', phone: '', relationship: '', legalGuardian: true, payer: false });
export const emptyContact = () => ({ name: '', relationship: '', phone: '' });
export const emptyAllergy = () => ({ kind: 'medicamento', allergen: '', reaction: '', severity: '', notes: '' });
export const emptyHistory = () => ({ kind: 'cronica', description: '', cie10Code: '', relative: '', occurred: '', notes: '' });
export const emptyMedication = () => ({ name: '', dose: '', frequency: '', since: '', notes: '' });
export const emptyVaccine = () => ({ vaccine: '', dose: '', appliedOn: '', notes: '' });

export const emptyClinical = () => ({
  bloodType: '', religion: '', disability: '', specialNeeds: '', smoking: '', alcohol: '',
  physicalActivity: '', diet: '', gynecoObstetric: '', alerts: '', advanceDirectives: '',
  allergies: [], history: [], medications: [], vaccines: [],
});

/**
 * Formulario vacío. `client` guarda también lo que la ficha del paciente no
 * muestra (tipo, crédito, saldo inicial, estado): ClientService reemplaza el
 * cliente completo al editar y, si no se mandan, los pondría en cero.
 */
export function emptyForm(prefill = {}) {
  return {
    client: {
      id: null, name: '', nit: 'CF', phone: '', email: '', address: '',
      clientType: 'CF', creditLimit: 0, paymentTerms: 0, openingBalance: 0, status: 'active',
      ...prefill.client,
    },
    patient: {
      docType: '', docNumber: '', preferredName: '', birthDate: '', sex: '', gender: '',
      maritalStatus: '', nationality: 'Guatemalteca', occupation: '', education: '',
      referralSource: '', referredBy: '', primaryProfessionalId: '',
      reminderChannel: 'whatsapp', acceptsMessages: true,
      insurerName: '', policyNumber: '', policyExpiresOn: '', agreementName: '', adminNotes: '',
      specialtyData: {}, guardians: [], emergencyContacts: [],
      ...prefill.patient,
    },
    clinical: prefill.clinical ?? null,
  };
}

/** Cliente de /api/clients → parte `client` del formulario. */
export const clientToForm = (c = {}) => ({
  id: c.id ?? null,
  name: vacio(c.name), nit: vacio(c.nit) || 'CF', phone: vacio(c.phone), email: vacio(c.email),
  address: vacio(c.address), clientType: c.clientType || 'CF',
  creditLimit: Number(c.creditLimit ?? 0), paymentTerms: Number(c.paymentTerms ?? 0),
  openingBalance: Number(c.openingBalance ?? 0), status: c.status || 'active',
});

/**
 * Expediente tal como llega del backend, con sus listas siempre presentes.
 * Micronaut Serde omite por defecto las listas vacías (un paciente sin
 * responsables llega sin `guardians`); aquí se reponen para que la pantalla
 * no tenga que cuidarlo en cada lugar.
 */
export function normalizeDetail(d) {
  if (!d) return d;
  const c = d.clinical;
  return {
    ...d,
    guardians: d.guardians || [],
    emergencyContacts: d.emergencyContacts || [],
    consents: d.consents || [],
    patient: d.patient ? { ...d.patient, specialtyData: d.patient.specialtyData || {} } : d.patient,
    clinical: c ? {
      ...c,
      allergies: c.allergies || [],
      history: c.history || [],
      medications: c.medications || [],
      vaccines: c.vaccines || [],
    } : c,
  };
}

/** Expediente del backend → formulario de edición de la ficha. */
export function formFromDetail(d) {
  const p = d.patient;
  return emptyForm({
    client: clientToForm(d.client),
    patient: {
      docType: vacio(p.docType), docNumber: vacio(p.docNumber), preferredName: vacio(p.preferredName),
      birthDate: vacio(p.birthDate), sex: vacio(p.sex), gender: vacio(p.gender),
      maritalStatus: vacio(p.maritalStatus), nationality: vacio(p.nationality), occupation: vacio(p.occupation),
      education: vacio(p.education), referralSource: vacio(p.referralSource), referredBy: vacio(p.referredBy),
      primaryProfessionalId: p.primaryProfessionalId ?? '', reminderChannel: p.reminderChannel || 'whatsapp',
      acceptsMessages: !!p.acceptsMessages, insurerName: vacio(p.insurerName), policyNumber: vacio(p.policyNumber),
      policyExpiresOn: vacio(p.policyExpiresOn), agreementName: vacio(p.agreementName), adminNotes: vacio(p.adminNotes),
      specialtyData: p.specialtyData || {},
      guardians: (d.guardians || []).map((g) => ({
        clientId: g.clientId, name: g.name, nit: vacio(g.nit), phone: vacio(g.phone),
        relationship: g.relationship, legalGuardian: !!g.legalGuardian, payer: !!g.payer,
      })),
      emergencyContacts: (d.emergencyContacts || []).map((c) => ({
        name: c.name, relationship: vacio(c.relationship), phone: c.phone,
      })),
    },
  });
}

/** Datos clínicos del backend → formulario. */
export function clinicalToForm(c) {
  if (!c) return emptyClinical();
  const base = emptyClinical();
  Object.keys(base).forEach((k) => {
    if (!Array.isArray(base[k])) base[k] = vacio(c[k]);
  });
  base.allergies = (c.allergies || []).map((a) => ({ ...emptyAllergy(), ...mapVacio(a) }));
  base.history = (c.history || []).map((h) => ({ ...emptyHistory(), ...mapVacio(h) }));
  base.medications = (c.medications || []).map((m) => ({ ...emptyMedication(), ...mapVacio(m) }));
  base.vaccines = (c.vaccines || []).map((v) => ({ ...emptyVaccine(), ...mapVacio(v) }));
  return base;
}

const mapVacio = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, vacio(v)]));

// ── Cuerpos para la API ────────────────────────────────────────────────

export function clientPayload(c) {
  return {
    name: c.name.trim(), nit: texto(c.nit) || 'CF', clientType: c.clientType || 'CF',
    address: texto(c.address), phone: texto(c.phone), email: texto(c.email),
    creditLimit: Number(c.creditLimit) || 0, paymentTerms: Number(c.paymentTerms) || 0,
    openingBalance: Number(c.openingBalance) || 0, status: c.status || 'active',
  };
}

export function patientPayload(p) {
  return {
    docType: texto(p.docType), docNumber: texto(p.docNumber), preferredName: texto(p.preferredName),
    birthDate: texto(p.birthDate), sex: texto(p.sex), gender: texto(p.gender),
    maritalStatus: texto(p.maritalStatus), nationality: texto(p.nationality), occupation: texto(p.occupation),
    education: texto(p.education), referralSource: texto(p.referralSource), referredBy: texto(p.referredBy),
    primaryProfessionalId: p.primaryProfessionalId === '' || p.primaryProfessionalId == null
      ? null : Number(p.primaryProfessionalId),
    reminderChannel: p.reminderChannel || 'whatsapp', acceptsMessages: !!p.acceptsMessages,
    insurerName: texto(p.insurerName), policyNumber: texto(p.policyNumber),
    policyExpiresOn: texto(p.policyExpiresOn), agreementName: texto(p.agreementName),
    adminNotes: texto(p.adminNotes), specialtyData: p.specialtyData || {},
    guardians: (p.guardians || []).filter((g) => g.clientId != null).map((g) => ({
      clientId: g.clientId, relationship: g.relationship.trim(),
      legalGuardian: !!g.legalGuardian, payer: !!g.payer,
    })),
    emergencyContacts: (p.emergencyContacts || [])
      .filter((c) => texto(c.name) || texto(c.phone))
      .map((c) => ({ name: c.name.trim(), relationship: texto(c.relationship), phone: c.phone.trim() })),
  };
}

const filas = (list, requerido, map) =>
  (list || []).filter((x) => texto(x[requerido])).map(map);

export function clinicalPayload(c) {
  const base = {};
  Object.keys(emptyClinical()).forEach((k) => {
    if (!Array.isArray(c[k])) base[k] = texto(c[k]);
  });
  return {
    ...base,
    allergies: filas(c.allergies, 'allergen', (a) => ({
      kind: a.kind, allergen: a.allergen.trim(), reaction: texto(a.reaction),
      severity: texto(a.severity), notes: texto(a.notes),
    })),
    history: filas(c.history, 'description', (h) => ({
      kind: h.kind, description: h.description.trim(), cie10Code: texto(h.cie10Code),
      relative: texto(h.relative), occurred: texto(h.occurred), notes: texto(h.notes),
    })),
    medications: filas(c.medications, 'name', (m) => ({
      name: m.name.trim(), dose: texto(m.dose), frequency: texto(m.frequency),
      since: texto(m.since), notes: texto(m.notes),
    })),
    vaccines: filas(c.vaccines, 'vaccine', (v) => ({
      vaccine: v.vaccine.trim(), dose: texto(v.dose), appliedOn: texto(v.appliedOn), notes: texto(v.notes),
    })),
  };
}

// ── Validación ─────────────────────────────────────────────────────────

/**
 * Errores del formulario, en el orden de las pestañas. Cada uno dice en qué
 * pestaña está (`tab`) para que la pantalla lleve al usuario ahí, y trae su
 * clave de traducción (`key`) con el texto en español (`msg`).
 */
export function validateForm(form, todayIso = hoyIso()) {
  const errores = [];
  const { client: c, patient: p } = form;
  if (!vacio(c.name).trim()) errores.push({ tab: 'personal', key: 'name', msg: 'Escribe el nombre del paciente.' });
  if (texto(p.docNumber) && !texto(p.docType)) {
    errores.push({ tab: 'personal', key: 'docType', msg: 'Indica el tipo de documento.' });
  }
  if (p.docType === 'DPI' && !/^\d{13}$/.test(dpiDigits(p.docNumber))) {
    errores.push({ tab: 'personal', key: 'dpi', msg: 'El DPI debe tener 13 dígitos.' });
  }
  if (p.birthDate && p.birthDate > todayIso) {
    errores.push({ tab: 'personal', key: 'birthFuture', msg: 'La fecha de nacimiento no puede ser futura.' });
  }
  const guardians = (p.guardians || []).filter((g) => g.clientId != null);
  if ((p.guardians || []).some((g) => g.clientId == null)) {
    errores.push({ tab: 'guardians', key: 'guardianPick', msg: 'Elige el cliente de cada responsable o quita la fila vacía.' });
  }
  if (guardians.some((g) => !vacio(g.relationship).trim())) {
    errores.push({ tab: 'guardians', key: 'guardianRelationship', msg: 'Indica el parentesco de cada responsable.' });
  }
  if (guardians.some((g) => !g.legalGuardian && !g.payer)) {
    errores.push({ tab: 'guardians', key: 'guardianRole', msg: 'Cada responsable debe ser tutor legal, quien paga, o ambos.' });
  }
  if (guardians.filter((g) => g.payer).length > 1) {
    errores.push({ tab: 'guardians', key: 'onePayer', msg: 'Solo puede haber un responsable que paga.' });
  }
  const edad = ageFrom(p.birthDate, todayIso);
  if (edad != null && edad < MAYORIA_DE_EDAD && !guardians.some((g) => g.legalGuardian)) {
    errores.push({ tab: 'guardians', key: 'minorGuardian', msg: 'Es menor de edad: registra al menos un tutor legal.' });
  }
  if ((p.emergencyContacts || []).some((x) => (texto(x.name) || texto(x.phone)) && !(texto(x.name) && texto(x.phone)))) {
    errores.push({ tab: 'contact', key: 'contact', msg: 'Cada contacto de emergencia necesita nombre y teléfono.' });
  }
  if (form.clinical) {
    if ((form.clinical.history || []).some((h) => h.kind === 'familiar' && texto(h.description) && !texto(h.relative))) {
      errores.push({ tab: 'clinical', key: 'familyRelative', msg: 'Indica el parentesco de cada antecedente familiar.' });
    }
  }
  return errores;
}

/** Lo que debe saltar a la vista al abrir el expediente: alertas y alergias severas. */
export function clinicalAlerts(clinical) {
  if (!clinical) return [];
  const out = [];
  if (texto(clinical.alerts)) out.push({ kind: 'alert', text: clinical.alerts.trim() });
  // Las alergias llevan el nombre del alérgeno; la pantalla antepone «Alergia:» traducido.
  (clinical.allergies || []).forEach((a) => {
    out.push({ kind: a.severity === 'severa' ? 'severe' : 'allergy', text: a.allergen });
  });
  return out;
}

/**
 * Lo que se escribió en «buscar antes de crear» se aprovecha en el alta:
 * un DPI va al documento, un teléfono al teléfono y lo demás al nombre.
 */
export function prefillFromSearch(q) {
  const term = vacio(q).trim();
  if (!term) return {};
  const digitos = term.replace(/\D/g, '');
  if (/^[\d\s-]+$/.test(term) && digitos.length === 13) {
    return { patient: { docType: 'DPI', docNumber: digitos } };
  }
  if (/^[\d\s()+-]+$/.test(term) && digitos.length >= 8) {
    return { client: { phone: term } };
  }
  return { client: { name: term } };
}

/**
 * Fecha de firma de un consentimiento para el backend. Hoy (o vacío) va
 * como null y el servidor pone la hora exacta; un día anterior va a
 * mediodía de Guatemala, para que la zona horaria no lo corra de día.
 */
export const consentSignedAt = (iso, today = hoyIso()) =>
  (iso && iso < today ? `${iso}T12:00:00-06:00` : null);
