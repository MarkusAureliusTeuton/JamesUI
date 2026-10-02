"""WebSocket API for JamesUI configuration."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from .config_migrations import (
    LEGACY_OPTION_KEYS,
    apply_legacy_changes,
    project_legacy_options,
)
from .config_schema import ConfigValidationError
from .config_service import JamesUIConfigService
from .const import DOMAIN


ENTITY_CONFIG_KEYS = {
    "weather_entity",
    "outdoor_temperature_entity",
    "moon_entity",
    "illuminance_entity",
    "media_spotify_entity",
    "media_onkyo_entity",
    "media_ma_player_entity",
}

BACKGROUND_SCENES = [
    "clear-day",
    "cloudy-day",
    "rain-day",
    "snow-day",
    "fog",
    "dusk",
    "clear-night",
    "cloudy-night",
]

VALUE_CONFIG_KEYS = {
    "background_mode",
    "background_scene",
    "media_route",
    "media_spotify_source",
    "media_onkyo_source",
    "media_playlist_name",
    "media_playlist_uri",
}


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


# Temporary r11 compatibility API. Remove with the old runtime in Block 20/21.
@websocket_api.websocket_command({vol.Required("type"): "jamesui/config"})
@callback
def websocket_get_config(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict,
) -> None:
    """Return the legacy flat projection of canonical JamesUI configuration."""
    service = _config_service(hass)
    if service is None:
        _send_not_configured(connection, msg["id"])
        return
    connection.send_result(
        msg["id"],
        {"options": project_legacy_options(service.snapshot())},
    )


@websocket_api.require_admin
@websocket_api.websocket_command(
    {
        vol.Required("type"): "jamesui/config/update",
        vol.Optional("weather_entity"): vol.Any(str, None),
        vol.Optional("outdoor_temperature_entity"): vol.Any(str, None),
        vol.Optional("moon_entity"): vol.Any(str, None),
        vol.Optional("illuminance_entity"): vol.Any(str, None),
        vol.Optional("background_mode"): vol.Any(vol.In(["auto", "manual"]), None),
        vol.Optional("background_scene"): vol.Any(vol.In(BACKGROUND_SCENES), None),
        vol.Optional("home_scene_entities"): vol.Any(
            vol.All([str], vol.Length(max=4)), None
        ),
        vol.Optional("media_spotify_entity"): vol.Any(str, None),
        vol.Optional("media_onkyo_entity"): vol.Any(str, None),
        vol.Optional("media_ma_player_entity"): vol.Any(str, None),
        vol.Optional("media_route"): vol.Any(
            vol.In(["auto", "music_assistant", "spotify_connect"]), None
        ),
        vol.Optional("media_spotify_source"): vol.Any(str, None),
        vol.Optional("media_onkyo_source"): vol.Any(str, None),
        vol.Optional("media_playlist_name"): vol.Any(str, None),
        vol.Optional("media_playlist_uri"): vol.Any(str, None),
    }
)
async def websocket_update_config(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict,
) -> None:
    """Apply a legacy r11 patch to canonical JamesUI configuration."""
    service = _config_service(hass)
    if service is None:
        _send_not_configured(connection, msg["id"])
        return

    changes: dict[str, Any] = {}
    for key in LEGACY_OPTION_KEYS:
        if key in msg:
            changes[key] = msg[key]

    for key in ENTITY_CONFIG_KEYS:
        if key not in changes:
            continue
        value = changes[key]
        if isinstance(value, str):
            value = value.strip()
            changes[key] = value
        if value and value not in hass.states:
            connection.send_error(
                msg["id"], "entity_not_found", f"Entity {value} was not found"
            )
            return

    if "home_scene_entities" in changes:
        scene_entities: list[str] = []
        seen: set[str] = set()
        for raw_value in changes.get("home_scene_entities") or []:
            entity_id = raw_value.strip()
            if not entity_id or entity_id in seen:
                continue
            if not entity_id.startswith("scene."):
                connection.send_error(
                    msg["id"], "invalid_scene", f"Entity {entity_id} is not a scene"
                )
                return
            if entity_id not in hass.states:
                connection.send_error(
                    msg["id"], "entity_not_found", f"Entity {entity_id} was not found"
                )
                return
            scene_entities.append(entity_id)
            seen.add(entity_id)
        changes["home_scene_entities"] = scene_entities[:4]

    try:
        config = await service.async_update(
            lambda current: apply_legacy_changes(current, changes)
        )
    except ConfigValidationError as error:
        connection.send_error(msg["id"], "invalid_config", str(error))
        return

    connection.send_result(msg["id"], {"options": project_legacy_options(config)})


@websocket_api.websocket_command({vol.Required("type"): "jamesui/config/get"})
@callback
def websocket_get_structured_config(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict,
) -> None:
    """Return the canonical structured JamesUI configuration."""
    service = _config_service(hass)
    if service is None:
        _send_not_configured(connection, msg["id"])
        return
    connection.send_result(msg["id"], {"config": service.snapshot()})


@websocket_api.require_admin
@websocket_api.websocket_command(
    {
        vol.Required("type"): "jamesui/config/replace",
        vol.Required("config"): dict,
    }
)
async def websocket_replace_structured_config(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict,
) -> None:
    """Validate and replace canonical structured JamesUI configuration."""
    service = _config_service(hass)
    if service is None:
        _send_not_configured(connection, msg["id"])
        return
    try:
        config = await service.async_replace(msg["config"])
    except ConfigValidationError as error:
        connection.send_error(msg["id"], "invalid_config", str(error))
        return
    connection.send_result(msg["id"], {"config": config})


def async_register_websocket_commands(hass: HomeAssistant) -> None:
    """Register JamesUI WebSocket commands."""
    websocket_api.async_register_command(hass, websocket_get_config)
    websocket_api.async_register_command(hass, websocket_update_config)
    websocket_api.async_register_command(hass, websocket_get_structured_config)
    websocket_api.async_register_command(hass, websocket_replace_structured_config)
