import type { ErrorCode } from './domain/errors';

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  WORKOUT_ALREADY_ACTIVE: 'A workout is already in progress',
  NO_ACTIVE_WORKOUT: 'No workout in progress',
  NOT_FOUND: 'Not found',
  WEIGHT_INVALID: 'Enter a weight above 0 and up to 500 kg (max 2 decimals)',
  REPS_INVALID: 'Enter whole reps from 1 to 100',
  NAME_INVALID: 'Enter a name of 1 to 60 characters',
  EXERCISE_EXISTS: 'Exercise already exists',
  EXERCISE_BUILTIN: 'Built-in exercises cannot be changed',
  EXERCISE_IN_USE: 'Exercise is used by logged sets',
};

export const strings = {
  appName: 'Zdvih',
  home: {
    title: 'Zdvih',
    tagline: 'Offline gym workout log',
    deviceCheck: 'Device check',
  },
  notifications: {
    restTitle: 'Rest is over',
    restBody: 'Time for the next set.',
    reminderTitle: 'Your workout is still open',
    reminderBody: 'Finish it or keep logging.',
    hintDenied:
      'Rest alerts are off while the screen is locked. Enable notifications in Settings.',
  },
  devCheck: {
    title: 'Device check',
    notifySection: 'Notification',
    notifyButton: 'Notify in 10 s',
    notifyScheduled: 'Scheduled. Lock the phone or leave the app.',
    notifyDenied: 'Notification permission denied',
    notifyTitle: 'Device check',
    notifyBody: 'Local notification works.',
    vibrateSection: 'Vibration',
    vibrateButton: 'Vibrate',
    keepAwakeSection: 'Keep awake',
    keepAwakeLabel: 'Keep screen on',
    accelSection: 'Accelerometer',
    accelUnavailable: 'Accelerometer not available',
    accelDelta: 'Delta per sample (g)',
    accelMax: 'Max delta since reset (g)',
    accelReset: 'Reset max',
    sqliteSection: 'SQLite',
    sqliteButton: 'SQLite write/read',
    sqliteResult: 'Rows',
    sqliteLast: 'Last value',
    sqliteError: 'SQLite error',
  },
  errors: ERROR_MESSAGES,
} as const;

export function errorMessage(code: ErrorCode): string {
  return ERROR_MESSAGES[code];
}
