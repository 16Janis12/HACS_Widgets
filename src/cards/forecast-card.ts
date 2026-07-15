import { css, html, nothing, svg, type TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';
import { EvccBaseCard } from '../ui/base-card';
import type { EvccState, SolarForecast, SolarForecastPoint } from '../core/types';
import { registerCard } from '../core/ha';
import { energy } from '../ui/format';
import { ICON } from '../ui/icons';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Solar production forecast: today / tomorrow / day-after energy totals, the
 * production still expected for the rest of today, and a filled sparkline of
 * the upcoming production curve with a "now" marker. Read-only — reads
 * `forecast.solar` straight from the live store, no API key needed.
 */
@customElement('evcc-forecast-card')
export class EvccForecastCard extends EvccBaseCard {
  static styles = [
    ...EvccBaseCard.styles,
    css`
      .days {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
        margin-bottom: 14px;
      }
      .day {
        display: grid;
        gap: 3px;
      }
      .day .k {
        font-size: 1.3rem;
        font-weight: 300;
        font-variant-numeric: tabular-nums;
      }
      .day .k small {
        font-size: 0.7rem;
        color: var(--e-muted);
        font-weight: 600;
        margin-left: 2px;
      }
      .day.hi .k {
        color: var(--e-solar);
      }
      .remain {
        font-size: 0.8rem;
        color: var(--e-muted);
        margin-bottom: 10px;
      }
      .remain b {
        color: var(--e-fg);
        font-variant-numeric: tabular-nums;
      }
      .spark {
        display: block;
        width: 100%;
        height: 96px;
      }
      .spark .area {
        fill: color-mix(in srgb, var(--e-solar) 22%, transparent);
      }
      .spark .line {
        fill: none;
        stroke: var(--e-solar);
        stroke-width: 2;
        vector-effect: non-scaling-stroke;
      }
      .spark .now {
        stroke: var(--e-fg);
        stroke-width: 1;
        stroke-dasharray: 2 2;
        opacity: 0.5;
      }
      .axis {
        display: flex;
        justify-content: space-between;
        font-size: 0.66rem;
        color: var(--e-muted);
        margin-top: 6px;
        font-variant-numeric: tabular-nums;
      }
    `,
  ];

  protected cardTitle(): string {
    return 'Solar Forecast';
  }
  protected headerSub(): string {
    return 'Production outlook';
  }

  private dayCol(label: string, wh: number | undefined, hi = false): TemplateResult {
    const m = energy((wh ?? 0) / 1000);
    return html`<div class="day ${hi ? 'hi' : ''} rise">
      <div class="k">${m.value}<small>${m.unit}</small></div>
      <div class="label">${label}</div>
    </div>`;
  }

  /** kWh still expected between now and end of the local day. */
  private remainingToday(points: SolarForecastPoint[], now: number): number {
    const endOfDay = new Date(now);
    endOfDay.setHours(24, 0, 0, 0);
    const end = endOfDay.getTime();
    let wh = 0;
    for (let i = 0; i < points.length; i++) {
      const t = new Date(points[i].ts).getTime();
      if (t < now || t >= end) continue;
      const next = points[i + 1] ? new Date(points[i + 1].ts).getTime() : t;
      const hours = Math.min((next - t) / 3_600_000, 1); // guard against gaps
      wh += points[i].val * hours;
    }
    return wh / 1000;
  }

  private sparkline(points: SolarForecastPoint[], now: number): TemplateResult {
    // Window: local start of today through the next ~2 days, so it stays legible.
    const midnight = new Date(now);
    midnight.setHours(0, 0, 0, 0);
    const from = midnight.getTime();
    const to = from + 2 * DAY_MS;
    const win = points
      .map((p) => ({ t: new Date(p.ts).getTime(), v: p.val }))
      .filter((p) => p.t >= from && p.t <= to);
    if (win.length < 2) return nothing as unknown as TemplateResult;

    const W = 100;
    const H = 100;
    const peak = Math.max(...win.map((p) => p.v), 1);
    const span = to - from || 1;
    const x = (t: number) => ((t - from) / span) * W;
    const y = (v: number) => H - (v / peak) * H;

    const line = win.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(2)},${y(p.v).toFixed(2)}`).join(' ');
    const area = `M${x(win[0].t).toFixed(2)},${H} ${line.slice(1)} L${x(win[win.length - 1].t).toFixed(2)},${H} Z`;
    const nowX = x(Math.min(Math.max(now, from), to));

    return html`<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      ${svg`<path class="area" d=${area} />
        <path class="line" d=${line} />
        <line class="now" x1=${nowX.toFixed(2)} y1="0" x2=${nowX.toFixed(2)} y2=${H} />`}
    </svg>`;
  }

  protected renderBody(s: EvccState): TemplateResult | typeof nothing {
    const f: SolarForecast | undefined = s.forecast?.solar;
    if (!f || (f.today == null && !f.timeseries?.length))
      return html`<div class="label">No solar forecast — configure a solar forecast in evcc.</div>`;

    const now = Date.now();
    const points = f.timeseries ?? [];
    const remain = points.length ? this.remainingToday(points, now) : null;

    return html`
      <div class="days">
        ${this.dayCol('Today', f.today?.energy, true)}
        ${this.dayCol('Tomorrow', f.tomorrow?.energy)}
        ${this.dayCol('Day after', f.dayAfterTomorrow?.energy)}
      </div>
      ${remain != null
        ? html`<div class="remain">
            <svg viewBox="0 0 24 24" width="13" height="13" style="fill:var(--e-solar);vertical-align:-2px">
              <path d=${ICON.pv} />
            </svg>
            Remaining today: <b>${energy(remain).value} ${energy(remain).unit}</b>
          </div>`
        : nothing}
      ${points.length ? this.sparkline(points, now) : nothing}
      ${points.length
        ? html`<div class="axis"><span>Today</span><span>Tomorrow</span><span>+2d</span></div>`
        : nothing}
    `;
  }
}

registerCard({
  type: 'evcc-forecast-card',
  name: 'evcc Forecast',
  description: 'Solar production forecast: today/tomorrow totals and the upcoming production curve.',
});
