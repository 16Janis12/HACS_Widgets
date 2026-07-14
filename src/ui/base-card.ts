import { LitElement, css, html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { EvccController } from '../core/controller';
import type { EvccBaseConfig } from '../core/ha';
import type { EvccState } from '../core/types';
import { shell, tokens } from './styles';

/**
 * Common base for every evcc card: parses config, wires the shared reactive
 * controller, and renders the frame + loading/error states. Subclasses only
 * implement `renderBody()` and (optionally) `headerSub()` / `activeState()`.
 */
export abstract class EvccBaseCard extends LitElement {
  @property({ attribute: false }) hass?: unknown;
  @state() protected config!: EvccBaseConfig;
  @state() protected writeError?: string;
  protected ctrl?: EvccController;

  /** Control cards set this so the header can warn when no API key is present. */
  protected requiresAuth = false;

  static styles = [
    tokens,
    shell,
    css`
      .ro {
        font-size: 0.62rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--e-muted);
        border: 1px solid var(--e-divider);
        border-radius: 6px;
        padding: 2px 6px;
      }
      .write-error {
        margin-top: 10px;
        font-size: 0.78rem;
        color: var(--e-grid);
      }
    `,
  ];

  setConfig(config: EvccBaseConfig) {
    if (!config?.url) {
      throw new Error('evcc card: "url" is required (e.g. http://evcc.local:7070)');
    }
    this.config = config;
    // Re-create the controller if connection params changed.
    if (this.ctrl) this.removeController(this.ctrl);
    this.ctrl = new EvccController(this, config.url, config.api_key);
  }

  getCardSize(): number {
    return 3;
  }

  /** Visual editor shown in the Lovelace "Edit card" dialog. */
  static getConfigElement(): HTMLElement {
    return document.createElement('evcc-card-editor');
  }

  /** Sensible defaults when a card is added from the picker. */
  static getStubConfig(): Partial<EvccBaseConfig> {
    return { url: 'http://evcc.local:7070' };
  }

  protected get state(): EvccState | null {
    return this.ctrl?.status.state ?? null;
  }

  /** Cards that write need the API client. */
  protected get client() {
    return this.ctrl!.client;
  }

  /**
   * Run a write, surfacing failures inline. The store's live socket/poll pulls
   * in the confirmed value, so cards apply their own optimistic value meanwhile.
   */
  protected async write(fn: () => Promise<unknown>): Promise<void> {
    this.writeError = undefined;
    try {
      await fn();
    } catch (e) {
      this.writeError = (e as Error).message;
      this.requestUpdate();
    }
  }

  protected get hasAuth(): boolean {
    return !!this.ctrl?.client.hasAuth();
  }

  /** Optional subtitle shown in the header. */
  protected headerSub(): string | undefined {
    return undefined;
  }

  /** Whether the card should show its "active" accent (e.g. charging). */
  protected activeState(_state: EvccState): boolean {
    return false;
  }

  protected abstract cardTitle(): string;
  protected abstract renderBody(state: EvccState): TemplateResult | typeof nothing;

  protected renderHeader(): TemplateResult {
    const sub = this.headerSub();
    return html`
      <div class="head">
        <div>
          <div class="title">${this.config.title ?? this.cardTitle()}</div>
          ${sub ? html`<div class="sub">${sub}</div>` : nothing}
        </div>
        <div class="spacer"></div>
        ${this.requiresAuth && !this.hasAuth
          ? html`<span class="ro" title="No API key configured — controls are disabled"
              >read-only</span
            >`
          : nothing}
        <div class="live ${this.ctrl?.status.connected ? 'on' : ''}" title="live"></div>
      </div>
    `;
  }

  protected renderError(): TemplateResult {
    const s = this.ctrl!.status;
    return html`
      <div class="error rise">
        <strong>evcc unreachable.</strong>
        <div>${s.error}</div>
        ${s.isMixedContentError
          ? html`<div style="margin-top:6px">
              This dashboard is https:// but evcc's URL is http:// — browsers
              block that as <em>mixed content</em> (not CORS). Put evcc behind
              a TLS-terminating proxy, e.g. Caddy (auto-HTTPS, one block) —
              see the README, then change the card's <code>url</code> to the
              https:// address.
            </div>`
          : s.isCorsError
            ? html`<div style="margin-top:6px">
                This is usually CORS. Add
                <code>Access-Control-Allow-Origin</code> for this dashboard's
                origin in front of evcc, or route writes through Home
                Assistant — see the README.
              </div>`
            : nothing}
      </div>
    `;
  }

  render() {
    if (!this.ctrl) return nothing;
    const s = this.ctrl.status;
    const active = s.state ? this.activeState(s.state) : false;
    return html`
      <div class="card ${active ? 'is-active' : ''}">
        ${this.renderHeader()}
        ${s.state
          ? this.renderBody(s.state)
          : s.error
            ? this.renderError()
            : html`<div class="label rise">Connecting to evcc…</div>`}
        ${this.writeError
          ? html`<div class="write-error">⚠ ${this.writeError}</div>`
          : nothing}
      </div>
    `;
  }
}
