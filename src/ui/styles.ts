import { css } from 'lit';

/**
 * Shared design tokens for the whole card suite.
 *
 * Design intent: quiet, instrument-panel precision. Cards inherit Home
 * Assistant's own surface, radius, shadow and text colours so they melt into
 * any theme (light or dark), then layer an evcc identity on top:
 *  - one signal-green accent for "active / charging",
 *  - an energy-semantic palette (solar gold, grid coral, battery green),
 *  - large light-weight tabular numerals with small muted units,
 *  - a hairline top accent and a soft ambient glow that only appears when a
 *    loadpoint is actively charging.
 * Everything is derived from HA custom properties with sensible fallbacks, so
 * nothing looks foreign in a user's dashboard.
 */
export const tokens = css`
  :host {
    /* Surfaces & text — inherited from HA, with fallbacks */
    --e-surface: var(--ha-card-background, var(--card-background-color, #fff));
    --e-radius: var(--ha-card-border-radius, 14px);
    --e-fg: var(--primary-text-color, #17181c);
    --e-muted: var(--secondary-text-color, #8b8f98);
    --e-divider: var(--divider-color, rgba(140, 145, 155, 0.18));
    --e-disabled: var(--disabled-text-color, #b0b3ba);

    /* evcc identity */
    --e-green: 16, 189, 108; /* signal green, as RGB triplet for alpha use */
    --e-accent: rgb(var(--e-green));

    /* Energy-semantic palette */
    --e-solar: #f6b93b;
    --e-grid: #eb5a52;
    --e-grid-export: rgb(var(--e-green));
    --e-battery: #12b886;
    --e-home: var(--secondary-text-color, #8b8f98);
    --e-vehicle: #4c9be8;

    display: block;
    color: var(--e-fg);
    font-family: var(--ha-card-header-font-family, var(--paper-font-body1_-_font-family, inherit));
    -webkit-font-smoothing: antialiased;
  }
`;

/** Card shell — the frame every card sits in. */
export const shell = css`
  .card {
    position: relative;
    background: var(--e-surface);
    border-radius: var(--e-radius);
    box-shadow: var(--ha-card-box-shadow, 0 2px 10px rgba(0, 0, 0, 0.08));
    border: var(--ha-card-border-width, 1px) solid
      var(--ha-card-border-color, var(--e-divider));
    padding: 18px 18px 16px;
    overflow: hidden;
    isolation: isolate;
  }

  /* Hairline accent along the top edge; brightens when charging/active. */
  .card::before {
    content: '';
    position: absolute;
    inset: 0 0 auto 0;
    height: 3px;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(var(--e-green), var(--accent-strength, 0.25)),
      transparent
    );
    opacity: 0.9;
    transition: opacity 0.6s ease;
  }

  .card.is-active {
    --accent-strength: 0.85;
  }

  /* Ambient glow, only while actively charging. */
  .card.is-active::after {
    content: '';
    position: absolute;
    inset: auto -40% -60% -40%;
    height: 70%;
    background: radial-gradient(
      ellipse at center bottom,
      rgba(var(--e-green), 0.14),
      transparent 70%
    );
    pointer-events: none;
    z-index: -1;
  }

  .head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
  }
  .head .title {
    font-size: 0.95rem;
    font-weight: 600;
    letter-spacing: 0.01em;
  }
  .head .sub {
    font-size: 0.72rem;
    color: var(--e-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .head .spacer {
    flex: 1;
  }

  /* Live connection dot */
  .live {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--e-disabled);
    box-shadow: 0 0 0 0 rgba(var(--e-green), 0.5);
  }
  .live.on {
    background: var(--e-accent);
    animation: live-pulse 2.4s ease-out infinite;
  }
  @keyframes live-pulse {
    0% {
      box-shadow: 0 0 0 0 rgba(var(--e-green), 0.5);
    }
    70% {
      box-shadow: 0 0 0 6px rgba(var(--e-green), 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(var(--e-green), 0);
    }
  }

  /* Editorial numeric treatment */
  .metric {
    display: flex;
    align-items: baseline;
    gap: 4px;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }
  .metric .num {
    font-size: 1.7rem;
    font-weight: 300;
    letter-spacing: -0.02em;
  }
  .metric .unit {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--e-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .label {
    font-size: 0.72rem;
    color: var(--e-muted);
    letter-spacing: 0.04em;
  }

  /* Staggered entrance */
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }
  .rise {
    animation: rise 0.5s cubic-bezier(0.2, 0.7, 0.2, 1) both;
  }

  .error {
    padding: 14px 16px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--e-grid) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--e-grid) 40%, transparent);
    color: var(--e-fg);
    font-size: 0.85rem;
    line-height: 1.4;
  }
  .error code {
    font-size: 0.78rem;
    opacity: 0.8;
  }

  @media (prefers-reduced-motion: reduce) {
    .rise,
    .live.on {
      animation: none;
    }
  }
`;
