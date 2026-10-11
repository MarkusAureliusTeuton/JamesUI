"""WebSocket API for the standalone JamesUI Next application."""

from __future__ import annotations

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from .config_schema import ConfigValidationError
from .config_service import ConfigConflictError, JamesUIConfigService
from .const import DOMAIN


def _config_service(hass: HomeAssistant) -> JamesUIConfigService | None:
    domain_data = hass.data.get(DOMAIN, {})
    for entry in hass.config_entries.async_entries(DOMAIN):
        entry_data = domain_data.get(entry.entry_id, {})
        service = entry_data.get("config")
        if isinstance(service, JamesUIConfigService) or service is not None:
            return service
    return None


def _send_not_configured(connection: websocket_api.ActiveConnection, msg_id: int) -> None:
    connection.send_error(msg_id, "not_configured", "JamesUI is not configured")


@websocket_api.websocket_command({vol.Required("type"): "jamesui/config/get"})
@callback
def websocket_get_structured_config(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict,
) -> None:
    """Return the canonical, versioned Next configuration."""
    service = _config_service(hass)
    if service is None:
        _send_not_configured(connection, msg["id"])
        return
    connection.send_result(msg["id"], {"config": service.snapshot(), "revision": service.revision})


@websocket_api.require_admin
@websocket_api.websocket_command(
    {
        vol.Required("type"): "jamesui/config/replace",
        vol.Required("config"): dict,
        vol.Required("expected_revision"): vol.All(str, vol.Length(min=64, max=64)),
    }
)
async def websocket_replace_structured_config(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict,
) -> None:
    """Validate and atomically replace the structured configuration."""
    service = _config_service(hass)
    if service is None:
        _send_not_configured(connection, msg["id"])
        return
    try:
        config = await service.async_replace(
            msg["config"], expected_revision=msg["expected_revision"]
        )
    except ConfigConflictError as error:
        connection.send_error(msg["id"], "config_conflict", str(error))
        return
    except ConfigValidationError as error:
        connection.send_error(msg["id"], "invalid_config", str(error))
        return
    connection.send_result(msg["id"], {"config": config, "revision": service.revision})


def async_register_websocket_commands(hass: HomeAssistant) -> None:
    """Expose only the two JamesUI Next config endpoints."""
    websocket_api.async_register_command(hass, websocket_get_structured_config)
    websocket_api.async_register_command(hass, websocket_replace_structured_config)
