export type Category = 'Casa' | 'Comida' | 'Transporte' | 'Lazer' | 'Outros'

export class Transaction {
  constructor(
    public readonly id: number,
    public readonly name: string,
    public readonly category: Category,
    public readonly value: number,
  ) {}

  static fromJSON(data: Transaction): Transaction {
    return new Transaction(data.id, data.name, data.category, data.value)
  }
}

export class Goal {
  constructor(
    public readonly id: number,
    public readonly name: string,
    public readonly target: number,
    public readonly saved: number,
    public readonly color: string,
  ) {}

  get progress(): number {
    return Math.min(100, (this.saved / this.target) * 100)
  }

  static fromJSON(data: Goal): Goal {
    return new Goal(data.id, data.name, data.target, data.saved, data.color)
  }
}

export class FinanceRepository<T extends { id: number }> {
  constructor(private readonly storageKey: string, private readonly restore: (value: T) => T) {}

  load(fallback: T[]): T[] {
    try {
      const raw = localStorage.getItem(this.storageKey)
      return raw ? (JSON.parse(raw) as T[]).map(this.restore) : fallback
    } catch {
      return fallback
    }
  }

  save(items: T[]): void {
    localStorage.setItem(this.storageKey, JSON.stringify(items))
  }
}

export class FinanceAnalyzer {
  constructor(private readonly baseMonthSpent: number, private readonly seedTotal: number) {}

  monthlySpent(transactions: Transaction[]): number {
    const addedTotal = transactions.reduce((sum, item) => sum + item.value, 0)
    return this.baseMonthSpent + addedTotal - this.seedTotal
  }

  categoryTotal(transactions: Transaction[], category: Category): number {
    return transactions.filter((item) => item.category === category).reduce((sum, item) => sum + item.value, 0)
  }
}

