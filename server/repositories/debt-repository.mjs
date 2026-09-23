import { HttpError } from '../http-error.mjs';
import { cents, dateOnly, text, today } from '../domain/finance-values.mjs';

export const normalizeDebt = row => ({
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
  transactionDate: row.created_at?.slice(0,10),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const normalizeDebtPayment = row => ({
  id: row.id,
  debtId: row.debt_id,
  amount: row.amount / 100,
  paymentDate: row.payment_date,
  note: row.note ?? '',
  countsAsInstallment: Boolean(row.counts_as_installment),
  createdAt: row.created_at,
});

export class DebtRepository {
  constructor(database) {
    this.database = database;
  }

  fields(data) {
    const name = text(data.name);
    const creditor = data.creditor ? text(data.creditor,120) : null;
    const originalAmount = cents(data.originalAmount ?? data.value);
    const interestRate = Number(data.interestRate ?? 0);

    if (!Number.isFinite(interestRate) || interestRate < 0 || interestRate > 100) {
      throw new HttpError(400, 'Taxa de juros inválida.');
    }

    const installmentsTotal = Number(data.installmentsTotal ?? 0);
    if (!Number.isInteger(installmentsTotal) || installmentsTotal < 0 || installmentsTotal > 600) {
      throw new HttpError(400, 'Quantidade de parcelas inválida.');
    }

    const dueDay = data.dueDay === null || data.dueDay === undefined || data.dueDay === ''
      ? null
      : Number(data.dueDay);

    if (dueDay !== null && (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31)) {
      throw new HttpError(400, 'Dia de vencimento inválido.');
    }

    return {
      name,
      creditor,
      originalAmount,
      interestRateBps:Math.round(interestRate * 100),
      installmentsTotal,
      dueDay,
    };
  }

  async list(user) {
    const result = await this.database.query(
      "SELECT * FROM debts WHERE user_id=? ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, current_balance DESC, id DESC",
      [user],
    );
    return result.recordset.map(normalizeDebt);
  }

  async add(user, data) {
    const fields = this.fields(data);
    const result = await this.database.query(
      "INSERT INTO debts(user_id,name,creditor,original_amount,current_balance,interest_rate_bps,installments_total,installments_paid,due_day,status,updated_at) VALUES(?,?,?,?,?,?,?,0,?,'active',CURRENT_TIMESTAMP) RETURNING id",
      [user,fields.name,fields.creditor,fields.originalAmount,fields.originalAmount,fields.interestRateBps,fields.installmentsTotal,fields.dueDay],
    );
    return (await this.list(user)).find(row => row.id === result.recordset[0].id);
  }

  async forChange(database, user, id) {
    const lock = database.kind === 'postgres' ? ' FOR UPDATE' : '';
    return (await database.query(
      `SELECT * FROM debts WHERE user_id=? AND id=?${lock}`,
      [user,id],
    )).recordset[0];
  }

  async update(user, id, data) {
    const fields = this.fields(data);
    return this.database.transaction(async database => {
      const current = await this.forChange(database,user,id);
      if (!current) throw new HttpError(404, 'Dívida não encontrada.');

      const paid = (await database.query(
        'SELECT COALESCE(SUM(amount),0) AS total FROM debt_payments WHERE user_id=? AND debt_id=?',
        [user,id],
      )).recordset[0].total;

      if (fields.originalAmount < paid) {
        throw new HttpError(400, 'O valor original não pode ser menor que o total já pago.');
      }

      const currentBalance = fields.originalAmount - paid;
      const status = currentBalance === 0 ? 'paid' : 'active';
      await database.query(
        'UPDATE debts SET name=?,creditor=?,original_amount=?,current_balance=?,interest_rate_bps=?,installments_total=?,due_day=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND id=?',
        [fields.name,fields.creditor,fields.originalAmount,currentBalance,fields.interestRateBps,fields.installmentsTotal,fields.dueDay,status,user,id],
      );

      const updated = (await database.query(
        'SELECT * FROM debts WHERE user_id=? AND id=?',
        [user,id],
      )).recordset[0];

      return normalizeDebt(updated);
    });
  }

  async remove(user, id) {
    const result = await this.database.query(
      'DELETE FROM debts WHERE user_id=? AND id=?',
      [user,id],
    );
    if (!result.rowsAffected[0]) throw new HttpError(404, 'Dívida não encontrada.');
  }

  async listPayments(user, debtId) {
    const debt = (await this.database.query(
      'SELECT id FROM debts WHERE user_id=? AND id=?',
      [user,debtId],
    )).recordset[0];

    if (!debt) throw new HttpError(404, 'Dívida não encontrada.');

    const result = await this.database.query(
      'SELECT * FROM debt_payments WHERE user_id=? AND debt_id=? ORDER BY payment_date DESC,id DESC',
      [user,debtId],
    );

    return result.recordset.map(normalizeDebtPayment);
  }

  async recalculate(user, debtId, database = this.database) {
    const debt = (await database.query(
      'SELECT * FROM debts WHERE user_id=? AND id=?',
      [user,debtId],
    )).recordset[0];

    if (!debt) throw new HttpError(404, 'Dívida não encontrada.');

    const summary = (await database.query(
      'SELECT COALESCE(SUM(amount),0) AS paid, COALESCE(SUM(counts_as_installment),0) AS installments FROM debt_payments WHERE user_id=? AND debt_id=?',
      [user,debtId],
    )).recordset[0];

    const balance = Math.max(0,debt.original_amount - summary.paid);
    const installmentsPaid = debt.installments_total > 0
      ? Math.min(debt.installments_total,summary.installments)
      : summary.installments;

    await database.query(
      'UPDATE debts SET current_balance=?,installments_paid=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND id=?',
      [balance,installmentsPaid,balance === 0 ? 'paid' : 'active',user,debtId],
    );

    const updated = (await database.query(
      'SELECT * FROM debts WHERE user_id=? AND id=?',
      [user,debtId],
    )).recordset[0];

    return normalizeDebt(updated);
  }

  async addPayment(user, debtId, data) {
    const amount = cents(data.amount);
    const paymentDate = dateOnly(data.paymentDate ?? today());
    const note = data.note ? text(data.note,240) : null;
    const countsAsInstallment = data.countsAsInstallment === false ? 0 : 1;

    return this.database.transaction(async database => {
      const debt = await this.forChange(database,user,debtId);
      if (!debt) throw new HttpError(404, 'Dívida não encontrada.');
      if (debt.current_balance <= 0) throw new HttpError(400, 'Esta dívida já está quitada.');
      if (amount > debt.current_balance) {
        throw new HttpError(400, 'O pagamento não pode ser maior que o saldo atual.');
      }

      const result = await database.query(
        'INSERT INTO debt_payments(user_id,debt_id,amount,payment_date,note,counts_as_installment) VALUES(?,?,?,?,?,?) RETURNING id',
        [user,debtId,amount,paymentDate,note,countsAsInstallment],
      );

      const debtAfter = await this.recalculate(user,debtId,database);
      const paymentRow = (await database.query(
        'SELECT * FROM debt_payments WHERE user_id=? AND debt_id=? AND id=?',
        [user,debtId,result.recordset[0].id],
      )).recordset[0];

      return {payment:normalizeDebtPayment(paymentRow),debt:debtAfter};
    });
  }

  async removePayment(user, debtId, paymentId) {
    return this.database.transaction(async database => {
      const debt = await this.forChange(database,user,debtId);
      if (!debt) throw new HttpError(404, 'Dívida não encontrada.');

      const result = await database.query(
        'DELETE FROM debt_payments WHERE user_id=? AND debt_id=? AND id=?',
        [user,debtId,paymentId],
      );

      if (!result.rowsAffected[0]) throw new HttpError(404, 'Pagamento não encontrado.');
      return this.recalculate(user,debtId,database);
    });
  }
}
