import type { Db } from '../db/db';

/** Key/value access to the `settings` table (§3.2). */
export function createSettingsRepo(db: Db) {
  return {
    async get(key: string): Promise<string | null> {
      const row = await db.first<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
        key,
      ]);
      return row ? row.value : null;
    },
    async set(key: string, value: string): Promise<void> {
      await db.run(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        [key, value],
      );
    },
  };
}
