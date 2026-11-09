// Stackline Salud: pacientes. El backend valida el módulo `salud` del plan y
// los permisos `patients` (ficha) y `clinical_record` (datos clínicos).
import { api } from './client.js';

const BASE = '/api/salud/patients';

export const listPatients = ({ search = '', status = '', page = 0, size = 50 } = {}) => {
  const q = new URLSearchParams({ page: String(page), size: String(size) });
  if (search) q.set('search', search);
  if (status) q.set('status', status);
  return api.get(`${BASE}?${q}`);
};

/** Buscar antes de crear: clientes que coinciden y si ya son pacientes. */
export const findCandidates = (q) => api.get(`${BASE}/candidates?q=${encodeURIComponent(q)}`, { silent: true });

/** De estos clientes, cuáles son pacientes: [{ clientId, recordNumber, status }]. */
export const lookupPatients = (clientIds) =>
  api.get(`${BASE}/lookup?clientIds=${clientIds.join(',')}`, { silent: true });

export const getPatient = (id) => api.get(`${BASE}/${id}`);
export const createPatient = (body) => api.post(BASE, body);
export const createPatientFromClient = (clientId, body) => api.post(`${BASE}/from-client/${clientId}`, body);
export const updatePatient = (id, body) => api.put(`${BASE}/${id}`, body);
export const updateClinical = (id, body) => api.put(`${BASE}/${id}/clinical`, body);
export const changePatientStatus = (id, body) => api.patch(`${BASE}/${id}/status`, body);
export const addConsent = (id, body) => api.post(`${BASE}/${id}/consents`, body);
export const revokeConsent = (id, consentId) => api.post(`${BASE}/${id}/consents/${consentId}/revoke`, {});
export const getAccessLog = (id) => api.get(`${BASE}/${id}/access-log?size=100`);

// ── Agenda ──────────────────────────────────────────────────────────────
const S = '/api/salud';
const qs = (o) => new URLSearchParams(Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && v !== ''))).toString();

export const listProfessionals = () => api.get(`${S}/professionals`);
export const saveProfessional = (userId, body) => api.put(`${S}/professionals/${userId}`, body);
export const saveSchedule = (userId, slots) => api.put(`${S}/professionals/${userId}/schedule`, { slots });

export const listResources = () => api.get(`${S}/resources`);
export const createResource = (body) => api.post(`${S}/resources`, body);
export const updateResource = (id, body) => api.put(`${S}/resources/${id}`, body);

export const listAppointmentTypes = () => api.get(`${S}/appointment-types`);
export const createAppointmentType = (body) => api.post(`${S}/appointment-types`, body);
export const updateAppointmentType = (id, body) => api.put(`${S}/appointment-types/${id}`, body);

/** Citas que tocan [from, to). Filtros opcionales: professionalId, resourceId, patientId, status. */
export const listAppointments = (filters) => api.get(`${S}/appointments?${qs(filters)}`);
export const getAppointment = (id) => api.get(`${S}/appointments/${id}`);
export const createAppointment = (body) => api.post(`${S}/appointments`, body);
export const rescheduleAppointment = (id, body) => api.put(`${S}/appointments/${id}/schedule`, body);
export const changeAppointmentStatus = (id, status, reason) => api.post(`${S}/appointments/${id}/status`, { status, reason });
export const updateAppointmentNotes = (id, body) => api.put(`${S}/appointments/${id}/notes`, body);

/** Horarios libres de un profesional para un tipo de cita en un día (YYYY-MM-DD). */
export const getAvailability = (professionalId, date, typeId) =>
  api.get(`${S}/availability?${qs({ professionalId, date, typeId })}`, { silent: true });

// Atención clínica (fase 6)
export const openEncounter = (appointmentId) => api.post(`${S}/appointments/${appointmentId}/encounter`, {});
export const getEncounter = (id) => api.get(`${S}/encounters/${id}`);
export const saveEncounter = (id, body) => api.put(`${S}/encounters/${id}`, body);
export const signEncounter = (id, body) => api.post(`${S}/encounters/${id}/sign`, body);
export const addAddendum = (id, text) => api.post(`${S}/encounters/${id}/addenda`, { text });
export const getPrescriptionPdf = (id) => api.get(`${S}/encounters/${id}/prescription.pdf`, { blob: true });
export const getClinicalHistory = (patientId) => api.get(`${S}/patients/${patientId}/clinical-history`);
export const closeCase = (id, outcome) => api.post(`${S}/cases/${id}/close`, { outcome });
export const reopenCase = (id) => api.post(`${S}/cases/${id}/reopen`, {});
export const cancelFollowUp = (id) => api.post(`${S}/follow-ups/${id}/cancel`, {});
export const searchCie10 = (q) => api.get(`${S}/cie10?q=${encodeURIComponent(q)}`, { silent: true });

// Ajustes (recordatorios por WhatsApp)
export const getSaludSettings = () => api.get(`${S}/settings`);
export const saveSaludSettings = (body) => api.put(`${S}/settings`, body);

export const listBlocks = (from, to) => api.get(`${S}/blocks?${qs({ from, to })}`);
export const createBlock = (body) => api.post(`${S}/blocks`, body);
export const deleteBlock = (id) => api.del(`${S}/blocks/${id}`);

// ── Caja y seguimiento (fase 7) ─────────────────────────────────────────
export const listPackages = () => api.get(`${S}/packages`);
export const createPackage = (body) => api.post(`${S}/packages`, body);
export const updatePackage = (id, body) => api.put(`${S}/packages/${id}`, body);

export const getAccount = (patientId) => api.get(`${S}/patients/${patientId}/account`);
export const sellPackage = (patientId, body) => api.post(`${S}/patients/${patientId}/packages`, body);
export const addDeposit = (patientId, body) => api.post(`${S}/patients/${patientId}/deposits`, body);

export const getChargeOptions = (appointmentId) => api.get(`${S}/appointments/${appointmentId}/charge`);
export const chargeAppointment = (appointmentId, body) => api.post(`${S}/appointments/${appointmentId}/charge`, body);
export const voidCharge = (id, reason) => api.post(`${S}/charges/${id}/void`, { reason });

export const listPlans = (patientId) => api.get(`${S}/patients/${patientId}/plans`);
export const createPlan = (caseId, body) => api.post(`${S}/cases/${caseId}/plans`, body);
export const cancelPlan = (id) => api.post(`${S}/plans/${id}/cancel`, {});

export const listFollowUps = ({ days = 30, professionalId = '' } = {}) => api.get(`${S}/follow-ups?${qs({ days, professionalId })}`);
export const saveFeedback = (id, body) => api.post(`${S}/follow-ups/${id}/feedback`, body);

export const getSaludReport = (from, to) => api.get(`${S}/reports?${qs({ from, to })}`);
