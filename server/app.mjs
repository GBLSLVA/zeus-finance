import { createServer } from 'node:http';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const text = (value, max = 120) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new HttpError(400, 'Texto inválido.');
  return value.trim();
};
const cents = (value, allowZero = false) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < (allowZero ? 0 : 0.01) || value > 100000000) throw new HttpError(400, 'Valor inválido.');
  return Math.round(value * 100);
};
const digest = value => createHash('sha256').update(value).digest('hex');

export class FinanceRepository {
  constructor(database) { this.db = database; }

  async list(user, kind) {
    return (await this.db.query('SELECT * FROM entries WHERE user_id=? AND kind=? ORDER BY id DESC', [user, kind])).recordset.map(row => ({id: row.id, name: row.name, category: row.category, value: row.amount / 100, target: row.amount / 100, saved: row.saved / 100, color: '#00d4a6', createdAt: row.created_at}));
  }
  async add(user, kind, data) {
    const name = text(data.name);
    const amount = cents(kind === 'goals' ? data.target : data.value);
    const category = kind === 'transactions' ? text(data.category) : null;
    if (category && !['Casa','Comida','Transporte','Lazer','Outros'].includes(category)) throw new HttpError(400, 'Categoria inválida.');
    const saved = kind === 'goals' ? cents(data.saved ?? 0, true) : 0;
    const result = await this.db.query('INSERT INTO entries(user_id,kind,name,category,amount,saved) VALUES(?,?,?,?,?,?) RETURNING id', [user, kind, name, category, amount, saved]);
    return (await this.list(user, kind)).find(row => row.id === result.recordset[0].id);
  }
  async remove(user, kind, id) {
    const result = await this.db.query('DELETE FROM entries WHERE user_id=? AND kind=? AND id=?', [user,kind,id]);
    if (!result.rowsAffected[0]) throw new HttpError(404, 'Registro não encontrado.');
  }
  async listIncomes(user) {
    return (await this.db.query('SELECT * FROM incomes WHERE user_id=? ORDER BY CASE type WHEN ? THEN 0 ELSE 1 END, received_at DESC, id DESC', [user, 'salary'])).recordset.map(row => ({
      id: row.id,
      name: row.name,
      type: row.type,
      value: row.amount / 100,
      receivedAt: row.received_at,
    }));
  }
  async addIncome(user, data) {
    const name = text(data.name);
    const type = data.type === 'salary' || data.type === 'extra' ? data.type : null;
    if (!type) throw new HttpError(400, 'Tipo de receita inválido.');
    const amount = cents(data.value);
    const fallbackDate = new Date().toISOString().slice(0, 10);
    const date = typeof data.receivedAt === 'string' && data.receivedAt ? data.receivedAt : fallbackDate;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T12:00:00Z`))) throw new HttpError(400, 'Data inválida.');
    const receivedAt = `${date} 12:00:00`;
    const result = await this.db.query('INSERT INTO incomes(user_id,name,type,amount,received_at) VALUES(?,?,?,?,?) RETURNING id', [user, name, type, amount, receivedAt]);
    return (await this.listIncomes(user)).find(row => row.id === result.recordset[0].id);
  }
  async removeIncome(user, id) {
    const result = await this.db.query('DELETE FROM incomes WHERE user_id=? AND id=?', [user, id]);
    if (!result.rowsAffected[0]) throw new HttpError(404, 'Receita não encontrada.');
  }
}

export class AuthService {
  constructor(repository) { this.db = repository.db; this.attempts = new Map(); }
  async authenticate(token) {
    if (!token) throw new HttpError(401, 'Entre na sua conta.');
    const session = (await this.db.query('SELECT user_id FROM sessions WHERE token=? AND expires>?', [digest(token), Date.now()])).recordset[0];
    if (!session) throw new HttpError(401, 'Sessão expirada.');
    return session.user_id;
  }
  async login(data, register, address) {
    const now = Date.now();
    for (const [key, entry] of this.attempts) if (entry.until < now) this.attempts.delete(key);
    const attempts = this.attempts.get(address) ?? {count: 0, until: now + 600000};
    if (++attempts.count > 20) throw new HttpError(429, 'Muitas tentativas. Aguarde dez minutos.');
    this.attempts.set(address, attempts);
    const email = text(data.email, 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'E-mail inválido.');
    if (typeof data.password !== 'string' || data.password.length < 12 || data.password.length > 128) throw new HttpError(400, 'Use uma senha entre 12 e 128 caracteres.');
    let user = (await this.db.query('SELECT * FROM users WHERE email=?', [email])).recordset[0];
    if (register) {
      if (user) throw new HttpError(409, 'Não foi possível cadastrar este e-mail.');
      const salt = randomBytes(16).toString('hex');
      const hash = scryptSync(data.password, salt, 64).toString('hex');
      const result = await this.db.query('INSERT INTO users(email,password) VALUES(?,?) RETURNING id', [email, `${salt}:${hash}`]);
      user = {id: result.recordset[0].id, email};
    } else {
      const [salt, hash] = (user?.password ?? `${'0'.repeat(32)}:${'0'.repeat(128)}`).split(':');
      const valid = timingSafeEqual(scryptSync(data.password, salt, 64), Buffer.from(hash, 'hex'));
      if (!user || !valid) throw new HttpError(401, 'E-mail ou senha incorretos.');
    }
    const token = randomBytes(32).toString('hex');
    await this.db.query('DELETE FROM sessions WHERE expires<=?', [now]);
    await this.db.query('INSERT INTO sessions(token,user_id,expires) VALUES(?,?,?)', [digest(token),user.id,now+86400000]);
    return {token, user: {id:user.id,email:user.email}};
  }
  async logout(token) { await this.db.query('DELETE FROM sessions WHERE token=?', [digest(token)]); }
}

export class FinanceApi {
  constructor(repository, origin = 'http://localhost:5173') {
    this.repository = repository; this.auth = new AuthService(repository); this.origin = origin;
    this.server = createServer((req,res) => this.handle(req,res));
  }
  isOriginAllowed(req) {
    const origin = req.headers.origin;
    if (!origin) return true;
    if (this.origin === 'same-origin') {
      const forwarded = String(req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim();
      const protocol = forwarded || (req.socket.encrypted ? 'https' : 'http');
      return Boolean(req.headers.host) && origin === `${protocol}://${req.headers.host}`;
    }
    if (Array.isArray(this.origin)) return this.origin.includes(origin);
    return origin === this.origin;
  }
  async body(req) {
    let body = '';
    for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 16384) throw new HttpError(413,'Pedido muito grande.'); }
    try { const data = JSON.parse(body); if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error(); return data; }
    catch { throw new HttpError(400,'JSON inválido.'); }
  }
  async handle(req,res) {
    const send = (status, data, headers = {}) => { res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}); res.end(JSON.stringify(data)); };
    try {
      if (!this.isOriginAllowed(req)) throw new HttpError(403,'Origem não permitida.');
      const path = new URL(req.url, 'http://localhost').pathname;
      if (path === '/api/health' && req.method === 'GET') return send(200,{status:'ok'});
      const token = /(?:^|;\s*)zeus_session=([a-f0-9]+)/.exec(req.headers.cookie ?? '')?.[1];
      const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
      if (['/api/register','/api/login'].includes(path) && req.method === 'POST') {
        const result = await this.auth.login(await this.body(req),path === '/api/register',req.socket.remoteAddress);
        return send(200,result.user,{'Set-Cookie':`zeus_session=${result.token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=86400${secure}`});
      }
      const user = await this.auth.authenticate(token);
      if (path === '/api/me' && req.method === 'GET') return send(200,(await this.repository.db.query('SELECT id,email FROM users WHERE id=?', [user])).recordset[0]);
      if (path === '/api/logout' && req.method === 'POST') { await this.auth.logout(token); return send(200,{}, {'Set-Cookie':`zeus_session=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0${secure}`}); }
      const incomeRoute = /^\/api\/incomes(?:\/(\d+))?$/.exec(path);
      if (incomeRoute) {
        const id = incomeRoute[1];
        if (req.method === 'GET' && !id) return send(200,await this.repository.listIncomes(user));
        if (req.method === 'POST' && !id) return send(201,await this.repository.addIncome(user,await this.body(req)));
        if (req.method === 'DELETE' && id) { await this.repository.removeIncome(user,Number(id)); return send(200,{}); }
        throw new HttpError(405,'Método não permitido.');
      }
      const route = /^\/api\/(transactions|goals|debts)(?:\/(\d+))?$/.exec(path);
      if (!route) throw new HttpError(404,'Rota não encontrada.');
      const [,kind,id] = route;
      if (req.method === 'GET' && !id) return send(200,await this.repository.list(user,kind));
      if (req.method === 'POST' && !id) return send(201,await this.repository.add(user,kind,await this.body(req)));
      if (req.method === 'DELETE' && id) { await this.repository.remove(user,kind,Number(id)); return send(200,{}); }
      throw new HttpError(405,'Método não permitido.');
    } catch(error) { if (!error.status) console.error(error); send(error.status ?? 500,{error:error.status ? error.message : 'Erro interno do servidor.'}); }
  }
}
