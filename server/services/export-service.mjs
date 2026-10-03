import { HttpError } from '../http-error.mjs';
import {
  categoryColor,
  defaultCategories,
  cents,
  dateOnly,
  monthOnly,
  normalizeBudget,
  normalizeIncome,
  text,
} from '../domain/finance-values.mjs';
import { normalizeCategory } from '../repositories/category-repository.mjs';
import { normalizeDebt, normalizeDebtPayment } from '../repositories/debt-repository.mjs';
import { normalizeEntry } from '../repositories/entry-repository.mjs';
import { normalizeGoalMovement } from '../repositories/goal-repository.mjs';
import { normalizeRecurringExpense } from '../repositories/recurring-expense-repository.mjs';

const maxBackupRecordsPerSection = 20000;

const requiredArray = (backup, key) => {
  const value = backup[key];
  if (!Array.isArray(value)) throw new HttpError(400,`Backup inválido: seção ${key} ausente.`);
  if (value.length > maxBackupRecordsPerSection) throw new HttpError(400,`Backup inválido: seção ${key} excede o limite permitido.`);
  return value;
};

const positiveId = (value, label) => {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new HttpError(400,`Backup inválido: ${label}.`);
  return id;
};

const optionalText = (value, max = 240) => {
  if (value === null || value === undefined || value === '') return null;
  return text(String(value),max);
};

const strictBoolean = (value, label) => {
  if (typeof value !== 'boolean') throw new HttpError(400,`Backup inválido: ${label}.`);
  return value;
};

const optionalDate = (value, label) => {
  if (value === null || value === undefined || value === '') return null;
  try {
    return dateOnly(value);
  } catch {
    throw new HttpError(400,`Backup inválido: ${label}.`);
  }
};

const uniqueIds = (items, label) => {
  const ids = new Set();
  for (const item of items) {
    if (ids.has(item.sourceId)) throw new HttpError(400,`Backup inválido: ID duplicado em ${label}.`);
    ids.add(item.sourceId);
  }
};

const categoryValue = value => text(value,60);

const validateCategoryList = backup => {
  const source = backup.version === 3
    ? requiredArray(backup,'categories')
    : defaultCategories.map((category,index) => ({
        id:index + 1,
        name:category.name,
        color:category.color,
        isDefault:true,
      }));

  if (!source.length) throw new HttpError(400,'Backup inválido: nenhuma categoria cadastrada.');

  const categories = source.map(item => ({
    sourceId:positiveId(item?.id,'ID de categoria'),
    name:categoryValue(item.name),
    color:categoryColor(item.color),
    isDefault:strictBoolean(item.isDefault,'tipo de categoria'),
  }));
  uniqueIds(categories,'categorias');

  const names = new Set();
  for (const category of categories) {
    const key = category.name.toLocaleLowerCase('pt-BR');
    if (names.has(key)) throw new HttpError(400,'Backup inválido: categoria duplicada.');
    names.add(key);
  }
  return categories;
};

const validateBackup = backup => {
  if (!backup || typeof backup !== 'object' || Array.isArray(backup)) {
    throw new HttpError(400,'Backup inválido.');
  }
  if (
    backup.format !== 'zeus-finance-backup'
    || (backup.version !== 2 && backup.version !== 3)
  ) {
    throw new HttpError(400,'Backup incompatível. Use um backup JSON v2 ou v3 gerado pelo ZEUS.');
  }
  if (typeof backup.exportedAt !== 'string' || Number.isNaN(Date.parse(backup.exportedAt))) {
    throw new HttpError(400,'Backup inválido: data de exportação.');
  }
  const sourceEmail = typeof backup.account?.email === 'string'
    ? text(backup.account.email,254).toLowerCase()
    : null;
  if (!sourceEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sourceEmail)) {
    throw new HttpError(400,'Backup inválido: conta de origem.');
  }

  const backupCategories = validateCategoryList(backup);

  const recurringExpenses = requiredArray(backup,'recurringExpenses').map(item => {
    const sourceId = positiveId(item?.id,'ID de gasto recorrente');
    const activeFrom = dateOnly(item.activeFrom);
    const activeUntil = optionalDate(item.activeUntil,'vigência final de gasto recorrente');
    if (activeUntil && activeUntil < activeFrom) throw new HttpError(400,'Backup inválido: vigência de gasto recorrente.');
    const dueDay = Number(item.dueDay);
    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
      throw new HttpError(400,'Backup inválido: vencimento de gasto recorrente.');
    }
    return {
      sourceId,
      name:text(item.name),
      category:categoryValue(item.category),
      amount:cents(item.value),
      dueDay,
      activeFrom,
      activeUntil,
      active:strictBoolean(item.active,'status de gasto recorrente'),
    };
  });
  uniqueIds(recurringExpenses,'gastos recorrentes');
  const recurringSources = new Set(recurringExpenses.map(item => item.sourceId));

  const transactions = requiredArray(backup,'transactions').map(item => {
    const sourceId = positiveId(item?.id,'ID de gasto');
    const transactionDate = dateOnly(item.transactionDate);
    const hasRecurringId = item.recurringExpenseId !== null
      && item.recurringExpenseId !== undefined
      && item.recurringExpenseId !== '';
    const recurringSourceId = hasRecurringId
      ? positiveId(item.recurringExpenseId,'vínculo de gasto recorrente')
      : null;
    const recurringMonth = recurringSourceId ? monthOnly(item.recurringMonth) : null;
    if (recurringSourceId && !recurringSources.has(recurringSourceId)) {
      throw new HttpError(400,'Backup inválido: gasto vinculado a recorrência inexistente.');
    }
    if (!recurringSourceId && item.recurringMonth) {
      throw new HttpError(400,'Backup inválido: mês recorrente sem recorrência vinculada.');
    }
    if (recurringMonth && transactionDate.slice(0,7) !== recurringMonth) {
      throw new HttpError(400,'Backup inválido: pagamento recorrente fora do mês de referência.');
    }
    return {
      sourceId,
      name:text(item.name),
      category:categoryValue(item.category),
      amount:cents(item.value),
      transactionDate,
      recurringSourceId,
      recurringMonth,
    };
  });
  uniqueIds(transactions,'gastos');
  const recurringPayments = new Set();
  for (const item of transactions) {
    if (!item.recurringSourceId) continue;
    const key = `${item.recurringSourceId}|${item.recurringMonth}`;
    if (recurringPayments.has(key)) throw new HttpError(400,'Backup inválido: pagamento recorrente duplicado.');
    recurringPayments.add(key);
  }

  const goals = requiredArray(backup,'goals').map(item => {
    const target = cents(item.target);
    const saved = cents(item.saved ?? 0,true);
    if (saved > target) throw new HttpError(400,'Backup inválido: meta acima do valor alvo.');
    return {
      sourceId:positiveId(item?.id,'ID de meta'),
      name:text(item.name),
      target,
      saved,
    };
  });
  uniqueIds(goals,'metas');
  const goalBySource = new Map(goals.map(item => [item.sourceId,item]));

  const goalMovements = requiredArray(backup,'goalMovements').map(item => {
    const goalSourceId = positiveId(item?.goalId,'vínculo de movimentação de meta');
    if (!goalBySource.has(goalSourceId)) throw new HttpError(400,'Backup inválido: movimentação vinculada a meta inexistente.');
    const type = ['initial','deposit','withdrawal'].includes(item.type) ? item.type : null;
    if (!type) throw new HttpError(400,'Backup inválido: tipo de movimentação de meta.');
    return {
      sourceId:positiveId(item?.id,'ID de movimentação de meta'),
      goalSourceId,
      type,
      amount:cents(item.amount),
      movementDate:dateOnly(item.movementDate),
      note:optionalText(item.note),
    };
  });
  uniqueIds(goalMovements,'movimentações de metas');

  const goalTotals = new Map(goals.map(item => [item.sourceId,0]));
  for (const movement of goalMovements) {
    const signed = movement.type === 'withdrawal' ? -movement.amount : movement.amount;
    goalTotals.set(movement.goalSourceId,(goalTotals.get(movement.goalSourceId) ?? 0) + signed);
  }
  for (const goal of goals) {
    if ((goalTotals.get(goal.sourceId) ?? 0) !== goal.saved) {
      throw new HttpError(400,`Backup inválido: histórico da meta "${goal.name}" não corresponde ao saldo reservado.`);
    }
  }

  const incomes = requiredArray(backup,'incomes').map(item => {
    const type = item.type === 'salary' || item.type === 'extra' ? item.type : null;
    if (!type) throw new HttpError(400,'Backup inválido: tipo de receita.');
    const active = strictBoolean(item.active,'status de receita');
    if (type === 'salary') {
      const activeFrom = dateOnly(item.activeFrom);
      const activeUntil = optionalDate(item.activeUntil,'vigência final de receita');
      if (activeUntil && activeUntil < activeFrom) throw new HttpError(400,'Backup inválido: vigência de receita.');
      return {
        sourceId:positiveId(item?.id,'ID de receita'),
        name:text(item.name),
        type,
        amount:cents(item.value),
        recurrence:'monthly',
        activeFrom,
        activeUntil,
        active,
        receivedAt:`${activeFrom} 12:00:00`,
      };
    }
    const received = dateOnly(String(item.receivedAt ?? '').slice(0,10));
    return {
      sourceId:positiveId(item?.id,'ID de receita'),
      name:text(item.name),
      type,
      amount:cents(item.value),
      recurrence:'once',
      activeFrom:received,
      activeUntil:null,
      active:true,
      receivedAt:`${received} 12:00:00`,
    };
  });
  uniqueIds(incomes,'receitas');

  const debts = requiredArray(backup,'debts').map(item => {
    const interestRate = Number(item.interestRate ?? 0);
    if (!Number.isFinite(interestRate) || interestRate < 0 || interestRate > 100) {
      throw new HttpError(400,'Backup inválido: taxa de juros.');
    }
    const installmentsTotal = Number(item.installmentsTotal ?? 0);
    if (!Number.isInteger(installmentsTotal) || installmentsTotal < 0 || installmentsTotal > 600) {
      throw new HttpError(400,'Backup inválido: total de parcelas.');
    }
    const dueDay = item.dueDay === null || item.dueDay === undefined || item.dueDay === ''
      ? null
      : Number(item.dueDay);
    if (dueDay !== null && (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31)) {
      throw new HttpError(400,'Backup inválido: vencimento da dívida.');
    }
    return {
      sourceId:positiveId(item?.id,'ID de dívida'),
      name:text(item.name),
      creditor:optionalText(item.creditor,120),
      originalAmount:cents(item.originalAmount),
      expectedBalance:cents(item.currentBalance,true),
      expectedPaid:cents(item.paidAmount ?? 0,true),
      interestRateBps:Math.round(interestRate * 100),
      installmentsTotal,
      expectedInstallmentsPaid:Number(item.installmentsPaid ?? 0),
      dueDay,
      expectedStatus:item.status,
    };
  });
  uniqueIds(debts,'dívidas');
  const debtBySource = new Map(debts.map(item => [item.sourceId,item]));

  const debtPayments = requiredArray(backup,'debtPayments').map(item => {
    const debtSourceId = positiveId(item?.debtId,'vínculo de pagamento de dívida');
    if (!debtBySource.has(debtSourceId)) throw new HttpError(400,'Backup inválido: pagamento vinculado a dívida inexistente.');
    return {
      sourceId:positiveId(item?.id,'ID de pagamento de dívida'),
      debtSourceId,
      amount:cents(item.amount),
      paymentDate:dateOnly(item.paymentDate),
      note:optionalText(item.note),
      countsAsInstallment:strictBoolean(item.countsAsInstallment,'indicador de parcela'),
    };
  });
  uniqueIds(debtPayments,'pagamentos de dívidas');

  const debtPaid = new Map(debts.map(item => [item.sourceId,0]));
  const debtInstallments = new Map(debts.map(item => [item.sourceId,0]));
  for (const payment of debtPayments) {
    debtPaid.set(payment.debtSourceId,(debtPaid.get(payment.debtSourceId) ?? 0) + payment.amount);
    if (payment.countsAsInstallment) {
      debtInstallments.set(payment.debtSourceId,(debtInstallments.get(payment.debtSourceId) ?? 0) + 1);
    }
  }
  for (const debt of debts) {
    const paid = debtPaid.get(debt.sourceId) ?? 0;
    if (paid > debt.originalAmount) throw new HttpError(400,`Backup inválido: pagamentos excedem a dívida "${debt.name}".`);
    const balance = debt.originalAmount - paid;
    const installmentsPaid = debt.installmentsTotal > 0
      ? Math.min(debt.installmentsTotal,debtInstallments.get(debt.sourceId) ?? 0)
      : (debtInstallments.get(debt.sourceId) ?? 0);
    const status = balance === 0 ? 'paid' : 'active';
    if (
      balance !== debt.expectedBalance
      || paid !== debt.expectedPaid
      || installmentsPaid !== debt.expectedInstallmentsPaid
      || status !== debt.expectedStatus
    ) {
      throw new HttpError(400,`Backup inválido: saldo da dívida "${debt.name}" não corresponde ao histórico de pagamentos.`);
    }
    debt.currentBalance = balance;
    debt.installmentsPaid = installmentsPaid;
    debt.status = status;
  }

  const budgets = requiredArray(backup,'budgets').map(item => ({
    sourceId:positiveId(item?.id,'ID de orçamento'),
    month:monthOnly(item.month),
    category:categoryValue(item.category),
    limit:cents(item.limit),
  }));
  uniqueIds(budgets,'orçamentos');
  const budgetKeys = new Set();
  for (const budget of budgets) {
    const key = `${budget.month}|${budget.category}`;
    if (budgetKeys.has(key)) throw new HttpError(400,'Backup inválido: orçamento duplicado no mesmo mês e categoria.');
    budgetKeys.add(key);
  }

  const categoryNames = new Set(
    backupCategories.map(category => category.name.toLocaleLowerCase('pt-BR')),
  );
  const usedCategories = [
    ...transactions.map(item => item.category),
    ...recurringExpenses.map(item => item.category),
    ...budgets.map(item => item.category),
  ];
  for (const name of usedCategories) {
    const key = name.toLocaleLowerCase('pt-BR');
    if (categoryNames.has(key)) continue;
    if (backup.version === 2) {
      backupCategories.push({
        sourceId:backupCategories.length + 1,
        name,
        color:defaultCategories.find(item => item.name === name)?.color ?? '#7ca8ff',
        isDefault:Boolean(defaultCategories.find(item => item.name === name)),
      });
      categoryNames.add(key);
      continue;
    }
    throw new HttpError(400,`Backup inválido: categoria "${name}" não existe na seção de categorias.`);
  }

  return {
    exportedAt:backup.exportedAt,
    sourceEmail,
    categories:backupCategories,
    transactions,
    goals,
    goalMovements,
    incomes,
    debts,
    debtPayments,
    budgets,
    recurringExpenses,
  };
};

export class ExportService {
  constructor(database) {
    this.database = database;
  }

  async export(user) {
    const account = (await this.database.query('SELECT id,email FROM users WHERE id=?', [user])).recordset[0];
    if (!account) throw new HttpError(404, 'Conta não encontrada.');

    const entries = (await this.database.query(
      'SELECT * FROM entries WHERE user_id=? ORDER BY kind,COALESCE(transaction_date,substr(created_at,1,10)) DESC,id DESC',
      [user],
    )).recordset;
    const incomes = (await this.database.query(
      'SELECT * FROM incomes WHERE user_id=? ORDER BY COALESCE(active_from,substr(received_at,1,10)) DESC,id DESC',
      [user],
    )).recordset;
    const debts = (await this.database.query(
      'SELECT * FROM debts WHERE user_id=? ORDER BY id',
      [user],
    )).recordset;
    const debtPayments = (await this.database.query(
      'SELECT * FROM debt_payments WHERE user_id=? ORDER BY payment_date,id',
      [user],
    )).recordset;
    const budgets = (await this.database.query(
      'SELECT * FROM budgets WHERE user_id=? ORDER BY month,category,id',
      [user],
    )).recordset;
    const recurringExpenses = (await this.database.query(
      'SELECT * FROM recurring_expenses WHERE user_id=? ORDER BY due_day,id',
      [user],
    )).recordset;
    const goalMovements = (await this.database.query(
      'SELECT * FROM goal_movements WHERE user_id=? ORDER BY movement_date,id',
      [user],
    )).recordset;

    const categories = (await this.database.query(
      'SELECT * FROM finance_categories WHERE user_id=? ORDER BY is_default DESC,id',
      [user],
    )).recordset;

    return {
      format: 'zeus-finance-backup',
      version: 3,
      exportedAt: new Date().toISOString(),
      account: {email:account.email},
      categories: categories.map(normalizeCategory),
      transactions: entries.filter(row => row.kind === 'transactions').map(normalizeEntry),
      goals: entries.filter(row => row.kind === 'goals').map(normalizeEntry),
      goalMovements: goalMovements.map(normalizeGoalMovement),
      incomes: incomes.map(normalizeIncome),
      debts: debts.map(normalizeDebt),
      debtPayments: debtPayments.map(normalizeDebtPayment),
      budgets: budgets.map(normalizeBudget),
      recurringExpenses: recurringExpenses.map(normalizeRecurringExpense),
    };
  }

  async restore(user, backup) {
    const data = validateBackup(backup);

    return this.database.transaction(async database => {
      const account = (await database.query('SELECT id FROM users WHERE id=?',[user])).recordset[0];
      if (!account) throw new HttpError(404,'Conta não encontrada.');

      await database.query('DELETE FROM debt_payments WHERE user_id=?',[user]);
      await database.query('DELETE FROM debts WHERE user_id=?',[user]);
      await database.query('DELETE FROM goal_movements WHERE user_id=?',[user]);
      await database.query('DELETE FROM entries WHERE user_id=?',[user]);
      await database.query('DELETE FROM budgets WHERE user_id=?',[user]);
      await database.query('DELETE FROM incomes WHERE user_id=?',[user]);
      await database.query('DELETE FROM recurring_expenses WHERE user_id=?',[user]);

      await database.query('DELETE FROM finance_categories WHERE user_id=?',[user]);

      for (const category of data.categories) {
        await database.query(
          'INSERT INTO finance_categories(user_id,name,color,is_default,updated_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP)',
          [user,category.name,category.color,category.isDefault ? 1 : 0],
        );
      }

      const recurringMap = new Map();
      for (const item of data.recurringExpenses) {
        const result = await database.query(
          'INSERT INTO recurring_expenses(user_id,name,category,amount,due_day,active_from,active_until,active,updated_at) VALUES(?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP) RETURNING id',
          [user,item.name,item.category,item.amount,item.dueDay,item.activeFrom,item.activeUntil,item.active ? 1 : 0],
        );
        recurringMap.set(item.sourceId,result.recordset[0].id);
      }

      for (const item of data.incomes) {
        await database.query(
          'INSERT INTO incomes(user_id,name,type,amount,received_at,recurrence,active_from,active_until,active,updated_at) VALUES(?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)',
          [user,item.name,item.type,item.amount,item.receivedAt,item.recurrence,item.activeFrom,item.activeUntil,item.active ? 1 : 0],
        );
      }

      const goalMap = new Map();
      for (const item of data.goals) {
        const result = await database.query(
          "INSERT INTO entries(user_id,kind,name,category,amount,saved,transaction_date,updated_at) VALUES(?,'goals',?,NULL,?,?,NULL,CURRENT_TIMESTAMP) RETURNING id",
          [user,item.name,item.target,item.saved],
        );
        goalMap.set(item.sourceId,result.recordset[0].id);
      }

      for (const movement of data.goalMovements) {
        await database.query(
          'INSERT INTO goal_movements(user_id,goal_id,type,amount,movement_date,note) VALUES(?,?,?,?,?,?)',
          [user,goalMap.get(movement.goalSourceId),movement.type,movement.amount,movement.movementDate,movement.note],
        );
      }

      const debtMap = new Map();
      for (const item of data.debts) {
        const result = await database.query(
          'INSERT INTO debts(user_id,name,creditor,original_amount,current_balance,interest_rate_bps,installments_total,installments_paid,due_day,status,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP) RETURNING id',
          [user,item.name,item.creditor,item.originalAmount,item.currentBalance,item.interestRateBps,item.installmentsTotal,item.installmentsPaid,item.dueDay,item.status],
        );
        debtMap.set(item.sourceId,result.recordset[0].id);
      }

      for (const payment of data.debtPayments) {
        await database.query(
          'INSERT INTO debt_payments(user_id,debt_id,amount,payment_date,note,counts_as_installment) VALUES(?,?,?,?,?,?)',
          [user,debtMap.get(payment.debtSourceId),payment.amount,payment.paymentDate,payment.note,payment.countsAsInstallment ? 1 : 0],
        );
      }

      for (const budget of data.budgets) {
        await database.query(
          'INSERT INTO budgets(user_id,month,category,limit_amount,updated_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP)',
          [user,budget.month,budget.category,budget.limit],
        );
      }

      for (const item of data.transactions) {
        const recurringId = item.recurringSourceId ? recurringMap.get(item.recurringSourceId) : null;
        await database.query(
          'INSERT INTO entries(user_id,kind,name,category,amount,saved,transaction_date,updated_at,recurring_expense_id,recurring_month) VALUES(?,?,?,?,?,0,?,CURRENT_TIMESTAMP,?,?)',
          [user,'transactions',item.name,item.category,item.amount,item.transactionDate,recurringId,item.recurringMonth],
        );
      }

      return {
        restored:true,
        sourceEmail:data.sourceEmail,
        exportedAt:data.exportedAt,
        counts:{
          categories:data.categories.length,
          transactions:data.transactions.length,
          goals:data.goals.length,
          goalMovements:data.goalMovements.length,
          incomes:data.incomes.length,
          debts:data.debts.length,
          debtPayments:data.debtPayments.length,
          budgets:data.budgets.length,
          recurringExpenses:data.recurringExpenses.length,
        },
      };
    });
  }
}
