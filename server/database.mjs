import { DatabaseSync } from 'node:sqlite';

const migrations = [
  {
    version: 1,
    name: 'initial_schema',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS users(
          id INTEGER PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sessions(
          token TEXT PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id),
          expires INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS entries(
          id INTEGER PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id),
          kind TEXT NOT NULL CHECK(kind IN ('transactions','goals','debts')),
          name TEXT NOT NULL,
          category TEXT,
          amount INTEGER NOT NULL CHECK(amount>0),
          saved INTEGER NOT NULL DEFAULT 0 CHECK(saved>=0),
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS incomes(
          id INTEGER PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id),
          name TEXT NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('salary','extra')),
          amount INTEGER NOT NULL CHECK(amount>0),
          received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS entries_owner ON entries(user_id,kind);
        CREATE INDEX IF NOT EXISTS incomes_owner ON incomes(user_id,type,received_at);
      `);
    },
  },
  {
    version: 2,
    name: 'dated_entries',
    up(db, hasColumn) {
      if (!hasColumn('entries', 'transaction_date')) {
        db.exec('ALTER TABLE entries ADD COLUMN transaction_date TEXT');
      }
      if (!hasColumn('entries', 'updated_at')) {
        db.exec('ALTER TABLE entries ADD COLUMN updated_at TEXT');
      }
      db.exec(`
        UPDATE entries
        SET transaction_date = COALESCE(transaction_date, substr(created_at,1,10)),
            updated_at = COALESCE(updated_at, created_at);
        CREATE INDEX IF NOT EXISTS entries_owner_date ON entries(user_id,kind,transaction_date);
      `);
    },
  },
  {
    version: 3,
    name: 'recurring_income_periods',
    up(db, hasColumn) {
      if (!hasColumn('incomes', 'recurrence')) {
        db.exec("ALTER TABLE incomes ADD COLUMN recurrence TEXT");
      }
      if (!hasColumn('incomes', 'active_from')) {
        db.exec('ALTER TABLE incomes ADD COLUMN active_from TEXT');
      }
      if (!hasColumn('incomes', 'active_until')) {
        db.exec('ALTER TABLE incomes ADD COLUMN active_until TEXT');
      }
      if (!hasColumn('incomes', 'active')) {
        db.exec('ALTER TABLE incomes ADD COLUMN active INTEGER NOT NULL DEFAULT 1');
      }
      if (!hasColumn('incomes', 'updated_at')) {
        db.exec('ALTER TABLE incomes ADD COLUMN updated_at TEXT');
      }
      db.exec(`
        UPDATE incomes
        SET recurrence = COALESCE(recurrence, CASE type WHEN 'salary' THEN 'monthly' ELSE 'once' END),
            active_from = COALESCE(active_from, substr(received_at,1,10)),
            active = COALESCE(active, 1),
            updated_at = COALESCE(updated_at, received_at);
        CREATE INDEX IF NOT EXISTS incomes_active_period ON incomes(user_id,type,active,active_from,active_until);
      `);
    },
  },
];

export class SqliteDatabase {
  constructor(path) {
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations(
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    this.applyMigrations();
  }

  hasColumn(table, column) {
    return this.db.prepare(`PRAGMA table_info(${table})`).all().some(row => row.name === column);
  }

  applyMigrations() {
    const applied = new Set(
      this.db.prepare('SELECT version FROM schema_migrations ORDER BY version').all().map(row => row.version),
    );
    for (const migration of migrations) {
      if (applied.has(migration.version)) continue;
      this.db.exec('BEGIN IMMEDIATE');
      try {
        migration.up(this.db, this.hasColumn.bind(this));
        this.db.prepare('INSERT INTO schema_migrations(version,name) VALUES(?,?)').run(migration.version, migration.name);
        this.db.exec('COMMIT');
      } catch (error) {
        this.db.exec('ROLLBACK');
        throw error;
      }
    }
  }

  async query(statement, values = []) {
    const query = this.db.prepare(statement);
    if (/^SELECT|RETURNING/i.test(statement) || /RETURNING/i.test(statement)) return {recordset:query.all(...values)};
    const result = query.run(...values);
    return {rowsAffected:[Number(result.changes)]};
  }

  async close() { this.db.close(); }
}
