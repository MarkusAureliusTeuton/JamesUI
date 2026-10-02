"""Pure JamesUI configuration migration and legacy projection helpers."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from .config_schema import CONFIG_SCHEMA_VERSION, empty_config, validate_config


LEGACY_OPTION_KEYS = (
    "weather_entity",
    "outdoor_temperature_entity",
    "moon_entity",
    "illuminance_entity",
    "home_scene_entities",
    "background_mode",
    "background_scene",
    "media_spotify_entity",
    "media_onkyo_entity",
    "media_ma_player_entity",
    "media_route",
    "media_spotify_source",
    "media_onkyo_source",
    "media_playlist_name",
    "media_playlist_uri",
)

_LEGACY_PATHS = {
    "weather_entity": ("data_sources", "weather", "entity_id"),
    "outdoor_temperature_entity": ("data_sources", "weather", "outdoor_temperature_entity_id"),
    "moon_entity": ("data_sources", "weather", "moon_entity_id"),
    "illuminance_entity": ("data_sources", "weather", "illuminance_entity_id"),
    "media_spotify_entity": ("data_sources", "media", "spotify_entity_id"),
    "media_onkyo_entity": ("data_sources", "media", "onkyo_entity_id"),
    "media_ma_player_entity": ("data_sources", "media", "music_assistant_player_entity_id"),
    "background_mode": ("module_settings", "start", "background", "mode"),
    "background_scene": ("module_settings", "start", "background", "scene"),
    "home_scene_entities": ("module_settings", "start", "favorite_scene_entity_ids"),
    "media_route": ("module_settings", "media", "route"),
    "media_spotify_source": ("module_settings", "media", "spotify_source"),
    "media_onkyo_source": ("module_settings", "media", "onkyo_source"),
    "media_playlist_name": ("module_settings", "media", "playlist", "name"),
    "media_playlist_uri": ("module_settings", "media", "playlist", "uri"),
}


class UnsupportedConfigVersion(ValueError):
    """Raised when no explicit migration path exists for stored configuration."""


def _normalize_scenes(value: Any) -> list[str]:
    if not isinstance(value, (list, tuple)):
        return []
    result: list[str] = []
    seen: set[str] = set()
    for raw in value:
        if not isinstance(raw, str):
            continue
        entity_id = raw.strip()
        if not entity_id or entity_id in seen:
            continue
        seen.add(entity_id)
        result.append(entity_id)
        if len(result) == 4:
            break
    return result


def _normalize_legacy_value(key: str, value: Any) -> Any:
    if key == "home_scene_entities":
        scenes = _normalize_scenes(value)
        return scenes if scenes else None
    if isinstance(value, str):
        value = value.strip()
    return value if value not in (None, "", []) else None


def _set_path(config: dict[str, Any], path: tuple[str, ...], value: Any) -> None:
    current = config
    for key in path[:-1]:
        child = current.get(key)
        if not isinstance(child, dict):
            child = {}
            current[key] = child
        current = child
    current[path[-1]] = value


def _remove_path(config: dict[str, Any], path: tuple[str, ...]) -> None:
    stack: list[tuple[dict[str, Any], str]] = []
    current = config
    for key in path[:-1]:
        child = current.get(key)
        if not isinstance(child, dict):
            return
        stack.append((current, key))
        current = child
    current.pop(path[-1], None)
    for parent, key in reversed(stack):
        child = parent.get(key)
        if isinstance(child, dict) and not child:
            parent.pop(key, None)
        else:
            break


def _get_path(config: Mapping[str, Any], path: tuple[str, ...]) -> Any:
    current: Any = config
    for key in path:
        if not isinstance(current, Mapping) or key not in current:
            return None
        current = current[key]
    return current


def migrate_legacy_options(options: Mapping[str, Any]) -> dict[str, Any]:
    """Map sparse r11 config-entry options into the canonical schema-v1 document."""
    config = empty_config()
    for key in LEGACY_OPTION_KEYS:
        if key not in options:
            continue
        value = _normalize_legacy_value(key, options[key])
        if value is not None:
            _set_path(config, _LEGACY_PATHS[key], value)
    return validate_config(config)


def project_legacy_options(config: Mapping[str, Any]) -> dict[str, Any]:
    """Project canonical configuration into the temporary flat r11 API view."""
    validated = validate_config(config)
    projected: dict[str, Any] = {}
    for key in LEGACY_OPTION_KEYS:
        value = _get_path(validated, _LEGACY_PATHS[key])
        if value is None or value == "" or value == []:
            continue
        if isinstance(value, list):
            projected[key] = list(value)
        else:
            projected[key] = value
    return projected


def apply_legacy_changes(config: Mapping[str, Any], changes: Mapping[str, Any]) -> dict[str, Any]:
    """Apply a sparse legacy API patch without disturbing unrelated structured config."""
    updated = validate_config(config)
    for key in LEGACY_OPTION_KEYS:
        if key not in changes:
            continue
        value = _normalize_legacy_value(key, changes[key])
        path = _LEGACY_PATHS[key]
        if value is None:
            _remove_path(updated, path)
        else:
            _set_path(updated, path, value)
    return validate_config(updated)


def migrate_stored_config(old_version: int, data: Mapping[str, Any]) -> dict[str, Any]:
    """Migrate stored configuration through explicit sequential schema migrations."""
    if old_version == CONFIG_SCHEMA_VERSION:
        return validate_config(data)
    if old_version > CONFIG_SCHEMA_VERSION:
        raise UnsupportedConfigVersion(
            f"stored schema version {old_version} is newer than supported version {CONFIG_SCHEMA_VERSION}"
        )
    raise UnsupportedConfigVersion(
        f"no explicit migration from schema version {old_version} to {old_version + 1}"
    )
