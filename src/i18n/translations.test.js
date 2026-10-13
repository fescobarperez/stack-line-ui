import { describe, expect, it } from 'vitest';
import es from './locales/es/translation.json';
import en from './locales/en/translation.json';

/**
 * Las pantallas usan t('clave', 'Texto español'): si una clave falta en
 * inglés, la interfaz en inglés muestra español. Esto lo detecta.
 */
function claves(obj, prefijo = '') {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? claves(v, `${prefijo}${k}.`) : [`${prefijo}${k}`]);
}

describe('traducciones', () => {
  it('cada clave en español existe en inglés', () => {
    const enKeys = new Set(claves(en));
    expect(claves(es).filter((k) => !enKeys.has(k))).toEqual([]);
  });

  it('cada clave en inglés existe en español', () => {
    const esKeys = new Set(claves(es));
    expect(claves(en).filter((k) => !esKeys.has(k))).toEqual([]);
  });

  it('incluye las claves del precio por medida', () => {
    for (const k of ['quotes.sizePriced', 'quotes.sizeReview', 'config.quotes.sizeFixedPct', 'config.quotes.sizeTolerancePct']) {
      expect(claves(es)).toContain(k);
    }
  });
});
