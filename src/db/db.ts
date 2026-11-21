export interface Db {
  exec(sql: string): Promise<void>; // multiple statements, no params
  run(sql: string, params?: unknown[]): Promise<{ lastInsertRowId: number; changes: number }>;
  all<T>(sql: string, params?: unknown[]): Promise<T[]>;
  first<T>(sql: string, params?: unknown[]): Promise<T | null>;
  transaction<R>(fn: (tx: Db) => Promise<R>): Promise<R>;
}
