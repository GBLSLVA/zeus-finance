import { HttpError } from '../http-error.mjs';
import { categories, cents, dateOnly, text, today } from '../domain/finance-values.mjs';

export const normalizeEntry = row => ({
  id: row.id,
  name: row.name,
  category: row.category,
  value: row.amount / 100,
  target: row.amount / 100,
  saved: row.saved / 100,
  transactionDate: row.transaction_date ?? row.created_at?.slice(0, 10),
  createdAt: row.created_at,
  updatedAt: row.updated_at ?? row.created_at,
  recurringExpenseId: row.recurring_expense_id ?? null,
  recurringMonth: row.recurring_month ?? null,
});

export class EntryRepository {
  constructor(database) {
    this.database = database;
  }

  assertKind(kind) {
    if (kind !== 'transactions' && kind !== 'goals') {
      throw new HttpError(400, 'Tipo de registro inválido.');
    }
  }

  fields(kind, data) {
    this.assertKind(kind);
    const name = text(data.name);
    const amount = cents(kind === 'goals' ? data.target : data.value);
    const category = kind === 'transactions' ? text(data.category) : null;

    if (category && !categories.includes(category)) {
      throw new HttpError(400, 'Categoria inválida.');
    }

    const saved = kind === 'goals' ? cents(data.saved ?? 0, true) : 0;
    if (kind === 'goals' && saved > amount) {
      throw new HttpError(400, 'O valor reservado não pode superar o valor alvo.');
    }

    const transactionDate = kind === 'transactions'
      ? dateOnly(data.transactionDate ?? today())
      : null;

    return {name, amount, category, saved, transactionDate};
  }

  async list(user, kind) {
    this.assertKind(kind);
    const result = await this.database.query(
      'SELECT * FROM entries WHERE user_id=? AND kind=? ORDER BY COALESCE(transaction_date,substr(created_at,1,10)) DESC,id DESC',
      [user,kind],
    );
    return result.recordset.map(normalizeEntry);
  }

  async add(user, kind, data) {
    const fields = this.fields(kind,data);
    const result = await this.database.query(
      'INSERT INTO entries(user_id,kind,name,category,amount,saved,transaction_date,updated_at) VALUES(?,?,?,?,?,?,?,CURRENT_TIMESTAMP) RETURNING id',
      [user,kind,fields.name,fields.category,fields.amount,fields.saved,fields.transactionDate],
    );
    return (await this.list(user,kind)).find(row => row.id === result.recordset[0].id);
  }

  async update(user, kind, id, data) {
    const fields = this.fields(kind,data);
    const result = await this.database.query(
      'UPDATE entries SET name=?,category=?,amount=?,saved=?,transaction_date=COALESCE(?,transaction_date),updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND kind=? AND id=?',
      [fields.name,fields.category,fields.amount,fields.saved,fields.transactionDate,user,kind,id],
    );
    if (!result.rowsAffected[0]) throw new HttpError(404, 'Registro não encontrado.');
    return (await this.list(user,kind)).find(row => row.id === id);
  }

  async remove(user, kind, id) {
    this.assertKind(kind);
    const result = await this.database.query(
      'DELETE FROM entries WHERE user_id=? AND kind=? AND id=?',
      [user,kind,id],
    );
    if (!result.rowsAffected[0]) throw new HttpError(404, 'Registro não encontrado.');
  }
}
