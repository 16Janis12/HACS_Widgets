/**
 * evcc Card Suite — single entry point registering every custom element.
 * Loaded once in Home Assistant as a dashboard resource.
 */
import './ui/editor';
import './cards/status-card';
import './cards/glance-card';
import './cards/loadpoint-card';
import './cards/battery-card';
import './cards/vehicle-card';
import './cards/plan-card';
import './cards/tariff-card';
import './cards/external-control-card';

const VERSION = '0.1.0';
console.info(
  `%c evcc-card-suite %c ${VERSION} `,
  'background:#10bd6c;color:#fff;font-weight:600;border-radius:4px 0 0 4px;padding:2px 6px',
  'background:#26282e;color:#fff;border-radius:0 4px 4px 0;padding:2px 6px',
);
