import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../../src/db/db';
import { runMigrations } from '../../src/db/migrations';
import { createSqlJsDb } from '../support/sqljsDb';

let db: Db;
beforeEach(async () => {
  db = await createSqlJsDb();
  await runMigrations(db);
});

const insertWorkout = (finished: number | null) =>
  db.run('INSERT INTO workouts (started_at, finished_at, last_activity_at) VALUES (1, ?, 1)', [finished]);

describe('migrations', () => {
  it('sets user_version and is idempotent', async () => {
    expect((await db.first<{ user_version: number }>('PRAGMA user_version'))?.user_version).toBe(1);
    await runMigrations(db);
    await runMigrations(db);
    expect((await db.first<{ n: number }>('SELECT count(*) AS n FROM exercises'))?.n).toBe(14);
    expect((await db.first<{ user_version: number }>('PRAGMA user_version'))?.user_version).toBe(1);
  });

  it('seeds name_key as lower(trim(name)) with is_builtin = 1', async () => {
    const bad = await db.all('SELECT id FROM exercises WHERE name_key <> lower(trim(name)) OR is_builtin <> 1');
    expect(bad).toHaveLength(0);
  });

  it('enforces foreign keys in the sql.js adapter', async () => {
    const w = await insertWorkout(null);
    await expect(
      db.run('INSERT INTO sets (workout_id, exercise_id, weight_cg, reps, position, created_at) VALUES (?, 9999, 100, 5, 1, 1)', [
        w.lastInsertRowId,
      ]),
    ).rejects.toThrow();
  });

  it('1.1b: a second active workout row violates the unique index', async () => {
    await insertWorkout(null);
    await expect(insertWorkout(null)).rejects.toThrow(/UNIQUE|constraint/i);
    await insertWorkout(5);
    await insertWorkout(6);
  });

  it('enforces CHECK constraints on sets', async () => {
    const w = await insertWorkout(null);
    const ins = (weight: number, reps: number) =>
      db.run('INSERT INTO sets (workout_id, exercise_id, weight_cg, reps, position, created_at) VALUES (?, 1, ?, ?, 1, 1)', [
        w.lastInsertRowId,
        weight,
        reps,
      ]);
    await expect(ins(0, 5)).rejects.toThrow();
    await expect(ins(50001, 5)).rejects.toThrow();
    await expect(ins(100, 0)).rejects.toThrow();
    await expect(ins(100, 101)).rejects.toThrow();
    await ins(50000, 100);
  });

  it('transaction rolls back on error', async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.run("INSERT INTO settings (key, value) VALUES ('a', 'b')");
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await db.first('SELECT * FROM settings')).toBeNull();
  });

  it('D16: outer handle inside a transaction throws and rolls back', async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.run("INSERT INTO settings (key, value) VALUES ('a', 'b')");
        await db.run("INSERT INTO settings (key, value) VALUES ('c', 'd')");
      }),
    ).rejects.toThrow(/outer handle inside a transaction/);
    expect(await db.first('SELECT * FROM settings')).toBeNull();
  });

  it('D16: nested tx.transaction joins the outer transaction', async () => {
    await db.transaction(async (tx) => {
      await tx.transaction(async (inner) => {
        await inner.run("INSERT INTO settings (key, value) VALUES ('a', 'b')");
      });
    });
    expect(await db.first<{ value: string }>('SELECT value FROM settings')).toEqual({ value: 'b' });
  });
});
