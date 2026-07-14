import { afterEach, describe, expect, it, vi } from 'vitest';
import { EvccApiClient, EvccApiError } from './api';

function mockFetch(impl: (url: string, init: RequestInit) => Partial<Response>) {
  const spy = vi.fn(async (url: string, init: RequestInit) => {
    const r = impl(url, init);
    return {
      ok: true,
      status: 200,
      json: async () => ({}),
      ...r,
    } as Response;
  });
  vi.stubGlobal('fetch', spy);
  return spy;
}

afterEach(() => vi.unstubAllGlobals());

describe('EvccApiClient', () => {
  it('builds api + ws base from url, trimming slashes', () => {
    const c = new EvccApiClient({ url: 'http://evcc.local:7070/' });
    expect(c.apiBase).toBe('http://evcc.local:7070/api');
    expect(c.wsBase).toBe('ws://evcc.local:7070');
  });

  it('unwraps { result } envelopes', async () => {
    mockFetch(() => ({ json: async () => ({ result: { pvPower: 42 } }) }));
    const c = new EvccApiClient({ url: 'http://x' });
    await expect(c.getState()).resolves.toEqual({ pvPower: 42 });
  });

  it('sends bearer auth only when a key is set', async () => {
    const spy = mockFetch(() => ({ status: 204 }));
    const c = new EvccApiClient({ url: 'http://x', apiKey: 'evcc_abc' });
    await c.setMode(1, 'pv');
    const [url, init] = spy.mock.calls[0];
    expect(url).toBe('http://x/api/loadpoints/1/mode/pv');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer evcc_abc');
    expect(c.hasAuth()).toBe(true);
  });

  it('maps a rejected fetch to a CORS EvccApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    const c = new EvccApiClient({ url: 'http://x' });
    await expect(c.getState()).rejects.toMatchObject({ isCors: true });
    await expect(c.getState()).rejects.toBeInstanceOf(EvccApiError);
  });

  it('maps 401/403 to an auth error', async () => {
    mockFetch(() => ({ ok: false, status: 403 }));
    const c = new EvccApiClient({ url: 'http://x', apiKey: 'evcc_x' });
    await expect(c.setBatteryMode('hold')).rejects.toMatchObject({ status: 403 });
  });

  it('encodes vehicle names in paths', async () => {
    const spy = mockFetch(() => ({ status: 204 }));
    const c = new EvccApiClient({ url: 'http://x' });
    await c.setVehicleLimitSoc('My Car', 80);
    expect(spy.mock.calls[0][0]).toBe('http://x/api/vehicles/My%20Car/limitsoc/80');
  });
});
