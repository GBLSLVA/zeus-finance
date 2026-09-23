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
const appTimeZone = process.env.APP_TIMEZONE ?? 'America/Sao_Paulo';
const today = () => {
  const parts = new Intl.DateTimeFormat('en-US', {timeZone: appTimeZone, year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(new Date());
  const values = Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};
const categories = ['Casa','Comida','Transporte','Lazer','Outros'];

const monthOnly = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}$/.test(value)) throw new HttpError(400, 'Mês inválido.');
  const [year, month] = value.split('-').map(Number);
  if (year < 2000 || year > 2200 || month < 1 || month > 12) throw new HttpError(400, 'Mês inválido.');
  return value;
};

const shiftMonthKey = (monthKey, offset) => {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};

const monthBounds = monthKey => {
  const [year, month] = monthKey.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    start:`${monthKey}-01`,
    end:`${monthKey}-${String(lastDay).padStart(2,'0')}`,
  };
};

const effectiveIncomeEnd = entry =>
  entry.activeUntil ?? (!entry.active ? entry.updatedAt?.slice(0,10) || entry.activeFrom : null);

const moneyText = value =>
  Number(value).toLocaleString('pt-BR', {style:'currency',currency:'BRL'});

const median = values => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a,b) => a-b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const normalizeInsightName = value =>
  String(value ?? '').trim().toLocaleLowerCase('pt-BR').replace(/\s+/g,' ');

const normalizeQuestion = value =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g,' ')
    .trim();

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

  async dashboard(user, month) {
    const monthKey = monthOnly(month);
    const [transactions, debts, goals, incomes, budgets] = await Promise.all([
      this.list(user, 'transactions'),
      this.listDebts(user),
      this.list(user, 'goals'),
      this.listIncomes(user),
      this.listBudgets(user, monthKey),
    ]);

    const calculateMonth = key => {
      const {start:monthStart,end:monthEnd} = monthBounds(key);
      const belongsToMonth = raw => Boolean(raw && raw.slice(0,7) === key);
      const monthly = transactions.filter(entry => belongsToMonth(entry.transactionDate));
      const spent = monthly.reduce((total, entry) => total + entry.value, 0);
      const activeSalaries = incomes.filter(entry => {
        const activeUntil = effectiveIncomeEnd(entry);
        return entry.type === 'salary'
          && entry.activeFrom <= monthEnd
          && (!activeUntil || activeUntil >= monthStart);
      });
      const salary = activeSalaries.reduce((total, entry) => total + entry.value, 0);
      const monthlyExtras = incomes.filter(entry => entry.type === 'extra' && belongsToMonth(entry.receivedAt));
      const extras = monthlyExtras.reduce((total, entry) => total + entry.value, 0);
      return {
        monthly,
        spent,
        activeSalaries,
        salary,
        monthlyExtras,
        extras,
        income:salary + extras,
      };
    };

    const current = calculateMonth(monthKey);
    const debt = debts.reduce((total, entry) => total + entry.currentBalance, 0);
    const debtOriginal = debts.reduce((total, entry) => total + entry.originalAmount, 0);
    const debtPaid = debts.reduce((total, entry) => total + entry.paidAmount, 0);
    const saved = goals.reduce((total, entry) => total + entry.saved, 0);
    const targets = goals.reduce((total, entry) => total + entry.target, 0);

    const categoriesData = categories.map(category => {
      const total = current.monthly
        .filter(entry => entry.category === category)
        .reduce((sum, entry) => sum + entry.value, 0);
      return {
        category,
        total,
        share:current.spent > 0 ? (total / current.spent) * 100 : 0,
      };
    }).filter(item => item.total > 0);

    const budgetData = categories.map(category => {
      const budget = budgets.find(item => item.category === category) ?? null;
      const categorySpent = current.monthly
        .filter(entry => entry.category === category)
        .reduce((sum, entry) => sum + entry.value, 0);
      const limit = budget?.limit ?? 0;
      return {
        category,
        budget,
        limit,
        spent:categorySpent,
        remaining:limit - categorySpent,
        usage:limit > 0 ? (categorySpent / limit) * 100 : 0,
      };
    });
    const budgetTotal = budgetData.reduce((total, item) => total + item.limit, 0);
    const budgetedSpent = budgetData
      .filter(item => item.limit > 0)
      .reduce((total, item) => total + item.spent, 0);

    const historyData = Array.from({length:6},(_,index) => shiftMonthKey(monthKey,index-5))
      .map(key => {
        const snapshot = calculateMonth(key);
        return {
          monthKey:key,
          income:snapshot.income,
          expenses:snapshot.spent,
          balance:snapshot.income - snapshot.spent,
        };
      });

    return {
      month:monthKey,
      ...current,
      balance:current.income - current.spent,
      debt,
      debtOriginal,
      debtPaid,
      debtProgress:debtOriginal > 0 ? (debtPaid / debtOriginal) * 100 : 0,
      debtMonths:current.income > 0 ? debt / current.income : 0,
      saved,
      targets,
      goalProgress:targets > 0 ? (saved / targets) * 100 : 0,
      categoriesData,
      budgetData,
      budgetTotal,
      budgetedSpent,
      budgetRemaining:budgetTotal - budgetedSpent,
      budgetUsage:budgetTotal > 0 ? (budgetedSpent / budgetTotal) * 100 : 0,
      historyData,
    };
  }

  async assistant(user, data) {
    const question = text(data.question, 300);
    const monthKey = monthOnly(data.month);
    const normalized = normalizeQuestion(question);
    const [dashboard, insights] = await Promise.all([
      this.dashboard(user, monthKey),
      this.insights(user, monthKey),
    ]);

    const suggestions = [
      'Quanto gastei este mês?',
      'Qual foi minha maior categoria de gastos?',
      'Quanto ainda tenho de saldo?',
      'Como estão minhas dívidas?',
      'Como estão minhas metas?',
      'Me dê um resumo do mês.',
    ];

    const respond = (intent, answer) => ({
      month: monthKey,
      question,
      intent,
      answer,
      suggestions,
    });

    const mentionedCategory = categories.find(category =>
      normalized.includes(normalizeQuestion(category)),
    );

    if (mentionedCategory && /(gastei|gasto|gastos|despesa|despesas|quanto)/.test(normalized)) {
      const item = dashboard.categoriesData.find(entry => entry.category === mentionedCategory);
      const total = item?.total ?? 0;
      const share = dashboard.spent > 0 ? (total / dashboard.spent) * 100 : 0;
      return respond(
        'category-spending',
        total > 0
          ? `Você gastou ${moneyText(total)} com ${mentionedCategory} neste mês, equivalente a ${Math.round(share)}% dos gastos do período.`
          : `Não há gastos registrados em ${mentionedCategory} neste mês.`,
      );
    }

    if (/categoria/.test(normalized) && /(mais|maior|principal|lider)/.test(normalized)) {
      const top = [...dashboard.categoriesData].sort((a,b) => b.total - a.total)[0];
      return respond(
        'top-category',
        top
          ? `${top.category} é a categoria com maior gasto: ${moneyText(top.total)}, ou ${Math.round(top.share)}% do total do mês.`
          : 'Ainda não há gastos suficientes para identificar uma categoria principal neste mês.',
      );
    }

    if (/(maior gasto|gasto maior|maior despesa|compra mais cara)/.test(normalized)) {
      const largest = [...dashboard.monthly].sort((a,b) => b.value - a.value)[0];
      return respond(
        'largest-expense',
        largest
          ? `Seu maior gasto registrado no mês é "${largest.name}", no valor de ${moneyText(largest.value)}, na categoria ${largest.category}.`
          : 'Ainda não há gastos registrados neste mês.',
      );
    }

    if (/(saldo|sobrou|sobra|restou|resta)/.test(normalized)) {
      if (dashboard.income <= 0) {
        return respond('balance','Ainda não há renda registrada neste mês, então o saldo completo não pode ser calculado.');
      }
      return respond(
        'balance',
        dashboard.balance >= 0
          ? `Seu saldo após os gastos do mês é ${moneyText(dashboard.balance)}. Entraram ${moneyText(dashboard.income)} e saíram ${moneyText(dashboard.spent)}.`
          : `Seu saldo está negativo em ${moneyText(Math.abs(dashboard.balance))}. Os gastos somam ${moneyText(dashboard.spent)} para uma renda de ${moneyText(dashboard.income)}.`,
      );
    }

    if (/(quanto gastei|gastos|despesas|quanto saiu)/.test(normalized)) {
      return respond(
        'expenses',
        dashboard.spent > 0
          ? `Você gastou ${moneyText(dashboard.spent)} neste mês em ${dashboard.monthly.length} lançamento${dashboard.monthly.length === 1 ? '' : 's'}.`
          : 'Você ainda não registrou gastos neste mês.',
      );
    }

    if (/(quanto recebi|receita|renda|salario|salário|extra)/.test(normalized)) {
      return respond(
        'income',
        dashboard.income > 0
          ? `Sua renda registrada no mês é ${moneyText(dashboard.income)}: ${moneyText(dashboard.salary)} em salário e ${moneyText(dashboard.extras)} em receitas extras.`
          : 'Ainda não há receitas registradas neste mês.',
      );
    }

    if (/divida|dividas/.test(normalized)) {
      return respond(
        'debts',
        dashboard.debtOriginal > 0
          ? `Seu saldo devedor atual é ${moneyText(dashboard.debt)}. Você já quitou ${moneyText(dashboard.debtPaid)}, equivalente a ${Math.round(dashboard.debtProgress)}% do valor original das dívidas.`
          : 'Você não possui dívidas cadastradas no ZEUS.',
      );
    }

    if (/meta|metas|objetivo|objetivos/.test(normalized)) {
      return respond(
        'goals',
        dashboard.targets > 0
          ? `Você já reservou ${moneyText(dashboard.saved)} para metas, equivalente a ${Math.round(dashboard.goalProgress)}% do objetivo total de ${moneyText(dashboard.targets)}.`
          : 'Você ainda não cadastrou metas financeiras.',
      );
    }

    if (/orcamento|orçamento|limite|limites/.test(normalized)) {
      return respond(
        'budget',
        dashboard.budgetTotal > 0
          ? `Seus limites mensais somam ${moneyText(dashboard.budgetTotal)}. Nas categorias orçadas, foram consumidos ${moneyText(dashboard.budgetedSpent)} (${Math.round(dashboard.budgetUsage)}%), restando ${moneyText(dashboard.budgetRemaining)}.`
          : 'Você ainda não definiu limites de orçamento para este mês.',
      );
    }

    if (/(mes passado|mês passado|compar|aumentou|diminuiu|evolucao|evolução)/.test(normalized)) {
      if (insights.previousSpent <= 0) {
        return respond('comparison','Ainda não há gastos no mês anterior suficientes para fazer uma comparação.');
      }
      const change = ((dashboard.spent - insights.previousSpent) / insights.previousSpent) * 100;
      return respond(
        'comparison',
        `Seus gastos estão ${Math.abs(Math.round(change))}% ${change >= 0 ? 'acima' : 'abaixo'} do mês anterior: ${moneyText(dashboard.spent)} agora contra ${moneyText(insights.previousSpent)} antes.`,
      );
    }

    if (/(resumo|resuma|como estou|situacao|situação|panorama|analise|análise)/.test(normalized)) {
      const highlightText = insights.summary.highlights.length
        ? ` ${insights.summary.highlights.join(' ')}`
        : '';
      return respond('summary',`${insights.summary.message}${highlightText}`);
    }

    return respond(
      'help',
      'Posso responder perguntas sobre saldo, receitas, gastos, categorias, orçamento, dívidas, metas e comparação mensal. Tente uma das sugestões abaixo.',
    );
  }

  async insights(user, month) {
    const monthKey = monthOnly(month);
    const previousMonth = shiftMonthKey(monthKey, -1);
    const {start:monthStart,end:monthEnd} = monthBounds(monthKey);

    const [transactions, debts, goals, incomes, budgets] = await Promise.all([
      this.list(user, 'transactions'),
      this.listDebts(user),
      this.list(user, 'goals'),
      this.listIncomes(user),
      this.listBudgets(user, monthKey),
    ]);

    const monthTransactions = transactions.filter(entry => entry.transactionDate?.slice(0, 7) === monthKey);
    const previousTransactions = transactions.filter(entry => entry.transactionDate?.slice(0, 7) === previousMonth);
    const spent = monthTransactions.reduce((total, entry) => total + entry.value, 0);
    const previousSpent = previousTransactions.reduce((total, entry) => total + entry.value, 0);

    const salary = incomes
      .filter(entry => {
        const activeUntil = effectiveIncomeEnd(entry);
        return entry.type === 'salary'
          && entry.activeFrom <= monthEnd
          && (!activeUntil || activeUntil >= monthStart);
      })
      .reduce((total, entry) => total + entry.value, 0);
    const extras = incomes
      .filter(entry => entry.type === 'extra' && entry.receivedAt?.slice(0, 7) === monthKey)
      .reduce((total, entry) => total + entry.value, 0);
    const income = salary + extras;
    const balance = income - spent;

    const categoryTotals = categories.map(category => ({
      category,
      total: monthTransactions
        .filter(entry => entry.category === category)
        .reduce((sum, entry) => sum + entry.value, 0),
    })).sort((a,b) => b.total - a.total);

    const historicalMonthKeys = [
      shiftMonthKey(monthKey, -1),
      shiftMonthKey(monthKey, -2),
      shiftMonthKey(monthKey, -3),
    ];
    const historicalTransactions = transactions.filter(entry =>
      historicalMonthKeys.includes(entry.transactionDate?.slice(0,7)),
    );

    const duplicateGroups = new Map();
    for (const entry of monthTransactions) {
      const key = [
        normalizeInsightName(entry.name),
        entry.category,
        entry.value.toFixed(2),
        entry.transactionDate,
      ].join('|');
      const group = duplicateGroups.get(key) ?? [];
      group.push(entry);
      duplicateGroups.set(key,group);
    }
    const duplicateGroup = [...duplicateGroups.values()]
      .filter(group => group.length > 1)
      .sort((a,b) => (b.length - a.length) || (b[0].value - a[0].value))[0];

    const unusualTransactions = monthTransactions.map(entry => {
      const history = historicalTransactions
        .filter(previous => previous.category === entry.category)
        .map(previous => previous.value);
      const baseline = median(history);
      return {
        entry,
        samples:history.length,
        baseline,
        ratio:baseline > 0 ? entry.value / baseline : 0,
        difference:entry.value - baseline,
      };
    }).filter(item =>
      item.samples >= 3
      && item.baseline > 0
      && item.ratio >= 2.5
      && item.difference >= 50
    ).sort((a,b) => b.ratio - a.ratio);

    const categorySpikes = categories.map(category => {
      const current = categoryTotals.find(item => item.category === category)?.total ?? 0;
      const historicalTotals = historicalMonthKeys.map(key =>
        transactions
          .filter(entry => entry.category === category && entry.transactionDate?.slice(0,7) === key)
          .reduce((sum, entry) => sum + entry.value, 0)
      );
      const monthsWithData = historicalTotals.filter(value => value > 0);
      const baseline = monthsWithData.length
        ? monthsWithData.reduce((sum,value) => sum + value,0) / monthsWithData.length
        : 0;
      return {
        category,
        current,
        samples:monthsWithData.length,
        baseline,
        ratio:baseline > 0 ? current / baseline : 0,
        difference:current - baseline,
      };
    }).filter(item =>
      item.samples >= 2
      && item.baseline > 0
      && item.ratio >= 1.5
      && item.difference >= 50
    ).sort((a,b) => b.ratio - a.ratio);

    const items = [];

    if (duplicateGroup) {
      const entry = duplicateGroup[0];
      items.push({
        id:'possible-duplicate',
        type:'anomaly',
        tone:'warning',
        title:'Possível lançamento duplicado',
        message:`${duplicateGroup.length} lançamentos de "${entry.name}" têm o mesmo valor (${moneyText(entry.value)}) e a mesma data. Vale conferir.`,
        value:duplicateGroup.length,
      });
    }

    const unusual = unusualTransactions[0];
    if (unusual) {
      const above = ((unusual.entry.value - unusual.baseline) / unusual.baseline) * 100;
      items.push({
        id:'unusual-transaction',
        type:'anomaly',
        tone:'warning',
        title:'Gasto fora do seu padrão',
        message:`"${unusual.entry.name}" foi de ${moneyText(unusual.entry.value)}, cerca de ${Math.round(above)}% acima da mediana recente de ${unusual.entry.category} (${moneyText(unusual.baseline)}).`,
        value:above,
      });
    }

    const spike = categorySpikes[0];
    if (spike) {
      const above = ((spike.current - spike.baseline) / spike.baseline) * 100;
      items.push({
        id:'category-spike',
        type:'trend',
        tone:'warning',
        title:`${spike.category} subiu acima do padrão`,
        message:`O total desta categoria está ${Math.round(above)}% acima da média dos meses recentes: ${moneyText(spike.current)} contra ${moneyText(spike.baseline)}.`,
        value:above,
      });
    }

    if (income > 0 && balance < 0) {
      items.push({
        id:'negative-balance',
        type:'balance',
        tone:'warning',
        title:'Gastos acima da renda',
        message:`Os gastos do mês estão ${moneyText(Math.abs(balance))} acima da renda registrada.`,
        value:balance,
      });
    } else if (income > 0) {
      const committed = spent / income * 100;
      items.push({
        id:'income-usage',
        type:'balance',
        tone:committed >= 80 ? 'warning' : 'positive',
        title:committed >= 80 ? 'Renda bastante comprometida' : 'Saldo mensal positivo',
        message:`${Math.round(committed)}% da renda do mês foi consumida por gastos. Saldo atual: ${moneyText(balance)}.`,
        value:committed,
      });
    }

    if (previousSpent > 0) {
      const change = ((spent - previousSpent) / previousSpent) * 100;
      const direction = change >= 0 ? 'aumentaram' : 'diminuíram';
      items.push({
        id:'spending-change',
        type:'comparison',
        tone:change >= 20 ? 'warning' : change <= -10 ? 'positive' : 'info',
        title:'Comparação com o mês anterior',
        message:`Seus gastos ${direction} ${Math.abs(Math.round(change))}% em relação ao mês anterior.`,
        value:change,
      });
    } else if (spent > 0) {
      items.push({
        id:'spending-baseline',
        type:'comparison',
        tone:'info',
        title:'Primeira referência de gastos',
        message:'Ainda não há gastos no mês anterior para fazer uma comparação confiável.',
        value:null,
      });
    }

    const topCategory = categoryTotals.find(item => item.total > 0);
    if (topCategory) {
      const share = spent > 0 ? (topCategory.total / spent) * 100 : 0;
      items.push({
        id:'top-category',
        type:'category',
        tone:share >= 50 ? 'warning' : 'info',
        title:`${topCategory.category} lidera seus gastos`,
        message:`Essa categoria representa ${Math.round(share)}% dos gastos do mês, com ${moneyText(topCategory.total)}.`,
        value:share,
      });
    }

    for (const budget of budgets) {
      const categorySpent = categoryTotals.find(item => item.category === budget.category)?.total ?? 0;
      const usage = budget.limit > 0 ? categorySpent / budget.limit * 100 : 0;
      if (usage >= 100) {
        items.push({
          id:`budget-over-${budget.category}`,
          type:'budget',
          tone:'warning',
          title:`Orçamento de ${budget.category} estourado`,
          message:`O limite foi ultrapassado em ${moneyText(categorySpent - budget.limit)}.`,
          value:usage,
        });
      } else if (usage >= 80) {
        items.push({
          id:`budget-near-${budget.category}`,
          type:'budget',
          tone:'warning',
          title:`Orçamento de ${budget.category} perto do limite`,
          message:`Você já utilizou ${Math.round(usage)}% do limite desta categoria.`,
          value:usage,
        });
      }
    }

    const debtOriginal = debts.reduce((total, entry) => total + entry.originalAmount, 0);
    const debtPaid = debts.reduce((total, entry) => total + entry.paidAmount, 0);
    if (debtOriginal > 0) {
      const progress = debtPaid / debtOriginal * 100;
      items.push({
        id:'debt-progress',
        type:'debt',
        tone:progress >= 50 ? 'positive' : 'info',
        title:'Progresso das dívidas',
        message:`Você já quitou ${Math.round(progress)}% do valor original das dívidas cadastradas.`,
        value:progress,
      });
    }

    const targetTotal = goals.reduce((total, entry) => total + entry.target, 0);
    const savedTotal = goals.reduce((total, entry) => total + entry.saved, 0);
    if (targetTotal > 0) {
      const progress = savedTotal / targetTotal * 100;
      items.push({
        id:'goal-progress',
        type:'goal',
        tone:'positive',
        title:'Evolução das metas',
        message:`Suas metas estão ${Math.round(progress)}% concluídas, com ${moneyText(savedTotal)} reservados.`,
        value:progress,
      });
    }

    if (!items.length) {
      items.push({
        id:'getting-started',
        type:'onboarding',
        tone:'info',
        title:'Comece a formar seu histórico',
        message:'Cadastre receitas, gastos, metas ou orçamentos para o ZEUS gerar análises automáticas.',
        value:null,
      });
    }

    const tonePriority = {warning:0, positive:1, info:2};
    items.sort((a,b) => tonePriority[a.tone] - tonePriority[b.tone]);

    const spendingChange = previousSpent > 0
      ? ((spent - previousSpent) / previousSpent) * 100
      : null;
    const warningCount = items.filter(item => item.tone === 'warning').length;
    const highlights = [];

    if (spendingChange !== null) {
      const direction = spendingChange >= 0 ? 'acima' : 'abaixo';
      highlights.push(`Gastos ${Math.abs(Math.round(spendingChange))}% ${direction} do mês anterior.`);
    } else if (spent > 0) {
      highlights.push('Este mês está formando sua primeira base de comparação.');
    }

    if (topCategory) {
      const share = spent > 0 ? (topCategory.total / spent) * 100 : 0;
      highlights.push(`${topCategory.category} concentra ${Math.round(share)}% dos gastos do mês.`);
    }

    if (warningCount > 0) {
      highlights.push(`${warningCount} ponto${warningCount === 1 ? '' : 's'} de atenção detectado${warningCount === 1 ? '' : 's'} pelo ZEUS.`);
    } else if (income > 0) {
      highlights.push('Nenhum alerta crítico foi detectado nos dados atuais.');
    }

    let summary;
    if (income === 0 && spent === 0) {
      summary = {
        tone:'info',
        title:'Comece a construir seu panorama financeiro',
        message:'Ainda não há movimentação suficiente neste mês. Cadastre receitas e gastos para receber um resumo automático.',
        highlights:[],
      };
    } else if (income > 0 && balance < 0) {
      summary = {
        tone:'warning',
        title:'O mês está com saldo negativo',
        message:`As despesas superam a renda em ${moneyText(Math.abs(balance))}. Revise os maiores gastos e os alertas abaixo.`,
        highlights:highlights.slice(0,3),
      };
    } else if (income > 0 && spent / income >= 0.8) {
      summary = {
        tone:'warning',
        title:'A maior parte da renda já foi comprometida',
        message:`Você utilizou ${Math.round((spent / income) * 100)}% da renda registrada e ainda tem ${moneyText(balance)} de saldo no período.`,
        highlights:highlights.slice(0,3),
      };
    } else if (income > 0) {
      summary = {
        tone:'positive',
        title:'O mês mantém saldo positivo',
        message:`Entraram ${moneyText(income)}, saíram ${moneyText(spent)} e o saldo atual é ${moneyText(balance)}.`,
        highlights:highlights.slice(0,3),
      };
    } else {
      summary = {
        tone:'info',
        title:'Há gastos registrados sem renda no período',
        message:`Foram registrados ${moneyText(spent)} em gastos. Cadastre as receitas do mês para o ZEUS calcular o saldo completo.`,
        highlights:highlights.slice(0,3),
      };
    }

    return {
      month:monthKey,
      income,
      spent,
      balance,
      previousSpent,
      summary,
      items:items.slice(0,8),
    };
  }

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
    if (kind === 'goals' && saved > amount) throw new HttpError(400, 'O valor reservado não pode superar o valor alvo.');
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
    if (kind === 'goals' && saved > amount) throw new HttpError(400, 'O valor reservado não pode superar o valor alvo.');
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

  async debtForChange(database, user, id) {
    const lock = database.kind === 'postgres' ? ' FOR UPDATE' : '';
    return (await database.query(`SELECT * FROM debts WHERE user_id=? AND id=?${lock}`, [user,id])).recordset[0];
  }

  async updateDebt(user, id, data) {
    const fields = this.debtFields(data);
    return this.db.transaction(async database => {
      const current = await this.debtForChange(database,user,id);
      if (!current) throw new HttpError(404, 'Dívida não encontrada.');

      const paid = (await database.query(
        'SELECT COALESCE(SUM(amount),0) AS total FROM debt_payments WHERE user_id=? AND debt_id=?',
        [user,id],
      )).recordset[0].total;
      if (fields.originalAmount < paid) throw new HttpError(400, 'O valor original não pode ser menor que o total já pago.');

      const currentBalance = fields.originalAmount - paid;
      const status = currentBalance === 0 ? 'paid' : 'active';
      await database.query(
        'UPDATE debts SET name=?,creditor=?,original_amount=?,current_balance=?,interest_rate_bps=?,installments_total=?,due_day=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND id=?',
        [fields.name, fields.creditor, fields.originalAmount, currentBalance, fields.interestRateBps, fields.installmentsTotal, fields.dueDay, status, user, id],
      );
      const updated = (await database.query('SELECT * FROM debts WHERE user_id=? AND id=?', [user,id])).recordset[0];
      return normalizeDebt(updated);
    });
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

  async recalculateDebt(user, debtId, database = this.db) {
    const debt = (await database.query('SELECT * FROM debts WHERE user_id=? AND id=?', [user,debtId])).recordset[0];
    if (!debt) throw new HttpError(404, 'Dívida não encontrada.');
    const summary = (await database.query(
      'SELECT COALESCE(SUM(amount),0) AS paid, COALESCE(SUM(counts_as_installment),0) AS installments FROM debt_payments WHERE user_id=? AND debt_id=?',
      [user,debtId],
    )).recordset[0];
    const balance = Math.max(0, debt.original_amount - summary.paid);
    const installmentsPaid = debt.installments_total > 0 ? Math.min(debt.installments_total, summary.installments) : summary.installments;
    await database.query(
      'UPDATE debts SET current_balance=?,installments_paid=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND id=?',
      [balance, installmentsPaid, balance === 0 ? 'paid' : 'active', user, debtId],
    );
    const updated = (await database.query('SELECT * FROM debts WHERE user_id=? AND id=?', [user,debtId])).recordset[0];
    return normalizeDebt(updated);
  }

  async addDebtPayment(user, debtId, data) {
    const amount = cents(data.amount);
    const paymentDate = dateOnly(data.paymentDate ?? today());
    const note = data.note ? text(data.note, 240) : null;
    const countsAsInstallment = data.countsAsInstallment === false ? 0 : 1;

    return this.db.transaction(async database => {
      const debt = await this.debtForChange(database,user,debtId);
      if (!debt) throw new HttpError(404, 'Dívida não encontrada.');
      if (debt.current_balance <= 0) throw new HttpError(400, 'Esta dívida já está quitada.');
      if (amount > debt.current_balance) throw new HttpError(400, 'O pagamento não pode ser maior que o saldo atual.');

      const result = await database.query(
        'INSERT INTO debt_payments(user_id,debt_id,amount,payment_date,note,counts_as_installment) VALUES(?,?,?,?,?,?) RETURNING id',
        [user,debtId,amount,paymentDate,note,countsAsInstallment],
      );
      const debtAfter = await this.recalculateDebt(user,debtId,database);
      const paymentRow = (await database.query(
        'SELECT * FROM debt_payments WHERE user_id=? AND debt_id=? AND id=?',
        [user,debtId,result.recordset[0].id],
      )).recordset[0];
      return {payment:normalizeDebtPayment(paymentRow),debt:debtAfter};
    });
  }

  async removeDebtPayment(user, debtId, paymentId) {
    return this.db.transaction(async database => {
      const debt = await this.debtForChange(database,user,debtId);
      if (!debt) throw new HttpError(404, 'Dívida não encontrada.');
      const result = await database.query(
        'DELETE FROM debt_payments WHERE user_id=? AND debt_id=? AND id=?',
        [user,debtId,paymentId],
      );
      if (!result.rowsAffected[0]) throw new HttpError(404, 'Pagamento não encontrado.');
      return this.recalculateDebt(user,debtId,database);
    });
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

  async exportUserData(user) {
    const account = (await this.db.query('SELECT id,email FROM users WHERE id=?', [user])).recordset[0];
    if (!account) throw new HttpError(404, 'Conta não encontrada.');

    const entries = (await this.db.query(
      'SELECT * FROM entries WHERE user_id=? ORDER BY kind,COALESCE(transaction_date,substr(created_at,1,10)) DESC,id DESC',
      [user],
    )).recordset;
    const incomes = (await this.db.query(
      'SELECT * FROM incomes WHERE user_id=? ORDER BY COALESCE(active_from,substr(received_at,1,10)) DESC,id DESC',
      [user],
    )).recordset;
    const debts = (await this.db.query(
      'SELECT * FROM debts WHERE user_id=? ORDER BY id',
      [user],
    )).recordset;
    const debtPayments = (await this.db.query(
      'SELECT * FROM debt_payments WHERE user_id=? ORDER BY payment_date,id',
      [user],
    )).recordset;
    const budgets = (await this.db.query(
      'SELECT * FROM budgets WHERE user_id=? ORDER BY month,category,id',
      [user],
    )).recordset;

    return {
      format: 'zeus-finance-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      account: {email:account.email},
      transactions: entries.filter(row => row.kind === 'transactions').map(normalizeEntry),
      goals: entries.filter(row => row.kind === 'goals').map(normalizeEntry),
      incomes: incomes.map(normalizeIncome),
      debts: debts.map(normalizeDebt),
      debtPayments: debtPayments.map(normalizeDebtPayment),
      budgets: budgets.map(normalizeBudget),
    };
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
      const active = data.active === false ? 0 : 1;
      const requestedActiveUntil = dateOnly(data.activeUntil, {optional:true});
      const deactivationDate = today();
      const activeUntil = !active && !requestedActiveUntil
        ? (deactivationDate < activeFrom ? activeFrom : deactivationDate)
        : requestedActiveUntil;
      if (activeUntil && activeUntil < activeFrom) throw new HttpError(400, 'A data final não pode ser anterior à data inicial.');
      return {
        name,
        type,
        amount,
        recurrence: 'monthly',
        activeFrom,
        activeUntil,
        active,
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
  constructor(repository) {
    this.db = repository.db;
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
    const session = (await this.db.query('SELECT user_id FROM sessions WHERE token=? AND expires>?', [digest(token), Date.now()])).recordset[0];
    if (!session) throw new HttpError(401, 'Sessão expirada.');
    return session.user_id;
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
      const result = await this.db.query(
        'INSERT INTO users(email,password) VALUES(?,?) ON CONFLICT(email) DO NOTHING RETURNING id',
        [email,password],
      );
      const created = result.recordset[0];
      if (!created) throw new HttpError(409, 'Não foi possível cadastrar este e-mail.');
      user = {id:created.id,email};
    } else {
      user = (await this.db.query('SELECT * FROM users WHERE email=?', [email])).recordset[0];
      const valid = verifyPassword(data.password, user?.password);
      if (!user || !valid) {
        this.registerFailedLogin(attemptKey, now);
        throw new HttpError(401, 'E-mail ou senha incorretos.');
      }
      this.attempts.delete(attemptKey);
    }

    const token = randomBytes(32).toString('hex');
    const maxAgeSeconds = data.remember === true ? rememberedSessionMaxAgeSeconds : defaultSessionMaxAgeSeconds;
    await this.db.query('DELETE FROM sessions WHERE expires<=?', [now]);
    await this.db.query('INSERT INTO sessions(token,user_id,expires) VALUES(?,?,?)', [digest(token),user.id,now+(maxAgeSeconds * 1000)]);
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

    const user = (await this.db.query('SELECT id,password FROM users WHERE id=?', [userId])).recordset[0];
    if (!user || !verifyPassword(data.currentPassword,user.password)) {
      throw new HttpError(400, 'Senha atual incorreta.');
    }

    const nextPassword = createPasswordHash(data.newPassword);
    await this.db.transaction(async database => {
      await database.query('UPDATE users SET password=? WHERE id=?', [nextPassword,userId]);
      await database.query('DELETE FROM sessions WHERE user_id=? AND token<>?', [userId,digest(token)]);
    });
  }

  async deleteAccount(userId, data) {
    if (typeof data.password !== 'string' || data.password.length < 12 || data.password.length > 128) {
      throw new HttpError(400, 'Senha inválida.');
    }
    if (data.confirmation !== 'EXCLUIR') {
      throw new HttpError(400, 'Digite EXCLUIR para confirmar a remoção da conta.');
    }

    const user = (await this.db.query('SELECT id,password FROM users WHERE id=?', [userId])).recordset[0];
    if (!user || !verifyPassword(data.password,user.password)) {
      throw new HttpError(400, 'Senha incorreta.');
    }

    await this.db.transaction(async database => {
      await database.query('DELETE FROM debt_payments WHERE user_id=?', [userId]);
      await database.query('DELETE FROM debts WHERE user_id=?', [userId]);
      await database.query('DELETE FROM budgets WHERE user_id=?', [userId]);
      await database.query('DELETE FROM entries WHERE user_id=?', [userId]);
      await database.query('DELETE FROM incomes WHERE user_id=?', [userId]);
      await database.query('DELETE FROM sessions WHERE user_id=?', [userId]);
      const result = await database.query('DELETE FROM users WHERE id=?', [userId]);
      if (!result.rowsAffected[0]) throw new HttpError(404, 'Conta não encontrada.');
    });
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
      if (path === '/api/me' && req.method === 'GET') return send(200,(await this.repository.db.query('SELECT id,email FROM users WHERE id=?', [user])).recordset[0]);
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
