import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { tokens } from './styles';

export interface SegOption {
  value: string;
  label: string;
  icon?: string; // inline SVG path data (24x24)
}

/**
 * Tactile segmented control used for charge-mode and battery-mode selection.
 * The selected pill slides via a translated highlight; pressing fires a
 * `select` event with the chosen value. Optimistic: caller decides how to
 * reflect the pending write.
 */
@customElement('evcc-segmented')
export class EvccSegmented extends LitElement {
  @property({ attribute: false }) options: SegOption[] = [];
  @property() value = '';
  @property({ type: Boolean }) disabled = false;

  static styles = [
    tokens,
    css`
      .seg {
        position: relative;
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: 1fr;
        gap: 2px;
        padding: 3px;
        border-radius: 12px;
        background: color-mix(in srgb, var(--e-fg) 6%, transparent);
        border: 1px solid var(--e-divider);
        user-select: none;
      }
      .seg[aria-disabled='true'] {
        opacity: 0.5;
        pointer-events: none;
      }
      button {
        appearance: none;
        border: 0;
        background: transparent;
        color: var(--e-muted);
        font: inherit;
        font-size: 0.8rem;
        font-weight: 600;
        letter-spacing: 0.02em;
        padding: 8px 6px;
        border-radius: 9px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition:
          color 0.2s ease,
          background 0.2s ease;
        z-index: 1;
      }
      button svg {
        width: 16px;
        height: 16px;
        fill: currentColor;
      }
      button:hover {
        color: var(--e-fg);
      }
      button.on {
        color: #fff;
        background: var(--e-accent);
        box-shadow: 0 2px 8px rgba(var(--e-green), 0.35);
      }
    `,
  ];

  private pick(v: string) {
    if (v === this.value) return;
    this.dispatchEvent(new CustomEvent('select', { detail: v, bubbles: true, composed: true }));
  }

  render() {
    return html`
      <div class="seg" role="tablist" aria-disabled=${this.disabled}>
        ${this.options.map(
          (o) => html`
            <button
              role="tab"
              aria-selected=${o.value === this.value}
              class=${o.value === this.value ? 'on' : ''}
              @click=${() => this.pick(o.value)}
            >
              ${o.icon
                ? html`<svg viewBox="0 0 24 24"><path d=${o.icon}></path></svg>`
                : ''}${o.label}
            </button>
          `,
        )}
      </div>
    `;
  }
}
