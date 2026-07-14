import { css, html, nothing, type TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';
import { EvccBaseCard } from '../ui/base-card';
import type { EvccState } from '../core/types';
import { registerCard } from '../core/ha';
import { power } from '../ui/format';
import { ICON } from '../ui/icons';

const MODE_LABEL: Record<string, string> = {
  off: 'Off',
  now: 'Fast',
  minpv: 'Min+PV',
  pv: 'Solar',
};

/**
 * Compact one-line status per loadpoint — mode, charge power, vehicle SoC.
 * Stackable in mixed dashboards. Read-only.
 */
@customElement('evcc-glance-card')
export class EvccGlanceCard extends EvccBaseCard {
  static styles = [
    ...EvccBaseCard.styles,
    css`
      .rows {
        display: grid;
        gap: 8px;
      }
      .lp {
        display: grid;
        grid-template-columns: 30px 1fr auto auto;
        align-items: center;
        gap: 12px;
        padding: 8px 4px;
        border-radius: 10px;
      }
      .lp .icn {
        width: 30px;
        height: 30px;
        display: grid;
        place-items: center;
        border-radius: 9px;
        background: color-mix(in srgb, var(--e-fg) 6%, transparent);
      }
      .lp.charging .icn {
        background: color-mix(in srgb, var(--e-accent) 20%, transparent);
      }
      .lp .icn svg {
        width: 17px;
        height: 17px;
        fill: var(--e-muted);
      }
      .lp.charging .icn svg {
        fill: var(--e-accent);
      }
      .nm {
        font-weight: 600;
        font-size: 0.9rem;
      }
      .md {
        font-size: 0.72rem;
        color: var(--e-muted);
        letter-spacing: 0.04em;
      }
      .soc {
        font-variant-numeric: tabular-nums;
        font-weight: 600;
        color: var(--e-muted);
        min-width: 42px;
        text-align: right;
      }
    `,
  ];

  protected cardTitle(): string {
    return this.state?.siteTitle ?? 'evcc';
  }
  protected activeState(s: EvccState): boolean {
    return (s.loadpoints ?? []).some((l) => l.charging);
  }

  protected renderBody(s: EvccState): TemplateResult | typeof nothing {
    const lps = s.loadpoints ?? [];
    if (!lps.length) return html`<div class="label">No loadpoints configured.</div>`;
    return html`
      <div class="rows">
        ${lps.map((lp) => {
          const p = power(lp.chargePower);
          return html`
            <div class="lp rise ${lp.charging ? 'charging' : ''}">
              <span class="icn"><svg viewBox="0 0 24 24"><path d=${ICON.car} /></svg></span>
              <div>
                <div class="nm">${lp.title ?? lp.vehicleTitle ?? 'Loadpoint'}</div>
                <div class="md">${MODE_LABEL[lp.mode ?? 'off'] ?? lp.mode}</div>
              </div>
              <div class="metric">
                <span class="num" style="font-size:1.1rem">${lp.charging ? p.value : '–'}</span>
                <span class="unit">${lp.charging ? p.unit : ''}</span>
              </div>
              <div class="soc">${lp.vehicleSoc != null ? `${Math.round(lp.vehicleSoc)}%` : ''}</div>
            </div>
          `;
        })}
      </div>
    `;
  }
}

registerCard({
  type: 'evcc-glance-card',
  name: 'evcc Glance',
  description: 'Compact one-line status per loadpoint (mode, power, SoC).',
});
