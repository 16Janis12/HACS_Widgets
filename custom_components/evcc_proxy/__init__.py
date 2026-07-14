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
    hass.data.setdefault(DOMAIN, {})

    if "_view_registered" not in hass.data[DOMAIN]:
        hass.http.register_view(EvccProxyView(hass))
        hass.data[DOMAIN]["_view_registered"] = True

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
