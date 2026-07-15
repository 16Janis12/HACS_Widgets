"""The evcc Proxy integration.

Lets evcc Card Suite cards reach evcc through a same-origin, HA-authenticated
HTTP endpoint instead of calling evcc directly from the browser. Fixes both
CORS and https-dashboard/http-evcc mixed-content blocks, and keeps the evcc
API key out of the Lovelace dashboard config.
"""

from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_API_KEY, CONF_URL, Platform
from homeassistant.core import HomeAssistant

from .const import CONF_SLUG, DOMAIN
from .http import EvccProxyView

PLATFORMS: list[Platform] = []


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    # Kept out of hass.data[DOMAIN] on purpose: that dict is iterated as
    # entry_id -> config in http.py's _forward(), and a stray sentinel value
    # in there breaks `c[CONF_SLUG]` on every request (crashed as a 500 once
    # requests actually got past auth).
    if not hass.data.get(f"{DOMAIN}_view_registered"):
        hass.http.register_view(EvccProxyView(hass))
        hass.data[f"{DOMAIN}_view_registered"] = True

    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN][entry.entry_id] = {
        CONF_URL: entry.data[CONF_URL],
        CONF_API_KEY: entry.data.get(CONF_API_KEY),
        CONF_SLUG: entry.data[CONF_SLUG],
    }
    entry.async_on_unload(entry.add_update_listener(_async_update_listener))
    return True


async def _async_update_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    hass.data[DOMAIN][entry.entry_id] = {
        CONF_URL: entry.data[CONF_URL],
        CONF_API_KEY: entry.data.get(CONF_API_KEY),
        CONF_SLUG: entry.data[CONF_SLUG],
    }


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    hass.data[DOMAIN].pop(entry.entry_id, None)
    return True
