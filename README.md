# evcc Card Suite for Home Assistant

A suite of premium Lovelace cards that talk **directly to the evcc REST API** —
monitor your energy flow and control charging without leaving your dashboard.

> The repo is named `evcc-hmac-widget` for historical reasons — "hmac" was a
> typo for **HACS**. It has nothing to do with HMAC signing.

> Preview the whole suite locally without Home Assistant: run `npm run build`
> and open `demo/index.html` (ships mock evcc data and a live-animating flow).

## Cards

| Card | What it does | Needs API key |
| --- | --- | --- |
| `evcc-status-card` | Live energy-flow overview (PV, grid, battery, home, vehicle) | – |
| `evcc-glance-card` | Compact one-line status per loadpoint | – |
| `evcc-loadpoint-card` | Charge mode, charge limit, min/max current | ✔ |
| `evcc-battery-card` | Home battery SoC, mode override, buffer/priority SoC | ✔ |
| `evcc-vehicle-card` | Vehicle charge limit and minimum SoC | ✔ |
| `evcc-plan-card` | Departure planner (target SoC by time) | ✔ |
| `evcc-tariff-card` | Grid price / CO₂ / solar forecast bars | – |
| `evcc-external-control-card` | §14a EnWG / §9 EEG smart cost, feed-in & grid-charge limits | ✔ |

Monitoring cards work against evcc's **public** `/api/state`. Control cards send
authenticated writes and need an API key (see below).

## Install (HACS)

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=16Janis12&repository=HACS_Widgets&category=plugin)

Click the button above (opens HACS on your own HA instance), or manually:

1. HACS → ⋮ → **Custom repositories** → add this repo, category **Plugin (Lovelace)**.
2. Install **evcc Card Suite**. HACS registers the resource automatically.
3. Add a card, search "evcc", pick one, and set the **evcc URL**.

Manual install: copy `dist/evcc-cards.js` to `config/www/` and add it as a
dashboard resource (`/local/evcc-cards.js`, type *JavaScript Module*).

## Configuration

Every card takes:

```yaml
type: custom:evcc-loadpoint-card
url: http://evcc.local:7070   # your evcc instance
api_key: evcc_xxxxxxxx        # only needed for control cards
loadpoint: 0                  # loadpoint index (loadpoint/battery cards)
# vehicle: mycar              # vehicle key (vehicle/plan cards; blank = first)
# tariff: grid                # grid|feedin|co2|solar|planner (tariff card)
# title: Garage               # optional label
```

All cards ship a **visual editor**, so you rarely need YAML.

## Authentication

- **Reads** (`/api/state`, `/api/tariff`) are public — monitoring cards need no key.
- **Writes** (mode, limits, plans…) need an **API key**. In evcc: *Settings →
  generate API key* (`evcc_…`). Paste it into the card's `api_key`.

The key is stored in the dashboard config and is **visible to anyone who can
view the dashboard's source** — only use it on a trusted local network.

## ⚠️ CORS setup (read this if controls fail)

Because the cards call evcc from your browser, evcc must allow your Home
Assistant origin. evcc does **not** send permissive CORS headers on `/api/*` by
default, so cross-origin writes will fail with a *"cannot reach evcc"* message.

Put evcc behind a reverse proxy that adds CORS for your HA origin. **Caddy:**

```caddy
evcc.example.com {
    @cors header Origin https://ha.example.com
    header @cors Access-Control-Allow-Origin "https://ha.example.com"
    header @cors Access-Control-Allow-Methods "GET,POST,PATCH,DELETE,OPTIONS"
    header @cors Access-Control-Allow-Headers "Authorization,Content-Type"
    @preflight method OPTIONS
    respond @preflight 204
    reverse_proxy localhost:7070
}
```

**nginx:**

```nginx
location /api/ {
    if ($request_method = OPTIONS) { return 204; }
    add_header Access-Control-Allow-Origin "https://ha.example.com" always;
    add_header Access-Control-Allow-Methods "GET,POST,PATCH,DELETE,OPTIONS" always;
    add_header Access-Control-Allow-Headers "Authorization,Content-Type" always;
    proxy_pass http://localhost:7070;
}
```

The live **WebSocket** (`/ws`) is not subject to CORS, so status updates work
even before you configure this.

If you prefer not to expose evcc, keep the monitoring cards direct and route
writes through a Home Assistant `rest_command` instead.

## Development

```bash
npm install
npm run build      # type-check + bundle to dist/evcc-cards.js
npm test           # unit tests (vitest)
npm run lint
```

Open `demo/index.html` after a build to preview the cards against mock evcc data
in a plain browser (no Home Assistant needed).

Tech: Lit 3 + TypeScript, single Vite ESM bundle registering all custom elements.

## License

MIT
