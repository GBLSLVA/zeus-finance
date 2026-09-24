export class UserRepository {
  constructor(database) {
    this.database = database;
  }

  async findSessionUser(tokenDigest, now) {
    const row = (await this.database.query(
      'SELECT user_id FROM sessions WHERE token=? AND expires>?',
      [tokenDigest, now],
    )).recordset[0];
    return row?.user_id ?? null;
  }

  async create(email, passwordHash) {
    const result = await this.database.query(
      'INSERT INTO users(email,password) VALUES(?,?) ON CONFLICT(email) DO NOTHING RETURNING id',
      [email, passwordHash],
    );
    const created = result.recordset[0];
    return created ? {id: created.id, email} : null;
  }

  async findByEmail(email) {
    return (await this.database.query(
      'SELECT id,email,password FROM users WHERE email=?',
      [email],
    )).recordset[0] ?? null;
  }

  async findPublicById(id) {
    return (await this.database.query(
      'SELECT id,email FROM users WHERE id=?',
      [id],
    )).recordset[0] ?? null;
  }

  async findCredentialsById(id) {
    return (await this.database.query(
      'SELECT id,password FROM users WHERE id=?',
      [id],
    )).recordset[0] ?? null;
  }

  async purgeExpiredSessions(now) {
    await this.database.query('DELETE FROM sessions WHERE expires<=?', [now]);
  }

  async createSession(tokenDigest, userId, expires) {
    await this.database.query(
      'INSERT INTO sessions(token,user_id,expires) VALUES(?,?,?)',
      [tokenDigest, userId, expires],
    );
  }

  async purgeExpiredPasswordResetTokens(now) {
    await this.database.query('DELETE FROM password_reset_tokens WHERE expires<=?', [now]);
  }

  async createPasswordResetToken(userId, tokenDigest, expires) {
    await this.database.transaction(async database => {
      await database.query('DELETE FROM password_reset_tokens WHERE user_id=?', [userId]);
      await database.query(
        'INSERT INTO password_reset_tokens(token,user_id,expires) VALUES(?,?,?)',
        [tokenDigest,userId,expires],
      );
    });
  }

  async resetPasswordWithToken(tokenDigest, now, nextPassword) {
    return this.database.transaction(async database => {
      const lock = database.kind === 'postgres' ? ' FOR UPDATE' : '';
      const reset = (await database.query(
        `SELECT user_id FROM password_reset_tokens WHERE token=? AND expires>?${lock}`,
        [tokenDigest,now],
      )).recordset[0];
      if (!reset) return false;

      await database.query('UPDATE users SET password=? WHERE id=?', [nextPassword,reset.user_id]);
      await database.query('DELETE FROM sessions WHERE user_id=?', [reset.user_id]);
      await database.query('DELETE FROM password_reset_tokens WHERE user_id=?', [reset.user_id]);
      return true;
    });
  }

  async updatePasswordAndRevokeOtherSessions(userId, currentTokenDigest, nextPassword) {
    await this.database.transaction(async database => {
      await database.query('UPDATE users SET password=? WHERE id=?', [nextPassword, userId]);
      await database.query(
        'DELETE FROM sessions WHERE user_id=? AND token<>?',
        [userId, currentTokenDigest],
      );
    });
  }

  async deleteAccount(userId) {
    return this.database.transaction(async database => {
      await database.query('DELETE FROM debt_payments WHERE user_id=?', [userId]);
      await database.query('DELETE FROM debts WHERE user_id=?', [userId]);
      await database.query('DELETE FROM budgets WHERE user_id=?', [userId]);
      await database.query('DELETE FROM recurring_expenses WHERE user_id=?', [userId]);
      await database.query('DELETE FROM entries WHERE user_id=?', [userId]);
      await database.query('DELETE FROM incomes WHERE user_id=?', [userId]);
      await database.query('DELETE FROM sessions WHERE user_id=?', [userId]);
      await database.query('DELETE FROM password_reset_tokens WHERE user_id=?', [userId]);
      const result = await database.query('DELETE FROM users WHERE id=?', [userId]);
      return Boolean(result.rowsAffected[0]);
    });
  }

  async logout(tokenDigest) {
    await this.database.query('DELETE FROM sessions WHERE token=?', [tokenDigest]);
  }
}
