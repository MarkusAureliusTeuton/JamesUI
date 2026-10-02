export function createOverlayService() {
  let current = null;
  const listeners = new Set();
  const notify = () => {
    for (const listener of [...listeners]) listener(current);
  };

  return {
    get current() {
      return current;
    },
    open(descriptor) {
      if (!descriptor || typeof descriptor.id !== "string" || descriptor.id.trim() === "") {
        throw new TypeError("Overlay descriptor id must be a non-empty string");
      }
      current = descriptor;
      notify();
      const id = descriptor.id;
      return () => this.close(id);
    },
    close(id = null) {
      if (!current) return false;
      if (id !== null && current.id !== id) return false;
      current = null;
      notify();
      return true;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    clear() {
      if (!current) return;
      current = null;
      notify();
    },
  };
}
