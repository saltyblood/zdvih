export type NotificationKind = 'rest' | 'reminder';

export interface Notifier {
  /** returns the scheduled id, or null when permission is denied */
  schedule(
    kind: NotificationKind,
    seconds: number,
    title: string,
    body: string,
  ): Promise<string | null>;
  cancel(id: string): Promise<void>; // no-op for unknown/delivered ids
  permissionGranted(): Promise<boolean>;
  requestPermission(): Promise<boolean>;
}

export interface Clock {
  now(): number; // epoch ms
}
