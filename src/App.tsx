import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { FinanceAnalyzer, FinanceRepository, Goal, Transaction, type Category } from './domain'

type View = 'overview' | 'transactions' | 'debts' | 'goals'
const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const categoryColors: Record<Category, string> = { Casa: '#00d4a6', Comida: '#f4c95d', Transporte: '#67a8ff', Lazer: '#b88cff', Outros: '#ff7185' }
const initialTransactions = [
  new Transaction(1, 'Supermercado', 'Comida', 186.4),
  new Transaction(2, 'Combustível', 'Transporte', 240),
  new Transaction(3, 'Energia elétrica', 'Casa', 142.9),
]
const initialGoals = [
  new Goal(1, 'Reserva de emergência', 10000, 3480, '#00d4a6'),
  new Goal(2, 'Curso de desenvolvimento', 1500, 420, '#67a8ff'),
]
const transactionRepository = new FinanceRepository<Transaction>('zeus-finance-transactions-v2', Transaction.fromJSON)
const goalRepository = new FinanceRepository<Goal>('zeus-finance-goals-v2', Goal.fromJSON)
const analyzer = new FinanceAnalyzer(2940, initialTransactions.reduce((sum, item) => sum + item.value, 0))

const Icon = ({ name }: { name: 'grid' | 'wallet' | 'card' | 'target' | 'menu' | 'arrow' | 'plus' | 'trend' }) => <span className={`icon icon-${name}`} aria-hidden="true" />

export function App() {
  const [view, setView] = useState<View>('overview')
  const [menuOpen, setMenuOpen] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>(() => transactionRepository.load(initialTransactions))
  const [goals, setGoals] = useState<Goal[]>(() => goalRepository.load(initialGoals))
  const [toast, setToast] = useState('')
  const [form, setForm] = useState({ name: '', category: 'Casa' as Category, value: '' })
  const [goalForm, setGoalForm] = useState({ name: '', target: '' })
  useEffect(() => transactionRepository.save(transactions), [transactions])
  useEffect(() => goalRepository.save(goals), [goals])

  const monthSpent = useMemo(() => analyzer.monthlySpent(transactions), [transactions])
  const navigate = (next: View) => { setView(next); setMenuOpen(false) }
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2500) }
  const addTransaction = (event: FormEvent) => {
    event.preventDefault()
    const value = Number(form.value)
    if (!form.name.trim() || !Number.isFinite(value) || value <= 0) return
    setTransactions((items) => [new Transaction(Date.now(), form.name.trim(), form.category, value), ...items])
    setForm({ name: '', category: 'Casa', value: '' }); notify('Gasto adicionado ao acompanhamento')
  }
  const addGoal = (event: FormEvent) => {
    event.preventDefault(); const target = Number(goalForm.target)
    if (!goalForm.name.trim() || !Number.isFinite(target) || target <= 0) return
    const goal = new Goal(Date.now(), goalForm.name.trim(), target, 0, '#b88cff')
    setGoals((items) => [...items, goal])
    setGoalForm({ name: '', target: '' }); notify('Meta criada com sucesso')
  }
  const title = { overview: 'Visão geral', transactions: 'Gastos', debts: 'Dívidas', goals: 'Metas' }[view]

  return <div className="shell">
    <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
      <div className="brand"><span className="brand-mark">Z</span><span>ZEUS <em>FINANCE</em></span></div>
      <nav aria-label="Navegação principal">{([['overview','Visão geral','grid'],['transactions','Gastos','wallet'],['debts','Dívidas','card'],['goals','Metas','target']] as const).map(([id, label, icon]) => <button key={id} className={view === id ? 'nav-item active' : 'nav-item'} onClick={() => navigate(id)}><Icon name={icon} />{label}{id === 'transactions' && <span className="nav-count">3</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="security"><span className="status-dot" /> Dados locais<br /><small>Sincronização em breve</small></div><div className="profile-mini"><span>GS</span><div><strong>Gabriel Silva</strong><small>Plano pessoal</small></div><b>•••</b></div></div>
    </aside>
    <main>
      <header className="topbar"><button className="mobile-toggle" aria-label="Abrir menu" onClick={() => setMenuOpen(!menuOpen)}><Icon name="menu" /></button><div><p className="eyebrow">PAINEL FINANCEIRO</p><h1>{title}</h1></div><div className="top-actions"><button className="icon-button" aria-label="Adicionar gasto" onClick={() => navigate('transactions')}><Icon name="plus" /></button><div className="avatar">GS</div></div></header>
      {view === 'overview' && <Overview monthSpent={monthSpent} navigate={navigate} />}
      {view === 'transactions' && <Transactions transactions={transactions} form={form} setForm={setForm} addTransaction={addTransaction} clear={() => { setTransactions([]); notify('Lançamentos removidos deste protótipo') }} />}
      {view === 'debts' && <Debts notify={notify} />}
      {view === 'goals' && <Goals goals={goals} form={goalForm} setForm={setGoalForm} addGoal={addGoal} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  </div>
}

function Overview({ monthSpent, navigate }: { monthSpent: number; navigate: (view: View) => void }) {
  const metrics = [{ label: 'Saldo disponível', value: money(4280), note: '+8,4% este mês', className: 'positive', icon: 'wallet' as const }, { label: 'Gastos no mês', value: money(monthSpent), note: '68% do orçamento', className: '', icon: 'trend' as const }, { label: 'Dívidas abertas', value: money(1860), note: '2 vencem em 30 dias', className: 'warning', icon: 'card' as const }, { label: 'Taxa de economia', value: '31,2%', note: 'Meta do mês: 25%', className: 'positive', icon: 'target' as const }]
  return <div className="content-grid"><section className="metrics">{metrics.map((metric) => <article className="card metric" key={metric.label}><div className="metric-top"><span className="metric-label">{metric.label}</span><span className="metric-icon"><Icon name={metric.icon} /></span></div><strong className={metric.className}>{metric.value}</strong><small>{metric.note}</small></article>)}</section><section className="card chart-card"><div className="card-heading"><div><p className="eyebrow">VISÃO DO MÊS</p><h2>Distribuição de gastos</h2></div><button className="text-button" onClick={() => navigate('transactions')}>Ver detalhes <Icon name="arrow" /></button></div><div className="donut-wrap"><div className="donut"><div><strong>R$ 2.940</strong><span>Total no mês</span></div></div><div className="legend">{([['Casa','R$ 980'],['Comida','R$ 720'],['Transporte','R$ 490'],['Lazer','R$ 390'],['Outros','R$ 360']] as const).map(([label, value]) => <div key={label}><span className="legend-dot" style={{ background: categoryColors[label] }} /><span>{label}</span><b>{value}</b></div>)}</div></div></section><section className="card upcoming"><div className="card-heading"><div><p className="eyebrow">AGENDA</p><h2>Próximas contas</h2></div><span className="badge">3 pendentes</span></div><div className="bill-list">{[['Aluguel','Vence em 3 dias','R$ 1.200','high'],['Cartão Nubank','Vence em 8 dias','R$ 860','medium'],['Internet','Vence em 15 dias','R$ 119','low']].map(([name, due, value, state]) => <div className="bill" key={name}><span className={`bill-state ${state}`} /><div><strong>{name}</strong><small>{due}</small></div><b>{value}</b></div>)}</div></section><section className="card insight"><div className="insight-icon"><Icon name="trend" /></div><div><p className="eyebrow">ANÁLISE AUTOMÁTICA</p><h2>Você pode economizar R$ 98 este mês</h2><p>Casa é sua maior categoria. Reduzir 10% nela já melhora sua margem de segurança.</p></div><button className="round-button" onClick={() => navigate('transactions')}><Icon name="arrow" /></button></section><section className="card reserve"><div className="card-heading"><div><p className="eyebrow">OBJETIVO PRINCIPAL</p><h2>Reserva de emergência</h2></div><span className="percentage">35%</span></div><div className="reserve-value"><strong>R$ 3.480</strong><span>de R$ 10.000</span></div><div className="progress"><b style={{ width: '35%' }} /></div><small>Previsão de conclusão: <strong>7 meses</strong></small></section></div>
}

function Transactions({ transactions, form, setForm, addTransaction, clear }: { transactions: Transaction[]; form: { name: string; category: Category; value: string }; setForm: (form: { name: string; category: Category; value: string }) => void; addTransaction: (event: FormEvent) => void; clear: () => void }) {
  return <div className="content-grid single-view"><section className="card table-card"><div className="card-heading"><div><p className="eyebrow">MOVIMENTAÇÕES</p><h2>Gastos registrados</h2></div><button className="text-button" onClick={clear}>Limpar dados locais</button></div><div className="table-wrap"><table><thead><tr><th>Descrição</th><th>Categoria</th><th>Valor</th></tr></thead><tbody>{transactions.length ? transactions.map((item) => <tr key={item.id}><td><strong>{item.name}</strong><small>Este mês</small></td><td><span className="category-pill" style={{ color: categoryColors[item.category] }}>{item.category}</span></td><td><strong>{money(item.value)}</strong></td></tr>) : <tr><td colSpan={3}><div className="empty-state">Nenhum lançamento neste navegador.</div></td></tr>}</tbody></table></div></section><section className="card form-card"><p className="eyebrow">NOVO LANÇAMENTO</p><h2>Adicionar gasto</h2><form onSubmit={addTransaction}><label>Descrição<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Farmácia" required /></label><label>Categoria<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Category })}>{Object.keys(categoryColors).map((category) => <option key={category}>{category}</option>)}</select></label><label>Valor<input value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} type="number" min="0.01" step="0.01" placeholder="0,00" required /></label><button className="primary" type="submit"><Icon name="plus" /> Registrar gasto</button></form><small className="form-hint">O lançamento fica salvo apenas neste navegador nesta versão.</small></section></div>
}

function Debts({ notify }: { notify: (message: string) => void }) { return <div className="content-grid single-view"><section className="card table-card"><div className="card-heading"><div><p className="eyebrow">PLANO DE REDUÇÃO</p><h2>Dívidas abertas</h2></div><span className="badge danger">Prioridade alta</span></div><div className="debt-list"><div className="debt"><div className="debt-symbol">N</div><div><strong>Cartão Nubank</strong><small>Juros estimados: 12,9% a.m. · vence em 8 dias</small></div><b className="negative">R$ 860</b></div><div className="debt"><div className="debt-symbol blue">E</div><div><strong>Empréstimo pessoal</strong><small>Parcela 4 de 12 · vence em 22 dias</small></div><b>R$ 1.000</b></div></div></section><section className="card form-card action-card"><div className="insight-icon"><Icon name="trend" /></div><p className="eyebrow">PRÓXIMA AÇÃO</p><h2>Priorize o cartão</h2><p>Ele concentra os juros mais altos. Evite novas compras parceladas até reduzir esse saldo.</p><button className="primary" onClick={() => notify('Plano salvo para sua próxima revisão')}>Salvar plano</button></section></div> }

function Goals({ goals, form, setForm, addGoal }: { goals: Goal[]; form: { name: string; target: string }; setForm: (form: { name: string; target: string }) => void; addGoal: (event: FormEvent) => void }) { return <div className="content-grid single-view"><section className="card table-card"><div className="card-heading"><div><p className="eyebrow">PLANEJAMENTO</p><h2>Metas financeiras</h2></div><span className="badge">{goals.length} metas</span></div><div className="goal-list">{goals.map((goal) => <div className="goal" key={goal.id}><div className="goal-head"><div><strong>{goal.name}</strong><small>{money(goal.saved)} de {money(goal.target)}</small></div><b style={{ color: goal.color }}>{Math.round((goal.saved / goal.target) * 100)}%</b></div><div className="progress"><b style={{ width: `${Math.min(100, (goal.saved / goal.target) * 100)}%`, background: goal.color }} /></div></div>)}</div></section><section className="card form-card"><p className="eyebrow">NOVO OBJETIVO</p><h2>Criar meta</h2><form onSubmit={addGoal}><label>Nome<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Viagem" required /></label><label>Valor alvo<input value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} type="number" min="1" step="0.01" placeholder="0,00" required /></label><button className="primary" type="submit"><Icon name="plus" /> Adicionar meta</button></form></section></div> }


