// Parser CSV RFC 4180 mínimo para la carga de catálogos.
// Conserva el nombre original y la URL de categoría; el backend decide el match.

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"') {
      if (quoted && next === '"') { cell += '"'; i += 1; }
      else quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      row.push(cell); cell = '';
    } else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && next === '\n') i += 1;
      row.push(cell); cell = '';
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    if (row.some((value) => value.trim() !== '')) rows.push(row);
  }
  return rows;
}

const clean = (value) => String(value ?? '').replace(/^\uFEFF/, '').trim();
const number = (value) => {
  const raw = clean(value).replace(/[^0-9,.-]/g, '').replace(',', '.');
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

export function parseCatalogCsv(text) {
  const rows = parseCsvRows(text);
  if (rows.length < 2) throw new Error('El CSV no tiene encabezados y filas de productos.');
  const headers = rows[0].map((header) => clean(header).toLowerCase());
  const index = (names) => names.map((name) => headers.indexOf(name)).find((value) => value >= 0);
  const indexes = {
    category: index(['categoria', 'categoría', 'category']),
    subcategory: index(['subcategoria', 'subcategoría', 'subcategory']),
    name: index(['producto', 'product', 'name', 'nombre']),
    cost: index(['precio_gtq', 'precio', 'price', 'unit_cost']),
    sourceUrl: index(['url_fuente', 'source_url', 'url']),
  };
  if (indexes.name == null) throw new Error('El CSV debe tener una columna producto o name.');

  return rows.slice(1).map((values, rowIndex) => {
    const name = clean(values[indexes.name]);
    const category = clean(values[indexes.category]);
    const subcategory = clean(values[indexes.subcategory]);
    return {
      name,
      unitCost: number(values[indexes.cost]),
      currency: 'GTQ',
      sourceUrl: clean(values[indexes.sourceUrl]),
      categoryPath: [category, subcategory].filter(Boolean),
      attributes: {},
      rowNumber: rowIndex + 2,
    };
  }).filter((row) => row.name);
}
