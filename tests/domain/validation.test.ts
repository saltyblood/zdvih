import { describe, expect, it } from 'vitest';
import { AppError } from '../../src/domain/errors';
import { normalizeExerciseName, parseReps } from '../../src/domain/validation';

describe('parseReps (2.1c)', () => {
  it('accepts 1..100', () => {
    expect(parseReps('1')).toBe(1);
    expect(parseReps('100')).toBe(100);
    expect(parseReps(' 8 ')).toBe(8);
  });

  it.each(['0', '101', '2.5', 'x', '', '-3', '1000'])('rejects %j', (input) => {
    expect(() => parseReps(input)).toThrow(AppError);
    try {
      parseReps(input);
    } catch (e) {
      expect((e as AppError).code).toBe('REPS_INVALID');
    }
  });
});

describe('normalizeExerciseName (4.2a)', () => {
  it('trims and builds a lower-case key', () => {
    expect(normalizeExerciseName('  Barbell Curl ')).toEqual({
      name: 'Barbell Curl',
      key: 'barbell curl',
    });
  });

  it('accepts 60 characters', () => {
    const name = 'a'.repeat(60);
    expect(normalizeExerciseName(name).name).toBe(name);
  });

  it.each(['', '   ', 'a'.repeat(61)])('rejects %j', (input) => {
    expect(() => normalizeExerciseName(input)).toThrow(AppError);
    try {
      normalizeExerciseName(input);
    } catch (e) {
      expect((e as AppError).code).toBe('NAME_INVALID');
    }
  });

  it('counts the trimmed length only', () => {
    expect(normalizeExerciseName(` ${'a'.repeat(60)} `).name).toHaveLength(60);
  });

  it('gives equal keys for names differing in case and surrounding spaces (4.2b)', () => {
    expect(normalizeExerciseName(' barbell curl ').key).toBe(
      normalizeExerciseName('Barbell Curl').key,
    );
  });
});
