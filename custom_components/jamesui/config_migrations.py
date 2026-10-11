"""Versioned migration boundary for standalone JamesUI Next storage."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from .config_schema import CONFIG_SCHEMA_VERSION, validate_config


class UnsupportedConfigVersion(ValueError):
    """No explicit migration is available for the stored version."""


def migrate_stored_config(old_version: int, data: Mapping[str, Any]) -> dict[str, Any]:
    """Accept the current schema; reject incompatible older/newer schemas."""
    if old_version == CONFIG_SCHEMA_VERSION:
        return validate_config(data)
    if old_version > CONFIG_SCHEMA_VERSION:
        raise UnsupportedConfigVersion(
            f"stored schema version {old_version} is newer than supported version {CONFIG_SCHEMA_VERSION}"
        )
    raise UnsupportedConfigVersion(
        f"no explicit migration from schema version {old_version} to {old_version + 1}"
    )
