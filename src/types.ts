export type Kind = 'transactions' | 'debts' | 'goals'
export type View = Kind | 'incomes' | 'budgets' | 'overview'
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

export type Budget = {
  id: number
  month: string
  category: Category
  limit: number
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

export type User = {
  id: number
  email: string
}
