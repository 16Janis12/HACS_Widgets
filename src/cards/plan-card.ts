import { css, html, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { EvccBaseCard } from '../ui/base-card';
import type { EvccState, EvccVehicle } from '../core/types';
import type { EvccBaseConfig } from '../core/ha';
import { registerCard } from '../core/ha';
import { clockTime } from '../ui/format';
import { ICON } from '../ui/icons';
import '../ui/slider-row';

interface PlanConfig extends EvccBaseConfig {
  vehicle?: string;
}

/** Default plan target: tomorrow 07:00 local. */
function defaultWhen(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(7, 0, 0, 0);
  // datetime-local wants YYYY-MM-DDTHH:mm in local time.
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Departure planner: "have the car at X% by time T". Sets a SoC-based vehicle
 * plan and shows the plan evcc is currently acting on. Requires an API key.
 */
@customElement('evcc-plan-card')
export class EvccPlanCard extends EvccBaseCard {
  @state() private soc = 80;
  @state() private when = defaultWhen();
  protected override requiresAuth = true;

  static styles = [
    ...EvccBaseCard.styles,
    css`
      .active {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px;
        border-radius: 10px;
        background: color-mix(in srgb, var(--e-accent) 12%, transparent);
        margin-bottom: 14px;
      }
      .active svg {
        width: 20px;
        height: 20px;
        fill: var(--e-accent);
        flex: none;
      }
      .active .t {
        font-weight: 600;
        font-variant-numeric: tabular-nums;
      }
      label.field {
        display: grid;
        gap: 6px;
        margin: 10px 0;
      }
      label.field span {
        font-size: 0.78rem;
        color: var(--e-muted);
        letter-spacing: 0.03em;
      }
      input[type='datetime-local'] {
        font: inherit;
        color: var(--e-fg);
        background: color-mix(in srgb, var(--e-fg) 5%, transparent);
        border: 1px solid var(--e-divider);
        border-radius: 9px;
        padding: 9px 11px;
        color-scheme: light dark;
      }
      .actions {
        display: flex;
        gap: 10px;
        margin-top: 14px;
      }
      button {
        flex: 1;
        font: inherit;
        font-weight: 600;
        font-size: 0.85rem;
        padding: 10px;
        border-radius: 10px;
        cursor: pointer;
        border: 1px solid var(--e-divider);
        background: transparent;
        color: var(--e-fg);
        transition:
          background 0.15s ease,
          transform 0.1s ease;
      }
      button:active {
        transform: translateY(1px);
      }
      button.primary {
        background: var(--e-accent);
        color: #fff;
        border-color: transparent;
        box-shadow: 0 2px 8px rgba(var(--e-green), 0.35);
      }
      button[disabled] {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `,
  ];

  private get key(): string | undefined {
    const cfg = this.config as PlanConfig;
    if (cfg.vehicle) return cfg.vehicle;
    const v = this.state?.vehicles;
    return v ? Object.keys(v)[0] : undefined;
  }
  private get vehicle(): EvccVehicle | undefined {
    const k = this.key;
    return k ? this.state?.vehicles?.[k] : undefined;
  }
  private get activePlan() {
    const k = this.key;
    const lp = this.state?.loadpoints?.find((l) => l.vehicleName === k && l.effectivePlanTime);
    return lp ? { time: lp.effectivePlanTime!, soc: lp.effectivePlanSoc } : undefined;
  }

  protected cardTitle(): string {
    return `Departure · ${this.vehicle?.title ?? 'Vehicle'}`;
  }

  private setPlan() {
    const k = this.key;
    if (!k) return;
    const iso = new Date(this.when).toISOString();
    void this.write(() => this.client.setVehiclePlan(k, this.soc, iso));
  }
  private clearPlan() {
    const k = this.key;
    if (!k) return;
    void this.write(() => this.client.clearVehiclePlan(k));
  }

  protected renderBody(_s: EvccState): TemplateResult | typeof nothing {
    const k = this.key;
    if (!k) return html`<div class="label">No vehicle available.</div>`;
    const disabled = this.requiresAuth && !this.hasAuth;
    const active = this.activePlan;

    return html`
      ${active
        ? html`<div class="active rise">
            <svg viewBox="0 0 24 24"><path d=${ICON.clock} /></svg>
            <div>
              <div class="t">${active.soc ?? this.soc}% by ${clockTime(active.time)}</div>
              <div class="label">
                ${new Date(active.time).toLocaleDateString([], {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })}
              </div>
            </div>
          </div>`
        : nothing}

      <evcc-slider-row
        label="Target charge"
        unit="%"
        .value=${this.soc}
        min="5"
        max="100"
        step="5"
        .disabled=${disabled}
        @input-value=${(e: CustomEvent) => (this.soc = e.detail as number)}
        @commit=${(e: CustomEvent) => (this.soc = e.detail as number)}
      ></evcc-slider-row>

      <label class="field">
        <span>Ready by</span>
        <input
          type="datetime-local"
          .value=${this.when}
          ?disabled=${disabled}
          @change=${(e: Event) => (this.when = (e.target as HTMLInputElement).value)}
        />
      </label>

      <div class="actions">
        <button ?disabled=${disabled} @click=${() => this.clearPlan()}>Clear</button>
        <button class="primary" ?disabled=${disabled} @click=${() => this.setPlan()}>
          Set plan
        </button>
      </div>
    `;
  }
}

registerCard({
  type: 'evcc-plan-card',
  name: 'evcc Departure Plan',
  description: 'Schedule a target charge by a departure time.',
});
