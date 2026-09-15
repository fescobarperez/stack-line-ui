// Stackline — Generación de archivos .xlsx
//
// Escribe un libro de Excel real, sin dependencias. Un .xlsx es un ZIP con
// varios XML dentro; aquí se arman esos XML y se empaquetan sin comprimir
// (método "store", que el formato admite). Se hace a mano a propósito: la
// alternativa era meter SheetJS o ExcelJS al bundle, y la versión de SheetJS
// publicada en npm arrastra un CVE de prototype pollution sin parchear ahí.
//
// Los números se escriben como números —<v>1234.5</v>, sin comillas ni
// símbolo— para que las fórmulas de la hoja funcionen sobre ellos. El formato
// de moneda es presentación (numFmt), no contenido: la celda sigue valiendo
// 1234.5 aunque se lea "1,234.50".

const ENC = new TextEncoder();

// ── ZIP ──────────────────────────────────────────────────────────────────────

const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = TABLA_CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/** Empaqueta [{nombre, texto}] en un ZIP sin comprimir. */
function zip(entradas) {
  const partes = [];
  const central = [];
  let offset = 0;

  const u16 = (v) => [v & 0xFF, (v >>> 8) & 0xFF];
  const u32 = (v) => [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF];

  for (const { nombre, texto } of entradas) {
    const datos = ENC.encode(texto);
    const nom = ENC.encode(nombre);
    const crc = crc32(datos);

    const local = [
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0),                       // hora y fecha: irrelevantes aquí
      ...u32(crc), ...u32(datos.length), ...u32(datos.length),
      ...u16(nom.length), ...u16(0),
    ];
    partes.push(new Uint8Array(local), nom, datos);

    central.push([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0),
      ...u32(crc), ...u32(datos.length), ...u32(datos.length),
      ...u16(nom.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(0), ...u32(offset),
    ]);
    central.push(nom);
    offset += local.length + nom.length + datos.length;
  }

  const dir = [];
  for (const c of central) dir.push(...(c instanceof Uint8Array ? c : c));
  const dirBytes = new Uint8Array(dir);

  const fin = new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0),
    ...u16(entradas.length), ...u16(entradas.length),
    ...u32(dirBytes.length), ...u32(offset), ...u16(0),
  ]);

  return new Blob([...partes, dirBytes, fin], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

// ── XML de la hoja ───────────────────────────────────────────────────────────

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** 0 → A, 25 → Z, 26 → AA. */
function columna(i) {
  let s = '';
  for (let n = i; n >= 0; n = Math.floor(n / 26) - 1) s = String.fromCharCode(65 + (n % 26)) + s;
  return s;
}

const NORMAL = 0, NEGRITA = 1, MONEDA = 2;

function celdaXml(valor, fila, col, estilo) {
  const ref = `${columna(col)}${fila}`;
  const s = estilo ? ` s="${estilo}"` : '';
  if (valor == null || valor === '') return `<c r="${ref}"${s}/>`;
  if (typeof valor === 'number' && Number.isFinite(valor)) {
    return `<c r="${ref}"${s}><v>${valor}</v></c>`;
  }
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(valor)}</t></is></c>`;
}

/**
 * Una hoja a partir de un bloque.
 * @param {{titulo?:string, cabeceras?:string[], filas:Array<Array>, moneda?:number[]}} bloque
 */
function hojaXml(bloque) {
  const moneda = new Set(bloque.moneda || []);
  const filas = [];
  let n = 0;

  if (bloque.cabeceras) {
    n += 1;
    filas.push(`<row r="${n}">${bloque.cabeceras.map((h, i) => celdaXml(h, n, i, NEGRITA)).join('')}</row>`);
  }
  for (const fila of bloque.filas || []) {
    n += 1;
    filas.push(`<row r="${n}">${fila.map((v, i) => {
      // Formato de moneda en las columnas declaradas y, ademas, en cualquier
      // numero con decimales: en un bloque de "indicador / valor" conviven un
      // importe y un conteo, y solo el importe debe llevar los dos decimales.
      const esMoneda = typeof v === 'number' && (moneda.has(i) || !Number.isInteger(v));
      return celdaXml(v, n, i, esMoneda ? MONEDA : NORMAL);
    }).join('')}</row>`);
  }

  const anchos = (bloque.cabeceras || bloque.filas?.[0] || [])
    .map((_, i) => `<col min="${i + 1}" max="${i + 1}" width="18" customWidth="1"/>`).join('');

  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + (anchos ? `<cols>${anchos}</cols>` : '')
    + `<sheetData>${filas.join('')}</sheetData></worksheet>`;
}

const ESTILOS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
  + '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>'
  + '<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
  + '<fills count="2"><fill><patternFill patternType="none"/></fill>'
  + '<fill><patternFill patternType="gray125"/></fill></fills>'
  + '<borders count="1"><border/></borders>'
  + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
  + '<cellXfs count="3">'
  + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
  + '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
  + '<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
  + '</cellXfs>'
  // Sin <cellStyles> Excel considera el libro incompleto y ofrece repararlo.
  + '<cellStyles count=\'1\'><cellStyle name=\'Normal\' xfId=\'0\' builtinId=\'0\'/></cellStyles>'
  + '</styleSheet>';

/** Excel rechaza estos caracteres en el nombre de una pestaña, y la corta a 31. */
function nombreHoja(titulo, usados) {
  let base = String(titulo || 'Hoja').replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Hoja';
  let nombre = base;
  let i = 2;
  while (usados.has(nombre)) {
    const sufijo = ` ${i++}`;
    nombre = base.slice(0, 31 - sufijo.length) + sufijo;
  }
  usados.add(nombre);
  return nombre;
}

/**
 * Arma y descarga un .xlsx con una pestaña por bloque.
 *
 * @param {string} nombre  nombre del archivo, sin extensión
 * @param {Array<{titulo?:string, cabeceras?:string[], filas:Array<Array>, moneda?:number[]}>} bloques
 * @returns {number} cuántas filas de datos se escribieron
 */
export function descargaXlsx(nombre, bloques) {
  const utiles = (bloques || []).filter((b) => b && (b.filas || []).length);
  if (!utiles.length) return 0;

  const usados = new Set();
  const hojas = utiles.map((b, i) => ({
    nombre: nombreHoja(b.titulo, usados),
    archivo: `xl/worksheets/sheet${i + 1}.xml`,
    xml: hojaXml(b),
  }));

  const tipos = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    + hojas.map((h) => `<Override PartName="/${h.archivo}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
    + '</Types>';

  const rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
    + '</Relationships>';

  const libro = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
    + ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'
    + hojas.map((h, i) => `<sheet name="${esc(h.nombre)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')
    + '</sheets></workbook>';

  const libroRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + hojas.map((h, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')
    + `<Relationship Id="rId${hojas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`
    + '</Relationships>';

  const blob = zip([
    { nombre: '[Content_Types].xml', texto: tipos },
    { nombre: '_rels/.rels', texto: rels },
    { nombre: 'xl/workbook.xml', texto: libro },
    { nombre: 'xl/_rels/workbook.xml.rels', texto: libroRels },
    { nombre: 'xl/styles.xml', texto: ESTILOS },
    ...hojas.map((h) => ({ nombre: h.archivo, texto: h.xml })),
  ]);

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nombre}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);

  return utiles.reduce((s, b) => s + b.filas.length, 0);
}
