import { DatabaseSync } from 'node:sqlite';
import pg from 'pg';
import { DatabaseAdapter } from './database-adapter.mjs';

const { Pool } = pg;

const sqliteMigrations = [
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
  {
    version: 4,
    name: 'structured_debts',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS debts(
          id INTEGER PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id),
          name TEXT NOT NULL,
          creditor TEXT,
          original_amount INTEGER NOT NULL CHECK(original_amount>0),
          current_balance INTEGER NOT NULL CHECK(current_balance>=0),
          interest_rate_bps INTEGER NOT NULL DEFAULT 0 CHECK(interest_rate_bps>=0),
          installments_total INTEGER NOT NULL DEFAULT 0 CHECK(installments_total>=0),
          installments_paid INTEGER NOT NULL DEFAULT 0 CHECK(installments_paid>=0),
          due_day INTEGER CHECK(due_day BETWEEN 1 AND 31),
          status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','paid')),
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS debt_payments(
          id INTEGER PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id),
          debt_id INTEGER NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
          amount INTEGER NOT NULL CHECK(amount>0),
          payment_date TEXT NOT NULL,
          note TEXT,
          counts_as_installment INTEGER NOT NULL DEFAULT 1 CHECK(counts_as_installment IN (0,1)),
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS debts_owner_status ON debts(user_id,status);
        CREATE INDEX IF NOT EXISTS debt_payments_owner_debt_date ON debt_payments(user_id,debt_id,payment_date);

        INSERT INTO debts(user_id,name,original_amount,current_balance,status,created_at,updated_at)
        SELECT user_id,name,amount,amount,'active',created_at,COALESCE(updated_at,created_at)
        FROM entries
        WHERE kind='debts';
      `);
    },
  },
  {
    version: 5,
    name: 'monthly_category_budgets',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS budgets(
          id INTEGER PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id),
          month TEXT NOT NULL,
          category TEXT NOT NULL,
          limit_amount INTEGER NOT NULL CHECK(limit_amount>0),
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id,month,category)
        );
        CREATE INDEX IF NOT EXISTS budgets_owner_month ON budgets(user_id,month);
      `);
    },
  },
  {
    version: 6,
    name: 'goal_saved_limit',
    up(db) {
      db.exec(`
        CREATE TRIGGER IF NOT EXISTS entries_goal_saved_limit_insert
        BEFORE INSERT ON entries
        WHEN NEW.kind='goals' AND NEW.saved > NEW.amount
        BEGIN SELECT RAISE(ABORT, 'goal_saved_exceeds_target'); END;
        CREATE TRIGGER IF NOT EXISTS entries_goal_saved_limit_update
        BEFORE UPDATE OF amount,saved,kind ON entries
        WHEN NEW.kind='goals' AND NEW.saved > NEW.amount
        BEGIN SELECT RAISE(ABORT, 'goal_saved_exceeds_target'); END;
      `);
    },
  },
  {
    version: 7,
    name: 'recurring_expenses',
    up(db, hasColumn) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS recurring_expenses(
          id INTEGER PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id),
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          amount INTEGER NOT NULL CHECK(amount>0),
          due_day INTEGER NOT NULL CHECK(due_day BETWEEN 1 AND 31),
          active_from TEXT NOT NULL,
          active_until TEXT,
          active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS recurring_expenses_owner_period
        ON recurring_expenses(user_id,active,active_from,active_until,due_day);
      `);
      if (!hasColumn('entries', 'recurring_expense_id')) {
        db.exec('ALTER TABLE entries ADD COLUMN recurring_expense_id INTEGER');
      }
      if (!hasColumn('entries', 'recurring_month')) {
        db.exec('ALTER TABLE entries ADD COLUMN recurring_month TEXT');
      }
      db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS entries_recurring_month_unique
        ON entries(user_id,recurring_expense_id,recurring_month)
        WHERE recurring_expense_id IS NOT NULL AND recurring_month IS NOT NULL;
      `);
    },
  },
  {
    version: 8,
    name: 'goal_movements',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS goal_movements(
          id INTEGER PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          goal_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
          type TEXT NOT NULL CHECK(type IN ('initial','deposit','withdrawal')),
          amount INTEGER NOT NULL CHECK(amount>0),
          movement_date TEXT NOT NULL,
          note TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS goal_movements_owner_goal_date
        ON goal_movements(user_id,goal_id,movement_date,id);

        INSERT INTO goal_movements(user_id,goal_id,type,amount,movement_date,note,created_at)
        SELECT user_id,id,'initial',saved,COALESCE(transaction_date,substr(created_at,1,10)),'Saldo inicial',created_at
        FROM entries
        WHERE kind='goals' AND saved>0
          AND NOT EXISTS (
            SELECT 1 FROM goal_movements movement
            WHERE movement.user_id=entries.user_id AND movement.goal_id=entries.id
          );
      `);
    },
  },
];

const postgresMigrations = [
  {
    version: 1,
    name: 'initial_schema',
    sql: `
      CREATE TABLE IF NOT EXISTS users(
        id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions(
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        expires BIGINT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS entries(
        id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        kind TEXT NOT NULL CHECK(kind IN ('transactions','goals','debts')),
        name TEXT NOT NULL,
        category TEXT,
        amount BIGINT NOT NULL CHECK(amount>0),
        saved BIGINT NOT NULL DEFAULT 0 CHECK(saved>=0),
        created_at TEXT NOT NULL DEFAULT to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')
      );
      CREATE TABLE IF NOT EXISTS incomes(
        id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('salary','extra')),
        amount BIGINT NOT NULL CHECK(amount>0),
        received_at TEXT NOT NULL DEFAULT to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')
      );
      CREATE INDEX IF NOT EXISTS entries_owner ON entries(user_id,kind);
      CREATE INDEX IF NOT EXISTS incomes_owner ON incomes(user_id,type,received_at);
    `,
  },
  {
    version: 2,
    name: 'dated_entries',
    sql: `
      ALTER TABLE entries ADD COLUMN IF NOT EXISTS transaction_date TEXT;
      ALTER TABLE entries ADD COLUMN IF NOT EXISTS updated_at TEXT;
      UPDATE entries
      SET transaction_date = COALESCE(transaction_date, substring(created_at from 1 for 10)),
          updated_at = COALESCE(updated_at, created_at);
      CREATE INDEX IF NOT EXISTS entries_owner_date ON entries(user_id,kind,transaction_date);
    `,
  },
  {
    version: 3,
    name: 'recurring_income_periods',
    sql: `
      ALTER TABLE incomes ADD COLUMN IF NOT EXISTS recurrence TEXT;
      ALTER TABLE incomes ADD COLUMN IF NOT EXISTS active_from TEXT;
      ALTER TABLE incomes ADD COLUMN IF NOT EXISTS active_until TEXT;
      ALTER TABLE incomes ADD COLUMN IF NOT EXISTS active INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE incomes ADD COLUMN IF NOT EXISTS updated_at TEXT;
      UPDATE incomes
      SET recurrence = COALESCE(recurrence, CASE type WHEN 'salary' THEN 'monthly' ELSE 'once' END),
          active_from = COALESCE(active_from, substring(received_at from 1 for 10)),
          active = COALESCE(active, 1),
          updated_at = COALESCE(updated_at, received_at);
      CREATE INDEX IF NOT EXISTS incomes_active_period ON incomes(user_id,type,active,active_from,active_until);
    `,
  },
  {
    version: 4,
    name: 'structured_debts',
    sql: `
      CREATE TABLE IF NOT EXISTS debts(
        id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        name TEXT NOT NULL,
        creditor TEXT,
        original_amount BIGINT NOT NULL CHECK(original_amount>0),
        current_balance BIGINT NOT NULL CHECK(current_balance>=0),
        interest_rate_bps INTEGER NOT NULL DEFAULT 0 CHECK(interest_rate_bps>=0),
        installments_total INTEGER NOT NULL DEFAULT 0 CHECK(installments_total>=0),
        installments_paid INTEGER NOT NULL DEFAULT 0 CHECK(installments_paid>=0),
        due_day INTEGER CHECK(due_day BETWEEN 1 AND 31),
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','paid')),
        created_at TEXT NOT NULL DEFAULT to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'),
        updated_at TEXT NOT NULL DEFAULT to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')
      );
      CREATE TABLE IF NOT EXISTS debt_payments(
        id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        debt_id INTEGER NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
        amount BIGINT NOT NULL CHECK(amount>0),
        payment_date TEXT NOT NULL,
        note TEXT,
        counts_as_installment INTEGER NOT NULL DEFAULT 1 CHECK(counts_as_installment IN (0,1)),
        created_at TEXT NOT NULL DEFAULT to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')
      );
      CREATE INDEX IF NOT EXISTS debts_owner_status ON debts(user_id,status);
      CREATE INDEX IF NOT EXISTS debt_payments_owner_debt_date ON debt_payments(user_id,debt_id,payment_date);

      INSERT INTO debts(user_id,name,original_amount,current_balance,status,created_at,updated_at)
      SELECT user_id,name,amount,amount,'active',created_at,COALESCE(updated_at,created_at)
      FROM entries
      WHERE kind='debts';
    `,
  },
  {
    version: 5,
    name: 'monthly_category_budgets',
    sql: `
      CREATE TABLE IF NOT EXISTS budgets(
        id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        month TEXT NOT NULL,
        category TEXT NOT NULL,
        limit_amount BIGINT NOT NULL CHECK(limit_amount>0),
        created_at TEXT NOT NULL DEFAULT to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'),
        updated_at TEXT NOT NULL DEFAULT to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'),
        UNIQUE(user_id,month,category)
      );
      CREATE INDEX IF NOT EXISTS budgets_owner_month ON budgets(user_id,month);
    `,
  },
  {
    version: 6,
    name: 'goal_saved_limit',
    sql: `
      CREATE OR REPLACE FUNCTION enforce_goal_saved_limit() RETURNS trigger AS $$
      BEGIN
        IF NEW.kind='goals' AND NEW.saved > NEW.amount THEN
          RAISE EXCEPTION 'goal_saved_exceeds_target';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      DROP TRIGGER IF EXISTS entries_goal_saved_limit ON entries;
      CREATE TRIGGER entries_goal_saved_limit
      BEFORE INSERT OR UPDATE OF amount,saved,kind ON entries
      FOR EACH ROW EXECUTE FUNCTION enforce_goal_saved_limit();
    `,
  },
  {
    version: 7,
    name: 'recurring_expenses',
    sql: `
      CREATE TABLE IF NOT EXISTS recurring_expenses(
        id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        amount BIGINT NOT NULL CHECK(amount>0),
        due_day INTEGER NOT NULL CHECK(due_day BETWEEN 1 AND 31),
        active_from TEXT NOT NULL,
        active_until TEXT,
        active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
        created_at TEXT NOT NULL DEFAULT to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'),
        updated_at TEXT NOT NULL DEFAULT to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')
      );
      CREATE INDEX IF NOT EXISTS recurring_expenses_owner_period
      ON recurring_expenses(user_id,active,active_from,active_until,due_day);
      ALTER TABLE entries ADD COLUMN IF NOT EXISTS recurring_expense_id INTEGER;
      ALTER TABLE entries ADD COLUMN IF NOT EXISTS recurring_month TEXT;
      CREATE UNIQUE INDEX IF NOT EXISTS entries_recurring_month_unique
      ON entries(user_id,recurring_expense_id,recurring_month)
      WHERE recurring_expense_id IS NOT NULL AND recurring_month IS NOT NULL;
    `,
  },
  {
    version: 8,
    name: 'goal_movements',
    sql: `
      CREATE TABLE IF NOT EXISTS goal_movements(
        id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        goal_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK(type IN ('initial','deposit','withdrawal')),
        amount BIGINT NOT NULL CHECK(amount>0),
        movement_date TEXT NOT NULL,
        note TEXT,
        created_at TEXT NOT NULL DEFAULT to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')
      );
      CREATE INDEX IF NOT EXISTS goal_movements_owner_goal_date
      ON goal_movements(user_id,goal_id,movement_date,id);

      INSERT INTO goal_movements(user_id,goal_id,type,amount,movement_date,note,created_at)
      SELECT user_id,id,'initial',saved,COALESCE(transaction_date,substring(created_at from 1 for 10)),'Saldo inicial',created_at
      FROM entries
      WHERE kind='goals' AND saved>0
      AND NOT EXISTS (
        SELECT 1 FROM goal_movements movement
        WHERE movement.user_id=entries.user_id AND movement.goal_id=entries.id
      );
    `,
  },
];

export class SqliteDatabase extends DatabaseAdapter {
  constructor(path) {
    super('sqlite');
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
    for (const migration of sqliteMigrations) {
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

  async transaction(work) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = await work(this);
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  async close() { this.db.close(); }
}

export const translatePostgresSql = statement => {
  let parameter = 0;
  return statement
    .replaceAll('CURRENT_TIMESTAMP', "to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')")
    .replaceAll('substr(created_at,1,10)', 'substring(created_at from 1 for 10)')
    .replaceAll('substr(received_at,1,10)', 'substring(received_at from 1 for 10)')
    .replace(/\?/g, () => `$${++parameter}`);
};

class PostgresTransactionAdapter extends DatabaseAdapter {
  constructor(client) {
    super('postgres');
    this.client = client;
  }

  async query(statement, values = []) {
    const result = await this.client.query(translatePostgresSql(statement), values);
    return {
      recordset: result.rows,
      rowsAffected: [Number(result.rowCount ?? 0)],
    };
  }

  async transaction(work) {
    return work(this);
  }

  async close() {}
}

export class PostgresDatabase extends DatabaseAdapter {
  constructor(connectionString) {
    super('postgres');
    this.pool = new Pool({
      connectionString,
      max: Number(process.env.DB_POOL_MAX ?? 5),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      application_name: 'zeus-finance',
    });
  }

  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations(
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    const appliedResult = await this.pool.query('SELECT version FROM schema_migrations ORDER BY version');
    const applied = new Set(appliedResult.rows.map(row => row.version));

    for (const migration of postgresMigrations) {
      if (applied.has(migration.version)) continue;
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(migration.sql);
        await client.query('INSERT INTO schema_migrations(version,name) VALUES($1,$2)', [migration.version, migration.name]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
  }

  async query(statement, values = []) {
    const result = await this.pool.query(translatePostgresSql(statement), values);
    return {
      recordset: result.rows,
      rowsAffected: [Number(result.rowCount ?? 0)],
    };
  }

  async transaction(work) {
    const client = await this.pool.connect();
    const database = new PostgresTransactionAdapter(client);

    try {
      await client.query('BEGIN');
      const result = await work(database);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool.end();
  }
}

export async function openDatabase({ sqlitePath, allowSqliteProduction = false } = {}) {
  if (process.env.DATABASE_URL) {
    const database = new PostgresDatabase(process.env.DATABASE_URL);
    await database.init();
    return database;
  }

  const sqliteAllowedInProduction = allowSqliteProduction || process.env.ALLOW_SQLITE_PRODUCTION === '1';
  const productionEnvironment = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
  if (productionEnvironment && !sqliteAllowedInProduction) {
    throw new Error(
      'DATABASE_URL é obrigatório em produção. O ZEUS não inicia com SQLite efêmero para evitar perda de usuários e dados após reinícios.',
    );
  }

  const path = process.env.DATABASE_PATH ?? sqlitePath;
  if (!path) throw new Error('DATABASE_PATH não informado para o SQLite local.');
  return new SqliteDatabase(path);
}
