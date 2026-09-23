import { categories, monthOnly } from '../domain/finance-values.mjs';
import {
  effectiveIncomeEnd,
  median,
  moneyText,
  monthBounds,
  normalizeInsightName,
  shiftMonthKey,
} from './finance-service-utils.mjs';

export class InsightService {
  constructor({entries,goals,debts,incomes,budgets}) {
    this.entries = entries;
    this.goals = goals;
    this.debts = debts;
    this.incomes = incomes;
    this.budgets = budgets;
  }

  async get(user, month) {
    const monthKey = monthOnly(month);
    const previousMonth = shiftMonthKey(monthKey, -1);
    const {start:monthStart,end:monthEnd} = monthBounds(monthKey);

    const [transactions, debts, goals, incomes, budgets] = await Promise.all([
      this.entries.list(user,'transactions'),
      this.debts.list(user),
      this.goals.list(user),
      this.incomes.list(user),
      this.budgets.list(user,monthKey),
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


}
