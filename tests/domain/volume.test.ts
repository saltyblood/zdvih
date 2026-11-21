import { describe, expect, it } from 'vitest';
import { formatVolume, volumeCg } from '../../src/domain/volume';

describe('volumeCg', () => {
  it('is 0 for no sets', () => {
    expect(volumeCg([])).toBe(0);
  });

  it('sums weight x reps in centi-kg', () => {
    const sets = [
      { weight_cg: 8000, reps: 8 },
      { weight_cg: 10250, reps: 5 },
    ];
    expect(volumeCg(sets)).toBe(64000 + 51250);
  });
});

describe('formatVolume', () => {
  it('uses a thousands separator', () => {
    expect(formatVolume(845000)).toBe('8,450 kg');
    expect(formatVolume(1234567800)).toBe('12,345,678 kg');
    expect(formatVolume(0)).toBe('0 kg');
    expect(formatVolume(99900)).toBe('999 kg');
  });
});
