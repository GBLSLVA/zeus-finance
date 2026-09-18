import { DatabaseSync } from 'node:sqlite';
export class SqliteDatabase {
  constructor(path) {
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS entries(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),kind TEXT NOT NULL CHECK(kind IN ('transactions','goals','debts')),name TEXT NOT NULL,category TEXT,amount INTEGER NOT NULL CHECK(amount>0),saved INTEGER NOT NULL DEFAULT 0 CHECK(saved>=0),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE INDEX IF NOT EXISTS entries_owner ON entries(user_id,kind);`);
  }
  async query(statement, values = []) {
    const query = this.db.prepare(statement);
    if (/^SELECT|RETURNING/i.test(statement) || /RETURNING/i.test(statement)) return {recordset:query.all(...values)};
    const result = query.run(...values);
    return {rowsAffected:[Number(result.changes)]};
  }
  async close() { this.db.close(); }
}
