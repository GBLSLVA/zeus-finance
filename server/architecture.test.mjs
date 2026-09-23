import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseAdapter } from './database-adapter.mjs';
import { SqliteDatabase, PostgresDatabase } from './database.mjs';
import { UserRepository } from './repositories/user-repository.mjs';
import { AuthService, FinanceRepository } from './app.mjs';

test('Arquitetura: adaptadores de banco implementam o mesmo contrato', () => {
  assert.throws(() => new DatabaseAdapter('invalid'), /abstrato/i);
  assert.ok(SqliteDatabase.prototype instanceof DatabaseAdapter);
  assert.ok(PostgresDatabase.prototype instanceof DatabaseAdapter);
});

test('Arquitetura: FinanceRepository compõe UserRepository e AuthService depende do contrato', async () => {
  const dir = mkdtempSync(join(tmpdir(),'zeus-architecture-'));
  const path = join(dir,'architecture.sqlite');
  const db = new SqliteDatabase(path);

  try {
    const finance = new FinanceRepository(db);
    assert.ok(finance.users instanceof UserRepository);

    const auth = new AuthService(finance.users);
    const registered = await auth.login({
      email:'architecture@example.com',
      password:'architecture-password-123',
    },true,'architecture-test');

    assert.equal(registered.user.email,'architecture@example.com');
    assert.equal((await finance.users.findPublicById(registered.user.id)).email,'architecture@example.com');
  } finally {
    await db.close();
    rmSync(dir,{recursive:true,force:true});
  }
});

test('Arquitetura: AuthService aceita implementação compatível sem depender da classe concreta', () => {
  const compatibleRepository = {
    findSessionUser: async () => null,
    create: async () => null,
    findByEmail: async () => null,
    findCredentialsById: async () => null,
    purgeExpiredSessions: async () => {},
    createSession: async () => {},
    updatePasswordAndRevokeOtherSessions: async () => {},
    deleteAccount: async () => false,
    logout: async () => {},
  };

  const service = new AuthService(compatibleRepository);
  assert.equal(service.users,compatibleRepository);
});
