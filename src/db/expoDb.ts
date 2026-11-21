import * as SQLite from 'expo-sqlite';
import type { SQLiteBindParams } from 'expo-sqlite';
import type { Db } from './db';

type Conn = SQLite.SQLiteDatabase;

function bind(params?: unknown[]): SQLiteBindParams {
  return (params ?? []) as SQLiteBindParams;
}

/** Calls straight on the connection, no queueing. Used inside a running transaction. */
function directDb(conn: Conn): Db {
  const self: Db = {
    exec: (sql) => conn.execAsync(sql),
    run: async (sql, params) => {
      const r = await conn.runAsync(sql, bind(params));
      return { lastInsertRowId: r.lastInsertRowId, changes: r.changes };
    },
    all: <T>(sql: string, params?: unknown[]) => conn.getAllAsync<T>(sql, bind(params)),
    first: <T>(sql: string, params?: unknown[]) => conn.getFirstAsync<T>(sql, bind(params)),
    // No savepoints: a nested call joins the surrounding transaction.
    transaction: (fn) => fn(self),
  };
  return self;
}

/**
 * Db over expo-sqlite (D16). withTransactionAsync is not exclusive, so every call from
 * outside a transaction goes through one promise queue; the transaction holds the queue
 * until it finishes, and calls on the `tx` Db bypass the queue (otherwise they deadlock).
 */
export function createExpoDb(conn: Conn): Db {
  const direct = directDb(conn);
  let tail: Promise<unknown> = Promise.resolve();

  function enqueue<R>(task: () => Promise<R>): Promise<R> {
    const result = tail.then(task, task);
    tail = result.catch(() => undefined);
    return result;
  }

  return {
    exec: (sql) => enqueue(() => direct.exec(sql)),
    run: (sql, params) => enqueue(() => direct.run(sql, params)),
    all: <T>(sql: string, params?: unknown[]) => enqueue(() => direct.all<T>(sql, params)),
    first: <T>(sql: string, params?: unknown[]) => enqueue(() => direct.first<T>(sql, params)),
    transaction: <R>(fn: (tx: Db) => Promise<R>) =>
      enqueue(async () => {
        let result!: R;
        await conn.withTransactionAsync(async () => {
          result = await fn(direct);
        });
        return result;
      }),
  };
}

export async function openExpoDb(): Promise<Db> {
  const conn = await SQLite.openDatabaseAsync('zdvih.db');
  // Must run outside any transaction, otherwise it has no effect.
  await conn.execAsync('PRAGMA foreign_keys = ON;');
  return createExpoDb(conn);
}
