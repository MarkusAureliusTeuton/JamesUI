"""JamesUI integration for Home Assistant."""

from __future__ import annotations

from pathlib import Path

from homeassistant.components.frontend import (
    async_register_built_in_panel,
    async_remove_panel,
)
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .api import async_register_websocket_commands
from .const import (
    DOMAIN,
    FRONTEND_FILE,
    PANEL_ELEMENT,
    PANEL_ICON,
    PANEL_TITLE,
    PANEL_URL,
    STATIC_URL,
    VERSION,
)

_FRONTEND_DIR = Path(__file__).parent / "frontend"


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up JamesUI integration-level APIs."""
    async_register_websocket_commands(hass)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up JamesUI from a config entry."""
    hass.data.setdefault(DOMAIN, {})

    try:
        await hass.http.async_register_static_paths(
            [StaticPathConfig(STATIC_URL, str(_FRONTEND_DIR), False)]
        )
    except RuntimeError:
        # The HTTP route can remain registered after a config-entry reload.
        # Reusing it is safe because the directory path is stable.
        pass

    if PANEL_URL not in hass.data.get("frontend_panels", {}):
        async_register_built_in_panel(
            hass,
            component_name="custom",
            sidebar_title=PANEL_TITLE,
            sidebar_icon=PANEL_ICON,
            frontend_url_path=PANEL_URL,
            config={
                "_panel_custom": {
                    "name": PANEL_ELEMENT,
                    "embed_iframe": False,
                    "trust_external": False,
                    "js_url": f"{STATIC_URL}/{FRONTEND_FILE}?v={VERSION}",
                }
            },
            require_admin=False,
        )

    hass.data[DOMAIN][entry.entry_id] = {"version": VERSION}
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a JamesUI config entry."""
    if PANEL_URL in hass.data.get("frontend_panels", {}):
        async_remove_panel(hass, PANEL_URL)

    domain_data = hass.data.get(DOMAIN, {})
    domain_data.pop(entry.entry_id, None)
    if not domain_data:
        hass.data.pop(DOMAIN, None)

    return True
