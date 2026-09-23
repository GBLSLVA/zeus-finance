import { HttpError } from '../http-error.mjs';
import { cents, dateOnly, text, today } from '../domain/finance-values.mjs';
import { normalizeEntry } from './entry-repository.mjs';

export const normalizeGoalMovement = row => ({
  id: row.id,
  goalId: row.goal_id,
  type: row.type,
  amount: row.amount / 100,
  movementDate: row.movement_date,
  note: row.note ?? '',
  createdAt: row.created_at,
});

export class GoalRepository {
  constructor(database) {
    this.database = database;
  }

  async list(user) {
    const result = await this.database.query(
      "SELECT * FROM entries WHERE user_id=? AND kind='goals' ORDER BY id DESC",
      [user],
    );
    return result.recordset.map(normalizeEntry);
  }

  async forChange(database, user, id) {
    const lock = database.kind === 'postgres' ? ' FOR UPDATE' : '';
    return (await database.query(
      `SELECT * FROM entries WHERE user_id=? AND kind='goals' AND id=?${lock}`,
      [user,id],
    )).recordset[0] ?? null;
  }

  async add(user, data) {
    const name = text(data.name);
    const target = cents(data.target ?? data.value);
    const saved = cents(data.saved ?? 0, true);
    if (saved > target) throw new HttpError(400, 'O valor reservado não pode superar o valor alvo.');

    return this.database.transaction(async database => {
      const result = await database.query(
        "INSERT INTO entries(user_id,kind,name,category,amount,saved,transaction_date,updated_at) VALUES(?,'goals',?,NULL,?,?,NULL,CURRENT_TIMESTAMP) RETURNING id",
        [user,name,target,saved],
      );
      const id = result.recordset[0].id;

      if (saved > 0) {
        await database.query(
          "INSERT INTO goal_movements(user_id,goal_id,type,amount,movement_date,note) VALUES(?,?,'initial',?,?,?)",
          [user,id,saved,today(),'Saldo inicial'],
        );
      }

      const row = (await database.query(
        "SELECT * FROM entries WHERE user_id=? AND kind='goals' AND id=?",
        [user,id],
      )).recordset[0];
      return normalizeEntry(row);
    });
  }

  async update(user, id, data) {
    const name = text(data.name);
    const target = cents(data.target ?? data.value);

    return this.database.transaction(async database => {
      const current = await this.forChange(database,user,id);
      if (!current) throw new HttpError(404, 'Meta não encontrada.');
      if (target < current.saved) {
        throw new HttpError(400, 'O valor alvo não pode ser menor que o total já reservado.');
      }

      await database.query(
        "UPDATE entries SET name=?,amount=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND kind='goals' AND id=?",
        [name,target,user,id],
      );
      const updated = (await database.query(
        "SELECT * FROM entries WHERE user_id=? AND kind='goals' AND id=?",
        [user,id],
      )).recordset[0];
      return normalizeEntry(updated);
    });
  }

  async remove(user, id) {
    const result = await this.database.query(
      "DELETE FROM entries WHERE user_id=? AND kind='goals' AND id=?",
      [user,id],
    );
    if (!result.rowsAffected[0]) throw new HttpError(404, 'Meta não encontrada.');
  }

  async listMovements(user, goalId) {
    const goal = (await this.database.query(
      "SELECT id FROM entries WHERE user_id=? AND kind='goals' AND id=?",
      [user,goalId],
    )).recordset[0];
    if (!goal) throw new HttpError(404, 'Meta não encontrada.');

    const result = await this.database.query(
      'SELECT * FROM goal_movements WHERE user_id=? AND goal_id=? ORDER BY movement_date DESC,id DESC',
      [user,goalId],
    );
    return result.recordset.map(normalizeGoalMovement);
  }

  async addMovement(user, goalId, data) {
    const type = data.type === 'deposit' || data.type === 'withdrawal' ? data.type : null;
    if (!type) throw new HttpError(400, 'Tipo de movimentação inválido.');

    const amount = cents(data.amount);
    const movementDate = dateOnly(data.movementDate ?? today());
    const note = data.note ? text(data.note,240) : null;

    return this.database.transaction(async database => {
      const goal = await this.forChange(database,user,goalId);
      if (!goal) throw new HttpError(404, 'Meta não encontrada.');

      const nextSaved = type === 'deposit'
        ? goal.saved + amount
        : goal.saved - amount;

      if (nextSaved < 0) {
        throw new HttpError(400, 'A retirada não pode ser maior que o valor reservado.');
      }
      if (nextSaved > goal.amount) {
        throw new HttpError(400, 'O aporte não pode fazer a meta ultrapassar o valor alvo.');
      }

      const result = await database.query(
        'INSERT INTO goal_movements(user_id,goal_id,type,amount,movement_date,note) VALUES(?,?,?,?,?,?) RETURNING id',
        [user,goalId,type,amount,movementDate,note],
      );
      await database.query(
        "UPDATE entries SET saved=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND kind='goals' AND id=?",
        [nextSaved,user,goalId],
      );

      const movementRow = (await database.query(
        'SELECT * FROM goal_movements WHERE user_id=? AND goal_id=? AND id=?',
        [user,goalId,result.recordset[0].id],
      )).recordset[0];
      const goalRow = (await database.query(
        "SELECT * FROM entries WHERE user_id=? AND kind='goals' AND id=?",
        [user,goalId],
      )).recordset[0];

      return {
        movement:normalizeGoalMovement(movementRow),
        goal:normalizeEntry(goalRow),
      };
    });
  }

  async removeMovement(user, goalId, movementId) {
    return this.database.transaction(async database => {
      const goal = await this.forChange(database,user,goalId);
      if (!goal) throw new HttpError(404, 'Meta não encontrada.');

      const movement = (await database.query(
        'SELECT * FROM goal_movements WHERE user_id=? AND goal_id=? AND id=?',
        [user,goalId,movementId],
      )).recordset[0];
      if (!movement) throw new HttpError(404, 'Movimentação não encontrada.');

      await database.query(
        'DELETE FROM goal_movements WHERE user_id=? AND goal_id=? AND id=?',
        [user,goalId,movementId],
      );

      const summary = (await database.query(
        `SELECT COALESCE(SUM(
          CASE type WHEN 'withdrawal' THEN -amount ELSE amount END
        ),0) AS saved
        FROM goal_movements
        WHERE user_id=? AND goal_id=?`,
        [user,goalId],
      )).recordset[0];

      const nextSaved = Number(summary.saved ?? 0);
      if (nextSaved < 0 || nextSaved > goal.amount) {
        throw new HttpError(409, 'A remoção deixaria o saldo da meta inconsistente.');
      }

      await database.query(
        "UPDATE entries SET saved=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND kind='goals' AND id=?",
        [nextSaved,user,goalId],
      );
      const updated = (await database.query(
        "SELECT * FROM entries WHERE user_id=? AND kind='goals' AND id=?",
        [user,goalId],
      )).recordset[0];
      return normalizeEntry(updated);
    });
  }
}
