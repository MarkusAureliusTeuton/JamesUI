from pathlib import Path
import unittest


FRONTEND = Path("custom_components/jamesui/frontend")
MODULES = FRONTEND / "modules"
CORE = FRONTEND / "core"
ICONS = FRONTEND / "icons"
SHARED = FRONTEND / "shared"
CALENDAR = MODULES / "provider.calendar"
TASKS = MODULES / "provider.tasks"
TASK_UPDATE = MODULES / "action.task-update"
AGENDA = MODULES / "widget.calendar-agenda"

EXPECTED_FILES = {
    CALENDAR: {"manifest.js", "config.js", "normalize.js", "provider.js", "index.js"},
    TASKS: {"manifest.js", "config.js", "normalize.js", "provider.js", "index.js"},
    TASK_UPDATE: {"manifest.js", "config.js", "action.js", "index.js"},
    AGENDA: {
        "manifest.js",
        "config.js",
        "presentation.js",
        "model.js",
        "notices.js",
        "overlay.js",
        "gesture.js",
        "sizing.js",
        "styles.js",
        "widget.js",
        "index.js",
    },
}

RAW_HA_WIDGET_TOKENS = (
    "homeAssistant",
    "hass.",
    "callService",
    "callWS",
    "subscribeMessage",
    "todo.update_item",
    "todo/item/",
)

LEGACY_TOKENS = (
    "Panel.prototype",
    "jamesui-panel",
    "jamesui-v11",
    "jamesui-home-entry",
)

CORE_COUPLING_TOKENS = (
    "widget.calendar-agenda",
    "provider.calendar",
    "provider.tasks",
    "action.task-update",
    "calendar.events",
    "tasks.items",
    "task.update",
    "data-jui-agenda",
)


class Block11ArchitectureTest(unittest.TestCase):
    def test_exact_block11_module_file_boundaries(self):
        for root, expected in EXPECTED_FILES.items():
            self.assertTrue(root.is_dir(), f"missing Block 11 module directory: {root}")
            actual = {path.name for path in root.iterdir() if path.is_file()}
            self.assertEqual(actual, expected, f"unexpected Block 11 module boundary in {root}")

        self.assertTrue((SHARED / "zoned-time.js").is_file())
        self.assertTrue((SHARED / "todo-features.js").is_file())

    def test_agenda_widget_is_capability_action_overlay_only_and_legacy_free(self):
        source = "\n".join(path.read_text(encoding="utf-8") for path in AGENDA.glob("*.js"))
        for token in (*RAW_HA_WIDGET_TOKENS, *LEGACY_TOKENS):
            self.assertNotIn(token, source, f"Agenda widget must not contain coupling: {token}")

        for token in (
            "config-service",
            "createConfigService",
            "router.js",
            "health-service",
            "module-registry",
            "module-loader",
            "capability-registry",
            "action-registry",
        ):
            self.assertNotIn(token, source, f"Agenda widget must not import Core service internals: {token}")

        widget_source = (AGENDA / "widget.js").read_text(encoding="utf-8")
        self.assertIn('context.capabilities.subscribe("calendar.events"', widget_source)
        self.assertIn('context.capabilities.subscribe("tasks.items"', widget_source)
        self.assertIn('type: "task.update"', widget_source)
        self.assertIn("context.overlays.open", widget_source)

    def test_providers_and_action_are_dom_design_icon_free(self):
        for root in (CALENDAR, TASKS, TASK_UPDATE):
            source = "\n".join(path.read_text(encoding="utf-8") for path in root.glob("*.js"))
            for token in (
                "document.",
                "window.",
                "createElement",
                "innerHTML",
                "outerHTML",
                "<svg",
                "<style",
                "data:image",
                "/design/",
                "/icons/",
                "createIcon",
                "createButton",
            ):
                self.assertNotIn(token, source, f"data/action module must stay presentation-free: {root} contains {token}")

        calendar_source = (CALENDAR / "provider.js").read_text(encoding="utf-8")
        tasks_source = (TASKS / "provider.js").read_text(encoding="utf-8")
        action_source = (TASK_UPDATE / "action.js").read_text(encoding="utf-8")
        self.assertIn("homeAssistant", calendar_source)
        self.assertIn("homeAssistant", tasks_source)
        self.assertIn("homeAssistant", action_source)

    def test_shared_block11_helpers_have_no_dom_or_raw_home_assistant_access(self):
        for path in (SHARED / "zoned-time.js", SHARED / "todo-features.js"):
            source = path.read_text(encoding="utf-8")
            for token in (
                "document.",
                "window.",
                "homeAssistant",
                "hass.",
                "callService",
                "callWS",
                "subscribeMessage",
            ):
                self.assertNotIn(token, source, f"shared helper must stay infrastructure-free: {path} contains {token}")

    def test_core_contains_no_block11_domain_behavior(self):
        source = "\n".join(path.read_text(encoding="utf-8") for path in CORE.glob("*.js"))
        for token in CORE_COUPLING_TOKENS:
            self.assertNotIn(token, source, f"Core must not own Block 11 behavior: {token}")

    def test_agenda_icons_use_existing_local_registry_only(self):
        definitions = (ICONS / "icon-definitions.js").read_text(encoding="utf-8")
        agenda_ids = (
            "home.calendar",
            "home.task",
            "home.birthday",
            "home.waste",
            "home.recycling",
            "home.paper",
        )
        for icon_id in agenda_ids:
            self.assertEqual(definitions.count(f'"{icon_id}"'), 1, f"Agenda icon must be declared exactly once: {icon_id}")

        agenda_source = "\n".join(path.read_text(encoding="utf-8") for path in AGENDA.glob("*.js"))
        self.assertIn("createIcon", agenda_source)
        for token in ("<svg", "data:image", "cdn.jsdelivr", "unpkg", "http://", "https://"):
            self.assertNotIn(token, agenda_source, f"Agenda must not bypass local icon registry: {token}")

    def test_block11_is_not_wired_into_legacy_start_or_production_bootstrap(self):
        production_files = (
            FRONTEND / "jamesui-entry.js",
            FRONTEND / "jamesui-home-entry.js",
            FRONTEND / "jamesui-home.js",
            FRONTEND / "jamesui-panel.js",
        )
        module_ids = (
            "provider.calendar",
            "provider.tasks",
            "action.task-update",
            "widget.calendar-agenda",
        )
        for path in production_files:
            source = path.read_text(encoding="utf-8")
            for module_id in module_ids:
                self.assertNotIn(module_id, source, f"Block 11 must not cut over production/Start yet: {path} contains {module_id}")


if __name__ == "__main__":
    unittest.main()
