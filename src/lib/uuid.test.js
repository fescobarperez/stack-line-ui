import { afterEach, describe, expect, it, vi } from 'vitest';
import { uuid } from './uuid.js';

const FORMA = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('uuid', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('usa randomUUID cuando existe', () => {
    expect(uuid()).toMatch(FORMA);
  });

  it('sin randomUUID (HTTP, no seguro) arma uno v4 con getRandomValues', () => {
    vi.stubGlobal('crypto', { getRandomValues: (a) => { a.fill(171); return a; } });
    const u = uuid();
    expect(u).toMatch(FORMA);
  });

  it('sin crypto en absoluto también funciona', () => {
    vi.stubGlobal('crypto', undefined);
    expect(uuid()).toMatch(FORMA);
    expect(uuid()).not.toBe(uuid());
  });
});
