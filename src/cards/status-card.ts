import { html, nothing, type TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';
import { css } from 'lit';
import { EvccBaseCard } from '../ui/base-card';
import type { EvccState } from '../core/types';
import { registerCard } from '../core/ha';
import { percent, price } from '../ui/format';
import '../ui/flow';

/**
 * Site overview: the live energy-flow diagram plus a KPI strip (self-consumption,
 * green share, grid price). Read-only — works against the public /api/state with
 * no API key.
 */
@customElement('evcc-status-card')
export class EvccStatusCard extends EvccBaseCard {
  static styles = [
    ...EvccBaseCard.styles,
    css`
      evcc-flow {
        margin: 2px 0 4px;
      }
      .kpis {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
        margin-top: 12px;
        padding-top: 14px;
        border-top: 1px solid var(--e-divider);
      }
      .kpi {
        display: grid;
        gap: 3px;
      }
      .kpi .k {
        font-size: 1.15rem;
        font-weight: 300;
        font-variant-numeric: tabular-nums;
      }
      .kpi .k small {
        font-size: 0.7rem;
        color: var(--e-muted);
        font-weight: 600;
        margin-left: 2px;
      }
    `,
  ];

  protected cardTitle(): string {
    return this.state?.siteTitle ?? 'Energy Flow';
  }
  protected headerSub(): string | undefined {
    return 'Live overview';
  }
  protected activeState(s: EvccState): boolean {
    return (s.loadpoints ?? []).some((l) => l.charging);
  }

  private kpi(k: string, unit: string, label: string): TemplateResult {
    return html`<div class="kpi rise">
      <div class="k">${k}<small>${unit}</small></div>
      <div class="label">${label}</div>
    </div>`;
  }

  protected renderBody(s: EvccState): TemplateResult | typeof nothing {
    const green = s.greenShareHome ?? s.greenShare;
    return html`
      <evcc-flow .state=${s}></evcc-flow>
      <div class="kpis">
        ${this.kpi(percent(s.batterySoc), '%', 'Battery')}
        ${green != null ? this.kpi(Math.round(green * 100).toString(), '%', 'Green') : nothing}
        ${this.kpi(price(s.tariffGrid, s.currency), '', 'Grid price')}
      </div>
    `;
  }
}

registerCard({
  type: 'evcc-status-card',
  name: 'evcc Status',
  description: 'Live energy-flow overview of your evcc site (PV, grid, battery, home).',
});
