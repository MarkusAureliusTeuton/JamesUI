import asyncio
import importlib.util
from pathlib import Path
import sys
import types
import unittest


ROOT = Path("custom_components/jamesui")


def load_module(name, filename):
    if "custom_components" not in sys.modules:
        package = types.ModuleType("custom_components")
        package.__path__ = [str(ROOT.parent)]
        sys.modules["custom_components"] = package
    if "custom_components.jamesui" not in sys.modules:
        package = types.ModuleType("custom_components.jamesui")
        package.__path__ = [str(ROOT)]
        sys.modules["custom_components.jamesui"] = package
    full_name = f"custom_components.jamesui.{name}"
    spec = importlib.util.spec_from_file_location(full_name, ROOT / filename)
    module = importlib.util.module_from_spec(spec)
    sys.modules[full_name] = module
    spec.loader.exec_module(module)
    return module


schema = load_module("config_schema", "config_schema.py")


class FakeStorage:
    def __init__(self, stored=None):
        self.stored = stored
        self.load_calls = 0
        self.saves = []
        self.fail_next_save = None
        self.block_save = None
        self.save_started = asyncio.Event()

    async def async_load(self):
        self.load_calls += 1
        return self.stored

    async def async_save(self, data):
        self.save_started.set()
        if self.block_save is not None:
            await self.block_save.wait()
        if self.fail_next_save is not None:
            error = self.fail_next_save
            self.fail_next_save = None
            raise error
        detached = schema.validate_config(data)
        self.saves.append(detached)
        self.stored = detached


class ConfigServiceTest(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls):
        cls.service_module = load_module("config_service", "config_service.py")

    async def test_first_initialize_validates_saves_and_returns_true(self):
        storage = FakeStorage()
        config = schema.empty_config()
        config["module_settings"]["demo"] = {"enabled": True}
        service = self.service_module.JamesUIConfigService(storage)

        self.assertTrue(await service.async_initialize(config))
        self.assertEqual(storage.load_calls, 1)
        self.assertEqual(storage.saves, [config])
        self.assertEqual(service.snapshot(), config)

    async def test_existing_store_wins_over_initial_config_without_save(self):
        stored = schema.empty_config()
        stored["data_sources"]["weather"] = {"entity_id": "weather.stored"}
        initial = schema.empty_config()
        initial["data_sources"]["weather"] = {"entity_id": "weather.legacy"}
        storage = FakeStorage(stored)
        service = self.service_module.JamesUIConfigService(storage)

        self.assertFalse(await service.async_initialize(initial))
        self.assertEqual(storage.saves, [])
        self.assertEqual(service.snapshot(), stored)

    async def test_snapshot_is_detached_and_requires_initialization(self):
        service = self.service_module.JamesUIConfigService(FakeStorage())
        with self.assertRaisesRegex(RuntimeError, "initialized"):
            service.snapshot()
        config = schema.empty_config()
        await service.async_initialize(config)
        first = service.snapshot()
        first["pages"]["home"] = {"layout": "x"}
        self.assertEqual(service.snapshot()["pages"], {})

    async def test_invalid_replace_does_not_save_or_change_snapshot(self):
        storage = FakeStorage()
        service = self.service_module.JamesUIConfigService(storage)
        initial = schema.empty_config()
        await service.async_initialize(initial)
        save_count = len(storage.saves)
        invalid = schema.empty_config()
        invalid["pages"] = []

        with self.assertRaises(schema.ConfigValidationError):
            await service.async_replace(invalid)
        self.assertEqual(len(storage.saves), save_count)
        self.assertEqual(service.snapshot(), initial)

    async def test_storage_failure_rolls_back_in_memory_snapshot(self):
        storage = FakeStorage()
        service = self.service_module.JamesUIConfigService(storage)
        initial = schema.empty_config()
        await service.async_initialize(initial)
        replacement = schema.empty_config()
        replacement["pages"]["home"] = {"layout": "hero"}
        storage.fail_next_save = OSError("disk full")

        with self.assertRaisesRegex(OSError, "disk full"):
            await service.async_replace(replacement)
        self.assertEqual(service.snapshot(), initial)

    async def test_concurrent_updates_are_serialized_against_latest_snapshot(self):
        storage = FakeStorage()
        service = self.service_module.JamesUIConfigService(storage)
        await service.async_initialize(schema.empty_config())
        storage.saves.clear()
        storage.save_started.clear()
        storage.block_save = asyncio.Event()

        def add_page(config):
            config["pages"]["home"] = {"layout": "hero"}
            return config

        def add_setting(config):
            config["module_settings"]["demo"] = {"enabled": True}
            return config

        first = asyncio.create_task(service.async_update(add_page))
        await storage.save_started.wait()
        second = asyncio.create_task(service.async_update(add_setting))
        await asyncio.sleep(0)
        self.assertFalse(second.done())
        storage.block_save.set()
        await asyncio.gather(first, second)

        snapshot = service.snapshot()
        self.assertEqual(snapshot["pages"]["home"], {"layout": "hero"})
        self.assertEqual(snapshot["module_settings"]["demo"], {"enabled": True})
        self.assertEqual(len(storage.saves), 2)
        self.assertNotIn("demo", storage.saves[0]["module_settings"])
        self.assertEqual(storage.saves[1], snapshot)


if __name__ == "__main__":
    unittest.main()
