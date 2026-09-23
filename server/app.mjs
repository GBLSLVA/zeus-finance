import { createServer } from 'node:http';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { HttpError } from './http-error.mjs';
import {
  categories,
  monthOnly,
  normalizeBudget,
  normalizeIncome,
  text,
} from './domain/finance-values.mjs';
import { BudgetRepository } from './repositories/budget-repository.mjs';
import { DebtRepository, normalizeDebt, normalizeDebtPayment } from './repositories/debt-repository.mjs';
import { EntryRepository, normalizeEntry } from './repositories/entry-repository.mjs';
import { IncomeRepository } from './repositories/income-repository.mjs';
import { RecurringExpenseRepository, normalizeRecurringExpense } from './repositories/recurring-expense-repository.mjs';
import { UserRepository } from './repositories/user-repository.mjs';

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

const effectiveRecurringEnd = entry =>
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

export class FinanceRepository {
  constructor(database) {
    this.db = database;
    this.users = new UserRepository(database);
    this.entries = new EntryRepository(database);
    this.debts = new DebtRepository(database);
    this.budgets = new BudgetRepository(database);
    this.recurring = new RecurringExpenseRepository(database);
    this.incomes = new IncomeRepository(database);
  }

  async dashboard(user, month) {
    const monthKey = monthOnly(month);
    const [transactions, debts, goals, incomes, budgets, recurringExpenses] = await Promise.all([
      this.list(user, 'transactions'),
      this.listDebts(user),
      this.list(user, 'goals'),
      this.listIncomes(user),
      this.listBudgets(user, monthKey),
      this.listRecurringExpenses(user),
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
      const paidRecurringIds = new Set(
        monthly
          .filter(entry => entry.recurringExpenseId && entry.recurringMonth === key)
          .map(entry => entry.recurringExpenseId),
      );
      const monthRecurring = recurringExpenses
        .filter(entry => {
          const activeUntil = effectiveRecurringEnd(entry);
          return entry.activeFrom <= monthEnd
            && (!activeUntil || activeUntil >= monthStart);
        })
        .map(entry => {
          const lastDay = Number(monthEnd.slice(8,10));
          const day = Math.min(entry.dueDay,lastDay);
          return {
            ...entry,
            scheduledDate:`${key}-${String(day).padStart(2,'0')}`,
            paid:paidRecurringIds.has(entry.id),
          };
        });
      const recurringTotal = monthRecurring
        .filter(entry => !entry.paid)
        .reduce((total, entry) => total + entry.value, 0);
      const income = salary + extras;
      return {
        monthly,
        spent,
        activeSalaries,
        salary,
        monthlyExtras,
        extras,
        income,
        recurringExpenses:monthRecurring,
        recurringTotal,
        projectedSpent:spent + recurringTotal,
        projectedBalance:income - spent - recurringTotal,
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

    if (/(recorrente|recorrentes|conta fixa|contas fixas|compromisso mensal|compromissos mensais)/.test(normalized)) {
      return respond(
        'recurring-expenses',
        dashboard.recurringTotal > 0
          ? `Você tem ${moneyText(dashboard.recurringTotal)} em compromissos recorrentes ainda pendentes neste mês. Seu saldo projetado, considerando gastos realizados e recorrências pendentes, é ${moneyText(dashboard.projectedBalance)}.`
          : 'Você não possui gastos recorrentes vigentes neste mês.',
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
    const recurringExpenses = (await this.db.query(
      'SELECT * FROM recurring_expenses WHERE user_id=? ORDER BY due_day,id',
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
      recurringExpenses: recurringExpenses.map(normalizeRecurringExpense),
    };
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
