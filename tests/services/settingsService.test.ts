import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../../src/db/db';
import { runMigrations } from '../../src/db/migrations';
import { createSettingsRepo } from '../../src/repos/settingsRepo';
import { createSettingsService } from '../../src/services/settingsService';
import { createSqlJsDb } from '../support/sqljsDb';
import { FakeNotifier } from '../support/fakes';

let db: Db;
beforeEach(async () => {
  db = await createSqlJsDb();
  await runMigrations(db);
});

function make(granted: boolean) {
  const notifier = new FakeNotifier({ granted });
  let requests = 0;
  const orig = notifier.requestPermission.bind(notifier);
  notifier.requestPermission = async () => {
    requests++;
    return orig();
  };
  return { notifier, svc: createSettingsService({ db, notifier }), requests: () => requests };
}

describe('D14 permission on the first workout', () => {
  it('asks only once', async () => {
    const { svc, requests } = make(true);
    await svc.requestPermissionOnFirstWorkout();
    await svc.requestPermissionOnFirstWorkout();
    expect(requests()).toBe(1);
  });

  it('does not throw when the prompt fails', async () => {
    const { svc, notifier } = make(true);
    notifier.requestPermission = async () => {
      throw new Error('boom');
    };
    await expect(svc.requestPermissionOnFirstWorkout()).resolves.toBeUndefined();
  });
});

describe('T6 denied hint (3.4d)', () => {
  it('is not offered before the permission was asked', async () => {
    const { svc } = make(false);
    expect(await svc.takeDeniedHint()).toBe(false);
  });

  it('is offered once when permission is denied, flag stored as notif_hint_shown', async () => {
    const { svc } = make(false);
    await svc.requestPermissionOnFirstWorkout();
    expect(await svc.takeDeniedHint()).toBe(true);
    expect(await svc.takeDeniedHint()).toBe(false);
    expect(await createSettingsRepo(db).get('notif_hint_shown')).not.toBeNull();
  });

  it('is never offered when permission is granted', async () => {
    const { svc } = make(true);
    await svc.requestPermissionOnFirstWorkout();
    expect(await svc.takeDeniedHint()).toBe(false);
  });
});
