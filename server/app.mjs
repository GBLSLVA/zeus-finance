import { createServer } from 'node:http';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { HttpError } from './http-error.mjs';
import { text } from './domain/finance-values.mjs';
import { BudgetRepository } from './repositories/budget-repository.mjs';
import { DebtRepository } from './repositories/debt-repository.mjs';
import { EntryRepository } from './repositories/entry-repository.mjs';
import { IncomeRepository } from './repositories/income-repository.mjs';
import { RecurringExpenseRepository } from './repositories/recurring-expense-repository.mjs';
import { UserRepository } from './repositories/user-repository.mjs';
import { AssistantService } from './services/assistant-service.mjs';
import { DashboardService } from './services/dashboard-service.mjs';
import { ExportService } from './services/export-service.mjs';
import { InsightService } from './services/insight-service.mjs';

export { HttpError } from './http-error.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');
const defaultSessionMaxAgeSeconds = 24 * 60 * 60;
const rememberedSessionMaxAgeSeconds = 30 * 24 * 60 * 60;
const dummyPasswordHash = `${'0'.repeat(32)}:${'0'.repeat(128)}`;

const createPasswordHash = password => {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
};

const verifyPassword = (password, stored) => {
  const [salt, hash] = String(stored ?? dummyPasswordHash).split(':');
  const safeSalt = /^[a-f0-9]{32}$/i.test(salt ?? '') ? salt : '0'.repeat(32);
  const safeHash = /^[a-f0-9]{128}$/i.test(hash ?? '') ? hash : '0'.repeat(128);
  const derived = scryptSync(password, safeSalt, 64);
  const expected = Buffer.from(safeHash, 'hex');
  return expected.length === derived.length && timingSafeEqual(derived, expected);
};
export class FinanceRepository {
  constructor(database) {
    this.db = database;
    this.users = new UserRepository(database);
    this.entries = new EntryRepository(database);
    this.debts = new DebtRepository(database);
    this.budgets = new BudgetRepository(database);
    this.recurring = new RecurringExpenseRepository(database);
    this.incomes = new IncomeRepository(database);

    this.dashboardService = new DashboardService({
      entries:this.entries,
      debts:this.debts,
      incomes:this.incomes,
      budgets:this.budgets,
      recurring:this.recurring,
    });
    this.insightService = new InsightService({
      entries:this.entries,
      debts:this.debts,
      incomes:this.incomes,
      budgets:this.budgets,
    });
    this.assistantService = new AssistantService({
      dashboard:this.dashboardService,
      insights:this.insightService,
    });
    this.exportService = new ExportService(database);
  }

  async dashboard(user, month) {
    return this.dashboardService.get(user,month);
  }

  async assistant(user, data) {
    return this.assistantService.ask(user,data);
  }

  async insights(user, month) {
    return this.insightService.get(user,month);
  }

  async list(user, kind) {
    if (kind === 'debts') return this.debts.list(user);
    return this.entries.list(user,kind);
  }

  async add(user, kind, data) {
    if (kind === 'debts') return this.debts.add(user,data);
    return this.entries.add(user,kind,data);
  }

  async update(user, kind, id, data) {
    if (kind === 'debts') return this.debts.update(user,id,data);
    return this.entries.update(user,kind,id,data);
  }

  async remove(user, kind, id) {
    if (kind === 'debts') return this.debts.remove(user,id);
    return this.entries.remove(user,kind,id);
  }

  async listDebts(user) {
    return this.debts.list(user);
  }

  debtFields(data) {
    return this.debts.fields(data);
  }

  async addDebt(user, data) {
    return this.debts.add(user,data);
  }

  async debtForChange(database, user, id) {
    return this.debts.forChange(database,user,id);
  }

  async updateDebt(user, id, data) {
    return this.debts.update(user,id,data);
  }

  async removeDebt(user, id) {
    return this.debts.remove(user,id);
  }

  async listDebtPayments(user, debtId) {
    return this.debts.listPayments(user,debtId);
  }

  async recalculateDebt(user, debtId, database = this.db) {
    return this.debts.recalculate(user,debtId,database);
  }

  async addDebtPayment(user, debtId, data) {
    return this.debts.addPayment(user,debtId,data);
  }

  async removeDebtPayment(user, debtId, paymentId) {
    return this.debts.removePayment(user,debtId,paymentId);
  }

  async listBudgets(user, month) {
    return this.budgets.list(user,month);
  }

  async upsertBudget(user, data) {
    return this.budgets.upsert(user,data);
  }

  async removeBudget(user, id) {
    return this.budgets.remove(user,id);
  }

  async listRecurringExpenses(user) {
    return this.recurring.list(user);
  }

  recurringExpenseFields(data) {
    return this.recurring.fields(data);
  }

  async addRecurringExpense(user, data) {
    return this.recurring.add(user,data);
  }

  async updateRecurringExpense(user, id, data) {
    return this.recurring.update(user,id,data);
  }

  async removeRecurringExpense(user, id) {
    return this.recurring.remove(user,id);
  }

  async recordRecurringExpensePayment(user, id, data) {
    return this.recurring.recordPayment(user,id,data);
  }

  async exportUserData(user) {
    return this.exportService.export(user);
  }

  async listIncomes(user) {
    return this.incomes.list(user);
  }

  incomeFields(data) {
    return this.incomes.fields(data);
  }

  async addIncome(user, data) {
    return this.incomes.add(user,data);
  }

  async updateIncome(user, id, data) {
    return this.incomes.update(user,id,data);
  }

  async removeIncome(user, id) {
    return this.incomes.remove(user,id);
  }
}

export class AuthService {
  constructor(userRepository) {
    this.users = userRepository?.users ?? userRepository;
    const requiredMethods = [
      'findSessionUser','create','findByEmail','findCredentialsById',
      'purgeExpiredSessions','createSession','updatePasswordAndRevokeOtherSessions',
      'deleteAccount','logout',
    ];
    if (!this.users || requiredMethods.some(method => typeof this.users[method] !== 'function')) {
      throw new TypeError('AuthService requer um repositório de usuários compatível.');
    }
    this.attempts = new Map();
    this.loginWindowMs = 10 * 60 * 1000;
    this.maxLoginFailures = 20;
  }

  attemptKey(address, email) {
    return `${address || 'unknown'}|${email}`;
  }

  pruneAttempts(now) {
    for (const [key, entry] of this.attempts) {
      if (entry.until <= now) this.attempts.delete(key);
    }
  }

  registerFailedLogin(key, now) {
    const previous = this.attempts.get(key);
    const entry = previous && previous.until > now
      ? {count: previous.count + 1, until: previous.until}
      : {count: 1, until: now + this.loginWindowMs};
    this.attempts.set(key, entry);
  }

  async authenticate(token) {
    if (!token) throw new HttpError(401, 'Entre na sua conta.');
    const userId = await this.users.findSessionUser(digest(token), Date.now());
    if (!userId) throw new HttpError(401, 'Sessão expirada.');
    return userId;
  }

  async login(data, register, address) {
    const now = Date.now();
    this.pruneAttempts(now);

    const email = text(data.email, 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'E-mail inválido.');
    if (typeof data.password !== 'string' || data.password.length < 12 || data.password.length > 128) throw new HttpError(400, 'Use uma senha entre 12 e 128 caracteres.');

    const attemptKey = this.attemptKey(address, email);
    const attempts = this.attempts.get(attemptKey);
    if (!register && attempts && attempts.until > now && attempts.count >= this.maxLoginFailures) {
      throw new HttpError(429, 'Muitas tentativas. Aguarde dez minutos.');
    }

    let user;
    if (register) {
      const password = createPasswordHash(data.password);
      user = await this.users.create(email,password);
      if (!user) throw new HttpError(409, 'Não foi possível cadastrar este e-mail.');
    } else {
      user = await this.users.findByEmail(email);
      const valid = verifyPassword(data.password, user?.password);
      if (!user || !valid) {
        this.registerFailedLogin(attemptKey, now);
        throw new HttpError(401, 'E-mail ou senha incorretos.');
      }
      this.attempts.delete(attemptKey);
    }

    const token = randomBytes(32).toString('hex');
    const maxAgeSeconds = data.remember === true ? rememberedSessionMaxAgeSeconds : defaultSessionMaxAgeSeconds;
    await this.users.purgeExpiredSessions(now);
    await this.users.createSession(digest(token),user.id,now+(maxAgeSeconds * 1000));
    return {token, maxAgeSeconds, user: {id:user.id,email:user.email}};
  }

  async changePassword(userId, token, data) {
    if (typeof data.currentPassword !== 'string' || data.currentPassword.length < 12 || data.currentPassword.length > 128) {
      throw new HttpError(400, 'Senha atual inválida.');
    }
    if (typeof data.newPassword !== 'string' || data.newPassword.length < 12 || data.newPassword.length > 128) {
      throw new HttpError(400, 'Use uma nova senha entre 12 e 128 caracteres.');
    }
    if (data.currentPassword === data.newPassword) {
      throw new HttpError(400, 'A nova senha deve ser diferente da senha atual.');
    }

    const user = await this.users.findCredentialsById(userId);
    if (!user || !verifyPassword(data.currentPassword,user.password)) {
      throw new HttpError(400, 'Senha atual incorreta.');
    }

    const nextPassword = createPasswordHash(data.newPassword);
    await this.users.updatePasswordAndRevokeOtherSessions(userId,digest(token),nextPassword);
  }

  async deleteAccount(userId, data) {
    if (typeof data.password !== 'string' || data.password.length < 12 || data.password.length > 128) {
      throw new HttpError(400, 'Senha inválida.');
    }
    if (data.confirmation !== 'EXCLUIR') {
      throw new HttpError(400, 'Digite EXCLUIR para confirmar a remoção da conta.');
    }

    const user = await this.users.findCredentialsById(userId);
    if (!user || !verifyPassword(data.password,user.password)) {
      throw new HttpError(400, 'Senha incorreta.');
    }

    const deleted = await this.users.deleteAccount(userId);
    if (!deleted) throw new HttpError(404, 'Conta não encontrada.');
  }

  async logout(token) { await this.users.logout(digest(token)); }
}

export class FinanceApi {
  constructor(repository, origin = 'http://localhost:5173') {
    this.repository = repository; this.auth = new AuthService(repository.users); this.origin = origin;
    this.server = createServer((req,res) => this.handle(req,res));
  }

  clientAddress(req) {
    if (process.env.TRUST_PROXY === '1') {
      const forwarded = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim();
      if (forwarded) return forwarded;
    }
    return req.socket.remoteAddress ?? 'unknown';
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
    for await (const chunk of req) {
      body += chunk;
      if (Buffer.byteLength(body) > 16384) throw new HttpError(413,'Pedido muito grande.');
    }
    try {
      const data = JSON.parse(body);
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error();
      return data;
    } catch {
      throw new HttpError(400,'JSON inválido.');
    }
  }

  async handle(req,res) {
    const send = (status, data, headers = {}) => {
      const productionHeaders = process.env.NODE_ENV === 'production' ? {
        'Strict-Transport-Security':'max-age=31536000; includeSubDomains',
      } : {};
      res.writeHead(status, {
        'Content-Type':'application/json; charset=utf-8',
        'Cache-Control':'no-store',
        'X-Content-Type-Options':'nosniff',
        'X-Frame-Options':'DENY',
        'Referrer-Policy':'no-referrer',
        'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
        'Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
        ...productionHeaders,
        ...headers,
      });
      res.end(JSON.stringify(data));
    };

    try {
      if (!this.isOriginAllowed(req)) throw new HttpError(403,'Origem não permitida.');
      const url = new URL(req.url, 'http://localhost');
      const path = url.pathname;
      if (path === '/api/health' && req.method === 'GET') {
        try {
          await this.repository.db.query('SELECT 1 AS ok');
          const database = this.repository.db.kind ?? 'unknown';
          return send(200,{
            status:'ok',
            database,
            persistent:database === 'postgres',
            environment:process.env.RENDER === 'true' ? 'render' : (process.env.NODE_ENV ?? 'development'),
            commit:process.env.RENDER_GIT_COMMIT?.slice(0,12) ?? null,
          });
        } catch (error) {
          console.error('Health check database error:', error);
          return send(503,{status:'degraded'});
        }
      }

      const token = /(?:^|;\s*)zeus_session=([a-f0-9]+)/.exec(req.headers.cookie ?? '')?.[1];
      const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';

      if (['/api/register','/api/login'].includes(path) && req.method === 'POST') {
        const result = await this.auth.login(await this.body(req),path === '/api/register',this.clientAddress(req));
        return send(200,result.user,{'Set-Cookie':`zeus_session=${result.token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${result.maxAgeSeconds}${secure}`});
      }

      const user = await this.auth.authenticate(token);
      if (path === '/api/me' && req.method === 'GET') return send(200,await this.repository.users.findPublicById(user));
      if (path === '/api/export' && req.method === 'GET') return send(200,await this.repository.exportUserData(user));
      if (path === '/api/dashboard' && req.method === 'GET') return send(200,await this.repository.dashboard(user,url.searchParams.get('month')));
      if (path === '/api/insights' && req.method === 'GET') return send(200,await this.repository.insights(user,url.searchParams.get('month')));
      if (path === '/api/assistant' && req.method === 'POST') return send(200,await this.repository.assistant(user,await this.body(req)));
      if (path === '/api/logout' && req.method === 'POST') {
        await this.auth.logout(token);
        return send(200,{}, {'Set-Cookie':`zeus_session=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0${secure}`});
      }
      if (path === '/api/change-password' && req.method === 'POST') {
        await this.auth.changePassword(user,token,await this.body(req));
        return send(200,{});
      }
      if (path === '/api/delete-account' && req.method === 'POST') {
        await this.auth.deleteAccount(user,await this.body(req));
        return send(200,{deleted:true},{'Set-Cookie':`zeus_session=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0${secure}`});
      }

      if (path === '/api/budgets') {
        if (req.method === 'GET') return send(200,await this.repository.listBudgets(user,url.searchParams.get('month')));
        if (req.method === 'POST') return send(200,await this.repository.upsertBudget(user,await this.body(req)));
        throw new HttpError(405,'Método não permitido.');
      }

      const recurringPaymentRoute = /^\/api\/recurring-expenses\/(\d+)\/payments$/.exec(path);
      if (recurringPaymentRoute) {
        if (req.method === 'POST') return send(201,await this.repository.recordRecurringExpensePayment(user,Number(recurringPaymentRoute[1]),await this.body(req)));
        throw new HttpError(405,'Método não permitido.');
      }

      const recurringExpenseRoute = /^\/api\/recurring-expenses(?:\/(\d+))?$/.exec(path);
      if (recurringExpenseRoute) {
        const id = recurringExpenseRoute[1] ? Number(recurringExpenseRoute[1]) : null;
        if (req.method === 'GET' && !id) return send(200,await this.repository.listRecurringExpenses(user));
        if (req.method === 'POST' && !id) return send(201,await this.repository.addRecurringExpense(user,await this.body(req)));
        if (req.method === 'PUT' && id) return send(200,await this.repository.updateRecurringExpense(user,id,await this.body(req)));
        if (req.method === 'DELETE' && id) { await this.repository.removeRecurringExpense(user,id); return send(200,{}); }
        throw new HttpError(405,'Método não permitido.');
      }

      const budgetRoute = /^\/api\/budgets\/(\d+)$/.exec(path);
      if (budgetRoute) {
        if (req.method === 'DELETE') { await this.repository.removeBudget(user,Number(budgetRoute[1])); return send(200,{}); }
        throw new HttpError(405,'Método não permitido.');
      }

      const incomeRoute = /^\/api\/incomes(?:\/(\d+))?$/.exec(path);
      if (incomeRoute) {
        const id = incomeRoute[1] ? Number(incomeRoute[1]) : null;
        if (req.method === 'GET' && !id) return send(200,await this.repository.listIncomes(user));
        if (req.method === 'POST' && !id) return send(201,await this.repository.addIncome(user,await this.body(req)));
        if (req.method === 'PUT' && id) return send(200,await this.repository.updateIncome(user,id,await this.body(req)));
        if (req.method === 'DELETE' && id) { await this.repository.removeIncome(user,id); return send(200,{}); }
        throw new HttpError(405,'Método não permitido.');
      }

      const debtPaymentRoute = /^\/api\/debts\/(\d+)\/payments(?:\/(\d+))?$/.exec(path);
      if (debtPaymentRoute) {
        const debtId = Number(debtPaymentRoute[1]);
        const paymentId = debtPaymentRoute[2] ? Number(debtPaymentRoute[2]) : null;
        if (req.method === 'GET' && !paymentId) return send(200,await this.repository.listDebtPayments(user,debtId));
        if (req.method === 'POST' && !paymentId) return send(201,await this.repository.addDebtPayment(user,debtId,await this.body(req)));
        if (req.method === 'DELETE' && paymentId) return send(200,await this.repository.removeDebtPayment(user,debtId,paymentId));
        throw new HttpError(405,'Método não permitido.');
      }

      const route = /^\/api\/(transactions|goals|debts)(?:\/(\d+))?$/.exec(path);
      if (!route) throw new HttpError(404,'Rota não encontrada.');
      const [,kind,idRaw] = route;
      const id = idRaw ? Number(idRaw) : null;
      if (req.method === 'GET' && !id) return send(200,await this.repository.list(user,kind));
      if (req.method === 'POST' && !id) return send(201,await this.repository.add(user,kind,await this.body(req)));
      if (req.method === 'PUT' && id) return send(200,await this.repository.update(user,kind,id,await this.body(req)));
      if (req.method === 'DELETE' && id) { await this.repository.remove(user,kind,id); return send(200,{}); }
      throw new HttpError(405,'Método não permitido.');
    } catch(error) {
      if (!error.status) console.error(error);
      send(error.status ?? 500,{error:error.status ? error.message : 'Erro interno do servidor.'});
    }
  }
}
