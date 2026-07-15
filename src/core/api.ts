import type { BatteryMode, ChargeMode, EvccState, GridSession, TariffSlot } from './types';

export interface EvccApiConfig {
  /**
   * Base URL of the evcc instance, e.g. `http://evcc.local:7070`. Set this to
   * a relative path instead (e.g. `/api/evcc_proxy/<slug>`) to route through
   * the evcc Proxy Home Assistant integration — see the README. In that case
   * `fetchWithAuth` is used instead of `apiKey`.
   */
  url: string;
  /** Long-lived `evcc_` API key for authenticated writes (optional; reads are public). Ignored when `url` is a proxy path. */
  apiKey?: string;
  /**
   * HA's `hass.fetchWithAuth` — attaches (and silently refreshes) the user's
   * access token itself, so we never touch the token directly. The
   * `hass.auth.data.access_token` field this used to read is internal and not
   * guaranteed to exist across HA frontend versions; `fetchWithAuth` is the
   * stable path custom cards are meant to use for same-origin HA requests.
   */
  fetchWithAuth?: (path: string, init?: RequestInit) => Promise<Response>;
}

export class EvccApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly isCors = false,
    readonly isMixedContent = false,
  ) {
    super(message);
    this.name = 'EvccApiError';
  }
}

/**
 * Thin, typed wrapper around the evcc REST API. Methods map 1:1 to endpoints.
 * Reads (`/api/state`, `/api/tariff`) are public; writes require an `evcc_`
 * bearer key. A network error on a same-page cross-origin request is surfaced
 * as an `EvccApiError` with `isCors` so cards can show actionable guidance.
 */
export class EvccApiClient {
  private readonly base: string;
  private readonly apiKey?: string;
  private readonly fetchWithAuth?: (path: string, init?: RequestInit) => Promise<Response>;

  constructor(config: EvccApiConfig) {
    this.base = config.url.replace(/\/+$/, '');
    this.apiKey = config.apiKey?.trim() || undefined;
    this.fetchWithAuth = config.fetchWithAuth;
  }

  /**
   * True when `url` points at the evcc Proxy integration (relative, e.g.
   * `/api/evcc_proxy/<slug>`, or absolute, e.g.
   * `https://ha.example.com/api/evcc_proxy/<slug>`) rather than directly at
   * evcc.
   */
  private get isProxied(): boolean {
    return !/^https?:\/\//i.test(this.base) || /\/api\/evcc_proxy\//i.test(this.base);
  }

  get apiBase(): string {
    return `${this.base}/api`;
  }

  /** ws(s):// origin for the live socket. Live updates aren't proxied — a relative `base` here yields an invalid WebSocket URL, and the store falls back to polling. */
  get wsBase(): string {
    return this.base.replace(/^http/, 'ws');
  }

  hasAuth(): boolean {
    return this.isProxied ? !!this.fetchWithAuth : !!this.apiKey;
  }

  private headers(): HeadersInit {
    const h: Record<string, string> = { Accept: 'application/json' };
    // Never send the evcc api key to the HA proxy — auth there runs through
    // fetchWithAuth (HA's own token), which sets its own Authorization header.
    if (!this.isProxied && this.apiKey) h.Authorization = `Bearer ${this.apiKey}`;
    return h;
  }

  /** True when the dashboard is on https:// but evcc's URL is plain http:// — the browser blocks this as mixed content before any request (or CORS check) happens. */
  private isMixedContentBlocked(): boolean {
    return (
      typeof window !== 'undefined' &&
      window.location?.protocol === 'https:' &&
      this.base.startsWith('http://')
    );
  }

  private async request<T>(method: string, path: string): Promise<T> {
    if (this.isMixedContentBlocked()) {
      throw new EvccApiError(
        `Cannot reach evcc at ${this.base}: this dashboard is loaded over https:// but evcc's URL is http://, and browsers block that ("mixed active content") before the request is even sent. This is not CORS. Serve evcc over https:// instead (see README).`,
        undefined,
        false,
        true,
      );
    }
    const fullPath = `${this.apiBase}${path}`;
    let res: Response;
    try {
      res =
        this.isProxied && this.fetchWithAuth
          ? await this.fetchWithAuth(fullPath, { method, headers: this.headers() })
          : await fetch(fullPath, { method, headers: this.headers(), mode: 'cors' });
    } catch {
      // A rejected fetch (not an HTTP error) on a cross-origin call is almost
      // always CORS or an unreachable host.
      throw new EvccApiError(
        `Cannot reach evcc at ${this.base}. Check the URL, or enable CORS on evcc (see README).`,
        undefined,
        true,
      );
    }
    if (res.status === 401 || res.status === 403) {
      throw new EvccApiError(
        this.isProxied
          ? 'Home Assistant rejected the proxy request — reload the dashboard (hass session token missing or expired) and check the slug in the URL.'
          : 'evcc rejected the request — API key missing or invalid.',
        res.status,
      );
    }
    if (!res.ok) {
      throw new EvccApiError(`evcc returned HTTP ${res.status} for ${method} ${path}`, res.status);
    }
    if (res.status === 204) return undefined as T;
    const body = await res.json().catch(() => undefined);
    // evcc wraps some responses in { result: ... }; unwrap transparently.
    return body && typeof body === 'object' && 'result' in body ? body.result : body;
  }

  // ---- Reads -------------------------------------------------------------
  getState(): Promise<EvccState> {
    return this.request<EvccState>('GET', '/state');
  }

  getTariff(type: 'grid' | 'feedin' | 'co2' | 'planner' | 'solar'): Promise<TariffSlot[]> {
    return this.request<{ rates?: TariffSlot[] } | TariffSlot[]>('GET', `/tariff/${type}`).then(
      (r) => (Array.isArray(r) ? r : (r?.rates ?? [])),
    );
  }

  getGridSessions(): Promise<GridSession[]> {
    return this.request<GridSession[]>('GET', '/gridsessions').catch(() => []);
  }

  // ---- Loadpoint control -------------------------------------------------
  setMode(lp: number, mode: ChargeMode) {
    return this.request('POST', `/loadpoints/${lp}/mode/${mode}`);
  }
  setLimitSoc(lp: number, soc: number) {
    return this.request('POST', `/loadpoints/${lp}/limitsoc/${soc}`);
  }
  setLimitEnergy(lp: number, kWh: number) {
    return this.request('POST', `/loadpoints/${lp}/limitenergy/${kWh}`);
  }
  setMinCurrent(lp: number, a: number) {
    return this.request('POST', `/loadpoints/${lp}/mincurrent/${a}`);
  }
  setMaxCurrent(lp: number, a: number) {
    return this.request('POST', `/loadpoints/${lp}/maxcurrent/${a}`);
  }
  setPhases(lp: number, phases: 0 | 1 | 3) {
    return this.request('POST', `/loadpoints/${lp}/phases/${phases}`);
  }
  setLoadpointSmartCostLimit(lp: number, cost: number) {
    return this.request('POST', `/loadpoints/${lp}/smartcostlimit/${cost}`);
  }
  clearLoadpointSmartCostLimit(lp: number) {
    return this.request('DELETE', `/loadpoints/${lp}/smartcostlimit`);
  }

  // ---- Vehicle & plan ----------------------------------------------------
  assignVehicle(lp: number, name: string) {
    return this.request('POST', `/loadpoints/${lp}/vehicle/${encodeURIComponent(name)}`);
  }
  detectVehicle(lp: number) {
    return this.request('PATCH', `/loadpoints/${lp}/vehicle`);
  }
  removeVehicle(lp: number) {
    return this.request('DELETE', `/loadpoints/${lp}/vehicle`);
  }
  setVehicleLimitSoc(name: string, soc: number) {
    return this.request('POST', `/vehicles/${encodeURIComponent(name)}/limitsoc/${soc}`);
  }
  setVehicleMinSoc(name: string, soc: number) {
    return this.request('POST', `/vehicles/${encodeURIComponent(name)}/minsoc/${soc}`);
  }
  setVehiclePlan(name: string, soc: number, timestamp: string) {
    return this.request(
      'POST',
      `/vehicles/${encodeURIComponent(name)}/plan/soc/${soc}/${timestamp}`,
    );
  }
  clearVehiclePlan(name: string) {
    return this.request('DELETE', `/vehicles/${encodeURIComponent(name)}/plan/soc`);
  }

  // ---- Battery / site ----------------------------------------------------
  setBatteryMode(mode: BatteryMode | 'normal' | 'hold' | 'charge') {
    return this.request('POST', `/batterymode/${mode}`);
  }
  clearBatteryMode() {
    return this.request('DELETE', '/batterymode');
  }
  setBufferSoc(soc: number) {
    return this.request('POST', `/buffersoc/${soc}`);
  }
  setBufferStartSoc(soc: number) {
    return this.request('POST', `/bufferstartsoc/${soc}`);
  }
  setPrioritySoc(soc: number) {
    return this.request('POST', `/prioritysoc/${soc}`);
  }
  setBatteryGridChargeLimit(cost: number) {
    return this.request('POST', `/batterygridchargelimit/${cost}`);
  }
  clearBatteryGridChargeLimit() {
    return this.request('DELETE', '/batterygridchargelimit');
  }

  // ---- External control (§14a EnWG / §9 EEG) -----------------------------
  setSmartCostLimit(cost: number) {
    return this.request('POST', `/smartcostlimit/${cost}`);
  }
  clearSmartCostLimit() {
    return this.request('DELETE', '/smartcostlimit');
  }
  setSmartFeedInPriorityLimit(cost: number) {
    return this.request('POST', `/smartfeedinprioritylimit/${cost}`);
  }
  clearSmartFeedInPriorityLimit() {
    return this.request('DELETE', '/smartfeedinprioritylimit');
  }
  setResidualPower(power: number) {
    return this.request('POST', `/residualpower/${power}`);
  }
}
