import { CORE_API_VERSION, isCoreApiCompatible } from "./core-api.js";

export const SUPPORTED_MODULE_TYPES = Object.freeze(["layout", "widget", "provider", "action"]);

const REQUIRED_FIELDS = Object.freeze([
  "id",
  "type",
  "version",
  "core_api",
  "depends_on",
  "requires_capabilities",
  "provides_capabilities",
  "config_schema",
]);

function requireNonEmptyString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${field} must be a non-empty string`);
  }
}

function validateUniqueStringArray(value, field) {
  if (!Array.isArray(value)) throw new TypeError(`${field} must be an array`);
  const normalized = value.map((item) => {
    requireNonEmptyString(item, field);
    return item;
  });
  if (new Set(normalized).size !== normalized.length) {
    throw new TypeError(`${field} must contain unique values`);
  }
  return Object.freeze([...normalized]);
}

export function validateModuleManifest(manifest, { coreApiVersion = CORE_API_VERSION } = {}) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new TypeError("manifest must be an object");
  }
  if (Object.prototype.hasOwnProperty.call(manifest, "requires")) {
    throw new TypeError("manifest field requires is ambiguous; use depends_on/requires_capabilities");
  }
  for (const field of REQUIRED_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(manifest, field)) {
      throw new TypeError(`manifest is missing required field: ${field}`);
    }
  }

  requireNonEmptyString(manifest.id, "id");
  requireNonEmptyString(manifest.type, "type");
  requireNonEmptyString(manifest.version, "version");
  requireNonEmptyString(manifest.core_api, "core_api");
  requireNonEmptyString(manifest.config_schema, "config_schema");

  if (!SUPPORTED_MODULE_TYPES.includes(manifest.type)) {
    throw new TypeError(`unsupported module type: ${manifest.type}`);
  }
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) {
    throw new TypeError("version must be MAJOR.MINOR.PATCH");
  }
  if (!isCoreApiCompatible(manifest.core_api, coreApiVersion)) {
    throw new TypeError(`incompatible core_api requirement: ${manifest.core_api}`);
  }

  const dependsOn = validateUniqueStringArray(manifest.depends_on, "depends_on");
  const requiresCapabilities = validateUniqueStringArray(manifest.requires_capabilities, "requires_capabilities");
  const providesCapabilities = validateUniqueStringArray(manifest.provides_capabilities, "provides_capabilities");

  if (dependsOn.includes(manifest.id)) throw new TypeError("module may not depend on itself");

  return Object.freeze({
    ...manifest,
    depends_on: dependsOn,
    requires_capabilities: requiresCapabilities,
    provides_capabilities: providesCapabilities,
  });
}
