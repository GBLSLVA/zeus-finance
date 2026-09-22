import { rollup } from 'rollup';
import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import ts from 'typescript';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { FinanceApi, FinanceRepository } from './app.mjs';
import { openDatabase } from './database.mjs';

const root = new URL('../', import.meta.url);
const source = fileURLToPath(new URL('src/main.tsx', root));
console.log('Compilando a prévia React…');
const bundle = await rollup({
  input: source,
  plugins: [
    {name:'preview-typescript',
      transform(code,id) {
        if(id.endsWith('.css')) return {code:'',map:null};
        if(/\.tsx?$/.test(id)) return {code:ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX},fileName:id}).outputText,map:null};
        if(id.includes('node_modules')) return {code:code.replaceAll('process.env.NODE_ENV',JSON.stringify('development')),map:null};
      }
    },
    nodeResolve({browser:true,extensions:['.js','.mjs','.json','.ts','.tsx']}),
    commonjs(),
  ],
});
const {output} = await bundle.generate({format:'es',sourcemap:false});
await bundle.close();
const javascript = output.find(item=>item.type==='chunk'&&item.isEntry).code;
const css = await readFile(new URL('src/styles.css',root),'utf8');
const html = (await readFile(new URL('index.html',root),'utf8')).replace('/src/main.tsx','/assets/app.js').replace('</head>','<link rel="stylesheet" href="/assets/app.css"></head>');
await mkdir(new URL('data/',root),{recursive:true});
const database = await openDatabase({sqlitePath:fileURLToPath(new URL('data/zeus.sqlite',root))});
const port = Number(process.env.PREVIEW_PORT ?? 5173);
const api = new FinanceApi(new FinanceRepository(database),process.env.APP_ORIGIN ?? 'same-origin');
const securityHeaders = {'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','Permissions-Policy':'camera=(), microphone=(), geolocation=()','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"};
const server = createServer((req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  if(path.startsWith('/api/')) { void api.handle(req,res); return; }
  const asset=path==='/'?[html,'text/html']:path==='/assets/app.js'?[javascript,'text/javascript']:path==='/assets/app.css'?[css,'text/css']:null;
  if(!asset){res.writeHead(404);res.end('Não encontrado');return;}
  res.writeHead(200,{...securityHeaders,'Content-Type':`${asset[1]}; charset=utf-8`,'Cache-Control':'no-store'});res.end(asset[0]);
});
server.on('error',async error=>{console.error(error.message);await database.close();process.exitCode=1;});
const host = process.env.PREVIEW_HOST ?? '0.0.0.0';
const lanAddresses = Object.values(networkInterfaces())
  .flatMap(entries => entries ?? [])
  .filter(entry => entry.family === 'IPv4' && !entry.internal)
  .map(entry => entry.address);
server.listen(port,host,()=>{
  const lines = [
    'ZEUS Finance pronto.',
    `Computador: http://localhost:${port}`,
    ...lanAddresses.map(address => `Celular:    http://${address}:${port}`),
    '',
    'Use no celular um dos enderecos acima, conectado a mesma rede Wi-Fi.',
    'Se o Windows perguntar, permita o acesso do Node.js em redes privadas.',
    'Ctrl+C para encerrar.'
  ];
  console.log(lines.join('\n'));
});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(async()=>{await database.close();process.exit(0);}));
