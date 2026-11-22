import { AsyncLocalStorage } from 'node:async_hooks';
import initSqlJs, { type BindParams, type Database } from 'sql.js';
import type { Db } from '../../src/db/db';

/** Marks the async call chain of a running transaction callback. */
const txChain = new AsyncLocalStorage<true>();

/** Calls straight on the connection, no queueing (the tx handle). */
function directDb(raw: Database): Db {
  const self: Db = {
    async exec(sql) {
      raw.exec(sql);
    },
    async run(sql, params) {
      raw.run(sql, (params ?? []) as BindParams);
      const changes = raw.getRowsModified();
      const row = raw.exec('SELECT last_insert_rowid()')[0];
      return { lastInsertRowId: Number(row.values[0][0]), changes };
    },
    async all<T>(sql: string, params?: unknown[]) {
      const stmt = raw.prepare(sql);
      try {
        stmt.bind((params ?? []) as BindParams);
        const rows: T[] = [];
        while (stmt.step()) rows.push(stmt.getAsObject() as T);
        return rows;
      } finally {
        stmt.free();
      }
    },
    async first<T>(sql: string, params?: unknown[]) {
      const rows = await self.all<T>(sql, params);
      return rows.length > 0 ? rows[0] : null;
    },
    // nested: join the surrounding transaction
    transaction: (fn) => fn(self),
  };
  return self;
}

/**
 * Db over sql.js mirroring createExpoDb (D16): every call on the outer handle goes through
 * one FIFO promise queue and a whole transaction is one queue task; the tx handle bypasses
 * the queue. A call on the outer handle from inside the running transaction's own async
 * chain would deadlock on the phone, so it throws here instead.
 */
function makeOuter(raw: Database): Db {
  const direct = directDb(raw);
  let tail: Promise<unknown> = Promise.resolve();

  function enqueue<R>(method: string, task: () => Promise<R>): Promise<R> {
    if (txChain.getStore()) {
      return Promise.reject(
        new Error(
          `Db.${method} called on the outer handle inside a transaction; use the tx handle (design D16)`,
        ),
      );
    }
    const result = tail.then(task, task);
    tail = result.catch(() => undefined);
    return result;
  }

  return {
    exec: (sql) => enqueue('exec', () => direct.exec(sql)),
    run: (sql, params) => enqueue('run', () => direct.run(sql, params)),
    all: <T>(sql: string, params?: unknown[]) => enqueue('all', () => direct.all<T>(sql, params)),
    first: <T>(sql: string, params?: unknown[]) =>
      enqueue('first', () => direct.first<T>(sql, params)),
    transaction: <R>(fn: (tx: Db) => Promise<R>) =>
      enqueue('transaction', async () => {
        raw.exec('BEGIN');
        try {
          const result = await txChain.run(true, () => fn(direct));
          raw.exec('COMMIT');
          return result;
        } catch (e) {
          raw.exec('ROLLBACK');
          throw e;
        }
      }),
  };
}

/** Fresh in-memory SQLite database with foreign keys enabled. */
export async function createSqlJsDb(): Promise<Db> {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  raw.exec('PRAGMA foreign_keys = ON;');
  return makeOuter(raw);
}
