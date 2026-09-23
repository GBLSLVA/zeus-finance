export class DatabaseAdapter {
  constructor(kind) {
    if (new.target === DatabaseAdapter) {
      throw new TypeError('DatabaseAdapter é abstrato e não pode ser instanciado diretamente.');
    }
    this.kind = kind;
  }

  async query(_statement, _values = []) {
    throw new Error('query() deve ser implementado pelo adaptador de banco.');
  }

  async transaction(_work) {
    throw new Error('transaction() deve ser implementado pelo adaptador de banco.');
  }

  async close() {
    throw new Error('close() deve ser implementado pelo adaptador de banco.');
  }
}
