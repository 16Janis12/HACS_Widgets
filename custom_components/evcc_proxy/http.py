"""HTTP view that proxies /api/evcc_proxy/<slug>/* to a configured evcc instance.

Runs server-side inside Home Assistant, so it is not subject to the browser's
CORS or mixed-content rules: the dashboard only ever talks same-origin https
to HA, and HA fetches evcc directly (any scheme, any host) itself.
"""

from __future__ import annotations

import logging

import aiohttp
from aiohttp import web
from homeassistant.components.http import HomeAssistantView
from homeassistant.const import CONF_API_KEY, CONF_URL
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .const import CONF_SLUG, DOMAIN, PROXY_URL_PATTERN

_LOGGER = logging.getLogger(__name__)

_HOP_BY_HOP = {"connection", "keep-alive", "transfer-encoding", "content-encoding", "content-length"}


class EvccProxyView(HomeAssistantView):
    """Forward authenticated HA requests to the evcc REST API."""

    url = PROXY_URL_PATTERN
    name = "api:evcc_proxy"
    requires_auth = True

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass

    async def _forward(self, request: web.Request, slug: str, path: str) -> web.Response:
        entries = self.hass.data.get(DOMAIN, {})
        cfg = next((c for c in entries.values() if c[CONF_SLUG] == slug), None)
        if cfg is None:
            return web.Response(status=404, text=f"no evcc proxy configured for slug '{slug}'")

        target = f"{cfg[CONF_URL]}/{path}"
        headers = {"Accept": "application/json"}
        if cfg.get(CONF_API_KEY):
            headers["Authorization"] = f"Bearer {cfg[CONF_API_KEY]}"

        body = await request.read()
        session = async_get_clientsession(self.hass)
        try:
            async with session.request(
                request.method,
                target,
                headers=headers,
                params=request.query,
                data=body or None,
                timeout=aiohttp.ClientTimeout(total=15),
            ) as resp:
                resp_body = await resp.read()
                out_headers = {
                    k: v for k, v in resp.headers.items() if k.lower() not in _HOP_BY_HOP
                }
                return web.Response(body=resp_body, status=resp.status, headers=out_headers)
        except aiohttp.ClientError as err:
            _LOGGER.warning("evcc proxy: cannot reach %s: %s", target, err)
            return web.Response(status=502, text=f"evcc unreachable at {cfg[CONF_URL]}: {err}")

    async def get(self, request: web.Request, slug: str, path: str) -> web.Response:
        return await self._forward(request, slug, path)

    async def post(self, request: web.Request, slug: str, path: str) -> web.Response:
        return await self._forward(request, slug, path)

    async def put(self, request: web.Request, slug: str, path: str) -> web.Response:
        return await self._forward(request, slug, path)

    async def patch(self, request: web.Request, slug: str, path: str) -> web.Response:
        return await self._forward(request, slug, path)

    async def delete(self, request: web.Request, slug: str, path: str) -> web.Response:
        return await self._forward(request, slug, path)
