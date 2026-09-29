"""Config flow for JamesUI."""

from __future__ import annotations

from homeassistant import config_entries
from homeassistant.data_entry_flow import FlowResult

from .const import DOMAIN, NAME


class JamesUIConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle the JamesUI config flow."""

    VERSION = 1

    async def async_step_user(self, user_input=None) -> FlowResult:
        """Create the single JamesUI configuration entry."""
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()

        if user_input is not None:
            return self.async_create_entry(title=NAME, data={})

        return self.async_show_form(step_id="user")
