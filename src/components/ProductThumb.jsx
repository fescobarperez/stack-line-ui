// Foto del producto, o sus iniciales si no tiene. La imagen pide token, así que
// se baja como Blob; se guarda en memoria por producto + versión + tamaño para
// no volver a pedirla al cambiar de pestaña o filtrar el POS.
import React, { useEffect, useRef, useState } from 'react';
import { getProductImage } from '../api/catalog.js';

const cache = new Map(); // clave → Promise<string|null> (object URL)

function clave(id, v, size) { return `${id}:${v}:${size}`; }

export function productImageUrl(id, v, size) {
  const k = clave(id, v, size);
  if (!cache.has(k)) {
    cache.set(k, getProductImage(id, { size, v })
      .then((blob) => (blob ? URL.createObjectURL(blob) : null))
      .catch(() => { cache.delete(k); return null; }));
  }
  return cache.get(k);
}

/** Para pruebas. */
export function _resetProductImageCache() { cache.clear(); }

export function iniciales(name) {
  return (name || '').trim().slice(0, 2).toUpperCase();
}

/**
 * product: { id, name, imageVersion }. size: 'thumb' | 'full'.
 * className se aplica al contenedor tanto con foto como con iniciales.
 */
export default function ProductThumb({ product, size = 'thumb', className = '', alt }) {
  const v = product?.imageVersion;
  const id = product?.id;
  const [url, setUrl] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    setUrl(null);
    if (id == null || v == null) return undefined;
    let vigente = true;
    const cargar = () => productImageUrl(id, v, size).then((u) => { if (vigente) setUrl(u); });
    // En una grilla larga solo se piden las que se ven.
    const el = ref.current;
    if (el && typeof IntersectionObserver === 'function') {
      const io = new IntersectionObserver((entradas) => {
        if (entradas.some((e) => e.isIntersecting)) { io.disconnect(); cargar(); }
      }, { rootMargin: '200px' });
      io.observe(el);
      return () => { vigente = false; io.disconnect(); };
    }
    cargar();
    return () => { vigente = false; };
  }, [id, v, size]);

  if (url) {
    return (
      <span ref={ref} className={`prod-thumb has-img ${className}`}>
        <img src={url} alt={alt ?? product?.name ?? ''} draggable="false" />
      </span>
    );
  }
  return <span ref={ref} className={`prod-thumb ${className}`} aria-hidden="true">{iniciales(product?.name)}</span>;
}
