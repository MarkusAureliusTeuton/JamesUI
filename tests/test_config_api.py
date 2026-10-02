import asyncio
import importlib.util
from pathlib import Path
import sys
import types
import unittest


ROOT = Path("custom_components/jamesui")


def install_stubs():
    vol = types.ModuleType("voluptuous")
    vol.Required = lambda key: key
    vol.Optional = lambda key: key
    vol.Any = lambda *args: ("any", args)
    vol.In = lambda values: ("in", tuple(values))
    vol.All = lambda *args: ("all", args)
    vol.Length = lambda **kwargs: ("length", kwargs)
    sys.modules["voluptuous"] = vol

    ha = types.ModuleType("homeassistant")
    ha.__path__ = []
    components = types.ModuleType("homeassistant.components")
    components.__path__ = []
    websocket_api = types.ModuleType("homeassistant.components.websocket_api")

    def websocket_command(schema):
        def decorate(fn):
            fn._ws_schema = schema
            return fn
        return decorate

    def require_admin(fn):
        fn._requires_admin = True
        return fn

    websocket_api.websocket_command = websocket_command
    websocket_api.require_admin = require_admin
    websocket_api.async_register_command = lambda hass, command: hass.registered.append(command)
    websocket_api.ActiveConnection = object
    components.websocket_api = websocket_api

    core = types.ModuleType("homeassistant.core")
    core.HomeAssistant = object
    core.callback = lambda fn: fn

    sys.modules["homeassistant"] = ha
    sys.modules["homeassistant.components"] = components
    sys.modules["homeassistant.components.websocket_api"] = websocket_api
    sys.modules["homeassistant.core"] = core


def ensure_package():
    if "custom_components" not in sys.modules:
        package = types.ModuleType("custom_components")
        package.__path__ = [str(ROOT.parent)]
        sys.modules["custom_components"] = package
    if "custom_components.jamesui" not in sys.modules:
        package = types.ModuleType("custom_components.jamesui")
        package.__path__ = [str(ROOT)]
        sys.modules["custom_components.jamesui"] = package


def load_module(name, filename):
    ensure_package()
    full_name = f"custom_components.jamesui.{name}"
    spec = importlib.util.spec_from_file_location(full_name, ROOT / filename)
    module = importlib.util.module_from_spec(spec)
    sys.modules[full_name] = module
    spec.loader.exec_module(module)
    return module


class FakeService:
    def __init__(self, config, validate):
        self._config = validate(config)
        self._validate = validate
        self.replace_calls = []
        self.update_calls = 0

    def snapshot(self):
        return self._validate(self._config)

    async def async_replace(self, config):
        validated = self._validate(config)
        self.replace_calls.append(validated)
        self._config = validated
        return self.snapshot()

    async def async_update(self, transform):
        self.update_calls += 1
        candidate = transform(self.snapshot())
        self._config = self._validate(candidate)
        return self.snapshot()


class FakeConfigEntries:
    def __init__(self, entry):
        self.entry = entry

    def async_entries(self, domain):
        return [self.entry] if self.entry is not None else []


class FakeHass:
    def __init__(self, domain, service=None, states=None):
        self.registered = []
        self.states = states or {}
        self.entry = types.SimpleNamespace(entry_id="entry-1") if service is not None else None
        self.config_entries = FakeConfigEntries(self.entry)
        self.data = ({domain: {"entry-1": {"config": service}}} if service is not None else {})


class FakeConnection:
    def __init__(self):
        self.results = []
        self.errors = []

    def send_result(self, msg_id, result):
        self.results.append((msg_id, result))

    def send_error(self, msg_id, code, message):
        self.errors.append((msg_id, code, message))


class ConfigApiTest(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls):
        install_stubs()
        cls.schema = load_module("config_schema", "config_schema.py")
        cls.migrations = load_module("config_migrations", "config_migrations.py")
        cls.const = load_module("const", "const.py")
        cls.api = load_module("api", "api.py")

    def make_service(self, legacy=None):
        config = self.migrations.migrate_legacy_options(legacy or {})
        return FakeService(config, self.schema.validate_config)

    async def test_structured_get_returns_canonical_snapshot(self):
        service = self.make_service({"weather_entity": "weather.home"})
        hass = FakeHass(self.const.DOMAIN, service)
        connection = FakeConnection()
        self.api.websocket_get_structured_config(hass, connection, {"id": 1})
        self.assertEqual(connection.results, [(1, {"config": service.snapshot()})])
        self.assertEqual(connection.errors, [])

    async def test_structured_replace_is_admin_and_invalid_config_leaves_service_unchanged(self):
        self.assertTrue(getattr(self.api.websocket_replace_structured_config, "_requires_admin", False))
        service = self.make_service({"background_mode": "auto"})
        before = service.snapshot()
        hass = FakeHass(self.const.DOMAIN, service)
        connection = FakeConnection()
        invalid = self.schema.empty_config()
        invalid["pages"] = []

        await self.api.websocket_replace_structured_config(
            hass, connection, {"id": 2, "config": invalid}
        )
        self.assertEqual(service.snapshot(), before)
        self.assertEqual(connection.results, [])
        self.assertEqual(connection.errors[0][1], "invalid_config")

        valid = self.schema.empty_config()
        valid["pages"]["home"] = {"layout": "hero"}
        connection = FakeConnection()
        await self.api.websocket_replace_structured_config(
            hass, connection, {"id": 3, "config": valid}
        )
        self.assertEqual(connection.results, [(3, {"config": valid})])

    async def test_legacy_get_projects_store_after_options_cleanup(self):
        service = self.make_service({
            "weather_entity": "weather.home",
            "background_mode": "manual",
        })
        hass = FakeHass(self.const.DOMAIN, service)
        connection = FakeConnection()
        self.api.websocket_get_config(hass, connection, {"id": 4})
        self.assertEqual(connection.results, [(4, {"options": {
            "weather_entity": "weather.home",
            "background_mode": "manual",
        }})])

    async def test_legacy_update_changes_canonical_store_and_preserves_validation(self):
        service = self.make_service({"weather_entity": "weather.old"})
        hass = FakeHass(
            self.const.DOMAIN,
            service,
            states={"weather.new": object(), "scene.a": object(), "scene.b": object()},
        )
        connection = FakeConnection()
        await self.api.websocket_update_config(hass, connection, {
            "id": 5,
            "weather_entity": " weather.new ",
            "home_scene_entities": [" scene.a ", "scene.a", "scene.b"],
        })
        self.assertEqual(connection.errors, [])
        projected = self.migrations.project_legacy_options(service.snapshot())
        self.assertEqual(projected["weather_entity"], "weather.new")
        self.assertEqual(projected["home_scene_entities"], ["scene.a", "scene.b"])
        self.assertEqual(connection.results, [(5, {"options": projected})])

        missing = FakeConnection()
        await self.api.websocket_update_config(
            hass, missing, {"id": 6, "weather_entity": "weather.missing"}
        )
        self.assertEqual(missing.errors[0][1], "entity_not_found")

        invalid_scene = FakeConnection()
        await self.api.websocket_update_config(
            hass, invalid_scene, {"id": 7, "home_scene_entities": ["light.not_scene"]}
        )
        self.assertEqual(invalid_scene.errors[0][1], "invalid_scene")

    async def test_all_endpoints_report_not_configured_without_service(self):
        hass = FakeHass(self.const.DOMAIN)
        for handler, msg in [
            (self.api.websocket_get_config, {"id": 8}),
            (self.api.websocket_get_structured_config, {"id": 9}),
        ]:
            connection = FakeConnection()
            handler(hass, connection, msg)
            self.assertEqual(connection.errors[0][1], "not_configured")

        for handler, msg in [
            (self.api.websocket_update_config, {"id": 10}),
            (self.api.websocket_replace_structured_config, {"id": 11, "config": self.schema.empty_config()}),
        ]:
            connection = FakeConnection()
            await handler(hass, connection, msg)
            self.assertEqual(connection.errors[0][1], "not_configured")

    def test_registers_all_four_commands_and_has_no_options_persistence(self):
        service = self.make_service()
        hass = FakeHass(self.const.DOMAIN, service)
        self.api.async_register_websocket_commands(hass)
        self.assertEqual(hass.registered, [
            self.api.websocket_get_config,
            self.api.websocket_update_config,
            self.api.websocket_get_structured_config,
            self.api.websocket_replace_structured_config,
        ])
        source = Path("custom_components/jamesui/api.py").read_text(encoding="utf-8")
        self.assertNotIn("entry.options", source)
        self.assertNotIn("async_update_entry", source)
        self.assertIn("Block 20/21", source)


if __name__ == "__main__":
    unittest.main()
