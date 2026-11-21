import { describe, expect, it } from 'vitest';
import { bestSet, e1rmCg, formatE1rm } from '../../src/domain/oneRepMax';

describe('e1RM (5.3c)', () => {
  it('100 kg x 5 -> 116.7 kg', () => {
    expect(formatE1rm(e1rmCg(10000, 5))).toBe('116.7 kg');
  });

  it('80 kg x 1 -> 80.0 kg', () => {
    expect(formatE1rm(e1rmCg(8000, 1))).toBe('80.0 kg');
  });

  it('reps = 1 equals the weight exactly', () => {
    expect(e1rmCg(12345, 1)).toBe(12345);
  });

  it('rounds to one decimal', () => {
    expect(formatE1rm(e1rmCg(10250, 8))).toBe('129.8 kg');
    expect(formatE1rm(5)).toBe('0.1 kg');
  });
});

describe('bestSet', () => {
  it('picks the highest e1RM', () => {
    const sets = [
      { weight_cg: 10000, reps: 5, position: 1 },
      { weight_cg: 11000, reps: 3, position: 2 },
      { weight_cg: 9000, reps: 8, position: 3 },
    ];
    expect(bestSet(sets).position).toBe(2);
  });

  it('breaks ties by the earliest position', () => {
    const sets = [
      { weight_cg: 10000, reps: 5, position: 3 },
      { weight_cg: 10000, reps: 5, position: 1 },
      { weight_cg: 10000, reps: 5, position: 2 },
    ];
    expect(bestSet(sets).position).toBe(1);
  });

  it('throws for an empty list', () => {
    expect(() => bestSet([])).toThrow();
  });
});
