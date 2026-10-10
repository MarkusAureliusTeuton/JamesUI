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
      const info = document.createElement("p");
      info.textContent = "Verwendet eine konfigurierte Wetterdatenquelle oder die verfügbare Home-Assistant-Wetterentität.";
      form.appendChild(info);
    } else if (item.module_id === "widget.calendar-agenda") {
      createField(form, fields, "calendars", "Kalender-Entitäten (durch Komma getrennt)", {
        placeholder: "calendar.familie, calendar.privat", multiline: true,
      });
      createField(form, fields, "tasks", "Aufgabenlisten (optional)", {
        placeholder: "todo.haus, todo.einkauf", multiline: true,
      });
    } else if (item.module_id === "widget.house-quick") {
      createField(form, fields, "lightEntityId", "Licht-Entität (bei bereits konfigurierten Lichtquellen optional)", {
        placeholder: "light.wohnzimmer",
      });
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
    note.textContent = "Neue Datenquellen werden nach dem nächsten Öffnen von JamesUI Next aktiv. Es werden keine Beispiel-Entitäten angelegt.";
    form.appendChild(note);
    form.appendChild(error);
    const add = createButton(form, "Widget hinzufügen", () => {
      try {
        const values = Object.fromEntries([...fields.entries()].map(([key, field]) => [key, field.value]));
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
