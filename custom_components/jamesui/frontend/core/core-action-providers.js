function nonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

export function registerCoreActionProviders({ actions, router, openUrl } = {}) {
  if (!actions || typeof actions.register !== "function") {
    throw new TypeError("registerCoreActionProviders requires actions");
  }
  if (!router || typeof router.navigate !== "function") {
    throw new TypeError("registerCoreActionProviders requires router");
  }
  if (typeof openUrl !== "function") {
    throw new TypeError("registerCoreActionProviders requires openUrl");
  }

  const unregisterNavigate = actions.register("navigate", (action) => {
    if (!nonEmptyString(action.route)) return { status: "rejected" };
    return router.navigate(action.route)
      ? { status: "success" }
      : { status: "rejected" };
  });

  const unregisterUrl = actions.register("url.open", async (action) => {
    if (!nonEmptyString(action.url)) return { status: "rejected" };
    let parsed;
    try {
      parsed = new URL(action.url);
    } catch {
      return { status: "rejected" };
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { status: "rejected" };
    }
    const opened = await openUrl(action.url);
    return opened === false
      ? { status: "rejected" }
      : { status: "success" };
  });

  let active = true;
  return () => {
    if (!active) return false;
    active = false;
    unregisterNavigate();
    unregisterUrl();
    return true;
  };
}
