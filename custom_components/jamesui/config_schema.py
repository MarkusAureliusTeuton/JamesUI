"""Pure JamesUI structured configuration schema."""

from __future__ import annotations

import math
from collections.abc import Mapping
from typing import Any


CONFIG_SCHEMA_VERSION = 1
CONFIG_SECTION_NAMES = (
    "pages",
    "layouts",
    "widget_instances",
    "dynamic_buttons",
    "data_sources",
    "module_settings",
)

_REQUIRED_TOP_LEVEL = ("schema_version", *CONFIG_SECTION_NAMES)


class ConfigValidationError(ValueError):
    """Raised when a JamesUI configuration document is invalid."""


def empty_config() -> dict[str, Any]:
    """Return a fresh empty schema-v1 configuration."""
    return {
        "schema_version": CONFIG_SCHEMA_VERSION,
        **{section: {} for section in CONFIG_SECTION_NAMES},
    }


def _fail(path: str, message: str) -> None:
    raise ConfigValidationError(f"{path}: {message}")


def _copy_json_value(value: Any, path: str) -> Any:
    if value is None or isinstance(value, (str, bool, int)):
        return value
    if isinstance(value, float):
        if not math.isfinite(value):
            _fail(path, "number must be finite")
        return value
    if isinstance(value, list):
        return [_copy_json_value(item, f"{path}[{index}]") for index, item in enumerate(value)]
    if isinstance(value, Mapping):
        result: dict[str, Any] = {}
        for key, item in value.items():
            if not isinstance(key, str) or not key.strip():
                _fail(path, "mapping keys must be non-empty strings")
            result[key] = _copy_json_value(item, f"{path}.{key}")
        return result
    _fail(path, f"unsupported value type {type(value).__name__}")


def validate_config(value: Mapping[str, Any]) -> dict[str, Any]:
    """Validate and detach a schema-v1 JamesUI configuration document."""
    if not isinstance(value, Mapping):
        _fail("config", "must be an object")

    actual_keys = set(value.keys())
    expected_keys = set(_REQUIRED_TOP_LEVEL)
    missing = expected_keys - actual_keys
    unknown = actual_keys - expected_keys
    if missing:
        _fail("config", f"missing top-level key {sorted(missing)[0]}")
    if unknown:
        _fail(str(sorted(unknown, key=str)[0]), "unknown top-level key")

    if value["schema_version"] != CONFIG_SCHEMA_VERSION:
        _fail("schema_version", f"must equal {CONFIG_SCHEMA_VERSION}")

    validated: dict[str, Any] = {"schema_version": CONFIG_SCHEMA_VERSION}
    for section in CONFIG_SECTION_NAMES:
        section_value = value[section]
        if not isinstance(section_value, Mapping):
            _fail(section, "must be an object")
        validated[section] = _copy_json_value(section_value, section)
    return validated
