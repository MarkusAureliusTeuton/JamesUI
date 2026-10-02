import { CORE_API_VERSION } from "./core-api.js";
import { validateModuleManifest } from "./module-manifest.js";

export function createModuleRegistry({ coreApiVersion = CORE_API_VERSION } = {}) {
  const records = new Map();
  const capabilityProviders = new Map();

  return {
    register(manifest, { entryUrl } = {}) {
      const normalized = validateModuleManifest(manifest, { coreApiVersion });
      if (typeof entryUrl !== "string" || entryUrl.trim() === "") {
        throw new TypeError("entryUrl must be a non-empty string");
      }
      if (records.has(normalized.id)) {
        throw new TypeError(`module already registered: ${normalized.id}`);
      }
      for (const dependencyId of normalized.depends_on) {
        if (!records.has(dependencyId)) {
          throw new TypeError(`missing module dependency: ${dependencyId}`);
        }
      }
      for (const capability of normalized.provides_capabilities) {
        const owner = capabilityProviders.get(capability);
        if (owner) throw new TypeError(`capability already declared by ${owner}: ${capability}`);
      }

      const record = Object.freeze({ manifest: normalized, entryUrl });
      records.set(normalized.id, record);
      for (const capability of normalized.provides_capabilities) {
        capabilityProviders.set(capability, normalized.id);
      }
      return record;
    },

    unregister(id) {
      const record = records.get(id);
      if (!record) return false;
      for (const candidate of records.values()) {
        if (candidate.manifest.depends_on.includes(id)) return false;
      }
      records.delete(id);
      for (const capability of record.manifest.provides_capabilities) {
        if (capabilityProviders.get(capability) === id) capabilityProviders.delete(capability);
      }
      return true;
    },

    get(id) {
      return records.get(id) ?? null;
    },

    has(id) {
      return records.has(id);
    },

    list() {
      return [...records.values()];
    },

    getCapabilityProvider(capability) {
      return capabilityProviders.get(capability) ?? null;
    },
  };
}
