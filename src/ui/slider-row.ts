import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { tokens } from './styles';

/**
 * Labelled slider row for limits (SoC %, current A, cost). Fires `commit` with
 * the final value on release (`change`), and `input` live while dragging so the
 * card can show the pending value without spamming the API.
 */
@customElement('evcc-slider-row')
export class EvccSliderRow extends LitElement {
  @property() label = '';
  @property({ type: Number }) value = 0;
  @property({ type: Number }) min = 0;
  @property({ type: Number }) max = 100;
  @property({ type: Number }) step = 1;
  @property() unit = '';
  @property({ type: Boolean }) disabled = false;

  static styles = [
    tokens,
    css`
      .row {
        display: grid;
        gap: 6px;
        padding: 6px 0;
      }
      .top {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
      }
      .lab {
        font-size: 0.78rem;
        color: var(--e-muted);
        letter-spacing: 0.03em;
      }
      .val {
        font-variant-numeric: tabular-nums;
        font-weight: 600;
        font-size: 0.9rem;
      }
      .val .u {
        font-size: 0.7rem;
        color: var(--e-muted);
        margin-left: 2px;
      }
      input[type='range'] {
        -webkit-appearance: none;
        appearance: none;
        width: 100%;
        height: 6px;
        border-radius: 999px;
        background: linear-gradient(
          to right,
          var(--e-accent) 0%,
          var(--e-accent) var(--pct, 0%),
          var(--e-divider) var(--pct, 0%),
          var(--e-divider) 100%
        );
        outline: none;
        cursor: pointer;
      }
      input[disabled] {
        opacity: 0.5;
        cursor: not-allowed;
      }
      input[type='range']::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: var(--e-surface);
        border: 3px solid var(--e-accent);
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
        transition: transform 0.1s ease;
      }
      input[type='range']::-webkit-slider-thumb:active {
        transform: scale(1.15);
      }
      input[type='range']::-moz-range-thumb {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: var(--e-surface);
        border: 3px solid var(--e-accent);
      }
    `,
  ];

  private get pct() {
    return ((this.value - this.min) / (this.max - this.min)) * 100;
  }

  private onInput(e: Event) {
    this.value = Number((e.target as HTMLInputElement).value);
    this.dispatchEvent(new CustomEvent('input-value', { detail: this.value }));
  }
  private onChange(e: Event) {
    const v = Number((e.target as HTMLInputElement).value);
    this.dispatchEvent(new CustomEvent('commit', { detail: v, bubbles: true, composed: true }));
  }

  render() {
    return html`
      <div class="row">
        <div class="top">
          <span class="lab">${this.label}</span>
          <span class="val">${this.value}<span class="u">${this.unit}</span></span>
        </div>
        <input
          type="range"
          style=${`--pct:${this.pct}%`}
          .min=${String(this.min)}
          .max=${String(this.max)}
          .step=${String(this.step)}
          .value=${String(this.value)}
          ?disabled=${this.disabled}
          @input=${this.onInput}
          @change=${this.onChange}
        />
      </div>
    `;
  }
}
