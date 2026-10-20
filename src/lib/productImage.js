// Foto del producto: el navegador la reduce antes de subirla, así el ERP guarda
// ~100 KB en vez de una foto de celular de 5 MB. Se mandan dos versiones: la
// completa (detalle) y una miniatura cuadrada (POS y listados).

export const FULL_PX = 1000;
export const THUMB_PX = 240;
/** Lo más grande que se acepta elegir; luego se reduce. */
export const MAX_INPUT_BYTES = 15 * 1024 * 1024;
export const ACCEPT = 'image/jpeg,image/png,image/webp';
const TIPOS = ACCEPT.split(',');

/** Medidas que caben en `max` sin agrandar ni deformar. */
export function encajar(w, h, max) {
  if (!(w > 0) || !(h > 0)) return { w: 0, h: 0 };
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

/** Recorte cuadrado centrado (la miniatura llena su casilla). */
export function recorteCuadrado(w, h) {
  const lado = Math.min(w, h);
  return { sx: Math.round((w - lado) / 2), sy: Math.round((h - lado) / 2), lado };
}

/** null si el archivo sirve; si no, la clave del error. */
export function validarArchivo(file) {
  if (!file) return 'productImage.err.none';
  if (!TIPOS.includes(file.type)) return 'productImage.err.type';
  if (file.size > MAX_INPUT_BYTES) return 'productImage.err.size';
  return null;
}

function aBlob(canvas, tipo, calidad) {
  return new Promise((resolve) => canvas.toBlob(resolve, tipo, calidad));
}

/** WebP si el navegador lo genera; si no (Safari viejo), JPEG. */
async function codificar(canvas) {
  const webp = await aBlob(canvas, 'image/webp', 0.85);
  if (webp && webp.type === 'image/webp') return webp;
  return aBlob(canvas, 'image/jpeg', 0.85);
}

export function blobABase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function cargar(file) {
  if (typeof createImageBitmap === 'function') {
    // imageOrientation respeta la rotación EXIF de las fotos de celular.
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* sigue con <img> */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Archivo → { upload, previewUrl }. `upload` es el cuerpo para
 * uploadProductImage. Quien la usa revoca previewUrl al terminar.
 */
export async function prepararImagen(file) {
  const fuente = await cargar(file);
  const w = fuente.width || fuente.naturalWidth;
  const h = fuente.height || fuente.naturalHeight;

  const m = encajar(w, h, FULL_PX);
  const full = document.createElement('canvas');
  full.width = m.w; full.height = m.h;
  full.getContext('2d').drawImage(fuente, 0, 0, m.w, m.h);

  const { sx, sy, lado } = recorteCuadrado(w, h);
  const t = Math.min(THUMB_PX, lado);
  const mini = document.createElement('canvas');
  mini.width = t; mini.height = t;
  mini.getContext('2d').drawImage(fuente, sx, sy, lado, lado, 0, 0, t, t);
  if (typeof fuente.close === 'function') fuente.close();

  const [fb, tb] = await Promise.all([codificar(full), codificar(mini)]);
  if (!fb || !tb) throw new Error('No se pudo procesar la imagen');
  const [imageBase64, thumbBase64] = await Promise.all([blobABase64(fb), blobABase64(tb)]);
  return {
    upload: { imageBase64, imageMime: fb.type, thumbBase64, thumbMime: tb.type },
    previewUrl: URL.createObjectURL(fb),
  };
}
