import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { getEvccHub } from './hub';
import type { EvccApiClient } from './api';
import type { EvccStoreStatus } from './store';

/**
 * Lit reactive controller that binds a card host to the shared store for a
 * given evcc URL, requesting a re-render whenever the live state changes.
 */
export class EvccController implements ReactiveController {
  private unsub?: () => void;
  status: EvccStoreStatus = {
    state: null,
    connected: false,
    error: null,
    isCorsError: false,
    isMixedContentError: false,
  };
  client!: EvccApiClient;

  constructor(
    private host: ReactiveControllerHost,
    private url: string,
    private apiKey?: string,
  ) {
    host.addController(this);
  }

  hostConnected() {
    const hub = getEvccHub(this.url, this.apiKey);
    this.client = hub.client;
    this.unsub = hub.store.subscribe((s) => {
      this.status = s;
      this.host.requestUpdate();
    });
  }

  hostDisconnected() {
    this.unsub?.();
  }
}
