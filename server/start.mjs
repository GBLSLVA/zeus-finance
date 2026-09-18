import { FinanceApi, FinanceRepository } from './app.mjs';
import { SqliteDatabase } from './database.mjs';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
mkdirSync(new URL('../data/',import.meta.url),{recursive:true});
const database = new SqliteDatabase(fileURLToPath(new URL('../data/zeus.sqlite',import.meta.url)));
const api = new FinanceApi(new FinanceRepository(database),process.env.APP_ORIGIN ?? 'http://localhost:5173');
api.server.listen(Number(process.env.PORT ?? 3001),'127.0.0.1',()=>console.log('ZEUS API: http://127.0.0.1:3001 (SQLite)'));
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => api.server.close(async () => { await database.close(); process.exit(0); }));
