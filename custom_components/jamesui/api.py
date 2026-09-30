"""WebSocket API for JamesUI configuration."""

from __future__ import annotations

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from .const import DOMAIN

CONFIG_KEYS = {
    "weather_entity",
    "outdoor_temperature_entity",
    "moon_entity",
    "illuminance_entity",
}


def _entry(hass: HomeAssistant):
    entries = hass.config_entries.async_entries(DOMAIN)
    return entries[0] if entries else None


@websocket_api.websocket_command({vol.Required("type"): "jamesui/config"})
@callback
def websocket_get_config(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict,
) -> None:
    """Return JamesUI configuration."""
    entry = _entry(hass)
    connection.send_result(
        msg["id"],
        {
            "options": dict(entry.options) if entry else {},
        },
    )


@websocket_api.require_admin
@websocket_api.websocket_command(
    {
        vol.Required("type"): "jamesui/config/update",
        vol.Optional("weather_entity"): vol.Any(str, None),
        vol.Optional("outdoor_temperature_entity"): vol.Any(str, None),
        vol.Optional("moon_entity"): vol.Any(str, None),
        vol.Optional("illuminance_entity"): vol.Any(str, None),
    }
)
@callback
def websocket_update_config(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict,
) -> None:
    """Update JamesUI configuration."""
    entry = _entry(hass)
    if entry is None:
        connection.send_error(msg["id"], "not_configured", "JamesUI is not configured")
        return

    options = dict(entry.options)
    for key in CONFIG_KEYS:
        if key not in msg:
            continue
        value = msg[key]
        if value:
            if value not in hass.states:
                connection.send_error(
                    msg["id"], "entity_not_found", f"Entity {value} was not found"
                )
                return
            options[key] = value
        else:
            options.pop(key, None)

    hass.config_entries.async_update_entry(entry, options=options)
    connection.send_result(msg["id"], {"options": options})


def async_register_websocket_commands(hass: HomeAssistant) -> None:
    """Register JamesUI WebSocket commands."""
    websocket_api.async_register_command(hass, websocket_get_config)
    websocket_api.async_register_command(hass, websocket_update_config)
