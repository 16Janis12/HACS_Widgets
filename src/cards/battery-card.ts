import { css, html, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { EvccBaseCard } from '../ui/base-card';
import type { BatteryMode, EvccState } from '../core/types';
import { registerCard } from '../core/ha';
import { power } from '../ui/format';
import { ICON } from '../ui/icons';
import type { SegOption } from '../ui/segmented';
import '../ui/ring';
import '../ui/segmented';
import '../ui/slider-row';

const MODES: SegOption[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'hold', label: 'Hold' },
  { value: 'charge', label: 'Charge' },
];

/**
 * Home battery: SoC ring, external mode override (normal/hold/charge), buffer &
 * priority SoC thresholds. Requires an API key for control.
 */
@customElement('evcc-battery-card')
export class EvccBatteryCard extends EvccBaseCard {
  @state() private pendingMode?: string;
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
        justify-items: center;
        gap: 1px;
      }
      .ringcenter .s {
        font-size: 1.3rem;
        font-weight: 300;
        font-variant-numeric: tabular-nums;
      }
      .flowline {
        display: flex;
        align-items: baseline;
        gap: 6px;
      }
      .flowline .dir {
        font-size: 0.72rem;
        color: var(--e-muted);
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      .section {
        margin-top: 14px;
        padding-top: 12px;
        border-top: 1px solid var(--e-divider);
      }
    `,
  ];

  protected cardTitle(): string {
    return 'Home Battery';
  }
  protected headerSub(): string | undefined {
    const p = this.state?.batteryPower ?? 0;
    if (p > 20) return 'Discharging';
    if (p < -20) return 'Charging';
    return 'Idle';
  }
  protected activeState(s: EvccState): boolean {
    return (s.batteryPower ?? 0) < -20; // charging glow
  }

  private onMode(mode: string) {
    this.pendingMode = mode;
    void this.write(() => this.client.setBatteryMode(mode as BatteryMode));
  }

  updated() {
    if (this.pendingMode && this.state?.batteryMode === this.pendingMode)
      this.pendingMode = undefined;
  }

  protected renderBody(s: EvccState): TemplateResult | typeof nothing {
    if (s.batterySoc == null) return html`<div class="label">No home battery configured.</div>`;
    const p = s.batteryPower ?? 0;
    const m = power(p);
    const dir = p > 20 ? 'discharge' : p < -20 ? 'charge' : 'idle';
    const mode = this.pendingMode ?? s.batteryMode ?? 'normal';
    const disabled = this.requiresAuth && !this.hasAuth;

    return html`
      <div class="top">
        <evcc-ring .value=${s.batterySoc} color="var(--e-battery)" size="100" stroke="9">
          <div class="ringcenter">
            <div class="s">${Math.round(s.batterySoc)}<small style="font-size:.7rem">%</small></div>
            <svg viewBox="0 0 24 24" width="16" height="16" style="fill:var(--e-battery)">
              <path d=${ICON.battery} />
            </svg>
          </div>
        </evcc-ring>
        <div>
          <div class="label">Power</div>
          <div class="flowline">
            <div class="metric"><span class="num">${m.value}</span><span class="unit">${m.unit}</span></div>
            <span class="dir">${dir}</span>
          </div>
          ${s.batteryEnergy != null
            ? html`<div class="label" style="margin-top:10px">
                Capacity in store: ${power(s.batteryEnergy * 1000).value}
                ${power(s.batteryEnergy * 1000).unit}h
              </div>`
            : nothing}
        </div>
      </div>

      <evcc-segmented
        .options=${MODES}
        .value=${mode}
        .disabled=${disabled}
        @select=${(e: CustomEvent) => this.onMode(e.detail as string)}
      ></evcc-segmented>

      <div class="section">
        ${s.bufferSoc != null
          ? html`<evcc-slider-row
              label="Buffer SoC (allow charging above)"
              unit="%"
              .value=${s.bufferSoc}
              min="0"
              max="100"
              step="5"
              .disabled=${disabled}
              @commit=${(e: CustomEvent) =>
                this.write(() => this.client.setBufferSoc(e.detail as number))}
            ></evcc-slider-row>`
          : nothing}
        ${s.prioritySoc != null
          ? html`<evcc-slider-row
              label="Priority SoC (charge battery first)"
              unit="%"
              .value=${s.prioritySoc}
              min="0"
              max="100"
              step="5"
              .disabled=${disabled}
              @commit=${(e: CustomEvent) =>
                this.write(() => this.client.setPrioritySoc(e.detail as number))}
            ></evcc-slider-row>`
          : nothing}
      </div>
    `;
  }
}

registerCard({
  type: 'evcc-battery-card',
  name: 'evcc Battery',
  description: 'Home battery SoC, mode override and buffer/priority thresholds.',
});
