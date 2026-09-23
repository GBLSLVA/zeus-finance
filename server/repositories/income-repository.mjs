import { HttpError } from '../http-error.mjs';
import { cents, dateOnly, normalizeIncome, text, today } from '../domain/finance-values.mjs';

export class IncomeRepository {
  constructor(database) {
    this.database = database;
  }

  fields(data) {
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

      if (activeUntil && activeUntil < activeFrom) {
        throw new HttpError(400, 'A data final não pode ser anterior à data inicial.');
      }

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

  async list(user) {
    const result = await this.database.query(
      'SELECT * FROM incomes WHERE user_id=? ORDER BY CASE type WHEN ? THEN 0 ELSE 1 END, COALESCE(active_from,substr(received_at,1,10)) DESC, id DESC',
      [user, 'salary'],
    );
    return result.recordset.map(normalizeIncome);
  }

  async add(user, data) {
    const fields = this.fields(data);
    const result = await this.database.query(
      'INSERT INTO incomes(user_id,name,type,amount,received_at,recurrence,active_from,active_until,active,updated_at) VALUES(?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP) RETURNING id',
      [user, fields.name, fields.type, fields.amount, fields.receivedAt, fields.recurrence, fields.activeFrom, fields.activeUntil, fields.active],
    );
    return (await this.list(user)).find(row => row.id === result.recordset[0].id);
  }

  async update(user, id, data) {
    const fields = this.fields(data);
    const result = await this.database.query(
      'UPDATE incomes SET name=?,type=?,amount=?,received_at=?,recurrence=?,active_from=?,active_until=?,active=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND id=?',
      [fields.name, fields.type, fields.amount, fields.receivedAt, fields.recurrence, fields.activeFrom, fields.activeUntil, fields.active, user, id],
    );
    if (!result.rowsAffected[0]) throw new HttpError(404, 'Receita não encontrada.');
    return (await this.list(user)).find(row => row.id === id);
  }

  async remove(user, id) {
    const result = await this.database.query(
      'DELETE FROM incomes WHERE user_id=? AND id=?',
      [user,id],
    );
    if (!result.rowsAffected[0]) throw new HttpError(404, 'Receita não encontrada.');
  }
}
