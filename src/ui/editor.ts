import { LitElement, css, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { EvccBaseConfig } from '../core/ha';
import { tokens } from './styles';

/**
 * Shared visual config editor for every evcc card. Renders the connection
 * fields (url, api key, title) plus card-specific fields inferred from the
 * config `type`, and emits `config-changed` in the shape HA's Lovelace editor
 * expects. Deliberately dependency-free (plain inputs) so it works without
 * pulling HA's internal ha-form types.
 */
@customElement('evcc-card-editor')
export class EvccCardEditor extends LitElement {
  @state() private cfg: Record<string, unknown> = {};

  static styles = [
    tokens,
    css`
      .form {
        display: grid;
        gap: 14px;
        padding: 4px 2px;
      }
      label {
        display: grid;
        gap: 5px;
        font-size: 0.8rem;
        color: var(--e-muted);
      }
      input,
      select {
        font: inherit;
        color: var(--e-fg);
        background: var(--e-surface);
        border: 1px solid var(--e-divider);
        border-radius: 8px;
        padding: 9px 11px;
      }
      .hint {
        font-size: 0.72rem;
        color: var(--e-muted);
        line-height: 1.4;
      }
      .hint code {
        opacity: 0.8;
      }
    `,
  ];

  setConfig(config: EvccBaseConfig) {
    this.cfg = { ...config };
  }

  private patch(key: string, value: unknown) {
    const cfg = { ...this.cfg };
    if (value === '' || value == null) delete cfg[key];
    else cfg[key] = value;
    this.cfg = cfg;
    this.dispatchEvent(
      new CustomEvent('config-changed', { detail: { config: cfg }, bubbles: true, composed: true }),
    );
  }

  private field(key: string, label: string, type = 'text', placeholder = '') {
    return html`<label>
      ${label}
      <input
        type=${type}
        placeholder=${placeholder}
        .value=${String(this.cfg[key] ?? '')}
        @input=${(e: Event) => this.patch(key, (e.target as HTMLInputElement).value)}
      />
    </label>`;
  }

  render() {
    const type = String(this.cfg.type ?? '');
    return html`
      <div class="form">
        ${this.field('url', 'evcc URL', 'text', 'http://evcc.local:7070')}
        ${this.field('api_key', 'API key (for controls)', 'password', 'evcc_…')}
        <div class="hint">
          Reads work without a key. Controls need an <code>evcc_</code> API key
          (evcc → Settings → generate). See the README for the required CORS setup.
        </div>
        ${this.field('title', 'Title (optional)')}
        ${type.includes('loadpoint')
          ? this.field('loadpoint', 'Loadpoint index (0-based)', 'number', '0')
          : nothing}
        ${type.includes('vehicle') || type.includes('plan')
          ? this.field('vehicle', 'Vehicle key (blank = first)')
          : nothing}
        ${type.includes('tariff')
          ? html`<label>
              Tariff type
              <select
                .value=${String(this.cfg.tariff ?? 'grid')}
                @change=${(e: Event) => this.patch('tariff', (e.target as HTMLSelectElement).value)}
              >
                <option value="grid">Grid price</option>
                <option value="feedin">Feed-in price</option>
                <option value="co2">CO₂</option>
                <option value="solar">Solar forecast</option>
                <option value="planner">Planner</option>
              </select>
            </label>`
          : nothing}
      </div>
    `;
  }
}
