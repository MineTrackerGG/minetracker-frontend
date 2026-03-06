// Module-level pub/sub for cross-chart hover sync.
// Bypasses React state entirely — zero re-renders on hover.

type SyncCallback = (ts: number | null) => void;

const subscribers = new Set<SyncCallback>();

export const chartSync = {
  subscribe(cb: SyncCallback): () => void {
    subscribers.add(cb);
    return () => subscribers.delete(cb);
  },
  notify(ts: number | null): void {
    subscribers.forEach((cb) => cb(ts));
  },
};
