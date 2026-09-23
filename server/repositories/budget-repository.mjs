import { HttpError } from '../http-error.mjs';
import { categories, cents, monthOnly, normalizeBudget, text } from '../domain/finance-values.mjs';

export class BudgetRepository {
  constructor(database) {
    this.database = database;
  }

  async list(user, month) {
    const result = await this.database.query(
      'SELECT * FROM budgets WHERE user_id=? AND month=? ORDER BY category,id',
      [user, monthOnly(month)],
    );
    return result.recordset.map(normalizeBudget);
  }

  async upsert(user, data) {
    const month = monthOnly(data.month);
    const category = text(data.category);
    if (!categories.includes(category)) throw new HttpError(400, 'Categoria inválida.');
    const limit = cents(data.limit);

    const result = await this.database.query(
      `INSERT INTO budgets(user_id,month,category,limit_amount,updated_at)
       VALUES(?,?,?,?,CURRENT_TIMESTAMP)
       ON CONFLICT(user_id,month,category)
       DO UPDATE SET limit_amount=excluded.limit_amount,updated_at=CURRENT_TIMESTAMP
       RETURNING id`,
      [user, month, category, limit],
    );

    const budgets = await this.list(user, month);
    return budgets.find(row => row.id === result.recordset[0].id)
      ?? budgets.find(row => row.category === category);
  }

  async remove(user, id) {
    const result = await this.database.query(
      'DELETE FROM budgets WHERE user_id=? AND id=?',
      [user,id],
    );
    if (!result.rowsAffected[0]) throw new HttpError(404, 'Orçamento não encontrado.');
  }
}
