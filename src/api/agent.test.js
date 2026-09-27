import { describe, it, expect, vi } from 'vitest';
import { crearAgentClient, armarTurno, RUTA_TURNO } from './agent.js';
import { crearSimulador } from '../assistant/simulator.js';

const llave = () => 'llave-fija';

describe('armarTurno', () => {
  it('arma el cuerpo sin empresa, usuario ni alcance', () => {
    const body = armarTurno({ conversationId: null, input: { type: 'text', text: 'hola' }, nuevaLlave: llave });
    expect(body).toMatchObject({
      channel: 'erp',
      conversation_ref: { external_id: null },
      input: { type: 'text', text: 'hola' },
      idempotency_key: 'llave-fija',
    });
    expect(body.capabilities.panel).toBe(true);
    expect(body).not.toHaveProperty('tenant_id');
    expect(body).not.toHaveProperty('scope');
  });
});

describe('agentClient real', () => {
  it('llama a la ruta del ERP en silencio y con señal de corte', async () => {
    const http = { post: vi.fn().mockResolvedValue({ conversation_id: 'cnv_1', events: [] }) };
    const cliente = crearAgentClient({ simulado: false, http });
    const body = armarTurno({ input: { type: 'text', text: 'x' }, nuevaLlave: llave });

    await cliente.turn(body);

    expect(http.post).toHaveBeenCalledWith(RUTA_TURNO, body, expect.objectContaining({ silent: true }));
    expect(http.post.mock.calls[0][2].signal).toBeInstanceOf(AbortSignal);
  });

  it('corta la petición al vencer el tiempo límite', async () => {
    let senal;
    const http = {
      post: vi.fn((_r, _b, { signal }) => {
        senal = signal;
        return new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('abort'))));
      }),
    };
    const cliente = crearAgentClient({ simulado: false, http, tiempoLimiteMs: 10 });
    await expect(cliente.turn({})).rejects.toThrow('abort');
    expect(senal.aborted).toBe(true);
  });
});

describe('simulador', () => {
  const cliente = () => crearAgentClient({ simulado: true, simulador: crearSimulador({ demoraMs: 0 }) });
  const turno = (c, k) => c.turn({ idempotency_key: k });
  const tarjetas = (r) => r.events.filter((e) => e.type === 'card').map((e) => e.card);

  it('recorre el guion: productos → cliente → cotización → enviada', async () => {
    const c = cliente();
    expect(tarjetas(await turno(c, 'a'))).toEqual(['product_results']);
    expect(tarjetas(await turno(c, 'b'))).toEqual(['customer']);
    expect(tarjetas(await turno(c, 'c'))).toEqual(['quote_preview']);
    expect(tarjetas(await turno(c, 'd'))).toEqual(['quote_sent']);
  });

  it('la misma llave devuelve lo mismo sin avanzar el guion', async () => {
    const c = cliente();
    const uno = await turno(c, 'a');
    const otra = await turno(c, 'a');
    expect(otra).toBe(uno);
    expect(tarjetas(await turno(c, 'b'))).toEqual(['customer']);
  });

  it('reset vuelve al inicio', async () => {
    const c = cliente();
    await turno(c, 'a');
    c.reset();
    expect(tarjetas(await turno(c, 'z'))).toEqual(['product_results']);
  });

  it('el impuesto llega con su etiqueta en el evento', async () => {
    const c = cliente();
    await turno(c, 'a');
    await turno(c, 'b');
    const r = await turno(c, 'c');
    const cot = r.events.find((e) => e.card === 'quote_preview').data;
    expect(cot.tax_label).toBeTruthy();
    expect(cot.total).toBeTruthy();
  });
});
