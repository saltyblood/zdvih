import type { Clock, NotificationKind, Notifier } from '../../src/services/ports';

export interface ScheduledNotification {
  id: string | null;
  kind: NotificationKind;
  seconds: number;
  title: string;
  body: string;
}

export class FakeNotifier implements Notifier {
  granted: boolean;
  /** every schedule() call, in order (id is null when permission was denied) */
  scheduled: ScheduledNotification[] = [];
  /** every cancel() call, in order */
  cancelled: string[] = [];
  private nextId = 1;

  constructor(opts: { granted?: boolean } = {}) {
    this.granted = opts.granted ?? true;
  }

  async schedule(
    kind: NotificationKind,
    seconds: number,
    title: string,
    body: string,
  ): Promise<string | null> {
    if (!this.granted) {
      this.scheduled.push({ id: null, kind, seconds, title, body });
      return null;
    }
    const id = `n${this.nextId++}`;
    this.scheduled.push({ id, kind, seconds, title, body });
    return id;
  }

  async cancel(id: string): Promise<void> {
    this.cancelled.push(id);
  }

  async permissionGranted(): Promise<boolean> {
    return this.granted;
  }

  async requestPermission(): Promise<boolean> {
    return this.granted;
  }

  /** Scheduled notifications (with an id) that have not been cancelled. */
  pending(kind?: NotificationKind): ScheduledNotification[] {
    return this.scheduled.filter(
      (s) => s.id !== null && !this.cancelled.includes(s.id) && (!kind || s.kind === kind),
    );
  }
}

export class FakeClock implements Clock {
  constructor(private ms = 1_700_000_000_000) {}

  now(): number {
    return this.ms;
  }

  advance(ms: number): void {
    this.ms += ms;
  }

  advanceMinutes(minutes: number): void {
    this.ms += minutes * 60_000;
  }

  set(ms: number): void {
    this.ms = ms;
  }
}
