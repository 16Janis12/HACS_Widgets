import { css, html, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { EvccBaseCard } from '../ui/base-card';
import type { EvccState, GridSession } from '../core/types';
import { registerCard } from '../core/ha';
import { ICON } from '../ui/icons';
import '../ui/slider-row';

/**
 * External control panel for §14a EnWG / §9 EEG scenarios: smart cost limit,
 * feed-in priority limit, battery grid-charge limit and residual grid power,
 * plus a log of recent grid-limitation events. All writes require an API key.
 *
 * Values are in ct/kWh in the UI and sent to evcc as currency/kWh.
 */
@customElement('evcc-external-control-card')
export class EvccExternalControlCard extends EvccBaseCard {
  @state() private sessions: GridSession[] = [];
  protected override requiresAuth = true;
  private timer?: number;

  static styles = [
    ...EvccBaseCard.styles,
    css`
      .intro {
        display: flex;
        gap: 10px;
        align-items: flex-start;
        font-size: 0.8rem;
        color: var(--e-muted);
        line-height: 1.4;
        margin-bottom: 12px;
      }
      .intro svg {
        width: 18px;
        height: 18px;
        fill: var(--e-accent);
        flex: none;
        margin-top: 1px;
      }
      .group {
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid var(--e-divider);
      }
      .events {
        margin-top: 14px;
        padding-top: 12px;
        border-top: 1px solid var(--e-divider);
      }
      .events h4 {
        margin: 0 0 8px;
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--e-muted);
        font-weight: 700;
      }
      .ev {
        display: flex;
        justify-content: space-between;
        font-size: 0.78rem;
        padding: 4px 0;
        font-variant-numeric: tabular-nums;
      }
      .ev .on {
        color: var(--e-grid);
        font-weight: 600;
      }
    `,
  ];

  protected cardTitle(): string {
    return 'External Control';
  }
  protected headerSub(): string {
    return '§14a EnWG · §9 EEG';
  }

  connectedCallback(): void {
    super.connectedCallback();
    void this.loadSessions();
    this.timer = window.setInterval(() => void this.loadSessions(), 5 * 60 * 1000);
  }
  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.timer) clearInterval(this.timer);
  }

  private async loadSessions() {
    if (!this.ctrl) return;
    this.sessions = (await this.client.getGridSessions().catch(() => [])).slice(0, 4);
  }

  // ct/kWh in UI ↔ currency/kWh in evcc
  private toCt(v: number | null | undefined) {
    return v == null ? 0 : Math.round(v * 100);
  }

  protected renderBody(s: EvccState): TemplateResult | typeof nothing {
    const disabled = this.requiresAuth && !this.hasAuth;
    const cur = s.currency === 'EUR' || !s.currency ? 'ct' : s.currency;

    return html`
      <div class="intro">
        <svg viewBox="0 0 24 24"><path d=${ICON.shield} /></svg>
        <span
          >Limits for grid-friendly charging and battery use. evcc only draws from
          the grid below these price thresholds.</span
        >
      </div>

      <div class="group">
        <evcc-slider-row
          label="Smart charge cost limit"
          unit=${`${cur}/kWh`}
          .value=${this.toCt(s.smartCostLimit)}
          min="0"
          max="60"
          step="1"
          .disabled=${disabled}
          @commit=${(e: CustomEvent) =>
            this.write(() => this.client.setSmartCostLimit((e.detail as number) / 100))}
        ></evcc-slider-row>

        <evcc-slider-row
          label="Feed-in priority limit"
          unit=${`${cur}/kWh`}
          .value=${this.toCt(s.smartFeedInPriorityLimit)}
          min="0"
          max="60"
          step="1"
          .disabled=${disabled}
          @commit=${(e: CustomEvent) =>
            this.write(() => this.client.setSmartFeedInPriorityLimit((e.detail as number) / 100))}
        ></evcc-slider-row>

        ${s.batteryGridChargeLimit !== undefined
          ? html`<evcc-slider-row
              label="Battery grid-charge limit"
              unit=${`${cur}/kWh`}
              .value=${this.toCt(s.batteryGridChargeLimit)}
              min="0"
              max="60"
              step="1"
              .disabled=${disabled}
              @commit=${(e: CustomEvent) =>
                this.write(() => this.client.setBatteryGridChargeLimit((e.detail as number) / 100))}
            ></evcc-slider-row>`
          : nothing}

        ${s.residualPower !== undefined
          ? html`<evcc-slider-row
              label="Residual grid power (operating point)"
              unit="W"
              .value=${Math.round(s.residualPower ?? 0)}
              min="-5000"
              max="5000"
              step="100"
              .disabled=${disabled}
              @commit=${(e: CustomEvent) =>
                this.write(() => this.client.setResidualPower(e.detail as number))}
            ></evcc-slider-row>`
          : nothing}
      </div>

      ${this.sessions.length
        ? html`<div class="events">
            <h4>Recent grid-limitation events</h4>
            ${this.sessions.map(
              (ev) => html`<div class="ev">
                <span>${new Date(ev.created ?? '').toLocaleString([], {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}</span>
                <span class=${ev.finished ? '' : 'on'}>${ev.finished ? 'ended' : 'active'}</span>
              </div>`,
            )}
          </div>`
        : nothing}
    `;
  }
}

registerCard({
  type: 'evcc-external-control-card',
  name: 'evcc External Control',
  description: '§14a EnWG / §9 EEG: smart cost, feed-in and grid-charge limits.',
});
