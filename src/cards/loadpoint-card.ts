import { css, html, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { EvccBaseCard } from '../ui/base-card';
import type { ChargeMode, EvccLoadpoint, EvccState } from '../core/types';
import type { EvccBaseConfig } from '../core/ha';
import { registerCard } from '../core/ha';
import { duration, energy, power } from '../ui/format';
import { ICON } from '../ui/icons';
import type { SegOption } from '../ui/segmented';
import '../ui/ring';
import '../ui/segmented';
import '../ui/slider-row';

interface LoadpointConfig extends EvccBaseConfig {
  loadpoint?: number;
}

const MODES: SegOption[] = [
  { value: 'off', label: 'Off', icon: ICON.off },
  { value: 'pv', label: 'Solar', icon: ICON.pv },
  { value: 'minpv', label: 'Min+PV', icon: ICON.leaf },
  { value: 'now', label: 'Fast', icon: ICON.bolt },
];

/**
 * Full control for one loadpoint: charge mode, session SoC limit, min/max
 * current, plus a live vehicle SoC ring and session readouts. Writes need an
 * API key; without one the card renders read-only.
 */
@customElement('evcc-loadpoint-card')
export class EvccLoadpointCard extends EvccBaseCard {
  @state() private pendingMode?: ChargeMode;
  @state() private pendingLimitSoc?: number;

  protected override requiresAuth = true;

  static styles = [
    ...EvccBaseCard.styles,
    css`
      .top {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 18px;
        align-items: center;
        margin-bottom: 16px;
      }
      .ringcenter {
        display: grid;
        gap: 1px;
        justify-items: center;
      }
      .ringcenter .p {
        font-size: 1.15rem;
        font-weight: 300;
        font-variant-numeric: tabular-nums;
      }
      .ringcenter .p small {
        font-size: 0.62rem;
        color: var(--e-muted);
        font-weight: 600;
      }
      .veh {
        display: grid;
        gap: 6px;
      }
      .veh .name {
        font-weight: 600;
        font-size: 1rem;
      }
      .stats {
        display: flex;
        gap: 18px;
        flex-wrap: wrap;
      }
      .stat .metric .num {
        font-size: 1.15rem;
      }
      .section {
        margin-top: 14px;
        padding-top: 12px;
        border-top: 1px solid var(--e-divider);
      }
      .disconnected {
        color: var(--e-muted);
        font-size: 0.8rem;
        display: flex;
        align-items: center;
        gap: 6px;
      }
    `,
  ];

  private get lpIndex(): number {
    return (this.config as LoadpointConfig).loadpoint ?? 0;
  }
  private get lp(): EvccLoadpoint | undefined {
    return this.state?.loadpoints?.[this.lpIndex];
  }

  protected cardTitle(): string {
    return this.lp?.title ?? `Loadpoint ${this.lpIndex + 1}`;
  }
  protected headerSub(): string | undefined {
    const lp = this.lp;
    if (!lp) return undefined;
    if (lp.charging) return 'Charging';
    if (lp.connected) return 'Connected';
    return 'Idle';
  }
  protected activeState(): boolean {
    return !!this.lp?.charging;
  }

  private onMode(mode: ChargeMode) {
    this.pendingMode = mode;
    void this.write(() => this.client.setMode(this.lpIndex, mode));
  }
  private onLimitSoc(soc: number) {
    this.pendingLimitSoc = soc;
    void this.write(() => this.client.setLimitSoc(this.lpIndex, soc));
  }

  updated() {
    // Clear optimistic values once the live state has caught up.
    const lp = this.lp;
    if (lp && this.pendingMode && lp.mode === this.pendingMode) this.pendingMode = undefined;
    if (lp && this.pendingLimitSoc != null && lp.limitSoc === this.pendingLimitSoc)
      this.pendingLimitSoc = undefined;
  }

  protected renderBody(_s: EvccState): TemplateResult | typeof nothing {
    const lp = this.lp;
    if (!lp) return html`<div class="label">Loadpoint ${this.lpIndex} not found.</div>`;

    const soc = lp.vehicleSoc ?? 0;
    const p = power(lp.chargePower);
    const mode = this.pendingMode ?? lp.mode ?? 'off';
    const limitSoc = this.pendingLimitSoc ?? lp.limitSoc ?? 80;
    const sess = energy(lp.sessionEnergy);
    const remaining = duration(lp.chargeRemainingDuration);
    const disabled = this.requiresAuth && !this.hasAuth;

    return html`
      <div class="top">
        <evcc-ring
          .value=${soc}
          .marker=${lp.limitSoc}
          .color=${lp.charging ? 'var(--e-accent)' : 'var(--e-vehicle)'}
          size="96"
        >
          <div class="ringcenter">
            <div class="p">${lp.vehicleSoc != null ? `${Math.round(soc)}%` : '–'}</div>
            ${lp.charging
              ? html`<div class="p" style="font-size:.8rem">
                  ${p.value}<small> ${p.unit}</small>
                </div>`
              : nothing}
          </div>
        </evcc-ring>

        <div class="veh">
          <div class="name">${lp.vehicleTitle ?? lp.vehicleName ?? 'No vehicle'}</div>
          ${lp.connected
            ? html`
                <div class="stats">
                  <div class="stat">
                    <div class="label">Session</div>
                    <div class="metric">
                      <span class="num">${sess.value}</span><span class="unit">${sess.unit}</span>
                    </div>
                  </div>
                  ${lp.phasesActive
                    ? html`<div class="stat">
                        <div class="label">Phases</div>
                        <div class="metric"><span class="num">${lp.phasesActive}</span></div>
                      </div>`
                    : nothing}
                  ${remaining
                    ? html`<div class="stat">
                        <div class="label">Remaining</div>
                        <div class="metric"><span class="num">${remaining}</span></div>
                      </div>`
                    : nothing}
                </div>
              `
            : html`<div class="disconnected">
                <svg viewBox="0 0 24 24" width="16" height="16" style="fill:currentColor">
                  <path d=${ICON.car} />
                </svg>
                Not connected
              </div>`}
        </div>
      </div>

      <evcc-segmented
        .options=${MODES}
        .value=${mode}
        .disabled=${disabled}
        @select=${(e: CustomEvent) => this.onMode(e.detail as ChargeMode)}
      ></evcc-segmented>

      <div class="section">
        <evcc-slider-row
          label="Charge limit"
          unit="%"
          .value=${limitSoc}
          min="5"
          max="100"
          step="5"
          .disabled=${disabled}
          @commit=${(e: CustomEvent) => this.onLimitSoc(e.detail as number)}
        ></evcc-slider-row>

        ${lp.minCurrent != null && lp.maxCurrent != null
          ? html`
              <evcc-slider-row
                label="Max current"
                unit="A"
                .value=${lp.maxCurrent}
                min="6"
                max="32"
                step="1"
                .disabled=${disabled}
                @commit=${(e: CustomEvent) =>
                  this.write(() => this.client.setMaxCurrent(this.lpIndex, e.detail as number))}
              ></evcc-slider-row>
              <evcc-slider-row
                label="Min current"
                unit="A"
                .value=${lp.minCurrent}
                min="6"
                max="32"
                step="1"
                .disabled=${disabled}
                @commit=${(e: CustomEvent) =>
                  this.write(() => this.client.setMinCurrent(this.lpIndex, e.detail as number))}
              ></evcc-slider-row>
            `
          : nothing}
      </div>
    `;
  }
}

registerCard({
  type: 'evcc-loadpoint-card',
  name: 'evcc Loadpoint',
  description: 'Control one charging point: mode, charge limit, current.',
});
