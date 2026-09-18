import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { api } from './api'

type Kind = 'transactions' | 'debts' | 'goals'
type View = Kind | 'incomes' | 'budgets' | 'overview'
type Category = 'Casa' | 'Comida' | 'Transporte' | 'Lazer' | 'Outros'
type Entry = {
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
type Debt = Entry & {
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
type DebtPayment = {
  id: number
  debtId: number
  amount: number
  paymentDate: string
  note: string
  countsAsInstallment: boolean
  createdAt: string
}
type Budget = {
  id: number
  month: string
  category: Category
  limit: number
  createdAt: string
  updatedAt: string
}
type Income = {
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
type EditState =
  | { kind: Kind; entry: Entry }
  | { kind: 'incomes'; entry: Income }
  | null
type User = { id: number; email: string }

const titles: Record<View, string> = {
  overview: 'Visão geral',
  incomes: 'Receitas',
  budgets: 'Orçamentos',
  transactions: 'Gastos',
  debts: 'Dívidas',
  goals: 'Metas',
}

const descriptions: Record<View, string> = {
  overview: 'Receitas, gastos, dívidas e metas no mesmo panorama.',
  incomes: 'Cadastre seu salário mensal e todas as rendas extras.',
  budgets: 'Defina limites mensais por categoria e acompanhe o consumo.',
  transactions: 'Acompanhe para onde o seu dinheiro está indo.',
  debts: 'Organize os valores que ainda precisam ser pagos.',
  goals: 'Transforme objetivos em progresso visível.',
}

const categories: readonly Category[] = ['Casa', 'Comida', 'Transporte', 'Lazer', 'Outros']

const categoryColor: Record<Category, string> = {
  Casa: '#58d6a3',
  Comida: '#7ca8ff',
  Transporte: '#f1c96b',
  Lazer: '#bd91ff',
  Outros: '#ff8f96',
}

const money = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const currentMonthKey = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const shiftMonthKey = (monthKey: string, offset: number) => {
  const [year, month] = monthKey.split('-').map(Number)
  const date = new Date(year, month - 1 + offset, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

const formatMonth = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
    .format(new Date(year, month - 1, 1))
    .replace(/^./, letter => letter.toUpperCase())
}

const percent = (value: number) => `${Math.round(Math.max(0, Math.min(100, value)))}%`

function Icon({ name, size = 20 }: { name: 'overview' | 'income' | 'budget' | 'wallet' | 'debt' | 'goal' | 'logout' | 'plus' | 'menu' | 'close' | 'arrow' | 'edit' | 'trash' | 'shield' | 'calendar'; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  const paths: Record<typeof name, ReactNode> = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="5" rx="2" /><rect x="14" y="12" width="7" height="9" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /></>,
    income: <><path d="M12 3v18" /><path d="m7 8 5-5 5 5" /><path d="M5 14h14" /><path d="M5 18h14" /></>,
    budget: <><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h10" /><circle cx="18" cy="18" r="3" /></>,
    wallet: <><path d="M4 7.5h13.5A2.5 2.5 0 0 1 20 10v7.5A2.5 2.5 0 0 1 17.5 20h-13A2.5 2.5 0 0 1 2 17.5v-11A2.5 2.5 0 0 1 4.5 4H17v3.5" /><path d="M15.5 12h4.5v4h-4.5a2 2 0 1 1 0-4Z" /></>,
    debt: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 10h18" /><path d="M7 15h4" /></>,
    goal: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><path d="M12 4V2" /><path d="M20 12h2" /></>,
    logout: <><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /><path d="M14 4h4a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3h-4" /></>,
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    menu: <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>,
    close: <><path d="M6 6l12 12" /><path d="M18 6L6 18" /></>,
    arrow: <><path d="M5 12h14" /><path d="m14 7 5 5-5 5" /></>,
    edit: <><path d="M4 20h4l11-11-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></>,
    trash: <><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M7 7l1 13h8l1-13" /><path d="M10 11v5" /><path d="M14 11v5" /></>,
    shield: <><path d="M12 3 5 6v5c0 4.7 2.7 8 7 10 4.3-2 7-5.3 7-10V6l-7-3Z" /><path d="m9.5 12 1.7 1.7 3.6-4" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4" /><path d="M16 3v4" /><path d="M3 10h18" /></>,
  }

  return <svg {...common}>{paths[name]}</svg>
}

function MetricCard({
  label,
  value,
  detail,
  icon,
  tone = 'default',
}: {
  label: string
  value: string
  detail: string
  icon: 'income' | 'budget' | 'wallet' | 'debt' | 'goal'
  tone?: 'default' | 'accent' | 'warning'
}) {
  return (
    <article className={`metric-card metric-card--${tone}`}>
      <div className="metric-card__top">
        <span className="metric-card__label">{label}</span>
        <span className="metric-card__icon"><Icon name={icon} size={18} /></span>
      </div>
      <strong>{value}</strong>
      <span className="metric-card__detail">{detail}</span>
    </article>
  )
}

export function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [register, setRegister] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
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
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey())
  const [budgets, setBudgets] = useState<Budget[]>([])

  const load = async () => {
    const [transactions, debts, goals, incomeEntries] = await Promise.all([
      api.request<Entry[]>('transactions'),
      api.request<Debt[]>('debts'),
      api.request<Entry[]>('goals'),
      api.request<Income[]>('incomes'),
    ])
    setData({ transactions, debts, goals })
    setIncomes(incomeEntries)
  }

  useEffect(() => {
    api.request<User>('me')
      .then(async currentUser => {
        await load()
        setUser(currentUser)
      })
      .catch(e => {
        if (e.message !== 'Entre na sua conta.' && e.message !== 'Sessão expirada.') {
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

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      const currentUser = await api.request<User>(register ? 'register' : 'login', 'POST', {
        email: form.get('email'),
        password: form.get('password'),
      })
      await load()
      setUser(currentUser)
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
      setBudgets([])
      setSelectedMonth(currentMonthKey())
      setView('overview')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (view === 'overview') return
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
      } else {
        const isEditing = editing?.kind === view
        const payload = {
          name: form.get('name'),
          category: form.get('category'),
          value: Number(form.get('value')),
          target: Number(form.get('value')),
          saved: Number(form.get('saved') ?? 0),
          transactionDate: form.get('transactionDate'),
        }
        const entry = await api.request<Entry>(
          isEditing ? `${view}/${editing.entry.id}` : view,
          isEditing ? 'PUT' : 'POST',
          payload,
        )
        setData(current => ({
          ...current,
          [view]: isEditing
            ? current[view].map(item => item.id === entry.id ? entry : item)
            : [entry, ...current[view]],
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
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const dashboard = useMemo(() => {
    const monthKey = selectedMonth
    const monthStart = `${monthKey}-01`
    const monthEnd = `${monthKey}-31`
    const belongsToMonth = (raw: string | null | undefined) => Boolean(raw && raw.slice(0, 7) === monthKey)

    const monthly = data.transactions.filter(entry => belongsToMonth(entry.transactionDate))
    const spent = monthly.reduce((total, entry) => total + entry.value, 0)
    const activeSalaries = incomes.filter(entry =>
      entry.type === 'salary'
      && entry.activeFrom <= monthEnd
      && (
        (entry.activeUntil && entry.activeUntil >= monthStart)
        || (!entry.activeUntil && entry.active)
      ),
    )
    const salary = activeSalaries.reduce((total, entry) => total + entry.value, 0)
    const monthlyExtras = incomes.filter(entry => entry.type === 'extra' && belongsToMonth(entry.receivedAt))
    const extras = monthlyExtras.reduce((total, entry) => total + entry.value, 0)
    const income = salary + extras
    const balance = income - spent
    const debtEntries = data.debts as Debt[]
    const debt = debtEntries.reduce((total, entry) => total + entry.currentBalance, 0)
    const debtOriginal = debtEntries.reduce((total, entry) => total + entry.originalAmount, 0)
    const debtPaid = debtEntries.reduce((total, entry) => total + entry.paidAmount, 0)
    const debtProgress = debtOriginal > 0 ? (debtPaid / debtOriginal) * 100 : 0
    const debtMonths = income > 0 ? debt / income : 0
    const saved = data.goals.reduce((total, entry) => total + entry.saved, 0)
    const targets = data.goals.reduce((total, entry) => total + entry.target, 0)
    const goalProgress = targets > 0 ? (saved / targets) * 100 : 0
    const categoriesData = categories.map(category => {
      const total = monthly
        .filter(entry => entry.category === category)
        .reduce((sum, entry) => sum + entry.value, 0)
      return {
        category,
        total,
        share: spent > 0 ? (total / spent) * 100 : 0,
      }
    }).filter(item => item.total > 0)
    const budgetData = categories.map(category => {
      const budget = budgets.find(item => item.category === category)
      const spentInCategory = monthly
        .filter(entry => entry.category === category)
        .reduce((sum, entry) => sum + entry.value, 0)
      const limit = budget?.limit ?? 0
      return {
        category,
        budget,
        limit,
        spent: spentInCategory,
        remaining: limit - spentInCategory,
        usage: limit > 0 ? (spentInCategory / limit) * 100 : 0,
      }
    })
    const budgetTotal = budgetData.reduce((total, item) => total + item.limit, 0)
    const budgetedSpent = budgetData.filter(item => item.limit > 0).reduce((total, item) => total + item.spent, 0)
    const budgetRemaining = budgetTotal - budgetedSpent
    const budgetUsage = budgetTotal > 0 ? (budgetedSpent / budgetTotal) * 100 : 0

    return {
      monthly,
      spent,
      activeSalaries,
      salary,
      monthlyExtras,
      extras,
      income,
      balance,
      debt,
      debtOriginal,
      debtPaid,
      debtProgress,
      debtMonths,
      saved,
      targets,
      goalProgress,
      categoriesData,
      budgetData,
      budgetTotal,
      budgetedSpent,
      budgetRemaining,
      budgetUsage,
    }
  }, [data, incomes, budgets, selectedMonth])

  const historyData = useMemo(() => {
    return Array.from({ length: 6 }, (_, index) => shiftMonthKey(selectedMonth, index - 5)).map(monthKey => {
      const monthStart = `${monthKey}-01`
      const monthEnd = `${monthKey}-31`
      const expenses = data.transactions
        .filter(entry => entry.transactionDate?.slice(0, 7) === monthKey)
        .reduce((total, entry) => total + entry.value, 0)
      const salaries = incomes
        .filter(entry =>
          entry.type === 'salary'
          && entry.activeFrom <= monthEnd
          && ((entry.activeUntil && entry.activeUntil >= monthStart) || (!entry.activeUntil && entry.active)),
        )
        .reduce((total, entry) => total + entry.value, 0)
      const extras = incomes
        .filter(entry => entry.type === 'extra' && entry.receivedAt?.slice(0, 7) === monthKey)
        .reduce((total, entry) => total + entry.value, 0)
      const income = salaries + extras
      return { monthKey, income, expenses, balance: income - expenses }
    })
  }, [data.transactions, incomes, selectedMonth])

  const historyMax = Math.max(1, ...historyData.flatMap(item => [item.income, item.expenses]))

  const monthLabel = formatMonth(selectedMonth)

  const navigate = (next: View) => {
    setView(next)
    setMenu(false)
    setEditing(null)
    if (next !== 'debts') {
      setSelectedDebtId(null)
      setDebtPayments([])
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
              <button className="primary primary--full" disabled={busy}>
                {busy ? 'Aguarde…' : register ? 'Criar conta' : 'Entrar no ZEUS'}
                {!busy && <Icon name="arrow" size={18} />}
              </button>
            </form>

            <button className="switch-auth" onClick={() => { setRegister(!register); setError('') }}>
              {register ? 'Já tenho uma conta' : 'Ainda não tenho conta'}
            </button>
            {error && <p role="alert" className="alert alert--error">{error}</p>}
          </div>
        </section>
      </main>
    )
  }

  const navItems: Array<{ key: View; label: string; icon: 'overview' | 'income' | 'budget' | 'wallet' | 'debt' | 'goal' }> = [
    { key: 'overview', label: 'Visão geral', icon: 'overview' },
    { key: 'incomes', label: 'Receitas', icon: 'income' },
    { key: 'budgets', label: 'Orçamentos', icon: 'budget' },
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
                  {item.key === 'incomes' ? incomes.length : item.key === 'budgets' ? budgets.length : item.key === 'transactions' ? data.transactions.length : item.key === 'debts' ? data.debts.length : data.goals.length}
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
              <span className="section-kicker">{view === 'overview' ? monthLabel : 'ZEUS FINANCE'}</span>
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

        {(view === 'overview' || view === 'budgets') && (
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

        {error && <p role="alert" className="alert alert--error">{error}</p>}

        {view === 'overview' ? (
          <div className="dashboard">
            <section className="dashboard-hero">
              <div className="dashboard-hero__main">
                <div className="hero-icon"><Icon name="income" size={22} /></div>
                <div>
                  <span>Receita total do período</span>
                  <strong>{money(dashboard.income)}</strong>
                  <p>{dashboard.income > 0 ? `Salário + ${dashboard.monthlyExtras.length} receita${dashboard.monthlyExtras.length === 1 ? '' : 's'} extra${dashboard.monthlyExtras.length === 1 ? '' : 's'} em ${monthLabel.toLowerCase()}` : 'Cadastre seu salário e suas receitas extras'}</p>
                </div>
              </div>
              <div className="dashboard-hero__aside">
                <div>
                  <span>Salário mensal</span>
                  <strong>{money(dashboard.salary)}</strong>
                </div>
                <div>
                  <span>Extras do período</span>
                  <strong>{money(dashboard.extras)}</strong>
                </div>
              </div>
            </section>

            <section className="metrics-grid" aria-label="Resumo financeiro">
              <MetricCard
                label="Saldo após gastos"
                value={money(dashboard.balance)}
                detail={dashboard.income > 0 ? `${percent((dashboard.spent / dashboard.income) * 100)} da renda já foi consumida por gastos` : 'Cadastre uma receita para calcular o saldo'}
                icon="income"
                tone={dashboard.balance >= 0 ? 'accent' : 'warning'}
              />
              <MetricCard
                label="Gastos no período"
                value={money(dashboard.spent)}
                detail={dashboard.monthly.length ? `${dashboard.monthly.length} lançamento${dashboard.monthly.length === 1 ? '' : 's'} registrado${dashboard.monthly.length === 1 ? '' : 's'}` : 'Nenhum gasto no mês'}
                icon="wallet"
              />
              <MetricCard
                label="Dívida total"
                value={money(dashboard.debt)}
                detail={dashboard.debt > 0 && dashboard.income > 0 ? `Equivale a ${dashboard.debtMonths.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mês(es) da renda atual` : data.debts.length ? `${data.debts.length} dívida${data.debts.length === 1 ? '' : 's'} cadastrada${data.debts.length === 1 ? '' : 's'}` : 'Nenhuma dívida cadastrada'}
                icon="debt"
                tone="warning"
              />
            </section>

            <section className="dashboard-grid">
              <article className="panel spending-panel">
                <div className="panel__header">
                  <div>
                    <span className="panel__eyebrow">DISTRIBUIÇÃO</span>
                    <h2>Gastos por categoria</h2>
                  </div>
                  <span className="period-chip"><Icon name="calendar" size={15} /> {monthLabel}</span>
                </div>

                {dashboard.spent === 0 ? (
                  <div className="empty-block">
                    <div className="empty-block__icon"><Icon name="wallet" size={23} /></div>
                    <h3>Ainda não há gastos neste mês.</h3>
                    <p>Adicione o primeiro lançamento para visualizar a distribuição por categoria.</p>
                    <button className="secondary-button" onClick={() => navigate('transactions')}>
                      Registrar gasto
                    </button>
                  </div>
                ) : (
                  <div className="spending-layout">
                    <div
                      className="donut"
                      style={{
                        background: `conic-gradient(${dashboard.categoriesData.map((item, index, items) => {
                          const start = items.slice(0, index).reduce((sum, current) => sum + current.share, 0)
                          const end = start + item.share
                          return `${categoryColor[item.category]} ${start}% ${end}%`
                        }).join(', ')})`,
                      }}
                      aria-label="Distribuição de gastos por categoria"
                    >
                      <div className="donut__center">
                        <span>Total</span>
                        <strong>{money(dashboard.spent)}</strong>
                      </div>
                    </div>

                    <div className="category-list">
                      {dashboard.categoriesData
                        .sort((a, b) => b.total - a.total)
                        .map(item => (
                          <div className="category-row" key={item.category}>
                            <span className="category-dot" style={{ background: categoryColor[item.category] }} />
                            <div className="category-row__name">
                              <strong>{item.category}</strong>
                              <span>{percent(item.share)} do total</span>
                            </div>
                            <strong className="category-row__value">{money(item.total)}</strong>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </article>

              <article className="panel budget-panel">
                <div className="panel__header">
                  <div>
                    <span className="panel__eyebrow">PLANEJAMENTO</span>
                    <h2>Orçamento mensal</h2>
                  </div>
                  <button className="link-button" onClick={() => navigate('budgets')}>
                    Ajustar limites <Icon name="arrow" size={16} />
                  </button>
                </div>

                {dashboard.budgetTotal > 0 ? (
                  <div className="budget-overview">
                    <div className="budget-overview__summary">
                      <div>
                        <span>Limites definidos</span>
                        <strong>{money(dashboard.budgetTotal)}</strong>
                      </div>
                      <div>
                        <span>Gasto nas categorias orçadas</span>
                        <strong>{money(dashboard.budgetedSpent)}</strong>
                      </div>
                      <div>
                        <span>Disponível</span>
                        <strong className={dashboard.budgetRemaining < 0 ? 'negative-value' : ''}>{money(dashboard.budgetRemaining)}</strong>
                      </div>
                    </div>
                    <div className="progress-track budget-total-progress">
                      <span style={{ width: percent(dashboard.budgetUsage) }} />
                    </div>
                    <div className="budget-overview__footer">
                      <span>{percent(dashboard.budgetUsage)} dos limites consumidos</span>
                      {dashboard.budgetRemaining < 0 && <strong>Excedido em {money(Math.abs(dashboard.budgetRemaining))}</strong>}
                    </div>

                    <div className="budget-mini-list">
                      {dashboard.budgetData.filter(item => item.limit > 0).map(item => (
                        <div className="budget-mini-row" key={item.category}>
                          <span className="category-dot" style={{ background: categoryColor[item.category] }} />
                          <div>
                            <strong>{item.category}</strong>
                            <span>{money(item.spent)} de {money(item.limit)}</span>
                          </div>
                          <strong className={item.remaining < 0 ? 'negative-value' : ''}>{percent(item.usage)}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mini-empty mini-empty--tall">
                    <div className="empty-block__icon"><Icon name="budget" size={21} /></div>
                    <strong>Nenhum limite definido para {monthLabel.toLowerCase()}.</strong>
                    <span>Defina quanto pretende gastar em cada categoria.</span>
                    <button className="secondary-button" onClick={() => navigate('budgets')}>Criar orçamento</button>
                  </div>
                )}
              </article>

              <article className="panel debt-panel">
                <div className="panel__header">
                  <div>
                    <span className="panel__eyebrow">COMPROMISSOS</span>
                    <h2>Dívidas</h2>
                  </div>
                  <button className="link-button" onClick={() => navigate('debts')}>
                    Gerenciar <Icon name="arrow" size={16} />
                  </button>
                </div>

                <div className="compact-list">
                  {(data.debts as Debt[]).filter(entry => entry.status === 'active').slice(0, 4).map(entry => (
                    <div className="compact-row" key={entry.id}>
                      <span className="compact-row__icon compact-row__icon--debt"><Icon name="debt" size={17} /></span>
                      <div>
                        <strong>{entry.name}</strong>
                        <span>{entry.installmentsTotal > 0 ? `${entry.installmentsPaid}/${entry.installmentsTotal} parcelas` : `${percent(entry.originalAmount > 0 ? (entry.paidAmount / entry.originalAmount) * 100 : 0)} quitado`}</span>
                      </div>
                      <strong className="compact-row__value">{money(entry.currentBalance)}</strong>
                    </div>
                  ))}
                  {!(data.debts as Debt[]).some(entry => entry.status === 'active') && (
                    <div className="mini-empty">
                      <span>Nenhuma dívida ativa.</span>
                      <button className="link-button" onClick={() => navigate('debts')}>Adicionar dívida</button>
                    </div>
                  )}
                </div>

                {data.debts.length > 0 && (
                  <div className="panel-total">
                    <span>Saldo devedor • {percent(dashboard.debtProgress)} já quitado</span>
                    <strong>{money(dashboard.debt)}</strong>
                  </div>
                )}
              </article>

              <article className="panel goals-panel">
                <div className="panel__header">
                  <div>
                    <span className="panel__eyebrow">PROGRESSO</span>
                    <h2>Metas</h2>
                  </div>
                  <button className="link-button" onClick={() => navigate('goals')}>
                    Ver metas <Icon name="arrow" size={16} />
                  </button>
                </div>

                {data.goals.length ? (
                  <div className="goal-overview">
                    <div className="goal-overview__summary">
                      <div>
                        <span>Reservado</span>
                        <strong>{money(dashboard.saved)}</strong>
                      </div>
                      <strong className="goal-overview__percent">{percent(dashboard.goalProgress)}</strong>
                    </div>
                    <div className="progress-track">
                      <span style={{ width: percent(dashboard.goalProgress) }} />
                    </div>
                    <div className="goal-overview__footer">
                      <span>Objetivo total</span>
                      <strong>{money(dashboard.targets)}</strong>
                    </div>

                    <div className="goal-preview-list">
                      {data.goals.slice(0, 3).map(goal => {
                        const progress = goal.target > 0 ? (goal.saved / goal.target) * 100 : 0
                        return (
                          <div className="goal-preview" key={goal.id}>
                            <div>
                              <strong>{goal.name}</strong>
                              <span>{money(goal.saved)} de {money(goal.target)}</span>
                            </div>
                            <span className="goal-preview__percent">{percent(progress)}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="mini-empty mini-empty--tall">
                    <div className="empty-block__icon"><Icon name="goal" size={21} /></div>
                    <strong>Defina seu próximo objetivo.</strong>
                    <span>Crie uma meta e acompanhe quanto já foi reservado.</span>
                    <button className="secondary-button" onClick={() => navigate('goals')}>Criar meta</button>
                  </div>
                )}
              </article>
            </section>
            <section className="panel history-panel">
              <div className="panel__header">
                <div>
                  <span className="panel__eyebrow">HISTÓRICO</span>
                  <h2>Últimos 6 meses até {monthLabel.toLowerCase()}</h2>
                </div>
                <span className="period-chip"><Icon name="calendar" size={15} /> 6 meses</span>
              </div>
              <div className="history-list">
                {historyData.map(item => (
                  <div className="history-row" key={item.monthKey}>
                    <div className="history-row__month">
                      <strong>{formatMonth(item.monthKey).split(' de ')[0]}</strong>
                      <span>{item.monthKey.slice(0, 4)}</span>
                    </div>
                    <div className="history-bars">
                      <div className="history-bar history-bar--income" title={`Receitas: ${money(item.income)}`}>
                        <span style={{ width: `${(item.income / historyMax) * 100}%` }} />
                      </div>
                      <div className="history-bar history-bar--expense" title={`Gastos: ${money(item.expenses)}`}>
                        <span style={{ width: `${(item.expenses / historyMax) * 100}%` }} />
                      </div>
                    </div>
                    <div className="history-row__values">
                      <span>{money(item.income)} entrada</span>
                      <span>{money(item.expenses)} saída</span>
                    </div>
                    <strong className={item.balance < 0 ? 'negative-value' : 'positive-value'}>{money(item.balance)}</strong>
                  </div>
                ))}
              </div>
              <div className="history-legend">
                <span><i className="history-legend__income" /> Receitas</span>
                <span><i className="history-legend__expense" /> Gastos</span>
                <span>Valor à direita = saldo do mês</span>
              </div>
            </section>
          </div>
        ) : view === 'budgets' ? (
          <div className="budget-page">
            <section className="budget-summary-grid">
              <MetricCard
                label="Orçamento definido"
                value={money(dashboard.budgetTotal)}
                detail={dashboard.budgetTotal > 0 ? `${budgets.length} categoria${budgets.length === 1 ? '' : 's'} com limite` : 'Nenhum limite definido neste mês'}
                icon="budget"
              />
              <MetricCard
                label="Consumido"
                value={money(dashboard.budgetedSpent)}
                detail={dashboard.budgetTotal > 0 ? `${percent(dashboard.budgetUsage)} dos limites definidos` : 'Defina limites para acompanhar o uso'}
                icon="wallet"
                tone={dashboard.budgetUsage > 100 ? 'warning' : 'default'}
              />
              <MetricCard
                label="Disponível"
                value={money(dashboard.budgetRemaining)}
                detail={dashboard.budgetRemaining < 0 ? `Orçamento excedido em ${money(Math.abs(dashboard.budgetRemaining))}` : 'Quanto ainda resta nas categorias orçadas'}
                icon="income"
                tone={dashboard.budgetRemaining < 0 ? 'warning' : 'accent'}
              />
            </section>

            <section className="budget-category-grid">
              {dashboard.budgetData.map(item => (
                <article className={`panel budget-category-card ${item.remaining < 0 ? 'budget-category-card--over' : ''}`} key={item.category}>
                  <div className="budget-category-card__header">
                    <div>
                      <span className="category-dot" style={{ background: categoryColor[item.category] }} />
                      <div>
                        <strong>{item.category}</strong>
                        <span>{item.budget ? 'Limite configurado' : 'Sem limite para este mês'}</span>
                      </div>
                    </div>
                    {item.budget && <button className="icon-action icon-action--danger" onClick={() => removeBudget(item.budget!.id)} aria-label={`Remover orçamento de ${item.category}`}><Icon name="trash" size={16} /></button>}
                  </div>

                  <div className="budget-category-card__numbers">
                    <div><span>Gasto</span><strong>{money(item.spent)}</strong></div>
                    <div><span>Limite</span><strong>{item.limit > 0 ? money(item.limit) : '—'}</strong></div>
                    <div><span>Restante</span><strong className={item.remaining < 0 ? 'negative-value' : ''}>{item.limit > 0 ? money(item.remaining) : '—'}</strong></div>
                  </div>

                  <div className="progress-track budget-category-progress">
                    <span style={{ width: item.limit > 0 ? percent(item.usage) : '0%' }} />
                  </div>
                  <div className="budget-category-card__usage">
                    <span>{item.limit > 0 ? `${percent(item.usage)} utilizado` : 'Defina um limite abaixo'}</span>
                    {item.remaining < 0 && <strong>Excedido</strong>}
                  </div>

                  <form className="budget-inline-form" onSubmit={event => saveBudget(event, item.category)}>
                    <label>
                      <span>Limite para {monthLabel.toLowerCase()}</span>
                      <div className="money-input">
                        <span>R$</span>
                        <input name="limit" type="number" min="0.01" max="100000000" step="0.01" defaultValue={item.limit || undefined} placeholder="0,00" required />
                      </div>
                    </label>
                    <button className="primary" disabled={busy}>{item.budget ? 'Atualizar' : 'Definir limite'}</button>
                  </form>
                </article>
              ))}
            </section>
          </div>
        ) : view === 'debts' ? (
          <div className="debt-page">
            <section className="debt-summary-grid" aria-label="Resumo das dívidas">
              <article className="metric-card metric-card--warning">
                <div className="metric-card__top"><span className="metric-card__label">Saldo devedor atual</span><span className="metric-card__icon"><Icon name="debt" size={18} /></span></div>
                <strong>{money(dashboard.debt)}</strong>
                <span className="metric-card__detail">{(data.debts as Debt[]).filter(debt => debt.status === 'active').length} dívida(s) ativa(s)</span>
              </article>
              <article className="metric-card">
                <div className="metric-card__top"><span className="metric-card__label">Valor original</span><span className="metric-card__icon"><Icon name="debt" size={18} /></span></div>
                <strong>{money(dashboard.debtOriginal)}</strong>
                <span className="metric-card__detail">Soma dos valores originais cadastrados</span>
              </article>
              <article className="metric-card metric-card--accent">
                <div className="metric-card__top"><span className="metric-card__label">Total já pago</span><span className="metric-card__icon"><Icon name="income" size={18} /></span></div>
                <strong>{money(dashboard.debtPaid)}</strong>
                <span className="metric-card__detail">{percent(dashboard.debtProgress)} das dívidas já foi quitado</span>
              </article>
            </section>

            <div className="records-layout debt-records-layout">
              <section className="panel records-panel debt-records-panel">
                <div className="panel__header records-panel__header">
                  <div>
                    <span className="panel__eyebrow">COMPROMISSOS</span>
                    <h2>Dívidas cadastradas</h2>
                  </div>
                  <span className="records-count">{data.debts.length} {data.debts.length === 1 ? 'item' : 'itens'}</span>
                </div>

                <div className="debt-card-list">
                  {(data.debts as Debt[]).map(debt => {
                    const progress = debt.originalAmount > 0 ? (debt.paidAmount / debt.originalAmount) * 100 : 0
                    return (
                      <article className={`debt-card ${debt.status === 'paid' ? 'debt-card--paid' : ''}`} key={debt.id}>
                        <div className="debt-card__header">
                          <div className="record-name">
                            <span className="record-icon record-icon--debts"><Icon name="debt" size={17} /></span>
                            <div>
                              <strong>{debt.name}</strong>
                              <span>{debt.creditor || 'Credor não informado'}{debt.dueDay ? ` • vence dia ${debt.dueDay}` : ''}</span>
                            </div>
                          </div>
                          <span className={`debt-status debt-status--${debt.status}`}>{debt.status === 'paid' ? 'Quitada' : 'Ativa'}</span>
                        </div>

                        <div className="debt-card__values">
                          <div><span>Original</span><strong>{money(debt.originalAmount)}</strong></div>
                          <div><span>Já pago</span><strong>{money(debt.paidAmount)}</strong></div>
                          <div><span>Saldo atual</span><strong>{money(debt.currentBalance)}</strong></div>
                        </div>

                        <div className="progress-track debt-progress"><span style={{ width: percent(progress) }} /></div>

                        <div className="debt-card__meta">
                          <span>{percent(progress)} quitado</span>
                          <span>{debt.installmentsTotal > 0 ? `${debt.installmentsPaid}/${debt.installmentsTotal} parcelas` : 'Sem parcelamento informado'}</span>
                          <span>{debt.interestRate > 0 ? `Juros: ${debt.interestRate.toLocaleString('pt-BR')}% a.m.` : 'Juros não informados'}</span>
                        </div>

                        <div className="debt-card__actions">
                          <button className="secondary-button" onClick={() => openDebtPayments(debt.id)}>Pagamentos</button>
                          <button className="icon-action" onClick={() => startEdit('debts', debt)} aria-label={`Editar ${debt.name}`}><Icon name="edit" size={17} /></button>
                          <button className="icon-action icon-action--danger" onClick={() => remove('debts', debt.id)} aria-label={`Excluir ${debt.name}`}><Icon name="trash" size={17} /></button>
                        </div>
                      </article>
                    )
                  })}
                  {!data.debts.length && (
                    <div className="table-empty debt-empty">
                      <div className="empty-block__icon"><Icon name="debt" size={22} /></div>
                      <strong>Nenhuma dívida cadastrada.</strong>
                      <span>Use o formulário ao lado para registrar seu primeiro compromisso.</span>
                    </div>
                  )}
                </div>
              </section>

              <aside className="panel record-form-panel">
                <span className="panel__eyebrow">{editing?.kind === 'debts' ? 'EDITAR DÍVIDA' : 'NOVA DÍVIDA'}</span>
                <h2>{editing?.kind === 'debts' ? 'Atualizar dívida' : 'Adicionar dívida'}</h2>
                <p>Informe o valor original. O saldo atual será calculado automaticamente a partir dos pagamentos registrados.</p>
                <form key={`debt-${editing?.kind === 'debts' ? editing.entry.id : 'new'}`} onSubmit={save}>
                  <label><span>Descrição</span><input name="name" defaultValue={editing?.kind === 'debts' ? editing.entry.name : ''} placeholder="Ex.: Cartão, empréstimo, financiamento" required maxLength={120} /></label>
                  <label><span>Credor</span><input name="creditor" defaultValue={editing?.kind === 'debts' ? (editing.entry as Debt).creditor : ''} placeholder="Ex.: Banco, loja, pessoa" maxLength={120} /></label>
                  <label><span>Valor original</span><div className="money-input"><span>R$</span><input name="originalAmount" type="number" min="0.01" max="100000000" step="0.01" defaultValue={editing?.kind === 'debts' ? (editing.entry as Debt).originalAmount : undefined} placeholder="0,00" required /></div></label>
                  <div className="form-grid-2">
                    <label><span>Juros ao mês (%)</span><input name="interestRate" type="number" min="0" max="100" step="0.01" defaultValue={editing?.kind === 'debts' ? (editing.entry as Debt).interestRate : 0} /></label>
                    <label><span>Dia de vencimento</span><input name="dueDay" type="number" min="1" max="31" defaultValue={editing?.kind === 'debts' ? (editing.entry as Debt).dueDay ?? undefined : undefined} placeholder="10" /></label>
                  </div>
                  <label><span>Total de parcelas</span><input name="installmentsTotal" type="number" min="0" max="600" step="1" defaultValue={editing?.kind === 'debts' ? (editing.entry as Debt).installmentsTotal : 0} /></label>
                  <div className="form-actions">
                    <button className="primary primary--full" disabled={busy}>{busy ? 'Salvando…' : editing?.kind === 'debts' ? 'Atualizar dívida' : 'Salvar dívida'}{!busy && <Icon name="arrow" size={17} />}</button>
                    {editing?.kind === 'debts' && <button type="button" className="secondary-button" onClick={cancelEdit}>Cancelar edição</button>}
                  </div>
                </form>
              </aside>
            </div>

            {selectedDebtId && (() => {
              const debt = (data.debts as Debt[]).find(item => item.id === selectedDebtId)
              if (!debt) return null
              return (
                <section className="panel payments-panel">
                  <div className="panel__header">
                    <div>
                      <span className="panel__eyebrow">HISTÓRICO DE PAGAMENTOS</span>
                      <h2>{debt.name}</h2>
                    </div>
                    <button className="link-button" onClick={() => { setSelectedDebtId(null); setDebtPayments([]) }}>Fechar</button>
                  </div>

                  <div className="payments-layout">
                    <form className="payment-form" onSubmit={addDebtPayment}>
                      <label><span>Valor pago</span><div className="money-input"><span>R$</span><input name="amount" type="number" min="0.01" max={debt.currentBalance} step="0.01" placeholder="0,00" required /></div></label>
                      <label><span>Data do pagamento</span><input name="paymentDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label>
                      <label><span>Observação</span><input name="note" placeholder="Ex.: Parcela de setembro" maxLength={240} /></label>
                      <label className="check-field"><input name="countsAsInstallment" type="checkbox" defaultChecked /><span>Contar como parcela paga</span></label>
                      <button className="primary primary--full" disabled={busy || debt.currentBalance <= 0}>{debt.currentBalance <= 0 ? 'Dívida quitada' : busy ? 'Salvando…' : 'Registrar pagamento'}</button>
                    </form>

                    <div className="payment-history">
                      {debtPayments.map(payment => (
                        <div className="payment-row" key={payment.id}>
                          <div>
                            <strong>{money(payment.amount)}</strong>
                            <span>{new Date(payment.paymentDate + 'T12:00:00').toLocaleDateString('pt-BR')}{payment.note ? ` • ${payment.note}` : ''}</span>
                          </div>
                          <button className="icon-action icon-action--danger" onClick={() => removeDebtPayment(payment.id)} aria-label="Excluir pagamento"><Icon name="trash" size={16} /></button>
                        </div>
                      ))}
                      {!debtPayments.length && <div className="mini-empty"><span>Nenhum pagamento registrado para esta dívida.</span></div>}
                    </div>
                  </div>
                </section>
              )
            })()}
          </div>
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
                              ? `${new Date(entry.activeFrom + 'T12:00:00').toLocaleDateString('pt-BR')} → ${entry.activeUntil ? new Date(entry.activeUntil + 'T12:00:00').toLocaleDateString('pt-BR') : 'atual'}`
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
                <label><span>Data de referência / início</span><input name="date" type="date" defaultValue={editing?.kind === 'incomes' ? (editing.entry.type === 'salary' ? editing.entry.activeFrom : editing.entry.receivedAt.slice(0, 10)) : new Date().toISOString().slice(0, 10)} required /></label>
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
          <div className="records-layout">
            <section className="panel records-panel">
              <div className="panel__header records-panel__header">
                <div>
                  <span className="panel__eyebrow">REGISTROS</span>
                  <h2>{titles[view]} cadastrados</h2>
                </div>
                <span className="records-count">{data[view].length} {data[view].length === 1 ? 'item' : 'itens'}</span>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Descrição</th>
                      <th>{view === 'goals' ? 'Progresso' : 'Valor'}</th>
                      <th className="table-action">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data[view].map(entry => (
                      <tr key={entry.id}>
                        <td>
                          <div className="record-name">
                            <span className={`record-icon record-icon--${view}`}>
                              <Icon name={view === 'transactions' ? 'wallet' : 'goal'} size={17} />
                            </span>
                            <div>
                              <strong>{entry.name}</strong>
                              <span>{view === 'transactions' ? `${entry.category} • ${new Date(entry.transactionDate + 'T12:00:00').toLocaleDateString('pt-BR')}` : `Alvo: ${money(entry.target)}`}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          {view === 'goals' ? (
                            <div className="table-progress">
                              <strong>{money(entry.saved)}</strong>
                              <span>{percent(entry.target > 0 ? (entry.saved / entry.target) * 100 : 0)}</span>
                            </div>
                          ) : (
                            <strong className="table-value">{money(entry.value)}</strong>
                          )}
                        </td>
                        <td className="table-action">
                          <div className="table-actions">
                            <button
                              className="icon-action"
                              disabled={busy}
                              onClick={() => startEdit(view, entry)}
                              aria-label={`Editar ${entry.name}`}
                            >
                              <Icon name="edit" size={17} />
                            </button>
                            <button
                              className="icon-action icon-action--danger"
                              disabled={busy}
                              onClick={() => remove(view, entry.id)}
                              aria-label={`Excluir ${entry.name}`}
                            >
                              <Icon name="trash" size={17} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!data[view].length && (
                      <tr>
                        <td colSpan={3} className="table-empty">
                          <div className="empty-block__icon">
                            <Icon name={view === 'transactions' ? 'wallet' : 'goal'} size={22} />
                          </div>
                          <strong>Nenhum registro por aqui.</strong>
                          <span>Use o formulário ao lado para adicionar o primeiro.</span>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <aside className="panel record-form-panel">
              <span className="panel__eyebrow">{editing?.kind === view ? 'EDITAR REGISTRO' : 'NOVO REGISTRO'}</span>
              <h2>{editing?.kind === view ? 'Atualizar' : 'Adicionar'} {view === 'goals' ? 'meta' : 'gasto'}</h2>
              <p>
                {view === 'goals'
                  ? 'Defina um objetivo e informe quanto já conseguiu reservar.'
                  : 'Registre o gasto e escolha a categoria para acompanhar a distribuição.'}
              </p>

              <form key={`${view}-${editing?.kind === view ? editing.entry.id : 'new'}`} onSubmit={save}>
                <label>
                  <span>Descrição</span>
                  <input name="name" defaultValue={editing?.kind === view ? editing.entry.name : ''} placeholder={view === 'goals' ? 'Ex.: Reserva de emergência' : 'Ex.: Mercado'} required maxLength={120} />
                </label>

                {view === 'transactions' && (
                  <label>
                    <span>Categoria</span>
                    <select name="category" defaultValue={editing?.kind === 'transactions' ? editing.entry.category : categories[0]}>
                      {categories.map(category => <option key={category}>{category}</option>)}
                    </select>
                  </label>
                )}

                <label>
                  <span>{view === 'goals' ? 'Valor alvo' : 'Valor'}</span>
                  <div className="money-input">
                    <span>R$</span>
                    <input name="value" type="number" min="0.01" max="100000000" step="0.01" defaultValue={editing?.kind === view ? (view === 'goals' ? editing.entry.target : editing.entry.value) : undefined} placeholder="0,00" required />
                  </div>
                </label>

                {view === 'transactions' && (
                  <label>
                    <span>Data do gasto</span>
                    <input name="transactionDate" type="date" defaultValue={editing?.kind === 'transactions' ? editing.entry.transactionDate : new Date().toISOString().slice(0, 10)} required />
                  </label>
                )}

                {view === 'goals' && (
                  <label>
                    <span>Valor já reservado</span>
                    <div className="money-input">
                      <span>R$</span>
                      <input name="saved" type="number" min="0" max="100000000" step="0.01" defaultValue={editing?.kind === 'goals' ? editing.entry.saved : 0} required />
                    </div>
                  </label>
                )}

                <div className="form-actions">
                  <button className="primary primary--full" disabled={busy}>
                    {busy ? 'Salvando…' : editing?.kind === view ? 'Atualizar registro' : 'Salvar registro'}
                    {!busy && <Icon name="arrow" size={17} />}
                  </button>
                  {editing?.kind === view && <button type="button" className="secondary-button" onClick={cancelEdit}>Cancelar edição</button>}
                </div>
              </form>

              <div className="form-security">
                <Icon name="shield" size={17} />
                <span>O registro será salvo apenas na sua conta.</span>
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  )
}
