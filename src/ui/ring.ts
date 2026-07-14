import { LitElement, css, html, svg } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { tokens } from './styles';

/**
 * State-of-charge ring: a thin SVG donut with a gradient progress stroke and a
 * centered numeric readout in the slot. The stroke animates smoothly on value
 * change (dashoffset transition), giving batteries/vehicles a tactile feel.
 */
@customElement('evcc-ring')
export class EvccRing extends LitElement {
  @property({ type: Number }) value = 0; // 0..100
  @property({ type: Number }) size = 92;
  @property({ type: Number }) stroke = 8;
  @property() color = 'var(--e-accent)';
  /** Optional secondary marker (e.g. target SoC), 0..100. */
  @property({ type: Number }) marker?: number;

  static styles = [
    tokens,
    css`
      .wrap {
        position: relative;
        display: inline-grid;
        place-items: center;
      }
      .center {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        text-align: center;
      }
      circle {
        transition: stroke-dashoffset 0.7s cubic-bezier(0.2, 0.7, 0.2, 1);
      }
      .track {
        stroke: var(--e-divider);
        opacity: 0.5;
      }
      .marker {
        stroke: var(--e-fg);
        opacity: 0.35;
      }
    `,
  ];

  render() {
    const r = (this.size - this.stroke) / 2;
    const c = 2 * Math.PI * r;
    const v = Math.max(0, Math.min(100, this.value));
    const offset = c * (1 - v / 100);
    const markerAngle = this.marker != null ? (this.marker / 100) * 360 - 90 : null;

    return html`
      <div class="wrap" style="width:${this.size}px;height:${this.size}px">
        ${svg`
          <svg width=${this.size} height=${this.size} viewBox="0 0 ${this.size} ${this.size}">
            <defs>
              <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color=${this.color} stop-opacity="0.55" />
                <stop offset="100%" stop-color=${this.color} />
              </linearGradient>
            </defs>
            <g transform="rotate(-90 ${this.size / 2} ${this.size / 2})">
              <circle class="track" cx=${this.size / 2} cy=${this.size / 2} r=${r}
                fill="none" stroke-width=${this.stroke} />
              <circle cx=${this.size / 2} cy=${this.size / 2} r=${r}
                fill="none" stroke="url(#g)" stroke-width=${this.stroke}
                stroke-linecap="round"
                stroke-dasharray=${c} stroke-dashoffset=${offset} />
            </g>
            ${
              markerAngle != null
                ? svg`<line class="marker"
                    x1=${this.size / 2 + (r - this.stroke) * Math.cos((markerAngle * Math.PI) / 180)}
                    y1=${this.size / 2 + (r - this.stroke) * Math.sin((markerAngle * Math.PI) / 180)}
                    x2=${this.size / 2 + (r + this.stroke) * Math.cos((markerAngle * Math.PI) / 180)}
                    y2=${this.size / 2 + (r + this.stroke) * Math.sin((markerAngle * Math.PI) / 180)}
                    stroke-width="2" stroke-linecap="round" />`
                : ''
            }
          </svg>
        `}
        <div class="center"><slot></slot></div>
      </div>
    `;
  }
}
