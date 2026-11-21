function envSeconds(value: string | undefined, fallback: number): number {
  const n = value === undefined ? NaN : Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

// D13: overrides apply in development builds only. The env vars are referenced
// literally so Expo can inline them.
export const REST_SECONDS: number = __DEV__
  ? envSeconds(process.env.EXPO_PUBLIC_REST_SECONDS, 180)
  : 180;

export const REMINDER_SECONDS: number = __DEV__
  ? envSeconds(process.env.EXPO_PUBLIC_REMINDER_SECONDS, 1800)
  : 1800;

export const REST_MS = REST_SECONDS * 1000;
export const REMINDER_MS = REMINDER_SECONDS * 1000;

/** Pickup detector thresholds (g); to be tuned on a real iPhone (R3). */
export const DETECTOR = {
  stillMaxDelta: 0.03,
  pickupMinDelta: 0.12,
  stillMs: 10000,
} as const;
