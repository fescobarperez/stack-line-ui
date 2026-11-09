// Plantillas de cálculo por producto: el formulario del editor y lo que se
// valida antes de mandarlo. El backend valida lo mismo (TemplateService);
// aquí se adelanta para marcar el campo exacto en vez de un error genérico.

const FUNCIONES = new Set(['ceil', 'floor', 'round', 'min', 'max', 'abs', 'sqrt']);

/** Código a partir de una etiqueta: «Profundidad (m)» → «profundidad_m». */
export const slug = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/^[0-9_]+/, '').slice(0, 40);

export const CODIGO = /^[a-z][a-z0-9_]{0,39}$/;

/** Variables que usa una fórmula (sin las funciones). */
export function formulaVars(formula) {
  const out = [];
  const re = /[A-Za-z_][A-Za-z0-9_]*/g;
  const s = String(formula || '');
  let m;
  while ((m = re.exec(s))) {
    const resto = s.slice(m.index + m[0].length).trimStart();
    if (resto.startsWith('(') && FUNCIONES.has(m[0].toLowerCase())) continue;
    if (!out.includes(m[0])) out.push(m[0]);
  }
  return out;
}

let seq = 0;
const uid = () => `n${Date.now().toString(36)}${(seq++).toString(36)}`;
const txt = (v) => (v == null ? '' : String(v));
const num = (v) => (v === '' || v == null ? null : Number(v));

export const newParam = () => ({ key: uid(), code: '', label: '', unit: 'm', min: '', max: '', defaultValue: '', required: true, nueva: true });
export const newChoice = () => ({ key: uid(), code: '', label: '', renderText: '', benefit: '', isDefault: false, nueva: true });
export const newOption = () => ({ key: uid(), code: '', label: '', required: true, nueva: true, choices: [newChoice()] });
export const newComponent = () => ({ key: uid(), productId: '', productName: '', unit: '', when: '', formula: '', wastePct: '0', roundUp: false, group: 'Estructura' });
export const newPreset = () => ({ key: uid(), code: '', label: '', choices: {}, nueva: true });

export const emptyTemplate = () => ({
  id: null, productId: '', productName: '', name: '', description: '', active: true, version: 0,
  params: [newParam()], options: [], components: [newComponent()], presets: [],
});

/** «opcion:eleccion» ⇄ { option, choice }; '' = siempre. */
const cuando = (o, c) => (o && c ? `${o}:${c}` : '');
const partir = (w) => {
  if (!w) return { option: null, choice: null };
  const [option, choice] = w.split(':');
  return { option, choice };
};

/** Respuesta del backend → formulario. */
export function toForm(r) {
  return {
    id: r.id, productId: r.productId, productName: r.productName || '', name: r.name || '',
    description: r.description || '', active: r.active !== false, version: r.version || 0,
    params: (r.params || []).map((p) => ({ key: uid(), code: p.code, label: p.label, unit: p.unit || '',
      min: txt(p.min), max: txt(p.max), defaultValue: txt(p.defaultValue), required: p.required !== false, nueva: false })),
    options: (r.options || []).map((o) => ({ key: uid(), code: o.code, label: o.label, required: o.required !== false, nueva: false,
      choices: (o.choices || []).map((c) => ({ key: uid(), code: c.code, label: c.label, renderText: c.renderText || '',
        benefit: c.benefit || '', isDefault: Boolean(c.isDefault), nueva: false })) })),
    components: (r.components || []).map((c) => ({ key: uid(), productId: c.productId, productName: c.productName || '',
      unit: c.unit || '', when: cuando(c.option, c.choice), formula: c.formula, wastePct: txt(c.wastePct ?? 0),
      roundUp: Boolean(c.roundUp), group: c.group || 'Materiales' })),
    presets: (r.presets || []).map((p) => ({ key: uid(), code: p.code, label: p.label, choices: { ...(p.choices || {}) }, nueva: false })),
  };
}

/** Formulario → cuerpo de POST/PUT /api/product-templates. */
export function toPayload(f) {
  return {
    productId: Number(f.productId),
    name: f.name.trim(),
    description: f.description.trim() || null,
    active: f.active,
    params: f.params.map((p) => ({ code: p.code.trim(), label: p.label.trim(), unit: p.unit.trim() || null,
      min: num(p.min), max: num(p.max), defaultValue: num(p.defaultValue), required: p.required })),
    options: f.options.map((o) => ({ code: o.code.trim(), label: o.label.trim(), required: o.required,
      choices: o.choices.map((c) => ({ code: c.code.trim(), label: c.label.trim(), renderText: c.renderText.trim() || null,
        benefit: c.benefit.trim() || null, isDefault: c.isDefault })) })),
    components: f.components.map((c) => ({ productId: Number(c.productId), ...partir(c.when), formula: c.formula.trim(),
      wastePct: Number(c.wastePct || 0), roundUp: c.roundUp, group: c.group.trim() || 'Materiales' })),
    presets: f.presets.map((p) => ({ code: p.code.trim(), label: p.label.trim(),
      choices: Object.fromEntries(Object.entries(p.choices).filter(([, v]) => v)) })),
  };
}

const esNumero = (v) => v === '' || v == null || /^-?\d+(\.\d+)?$/.test(String(v).trim());

/**
 * Errores por campo: { 'params.<key>.code': 'mensaje', ... }. Vacío = se
 * puede guardar. Las claves usan el `key` de cada fila para marcarla.
 */
export function validateTemplate(f) {
  const e = {};
  if (!f.productId) e.productId = 'Elige el producto';
  if (!f.name.trim()) e.name = 'El nombre es obligatorio';
  if (!f.params.length) e.params = 'Agrega al menos un parámetro (p. ej. ancho)';
  const codigos = new Set();
  f.params.forEach((p) => {
    const k = `params.${p.key}`;
    if (!p.label.trim()) e[`${k}.label`] = 'Obligatorio';
    if (!CODIGO.test(p.code)) e[`${k}.code`] = 'Minúsculas, números y _';
    else if (codigos.has(p.code)) e[`${k}.code`] = 'Repetido';
    codigos.add(p.code);
    ['min', 'max', 'defaultValue'].forEach((x) => { if (!esNumero(p[x])) e[`${k}.${x}`] = 'Número'; });
    if (esNumero(p.min) && esNumero(p.max) && p.min !== '' && p.max !== '' && Number(p.min) > Number(p.max)) e[`${k}.max`] = 'Menor que el mínimo';
  });
  const elecciones = {};
  f.options.forEach((o) => {
    const k = `options.${o.key}`;
    if (!o.label.trim()) e[`${k}.label`] = 'Obligatorio';
    if (!CODIGO.test(o.code)) e[`${k}.code`] = 'Minúsculas, números y _';
    else if (codigos.has(o.code) || elecciones[o.code]) e[`${k}.code`] = 'Repetido';
    if (!o.choices.length) e[`${k}.choices`] = 'Agrega al menos una elección';
    if (o.choices.filter((c) => c.isDefault).length > 1) e[`${k}.choices`] = 'Solo una por defecto';
    const cs = new Set();
    o.choices.forEach((c) => {
      const kc = `${k}.${c.key}`;
      if (!c.label.trim()) e[`${kc}.label`] = 'Obligatorio';
      if (!CODIGO.test(c.code)) e[`${kc}.code`] = 'Minúsculas, números y _';
      else if (cs.has(c.code)) e[`${kc}.code`] = 'Repetido';
      cs.add(c.code);
    });
    elecciones[o.code] = cs;
  });
  const valeCuando = (w) => {
    if (!w) return true;
    const { option, choice } = partir(w);
    return Boolean(elecciones[option]?.has(choice));
  };
  const formula = (k, expr) => {
    if (!String(expr || '').trim()) { e[k] = 'Obligatoria'; return; }
    const extra = formulaVars(expr).filter((v) => !codigos.has(v));
    if (extra.length) e[k] = `No es parámetro: ${extra.join(', ')}`;
  };
  if (!f.components.length) e.components = 'Agrega al menos un componente';
  f.components.forEach((c) => {
    const k = `components.${c.key}`;
    if (!c.productId) e[`${k}.productId`] = 'Elige la materia prima';
    formula(`${k}.formula`, c.formula);
    const w = Number(c.wastePct || 0);
    if (!esNumero(c.wastePct) || w < 0 || w > 100) e[`${k}.wastePct`] = '0 a 100';
    if (!valeCuando(c.when)) e[`${k}.when`] = 'Esa elección ya no existe';
  });
  const ps = new Set();
  f.presets.forEach((p) => {
    const k = `presets.${p.key}`;
    if (!p.label.trim()) e[`${k}.label`] = 'Obligatorio';
    if (!CODIGO.test(p.code)) e[`${k}.code`] = 'Minúsculas, números y _';
    else if (ps.has(p.code)) e[`${k}.code`] = 'Repetido';
    ps.add(p.code);
    Object.entries(p.choices).forEach(([o, c]) => { if (c && !elecciones[o]?.has(c)) e[`${k}.choices`] = 'Usa una elección que ya no existe'; });
  });
  return e;
}

/** Opciones del selector «Solo si…»: [{ id: 'techo:shingle', name: 'Techo: Shingle' }]. */
export function whenOptions(f) {
  return f.options.flatMap((o) => o.choices.filter((c) => c.code)
    .map((c) => ({ id: `${o.code}:${c.code}`, name: `${o.label || o.code}: ${c.label || c.code}` })));
}

/** Valores iniciales para calcular: los de por defecto de cada parámetro. */
export function defaultParams(template) {
  return Object.fromEntries((template?.params || []).map((p) => [p.code, p.defaultValue == null ? '' : String(p.defaultValue)]));
}

/** Configuración guardada en una línea de cotización (JSON) o null. */
export function parseConfig(json) {
  if (!json) return null;
  try { return JSON.parse(json); } catch { return null; }
}

/** Parámetros del formulario de cálculo → números (vacíos fuera). */
export function paramsPayload(values) {
  return Object.fromEntries(Object.entries(values || {}).filter(([, v]) => String(v).trim() !== '').map(([k, v]) => [k, Number(v)]));
}

/** SKU sugerido para una materia prima nueva: «Poste pino 4×4» → «MP-POSTE-PINO-4X4». */
export function skuFromName(name) {
  const base = slug(String(name || '').replace(/×/g, 'x')).replace(/_/g, '-').toUpperCase().slice(0, 24).replace(/-+$/, '');
  return base ? `MP-${base}` : '';
}

/** Unidades de uso comunes para materia prima de plantillas. */
export const RAW_UNITS = ['Unidad', 'Metro lineal', 'm²', 'm³', 'Pie tablar', 'Kg', 'Libra', 'Litro', 'Galón', 'Paquete'];
