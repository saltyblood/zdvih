import { describe, expect, it } from 'vitest';
import { createPickupDetector, type Sample } from '../../src/domain/pickupDetector';
import { DETECTOR } from '../../src/config';

const make = () => createPickupDetector({ ...DETECTOR });
const at = (t: number, x = 0, y = 0, z = 1): Sample => ({ t, x, y, z });

/** Feeds still samples every 100 ms for t in [from, to]; returns the results. */
function still(d: ReturnType<typeof make>, from: number, to: number) {
  const out: ('pickup' | null)[] = [];
  for (let t = from; t <= to; t += 100) out.push(d.push(at(t)));
  return out;
}

describe('pickup detector (3.1a, 3.1c)', () => {
  it('10 s of still samples then a large delta -> pickup', () => {
    const d = make();
    // the first still delta is observed at t=100, so 10 s of stillness ends at t=10100
    expect(still(d, 0, 10000).every((r) => r === null)).toBe(true);
    expect(d.push(at(10100, 0.5, 0, 1))).toBe('pickup');
  });

  it('9.9 s of stillness then a large delta -> null', () => {
    const d = make();
    still(d, 0, 9900);
    expect(d.push(at(10000, 0.5, 0, 1))).toBeNull();
  });

  it('continuous medium deltas never trigger', () => {
    const d = make();
    let x = 0;
    for (let t = 0; t <= 30000; t += 100) {
      x += t % 200 === 0 ? 0.06 : -0.06; // delta 0.06: between the thresholds
      expect(d.push(at(t, x))).toBeNull();
    }
    expect(d.push(at(30100, x + 0.5))).toBeNull();
  });

  it('a medium delta resets the still period', () => {
    const d = make();
    still(d, 0, 6000);
    expect(d.push(at(6100, 0.06, 0, 1))).toBeNull(); // medium
    for (let t = 6200; t <= 12000; t += 100) d.push(at(t, 0.06, 0, 1));
    expect(d.push(at(12100, 0.6, 0, 1))).toBeNull(); // only ~5.9 s still since the medium delta
  });

  it('fires once; the large delta itself restarts the period', () => {
    const d = make();
    still(d, 0, 10000);
    expect(d.push(at(10100, 0.5, 0, 1))).toBe('pickup');
    expect(d.push(at(10200, 1.0, 0, 1))).toBeNull();
  });

  it('reset() clears the accumulated still time', () => {
    const d = make();
    still(d, 0, 10000);
    d.reset();
    // after reset the first sample only seeds the previous value
    expect(d.push(at(10100, 0.5, 0, 1))).toBeNull();
    expect(d.push(at(10200, 1.0, 0, 1))).toBeNull();
  });
});
