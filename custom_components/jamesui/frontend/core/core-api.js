export const CORE_API_VERSION = "1.0.0";

export function isCoreApiCompatible(requirement, coreApiVersion = CORE_API_VERSION) {
  if (typeof requirement !== "string" || typeof coreApiVersion !== "string") return false;
  const requirementMatch = /^(\d+)\.x$/.exec(requirement.trim());
  const versionMatch = /^(\d+)\.\d+\.\d+$/.exec(coreApiVersion.trim());
  if (!requirementMatch || !versionMatch) return false;
  return requirementMatch[1] === versionMatch[1];
}
