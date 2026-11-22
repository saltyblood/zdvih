import { describe, expect, it } from 'vitest';
import { createRestTick } from '../../src/services/restTick';

function make(initial: number, clears = true) {
  const s = { remaining: initial, vibrations: 0, cleared: 0 };
  const tick = createRestTick(
    {
      remainingSeconds: async () => s.remaining,
      onTickReachedZero: async () => {
        s.cleared++;
        return clears;
      },
    },
    () => {
      s.vibrations++;
    },
  );
  return { s, tick };
}

describe('T4 tick', () => {
  it('vibrates once on the crossing from > 0 to 0', async () => {
    const { s, tick } = make(2);
    await tick.tick();
    s.remaining = 1;
    await tick.tick();
    s.remaining = 0;
    expect(await tick.tick()).toBe(true);
    await tick.tick();
    expect(s.vibrations).toBe(1);
  });

  it('does not vibrate when the first tick already sees 0 (cold start, return from background)', async () => {
    const { s, tick } = make(0);
    await tick.tick();
    await tick.tick();
    expect(s.vibrations).toBe(0);
    expect(s.cleared).toBe(0);
  });

  it('does not vibrate after reset() even if the rest expired meanwhile', async () => {
    const { s, tick } = make(5);
    await tick.tick();
    tick.reset();
    s.remaining = 0;
    await tick.tick();
    expect(s.vibrations).toBe(0);
  });

  it('does not vibrate when nothing was cleared (rest stopped by the user)', async () => {
    const { s, tick } = make(5, false);
    await tick.tick();
    s.remaining = 0;
    await tick.tick();
    expect(s.vibrations).toBe(0);
  });

  it('discards a tick that was in flight during reset()', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const s = { remaining: 5, vibrations: 0 };
    const tick = createRestTick(
      {
        remainingSeconds: async () => {
          const value = s.remaining;
          await gate;
          return value;
        },
        onTickReachedZero: async () => true,
      },
      () => {
        s.vibrations++;
      },
    );
    const inFlight = tick.tick();
    tick.reset();
    release();
    await inFlight;
    s.remaining = 0;
    await tick.tick();
    expect(s.vibrations).toBe(0);
  });
});
