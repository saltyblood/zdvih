export type Sample = { t: number; x: number; y: number; z: number }; // t in ms, values in g

export interface PickupDetectorConfig {
  stillMaxDelta: number; // default 0.03 g
  pickupMinDelta: number; // default 0.12 g
  stillMs: number; // 10000 (SPEC)
}

export function createPickupDetector(cfg: PickupDetectorConfig): {
  push(s: Sample): 'pickup' | null;
  reset(): void;
} {
  let prev: Sample | null = null;
  let stillSince: number | null = null;

  return {
    push(s) {
      const p = prev;
      prev = s;
      if (!p) return null;
      const delta = Math.hypot(s.x - p.x, s.y - p.y, s.z - p.z);
      if (delta <= cfg.stillMaxDelta) {
        if (stillSince === null) stillSince = s.t;
        return null;
      }
      if (delta >= cfg.pickupMinDelta) {
        const pickup = stillSince !== null && s.t - stillSince >= cfg.stillMs;
        stillSince = null;
        return pickup ? 'pickup' : null;
      }
      stillSince = null;
      return null;
    },
    reset() {
      prev = null;
      stillSince = null;
    },
  };
}
