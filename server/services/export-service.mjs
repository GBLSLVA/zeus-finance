import { HttpError } from '../http-error.mjs';
import { normalizeBudget, normalizeIncome } from '../domain/finance-values.mjs';
import { normalizeDebt, normalizeDebtPayment } from '../repositories/debt-repository.mjs';
import { normalizeEntry } from '../repositories/entry-repository.mjs';
import { normalizeRecurringExpense } from '../repositories/recurring-expense-repository.mjs';

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


}
