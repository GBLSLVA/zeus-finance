import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { SqliteDatabase } from './database.mjs';
import { FinanceApi, FinanceRepository } from './app.mjs';

test('API: autenticação, isolamento, validação, persistência e logout', async () => {
  const dir=mkdtempSync(join(tmpdir(),'zeus-test-')), path=join(dir,'test.sqlite');
  const db=new SqliteDatabase(path),api=new FinanceApi(new FinanceRepository(db));
  api.server.listen(0,'127.0.0.1');await once(api.server,'listening');
  const base=`http://127.0.0.1:${api.server.address().port}/api/`;
  async function call(route,method='GET',body,cookie,origin='http://localhost:5173') {
    const response=await fetch(base+route,{method,headers:{'Content-Type':'application/json',Origin:origin,...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});
    return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
  }
  try {
    assert.equal((await call('transactions')).status,401);
    const first=await call('register','POST',{email:'a@example.com',password:'secure-password-123'});
    assert.equal(first.status,200);assert.ok(first.cookie);
    assert.equal((await call('login','POST',{email:'a@example.com',password:'wrong-password-123'})).status,401);
    const added=await call('transactions','POST',{name:"Mercado ' teste",category:'Comida',value:12.34},first.cookie);
    assert.equal(added.status,201);assert.equal(added.data.value,12.34);
    assert.equal((await call('transactions','POST',{name:'Inválido',category:'Comida',value:-1},first.cookie)).status,400);
    assert.equal((await call('goals','POST',{name:'Reserva',target:1000,saved:100},first.cookie)).status,201);
    assert.equal((await call('debts','POST',{name:'Parcela',value:99},first.cookie)).status,201);
    const second=await call('register','POST',{email:'b@example.com',password:'secure-password-456'});
    assert.deepEqual((await call('transactions','GET',undefined,second.cookie)).data,[]);
    assert.equal((await call(`transactions/${added.data.id}`,'DELETE',undefined,second.cookie)).status,404);
    assert.equal((await call('transactions','GET',undefined,first.cookie,'https://untrusted.example')).status,403);
    const connection=new SqliteDatabase(path);
    assert.equal((await new FinanceRepository(connection).list(first.data.id,'transactions')).length,1);
    await connection.close();
    assert.equal((await call(`transactions/${added.data.id}`,'DELETE',undefined,first.cookie)).status,200);
    await call('logout','POST',undefined,first.cookie);
    assert.equal((await call('me','GET',undefined,first.cookie)).status,401);
  } finally {api.server.closeAllConnections();await new Promise(resolve=>api.server.close(resolve));await db.close();rmSync(dir,{recursive:true,force:true});}
});
