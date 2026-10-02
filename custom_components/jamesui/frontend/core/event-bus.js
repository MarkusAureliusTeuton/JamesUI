export function createEventBus({ onError = null } = {}) {
  const listeners = new Map();

  return {
    on(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      const group = listeners.get(type);
      group.add(listener);
      return () => group.delete(listener);
    },
    emit(type, detail) {
      const group = listeners.get(type);
      if (!group) return;
      for (const listener of [...group]) {
        try {
          listener(detail);
        } catch (error) {
          if (onError) onError({ type, error });
        }
      }
    },
    clear() {
      listeners.clear();
    },
  };
}
