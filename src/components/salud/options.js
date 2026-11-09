// Opciones de las listas del paciente ya traducidas, con la forma que
// espera Autocomplete ({ id, name }).
import { OPTIONS } from '../../lib/patients.js';

export const opts = (t, group) => (OPTIONS[group] || []).map((o) => ({
  id: o.id,
  name: group === 'bloodType' ? o.label : t(`patients.options.${group}.${o.id}`, o.label),
}));

export const optLabel = (t, group, id) => {
  if (!id) return '';
  const o = (OPTIONS[group] || []).find((x) => x.id === id);
  if (!o) return id;
  return group === 'bloodType' ? o.label : t(`patients.options.${group}.${id}`, o.label);
};
