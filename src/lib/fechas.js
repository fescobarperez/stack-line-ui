// Stackline — Fechas locales
//
// `new Date().toISOString().slice(0, 10)` da la fecha en UTC, no la del
// usuario. En Guatemala (UTC−6) eso significa que a partir de las 18:00 hora
// local el sistema ya cree que es mañana: el POS no encontraba el turno recién
// abierto porque comparaba su `businessDate` —que el backend calcula con
// `LocalDate.now()`, hora local del servidor— contra un «hoy» adelantado un
// día, y todos los formularios proponían por defecto la fecha equivocada.
//
// Estas funciones trabajan siempre en la zona del navegador.

function pad(n) { return String(n).padStart(2, '0'); }

/** Una fecha cualquiera como YYYY-MM-DD en hora local. */
export function fechaISO(d) {
  const f = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(f.getTime())) return '';
  return `${f.getFullYear()}-${pad(f.getMonth() + 1)}-${pad(f.getDate())}`;
}

/** Hoy como YYYY-MM-DD en hora local. */
export function hoyISO() {
  return fechaISO(new Date());
}
