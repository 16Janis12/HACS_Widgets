import { EvccApiClient } from './api';
import { EvccStore } from './store';

interface Entry {
  client: EvccApiClient;
  store: EvccStore;
  key: string;
}

const registry = new Map<string, Entry>();

/**
 * Shares one EvccApiClient + EvccStore (and thus one WebSocket + poll loop)
 * across every card on the page pointing at the same evcc URL. Keyed by
 * url + apiKey so an authenticated card and an anonymous card to the same host
 * don't collide.
 */
export function getEvccHub(
  url: string,
  apiKey?: string,
  fetchWithAuth?: (path: string, init?: RequestInit) => Promise<Response>,
): Entry {
  const key = `${url.replace(/\/+$/, '')}::${apiKey ?? ''}`;
  let entry = registry.get(key);
  if (!entry) {
    const client = new EvccApiClient({ url, apiKey, fetchWithAuth });
    entry = { client, store: new EvccStore(client), key };
    registry.set(key, entry);
  }
  return entry;
}
