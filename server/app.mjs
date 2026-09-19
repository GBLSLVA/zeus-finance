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

const dateOnly = (value, {optional = false} = {}) => {
  if ((value === null || value === undefined || value === '') && optional) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new HttpError(400, 'Data inválida.');
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new HttpError(400, 'Data inválida.');
  return value;
};

const digest = value => createHash('sha256').update(value).digest('hex');
const today = () => new Date().toISOString().slice(0, 10);
const categories = ['Casa','Comida','Transporte','Lazer','Outros'];

const monthOnly = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}$/.test(value)) throw new HttpError(400, 'Mês inválido.');
  const [year, month] = value.split('-').map(Number);
  if (year < 2000 || year > 2200 || month < 1 || month > 12) throw new HttpError(400, 'Mês inválido.');
  return value;
};

const normalizeEntry = row => ({
  id: row.id,
  name: row.name,
  category: row.category,
  value: row.amount / 100,
  target: row.amount / 100,
  saved: row.saved / 100,
  transactionDate: row.transaction_date ?? row.created_at?.slice(0, 10),
  createdAt: row.created_at,
  updatedAt: row.updated_at ?? row.created_at,
});

const normalizeIncome = row => ({
  id: row.id,
  name: row.name,
  type: row.type,
  value: row.amount / 100,
  recurrence: row.recurrence ?? (row.type === 'salary' ? 'monthly' : 'once'),
  activeFrom: row.active_from ?? row.received_at?.slice(0, 10),
  activeUntil: row.active_until ?? null,
  active: Boolean(row.active ?? 1),
  receivedAt: row.received_at,
  updatedAt: row.updated_at ?? row.received_at,
});

const normalizeDebt = row => ({
  id: row.id,
  name: row.name,
  category: null,
  value: row.current_balance / 100,
  target: row.original_amount / 100,
  saved: (row.original_amount - row.current_balance) / 100,
  originalAmount: row.original_amount / 100,
  currentBalance: row.current_balance / 100,
  paidAmount: (row.original_amount - row.current_balance) / 100,
  creditor: row.creditor ?? '',
  interestRate: row.interest_rate_bps / 100,
  installmentsTotal: row.installments_total,
  installmentsPaid: row.installments_paid,
  dueDay: row.due_day,
  status: row.status,
  transactionDate: row.created_at?.slice(0, 10),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const normalizeDebtPayment = row => ({
  id: row.id,
  debtId: row.debt_id,
  amount: row.amount / 100,
  paymentDate: row.payment_date,
  note: row.note ?? '',
  countsAsInstallment: Boolean(row.counts_as_installment),
  createdAt: row.created_at,
});

const normalizeBudget = row => ({
  id: row.id,
  month: row.month,
  category: row.category,
  limit: row.limit_amount / 100,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export class FinanceRepository {
  constructor(database) { this.db = database; }

  async list(user, kind) {
    if (kind === 'debts') return this.listDebts(user);
    const result = await this.db.query(
      'SELECT * FROM entries WHERE user_id=? AND kind=? ORDER BY COALESCE(transaction_date,substr(created_at,1,10)) DESC,id DESC',
      [user, kind],
    );
    return result.recordset.map(normalizeEntry);
  }

  async add(user, kind, data) {
    if (kind === 'debts') return this.addDebt(user, data);
    const name = text(data.name);
    const amount = cents(kind === 'goals' ? data.target : data.value);
    const category = kind === 'transactions' ? text(data.category) : null;
    if (category && !categories.includes(category)) throw new HttpError(400, 'Categoria inválida.');
    const saved = kind === 'goals' ? cents(data.saved ?? 0, true) : 0;
    const transactionDate = kind === 'transactions' ? dateOnly(data.transactionDate ?? today()) : null;
    const result = await this.db.query(
      'INSERT INTO entries(user_id,kind,name,category,amount,saved,transaction_date,updated_at) VALUES(?,?,?,?,?,?,?,CURRENT_TIMESTAMP) RETURNING id',
      [user, kind, name, category, amount, saved, transactionDate],
    );
    return (await this.list(user, kind)).find(row => row.id === result.recordset[0].id);
  }

  async update(user, kind, id, data) {
    if (kind === 'debts') return this.updateDebt(user, id, data);
    const name = text(data.name);
    const amount = cents(kind === 'goals' ? data.target : data.value);
    const category = kind === 'transactions' ? text(data.category) : null;
    if (category && !categories.includes(category)) throw new HttpError(400, 'Categoria inválida.');
    const saved = kind === 'goals' ? cents(data.saved ?? 0, true) : 0;
    const transactionDate = kind === 'transactions' ? dateOnly(data.transactionDate ?? today()) : null;
    const result = await this.db.query(
      'UPDATE entries SET name=?,category=?,amount=?,saved=?,transaction_date=COALESCE(?,transaction_date),updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND kind=? AND id=?',
      [name, category, amount, saved, transactionDate, user, kind, id],
    );
    if (!result.rowsAffected[0]) throw new HttpError(404, 'Registro não encontrado.');
    return (await this.list(user, kind)).find(row => row.id === id);
  }

  async remove(user, kind, id) {
    if (kind === 'debts') return this.removeDebt(user, id);
    const result = await this.db.query('DELETE FROM entries WHERE user_id=? AND kind=? AND id=?', [user,kind,id]);
    if (!result.rowsAffected[0]) throw new HttpError(404, 'Registro não encontrado.');
  }

  async listDebts(user) {
    const result = await this.db.query(
      "SELECT * FROM debts WHERE user_id=? ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, current_balance DESC, id DESC",
      [user],
    );
    return result.recordset.map(normalizeDebt);
  }

  debtFields(data) {
    const name = text(data.name);
    const creditor = data.creditor ? text(data.creditor, 120) : null;
    const originalAmount = cents(data.originalAmount ?? data.value);
    const interestRate = Number(data.interestRate ?? 0);
    if (!Number.isFinite(interestRate) || interestRate < 0 || interestRate > 100) throw new HttpError(400, 'Taxa de juros inválida.');
    const installmentsTotal = Number(data.installmentsTotal ?? 0);
    if (!Number.isInteger(installmentsTotal) || installmentsTotal < 0 || installmentsTotal > 600) throw new HttpError(400, 'Quantidade de parcelas inválida.');
    const dueDay = data.dueDay === null || data.dueDay === undefined || data.dueDay === '' ? null : Number(data.dueDay);
    if (dueDay !== null && (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31)) throw new HttpError(400, 'Dia de vencimento inválido.');
    return {
      name,
      creditor,
      originalAmount,
      interestRateBps: Math.round(interestRate * 100),
      installmentsTotal,
      dueDay,
    };
  }

  async addDebt(user, data) {
    const fields = this.debtFields(data);
    const result = await this.db.query(
      "INSERT INTO debts(user_id,name,creditor,original_amount,current_balance,interest_rate_bps,installments_total,installments_paid,due_day,status,updated_at) VALUES(?,?,?,?,?,?,?,0,?,'active',CURRENT_TIMESTAMP) RETURNING id",
      [user, fields.name, fields.creditor, fields.originalAmount, fields.originalAmount, fields.interestRateBps, fields.installmentsTotal, fields.dueDay],
    );
    return (await this.listDebts(user)).find(row => row.id === result.recordset[0].id);
  }

  async updateDebt(user, id, data) {
    const fields = this.debtFields(data);
    const current = (await this.db.query('SELECT * FROM debts WHERE user_id=? AND id=?', [user,id])).recordset[0];
    if (!current) throw new HttpError(404, 'Dívida não encontrada.');
    const paid = (await this.db.query('SELECT COALESCE(SUM(amount),0) AS total FROM debt_payments WHERE user_id=? AND debt_id=?', [user,id])).recordset[0].total;
    if (fields.originalAmount < paid) throw new HttpError(400, 'O valor original não pode ser menor que o total já pago.');
    const currentBalance = fields.originalAmount - paid;
    const status = currentBalance === 0 ? 'paid' : 'active';
    await this.db.query(
      'UPDATE debts SET name=?,creditor=?,original_amount=?,current_balance=?,interest_rate_bps=?,installments_total=?,due_day=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND id=?',
      [fields.name, fields.creditor, fields.originalAmount, currentBalance, fields.interestRateBps, fields.installmentsTotal, fields.dueDay, status, user, id],
    );
    return (await this.listDebts(user)).find(row => row.id === id);
  }

  async removeDebt(user, id) {
    const result = await this.db.query('DELETE FROM debts WHERE user_id=? AND id=?', [user,id]);
    if (!result.rowsAffected[0]) throw new HttpError(404, 'Dívida não encontrada.');
  }

  async listDebtPayments(user, debtId) {
    const debt = (await this.db.query('SELECT id FROM debts WHERE user_id=? AND id=?', [user,debtId])).recordset[0];
    if (!debt) throw new HttpError(404, 'Dívida não encontrada.');
    const result = await this.db.query(
      'SELECT * FROM debt_payments WHERE user_id=? AND debt_id=? ORDER BY payment_date DESC,id DESC',
      [user,debtId],
    );
    return result.recordset.map(normalizeDebtPayment);
  }

  async recalculateDebt(user, debtId) {
    const debt = (await this.db.query('SELECT * FROM debts WHERE user_id=? AND id=?', [user,debtId])).recordset[0];
    if (!debt) throw new HttpError(404, 'Dívida não encontrada.');
    const summary = (await this.db.query(
      'SELECT COALESCE(SUM(amount),0) AS paid, COALESCE(SUM(counts_as_installment),0) AS installments FROM debt_payments WHERE user_id=? AND debt_id=?',
      [user,debtId],
    )).recordset[0];
    const balance = Math.max(0, debt.original_amount - summary.paid);
    const installmentsPaid = debt.installments_total > 0 ? Math.min(debt.installments_total, summary.installments) : summary.installments;
    await this.db.query(
      'UPDATE debts SET current_balance=?,installments_paid=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND id=?',
      [balance, installmentsPaid, balance === 0 ? 'paid' : 'active', user, debtId],
    );
    return (await this.listDebts(user)).find(row => row.id === debtId);
  }

  async addDebtPayment(user, debtId, data) {
    const debt = (await this.db.query('SELECT * FROM debts WHERE user_id=? AND id=?', [user,debtId])).recordset[0];
    if (!debt) throw new HttpError(404, 'Dívida não encontrada.');
    if (debt.current_balance <= 0) throw new HttpError(400, 'Esta dívida já está quitada.');
    const amount = cents(data.amount);
    if (amount > debt.current_balance) throw new HttpError(400, 'O pagamento não pode ser maior que o saldo atual.');
    const paymentDate = dateOnly(data.paymentDate ?? today());
    const note = data.note ? text(data.note, 240) : null;
    const countsAsInstallment = data.countsAsInstallment === false ? 0 : 1;
    const result = await this.db.query(
      'INSERT INTO debt_payments(user_id,debt_id,amount,payment_date,note,counts_as_installment) VALUES(?,?,?,?,?,?) RETURNING id',
      [user,debtId,amount,paymentDate,note,countsAsInstallment],
    );
    const debtAfter = await this.recalculateDebt(user,debtId);
    const payment = (await this.listDebtPayments(user,debtId)).find(row => row.id === result.recordset[0].id);
    return {payment,debt:debtAfter};
  }

  async removeDebtPayment(user, debtId, paymentId) {
    const result = await this.db.query('DELETE FROM debt_payments WHERE user_id=? AND debt_id=? AND id=?', [user,debtId,paymentId]);
    if (!result.rowsAffected[0]) throw new HttpError(404, 'Pagamento não encontrado.');
    return this.recalculateDebt(user,debtId);
  }

  async listBudgets(user, month) {
    const result = await this.db.query(
      'SELECT * FROM budgets WHERE user_id=? AND month=? ORDER BY category,id',
      [user, monthOnly(month)],
    );
    return result.recordset.map(normalizeBudget);
  }

  async upsertBudget(user, data) {
    const month = monthOnly(data.month);
    const category = text(data.category);
    if (!categories.includes(category)) throw new HttpError(400, 'Categoria inválida.');
    const limit = cents(data.limit);
    const result = await this.db.query(
      `INSERT INTO budgets(user_id,month,category,limit_amount,updated_at)
       VALUES(?,?,?,?,CURRENT_TIMESTAMP)
       ON CONFLICT(user_id,month,category)
       DO UPDATE SET limit_amount=excluded.limit_amount,updated_at=CURRENT_TIMESTAMP
       RETURNING id`,
      [user, month, category, limit],
    );
    const budgets = await this.listBudgets(user, month);
    return budgets.find(row => row.id === result.recordset[0].id)
      ?? budgets.find(row => row.category === category);
  }

  async removeBudget(user, id) {
    const result = await this.db.query('DELETE FROM budgets WHERE user_id=? AND id=?', [user,id]);
    if (!result.rowsAffected[0]) throw new HttpError(404, 'Orçamento não encontrado.');
  }

  async listIncomes(user) {
    const result = await this.db.query(
      'SELECT * FROM incomes WHERE user_id=? ORDER BY CASE type WHEN ? THEN 0 ELSE 1 END, COALESCE(active_from,substr(received_at,1,10)) DESC, id DESC',
      [user, 'salary'],
    );
    return result.recordset.map(normalizeIncome);
  }

  incomeFields(data) {
    const name = text(data.name);
    const type = data.type === 'salary' || data.type === 'extra' ? data.type : null;
    if (!type) throw new HttpError(400, 'Tipo de receita inválido.');
    const amount = cents(data.value);
    if (type === 'salary') {
      const activeFrom = dateOnly(data.activeFrom ?? data.receivedAt ?? today());
      const activeUntil = dateOnly(data.activeUntil, {optional:true});
      if (activeUntil && activeUntil < activeFrom) throw new HttpError(400, 'A data final não pode ser anterior à data inicial.');
      return {
        name,
        type,
        amount,
        recurrence: 'monthly',
        activeFrom,
        activeUntil,
        active: data.active === false ? 0 : 1,
        receivedAt: `${activeFrom} 12:00:00`,
      };
    }
    const received = dateOnly(data.receivedAt ?? today());
    return {
      name,
      type,
      amount,
      recurrence: 'once',
      activeFrom: received,
      activeUntil: null,
      active: 1,
      receivedAt: `${received} 12:00:00`,
    };
  }

  async addIncome(user, data) {
    const fields = this.incomeFields(data);
    const result = await this.db.query(
      'INSERT INTO incomes(user_id,name,type,amount,received_at,recurrence,active_from,active_until,active,updated_at) VALUES(?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP) RETURNING id',
      [user, fields.name, fields.type, fields.amount, fields.receivedAt, fields.recurrence, fields.activeFrom, fields.activeUntil, fields.active],
    );
    return (await this.listIncomes(user)).find(row => row.id === result.recordset[0].id);
  }

  async updateIncome(user, id, data) {
    const fields = this.incomeFields(data);
    const result = await this.db.query(
      'UPDATE incomes SET name=?,type=?,amount=?,received_at=?,recurrence=?,active_from=?,active_until=?,active=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND id=?',
      [fields.name, fields.type, fields.amount, fields.receivedAt, fields.recurrence, fields.activeFrom, fields.activeUntil, fields.active, user, id],
    );
    if (!result.rowsAffected[0]) throw new HttpError(404, 'Receita não encontrada.');
    return (await this.listIncomes(user)).find(row => row.id === id);
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
          return send(200,{status:'ok',database:this.repository.db.kind ?? 'unknown'});
        } catch (error) {
          console.error('Health check database error:', error);
          return send(503,{status:'degraded'});
        }
      }

      const token = /(?:^|;\s*)zeus_session=([a-f0-9]+)/.exec(req.headers.cookie ?? '')?.[1];
      const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';

      if (['/api/register','/api/login'].includes(path) && req.method === 'POST') {
        const result = await this.auth.login(await this.body(req),path === '/api/register',this.clientAddress(req));
        return send(200,result.user,{'Set-Cookie':`zeus_session=${result.token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=86400${secure}`});
      }

      const user = await this.auth.authenticate(token);
      if (path === '/api/me' && req.method === 'GET') return send(200,(await this.repository.db.query('SELECT id,email FROM users WHERE id=?', [user])).recordset[0]);
      if (path === '/api/logout' && req.method === 'POST') {
        await this.auth.logout(token);
        return send(200,{}, {'Set-Cookie':`zeus_session=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0${secure}`});
      }

      if (path === '/api/budgets') {
        if (req.method === 'GET') return send(200,await this.repository.listBudgets(user,url.searchParams.get('month')));
        if (req.method === 'POST') return send(200,await this.repository.upsertBudget(user,await this.body(req)));
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
