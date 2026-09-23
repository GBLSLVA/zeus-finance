import type {
  Budget,
  Debt,
  DebtPayment,
  Entry,
  GoalMovement,
  Income,
  RecurringExpense,
} from '../domain/finance'

export type FinanceBackup = {
  format: string
  version: number
  exportedAt: string
  account: { email: string }
  transactions: Entry[]
  goals: Entry[]
  goalMovements: GoalMovement[]
  incomes: Income[]
  debts: Debt[]
  debtPayments: DebtPayment[]
  budgets: Budget[]
  recurringExpenses: RecurringExpense[]
}

const delimiter = ';'

const csvCell = (value: unknown) => {
  const text = value === null || value === undefined ? '' : String(value)
  if (!/[;"\r\n]/.test(text)) return text
  return `"${text.replaceAll('"', '""')}"`
}

const numberPtBr = (value: number) =>
  Number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  })

const row = (values: unknown[]) => values.map(csvCell).join(delimiter)

export function buildFinanceCsv(backup: FinanceBackup) {
  const rows: unknown[][] = [[
    'registro',
    'id',
    'data',
    'descricao',
    'categoria',
    'valor',
    'tipo',
    'status',
    'referencia',
    'observacao',
  ]]

  for (const entry of backup.transactions ?? []) {
    rows.push([
      'gasto',
      entry.id,
      entry.transactionDate,
      entry.name,
      entry.category,
      numberPtBr(entry.value),
      '',
      '',
      '',
      '',
    ])
  }

  for (const income of backup.incomes ?? []) {
    rows.push([
      'receita',
      income.id,
      income.type === 'extra' ? income.receivedAt?.slice(0, 10) : income.activeFrom,
      income.name,
      '',
      numberPtBr(income.value),
      income.type,
      income.active ? 'ativa' : 'inativa',
      income.type === 'salary'
        ? `vigencia=${income.activeFrom}..${income.activeUntil ?? 'atual'}`
        : 'receita única',
      '',
    ])
  }

  for (const debt of backup.debts ?? []) {
    rows.push([
      'divida',
      debt.id,
      debt.transactionDate,
      debt.name,
      '',
      numberPtBr(debt.currentBalance),
      'saldo_devedor',
      debt.status,
      `original=${numberPtBr(debt.originalAmount)} | pago=${numberPtBr(debt.paidAmount)} | parcelas=${debt.installmentsPaid}/${debt.installmentsTotal}`,
      debt.creditor,
    ])
  }

  for (const payment of backup.debtPayments ?? []) {
    rows.push([
      'pagamento_divida',
      payment.id,
      payment.paymentDate,
      `Pagamento da dívida #${payment.debtId}`,
      '',
      numberPtBr(payment.amount),
      payment.countsAsInstallment ? 'parcela' : 'abatimento',
      '',
      `divida_id=${payment.debtId}`,
      payment.note,
    ])
  }

  for (const goal of backup.goals ?? []) {
    rows.push([
      'meta',
      goal.id,
      goal.createdAt?.slice(0, 10),
      goal.name,
      '',
      numberPtBr(goal.saved),
      'saldo_reservado',
      goal.saved >= goal.target ? 'concluida' : 'em_andamento',
      `alvo=${numberPtBr(goal.target)}`,
      '',
    ])
  }

  for (const movement of backup.goalMovements ?? []) {
    rows.push([
      'movimento_meta',
      movement.id,
      movement.movementDate,
      `Movimentação da meta #${movement.goalId}`,
      '',
      numberPtBr(movement.type === 'withdrawal' ? -movement.amount : movement.amount),
      movement.type,
      '',
      `meta_id=${movement.goalId}`,
      movement.note,
    ])
  }

  for (const budget of backup.budgets ?? []) {
    rows.push([
      'orcamento',
      budget.id,
      `${budget.month}-01`,
      `Orçamento de ${budget.category}`,
      budget.category,
      numberPtBr(budget.limit),
      'limite_mensal',
      '',
      `mes=${budget.month}`,
      '',
    ])
  }

  for (const recurring of backup.recurringExpenses ?? []) {
    rows.push([
      'recorrente',
      recurring.id,
      recurring.activeFrom,
      recurring.name,
      recurring.category,
      numberPtBr(recurring.value),
      'compromisso_mensal',
      recurring.active ? 'ativo' : 'inativo',
      `vence_dia=${recurring.dueDay} | ate=${recurring.activeUntil ?? 'atual'}`,
      '',
    ])
  }

  return '\uFEFF' + rows.map(row).join('\r\n')
}
