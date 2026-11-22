import type { RestService } from './restService';

/**
 * T4 / 6.3: the 250 ms tick decision, kept out of the UI.
 * Vibrates only when the rest is cleared by `onTickReachedZero()` AND an earlier tick of the
 * same running rest saw remaining > 0, so never on the first tick after mount or after
 * returning from the background (T5 clears those silently). `reset()` forgets what was seen;
 * a tick that was in flight during a reset is discarded.
 */
export function createRestTick(
  rest: Pick<RestService, 'remainingSeconds' | 'onTickReachedZero'>,
  vibrate: () => void,
) {
  let sawPositive = false;
  let generation = 0;
  let busy = false;

  return {
    async tick(): Promise<boolean> {
      if (busy) return false;
      busy = true;
      const gen = generation;
      try {
        const remaining = await rest.remainingSeconds();
        if (gen !== generation) return false;
        if (remaining > 0) {
          sawPositive = true;
          return false;
        }
        if (!sawPositive) return false;
        sawPositive = false;
        const reached = await rest.onTickReachedZero();
        if (!reached || gen !== generation) return false;
        vibrate();
        return true;
      } finally {
        busy = false;
      }
    },
    reset(): void {
      sawPositive = false;
      generation++;
    },
  };
}
