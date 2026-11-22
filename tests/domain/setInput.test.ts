import { describe, expect, it } from 'vitest';
import { validateSetInput, weightInputText } from '../../src/domain/setInput';
import { parseWeight } from '../../src/domain/weight';

describe('validateSetInput (2.1a)', () => {
  it('cannot save with empty fields and shows no errors', () => {
    expect(validateSetInput('', '')).toEqual({ weightError: null, repsError: null, canSave: false });
  });
  it('can save when both parse', () => {
    expect(validateSetInput('102,5', '8')).toEqual({
      weightError: null,
      repsError: null,
      canSave: true,
    });
  });
  it('reports WEIGHT_INVALID and REPS_INVALID for non-empty bad input', () => {
    expect(validateSetInput('1.234', '101')).toEqual({
      weightError: 'WEIGHT_INVALID',
      repsError: 'REPS_INVALID',
      canSave: false,
    });
  });
  it('one valid field and one empty field cannot save', () => {
    const s = validateSetInput('80', '');
    expect(s.canSave).toBe(false);
    expect(s.repsError).toBeNull();
  });
});

describe('weightInputText', () => {
  it.each([
    [8000, '80'],
    [10250, '102.5'],
    [10025, '100.25'],
    [50, '0.5'],
    [1, '0.01'],
  ])('%i -> %s and round-trips through parseWeight', (cg, text) => {
    expect(weightInputText(cg)).toBe(text);
    expect(parseWeight(text)).toBe(cg);
  });
});
