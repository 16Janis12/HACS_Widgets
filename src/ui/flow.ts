import { LitElement, css, html, svg, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { EvccState } from '../core/types';
import { power } from './format';
import { ICON } from './icons';
import { tokens } from './styles';

interface Flow {
  id: string;
  path: string;
  color: string;
  watts: number; // magnitude drives dot speed/count
  reverse: boolean; // animate along path in reverse
}

/**
 * The suite's signature visual: a live energy-flow diagram. Sources (PV, grid,
 * battery) feed a central home hub that feeds the vehicle(s). Power moves as
 * luminous dots travelling along each connector — direction follows the real
 * sign of the flow, speed and count scale with magnitude, so the picture reads
 * at a glance. Pure SVG + SMIL motion: no libraries, no network, theme-aware.
 */
@customElement('evcc-flow')
export class EvccFlow extends LitElement {
  @property({ attribute: false }) state!: EvccState;

  static styles = [
    tokens,
    css`
      svg {
        width: 100%;
        height: auto;
        display: block;
        overflow: visible;
      }
      .node circle {
        fill: var(--e-surface);
        stroke: var(--e-divider);
        stroke-width: 1.5;
      }
      .node .icon {
        fill: var(--e-muted);
      }
      .node.hot .icon {
        fill: var(--e-accent);
      }
      .node.hot circle {
        stroke: var(--e-accent);
      }
      .conn {
        fill: none;
        stroke: var(--e-divider);
        stroke-width: 2;
        opacity: 0.6;
      }
      .val {
        fill: var(--e-fg);
        font-size: 9px;
        font-weight: 600;
        text-anchor: middle;
        font-variant-numeric: tabular-nums;
      }
      .cap {
        fill: var(--e-muted);
        font-size: 6.5px;
        letter-spacing: 0.08em;
        text-anchor: middle;
        text-transform: uppercase;
      }
      @media (prefers-reduced-motion: reduce) {
        .dot {
          display: none;
        }
      }
    `,
  ];

  private node(
    x: number,
    y: number,
    icon: string,
    caption: string,
    valueW: number | undefined,
    hot: boolean,
    unitOverride?: string,
  ): TemplateResult {
    const m = power(valueW);
    return svg`
      <g class="node ${hot ? 'hot' : ''}" transform="translate(${x} ${y})">
        <circle r="17" />
        <g transform="translate(-9 -9) scale(0.75)"><path class="icon" d=${icon} /></g>
        <text class="cap" y="30">${caption}</text>
        <text class="val" y="41">${unitOverride ?? `${m.value} ${m.unit}`}</text>
      </g>`;
  }

  private dots(f: Flow): TemplateResult[] {
    if (Math.abs(f.watts) < 20) return [];
    // Faster + denser with more power (clamped for sanity).
    const kw = Math.min(11, Math.abs(f.watts) / 1000);
    const dur = Math.max(1.1, 3.4 - kw * 0.22);
    const count = Math.min(4, 1 + Math.floor(kw / 2));
    const kp = f.reverse ? '1;0' : '0;1';
    return Array.from({ length: count }, (_, i) => {
      const begin = `${(i * dur) / count}s`;
      return svg`
        <circle class="dot" r="2.6" fill=${f.color}>
          <animateMotion dur="${dur}s" begin=${begin} repeatCount="indefinite"
            keyPoints=${kp} keyTimes="0;1" calcMode="linear">
            <mpath href="#${f.id}" />
          </animateMotion>
        </circle>`;
    });
  }

  render() {
    const s = this.state;
    const pv = s.pvPower ?? 0;
    const grid = s.gridPower ?? 0; // + import, - export
    const batP = s.batteryPower ?? 0; // + discharge, - charge
    const hasBattery = s.batterySoc != null || Math.abs(batP) > 0;
    const loadpoints = s.loadpoints ?? [];
    const chargePower = loadpoints.reduce((a, l) => a + (l.chargePower ?? 0), 0);
    const charging = loadpoints.some((l) => l.charging);

    // Connector geometry (viewBox 0 0 300 210). Home hub at centre.
    const HX = 150,
      HY = 100;
    const flows: Flow[] = [
      {
        id: 'f-pv',
        path: `M150,47 L${HX},${HY - 18}`,
        color: 'var(--e-solar)',
        watts: pv,
        reverse: false, // PV -> home
      },
      {
        id: 'f-grid',
        path: `M62,100 L${HX - 18},${HY}`,
        color: grid >= 0 ? 'var(--e-grid)' : 'var(--e-grid-export)',
        watts: grid,
        reverse: grid < 0, // import: grid->home, export: home->grid
      },
      {
        id: 'f-load',
        path: `M${HX},${HY + 18} L150,153`,
        color: 'var(--e-vehicle)',
        watts: chargePower,
        reverse: false, // home -> vehicle
      },
    ];
    if (hasBattery) {
      flows.push({
        id: 'f-bat',
        path: `M${HX + 18},${HY} L238,100`,
        color: 'var(--e-battery)',
        watts: batP,
        reverse: batP >= 0, // discharge: battery->home, charge: home->battery
      });
    }

    return html`
      ${svg`
        <svg viewBox="0 0 300 210" role="img" aria-label="Live energy flow">
          <defs>
            ${flows.map((f) => svg`<path id=${f.id} d=${f.path} fill="none" />`)}
          </defs>
          ${flows.map((f) => svg`<use href="#${f.id}" class="conn" />`)}
          ${flows.flatMap((f) => this.dots(f))}

          ${this.node(150, 30, ICON.pv, 'Solar', pv, pv > 20)}
          ${this.node(45, 100, ICON.grid, grid >= 0 ? 'Grid' : 'Feed-in', grid, Math.abs(grid) > 20)}
          ${
            hasBattery
              ? this.node(
                  255,
                  100,
                  ICON.battery,
                  'Battery',
                  batP,
                  Math.abs(batP) > 20,
                  `${Math.round(s.batterySoc ?? 0)}%`,
                )
              : ''
          }
          ${this.node(150, 100, ICON.home, 'Home', s.homePower, false)}
          ${this.node(150, 170, ICON.car, 'Charging', chargePower, charging)}
        </svg>`}
    `;
  }
}
