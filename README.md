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

## ⚠️ Fix "cannot reach evcc" (read this if cards fail)

Both CORS failures and https-dashboard/http-evcc **mixed-content** blocks
("wurde blockiert...") come from the same root cause: the browser is calling
evcc directly, cross-origin. The fix that sidesteps both at once is to stop
doing that.

### Recommended: the evcc Proxy integration (no proxy server, no certs)

This repo ships a small Home Assistant integration, **evcc Proxy**
(`custom_components/evcc_proxy`), that registers `/api/evcc_proxy/<slug>/*` as
part of Home Assistant's own HTTP server. Cards then call that same-origin
https path instead of evcc directly; Home Assistant fetches evcc itself,
server-side, which is never subject to a browser's CORS or mixed-content
rules. It also keeps the evcc API key out of the dashboard config — HA stores
it, not Lovelace.

1. Install it: HACS → ⋮ → **Custom repositories** → add this repo, category
   **Integration** (separately from the Plugin install above) → install
   **evcc Proxy** → restart HA if prompted.
2. Settings → Devices & services → **Add integration** → search "evcc Proxy".
3. Enter evcc's URL as reached *from Home Assistant* (e.g.
   `http://evcc.local:7070` — HA calling it server-side is fine even though
   your browser calling it isn't) and, optionally, its API key. Leave the slug
   blank to derive one from the URL, or set your own.
4. In each card's config, set `url` to `/api/evcc_proxy/<slug>` (the slug you
   set, or check **Settings → Devices & services → evcc Proxy** for the
   generated one) and drop `api_key` — auth now runs through your HA login.

Caveat: the live WebSocket isn't proxied (evcc's `/ws` handshake was never
subject to CORS to begin with, so there was nothing to fix there) — but if
you route the initial URL through the proxy, cards fall back to 5s polling
instead of using it, since the WS would otherwise need a direct evcc address.
If you want push updates *and* the proxy, keep the WS path direct by editing
`custom_components/evcc_proxy/http.py`'s target, or simply accept the poll
fallback — most dashboards won't notice the difference.

### No Home Assistant integration installs allowed? Use a reverse proxy

If you'd rather not add a backend integration, put evcc behind a
TLS-terminating reverse proxy instead — this fixes mixed content by giving
evcc a real https address, and can add CORS headers in the same config.

**Public domain, ports 80/443 reachable from the internet** — Caddy's
automatic Let's Encrypt mode works out of the box:

```caddy
evcc.example.com {
    reverse_proxy localhost:7070
}
```

**LAN-only** (e.g. `evcc.local`, no public DNS/port-forwarding — the common
home setup, and why plain Caddy "didn't work"): automatic Let's Encrypt can't
validate without an internet-reachable domain. Use Caddy's **internal CA**
instead — one command, no DNS, no port forwarding:

```bash
docker run -d --name evcc-tls-proxy --network host \
  -v caddy_data:/data \
  caddy caddy reverse-proxy --from evcc.local:8443 --to localhost:7070 --internal-certs
docker exec evcc-tls-proxy caddy trust   # once, on every machine loading the dashboard
```

(`caddy trust` installs the CA into the OS/browser trust store. On phones/
tablets you'd need to import the root cert manually — desktop-only if you
want zero extra steps.)

Point the card at `url: https://evcc.local:8443`.

**Already on [Tailscale](https://tailscale.com)?** `tailscale serve` gives a
valid, publicly-trusted cert for free, no port forwarding:

```bash
tailscale serve --bg --https=443 http://localhost:7070
```

Point `url` at `https://<device>.<tailnet>.ts.net`.

### CORS only (writes fail, reads/state work, both sides already https or already http)

Add CORS headers on a reverse proxy in front of evcc. **Caddy:**

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
