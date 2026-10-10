import { buildDashboardWidgetSetup } from "./dashboard-widget-setup.js";

// Registered, implemented widgets only. Setup never invents HA entities.
export function createDashboardCatalog({ moduleRegistry } = {}) {
  if (!moduleRegistry || typeof moduleRegistry.get !== "function") {
    throw new TypeError("Dashboard catalog requires Module Registry");
  }
  const known = [
    ["widget.weather-today", "Wetter"],
    ["widget.calendar-agenda", "Kalender und Aufgaben"],
    ["widget.house-quick", "Hausstatus"],
    ["widget.dynamic-buttons", "Dynamische Buttons"],
  ];
  return Object.freeze({
    entries() {
      return known.filter(([id]) => moduleRegistry.get(id)?.manifest?.type === "widget")
        .map(([id, title]) => Object.freeze({ module_id: id, title }));
    },
  });
}

export function createDashboardCatalogView({ document, catalog, onSelect, getConfig = null } = {}) {
  if (!document?.createElement || !catalog?.entries || typeof onSelect !== "function") {
    throw new TypeError("Dashboard catalog view requires document, catalog and onSelect");
  }
  if (getConfig !== null && typeof getConfig !== "function") {
    throw new TypeError("getConfig must be a function or null");
  }
  const root = document.createElement("section");
  root.setAttribute("data-jui-dashboard-catalog", "");
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-label", "Widget hinzufügen");
  root.hidden = true;
  root.style.position = "absolute";
  root.style.inset = "0";
  root.style.zIndex = "30";
  root.style.padding = "24px";
  root.style.overflow = "auto";
  root.style.background = "var(--jui-color-surface, #11151e)";
  root.style.color = "var(--jui-color-text, #ffffff)";

  const createButton = (parent, text, onClick, attribute = null) => {
    const node = document.createElement("button");
    node.setAttribute("type", "button");
    if (attribute) node.setAttribute(attribute[0], attribute[1]);
    node.textContent = text;
    node.addEventListener("click", onClick);
    parent.appendChild(node);
    return node;
  };
  const createField = (form, fields, key, label, { placeholder = "", multiline = false } = {}) => {
    const wrapper = document.createElement("label");
    wrapper.style.display = "block";
    wrapper.style.margin = "12px 0";
    wrapper.textContent = label;
    const input = document.createElement(multiline ? "textarea" : "input");
    if (!multiline) input.setAttribute("type", "text");
    input.setAttribute("data-jui-catalog-field", key);
    input.setAttribute("placeholder", placeholder);
    input.style.display = "block";
    input.style.width = "min(100%, 520px)";
    input.style.minHeight = multiline ? "64px" : "42px";
    input.style.fontSize = "16px";
    input.style.boxSizing = "border-box";
    wrapper.appendChild(input);
    form.appendChild(wrapper);
    fields.set(key, input);
  };

  const close = document.createElement("button");
  close.setAttribute("type", "button");
  close.textContent = "Schließen";
  close.addEventListener("click", () => { root.hidden = true; });

  const showModules = () => {
    root.replaceChildren(close);
    const title = document.createElement("h2");
    title.textContent = "Widget auswählen";
    root.appendChild(title);
    for (const item of catalog.entries()) {
      createButton(root, item.title, () => {
        if (!getConfig) {
          onSelect(item.module_id);
          root.hidden = true;
          return;
        }
        showSetup(item);
      }, ["data-jui-catalog-module", item.module_id]);
    }
  };

  const showSetup = (item) => {
    root.replaceChildren(close);
    createButton(root, "Zurück", showModules);
    const title = document.createElement("h2");
    title.textContent = item.title;
    root.appendChild(title);
    const form = document.createElement("form");
    form.setAttribute("data-jui-catalog-setup", item.module_id);
    const fields = new Map();

    if (item.module_id === "widget.weather-today") {
      createField(form, fields, "weatherEntityId", "Wetterentität", { placeholder: "weather.zuhause" });
      createField(form, fields, "outdoorTemperatureEntityId", "Außentemperatur (optional)", { placeholder: "sensor.aussentemperatur" });
      createField(form, fields, "moonEntityId", "Mondphase (optional)", { placeholder: "sensor.mondphase" });
      createField(form, fields, "illuminanceEntityId", "Helligkeit (optional)", { placeholder: "sensor.helligkeit" });
      const prior = getConfig().data_sources?.["provider.weather"] ?? getConfig().data_sources?.weather;
      if (prior) {
        const source = prior.config ?? prior;
        for (const [field, property] of [
          ["weatherEntityId", "entity_id"], ["outdoorTemperatureEntityId", "outdoor_temperature_entity_id"],
          ["moonEntityId", "moon_entity_id"], ["illuminanceEntityId", "illuminance_entity_id"],
        ]) fields.get(field).value = source[property] ?? "";
      }
    } else if (item.module_id === "widget.calendar-agenda") {
      createField(form, fields, "calendars", "Kalender-Entitäten (durch Komma getrennt)", {
        placeholder: "calendar.familie, calendar.privat", multiline: true,
      });
      createField(form, fields, "tasks", "Aufgabenlisten (optional)", {
        placeholder: "todo.haus, todo.einkauf", multiline: true,
      });
    } else if (item.module_id === "widget.house-quick") {
      const selectorLabel = document.createElement("label");
      selectorLabel.textContent = "Hausstatus-Typ";
      selectorLabel.style.display = "block";
      const select = document.createElement("select");
      select.setAttribute("data-jui-catalog-field", "houseType");
      for (const [id, label] of [
        ["lights", "Licht"], ["ambient_lights", "Ambientelicht"],
        ["heating_zone", "Heizungszone"], ["devices", "Geräte"], ["energy", "Energie"],
      ]) {
        const option = document.createElement("option");
        option.value = id;
        option.textContent = label;
        select.appendChild(option);
      }
      selectorLabel.appendChild(select);
      form.appendChild(selectorLabel);
      fields.set("houseType", select);
      const sections = new Map();
      const group = (kind) => {
        const section = document.createElement("section");
        section.setAttribute("data-jui-house-setup", kind);
        form.appendChild(section);
        sections.set(kind, section);
        return section;
      };
      const lights = group("lights");
      createField(lights, fields, "lightEntityId", "Lichtentität (optional bei vorhandener Gruppe)", {
        placeholder: "light.wohnzimmer",
      });
      const ambient = group("ambient_lights");
      // Both light groups intentionally share the same optional entity input.
      // Keep one field binding per type by copying the visible value at submit.
      createField(ambient, fields, "ambientEntityId", "Ambientelicht-Entität", {
        placeholder: "light.ambient",
      });
      const heating = group("heating_zone");
      createField(heating, fields, "heatingName", "Heizungszone", { placeholder: "Wohnzimmer" });
      createField(heating, fields, "currentTemperature", "Isttemperatur", { placeholder: "sensor.wohnzimmer_ist" });
      createField(heating, fields, "targetTemperature", "Solltemperatur", { placeholder: "sensor.wohnzimmer_soll" });
      createField(heating, fields, "heatingDemand", "Heizanforderung", { placeholder: "binary_sensor.heizung_anforderung" });
      createField(heating, fields, "autoRegulation", "Automatikregelung aktiv", { placeholder: "binary_sensor.heizung_auto" });
      const devices = group("devices");
      createField(devices, fields, "deviceName", "Gerätename", { placeholder: "Lüftungsanlage" });
      createField(devices, fields, "primaryEntity", "Haupt-Entität", { placeholder: "switch.lueftung" });
      createField(devices, fields, "activeEntity", "Aktivstatus", { placeholder: "binary_sensor.lueftung_aktiv" });
      createField(devices, fields, "updateEntity", "Update vorhanden (optional)", { placeholder: "binary_sensor.lueftung_update" });
      createField(devices, fields, "warningEntity", "Warnung (optional)", { placeholder: "binary_sensor.lueftung_warnung" });
      createField(devices, fields, "faultEntity", "Störung (optional)", { placeholder: "binary_sensor.lueftung_stoerung" });
      const energy = group("energy");
      createField(energy, fields, "energyName", "Energiequelle", { placeholder: "Hausverbrauch" });
      createField(energy, fields, "powerEntity", "Leistungssensor", { placeholder: "sensor.hausleistung" });
      createField(energy, fields, "averageWindow", "Mittelungszeit (Minuten)", { placeholder: "15" });
      fields.get("averageWindow").value = "15";
      createField(energy, fields, "warningThreshold", "Warnschwelle (W)", { placeholder: "3000" });
      createField(energy, fields, "criticalThreshold", "Kritische Schwelle (W)", { placeholder: "5000" });
      const updateVisible = () => {
        for (const [kind, section] of sections) section.hidden = kind !== select.value;
      };
      select.addEventListener("change", updateVisible);
      updateVisible();
    } else if (item.module_id === "widget.dynamic-buttons") {
      const current = getConfig();
      const definitions = current.dynamic_buttons ?? {};
      const wrapper = document.createElement("label");
      wrapper.style.display = "block";
      wrapper.textContent = "Vorhandenen Button verwenden (optional)";
      const select = document.createElement("select");
      select.setAttribute("data-jui-catalog-field", "existingButtonId");
      const empty = document.createElement("option");
      empty.value = "";
      empty.textContent = "Neuen Link-Button erstellen";
      select.appendChild(empty);
      for (const [id, definition] of Object.entries(definitions)) {
        const option = document.createElement("option");
        option.value = id;
        option.textContent = definition.name ?? id;
        select.appendChild(option);
      }
      wrapper.appendChild(select);
      form.appendChild(wrapper);
      fields.set("existingButtonId", select);
      createField(form, fields, "buttonName", "Neuer Button-Name (nur für neuen Link)", { placeholder: "Webseite" });
      createField(form, fields, "url", "Zieladresse (nur für neuen Link)", { placeholder: "https://example.org" });
    }

    const error = document.createElement("p");
    error.setAttribute("data-jui-catalog-error", "");
    error.setAttribute("role", "alert");
    error.hidden = true;
    const note = document.createElement("p");
    note.textContent = "Datenquellen werden beim Speichern übernommen und aktiviert. Fehlende Home-Assistant-Entitäten bleiben als nicht verfügbar erkennbar.";
    form.appendChild(note);
    form.appendChild(error);
    const add = createButton(form, "Widget hinzufügen", () => {
      try {
        const values = Object.fromEntries([...fields.entries()].map(([key, field]) => [key, field.value]));
        if (item.module_id === "widget.house-quick") {
          if (values.houseType === "ambient_lights") values.lightEntityId = values.ambientEntityId;
          if (values.houseType === "heating_zone") values.sourceName = values.heatingName;
          if (values.houseType === "devices") values.sourceName = values.deviceName;
          if (values.houseType === "energy") values.sourceName = values.energyName;
        }
        const plan = buildDashboardWidgetSetup({
          moduleId: item.module_id,
          inputs: values, currentConfig: getConfig(),
        });
        if (onSelect(item.module_id, plan) === false) throw new Error("Kein Platz für das Widget");
        root.hidden = true;
      } catch (failure) {
        error.textContent = failure?.message ?? "Widget kann nicht hinzugefügt werden";
        error.hidden = false;
      }
    });
    add.setAttribute("data-jui-catalog-confirm", "");
    root.appendChild(form);
  };

  return Object.freeze({
    root,
    open() { showModules(); root.hidden = false; },
    close() { root.hidden = true; },
  });
}
