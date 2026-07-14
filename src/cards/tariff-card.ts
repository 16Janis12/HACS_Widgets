import { css, html, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { EvccBaseCard } from '../ui/base-card';
import type { EvccState, TariffSlot } from '../core/types';
import type { EvccBaseConfig } from '../core/ha';
import { registerCard } from '../core/ha';

interface TariffConfig extends EvccBaseConfig {
  /** grid | feedin | co2 | planner | solar */
  tariff?: 'grid' | 'feedin' | 'co2' | 'planner' | 'solar';
  /** hours to show (default 24) */
  hours?: number;
}

const TITLES: Record<string, string> = {
  grid: 'Grid Price',
  feedin: 'Feed-in Price',
  co2: 'Grid CO₂',
  planner: 'Charge Plan',
  solar: 'Solar Forecast',
};

/**
 * Forecast bars for the upcoming hours (price / CO₂ / solar). Self-fetches from
 * /api/tariff and refreshes every 15 min. The cheapest window is highlighted in
 * the accent colour and the current hour is marked, so cheap charging times pop.
 */
@customElement('evcc-tariff-card')
export class EvccTariffCard extends EvccBaseCard {
  @state() private slots: TariffSlot[] = [];
  @state() private loaded = false;
  private timer?: number;

  static styles = [
    ...EvccBaseCard.styles,
    css`
      .chart {
        display: flex;
        align-items: flex-end;
        gap: 3px;
        height: 120px;
        margin: 4px 0 2px;
      }
      .bar {
        flex: 1;
        min-width: 0;
        border-radius: 3px 3px 0 0;
        background: color-mix(in srgb, var(--e-fg) 22%, transparent);
        transition: height 0.4s ease;
        position: relative;
      }
      .bar.min {
        background: var(--e-accent);
      }
      .bar.now {
        outline: 2px solid var(--e-solar);
        outline-offset: 1px;
      }
      .axis {
        display: flex;
        justify-content: space-between;
        font-size: 0.66rem;
        color: var(--e-muted);
        margin-top: 6px;
        font-variant-numeric: tabular-nums;
      }
      .legend {
        display: flex;
        gap: 16px;
        margin-top: 10px;
        font-size: 0.72rem;
        color: var(--e-muted);
      }
      .legend b {
        color: var(--e-fg);
        font-variant-numeric: tabular-nums;
      }
    `,
  ];

  private get type() {
    return (this.config as TariffConfig).tariff ?? 'grid';
  }

  protected cardTitle(): string {
    return TITLES[this.type] ?? 'Tariff';
  }
  protected headerSub(): string {
    return 'Next hours';
  }

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
    this.timer = window.setInterval(() => void this.load(), 15 * 60 * 1000);
  }
  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.timer) clearInterval(this.timer);
  }

  private async load() {
    if (!this.ctrl) return;
    try {
      const rows = await this.client.getTariff(this.type);
      this.slots = rows;
    } catch {
      /* base card already surfaces connection errors via the store */
    }
    this.loaded = true;
  }

  private slotValue(s: TariffSlot): number {
    return s.price ?? s.value ?? 0;
  }

  // Tariff data doesn't flow through the store; render off our own fetch.
  protected renderBody(_s: EvccState): TemplateResult | typeof nothing {
    const hours = (this.config as TariffConfig).hours ?? 24;
    const now = Date.now();
    const rows = this.slots
      .filter((s) => new Date(s.end).getTime() > now)
      .slice(0, hours);

    if (!rows.length)
      return html`<div class="label">
        ${this.loaded ? 'No tariff data — is a dynamic tariff configured in evcc?' : 'Loading…'}
      </div>`;

    const values = rows.map((r) => this.slotValue(r));
    const max = Math.max(...values, 0.0001);
    const min = Math.min(...values);
    const minIdx = values.indexOf(min);
    const unit = this.type === 'co2' ? 'g' : this.type === 'solar' ? 'kW' : '¢';
    const scale = this.type === 'co2' || this.type === 'solar' ? 1 : 100;

    return html`
      <div class="chart">
        ${rows.map((r, i) => {
          const v = values[i];
          const h = Math.max(3, (v / max) * 100);
          const t = new Date(r.start).getTime();
          const isNow = t <= now && new Date(r.end).getTime() > now;
          const cls = `bar ${i === minIdx ? 'min' : ''} ${isNow ? 'now' : ''}`;
          return html`<div
            class=${cls}
            style="height:${h}%"
            title="${new Date(r.start).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })} · ${(v * scale).toFixed(scale === 1 ? 0 : 1)} ${unit}"
          ></div>`;
        })}
      </div>
      <div class="axis">
        <span>${new Date(rows[0].start).toLocaleTimeString([], { hour: '2-digit' })}</span>
        <span
          >${new Date(rows[rows.length - 1].start).toLocaleTimeString([], { hour: '2-digit' })}</span
        >
      </div>
      <div class="legend">
        <span>Now <b>${(values[0] * scale).toFixed(scale === 1 ? 0 : 1)} ${unit}</b></span>
        <span>Cheapest <b>${(min * scale).toFixed(scale === 1 ? 0 : 1)} ${unit}</b></span>
        <span>Peak <b>${(max * scale).toFixed(scale === 1 ? 0 : 1)} ${unit}</b></span>
      </div>
    `;
  }
}

registerCard({
  type: 'evcc-tariff-card',
  name: 'evcc Tariff',
  description: 'Upcoming grid price, CO₂ or solar forecast as a bar chart.',
});
