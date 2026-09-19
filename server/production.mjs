import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { FinanceApi, FinanceRepository } from './app.mjs';
import { openDatabase } from './database.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = resolve(root, 'dist');
const localData = resolve(root, 'data');
mkdirSync(localData,{recursive:true});

const database = await openDatabase({sqlitePath:resolve(localData,'zeus.sqlite')});
const api = new FinanceApi(new FinanceRepository(database), process.env.APP_ORIGIN ?? 'same-origin');
const port = Number(process.env.PORT ?? 10000);
const host = '0.0.0.0';

const types = {
  '.html':'text/html; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.svg':'image/svg+xml',
  '.png':'image/png',
  '.jpg':'image/jpeg',
  '.jpeg':'image/jpeg',
  '.webp':'image/webp',
  '.ico':'image/x-icon',
};

const staticHeaders = (path) => ({
  'Content-Type': types[extname(path)] ?? 'application/octet-stream',
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'strict-origin-when-cross-origin',
  'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  'Strict-Transport-Security':'max-age=31536000; includeSubDomains',
  'Cache-Control':path.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable' : 'no-store',
});

async function serve(req,res) {
  const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if (pathname.startsWith('/api/')) {
    await api.handle(req,res);
    return;
  }

  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const requested = resolve(dist, relative);
  const safePrefix = dist.endsWith(sep) ? dist : dist + sep;

  let target = requested;
  if (!(target === dist || target.startsWith(safePrefix))) {
    res.writeHead(400);
    res.end('Requisição inválida');
    return;
  }

  try {
    const info = await stat(target);
    if (info.isDirectory()) target = resolve(target,'index.html');
    const body = await readFile(target);
    res.writeHead(200,staticHeaders(target));
    res.end(body);
  } catch {
    try {
      const index = resolve(dist,'index.html');
      const body = await readFile(index);
      res.writeHead(200,staticHeaders(index));
      res.end(body);
    } catch {
      res.writeHead(503,{'Content-Type':'text/plain; charset=utf-8'});
      res.end('Build de produção não encontrado. Execute npm run build.');
    }
  }
}

const server = createServer((req,res) => { void serve(req,res); });
server.on('error',async error=>{console.error(error);await database.close();process.exitCode=1;});
server.listen(port,host,()=>console.log(`ZEUS Finance produção: http://${host}:${port} (${database.kind})`));

for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>server.close(async()=>{await database.close();process.exit(0);}));
