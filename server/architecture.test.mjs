import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseAdapter } from './database-adapter.mjs';
import { SqliteDatabase, PostgresDatabase } from './database.mjs';
import { BudgetRepository } from './repositories/budget-repository.mjs';
import { DebtRepository } from './repositories/debt-repository.mjs';
import { EntryRepository } from './repositories/entry-repository.mjs';
import { GoalRepository } from './repositories/goal-repository.mjs';
import { IncomeRepository } from './repositories/income-repository.mjs';
import { RecurringExpenseRepository } from './repositories/recurring-expense-repository.mjs';
import { UserRepository } from './repositories/user-repository.mjs';
import { AssistantService } from './services/assistant-service.mjs';
import { DashboardService } from './services/dashboard-service.mjs';
import { ExportService } from './services/export-service.mjs';
import { InsightService } from './services/insight-service.mjs';
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
    assert.ok(finance.entries instanceof EntryRepository);
    assert.ok(finance.goals instanceof GoalRepository);
    assert.ok(finance.debts instanceof DebtRepository);
    assert.ok(finance.budgets instanceof BudgetRepository);
    assert.ok(finance.recurring instanceof RecurringExpenseRepository);
    assert.ok(finance.incomes instanceof IncomeRepository);
    assert.ok(finance.dashboardService instanceof DashboardService);
    assert.ok(finance.insightService instanceof InsightService);
    assert.ok(finance.assistantService instanceof AssistantService);
    assert.ok(finance.exportService instanceof ExportService);

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
    purgeExpiredPasswordResetTokens: async () => {},
    createPasswordResetToken: async () => {},
    resetPasswordWithToken: async () => false,
    deleteAccount: async () => false,
    logout: async () => {},
  };

  const service = new AuthService(compatibleRepository);
  assert.equal(service.users,compatibleRepository);
});


test('Arquitetura: repositories de domínio mantêm validação e persistência encapsuladas', async () => {
  const dir = mkdtempSync(join(tmpdir(),'zeus-domain-repositories-'));
  const path = join(dir,'repositories.sqlite');
  const db = new SqliteDatabase(path);

  try {
    const users = new UserRepository(db);
    const account = await users.create('repositories@example.com','hash');
    const entries = new EntryRepository(db);
    const goals = new GoalRepository(db);
    const debts = new DebtRepository(db);
    const budgets = new BudgetRepository(db);
    const recurring = new RecurringExpenseRepository(db);
    const incomes = new IncomeRepository(db);

    const transaction = await entries.add(account.id,'transactions',{
      name:'Mercado',
      category:'Comida',
      value:80,
      transactionDate:'2026-09-05',
    });
    assert.equal(transaction.value,80);

    const goal = await goals.add(account.id,{
      name:'Reserva',
      target:1000,
      saved:100,
    });
    assert.equal(goal.saved,100);

    const movement = await goals.addMovement(account.id,goal.id,{
      type:'deposit',
      amount:150,
      movementDate:'2026-09-06',
      note:'Aporte teste',
    });
    assert.equal(movement.goal.saved,250);
    assert.equal((await goals.listMovements(account.id,goal.id)).length,2);

    const debt = await debts.add(account.id,{
      name:'Cartão',
      originalAmount:500,
      installmentsTotal:5,
      dueDay:10,
    });
    assert.equal(debt.currentBalance,500);

    const budget = await budgets.upsert(account.id,{
      month:'2026-09',
      category:'Casa',
      limit:900,
    });
    assert.equal(budget.limit,900);

    const recurringExpense = await recurring.add(account.id,{
      name:'Internet',
      category:'Casa',
      value:120,
      dueDay:15,
      activeFrom:'2026-09-01',
      active:true,
    });
    assert.equal(recurringExpense.value,120);

    const income = await incomes.add(account.id,{
      name:'Salário',
      type:'salary',
      value:2500,
      activeFrom:'2026-09-01',
      active:true,
    });
    assert.equal(income.value,2500);
    assert.equal(income.recurrence,'monthly');
  } finally {
    await db.close();
    rmSync(dir,{recursive:true,force:true});
  }
});
