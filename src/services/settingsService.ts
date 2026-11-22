import type { Db } from '../db/db';
import { createSettingsRepo } from '../repos/settingsRepo';
import type { Notifier } from './ports';

/** T6: "already shown" flag of the denied-permission hint. */
export const NOTIF_HINT_SHOWN = 'notif_hint_shown';
/** D14: set once the permission prompt has been requested (the first workout start). */
export const NOTIF_PERMISSION_ASKED = 'notif_permission_asked';

export function createSettingsService({ db, notifier }: { db: Db; notifier: Notifier }) {
  const settings = createSettingsRepo(db);

  /**
   * D14: called when a workout is about to start. The first time ever it asks for
   * notification permission; later calls do nothing. Never throws: a failing prompt must
   * not block starting a workout (T6 covers the denied case).
   */
  async function requestPermissionOnFirstWorkout(): Promise<void> {
    try {
      if ((await settings.get(NOTIF_PERMISSION_ASKED)) !== null) return;
      await notifier.requestPermission();
      await settings.set(NOTIF_PERMISSION_ASKED, '1');
    } catch {
      // ignore
    }
  }

  /**
   * T6 (3.4d): true exactly once - when the permission has been asked for, is not granted,
   * and the hint was not shown before. Marks the hint as shown in the same call.
   */
  async function takeDeniedHint(): Promise<boolean> {
    try {
      if ((await settings.get(NOTIF_PERMISSION_ASKED)) === null) return false;
      if ((await settings.get(NOTIF_HINT_SHOWN)) !== null) return false;
      if (await notifier.permissionGranted()) return false;
      await settings.set(NOTIF_HINT_SHOWN, '1');
      return true;
    } catch {
      return false;
    }
  }

  return { requestPermissionOnFirstWorkout, takeDeniedHint };
}

export type SettingsService = ReturnType<typeof createSettingsService>;
