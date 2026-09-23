import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { SqliteDatabase, PostgresDatabase, openDatabase, translatePostgresSql } from './database.mjs';
import { AuthService, FinanceApi, FinanceRepository } from './app.mjs';

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
      setCookie:response.headers.get('set-cookie'),
    };
  }

  try {
    const health = await call('health');
    assert.equal(health.status,200);
    assert.equal(health.data.database,'sqlite');
    assert.equal(health.data.persistent,false);

    assert.equal((await call('transactions')).status,401);

    const first = await call('register','POST',{email:'a@example.com',password:'secure-password-123'});
    assert.equal(first.status,200);
    assert.ok(first.cookie);
    assert.match(first.setCookie,/Max-Age=86400/);

    const firstToken = first.cookie.split('=')[1];
    const firstTokenHash = createHash('sha256').update(firstToken).digest('hex');
    const firstExpiry = (await db.query('SELECT expires FROM sessions WHERE token=?',[firstTokenHash])).recordset[0].expires;
    assert.ok(firstExpiry - Date.now() > 23 * 60 * 60 * 1000);
    assert.ok(firstExpiry - Date.now() <= 24 * 60 * 60 * 1000);

    assert.equal((await call('register','POST',{email:'a@example.com',password:'another-secure-password-123'})).status,409);
    assert.equal((await call('login','POST',{email:'a@example.com',password:'wrong-password-123'})).status,401);

    const remembered = await call('login','POST',{
      email:'a@example.com',
      password:'secure-password-123',
      remember:true,
    });
    assert.equal(remembered.status,200);
    assert.match(remembered.setCookie,/Max-Age=2592000/);

    const rememberedToken = remembered.cookie.split('=')[1];
    const rememberedTokenHash = createHash('sha256').update(rememberedToken).digest('hex');
    const rememberedExpiry = (await db.query('SELECT expires FROM sessions WHERE token=?',[rememberedTokenHash])).recordset[0].expires;
    assert.ok(rememberedExpiry - Date.now() > 29 * 24 * 60 * 60 * 1000);
    assert.ok(rememberedExpiry - Date.now() <= 30 * 24 * 60 * 60 * 1000);
    await call('logout','POST',undefined,remembered.cookie);

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
    assert.equal((await call('goals','POST',{name:'Meta inválida',target:100,saved:101},first.cookie)).status,400);

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

    const salaryAutoEnd = await call('incomes','POST',{
      name:'Salário temporário',
      type:'salary',
      value:1200,
      activeFrom:'2026-06-01',
      activeUntil:null,
      active:true,
    },first.cookie);
    assert.equal(salaryAutoEnd.status,201);

    const salaryAutoEnded = await call(`incomes/${salaryAutoEnd.data.id}`,'PUT',{
      name:'Salário temporário',
      type:'salary',
      value:1200,
      activeFrom:'2026-06-01',
      activeUntil:null,
      active:false,
    },first.cookie);
    assert.equal(salaryAutoEnded.status,200);
    assert.equal(salaryAutoEnded.data.active,false);
    assert.match(salaryAutoEnded.data.activeUntil,/^\d{4}-\d{2}-\d{2}$/);
    assert.ok(salaryAutoEnded.data.activeUntil >= '2026-06-01');

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
    assert.equal((await call('incomes','GET',undefined,first.cookie)).data.length,3);

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

    const insights = await call('insights?month=2026-09','GET',undefined,first.cookie);
    assert.equal(insights.status,200);
    assert.equal(insights.data.month,'2026-09');
    assert.equal(insights.data.spent,20);
    assert.ok(Array.isArray(insights.data.items));
    assert.ok(insights.data.items.some(item => item.id === 'top-category' && item.title.includes('Comida')));
    assert.ok(insights.data.items.some(item => item.id === 'debt-progress'));
    assert.ok(insights.data.items.some(item => item.id === 'goal-progress'));
    assert.equal((await call('insights?month=2026-13','GET',undefined,first.cookie)).status,400);

    const dashboard = await call('dashboard?month=2026-09','GET',undefined,first.cookie);
    assert.equal(dashboard.status,200);
    assert.equal(dashboard.data.month,'2026-09');
    assert.equal(dashboard.data.spent,20);
    assert.equal(dashboard.data.salary,1200);
    assert.equal(dashboard.data.extras,450);
    assert.equal(dashboard.data.income,1650);
    assert.equal(dashboard.data.balance,1630);
    assert.equal(dashboard.data.debt,1100);
    assert.equal(dashboard.data.debtOriginal,1300);
    assert.equal(dashboard.data.debtPaid,200);
    assert.equal(dashboard.data.saved,100);
    assert.equal(dashboard.data.targets,1000);
    assert.equal(dashboard.data.budgetTotal,1350);
    assert.equal(dashboard.data.budgetedSpent,20);
    assert.equal(dashboard.data.budgetRemaining,1330);
    assert.equal(dashboard.data.historyData.length,6);
    assert.equal(dashboard.data.historyData.at(-1).monthKey,'2026-09');
    assert.equal((await call('dashboard?month=2026-13','GET',undefined,first.cookie)).status,400);

    const second = await call('register','POST',{email:'b@example.com',password:'secure-password-456'});
    assert.deepEqual((await call('transactions','GET',undefined,second.cookie)).data,[]);

    const secondEntry = await call('transactions','POST',{
      name:'Registro exclusivo do segundo usuário',
      category:'Casa',
      value:77,
      transactionDate:'2026-09-03',
    },second.cookie);
    assert.equal(secondEntry.status,201);

    const secondInsights = await call('insights?month=2026-09','GET',undefined,second.cookie);
    assert.equal(secondInsights.status,200);
    assert.equal(secondInsights.data.spent,77);
    assert.equal(secondInsights.data.items.some(item => item.id === 'debt-progress'),false);
    assert.equal(secondInsights.data.items.some(item => item.id === 'goal-progress'),false);

    const secondDashboard = await call('dashboard?month=2026-09','GET',undefined,second.cookie);
    assert.equal(secondDashboard.status,200);
    assert.equal(secondDashboard.data.spent,77);
    assert.equal(secondDashboard.data.debt,0);
    assert.equal(secondDashboard.data.saved,0);
    assert.equal(secondDashboard.data.income,0);

    const firstExport = await call('export','GET',undefined,first.cookie);
    assert.equal(firstExport.status,200);
    assert.equal(firstExport.data.format,'zeus-finance-backup');
    assert.equal(firstExport.data.version,1);
    assert.equal(firstExport.data.account.email,'a@example.com');
    assert.match(firstExport.data.exportedAt,/^\d{4}-\d{2}-\d{2}T/);
    assert.equal(firstExport.data.transactions.length,1);
    assert.equal(firstExport.data.transactions[0].name,'Mercado atualizado');
    assert.equal(firstExport.data.goals.length,1);
    assert.equal(firstExport.data.incomes.length,3);
    assert.equal(firstExport.data.debts.length,1);
    assert.equal(firstExport.data.debtPayments.length,1);
    assert.equal(firstExport.data.budgets.length,2);
    assert.equal(JSON.stringify(firstExport.data).includes('Registro exclusivo do segundo usuário'),false);

    const secondExport = await call('export','GET',undefined,second.cookie);
    assert.equal(secondExport.status,200);
    assert.equal(secondExport.data.account.email,'b@example.com');
    assert.equal(secondExport.data.transactions.length,1);
    assert.equal(secondExport.data.transactions[0].name,'Registro exclusivo do segundo usuário');
    assert.equal(JSON.stringify(secondExport.data).includes('Mercado atualizado'),false);

    const disposable = await call('register','POST',{email:'delete-me@example.com',password:'delete-secure-password-123'});
    assert.equal(disposable.status,200);
    assert.equal((await call('delete-account','POST',{
      password:'wrong-password-123',
      confirmation:'EXCLUIR',
    },disposable.cookie)).status,400);
    const deletedAccount = await call('delete-account','POST',{
      password:'delete-secure-password-123',
      confirmation:'EXCLUIR',
    },disposable.cookie);
    assert.equal(deletedAccount.status,200);
    assert.equal(deletedAccount.data.deleted,true);
    assert.equal(deletedAccount.cookie,'zeus_session=');
    assert.equal((await call('me','GET',undefined,disposable.cookie)).status,401);
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

    const alternateSession = await call('login','POST',{
      email:'a@example.com',
      password:'secure-password-123',
    });
    assert.equal(alternateSession.status,200);
    assert.ok(alternateSession.cookie);

    assert.equal((await call('change-password','POST',{
      currentPassword:'wrong-password-123',
      newPassword:'new-secure-password-456',
    },first.cookie)).status,400);

    assert.equal((await call('change-password','POST',{
      currentPassword:'secure-password-123',
      newPassword:'secure-password-123',
    },first.cookie)).status,400);

    const passwordChanged = await call('change-password','POST',{
      currentPassword:'secure-password-123',
      newPassword:'new-secure-password-456',
    },first.cookie);
    assert.equal(passwordChanged.status,200);

    assert.equal((await call('me','GET',undefined,first.cookie)).status,200);
    assert.equal((await call('me','GET',undefined,alternateSession.cookie)).status,401);
    assert.equal((await call('login','POST',{
      email:'a@example.com',
      password:'secure-password-123',
    })).status,401);

    const relogged = await call('login','POST',{
      email:'a@example.com',
      password:'new-secure-password-456',
    });
    assert.equal(relogged.status,200);

    await call('logout','POST',undefined,first.cookie);
    assert.equal((await call('me','GET',undefined,first.cookie)).status,401);
  } finally {
    api.server.closeAllConnections();
    await new Promise(resolve=>api.server.close(resolve));
    await db.close();
    rmSync(dir,{recursive:true,force:true});
  }
});

test('Insights: detecta duplicidade, gasto fora do padrão e alta de categoria', async () => {
  const dir = mkdtempSync(join(tmpdir(),'zeus-insights-'));
  const path = join(dir,'insights.sqlite');
  const db = new SqliteDatabase(path);
  const repository = new FinanceRepository(db);
  const auth = new AuthService(repository);

  try {
    const account = await auth.login({
      email:'insights@example.com',
      password:'secure-insights-password-123',
    },true,'insights-test');

    const user = account.user.id;
    await repository.add(user,'transactions',{name:'Mercado base junho',category:'Comida',value:100,transactionDate:'2026-06-10'});
    await repository.add(user,'transactions',{name:'Mercado base julho',category:'Comida',value:120,transactionDate:'2026-07-10'});
    await repository.add(user,'transactions',{name:'Mercado base agosto',category:'Comida',value:80,transactionDate:'2026-08-10'});
    await repository.add(user,'transactions',{name:'iFood jantar',category:'Comida',value:300,transactionDate:'2026-09-10'});
    await repository.add(user,'transactions',{name:'iFood jantar',category:'Comida',value:300,transactionDate:'2026-09-10'});

    const insights = await repository.insights(user,'2026-09');
    assert.ok(insights.items.some(item => item.id === 'possible-duplicate'));
    assert.ok(insights.items.some(item => item.id === 'unusual-transaction'));
    assert.ok(insights.items.some(item => item.id === 'category-spike'));

    const second = await auth.login({
      email:'insights-second@example.com',
      password:'secure-insights-password-456',
    },true,'insights-test');

    const isolated = await repository.insights(second.user.id,'2026-09');
    assert.equal(isolated.items.some(item => item.id === 'possible-duplicate'),false);
    assert.equal(isolated.items.some(item => item.id === 'unusual-transaction'),false);
    assert.equal(isolated.items.some(item => item.id === 'category-spike'),false);
  } finally {
    await db.close();
    rmSync(dir,{recursive:true,force:true});
  }
});

test('Auth: login válido não acumula bloqueio e limite é isolado por e-mail', async () => {
  const dir = mkdtempSync(join(tmpdir(),'zeus-auth-'));
  const path = join(dir,'auth.sqlite');
  const db = new SqliteDatabase(path);
  const auth = new AuthService(new FinanceRepository(db));
  auth.maxLoginFailures = 3;

  try {
    const password = 'secure-password-123';
    await auth.login({email:'rate-a@example.com',password},true,'shared-ip');
    await auth.login({email:'rate-b@example.com',password},true,'shared-ip');

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const result = await auth.login({email:'rate-a@example.com',password},false,'shared-ip');
      assert.equal(result.user.email,'rate-a@example.com');
    }

    await assert.rejects(
      auth.login({email:'rate-a@example.com',password:'wrong-password-123'},false,'shared-ip'),
      error => error.status === 401,
    );

    const recovered = await auth.login({email:'rate-a@example.com',password},false,'shared-ip');
    assert.equal(recovered.user.email,'rate-a@example.com');

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await assert.rejects(
        auth.login({email:'rate-a@example.com',password:'wrong-password-123'},false,'shared-ip'),
        error => error.status === 401,
      );
    }

    await assert.rejects(
      auth.login({email:'rate-a@example.com',password},false,'shared-ip'),
      error => error.status === 429,
    );

    const otherUser = await auth.login({email:'rate-b@example.com',password},false,'shared-ip');
    assert.equal(otherUser.user.email,'rate-b@example.com');
  } finally {
    await db.close();
    rmSync(dir,{recursive:true,force:true});
  }
});

test('Conta: exclusão remove dados próprios e preserva outro usuário', async () => {
  const dir = mkdtempSync(join(tmpdir(),'zeus-delete-account-'));
  const path = join(dir,'account.sqlite');
  const db = new SqliteDatabase(path);
  const repository = new FinanceRepository(db);
  const auth = new AuthService(repository);

  try {
    const owner = await auth.login({
      email:'owner-delete@example.com',
      password:'owner-secure-password-123',
    },true,'delete-owner');
    const other = await auth.login({
      email:'other-delete@example.com',
      password:'other-secure-password-123',
    },true,'delete-other');

    await repository.add(owner.user.id,'transactions',{
      name:'Mercado',
      category:'Comida',
      value:100,
      transactionDate:'2026-09-10',
    });
    await repository.add(owner.user.id,'goals',{
      name:'Reserva',
      target:2000,
      saved:500,
    });
    await repository.addIncome(owner.user.id,{
      name:'Salário',
      type:'salary',
      value:3500,
      activeFrom:'2026-01-01',
      active:true,
    });
    const debt = await repository.addDebt(owner.user.id,{
      name:'Cartão',
      creditor:'Banco',
      originalAmount:500,
      interestRate:0,
      installmentsTotal:5,
      dueDay:10,
    });
    await repository.addDebtPayment(owner.user.id,debt.id,{
      amount:100,
      paymentDate:'2026-09-10',
      countsAsInstallment:true,
    });
    await repository.upsertBudget(owner.user.id,{
      month:'2026-09',
      category:'Comida',
      limit:700,
    });

    await repository.add(other.user.id,'transactions',{
      name:'Outro usuário',
      category:'Casa',
      value:50,
      transactionDate:'2026-09-10',
    });

    await assert.rejects(
      auth.deleteAccount(owner.user.id,{password:'wrong-password-123',confirmation:'EXCLUIR'}),
      error => error.status === 400,
    );

    await auth.deleteAccount(owner.user.id,{
      password:'owner-secure-password-123',
      confirmation:'EXCLUIR',
    });

    for (const table of ['sessions','entries','incomes','debts','debt_payments','budgets']) {
      const count = (await db.query(`SELECT COUNT(*) AS total FROM ${table} WHERE user_id=?`,[owner.user.id])).recordset[0].total;
      assert.equal(count,0,`${table} ainda possui dados do usuário excluído`);
    }

    const ownerRow = (await db.query('SELECT id FROM users WHERE id=?',[owner.user.id])).recordset[0];
    assert.equal(ownerRow,undefined);
    await assert.rejects(auth.authenticate(owner.token), error => error.status === 401);

    const otherRow = (await db.query('SELECT id FROM users WHERE id=?',[other.user.id])).recordset[0];
    assert.equal(otherRow.id,other.user.id);
    const otherEntries = await repository.list(other.user.id,'transactions');
    assert.equal(otherEntries.length,1);
    assert.equal(otherEntries[0].name,'Outro usuário');
  } finally {
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
    assert.deepEqual(versions,[1,2,3,4,5,6]);

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



test('Produção: recusa SQLite sem DATABASE_URL para proteger persistência', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousRender = process.env.RENDER;
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousAllowSqlite = process.env.ALLOW_SQLITE_PRODUCTION;
  delete process.env.DATABASE_URL;
  delete process.env.ALLOW_SQLITE_PRODUCTION;

  try {
    process.env.NODE_ENV = 'production';
    delete process.env.RENDER;
    await assert.rejects(
      () => openDatabase({sqlitePath:':memory:'}),
      /DATABASE_URL é obrigatório em produção/,
    );

    process.env.NODE_ENV = 'development';
    process.env.RENDER = 'true';
    await assert.rejects(
      () => openDatabase({sqlitePath:':memory:'}),
      /DATABASE_URL é obrigatório em produção/,
    );
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousNodeEnv;
    if (previousRender === undefined) delete process.env.RENDER; else process.env.RENDER = previousRender;
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousDatabaseUrl;
    if (previousAllowSqlite === undefined) delete process.env.ALLOW_SQLITE_PRODUCTION; else process.env.ALLOW_SQLITE_PRODUCTION = previousAllowSqlite;
  }
});

test('PostgreSQL: traduz placeholders e funções SQLite usadas pelo repositório', () => {
  const sql = translatePostgresSql(
    'UPDATE entries SET updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND id=? RETURNING id',
  );
  assert.equal(
    sql,
    "UPDATE entries SET updated_at=to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS') WHERE user_id=$1 AND id=$2 RETURNING id",
  );

  const ordered = translatePostgresSql(
    'SELECT * FROM entries WHERE user_id=? ORDER BY COALESCE(transaction_date,substr(created_at,1,10)) DESC',
  );
  assert.equal(
    ordered,
    'SELECT * FROM entries WHERE user_id=$1 ORDER BY COALESCE(transaction_date,substring(created_at from 1 for 10)) DESC',
  );
});

test('PostgreSQL: persiste cadastro e permite login após reconectar', {skip: !process.env.TEST_DATABASE_URL}, async () => {
  const email = `postgres-login-${Date.now()}@example.com`;
  const password = 'secure-postgres-password-123';
  let userId;
  let sessionToken;

  const firstConnection = new PostgresDatabase(process.env.TEST_DATABASE_URL);
  await firstConnection.init();
  try {
    const versions = (await firstConnection.query('SELECT version FROM schema_migrations ORDER BY version')).recordset.map(row => row.version);
    assert.deepEqual(versions,[1,2,3,4,5,6]);

    const auth = new AuthService(new FinanceRepository(firstConnection));
    const registered = await auth.login({email,password},true,'postgres-register');
    userId = registered.user.id;
    sessionToken = registered.token;
    assert.equal(registered.user.email,email);

    const stored = (await firstConnection.query('SELECT email,password FROM users WHERE id=?',[userId])).recordset[0];
    assert.equal(stored.email,email);
    assert.notEqual(stored.password,password);
    assert.match(stored.password,/^[a-f0-9]{32}:[a-f0-9]{128}$/);
  } finally {
    await firstConnection.close();
  }

  const secondConnection = new PostgresDatabase(process.env.TEST_DATABASE_URL);
  await secondConnection.init();
  try {
    const auth = new AuthService(new FinanceRepository(secondConnection));
    assert.equal(await auth.authenticate(sessionToken),userId);
    const loggedIn = await auth.login({email,password},false,'postgres-login');
    assert.equal(loggedIn.user.id,userId);
    assert.equal(loggedIn.user.email,email);

    await secondConnection.query('DELETE FROM sessions WHERE user_id=?',[userId]);
    await secondConnection.query('DELETE FROM users WHERE id=?',[userId]);
  } finally {
    await secondConnection.close();
  }
});

test('PostgreSQL: serializa pagamentos concorrentes sem ultrapassar o saldo', {skip: !process.env.TEST_DATABASE_URL}, async () => {
  const database = new PostgresDatabase(process.env.TEST_DATABASE_URL);
  await database.init();

  const repository = new FinanceRepository(database);
  const auth = new AuthService(repository);
  const email = `postgres-debt-${Date.now()}@example.com`;
  const password = 'secure-postgres-password-123';
  let userId;

  try {
    const registered = await auth.login({email,password},true,'postgres-debt-register');
    userId = registered.user.id;

    const debt = await repository.addDebt(userId,{
      name:'Concorrência cartão',
      creditor:'Banco Teste',
      originalAmount:1000,
      interestRate:0,
      installmentsTotal:10,
      dueDay:10,
    });

    const results = await Promise.allSettled([
      repository.addDebtPayment(userId,debt.id,{
        amount:700,
        paymentDate:'2026-09-20',
        note:'Pagamento concorrente A',
        countsAsInstallment:true,
      }),
      repository.addDebtPayment(userId,debt.id,{
        amount:700,
        paymentDate:'2026-09-20',
        note:'Pagamento concorrente B',
        countsAsInstallment:true,
      }),
    ]);

    const fulfilled = results.filter(result => result.status === 'fulfilled');
    const rejected = results.filter(result => result.status === 'rejected');
    assert.equal(fulfilled.length,1);
    assert.equal(rejected.length,1);
    assert.equal(rejected[0].reason.status,400);

    const payments = await repository.listDebtPayments(userId,debt.id);
    assert.equal(payments.length,1);
    assert.equal(payments[0].amount,700);

    const updatedDebt = (await repository.listDebts(userId)).find(item => item.id === debt.id);
    assert.equal(updatedDebt.currentBalance,300);
    assert.equal(updatedDebt.paidAmount,700);
    assert.equal(updatedDebt.installmentsPaid,1);
  } finally {
    if (userId) {
      await database.query('DELETE FROM sessions WHERE user_id=?',[userId]);
      await database.query('DELETE FROM debts WHERE user_id=?',[userId]);
      await database.query('DELETE FROM users WHERE id=?',[userId]);
    }
    await database.close();
  }
});

test('PostgreSQL: cadastro concorrente do mesmo e-mail retorna conflito sem duplicar usuário', {skip: !process.env.TEST_DATABASE_URL}, async () => {
  const database = new PostgresDatabase(process.env.TEST_DATABASE_URL);
  await database.init();
  const repository = new FinanceRepository(database);
  const email = `postgres-register-race-${Date.now()}@example.com`;
  const password = 'secure-postgres-password-123';

  try {
    const firstAuth = new AuthService(repository);
    const secondAuth = new AuthService(repository);
    const results = await Promise.allSettled([
      firstAuth.login({email,password},true,'register-race-a'),
      secondAuth.login({email,password},true,'register-race-b'),
    ]);

    const fulfilled = results.filter(result => result.status === 'fulfilled');
    const rejected = results.filter(result => result.status === 'rejected');

    assert.equal(fulfilled.length,1);
    assert.equal(rejected.length,1);
    assert.equal(rejected[0].reason.status,409);

    const users = (await database.query('SELECT id,email FROM users WHERE email=?',[email])).recordset;
    assert.equal(users.length,1);
    assert.equal(users[0].email,email);

    await database.query('DELETE FROM sessions WHERE user_id=?',[users[0].id]);
    await database.query('DELETE FROM users WHERE id=?',[users[0].id]);
  } finally {
    await database.close();
  }
});

