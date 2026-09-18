import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import { SqliteDatabase } from './database.mjs';
import { FinanceApi, FinanceRepository } from './app.mjs';

test('API: autenticação, CRUD, datas financeiras, recorrência e isolamento', async () => {
  const dir = mkdtempSync(join(tmpdir(),'zeus-test-'));
  const path = join(dir,'test.sqlite');
  const db = new SqliteDatabase(path);
  const api = new FinanceApi(new FinanceRepository(db));
  api.server.listen(0,'127.0.0.1');
  await once(api.server,'listening');
  const base = `http://127.0.0.1:${api.server.address().port}/api/`;

  async function call(route,method='GET',body,cookie,origin='http://localhost:5173') {
    const response = await fetch(base+route,{
      method,
      headers:{'Content-Type':'application/json',Origin:origin,...(cookie?{Cookie:cookie}:{})},
      body:body?JSON.stringify(body):undefined,
    });
    return {
      status:response.status,
      data:await response.json(),
      cookie:response.headers.get('set-cookie')?.split(';')[0],
    };
  }

  try {
    assert.equal((await call('transactions')).status,401);

    const first = await call('register','POST',{email:'a@example.com',password:'secure-password-123'});
    assert.equal(first.status,200);
    assert.ok(first.cookie);
    assert.equal((await call('login','POST',{email:'a@example.com',password:'wrong-password-123'})).status,401);

    const added = await call('transactions','POST',{
      name:"Mercado ' teste",
      category:'Comida',
      value:12.34,
      transactionDate:'2026-08-31',
    },first.cookie);
    assert.equal(added.status,201);
    assert.equal(added.data.value,12.34);
    assert.equal(added.data.transactionDate,'2026-08-31');

    const edited = await call(`transactions/${added.data.id}`,'PUT',{
      name:'Mercado atualizado',
      category:'Comida',
      value:20,
      transactionDate:'2026-09-02',
    },first.cookie);
    assert.equal(edited.status,200);
    assert.equal(edited.data.value,20);
    assert.equal(edited.data.transactionDate,'2026-09-02');

    assert.equal((await call('transactions','POST',{name:'Inválido',category:'Comida',value:-1,transactionDate:'2026-09-01'},first.cookie)).status,400);
    assert.equal((await call('transactions','POST',{name:'Data ruim',category:'Comida',value:10,transactionDate:'2026-02-31'},first.cookie)).status,400);

    assert.equal((await call('goals','POST',{name:'Reserva',target:1000,saved:100},first.cookie)).status,201);

    const debt = await call('debts','POST',{
      name:'Cartão',
      creditor:'Banco Exemplo',
      originalAmount:1200,
      interestRate:2.5,
      installmentsTotal:12,
      dueDay:10,
    },first.cookie);
    assert.equal(debt.status,201);
    assert.equal(debt.data.originalAmount,1200);
    assert.equal(debt.data.currentBalance,1200);
    assert.equal(debt.data.interestRate,2.5);
    assert.equal(debt.data.installmentsTotal,12);
    assert.equal(debt.data.installmentsPaid,0);
    assert.equal(debt.data.status,'active');

    const payment = await call(`debts/${debt.data.id}/payments`,'POST',{
      amount:200,
      paymentDate:'2026-09-05',
      note:'Primeira parcela',
      countsAsInstallment:true,
    },first.cookie);
    assert.equal(payment.status,201);
    assert.equal(payment.data.payment.amount,200);
    assert.equal(payment.data.debt.currentBalance,1000);
    assert.equal(payment.data.debt.installmentsPaid,1);

    const debtEdited = await call(`debts/${debt.data.id}`,'PUT',{
      name:'Cartão atualizado',
      creditor:'Banco Exemplo',
      originalAmount:1300,
      interestRate:2.5,
      installmentsTotal:12,
      dueDay:10,
    },first.cookie);
    assert.equal(debtEdited.status,200);
    assert.equal(debtEdited.data.currentBalance,1100);

    assert.equal((await call(`debts/${debt.data.id}/payments`,'POST',{
      amount:1200,
      paymentDate:'2026-09-06',
    },first.cookie)).status,400);

    const debtPayments = await call(`debts/${debt.data.id}/payments`,'GET',undefined,first.cookie);
    assert.equal(debtPayments.status,200);
    assert.equal(debtPayments.data.length,1);

    const salary = await call('incomes','POST',{
      name:'Salário',
      type:'salary',
      value:3500,
      activeFrom:'2026-01-01',
      activeUntil:null,
      active:true,
    },first.cookie);
    assert.equal(salary.status,201);
    assert.equal(salary.data.type,'salary');
    assert.equal(salary.data.recurrence,'monthly');
    assert.equal(salary.data.activeFrom,'2026-01-01');
    assert.equal(salary.data.active,true);

    const salaryEdited = await call(`incomes/${salary.data.id}`,'PUT',{
      name:'Salário anterior',
      type:'salary',
      value:3500,
      activeFrom:'2026-01-01',
      activeUntil:'2026-08-31',
      active:false,
    },first.cookie);
    assert.equal(salaryEdited.status,200);
    assert.equal(salaryEdited.data.active,false);
    assert.equal(salaryEdited.data.activeUntil,'2026-08-31');

    const extra = await call('incomes','POST',{
      name:'Freelance',
      type:'extra',
      value:450,
      receivedAt:'2026-09-10',
    },first.cookie);
    assert.equal(extra.status,201);
    assert.equal(extra.data.type,'extra');
    assert.equal(extra.data.recurrence,'once');

    assert.equal((await call('incomes','POST',{name:'Inválida',type:'bonus',value:100},first.cookie)).status,400);
    assert.equal((await call('incomes','GET',undefined,first.cookie)).data.length,2);

    const foodBudget = await call('budgets','POST',{month:'2026-09',category:'Comida',limit:800},first.cookie);
    assert.equal(foodBudget.status,200);
    assert.equal(foodBudget.data.category,'Comida');
    assert.equal(foodBudget.data.limit,800);

    const foodBudgetUpdated = await call('budgets','POST',{month:'2026-09',category:'Comida',limit:950},first.cookie);
    assert.equal(foodBudgetUpdated.status,200);
    assert.equal(foodBudgetUpdated.data.id,foodBudget.data.id);
    assert.equal(foodBudgetUpdated.data.limit,950);

    const transportBudget = await call('budgets','POST',{month:'2026-09',category:'Transporte',limit:400},first.cookie);
    assert.equal(transportBudget.status,200);

    const budgets = await call('budgets?month=2026-09','GET',undefined,first.cookie);
    assert.equal(budgets.status,200);
    assert.equal(budgets.data.length,2);
    assert.equal((await call('budgets?month=2026-13','GET',undefined,first.cookie)).status,400);
    assert.equal((await call('budgets','POST',{month:'2026-09',category:'Inválida',limit:100},first.cookie)).status,400);

    const second = await call('register','POST',{email:'b@example.com',password:'secure-password-456'});
    assert.deepEqual((await call('transactions','GET',undefined,second.cookie)).data,[]);
    assert.deepEqual((await call('incomes','GET',undefined,second.cookie)).data,[]);
    assert.deepEqual((await call('budgets?month=2026-09','GET',undefined,second.cookie)).data,[]);
    assert.equal((await call(`budgets/${foodBudget.data.id}`,'DELETE',undefined,second.cookie)).status,404);
    assert.equal((await call(`transactions/${added.data.id}`,'PUT',{name:'Ataque',category:'Outros',value:1,transactionDate:'2026-09-02'},second.cookie)).status,404);
    assert.equal((await call(`debts/${debt.data.id}/payments`,'POST',{amount:1,paymentDate:'2026-09-07'},second.cookie)).status,404);
    assert.equal((await call(`incomes/${extra.data.id}`,'DELETE',undefined,second.cookie)).status,404);
    assert.equal((await call('transactions','GET',undefined,first.cookie,'https://untrusted.example')).status,403);

    const connection = new SqliteDatabase(path);
    const persisted = await new FinanceRepository(connection).list(first.data.id,'transactions');
    assert.equal(persisted.length,1);
    assert.equal(persisted[0].transactionDate,'2026-09-02');
    await connection.close();

    const paymentRemoved = await call(`debts/${debt.data.id}/payments/${payment.data.payment.id}`,'DELETE',undefined,first.cookie);
    assert.equal(paymentRemoved.status,200);
    assert.equal(paymentRemoved.data.currentBalance,1300);
    assert.equal(paymentRemoved.data.installmentsPaid,0);

    assert.equal((await call(`transactions/${added.data.id}`,'DELETE',undefined,first.cookie)).status,200);
    assert.equal((await call(`debts/${debt.data.id}`,'DELETE',undefined,first.cookie)).status,200);
    assert.equal((await call(`budgets/${transportBudget.data.id}`,'DELETE',undefined,first.cookie)).status,200);
    assert.equal((await call('budgets?month=2026-09','GET',undefined,first.cookie)).data.length,1);
    assert.equal((await call(`incomes/${extra.data.id}`,'DELETE',undefined,first.cookie)).status,200);
    await call('logout','POST',undefined,first.cookie);
    assert.equal((await call('me','GET',undefined,first.cookie)).status,401);
  } finally {
    api.server.closeAllConnections();
    await new Promise(resolve=>api.server.close(resolve));
    await db.close();
    rmSync(dir,{recursive:true,force:true});
  }
});

test('Banco: migra uma base antiga sem perder registros', async () => {
  const dir = mkdtempSync(join(tmpdir(),'zeus-migration-'));
  const path = join(dir,'legacy.sqlite');
  const legacy = new DatabaseSync(path);
  legacy.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE users(id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL);
    CREATE TABLE sessions(token TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
    CREATE TABLE entries(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),kind TEXT NOT NULL CHECK(kind IN ('transactions','goals','debts')),name TEXT NOT NULL,category TEXT,amount INTEGER NOT NULL CHECK(amount>0),saved INTEGER NOT NULL DEFAULT 0 CHECK(saved>=0),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE incomes(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),name TEXT NOT NULL,type TEXT NOT NULL CHECK(type IN ('salary','extra')),amount INTEGER NOT NULL CHECK(amount>0),received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    INSERT INTO users(id,email,password) VALUES(1,'legacy@example.com','hash');
    INSERT INTO entries(id,user_id,kind,name,category,amount,saved,created_at) VALUES(1,1,'transactions','Mercado','Comida',1234,0,'2026-08-15 10:00:00');
    INSERT INTO entries(id,user_id,kind,name,category,amount,saved,created_at) VALUES(2,1,'debts','Cartão antigo',NULL,250000,0,'2026-07-10 10:00:00');
    INSERT INTO incomes(id,user_id,name,type,amount,received_at) VALUES(1,1,'Salário antigo','salary',300000,'2026-01-05 12:00:00');
  `);
  legacy.close();

  const migrated = new SqliteDatabase(path);
  try {
    const versions = migrated.db.prepare('SELECT version FROM schema_migrations ORDER BY version').all().map(row => row.version);
    assert.deepEqual(versions,[1,2,3,4,5]);

    const entryColumns = migrated.db.prepare('PRAGMA table_info(entries)').all().map(row => row.name);
    assert.ok(entryColumns.includes('transaction_date'));
    assert.ok(entryColumns.includes('updated_at'));

    const incomeColumns = migrated.db.prepare('PRAGMA table_info(incomes)').all().map(row => row.name);
    assert.ok(incomeColumns.includes('recurrence'));
    assert.ok(incomeColumns.includes('active_from'));
    assert.ok(incomeColumns.includes('active_until'));
    assert.ok(incomeColumns.includes('active'));

    const entry = migrated.db.prepare('SELECT * FROM entries WHERE id=1').get();
    assert.equal(entry.transaction_date,'2026-08-15');

    const income = migrated.db.prepare('SELECT * FROM incomes WHERE id=1').get();
    assert.equal(income.recurrence,'monthly');
    assert.equal(income.active_from,'2026-01-05');
    assert.equal(income.active,1);

    const migratedDebt = migrated.db.prepare('SELECT * FROM debts WHERE user_id=1').get();
    assert.equal(migratedDebt.name,'Cartão antigo');
    assert.equal(migratedDebt.original_amount,250000);
    assert.equal(migratedDebt.current_balance,250000);
    assert.equal(migratedDebt.status,'active');

    const budgetColumns = migrated.db.prepare('PRAGMA table_info(budgets)').all().map(row => row.name);
    assert.ok(budgetColumns.includes('month'));
    assert.ok(budgetColumns.includes('category'));
    assert.ok(budgetColumns.includes('limit_amount'));
  } finally {
    await migrated.close();
    rmSync(dir,{recursive:true,force:true});
  }
});
