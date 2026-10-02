export function createHealthService() {
  const records = new Map();
  const listeners = new Set();
  const notify = (change) => {
    for (const listener of [...listeners]) listener(change);
  };

  return {
    report(id, { status, message = "", error = null }) {
      const record = { id, status, message, error };
      records.set(id, record);
      notify({ id, record });
      return record;
    },
    get(id) {
      return records.get(id) ?? null;
    },
    list() {
      return [...records.values()];
    },
    clear(id) {
      if (!records.has(id)) return false;
      records.delete(id);
      notify({ id, record: null });
      return true;
    },
    clearAll() {
      if (records.size === 0) return;
      records.clear();
      notify({ id: null, record: null });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
