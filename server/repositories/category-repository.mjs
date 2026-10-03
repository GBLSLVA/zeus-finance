import { HttpError } from '../http-error.mjs';
import { categoryColor, defaultCategories, text } from '../domain/finance-values.mjs';

export const normalizeCategory = row => ({
  id:row.id,
  name:row.name,
  color:row.color,
  isDefault:Boolean(row.is_default),
  createdAt:row.created_at,
  updatedAt:row.updated_at,
});

export class CategoryRepository {
  constructor(database) {
    this.database = database;
  }

  async ensureDefaults(user, database = this.database) {
    for (const category of defaultCategories) {
      await database.query(
        `INSERT INTO finance_categories(user_id,name,color,is_default,updated_at)
         VALUES(?,?,?,?,CURRENT_TIMESTAMP)
         ON CONFLICT(user_id,name) DO NOTHING`,
        [user,category.name,category.color,1],
      );
    }
  }

  async list(user) {
    await this.ensureDefaults(user);
    const result = await this.database.query(
      'SELECT * FROM finance_categories WHERE user_id=? ORDER BY is_default DESC,id',
      [user],
    );
    return result.recordset.map(normalizeCategory);
  }

  async findByName(user, name, database = this.database) {
    const clean = text(name,60);
    return (await database.query(
      'SELECT * FROM finance_categories WHERE user_id=? AND LOWER(name)=LOWER(?)',
      [user,clean],
    )).recordset[0] ?? null;
  }

  async require(user, name, database = this.database) {
    const category = await this.findByName(user,name,database);
    if (!category) throw new HttpError(400,'Categoria inválida.');
    return category.name;
  }

  async add(user, data) {
    const name = text(data.name,60);
    const color = categoryColor(data.color ?? '#7ca8ff');

    return this.database.transaction(async database => {
      await this.ensureDefaults(user,database);
      const existing = await this.findByName(user,name,database);
      if (existing) throw new HttpError(409,'Já existe uma categoria com este nome.');

      const result = await database.query(
        'INSERT INTO finance_categories(user_id,name,color,is_default,updated_at) VALUES(?,?,?,0,CURRENT_TIMESTAMP) RETURNING id',
        [user,name,color],
      );
      const row = (await database.query(
        'SELECT * FROM finance_categories WHERE user_id=? AND id=?',
        [user,result.recordset[0].id],
      )).recordset[0];
      return normalizeCategory(row);
    });
  }

  async update(user, id, data) {
    const name = text(data.name,60);
    const color = categoryColor(data.color);

    return this.database.transaction(async database => {
      const lock = database.kind === 'postgres' ? ' FOR UPDATE' : '';
      const current = (await database.query(
        `SELECT * FROM finance_categories WHERE user_id=? AND id=?${lock}`,
        [user,id],
      )).recordset[0];
      if (!current) throw new HttpError(404,'Categoria não encontrada.');

      const duplicate = (await database.query(
        'SELECT id FROM finance_categories WHERE user_id=? AND LOWER(name)=LOWER(?) AND id<>?',
        [user,name,id],
      )).recordset[0];
      if (duplicate) throw new HttpError(409,'Já existe uma categoria com este nome.');

      if (current.name !== name) {
        await database.query(
          'UPDATE entries SET category=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND category=?',
          [name,user,current.name],
        );
        await database.query(
          'UPDATE recurring_expenses SET category=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND category=?',
          [name,user,current.name],
        );
        await database.query(
          'UPDATE budgets SET category=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND category=?',
          [name,user,current.name],
        );
      }

      await database.query(
        'UPDATE finance_categories SET name=?,color=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND id=?',
        [name,color,user,id],
      );
      const row = (await database.query(
        'SELECT * FROM finance_categories WHERE user_id=? AND id=?',
        [user,id],
      )).recordset[0];
      return normalizeCategory(row);
    });
  }

  async remove(user, id) {
    return this.database.transaction(async database => {
      const category = (await database.query(
        'SELECT * FROM finance_categories WHERE user_id=? AND id=?',
        [user,id],
      )).recordset[0];
      if (!category) throw new HttpError(404,'Categoria não encontrada.');

      const [entryUse, recurringUse, budgetUse] = await Promise.all([
        database.query('SELECT COUNT(*) AS total FROM entries WHERE user_id=? AND category=?',[user,category.name]),
        database.query('SELECT COUNT(*) AS total FROM recurring_expenses WHERE user_id=? AND category=?',[user,category.name]),
        database.query('SELECT COUNT(*) AS total FROM budgets WHERE user_id=? AND category=?',[user,category.name]),
      ]);
      const used = Number(entryUse.recordset[0].total)
        + Number(recurringUse.recordset[0].total)
        + Number(budgetUse.recordset[0].total);
      if (used > 0) {
        throw new HttpError(409,'Esta categoria ainda está sendo usada. Renomeie-a ou remova os registros vinculados antes de excluir.');
      }

      await database.query(
        'DELETE FROM finance_categories WHERE user_id=? AND id=?',
        [user,id],
      );
      return {deleted:true};
    });
  }
}
