// Minimal Home Assistant Lovelace typings — we only need the surface the cards
// actually touch, avoiding a hard dependency on HA's internal types.

export interface LovelaceCardConfig {
  type: string;
  [key: string]: unknown;
}

export interface LovelaceCard extends HTMLElement {
  hass?: unknown;
  setConfig(config: LovelaceCardConfig): void;
  getCardSize?(): number | Promise<number>;
}

/** The slice of HA's `hass` object we need — its own access token, to authenticate against the evcc Proxy integration. */
export interface HomeAssistantLike {
  auth?: { data?: { access_token?: string } };
}

export interface EvccBaseConfig extends LovelaceCardConfig {
  /** evcc base URL, e.g. http://evcc.local:7070 */
  url: string;
  /** `evcc_` API key for authenticated writes (reads work without it). */
  api_key?: string;
  /** Optional card title override. */
  title?: string;
}

export interface EvccCardDefinition {
  type: string;
  name: string;
  description: string;
  preview?: boolean;
}

/** Registers a card in HA's "Add card" picker. */
export function registerCard(def: EvccCardDefinition): void {
  const w = window as unknown as { customCards?: EvccCardDefinition[] };
  w.customCards = w.customCards || [];
  w.customCards.push({ preview: true, ...def });
}
