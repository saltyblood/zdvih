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
  /** when set, schedule() throws this error (N3 tests) */
  scheduleError: Error | null = null;
  /** when set, cancel() throws this error (N3 tests) */
  cancelError: Error | null = null;
  /**
   * Awaited inside schedule() after the id is allocated and before it returns, so a
   * test can interleave other service calls while a schedule is in flight.
   */
  scheduleGate: ((kind: NotificationKind) => Promise<void>) | null = null;

  constructor(opts: { granted?: boolean } = {}) {
    this.granted = opts.granted ?? true;
  }

  async schedule(
    kind: NotificationKind,
    seconds: number,
    title: string,
    body: string,
  ): Promise<string | null> {
    if (this.scheduleError) throw this.scheduleError;
    if (this.scheduleGate) await this.scheduleGate(kind);
    if (!this.granted) {
      this.scheduled.push({ id: null, kind, seconds, title, body });
      return null;
    }
    const id = `n${this.nextId++}`;
    this.scheduled.push({ id, kind, seconds, title, body });
    return id;
  }

  async cancel(id: string): Promise<void> {
    if (this.cancelError) throw this.cancelError;
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

/** A promise that can be resolved from outside; used as a schedule gate. */
export function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
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
