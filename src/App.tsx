import { useEffect, useState, type FormEvent } from 'react'
import { api } from './api'
import { buildFinanceCsv, type FinanceBackup } from './utils/csv'
import { Icon } from './components/Icon'
import { RecurringExpensesPage } from './features/recurring/RecurringExpensesPage'
import { BudgetPage } from './features/budgets/BudgetPage'
import { DebtPage } from './features/debts/DebtPage'
import { GoalsPage } from './features/goals/GoalsPage'
import { OverviewPage } from './features/overview/OverviewPage'
import { TransactionsPage } from './features/transactions/TransactionsPage'
import {
  descriptions,
  emptyDashboard,
  titles,
  type AssistantResponse,
  type Budget,
  type Category,
  type Dashboard,
  type Debt,
  type DebtPayment,
  type EditState,
  type Entry,
  type GoalMovement,
  type Income,
  type Insight,
  type InsightsResponse,
  type Kind,
  type MonthlySummary,
  type RecurringExpense,
  type User,
  type View,
} from './domain/finance'
import {
  currentDateKey,
  currentMonthKey,
  effectiveIncomeEnd,
  formatMonth,
  money,
  shiftMonthKey,
} from './utils/finance'

function downloadText(content: string, mimeType: string, filename: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [register, setRegister] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [view, setView] = useState<View>('overview')
  const [menu, setMenu] = useState(false)
  const [data, setData] = useState<Record<Kind, Entry[]>>({
    transactions: [],
    debts: [],
    goals: [],
  })
  const [incomes, setIncomes] = useState<Income[]>([])
  const [editing, setEditing] = useState<EditState>(null)
  const [selectedDebtId, setSelectedDebtId] = useState<number | null>(null)
  const [debtPayments, setDebtPayments] = useState<DebtPayment[]>([])
  const [selectedGoalId, setSelectedGoalId] = useState<number | null>(null)
  const [goalMovements, setGoalMovements] = useState<GoalMovement[]>([])
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey())
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([])
  const [editingRecurring, setEditingRecurring] = useState<RecurringExpense | null>(null)
  const [exportBusy, setExportBusy] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordChanged, setPasswordChanged] = useState(false)
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false)
  const [deleteAccountBusy, setDeleteAccountBusy] = useState(false)
  const [deleteAccountError, setDeleteAccountError] = useState('')
  const [insights, setInsights] = useState<Insight[]>([])
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary | null>(null)
  const [assistantQuestion, setAssistantQuestion] = useState('')
  const [assistantAnswer, setAssistantAnswer] = useState<AssistantResponse | null>(null)
  const [assistantBusy, setAssistantBusy] = useState(false)
  const [dashboard, setDashboard] = useState<Dashboard>(() => emptyDashboard(currentMonthKey()))

  const load = async () => {
    const [transactions, debts, goals, incomeEntries, recurringEntries] = await Promise.all([
      api.request<Entry[]>('transactions'),
      api.request<Debt[]>('debts'),
      api.request<Entry[]>('goals'),
      api.request<Income[]>('incomes'),
      api.request<RecurringExpense[]>('recurring-expenses'),
    ])
    setData({ transactions, debts, goals })
    setIncomes(incomeEntries)
    setRecurringExpenses(recurringEntries)
  }

  useEffect(() => {
    api.request<User>('me')
      .then(async currentUser => {
        setUser(currentUser)
        try {
          await load()
        } catch (e) {
          if ((e as { status?: number }).status !== 401) {
            setError('Sua conta foi carregada, mas houve uma falha ao buscar os dados financeiros.')
          }
        }
      })
      .catch(e => {
        if ((e as { status?: number }).status !== 401) {
          setError('Inicie o backend para acessar sua conta.')
        }
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!user) return
    api.request<Budget[]>(`budgets?month=${selectedMonth}`)
      .then(setBudgets)
      .catch(e => setError((e as Error).message))
  }, [user, selectedMonth])

  useEffect(() => {
    if (!user) {
      setInsights([])
      setMonthlySummary(null)
      return
    }

    let active = true
    api.request<InsightsResponse>(`insights?month=${selectedMonth}`)
      .then(result => {
        if (active) {
          setInsights(result.items)
          setMonthlySummary(result.summary)
        }
      })
      .catch(e => {
        if (active && (e as { status?: number }).status !== 401) {
          setError('Não foi possível atualizar os insights financeiros.')
        }
      })

    return () => {
      active = false
    }
  }, [user, selectedMonth, data, incomes, budgets])

  useEffect(() => {
    if (!user) {
      setDashboard(emptyDashboard(selectedMonth))
      return
    }

    let active = true
    setDashboard(current => current.month === selectedMonth ? current : emptyDashboard(selectedMonth))

    api.request<Dashboard>(`dashboard?month=${selectedMonth}`)
      .then(result => {
        if (active) setDashboard(result)
      })
      .catch(e => {
        if (active && (e as { status?: number }).status !== 401) {
          setError('Não foi possível atualizar o resumo financeiro.')
        }
      })

    return () => {
      active = false
    }
  }, [user, selectedMonth, data, incomes, budgets, recurringExpenses])

  useEffect(() => {
    setAssistantAnswer(null)
    setAssistantQuestion('')
  }, [selectedMonth])

  useEffect(() => {
    const handleUnauthorized = () => {
      if (!user) return
      setUser(null)
      setData({ transactions: [], debts: [], goals: [] })
      setIncomes([])
      setEditing(null)
      setSelectedDebtId(null)
      setDebtPayments([])
      setSelectedGoalId(null)
      setGoalMovements([])
      setBudgets([])
      setRecurringExpenses([])
      setEditingRecurring(null)
      setInsights([])
      setMonthlySummary(null)
      setAssistantQuestion('')
      setAssistantAnswer(null)
      setAssistantBusy(false)
      setDashboard(emptyDashboard(currentMonthKey()))
      setSelectedMonth(currentMonthKey())
      setView('overview')
      setPasswordOpen(false)
      setPasswordError('')
      setPasswordChanged(false)
      setDeleteAccountOpen(false)
      setDeleteAccountError('')
      setNotice('')
      setError('Sua sessão expirou. Entre novamente.')
    }

    window.addEventListener('zeus:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('zeus:unauthorized', handleUnauthorized)
  }, [user])

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    const form = new FormData(event.currentTarget)
    try {
      const currentUser = await api.request<User>(register ? 'register' : 'login', 'POST', {
        email: form.get('email'),
        password: form.get('password'),
        remember: form.get('remember') === 'on',
      })
      setUser(currentUser)
      try {
        await load()
      } catch (e) {
        if ((e as { status?: number }).status !== 401) {
          setError('Login realizado, mas houve uma falha ao carregar seus dados financeiros.')
        }
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    try {
      await api.request('logout', 'POST')
      setUser(null)
      setData({ transactions: [], debts: [], goals: [] })
      setIncomes([])
      setEditing(null)
      setSelectedDebtId(null)
      setDebtPayments([])
      setSelectedGoalId(null)
      setGoalMovements([])
      setBudgets([])
      setRecurringExpenses([])
      setEditingRecurring(null)
      setInsights([])
      setMonthlySummary(null)
      setAssistantQuestion('')
      setAssistantAnswer(null)
      setAssistantBusy(false)
      setDashboard(emptyDashboard(currentMonthKey()))
      setSelectedMonth(currentMonthKey())
      setView('overview')
      setPasswordOpen(false)
      setPasswordError('')
      setPasswordChanged(false)
      setDeleteAccountOpen(false)
      setDeleteAccountError('')
      setNotice('')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function askZeusQuestion(question: string) {
    const cleanQuestion = question.trim()
    if (!cleanQuestion || assistantBusy) return

    setAssistantBusy(true)
    setError('')
    try {
      const result = await api.request<AssistantResponse>('assistant', 'POST', {
        month: selectedMonth,
        question: cleanQuestion,
      })
      setAssistantQuestion(cleanQuestion)
      setAssistantAnswer(result)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setAssistantBusy(false)
    }
  }

  async function askZeus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await askZeusQuestion(assistantQuestion)
  }

  async function exportAccountData() {
    setExportBusy(true)
    setError('')
    setNotice('')
    try {
      const payload = await api.request<FinanceBackup>('export')
      downloadText(
        JSON.stringify(payload, null, 2),
        'application/json;charset=utf-8',
        `zeus-finance-backup-${currentDateKey()}.json`,
      )
      setNotice('Backup JSON exportado com sucesso.')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setExportBusy(false)
    }
  }

  async function exportAccountCsv() {
    setExportBusy(true)
    setError('')
    setNotice('')
    try {
      const payload = await api.request<FinanceBackup>('export')
      downloadText(
        buildFinanceCsv(payload),
        'text/csv;charset=utf-8',
        `zeus-finance-${currentDateKey()}.csv`,
      )
      setNotice('CSV financeiro exportado com sucesso.')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setExportBusy(false)
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const element = event.currentTarget
    const form = new FormData(element)
    const currentPassword = String(form.get('currentPassword') ?? '')
    const newPassword = String(form.get('newPassword') ?? '')
    const confirmation = String(form.get('confirmation') ?? '')

    setPasswordError('')
    setPasswordChanged(false)

    if (newPassword !== confirmation) {
      setPasswordError('A confirmação da nova senha não confere.')
      return
    }

    setPasswordBusy(true)
    try {
      await api.request('change-password', 'POST', { currentPassword, newPassword })
      element.reset()
      setPasswordChanged(true)
    } catch (e) {
      setPasswordError((e as Error).message)
    } finally {
      setPasswordBusy(false)
    }
  }

  function openPasswordDialog() {
    setPasswordError('')
    setPasswordChanged(false)
    setPasswordOpen(true)
    setMenu(false)
  }

  function closePasswordDialog() {
    if (passwordBusy) return
    setPasswordOpen(false)
    setPasswordError('')
    setPasswordChanged(false)
  }

  function openDeleteAccountDialog() {
    setDeleteAccountError('')
    setDeleteAccountOpen(true)
    setMenu(false)
  }

  function closeDeleteAccountDialog() {
    if (deleteAccountBusy) return
    setDeleteAccountOpen(false)
    setDeleteAccountError('')
  }

  async function deleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const element = event.currentTarget
    const form = new FormData(element)
    const password = String(form.get('password') ?? '')
    const confirmation = String(form.get('confirmation') ?? '')

    setDeleteAccountError('')
    if (confirmation !== 'EXCLUIR') {
      setDeleteAccountError('Digite EXCLUIR exatamente como mostrado para confirmar.')
      return
    }

    setDeleteAccountBusy(true)
    try {
      await api.request('delete-account', 'POST', { password, confirmation })
      setUser(null)
      setData({ transactions: [], debts: [], goals: [] })
      setIncomes([])
      setEditing(null)
      setSelectedDebtId(null)
      setDebtPayments([])
      setSelectedGoalId(null)
      setGoalMovements([])
      setBudgets([])
      setRecurringExpenses([])
      setEditingRecurring(null)
      setInsights([])
      setMonthlySummary(null)
      setAssistantQuestion('')
      setAssistantAnswer(null)
      setAssistantBusy(false)
      setDashboard(emptyDashboard(currentMonthKey()))
      setSelectedMonth(currentMonthKey())
      setView('overview')
      setMenu(false)
      setPasswordOpen(false)
      setPasswordError('')
      setPasswordChanged(false)
      setDeleteAccountOpen(false)
      setDeleteAccountError('')
      setRegister(false)
      setError('')
      setNotice('Conta excluída com sucesso. Seus dados financeiros foram removidos.')
    } catch (e) {
      setDeleteAccountError((e as Error).message)
    } finally {
      setDeleteAccountBusy(false)
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (view === 'overview' || view === 'budgets' || view === 'recurring') return
    const element = event.currentTarget
    const form = new FormData(element)
    setBusy(true)
    setError('')
    try {
      if (view === 'incomes') {
        const type = String(form.get('type')) as 'salary' | 'extra'
        const date = String(form.get('date'))
        const payload = {
          name: form.get('name'),
          type,
          value: Number(form.get('value')),
          receivedAt: date,
          activeFrom: date,
          activeUntil: form.get('activeUntil') || null,
          active: form.get('active') === 'on',
        }
        const isEditing = editing?.kind === 'incomes'
        const income = await api.request<Income>(
          isEditing ? `incomes/${editing.entry.id}` : 'incomes',
          isEditing ? 'PUT' : 'POST',
          payload,
        )
        setIncomes(current =>
          isEditing
            ? current.map(entry => entry.id === income.id ? income : entry)
            : [income, ...current],
        )
      } else if (view === 'debts') {
        const isEditing = editing?.kind === 'debts'
        const debt = await api.request<Debt>(
          isEditing ? `debts/${editing.entry.id}` : 'debts',
          isEditing ? 'PUT' : 'POST',
          {
            name: form.get('name'),
            creditor: form.get('creditor'),
            originalAmount: Number(form.get('originalAmount')),
            interestRate: Number(form.get('interestRate') ?? 0),
            installmentsTotal: Number(form.get('installmentsTotal') ?? 0),
            dueDay: form.get('dueDay') ? Number(form.get('dueDay')) : null,
          },
        )
        setData(current => ({
          ...current,
          debts: isEditing
            ? current.debts.map(item => item.id === debt.id ? debt : item)
            : [debt, ...current.debts],
        }))
      } else if (view === 'goals') {
        const isEditing = editing?.kind === 'goals'
        const goal = await api.request<Entry>(
          isEditing ? `goals/${editing.entry.id}` : 'goals',
          isEditing ? 'PUT' : 'POST',
          {
            name: form.get('name'),
            target: Number(form.get('value')),
            saved: isEditing ? undefined : Number(form.get('saved') ?? 0),
          },
        )
        setData(current => ({
          ...current,
          goals: isEditing
            ? current.goals.map(item => item.id === goal.id ? goal : item)
            : [goal, ...current.goals],
        }))
      } else {
        const isEditing = editing?.kind === 'transactions'
        const entry = await api.request<Entry>(
          isEditing ? `transactions/${editing.entry.id}` : 'transactions',
          isEditing ? 'PUT' : 'POST',
          {
            name: form.get('name'),
            category: form.get('category'),
            value: Number(form.get('value')),
            transactionDate: form.get('transactionDate'),
          },
        )
        setData(current => ({
          ...current,
          transactions: isEditing
            ? current.transactions.map(item => item.id === entry.id ? entry : item)
            : [entry, ...current.transactions],
        }))
      }
      setEditing(null)
      element.reset()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function startEdit(kind: Kind, entry: Entry): void
  function startEdit(kind: 'incomes', entry: Income): void
  function startEdit(kind: Kind | 'incomes', entry: Entry | Income) {
    if (kind === 'incomes') {
      setEditing({ kind, entry: entry as Income })
    } else {
      setEditing({ kind, entry: entry as Entry })
    }
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditing(null)
    setError('')
  }

  async function saveBudget(event: FormEvent<HTMLFormElement>, category: Category) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    try {
      const budget = await api.request<Budget>('budgets', 'POST', {
        month: selectedMonth,
        category,
        limit: Number(form.get('limit')),
      })
      setBudgets(current => {
        const exists = current.some(item => item.id === budget.id || item.category === category)
        return exists
          ? current.map(item => item.id === budget.id || item.category === category ? budget : item)
          : [...current, budget]
      })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function removeBudget(id: number) {
    if (!window.confirm('Remover este limite mensal?')) return
    setBusy(true)
    setError('')
    try {
      await api.request(`budgets/${id}`, 'DELETE')
      setBudgets(current => current.filter(item => item.id !== id))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function saveRecurringExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const element = event.currentTarget
    const form = new FormData(element)
    setBusy(true)
    setError('')
    try {
      const payload = {
        name: form.get('name'),
        category: form.get('category'),
        value: Number(form.get('value')),
        dueDay: Number(form.get('dueDay')),
        activeFrom: form.get('activeFrom'),
        activeUntil: form.get('activeUntil') || null,
        active: form.get('active') === 'on',
      }
      const item = await api.request<RecurringExpense>(
        editingRecurring ? `recurring-expenses/${editingRecurring.id}` : 'recurring-expenses',
        editingRecurring ? 'PUT' : 'POST',
        payload,
      )
      setRecurringExpenses(current =>
        editingRecurring
          ? current.map(entry => entry.id === item.id ? item : entry)
          : [...current, item].sort((a,b) => a.dueDay - b.dueDay),
      )
      setEditingRecurring(null)
      element.reset()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function removeRecurringExpense(id: number) {
    if (!window.confirm('Excluir este gasto recorrente?')) return
    setBusy(true)
    setError('')
    try {
      await api.request(`recurring-expenses/${id}`, 'DELETE')
      setRecurringExpenses(current => current.filter(item => item.id !== id))
      if (editingRecurring?.id === id) setEditingRecurring(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function markRecurringExpensePaid(id: number) {
    setBusy(true)
    setError('')
    try {
      const entry = await api.request<Entry>(`recurring-expenses/${id}/payments`, 'POST', {
        month: selectedMonth,
      })
      setData(current => ({
        ...current,
        transactions: [entry, ...current.transactions],
      }))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function openDebtPayments(debtId: number) {
    setBusy(true)
    setError('')
    try {
      const payments = await api.request<DebtPayment[]>(`debts/${debtId}/payments`)
      setSelectedDebtId(debtId)
      setDebtPayments(payments)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function addDebtPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedDebtId) return
    const element = event.currentTarget
    const form = new FormData(element)
    setBusy(true)
    setError('')
    try {
      const result = await api.request<{ payment: DebtPayment; debt: Debt }>(
        `debts/${selectedDebtId}/payments`,
        'POST',
        {
          amount: Number(form.get('amount')),
          paymentDate: form.get('paymentDate'),
          note: form.get('note'),
          countsAsInstallment: form.get('countsAsInstallment') === 'on',
        },
      )
      setDebtPayments(current => [result.payment, ...current])
      setData(current => ({
        ...current,
        debts: current.debts.map(item => item.id === result.debt.id ? result.debt : item),
      }))
      element.reset()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function removeDebtPayment(paymentId: number) {
    if (!selectedDebtId || !window.confirm('Excluir este pagamento? O saldo da dívida será recalculado.')) return
    setBusy(true)
    setError('')
    try {
      const debt = await api.request<Debt>(`debts/${selectedDebtId}/payments/${paymentId}`, 'DELETE')
      setDebtPayments(current => current.filter(payment => payment.id !== paymentId))
      setData(current => ({
        ...current,
        debts: current.debts.map(item => item.id === debt.id ? debt : item),
      }))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function openGoalMovements(goalId: number) {
    setBusy(true)
    setError('')
    try {
      const movements = await api.request<GoalMovement[]>(`goals/${goalId}/movements`)
      setSelectedGoalId(goalId)
      setGoalMovements(movements)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function addGoalMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedGoalId) return
    const element = event.currentTarget
    const form = new FormData(element)
    setBusy(true)
    setError('')
    try {
      const result = await api.request<{ movement: GoalMovement; goal: Entry }>(
        `goals/${selectedGoalId}/movements`,
        'POST',
        {
          type: form.get('type'),
          amount: Number(form.get('amount')),
          movementDate: form.get('movementDate'),
          note: form.get('note'),
        },
      )
      setGoalMovements(current => [result.movement, ...current])
      setData(current => ({
        ...current,
        goals: current.goals.map(item => item.id === result.goal.id ? result.goal : item),
      }))
      element.reset()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function removeGoalMovement(movementId: number) {
    if (!selectedGoalId || !window.confirm('Excluir esta movimentação? O saldo da meta será recalculado.')) return
    setBusy(true)
    setError('')
    try {
      const goal = await api.request<Entry>(`goals/${selectedGoalId}/movements/${movementId}`, 'DELETE')
      setGoalMovements(current => current.filter(movement => movement.id !== movementId))
      setData(current => ({
        ...current,
        goals: current.goals.map(item => item.id === goal.id ? goal : item),
      }))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function remove(kind: Kind | 'incomes', id: number) {
    if (!window.confirm('Excluir este registro?')) return
    setBusy(true)
    setError('')
    try {
      await api.request(`${kind}/${id}`, 'DELETE')
      if (kind === 'incomes') {
        setIncomes(current => current.filter(entry => entry.id !== id))
      } else {
        setData(current => ({
          ...current,
          [kind]: current[kind].filter(entry => entry.id !== id),
        }))
        if (kind === 'goals' && selectedGoalId === id) {
          setSelectedGoalId(null)
          setGoalMovements([])
        }
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const historyData = dashboard.historyData
  const historyMax = Math.max(1, ...historyData.flatMap(item => [item.income, item.expenses]))

  const monthLabel = formatMonth(selectedMonth)

  const navigate = (next: View) => {
    setView(next)
    setMenu(false)
    setEditing(null)
    setEditingRecurring(null)
    if (next !== 'debts') {
      setSelectedDebtId(null)
      setDebtPayments([])
    }
    if (next !== 'goals') {
      setSelectedGoalId(null)
      setGoalMovements([])
    }
    setError('')
  }

  if (loading) {
    return (
      <main className="loading-screen">
        <div className="loading-mark">Z</div>
        <p role="status">Carregando seu painel financeiro…</p>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="auth-page">
        <section className="auth-brand-panel" aria-hidden="true">
          <div className="auth-brand">
            <span className="brand-mark">Z</span>
            <span>ZEUS FINANCE</span>
          </div>
          <div className="auth-message">
            <span className="auth-kicker">FINANÇAS SEM RUÍDO</span>
            <h2>Veja o que importa. Decida com mais clareza.</h2>
            <p>Um painel direto para gastos, dívidas e metas — sem planilhas espalhadas.</p>
          </div>
          <div className="auth-proof">
            <Icon name="shield" size={18} />
            <span>Seus registros ficam separados por conta e salvos no servidor.</span>
          </div>
        </section>

        <section className="auth-form-panel">
          <div className="auth-form-wrap">
            <div className="auth-mobile-brand">
              <span className="brand-mark">Z</span>
              <strong>ZEUS FINANCE</strong>
            </div>
            <span className="section-kicker">{register ? 'NOVA CONTA' : 'BEM-VINDO DE VOLTA'}</span>
            <h1>{register ? 'Comece a organizar suas finanças.' : 'Entre no seu painel.'}</h1>
            <p className="auth-subtitle">
              {register
                ? 'Crie sua conta e concentre seus registros financeiros em um só lugar.'
                : 'Use seu e-mail e senha para continuar de onde parou.'}
            </p>

            <form onSubmit={login} className="auth-form">
              <label>
                <span>E-mail</span>
                <input name="email" type="email" autoComplete="email" placeholder="voce@exemplo.com" required maxLength={254} />
              </label>
              <label>
                <span>Senha</span>
                <input
                  name="password"
                  type="password"
                  autoComplete={register ? 'new-password' : 'current-password'}
                  minLength={12}
                  maxLength={128}
                  placeholder="••••••••••••"
                  required
                />
              </label>
              <small>Use no mínimo 12 caracteres.</small>
              <label className="remember-field">
                <input name="remember" type="checkbox" />
                <span>
                  Manter conectado por 30 dias
                  <small>Use apenas neste dispositivo se ele for confiável.</small>
                </span>
              </label>
              <button className="primary primary--full" disabled={busy}>
                {busy ? 'Aguarde…' : register ? 'Criar conta' : 'Entrar no ZEUS'}
                {!busy && <Icon name="arrow" size={18} />}
              </button>
            </form>

            <button className="switch-auth" onClick={() => { setRegister(!register); setError(''); setNotice('') }}>
              {register ? 'Já tenho uma conta' : 'Ainda não tenho conta'}
            </button>
            {notice && <p role="status" className="alert alert--success">{notice}</p>}
            {error && <p role="alert" className="alert alert--error">{error}</p>}
          </div>
        </section>
      </main>
    )
  }

  const navItems: Array<{ key: View; label: string; icon: 'overview' | 'income' | 'budget' | 'wallet' | 'debt' | 'goal' | 'calendar' }> = [
    { key: 'overview', label: 'Visão geral', icon: 'overview' },
    { key: 'incomes', label: 'Receitas', icon: 'income' },
    { key: 'budgets', label: 'Orçamentos', icon: 'budget' },
    { key: 'recurring', label: 'Recorrentes', icon: 'calendar' },
    { key: 'transactions', label: 'Gastos', icon: 'wallet' },
    { key: 'debts', label: 'Dívidas', icon: 'debt' },
    { key: 'goals', label: 'Metas', icon: 'goal' },
  ]

  return (
    <div className="app-shell">
      {menu && <button className="nav-backdrop" aria-label="Fechar menu" onClick={() => setMenu(false)} />}

      <aside id="navigation" className={`sidebar ${menu ? 'open' : ''}`}>
        <div className="sidebar__brand">
          <span className="brand-mark">Z</span>
          <div>
            <strong>ZEUS</strong>
            <span>FINANCE</span>
          </div>
          <button className="sidebar-close" onClick={() => setMenu(false)} aria-label="Fechar menu">
            <Icon name="close" size={20} />
          </button>
        </div>

        <div className="sidebar__section-label">PAINEL</div>
        <nav aria-label="Navegação principal">
          {navItems.map(item => (
            <button
              key={item.key}
              className={`nav-item ${view === item.key ? 'active' : ''}`}
              aria-current={view === item.key ? 'page' : undefined}
              onClick={() => navigate(item.key)}
            >
              <Icon name={item.icon} size={19} />
              <span>{item.label}</span>
              {item.key !== 'overview' && (
                <span className="nav-count">
                  {item.key === 'incomes' ? incomes.length : item.key === 'budgets' ? budgets.length : item.key === 'recurring' ? recurringExpenses.length : item.key === 'transactions' ? data.transactions.length : item.key === 'debts' ? data.debts.length : data.goals.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar__bottom">
          <div className="account-card">
            <span className="account-avatar">{user.email.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{user.email}</strong>
              <span>Conta ativa</span>
            </div>
          </div>
          <button className="logout-button account-action-button" onClick={exportAccountData} disabled={exportBusy}>
            <Icon name="download" size={18} />
            {exportBusy ? 'Exportando…' : 'Backup JSON'}
          </button>
          <button className="logout-button account-action-button" onClick={exportAccountCsv} disabled={exportBusy}>
            <Icon name="download" size={18} />
            {exportBusy ? 'Exportando…' : 'Exportar CSV'}
          </button>
          <button className="logout-button account-action-button" onClick={openPasswordDialog}>
            <Icon name="shield" size={18} />
            Alterar senha
          </button>
          <button className="logout-button delete-account-button" onClick={openDeleteAccountDialog}>
            <Icon name="trash" size={18} />
            Excluir conta
          </button>
          <button className="logout-button" onClick={logout}>
            <Icon name="logout" size={18} />
            Sair da conta
          </button>
        </div>
      </aside>

      <main className="workspace">
        <header className="page-header">
          <div className="page-header__left">
            <button
              className="menu-button"
              aria-controls="navigation"
              aria-expanded={menu}
              onClick={() => setMenu(true)}
              aria-label="Abrir menu"
            >
              <Icon name="menu" size={21} />
            </button>
            <div>
              {view === 'overview' && <span className="section-kicker">{monthLabel}</span>}
              <h1>{titles[view]}</h1>
              <p>{descriptions[view]}</p>
            </div>
          </div>
          {view === 'overview' && (
            <button className="primary page-header__action" onClick={() => navigate('incomes')}>
              <Icon name="plus" size={18} />
              Nova receita
            </button>
          )}
        </header>

        {(view === 'overview' || view === 'budgets' || view === 'recurring') && (
          <div className="period-toolbar" aria-label="Selecionar período">
            <button className="period-button" onClick={() => setSelectedMonth(current => shiftMonthKey(current, -1))} aria-label="Mês anterior">‹</button>
            <div className="period-toolbar__current">
              <Icon name="calendar" size={16} />
              <strong>{monthLabel}</strong>
            </div>
            <button className="period-button" onClick={() => setSelectedMonth(current => shiftMonthKey(current, 1))} aria-label="Próximo mês">›</button>
            {selectedMonth !== currentMonthKey() && (
              <button className="period-today" onClick={() => setSelectedMonth(currentMonthKey())}>Mês atual</button>
            )}
          </div>
        )}

        {notice && <p role="status" className="alert alert--success">{notice}</p>}
        {error && <p role="alert" className="alert alert--error">{error}</p>}

        {view === 'overview' ? (
          <OverviewPage
            dashboard={dashboard}
            data={data}
            monthLabel={monthLabel}
            assistantAnswer={assistantAnswer}
            assistantQuestion={assistantQuestion}
            assistantBusy={assistantBusy}
            setAssistantQuestion={setAssistantQuestion}
            askZeus={askZeus}
            askZeusQuestion={askZeusQuestion}
            monthlySummary={monthlySummary}
            insights={insights}
            historyData={historyData}
            historyMax={historyMax}
            navigate={navigate}
          />
        ) : view === 'recurring' ? (
          <RecurringExpensesPage
            dashboard={dashboard}
            recurringExpenses={recurringExpenses}
            monthLabel={monthLabel}
            busy={busy}
            editing={editingRecurring}
            onSubmit={saveRecurringExpense}
            onEdit={entry => {
              setEditingRecurring(entry)
              setError('')
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            onRemove={id => { void removeRecurringExpense(id) }}
            onMarkPaid={id => { void markRecurringExpensePaid(id) }}
            onCancelEdit={() => {
              setEditingRecurring(null)
              setError('')
            }}
          />
        ) : view === 'budgets' ? (
          <BudgetPage
            dashboard={dashboard}
            budgets={budgets}
            monthLabel={monthLabel}
            busy={busy}
            onSave={saveBudget}
            onRemove={id => { void removeBudget(id) }}
          />
        ) : view === 'debts' ? (
          <DebtPage
            dashboard={dashboard}
            debts={data.debts as Debt[]}
            debtPayments={debtPayments}
            editing={editing}
            selectedDebtId={selectedDebtId}
            busy={busy}
            onSave={save}
            onEdit={debt => startEdit('debts', debt)}
            onRemove={id => { void remove('debts', id) }}
            onCancelEdit={cancelEdit}
            onOpenPayments={id => { void openDebtPayments(id) }}
            onClosePayments={() => {
              setSelectedDebtId(null)
              setDebtPayments([])
            }}
            onAddPayment={addDebtPayment}
            onRemovePayment={id => { void removeDebtPayment(id) }}
          />
        ) : view === 'goals' ? (
          <GoalsPage
            dashboard={dashboard}
            goals={data.goals}
            movements={goalMovements}
            editing={editing}
            selectedGoalId={selectedGoalId}
            busy={busy}
            onSave={save}
            onEdit={goal => startEdit('goals', goal)}
            onRemove={id => { void remove('goals', id) }}
            onCancelEdit={cancelEdit}
            onOpenMovements={id => { void openGoalMovements(id) }}
            onCloseMovements={() => {
              setSelectedGoalId(null)
              setGoalMovements([])
            }}
            onAddMovement={addGoalMovement}
            onRemoveMovement={id => { void removeGoalMovement(id) }}
          />
        ) : view === 'incomes' ? (
          <div className="records-layout">
            <section className="panel records-panel">
              <div className="panel__header records-panel__header">
                <div>
                  <span className="panel__eyebrow">ENTRADAS</span>
                  <h2>Receitas cadastradas</h2>
                </div>
                <span className="records-count">{incomes.length} {incomes.length === 1 ? 'item' : 'itens'}</span>
              </div>

              <div className="income-summary-strip">
                <div><span>Salário mensal</span><strong>{money(dashboard.salary)}</strong></div>
                <div><span>Extras deste mês</span><strong>{money(dashboard.extras)}</strong></div>
                <div><span>Total mensal</span><strong>{money(dashboard.income)}</strong></div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead><tr><th>Descrição</th><th>Tipo / referência</th><th>Valor</th><th className="table-action">Ação</th></tr></thead>
                  <tbody>
                    {incomes.map(entry => (
                      <tr key={entry.id}>
                        <td>
                          <div className="record-name">
                            <span className="record-icon record-icon--incomes"><Icon name="income" size={17} /></span>
                            <div><strong>{entry.name}</strong><span>{entry.type === 'salary' ? `Mensal • ${entry.active ? 'ativa' : 'inativa'}` : 'Receita extraordinária'}</span></div>
                          </div>
                        </td>
                        <td>
                          <span className={`income-type income-type--${entry.type}`}>{entry.type === 'salary' ? 'Salário' : 'Extra'}</span>
                          <small className="income-date">
                            {entry.type === 'salary'
                              ? `${new Date(entry.activeFrom + 'T12:00:00').toLocaleDateString('pt-BR')} → ${effectiveIncomeEnd(entry) ? new Date(effectiveIncomeEnd(entry)! + 'T12:00:00').toLocaleDateString('pt-BR') : 'atual'}`
                              : new Date(entry.receivedAt.replace(' ', 'T') + 'Z').toLocaleDateString('pt-BR')}
                          </small>
                        </td>
                        <td><strong className="table-value">{money(entry.value)}</strong></td>
                        <td className="table-action">
                          <div className="table-actions">
                            <button className="icon-action" disabled={busy} onClick={() => startEdit('incomes', entry)} aria-label={`Editar ${entry.name}`}><Icon name="edit" size={17} /></button>
                            <button className="icon-action icon-action--danger" disabled={busy} onClick={() => remove('incomes', entry.id)} aria-label={`Excluir ${entry.name}`}><Icon name="trash" size={17} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!incomes.length && (
                      <tr><td colSpan={4} className="table-empty"><div className="empty-block__icon"><Icon name="income" size={22} /></div><strong>Nenhuma receita cadastrada.</strong><span>Cadastre primeiro seu salário mensal e depois as receitas extras.</span></td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <aside className="panel record-form-panel">
              <span className="panel__eyebrow">{editing?.kind === 'incomes' ? 'EDITAR RECEITA' : 'NOVA RECEITA'}</span>
              <h2>{editing?.kind === 'incomes' ? 'Atualizar entrada' : 'Adicionar entrada'}</h2>
              <p>Salários são recorrentes durante o período de vigência. Receitas extras entram somente no mês informado.</p>
              <form key={`incomes-${editing?.kind === 'incomes' ? editing.entry.id : 'new'}`} onSubmit={save}>
                <label><span>Descrição</span><input name="name" defaultValue={editing?.kind === 'incomes' ? editing.entry.name : ''} placeholder="Ex.: Salário empresa / Freelance" required maxLength={120} /></label>
                <label><span>Tipo de receita</span><select name="type" defaultValue={editing?.kind === 'incomes' ? editing.entry.type : 'salary'}><option value="salary">Salário mensal</option><option value="extra">Renda extra</option></select></label>
                <label><span>Valor</span><div className="money-input"><span>R$</span><input name="value" type="number" min="0.01" max="100000000" step="0.01" defaultValue={editing?.kind === 'incomes' ? editing.entry.value : undefined} placeholder="0,00" required /></div></label>
                <label><span>Data de referência / início</span><input name="date" type="date" defaultValue={editing?.kind === 'incomes' ? (editing.entry.type === 'salary' ? editing.entry.activeFrom : editing.entry.receivedAt.slice(0, 10)) : currentDateKey()} required /></label>
                <label><span>Vigente até (opcional para salário)</span><input name="activeUntil" type="date" defaultValue={editing?.kind === 'incomes' ? editing.entry.activeUntil ?? '' : ''} /></label>
                <label className="check-field"><input name="active" type="checkbox" defaultChecked={editing?.kind === 'incomes' ? editing.entry.active : true} /><span>Receita ativa</span></label>
                <div className="form-actions">
                  <button className="primary primary--full" disabled={busy}>{busy ? 'Salvando…' : editing?.kind === 'incomes' ? 'Atualizar receita' : 'Salvar receita'}{!busy && <Icon name="arrow" size={17} />}</button>
                  {editing?.kind === 'incomes' && <button type="button" className="secondary-button" onClick={cancelEdit}>Cancelar edição</button>}
                </div>
              </form>
              <div className="form-security"><Icon name="shield" size={17} /><span>O registro será salvo apenas na sua conta.</span></div>
            </aside>
          </div>
        ) : (
          <TransactionsPage
            entries={data.transactions}
            editing={editing}
            busy={busy}
            onSave={save}
            onEdit={entry => startEdit('transactions', entry)}
            onRemove={id => { void remove('transactions', id) }}
            onCancelEdit={cancelEdit}
          />
        )}
      </main>

      {passwordOpen && (
        <div className="security-modal-backdrop" role="presentation" onMouseDown={event => {
          if (event.target === event.currentTarget) closePasswordDialog()
        }}>
          <section className="security-modal" role="dialog" aria-modal="true" aria-labelledby="change-password-title">
            <div className="security-modal__header">
              <div>
                <span className="panel__eyebrow">SEGURANÇA DA CONTA</span>
                <h2 id="change-password-title">Alterar senha</h2>
                <p>Ao salvar, as outras sessões da sua conta serão encerradas.</p>
              </div>
              <button className="icon-action" type="button" onClick={closePasswordDialog} aria-label="Fechar alteração de senha">
                <Icon name="close" size={19} />
              </button>
            </div>

            {passwordChanged ? (
              <div className="security-success" role="status">
                <Icon name="shield" size={19} />
                <div>
                  <strong>Senha alterada com sucesso.</strong>
                  <span>Este dispositivo continua conectado e as outras sessões foram encerradas.</span>
                </div>
                <button className="secondary-button" type="button" onClick={closePasswordDialog}>Fechar</button>
              </div>
            ) : (
              <form className="security-form" onSubmit={changePassword}>
                <label>
                  <span>Senha atual</span>
                  <input name="currentPassword" type="password" minLength={12} maxLength={128} autoComplete="current-password" required />
                </label>
                <label>
                  <span>Nova senha</span>
                  <input name="newPassword" type="password" minLength={12} maxLength={128} autoComplete="new-password" required />
                  <small>Use entre 12 e 128 caracteres.</small>
                </label>
                <label>
                  <span>Confirmar nova senha</span>
                  <input name="confirmation" type="password" minLength={12} maxLength={128} autoComplete="new-password" required />
                </label>

                {passwordError && <div className="security-error" role="alert">{passwordError}</div>}

                <div className="form-actions">
                  <button className="primary primary--full" disabled={passwordBusy}>
                    {passwordBusy ? 'Alterando…' : 'Salvar nova senha'}
                    {!passwordBusy && <Icon name="shield" size={17} />}
                  </button>
                  <button className="secondary-button" type="button" onClick={closePasswordDialog} disabled={passwordBusy}>Cancelar</button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}

      {deleteAccountOpen && (
        <div className="security-modal-backdrop" role="presentation" onMouseDown={event => {
          if (event.target === event.currentTarget) closeDeleteAccountDialog()
        }}>
          <section className="security-modal security-modal--danger" role="dialog" aria-modal="true" aria-labelledby="delete-account-title">
            <div className="security-modal__header">
              <div>
                <span className="panel__eyebrow danger-eyebrow">ÁREA DE RISCO</span>
                <h2 id="delete-account-title">Excluir conta</h2>
                <p>Esta ação remove definitivamente seus gastos, receitas, dívidas, pagamentos, metas, orçamentos e sessões.</p>
              </div>
              <button className="icon-action" type="button" onClick={closeDeleteAccountDialog} aria-label="Fechar exclusão de conta">
                <Icon name="close" size={19} />
              </button>
            </div>

            <form className="security-form" onSubmit={deleteAccount}>
              <div className="danger-warning">
                <Icon name="trash" size={19} />
                <div>
                  <strong>Esta ação não pode ser desfeita.</strong>
                  <span>Confirme sua senha e digite EXCLUIR no campo abaixo.</span>
                </div>
              </div>

              <label>
                <span>Senha atual</span>
                <input name="password" type="password" minLength={12} maxLength={128} autoComplete="current-password" required />
              </label>
              <label>
                <span>Confirmação</span>
                <input name="confirmation" type="text" placeholder="EXCLUIR" autoComplete="off" required />
              </label>

              {deleteAccountError && <div className="security-error" role="alert">{deleteAccountError}</div>}

              <div className="form-actions">
                <button className="danger-button primary--full" disabled={deleteAccountBusy}>
                  {deleteAccountBusy ? 'Excluindo…' : 'Excluir minha conta'}
                  {!deleteAccountBusy && <Icon name="trash" size={17} />}
                </button>
                <button className="secondary-button" type="button" onClick={closeDeleteAccountDialog} disabled={deleteAccountBusy}>Cancelar</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}
