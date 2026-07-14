"""Config flow for the evcc Proxy integration."""

from __future__ import annotations

import re
from typing import Any

import voluptuous as vol
from homeassistant.config_entries import (
    ConfigEntry,
    ConfigFlow,
    ConfigFlowResult,
    OptionsFlow,
)
from homeassistant.const import CONF_API_KEY, CONF_URL
from homeassistant.core import callback

from .const import CONF_SLUG, DOMAIN


def _slugify(value: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return value or "evcc"


class EvccProxyConfigFlow(ConfigFlow, domain=DOMAIN):
    """Handle a config flow for one evcc proxy instance."""

    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        errors: dict[str, str] = {}
        if user_input is not None:
            url = user_input[CONF_URL].rstrip("/")
            slug = _slugify(user_input.get(CONF_SLUG) or url)

            await self.async_set_unique_id(slug)
            self._abort_if_unique_id_configured()

            return self.async_create_entry(
                title=f"evcc ({slug})",
                data={
                    CONF_URL: url,
                    CONF_API_KEY: user_input.get(CONF_API_KEY) or None,
                    CONF_SLUG: slug,
                },
            )

        schema = vol.Schema(
            {
                vol.Required(CONF_URL, default="http://evcc.local:7070"): str,
                vol.Optional(CONF_API_KEY, default=""): str,
                vol.Optional(CONF_SLUG, default=""): str,
            }
        )
        return self.async_show_form(step_id="user", data_schema=schema, errors=errors)

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> EvccProxyOptionsFlow:
        return EvccProxyOptionsFlow()


class EvccProxyOptionsFlow(OptionsFlow):
    """Allow editing the evcc URL / API key after setup (slug is fixed).

    `self.config_entry` is set by HA's flow manager itself; assigning it here
    is deprecated (and rejected outright on newer core versions).
    """

    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            data = {**self.config_entry.data}
            data[CONF_URL] = user_input[CONF_URL].rstrip("/")
            data[CONF_API_KEY] = user_input.get(CONF_API_KEY) or None
            self.hass.config_entries.async_update_entry(self.config_entry, data=data)
            return self.async_create_entry(title="", data={})

        current = self.config_entry.data
        schema = vol.Schema(
            {
                vol.Required(CONF_URL, default=current.get(CONF_URL, "")): str,
                vol.Optional(CONF_API_KEY, default=current.get(CONF_API_KEY) or ""): str,
            }
        )
        return self.async_show_form(step_id="init", data_schema=schema)
