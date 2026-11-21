export type ErrorCode =
  | 'WORKOUT_ALREADY_ACTIVE'
  | 'NO_ACTIVE_WORKOUT'
  | 'NOT_FOUND'
  | 'WEIGHT_INVALID'
  | 'REPS_INVALID'
  | 'NAME_INVALID'
  | 'EXERCISE_EXISTS'
  | 'EXERCISE_BUILTIN'
  | 'EXERCISE_IN_USE';

export class AppError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode) {
    super(code);
    this.name = 'AppError';
    this.code = code;
  }
}
