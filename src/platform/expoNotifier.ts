import * as Notifications from 'expo-notifications';

import type { NotificationKind, Notifier } from '../services/ports';

/**
 * D11: content per kind. Rest and reminder both play the default sound in the
 * background / on the lock screen; in the foreground the handler mutes them.
 */
function contentFor(kind: NotificationKind, title: string, body: string) {
  return {
    title,
    body,
    data: { kind },
    sound: 'default' as const,
  };
}

export function createExpoNotifier(): Notifier {
  async function permissionGranted(): Promise<boolean> {
    return (await Notifications.getPermissionsAsync()).granted;
  }

  return {
    async schedule(kind, seconds, title, body) {
      if (!(await permissionGranted())) return null;
      return Notifications.scheduleNotificationAsync({
        content: contentFor(kind, title, body),
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds,
        },
      });
    },
    async cancel(id) {
      // Unknown or already delivered ids are a no-op; swallow anything else.
      try {
        await Notifications.cancelScheduledNotificationAsync(id);
      } catch {
        // ignore
      }
    },
    permissionGranted,
    async requestPermission() {
      if (await permissionGranted()) return true;
      return (await Notifications.requestPermissionsAsync()).granted;
    },
  };
}

/**
 * D11 foreground handler, the only one in the app. In the foreground both kinds are shown
 * as a banner: `rest` WITHOUT sound (the app vibrates itself, T4), `reminder` as a banner.
 * Anything without data.kind (the dev-check notification) is shown the same way.
 * Background / lock-screen sound is part of the notification content (see contentFor).
 */
export function installNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}
