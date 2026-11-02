// Atención clínica (fase 6): de la consulta del backend al formulario y de
// vuelta, validación previa a la firma y formatos. Sin React, para probarlo
// solo. El backend vuelve a validar todo.

export const RESPONSES = [
  { id: 'mejoro', label: 'Mejoró', badge: 'success' },
  { id: 'igual', label: 'Igual', badge: 'neutral' },
  { id: 'empeoro', label: 'Empeoró', badge: 'danger' },
];

export const ADHERENCE = [
  { id: 'completa', label: 'Completo' },
  { id: 'parcial', label: 'Parcial' },
  { id: 'no', label: 'No lo tomó' },
];

export const ROUTES = ['oral', 'sublingual', 'tópica', 'oftálmica', 'ótica', 'nasal', 'inhalada', 'intramuscular',
  'intravenosa', 'subcutánea', 'rectal', 'vaginal'];

/** Atajos para el control: días después de la consulta. */
export const FOLLOW_UP_PRESETS = [7, 15, 30, 90];

/** Campos de signos vitales: clave, etiqueta, unidad, rango y si lleva decimales. */
export const VITALS = [
  { key: 'bpSystolic', label: 'Sistólica', unit: 'mmHg', min: 50, max: 260 },
  { key: 'bpDiastolic', label: 'Diastólica', unit: 'mmHg', min: 30, max: 160 },
  { key: 'heartRate', label: 'Frec. cardiaca', unit: 'lpm', min: 20, max: 250 },
  { key: 'respRate', label: 'Frec. respiratoria', unit: 'rpm', min: 5, max: 80 },
  { key: 'temperature', label: 'Temperatura', unit: '°C', min: 30, max: 45, decimal: true },
  { key: 'spo2', label: 'Saturación', unit: '%', min: 50, max: 100 },
  { key: 'weightKg', label: 'Peso', unit: 'kg', min: 0.3, max: 400, decimal: true },
  { key: 'heightCm', label: 'Talla', unit: 'cm', min: 25, max: 250, decimal: true },
];

const vacio = (v) => (v == null ? '' : String(v));
const texto = (v) => {
  const s = vacio(v).trim();
  return s === '' ? null : s;
};
const numero = (v) => {
  const s = vacio(v).trim().replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

/** La consulta del backend → estado del formulario (todo como texto, listas copiadas). */
export function encounterToForm(e) {
  const v = e?.vitals || {};
  const vitals = {};
  VITALS.forEach((f) => { vitals[f.key] = vacio(v[f.key]); });
  return {
    caseMode: e?.caseId ? 'existing' : (e?.newCaseTitle ? 'new' : ((e?.openCases || []).length ? 'existing' : 'new')),
    caseId: e?.caseId ?? '',
    newCaseTitle: vacio(e?.newCaseTitle),
    subjective: vacio(e?.subjective),
    objective: vacio(e?.objective),
    assessment: vacio(e?.assessment),
    plan: vacio(e?.plan),
    instructions: vacio(e?.instructions),
    vitals,
    painScore: v.painScore ?? null,
    response: vacio(e?.response),
    adherence: vacio(e?.adherence),
    adverseEffects: vacio(e?.adverseEffects),
    diagnoses: (e?.diagnoses || []).map((d) => ({ code: d.code || '', description: d.description, primary: !!d.primary })),
    prescriptions: (e?.prescriptions || []).map((p) => ({
      medication: p.medication, dose: vacio(p.dose), route: vacio(p.route), frequency: vacio(p.frequency),
      durationDays: vacio(p.durationDays), quantity: vacio(p.quantity), instructions: vacio(p.instructions),
    })),
    followUp: e?.followUpDays != null,
    followUpDays: vacio(e?.followUpDays),
    followUpTypeId: e?.followUpTypeId ?? '',
    followUpNotes: vacio(e?.followUpNotes),
  };
}

export const emptyPrescription = () => ({ medication: '', dose: '', route: 'oral', frequency: '', durationDays: '', quantity: '', instructions: '' });

/** Formulario → cuerpo de PUT /encounters/{id} y de /sign. */
export function encounterPayload(f) {
  const vitals = {};
  VITALS.forEach((x) => {
    const n = numero(f.vitals[x.key]);
    vitals[x.key] = n == null || Number.isNaN(n) ? null : n;
  });
  vitals.painScore = f.painScore == null || f.painScore === '' ? null : Number(f.painScore);
  const conCaso = f.caseMode === 'existing' && f.caseId !== '' && f.caseId != null;
  const dias = numero(f.followUpDays);
  return {
    caseId: conCaso ? Number(f.caseId) : null,
    newCaseTitle: f.caseMode === 'new' ? texto(f.newCaseTitle) : null,
    subjective: texto(f.subjective),
    objective: texto(f.objective),
    assessment: texto(f.assessment),
    plan: texto(f.plan),
    instructions: texto(f.instructions),
    vitals,
    response: texto(f.response),
    adherence: texto(f.adherence),
    adverseEffects: texto(f.adverseEffects),
    diagnoses: f.diagnoses.map((d) => ({ code: texto(d.code), description: d.description.trim(), primary: !!d.primary })),
    prescriptions: f.prescriptions
      .filter((p) => texto(p.medication))
      .map((p) => {
        const d = numero(p.durationDays);
        return {
          medication: p.medication.trim(), dose: texto(p.dose), route: texto(p.route), frequency: texto(p.frequency),
          durationDays: d == null || Number.isNaN(d) ? null : Math.round(d),
          quantity: texto(p.quantity), instructions: texto(p.instructions),
        };
      }),
    followUpDays: f.followUp && dias != null && !Number.isNaN(dias) ? Math.round(dias) : null,
    followUpTypeId: f.followUp && f.followUpTypeId !== '' ? Number(f.followUpTypeId) : null,
    followUpNotes: f.followUp ? texto(f.followUpNotes) : null,
  };
}

/** Errores de los signos vitales, por campo: { weightKg: 'El peso va de 0.3 a 400' }. */
export function vitalsErrors(vitals) {
  const out = {};
  VITALS.forEach((x) => {
    const n = numero(vitals[x.key]);
    if (n == null) return;
    if (Number.isNaN(n) || n < x.min || n > x.max) out[x.key] = `${x.label}: de ${x.min} a ${x.max} ${x.unit}`;
  });
  const sis = numero(vitals.bpSystolic);
  const dia = numero(vitals.bpDiastolic);
  if (!out.bpDiastolic && sis != null && dia != null && !Number.isNaN(sis) && !Number.isNaN(dia) && dia >= sis) {
    out.bpDiastolic = 'La diastólica debe ser menor que la sistólica';
  }
  return out;
}

/** Lo que falta para firmar (las mismas reglas que el backend), en orden. */
export function signErrors(f) {
  const errs = [];
  if (!texto(f.subjective)) errs.push('Escribe el motivo de consulta.');
  if (f.diagnoses.length === 0 && !texto(f.assessment)) errs.push('Agrega un diagnóstico o escribe el análisis.');
  if (f.caseMode === 'existing' ? (f.caseId === '' || f.caseId == null) : !texto(f.newCaseTitle)) {
    errs.push('Indica a qué caso pertenece la consulta.');
  }
  if (Object.keys(vitalsErrors(f.vitals)).length) errs.push('Revisa los signos vitales marcados.');
  if (f.followUp) {
    const d = numero(f.followUpDays);
    if (d == null || Number.isNaN(d) || d < 1 || d > 365) errs.push('El control va de 1 a 365 días.');
  }
  return errs;
}

/** IMC con un decimal; null si falta peso o talla. */
export function bmi(weightKg, heightCm) {
  const w = numero(weightKg);
  const h = numero(heightCm);
  if (w == null || h == null || Number.isNaN(w) || Number.isNaN(h) || h <= 0) return null;
  const m = h / 100;
  return Math.round((w / (m * m)) * 10) / 10;
}

/** Diagnóstico nuevo en la lista: el primero es el principal; no se repite el mismo código. */
export function addDiagnosis(list, dx) {
  const code = (dx.code || '').trim().toUpperCase();
  const description = (dx.description || '').trim();
  if (!description) return list;
  if (list.some((d) => (code && d.code === code) || (!code && !d.code && d.description.toLowerCase() === description.toLowerCase()))) {
    return list;
  }
  return [...list, { code, description, primary: list.length === 0 }];
}

/** Quita un diagnóstico; si era el principal, lo pasa al primero que quede. */
export function removeDiagnosis(list, i) {
  const out = list.filter((_, j) => j !== i);
  if (out.length && !out.some((d) => d.primary)) out[0] = { ...out[0], primary: true };
  return out;
}

export const setPrimary = (list, i) => list.map((d, j) => ({ ...d, primary: j === i }));

/** «120/80 mmHg · 36.8 °C · 70 kg» con lo que haya. */
export function vitalsSummary(v) {
  if (!v) return '';
  const partes = [];
  if (v.bpSystolic != null && v.bpDiastolic != null) partes.push(`${v.bpSystolic}/${v.bpDiastolic} mmHg`);
  if (v.heartRate != null) partes.push(`${v.heartRate} lpm`);
  if (v.temperature != null) partes.push(`${v.temperature} °C`);
  if (v.spo2 != null) partes.push(`SpO₂ ${v.spo2}%`);
  if (v.weightKg != null) partes.push(`${Number(v.weightKg)} kg`);
  if (v.bmi != null) partes.push(`IMC ${v.bmi}`);
  return partes.join(' · ');
}

/** Cómo va el dolor a lo largo del caso: «7 → 4 → 2» (de la consulta más vieja a la más nueva). */
export function painTrend(encounters) {
  const valores = [...(encounters || [])]
    .filter((e) => e.status === 'firmada' && e.vitals?.painScore != null)
    .sort((a, b) => String(a.signedAt || a.createdAt).localeCompare(String(b.signedAt || b.createdAt)))
    .map((e) => e.vitals.painScore);
  return valores.length > 1 ? valores.join(' → ') : '';
}

/** «Vence en 3 días», «Vence hoy», «Venció hace 2 días». */
export function dueLabel(daysLeft) {
  if (daysLeft === 0) return 'Vence hoy';
  if (daysLeft > 0) return `Vence en ${daysLeft} ${daysLeft === 1 ? 'día' : 'días'}`;
  const n = Math.abs(daysLeft);
  return `Venció hace ${n} ${n === 1 ? 'día' : 'días'}`;
}

/** Fecha para agendar un control: la fecha límite, o hoy si ya pasó. */
export const followUpDate = (dueOn, todayIso) => (dueOn && dueOn > todayIso ? dueOn : todayIso);
