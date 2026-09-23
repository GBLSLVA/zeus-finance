export type Kind = 'transactions' | 'debts' | 'goals'
export type View = Kind | 'incomes' | 'budgets' | 'recurring' | 'overview'
export type Category = 'Casa' | 'Comida' | 'Transporte' | 'Lazer' | 'Outros'

export type Entry = {
  id: number
  name: string
  category: string
  value: number
  target: number
  saved: number
  transactionDate: string
  createdAt: string
  updatedAt: string
  recurringExpenseId?: number | null
  recurringMonth?: string | null
}

export type Debt = Entry & {
  originalAmount: number
  currentBalance: number
  paidAmount: number
  creditor: string
  interestRate: number
  installmentsTotal: number
  installmentsPaid: number
  dueDay: number | null
  status: 'active' | 'paid'
}

export type DebtPayment = {
  id: number
  debtId: number
  amount: number
  paymentDate: string
  note: string
  countsAsInstallment: boolean
  createdAt: string
}

export type GoalMovement = {
  id: number
  goalId: number
  type: 'initial' | 'deposit' | 'withdrawal'
  amount: number
  movementDate: string
  note: string
  createdAt: string
}

export type Budget = {
  id: number
  month: string
  category: Category
  limit: number
  createdAt: string
  updatedAt: string
}

export type RecurringExpense = {
  id: number
  name: string
  category: Category
  value: number
  dueDay: number
  activeFrom: string
  activeUntil: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export type Income = {
  id: number
  name: string
  type: 'salary' | 'extra'
  value: number
  recurrence: 'monthly' | 'once'
  activeFrom: string
  activeUntil: string | null
  active: boolean
  receivedAt: string
  updatedAt: string
}

export type EditState =
  | { kind: Kind; entry: Entry }
  | { kind: 'incomes'; entry: Income }
  | null

export type User = { id: number; email: string }
export type InsightTone = 'warning' | 'positive' | 'info'

export type Insight = {
  id: string
  type: 'balance' | 'comparison' | 'category' | 'budget' | 'debt' | 'goal' | 'anomaly' | 'trend' | 'onboarding'
  tone: InsightTone
  title: string
  message: string
  value: number | null
}

export type MonthlySummary = {
  tone: InsightTone
  title: string
  message: string
  highlights: string[]
}

export type AssistantResponse = {
  month: string
  question: string
  intent: string
  answer: string
  suggestions: string[]
}

export type InsightsResponse = {
  month: string
  income: number
  spent: number
  balance: number
  previousSpent: number
  summary: MonthlySummary
  items: Insight[]
}

export type Dashboard = {
  month: string
  monthly: Entry[]
  spent: number
  activeSalaries: Income[]
  salary: number
  monthlyExtras: Income[]
  extras: number
  income: number
  balance: number
  recurringExpenses: Array<RecurringExpense & { scheduledDate: string; paid: boolean }>
  recurringTotal: number
  projectedSpent: number
  projectedBalance: number
  debt: number
  debtOriginal: number
  debtPaid: number
  debtProgress: number
  debtMonths: number
  saved: number
  targets: number
  goalProgress: number
  categoriesData: Array<{ category: Category; total: number; share: number }>
  budgetData: Array<{
    category: Category
    budget: Budget | null
    limit: number
    spent: number
    remaining: number
    usage: number
  }>
  budgetTotal: number
  budgetedSpent: number
  budgetRemaining: number
  budgetUsage: number
  historyData: Array<{ monthKey: string; income: number; expenses: number; balance: number }>
}

export const categories: readonly Category[] = ['Casa', 'Comida', 'Transporte', 'Lazer', 'Outros']

export const titles: Record<View, string> = {
  overview: 'Visão geral',
  incomes: 'Receitas',
  budgets: 'Orçamentos',
  recurring: 'Recorrentes',
  transactions: 'Gastos',
  debts: 'Dívidas',
  goals: 'Metas',
}

export const descriptions: Record<View, string> = {
  overview: 'Receitas, gastos, dívidas e metas no mesmo panorama.',
  incomes: 'Cadastre seu salário mensal e todas as rendas extras.',
  budgets: 'Defina limites mensais por categoria e acompanhe o consumo.',
  recurring: 'Cadastre compromissos mensais e acompanhe o saldo projetado.',
  transactions: 'Acompanhe para onde o seu dinheiro está indo.',
  debts: 'Organize os valores que ainda precisam ser pagos.',
  goals: 'Transforme objetivos em progresso visível.',
}

export const categoryColor: Record<Category, string> = {
  Casa: '#58d6a3',
  Comida: '#7ca8ff',
  Transporte: '#f1c96b',
  Lazer: '#bd91ff',
  Outros: '#ff8f96',
}

export const emptyDashboard = (month: string): Dashboard => ({
  month,
  monthly: [],
  spent: 0,
  activeSalaries: [],
  salary: 0,
  monthlyExtras: [],
  extras: 0,
  income: 0,
  balance: 0,
  recurringExpenses: [],
  recurringTotal: 0,
  projectedSpent: 0,
  projectedBalance: 0,
  debt: 0,
  debtOriginal: 0,
  debtPaid: 0,
  debtProgress: 0,
  debtMonths: 0,
  saved: 0,
  targets: 0,
  goalProgress: 0,
  categoriesData: [],
  budgetData: categories.map(category => ({
    category,
    budget: null,
    limit: 0,
    spent: 0,
    remaining: 0,
    usage: 0,
  })),
  budgetTotal: 0,
  budgetedSpent: 0,
  budgetRemaining: 0,
  budgetUsage: 0,
  historyData: [],
})
