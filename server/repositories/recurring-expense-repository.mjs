import { HttpError } from '../http-error.mjs';
import {
  categories,
  cents,
  dateOnly,
  monthOnly,
  text,
  today,
} from '../domain/finance-values.mjs';
import { normalizeEntry } from './entry-repository.mjs';

export const normalizeRecurringExpense = row => ({
  id: row.id,
  name: row.name,
  category: row.category,
  value: row.amount / 100,
  dueDay: row.due_day,
  activeFrom: row.active_from,
  activeUntil: row.active_until ?? null,
  active: Boolean(row.active ?? 1),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const effectiveEnd = entry =>
  entry.activeUntil ?? (!entry.active ? entry.updatedAt?.slice(0,10) || entry.activeFrom : null);

const monthBounds = monthKey => {
  const [year,month] = monthKey.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year,month,0)).getUTCDate();
  return {
    start:`${monthKey}-01`,
    end:`${monthKey}-${String(lastDay).padStart(2,'0')}`,
  };
};

export class RecurringExpenseRepository {
  constructor(database) {
    this.database = database;
  }

  fields(data) {
    const name = text(data.name);
    const category = text(data.category);
    if (!categories.includes(category)) throw new HttpError(400, 'Categoria inválida.');

    const amount = cents(data.value);
    const dueDay = Number(data.dueDay);
    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
      throw new HttpError(400, 'Dia de vencimento inválido.');
    }

    const activeFrom = dateOnly(data.activeFrom ?? today());
    const active = data.active === false ? 0 : 1;
    const requestedActiveUntil = dateOnly(data.activeUntil,{optional:true});
    const deactivationDate = today();
    const activeUntil = !active && !requestedActiveUntil
      ? (deactivationDate < activeFrom ? activeFrom : deactivationDate)
      : requestedActiveUntil;

    if (activeUntil && activeUntil < activeFrom) {
      throw new HttpError(400, 'A data final não pode ser anterior à data inicial.');
    }

    return {name,category,amount,dueDay,activeFrom,activeUntil,active};
  }

  async list(user) {
    const result = await this.database.query(
      'SELECT * FROM recurring_expenses WHERE user_id=? ORDER BY CASE active WHEN 1 THEN 0 ELSE 1 END,due_day,id DESC',
      [user],
    );
    return result.recordset.map(normalizeRecurringExpense);
  }

  async add(user, data) {
    const fields = this.fields(data);
    const result = await this.database.query(
      'INSERT INTO recurring_expenses(user_id,name,category,amount,due_day,active_from,active_until,active,updated_at) VALUES(?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP) RETURNING id',
      [user,fields.name,fields.category,fields.amount,fields.dueDay,fields.activeFrom,fields.activeUntil,fields.active],
    );
    return (await this.list(user)).find(row => row.id === result.recordset[0].id);
  }

  async update(user, id, data) {
    const fields = this.fields(data);
    const result = await this.database.query(
      'UPDATE recurring_expenses SET name=?,category=?,amount=?,due_day=?,active_from=?,active_until=?,active=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND id=?',
      [fields.name,fields.category,fields.amount,fields.dueDay,fields.activeFrom,fields.activeUntil,fields.active,user,id],
    );
    if (!result.rowsAffected[0]) throw new HttpError(404, 'Gasto recorrente não encontrado.');
    return (await this.list(user)).find(row => row.id === id);
  }

  async remove(user, id) {
    await this.database.transaction(async database => {
      const existing = (await database.query(
        'SELECT id FROM recurring_expenses WHERE user_id=? AND id=?',
        [user,id],
      )).recordset[0];

      if (!existing) throw new HttpError(404, 'Gasto recorrente não encontrado.');

      await database.query(
        'UPDATE entries SET recurring_expense_id=NULL,recurring_month=NULL WHERE user_id=? AND recurring_expense_id=?',
        [user,id],
      );
      await database.query(
        'DELETE FROM recurring_expenses WHERE user_id=? AND id=?',
        [user,id],
      );
    });
  }

  async recordPayment(user, id, data) {
    const monthKey = monthOnly(data.month);

    return this.database.transaction(async database => {
      const lock = database.kind === 'postgres' ? ' FOR UPDATE' : '';
      const row = (await database.query(
        `SELECT * FROM recurring_expenses WHERE user_id=? AND id=?${lock}`,
        [user,id],
      )).recordset[0];

      if (!row) throw new HttpError(404, 'Gasto recorrente não encontrado.');

      const item = normalizeRecurringExpense(row);
      const {start:monthStart,end:monthEnd} = monthBounds(monthKey);
      const activeUntil = effectiveEnd(item);

      if (item.activeFrom > monthEnd || (activeUntil && activeUntil < monthStart)) {
        throw new HttpError(400, 'Este gasto recorrente não está vigente no mês informado.');
      }

      const existing = (await database.query(
        'SELECT id FROM entries WHERE user_id=? AND recurring_expense_id=? AND recurring_month=?',
        [user,id,monthKey],
      )).recordset[0];

      if (existing) {
        throw new HttpError(409, 'Este gasto recorrente já foi registrado como pago neste mês.');
      }

      const lastDay = Number(monthEnd.slice(8,10));
      const scheduledDay = Math.min(item.dueDay,lastDay);
      const scheduledDate = `${monthKey}-${String(scheduledDay).padStart(2,'0')}`;
      const paymentDate = dateOnly(data.paymentDate ?? scheduledDate);

      if (paymentDate.slice(0,7) !== monthKey) {
        throw new HttpError(400, 'A data de pagamento deve pertencer ao mês selecionado.');
      }

      const result = await database.query(
        'INSERT INTO entries(user_id,kind,name,category,amount,saved,transaction_date,updated_at,recurring_expense_id,recurring_month) VALUES(?,?,?,?,?,0,?,CURRENT_TIMESTAMP,?,?) RETURNING id',
        [user,'transactions',item.name,item.category,cents(item.value),paymentDate,id,monthKey],
      );

      const entry = (await database.query(
        'SELECT * FROM entries WHERE user_id=? AND id=?',
        [user,result.recordset[0].id],
      )).recordset[0];

      return normalizeEntry(entry);
    });
  }
}
