import { css, html, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { EvccBaseCard } from '../ui/base-card';
import type { EvccState, EvccVehicle } from '../core/types';
import type { EvccBaseConfig } from '../core/ha';
import { registerCard } from '../core/ha';
import { ICON } from '../ui/icons';
import '../ui/ring';
import '../ui/slider-row';

interface VehicleConfig extends EvccBaseConfig {
  /** Vehicle key from evcc config; defaults to the first vehicle. */
  vehicle?: string;
}

/**
 * Per-vehicle limits: charge limit SoC and minimum SoC. The current SoC is read
 * from whichever loadpoint the vehicle is attached to. Requires an API key.
 */
@customElement('evcc-vehicle-card')
export class EvccVehicleCard extends EvccBaseCard {
  @state() private pendingLimit?: number;
  @state() private pendingMin?: number;
  protected override requiresAuth = true;

  static styles = [
    ...EvccBaseCard.styles,
    css`
      .top {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 18px;
        align-items: center;
        margin-bottom: 8px;
      }
      .name {
        font-weight: 600;
        font-size: 1.05rem;
      }
      .cap {
        color: var(--e-muted);
        font-size: 0.78rem;
        margin-top: 2px;
      }
      .s {
        font-size: 1.3rem;
        font-weight: 300;
        font-variant-numeric: tabular-nums;
      }
    `,
  ];

  private get key(): string | undefined {
    const cfg = this.config as VehicleConfig;
    if (cfg.vehicle) return cfg.vehicle;
    const vehicles = this.state?.vehicles;
    return vehicles ? Object.keys(vehicles)[0] : undefined;
  }
  private get vehicle(): EvccVehicle | undefined {
    const k = this.key;
    return k ? this.state?.vehicles?.[k] : undefined;
  }
  /** Live SoC from the loadpoint currently holding this vehicle. */
  private get liveSoc(): number | undefined {
    const k = this.key;
    const lp = this.state?.loadpoints?.find((l) => l.vehicleName === k);
    return lp?.vehicleSoc;
  }

  protected cardTitle(): string {
    return this.vehicle?.title ?? 'Vehicle';
  }

  updated() {
    const v = this.vehicle;
    if (v && this.pendingLimit != null && v.limitSoc === this.pendingLimit)
      this.pendingLimit = undefined;
    if (v && this.pendingMin != null && v.minSoc === this.pendingMin) this.pendingMin = undefined;
  }

  protected renderBody(_s: EvccState): TemplateResult | typeof nothing {
    const v = this.vehicle;
    const k = this.key;
    if (!v || !k) return html`<div class="label">No vehicle available.</div>`;
    const soc = this.liveSoc;
    const limit = this.pendingLimit ?? v.limitSoc ?? 80;
    const min = this.pendingMin ?? v.minSoc ?? 0;
    const disabled = this.requiresAuth && !this.hasAuth;

    return html`
      <div class="top">
        <evcc-ring .value=${soc ?? 0} .marker=${v.limitSoc} color="var(--e-vehicle)" size="92">
          <div class="s">${soc != null ? `${Math.round(soc)}%` : '–'}</div>
        </evcc-ring>
        <div>
          <div class="name">${v.title ?? k}</div>
          ${v.capacity ? html`<div class="cap">${v.capacity} kWh battery</div>` : nothing}
          <div class="cap" style="display:flex;align-items:center;gap:6px;margin-top:8px">
            <svg viewBox="0 0 24 24" width="15" height="15" style="fill:var(--e-muted)">
              <path d=${ICON.car} />
            </svg>
            ${soc != null ? 'Connected' : 'Not currently charging'}
          </div>
        </div>
      </div>

      <evcc-slider-row
        label="Charge limit"
        unit="%"
        .value=${limit}
        min="5"
        max="100"
        step="5"
        .disabled=${disabled}
        @commit=${(e: CustomEvent) => {
          this.pendingLimit = e.detail as number;
          void this.write(() => this.client.setVehicleLimitSoc(k, e.detail as number));
        }}
      ></evcc-slider-row>

      <evcc-slider-row
        label="Minimum SoC (guaranteed)"
        unit="%"
        .value=${min}
        min="0"
        max="100"
        step="5"
        .disabled=${disabled}
        @commit=${(e: CustomEvent) => {
          this.pendingMin = e.detail as number;
          void this.write(() => this.client.setVehicleMinSoc(k, e.detail as number));
        }}
      ></evcc-slider-row>
    `;
  }
}

registerCard({
  type: 'evcc-vehicle-card',
  name: 'evcc Vehicle',
  description: 'Vehicle charge limit and minimum SoC.',
});
