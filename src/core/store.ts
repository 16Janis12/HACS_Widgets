import { EvccApiClient, EvccApiError } from './api';
import type { EvccState } from './types';

export interface EvccStoreStatus {
  state: EvccState | null;
  connected: boolean; // live socket up
  error: string | null;
  isCorsError: boolean;
}

type Listener = (status: EvccStoreStatus) => void;

const RECONCILE_MS = 15_000; // slow full poll while WS is healthy
const POLL_MS = 5_000; // faster poll when WS is unavailable

/**
 * Holds the live evcc state for one instance. Strategy:
 *  - initial `/api/state` fetch,
 *  - WebSocket carries incremental key updates (merged shallow; `loadpoints`
 *    array replaced wholesale),
 *  - a slow full poll reconciles any drift and covers WS payload variations,
 *  - if the socket cannot stay up we fall back to a faster poll.
 * The socket handshake is not subject to CORS, so live updates work even when
 * cross-origin writes need a proxy.
 */
export class EvccStore {
  private listeners = new Set<Listener>();
  private status: EvccStoreStatus = {
    state: null,
    connected: false,
    error: null,
    isCorsError: false,
  };
  private ws?: WebSocket;
  private pollTimer?: number;
  private reconnectTimer?: number;
  private stopped = false;

  constructor(readonly client: EvccApiClient) {}

  get snapshot(): EvccStoreStatus {
    return this.status;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.status);
    if (this.listeners.size === 1) this.start();
    return () => {
      this.listeners.delete(fn);
      if (this.listeners.size === 0) this.stop();
    };
  }

  get hasSubscribers(): boolean {
    return this.listeners.size > 0;
  }

  private emit(patch: Partial<EvccStoreStatus>) {
    this.status = { ...this.status, ...patch };
    for (const fn of this.listeners) fn(this.status);
  }

  private start() {
    this.stopped = false;
    void this.refetch();
    this.connectSocket();
    this.schedulePoll(RECONCILE_MS);
  }

  private stop() {
    this.stopped = true;
    this.ws?.close();
    this.ws = undefined;
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
  }

  private schedulePoll(interval: number) {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = window.setInterval(() => void this.refetch(), interval);
  }

  private async refetch() {
    try {
      const state = await this.client.getState();
      this.emit({ state, error: null, isCorsError: false });
    } catch (e) {
      const err = e as EvccApiError;
      this.emit({ error: err.message, isCorsError: !!err.isCors });
    }
  }

  private connectSocket() {
    try {
      const ws = new WebSocket(`${this.client.wsBase}/ws`);
      this.ws = ws;
      ws.addEventListener('open', () => this.emit({ connected: true }));
      ws.addEventListener('message', (ev) => this.onMessage(ev.data));
      ws.addEventListener('close', () => this.onSocketDown());
      ws.addEventListener('error', () => ws.close());
    } catch {
      this.onSocketDown();
    }
  }

  private onSocketDown() {
    if (this.stopped) return;
    if (this.status.connected) this.emit({ connected: false });
    // Poll faster while the socket is down, and try to reconnect.
    this.schedulePoll(POLL_MS);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = window.setTimeout(() => {
      if (!this.stopped) this.connectSocket();
    }, POLL_MS);
  }

  private onMessage(raw: string) {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    const next: EvccState = { ...(this.status.state ?? {}) };
    for (const [k, v] of Object.entries(msg)) {
      next[k] = v as never;
    }
    if (!this.status.connected) this.emit({ state: next, connected: true });
    else this.emit({ state: next });
    // Keep the reconcile cadence while healthy.
    this.schedulePoll(RECONCILE_MS);
  }
}
