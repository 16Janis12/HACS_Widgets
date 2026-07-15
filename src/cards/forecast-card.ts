import { css, html, nothing, svg, type TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';
import { EvccBaseCard } from '../ui/base-card';
import type { EvccState, SolarForecast, SolarForecastPoint } from '../core/types';
import { registerCard } from '../core/ha';
import { energy, power } from '../ui/format';
import { ICON } from '../ui/icons';

const DAY_MS = 24 * 60 * 60 * 1000;

interface Pt {
  t: number;
  v: number;
}

/**
 * Solar production forecast: today / tomorrow / day-after energy totals, the
 * production still expected for the rest of today, and a filled sparkline of
 * the upcoming production curve with peak + "now" markers. Read-only — reads
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
        gap: 8px;
        margin-bottom: 14px;
      }
      .day {
        display: grid;
        gap: 2px;
        padding: 11px 12px;
        border-radius: 12px;
        background: color-mix(in srgb, var(--e-fg) 4%, transparent);
        border: 1px solid var(--e-divider);
        position: relative;
        overflow: hidden;
      }
      .day.hi {
        background: linear-gradient(
          160deg,
          color-mix(in srgb, var(--e-solar) 20%, transparent),
          color-mix(in srgb, var(--e-solar) 5%, transparent)
        );
        border-color: color-mix(in srgb, var(--e-solar) 35%, transparent);
      }
      .day .dl {
        font-size: 0.64rem;
        text-transform: uppercase;
        letter-spacing: 0.07em;
        color: var(--e-muted);
        font-weight: 600;
      }
      .day .k {
        font-size: 1.35rem;
        font-weight: 300;
        letter-spacing: -0.02em;
        font-variant-numeric: tabular-nums;
        line-height: 1.1;
      }
      .day .k small {
        font-size: 0.66rem;
        color: var(--e-muted);
        font-weight: 600;
        margin-left: 2px;
      }
      .day.hi .k {
        color: var(--e-solar);
      }
      .day .sun {
        position: absolute;
        top: 8px;
        right: 8px;
        opacity: 0.55;
      }

      /* Chart */
      .chartwrap {
        position: relative;
        margin: 2px 0 0;
        padding: 8px 0 0;
      }
      .spark {
        display: block;
        width: 100%;
        height: 118px;
        overflow: visible;
      }
      .grid {
        stroke: var(--e-divider);
        stroke-width: 1;
        vector-effect: non-scaling-stroke;
      }
      .now {
        stroke: var(--e-fg);
        stroke-width: 1;
        stroke-dasharray: 3 3;
        opacity: 0.4;
        vector-effect: non-scaling-stroke;
      }
      .line {
        fill: none;
        stroke: var(--e-solar);
        stroke-width: 2.5;
        stroke-linejoin: round;
        stroke-linecap: round;
        vector-effect: non-scaling-stroke;
        filter: drop-shadow(0 2px 5px color-mix(in srgb, var(--e-solar) 45%, transparent));
      }
      /* Round markers as HTML so the non-uniform SVG scale can't squash them */
      .dot {
        position: absolute;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        transform: translate(-50%, -50%);
        pointer-events: none;
      }
      .dot.peak {
        background: var(--e-solar);
        box-shadow: 0 0 0 4px color-mix(in srgb, var(--e-solar) 22%, transparent);
      }
      .dot.nowdot {
        background: var(--e-fg);
        width: 8px;
        height: 8px;
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--e-fg) 14%, transparent);
      }
      .peaklabel {
        position: absolute;
        transform: translate(-50%, -140%);
        font-size: 0.66rem;
        font-weight: 700;
        color: var(--e-solar);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        pointer-events: none;
      }
      .axis {
        display: flex;
        justify-content: space-between;
        font-size: 0.64rem;
        color: var(--e-muted);
        margin-top: 8px;
        font-variant-numeric: tabular-nums;
      }

      /* Remaining-today chip */
      .remain {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid var(--e-divider);
      }
      .remain .rl {
        font-size: 0.72rem;
        color: var(--e-muted);
        letter-spacing: 0.04em;
        flex: 1;
      }
      .remain .rv {
        font-size: 1.15rem;
        font-weight: 300;
        font-variant-numeric: tabular-nums;
        color: var(--e-solar);
      }
      .remain .rv small {
        font-size: 0.66rem;
        color: var(--e-muted);
        font-weight: 600;
        margin-left: 2px;
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
      ${hi
        ? html`<svg class="sun" viewBox="0 0 24 24" width="13" height="13" style="fill:var(--e-solar)">
            <path d=${ICON.pv} />
          </svg>`
        : nothing}
      <div class="dl">${label}</div>
      <div class="k">${m.value}<small>${m.unit}</small></div>
    </div>`;
  }

  /** kWh still expected between now and end of the local day. */
  private remainingToday(points: Pt[], now: number): number {
    const eod = new Date(now);
    eod.setHours(24, 0, 0, 0);
    const end = eod.getTime();
    let wh = 0;
    for (let i = 0; i < points.length; i++) {
      const t = points[i].t;
      if (t < now || t >= end) continue;
      const next = points[i + 1] ? points[i + 1].t : t;
      const hours = Math.min((next - t) / 3_600_000, 1); // guard against gaps
      wh += points[i].v * hours;
    }
    return wh / 1000;
  }

  /** Linear-interpolated production (W) at time `t`. */
  private valueAt(points: Pt[], t: number): number {
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      if (t >= a.t && t <= b.t) {
        const f = (t - a.t) / (b.t - a.t || 1);
        return a.v + (b.v - a.v) * f;
      }
    }
    return 0;
  }

  private chart(points: Pt[], now: number): TemplateResult | typeof nothing {
    // Local start of today through the next ~2 days keeps the curve legible.
    const midnight = new Date(now);
    midnight.setHours(0, 0, 0, 0);
    const from = midnight.getTime();
    const to = from + 2 * DAY_MS;
    const win = points.filter((p) => p.t >= from && p.t <= to);
    if (win.length < 2) return nothing;

    const H = 100;
    const peak = Math.max(...win.map((p) => p.v), 1);
    const span = to - from || 1;
    const fx = (t: number) => (t - from) / span; // 0..1
    const fy = (v: number) => 1 - v / peak; // 0..1
    const X = (t: number) => (fx(t) * 100).toFixed(2);
    const Y = (v: number) => (fy(v) * H).toFixed(2);

    const line = win.map((p, i) => `${i ? 'L' : 'M'}${X(p.t)},${Y(p.v)}`).join(' ');
    const area = `M${X(win[0].t)},${H} ${line.slice(1)} L${X(win[win.length - 1].t)},${H} Z`;

    // Peak marker + label, and the "now" position on the curve.
    const peakPt = win.reduce((a, b) => (b.v > a.v ? b : a), win[0]);
    const nowClamped = Math.min(Math.max(now, from), to);
    const nowV = this.valueAt(win, nowClamped);
    const midnightX = fx(from + DAY_MS) * 100;
    const pct = (n: number) => `${(n * 100).toFixed(2)}%`;
    const gradId = 'fc-grad';

    return html`
      <div class="chartwrap">
        <svg class="spark" viewBox="0 0 100 ${H}" preserveAspectRatio="none">
          ${svg`
            <defs>
              <linearGradient id=${gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="var(--e-solar)" stop-opacity="0.38" />
                <stop offset="100%" stop-color="var(--e-solar)" stop-opacity="0.02" />
              </linearGradient>
            </defs>
            <line class="grid" x1=${midnightX.toFixed(2)} y1="0" x2=${midnightX.toFixed(2)} y2=${H} />
            <line class="now" x1=${(fx(nowClamped) * 100).toFixed(2)} y1="0" x2=${(fx(nowClamped) * 100).toFixed(2)} y2=${H} />
            <path d=${area} fill=${`url(#${gradId})`} />
            <path class="line" d=${line} />
          `}
        </svg>
        <span class="dot peak" style="left:${pct(fx(peakPt.t))};top:${pct(fy(peakPt.v))}"></span>
        <span class="peaklabel" style="left:${pct(fx(peakPt.t))};top:${pct(fy(peakPt.v))}">
          ${power(peakPt.v).value} ${power(peakPt.v).unit}
        </span>
        ${now >= from && now <= to
          ? html`<span class="dot nowdot" style="left:${pct(fx(nowClamped))};top:${pct(fy(nowV))}"></span>`
          : nothing}
      </div>
      <div class="axis">
        <span>Today</span><span>Tomorrow</span><span>+2d</span>
      </div>
    `;
  }

  protected renderBody(s: EvccState): TemplateResult | typeof nothing {
    const f: SolarForecast | undefined = s.forecast?.solar;
    if (!f || (f.today == null && !f.timeseries?.length))
      return html`<div class="label">No solar forecast — configure a solar forecast in evcc.</div>`;

    const now = Date.now();
    const points: Pt[] = (f.timeseries ?? []).map((p: SolarForecastPoint) => ({
      t: new Date(p.ts).getTime(),
      v: p.val,
    }));
    const remain = points.length ? this.remainingToday(points, now) : null;

    return html`
      <div class="days">
        ${this.dayCol('Today', f.today?.energy, true)}
        ${this.dayCol('Tomorrow', f.tomorrow?.energy)}
        ${this.dayCol('Day after', f.dayAfterTomorrow?.energy)}
      </div>
      ${points.length ? this.chart(points, now) : nothing}
      ${remain != null
        ? html`<div class="remain rise">
            <svg viewBox="0 0 24 24" width="15" height="15" style="fill:var(--e-solar)">
              <path d=${ICON.pv} />
            </svg>
            <span class="rl">Remaining today</span>
            <span class="rv">${energy(remain).value}<small>${energy(remain).unit}</small></span>
          </div>`
        : nothing}
    `;
  }
}

registerCard({
  type: 'evcc-forecast-card',
  name: 'evcc Forecast',
  description: 'Solar production forecast: today/tomorrow totals and the upcoming production curve.',
});
