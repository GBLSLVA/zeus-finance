import { categories, monthOnly, text } from '../domain/finance-values.mjs';
import { moneyText, normalizeQuestion } from './finance-service-utils.mjs';

export class AssistantService {
  constructor({dashboard,insights}) {
    this.dashboard = dashboard;
    this.insights = insights;
  }

  async ask(user, data) {
    const question = text(data.question, 300);
    const monthKey = monthOnly(data.month);
    const normalized = normalizeQuestion(question);
    const [dashboard, insights] = await Promise.all([
      this.dashboard.get(user,monthKey),
      this.insights.get(user,monthKey),
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


}
