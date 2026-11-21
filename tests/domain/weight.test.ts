import { describe, expect, it } from 'vitest';
import { AppError } from '../../src/domain/errors';
import { formatKg, parseWeight } from '../../src/domain/weight';

describe('parseWeight (2.1b)', () => {
  it.each([
    ['0.5', 50],
    ['102,5', 10250],
    ['500', 50000],
    ['12.25', 1225],
    [' 80 ', 8000],
    ['0.01', 1],
    ['7.1', 710],
  ])('accepts %s -> %i', (input, cg) => {
    expect(parseWeight(input)).toBe(cg);
  });

  it.each(['0', '-1', '500.01', '1.234', 'abc', '', '   ', '0.00', '1000', '1.', '.5', '1,2,3'])(
    'rejects %j',
    (input) => {
      expect(() => parseWeight(input)).toThrow(AppError);
      try {
        parseWeight(input);
      } catch (e) {
        expect((e as AppError).code).toBe('WEIGHT_INVALID');
      }
    },
  );
});

describe('formatKg', () => {
  it('formats centi-kg', () => {
    expect(formatKg(10250)).toBe('102.5 kg');
    expect(formatKg(10000)).toBe('100 kg');
    expect(formatKg(10025)).toBe('100.25 kg');
    expect(formatKg(50)).toBe('0.5 kg');
    expect(formatKg(1)).toBe('0.01 kg');
  });
});
