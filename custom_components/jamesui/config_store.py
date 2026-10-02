"""Home Assistant storage wrapper for JamesUI configuration."""

from __future__ import annotations

from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .config_migrations import migrate_stored_config
from .config_schema import CONFIG_SCHEMA_VERSION


CONFIG_STORE_KEY = "jamesui.config"


class JamesUIConfigStore(Store[dict[str, Any]]):
    """Versioned atomic Home Assistant store for canonical JamesUI config."""

    def __init__(self, hass: HomeAssistant) -> None:
        super().__init__(
            hass,
            CONFIG_SCHEMA_VERSION,
            CONFIG_STORE_KEY,
            atomic_writes=True,
        )

    async def _async_migrate_func(
        self,
        old_major_version: int,
        old_minor_version: int,
        old_data: dict[str, Any],
    ) -> dict[str, Any]:
        """Migrate stored config through the explicit JamesUI migration chain."""
        return migrate_stored_config(old_major_version, old_data)
