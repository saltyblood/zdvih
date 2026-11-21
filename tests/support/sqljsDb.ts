import initSqlJs, { type BindParams, type Database } from 'sql.js';
import type { Db } from '../../src/db/db';

type State = { inTx: boolean };

/**
 * Builds a Db handle. The outer handle (isTx = false) throws while a transaction
 * is open: on the phone (expoDb, D16) such a call would queue behind the running
 * transaction and deadlock, so tests must fail instead of passing silently.
 */
function makeHandle(raw: Database, state: State, isTx: boolean): Db {
  const guard = (method: string) => {
    if (!isTx && state.inTx) {
      throw new Error(
        `Db.${method} called on the outer handle inside a transaction; use the tx handle (design D16)`,
      );
    }
  };

  const handle: Db = {
    async exec(sql) {
      guard('exec');
      raw.exec(sql);
    },
    async run(sql, params) {
      guard('run');
      raw.run(sql, (params ?? []) as BindParams);
      const changes = raw.getRowsModified();
      const row = raw.exec('SELECT last_insert_rowid()')[0];
      return { lastInsertRowId: Number(row.values[0][0]), changes };
    },
    async all<T>(sql: string, params?: unknown[]) {
      guard('all');
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
      const rows = await handle.all<T>(sql, params);
      return rows.length > 0 ? rows[0] : null;
    },
    async transaction<R>(fn: (tx: Db) => Promise<R>) {
      guard('transaction');
      if (isTx) return fn(handle); // nested: join the outer transaction
      const tx = makeHandle(raw, state, true);
      raw.exec('BEGIN');
      state.inTx = true;
      try {
        const result = await fn(tx);
        raw.exec('COMMIT');
        return result;
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      } finally {
        state.inTx = false;
      }
    },
  };
  return handle;
}

/** Fresh in-memory SQLite database with foreign keys enabled. */
export async function createSqlJsDb(): Promise<Db> {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  raw.exec('PRAGMA foreign_keys = ON;');
  return makeHandle(raw, { inTx: false }, false);
}
