import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { SqliteDatabase, PostgresDatabase } from './database.mjs';
import { FinanceApi, FinanceRepository, AuthService } from './app.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');

test('Segurança: cookie de produção e token de sessão não ficam em texto puro no banco', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';

  const dir = mkdtempSync(join(tmpdir(),'zeus-security-cookie-'));
  const db = new SqliteDatabase(join(dir,'test.sqlite'));
  const api = new FinanceApi(new FinanceRepository(db));
  api.server.listen(0,'127.0.0.1');
  await once(api.server,'listening');
  const base = `http://127.0.0.1:${api.server.address().port}/api/`;

  try {
    const response = await fetch(base+'register',{
      method:'POST',
      headers:{'Content-Type':'application/json',Origin:'http://localhost:5173'},
      body:JSON.stringify({email:'cookie@example.com',password:'secure-password-123'}),
    });
    assert.equal(response.status,200);
    const cookie = response.headers.get('set-cookie');
    assert.match(cookie,/HttpOnly/i);
    assert.match(cookie,/SameSite=Strict/i);
    assert.match(cookie,/Secure/i);
    assert.match(cookie,/Path=\/api/i);

    const rawToken = /zeus_session=([a-f0-9]+)/.exec(cookie)?.[1];
    assert.ok(rawToken);
    const session = db.db.prepare('SELECT token FROM sessions').get();
    assert.notEqual(session.token,rawToken);
    assert.equal(session.token,digest(rawToken));
  } finally {
    api.server.closeAllConnections();
    await new Promise(resolve=>api.server.close(resolve));
    await db.close();
    rmSync(dir,{recursive:true,force:true});
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});

test('Segurança: API bloqueia origem maliciosa, JSON inválido e corpo excessivo', async () => {
  const dir = mkdtempSync(join(tmpdir(),'zeus-security-api-'));
  const db = new SqliteDatabase(join(dir,'test.sqlite'));
  const api = new FinanceApi(new FinanceRepository(db));
  api.server.listen(0,'127.0.0.1');
  await once(api.server,'listening');
  const base = `http://127.0.0.1:${api.server.address().port}/api/`;

  try {
    const blocked = await fetch(base+'register',{
      method:'POST',
      headers:{'Content-Type':'application/json',Origin:'https://evil.example'},
      body:JSON.stringify({email:'evil@example.com',password:'secure-password-123'}),
    });
    assert.equal(blocked.status,403);

    const malformed = await fetch(base+'register',{
      method:'POST',
      headers:{'Content-Type':'application/json',Origin:'http://localhost:5173'},
      body:'{"email":',
    });
    assert.equal(malformed.status,400);

    const oversized = await fetch(base+'register',{
      method:'POST',
      headers:{'Content-Type':'application/json',Origin:'http://localhost:5173'},
      body:JSON.stringify({email:'large@example.com',password:'x'.repeat(17000)}),
    });
    assert.equal(oversized.status,413);
  } finally {
    api.server.closeAllConnections();
    await new Promise(resolve=>api.server.close(resolve));
    await db.close();
    rmSync(dir,{recursive:true,force:true});
  }
});

test('Segurança: consultas parametrizadas resistem a payload de SQL injection', async () => {
  const dir = mkdtempSync(join(tmpdir(),'zeus-security-sql-'));
  const db = new SqliteDatabase(join(dir,'test.sqlite'));
  const repository = new FinanceRepository(db);
  try {
    const user = (await db.query(
      'INSERT INTO users(email,password) VALUES(?,?) RETURNING id',
      ['sql@example.com','not-used'],
    )).recordset[0].id;

    const payload = "x'); DROP TABLE users; --";
    const entry = await repository.add(user,'transactions',{
      name:payload,
      category:'Outros',
      value:10,
      transactionDate:'2026-09-18',
    });
    assert.equal(entry.name,payload);

    const users = await db.query('SELECT COUNT(*) AS total FROM users');
    assert.equal(Number(users.recordset[0].total),1);
  } finally {
    await db.close();
    rmSync(dir,{recursive:true,force:true});
  }
});

test('Segurança: rate limit de autenticação bloqueia a 21ª tentativa por endereço', async () => {
  const dir = mkdtempSync(join(tmpdir(),'zeus-security-rate-'));
  const db = new SqliteDatabase(join(dir,'test.sqlite'));
  const auth = new AuthService(new FinanceRepository(db));
  try {
    await auth.login({email:'rate@example.com',password:'secure-password-123'},true,'signup-address');
    for (let attempt=1; attempt<=20; attempt++) {
      await assert.rejects(
        auth.login({email:'rate@example.com',password:'wrong-password-123'},false,'attacker-address'),
        error => error.status === 401,
      );
    }
    await assert.rejects(
      auth.login({email:'rate@example.com',password:'wrong-password-123'},false,'attacker-address'),
      error => error.status === 429,
    );
  } finally {
    await db.close();
    rmSync(dir,{recursive:true,force:true});
  }
});

test('Segurança PostgreSQL: pagamentos concorrentes não podem ultrapassar o saldo', {skip: !process.env.TEST_DATABASE_URL}, async () => {
  const db = new PostgresDatabase(process.env.TEST_DATABASE_URL);
  await db.init();
  const repository = new FinanceRepository(db);
  const email = `race-${Date.now()}@example.com`;
  let user;
  let debt;
  try {
    user = (await db.query(
      'INSERT INTO users(email,password) VALUES(?,?) RETURNING id',
      [email,'not-used'],
    )).recordset[0].id;

    debt = await repository.addDebt(user,{
      name:'Teste concorrência',
      originalAmount:100,
      interestRate:0,
      installmentsTotal:2,
      dueDay:10,
    });

    const results = await Promise.allSettled([
      repository.addDebtPayment(user,debt.id,{amount:80,paymentDate:'2026-09-18'}),
      repository.addDebtPayment(user,debt.id,{amount:80,paymentDate:'2026-09-18'}),
    ]);

    const fulfilled = results.filter(result=>result.status==='fulfilled').length;
    const rejected = results.filter(result=>result.status==='rejected').length;
    const payments = await repository.listDebtPayments(user,debt.id);
    const totalPaid = payments.reduce((sum,payment)=>sum+payment.amount,0);

    assert.equal(fulfilled,1,'Apenas um pagamento concorrente deveria ser aceito.');
    assert.equal(rejected,1,'O segundo pagamento deveria ser rejeitado após lock/revalidação.');
    assert.ok(totalPaid <= 100,'O total pago nunca pode ultrapassar o valor original.');
  } finally {
    if (user) {
      await db.query('DELETE FROM debts WHERE user_id=?',[user]);
      await db.query('DELETE FROM sessions WHERE user_id=?',[user]);
      await db.query('DELETE FROM entries WHERE user_id=?',[user]);
      await db.query('DELETE FROM incomes WHERE user_id=?',[user]);
      await db.query('DELETE FROM budgets WHERE user_id=?',[user]);
      await db.query('DELETE FROM users WHERE id=?',[user]);
    }
    await db.close();
  }
});
