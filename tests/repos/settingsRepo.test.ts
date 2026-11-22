import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../../src/db/db';
import { runMigrations } from '../../src/db/migrations';
import { createSettingsRepo } from '../../src/repos/settingsRepo';
import { createSqlJsDb } from '../support/sqljsDb';

let db: Db;
beforeEach(async () => {
  db = await createSqlJsDb();
  await runMigrations(db);
});

describe('settingsRepo', () => {
  it('returns null for an unknown key', async () => {
    expect(await createSettingsRepo(db).get('notif_hint_shown')).toBeNull();
  });

  it('stores and overwrites a value', async () => {
    const repo = createSettingsRepo(db);
    await repo.set('notif_hint_shown', '1');
    expect(await repo.get('notif_hint_shown')).toBe('1');
    await repo.set('notif_hint_shown', '2');
    expect(await repo.get('notif_hint_shown')).toBe('2');
    expect(await db.all('SELECT * FROM settings')).toHaveLength(1);
  });
});
