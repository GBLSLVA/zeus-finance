import { FinanceApi, FinanceRepository } from './app.mjs';
import { openDatabase } from './database.mjs';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

mkdirSync(new URL('../data/',import.meta.url),{recursive:true});
const sqlitePath = fileURLToPath(new URL('../data/zeus.sqlite',import.meta.url));
const database = await openDatabase({sqlitePath});
const api = new FinanceApi(new FinanceRepository(database),process.env.APP_ORIGIN ?? 'http://localhost:5173');
const port = Number(process.env.PORT ?? 3001);
const host = process.env.API_HOST ?? '127.0.0.1';

api.server.listen(port,host,()=>console.log(`ZEUS API: http://${host}:${port} (${database.kind})`));
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => api.server.close(async () => { await database.close(); process.exit(0); }));
