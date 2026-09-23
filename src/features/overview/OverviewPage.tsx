import type { FormEvent } from 'react'
import { Icon } from '../../components/Icon'
import { MetricCard } from '../../components/MetricCard'
import { ZeusAssistantPanel } from '../assistant/ZeusAssistantPanel'
import { ZeusInsightsPanel } from '../insights/ZeusInsightsPanel'
import {
  categoryColor,
  type AssistantResponse,
  type Dashboard,
  type Debt,
  type Entry,
  type Insight,
  type Kind,
  type MonthlySummary,
  type View,
} from '../../domain/finance'
import { formatMonth, money, percent, progressPercent } from '../../utils/finance'

type Props = {
  dashboard: Dashboard
  data: Record<Kind, Entry[]>
  monthLabel: string
  assistantAnswer: AssistantResponse | null
  assistantQuestion: string
  assistantBusy: boolean
  setAssistantQuestion: (value: string) => void
  askZeus: (event: FormEvent<HTMLFormElement>) => void
  askZeusQuestion: (question: string) => Promise<void>
  monthlySummary: MonthlySummary | null
  insights: Insight[]
  historyData: Dashboard['historyData']
  historyMax: number
  navigate: (next: View) => void
}

export function OverviewPage({
  dashboard,
  data,
  monthLabel,
  assistantAnswer,
  assistantQuestion,
  assistantBusy,
  setAssistantQuestion,
  askZeus,
  askZeusQuestion,
  monthlySummary,
  insights,
  historyData,
  historyMax,
  navigate,
}: Props) {
  return (
<div className="dashboard">
            <section className="dashboard-hero">
              <div className="dashboard-hero__main">
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
                label="Saldo projetado"
                value={money(dashboard.projectedBalance)}
                detail={dashboard.recurringTotal > 0 ? `${money(dashboard.recurringTotal)} em compromissos recorrentes neste mês` : 'Sem compromissos recorrentes ativos no mês'}
                icon="budget"
                tone={dashboard.projectedBalance >= 0 ? 'accent' : 'warning'}
              />
              <MetricCard
                label="Dívida total"
                value={money(dashboard.debt)}
                detail={dashboard.debt > 0 && dashboard.income > 0 ? `Equivale a ${dashboard.debtMonths.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mês(es) da renda atual` : data.debts.length ? `${data.debts.length} dívida${data.debts.length === 1 ? '' : 's'} cadastrada${data.debts.length === 1 ? '' : 's'}` : 'Nenhuma dívida cadastrada'}
                icon="debt"
                tone="warning"
              />
            </section>

            <ZeusAssistantPanel
              monthLabel={monthLabel}
              answer={assistantAnswer}
              question={assistantQuestion}
              busy={assistantBusy}
              onQuestionChange={setAssistantQuestion}
              onSubmit={askZeus}
              onSuggestion={suggestion => {
                setAssistantQuestion(suggestion)
                void askZeusQuestion(suggestion)
              }}
            />

            <ZeusInsightsPanel
              monthLabel={monthLabel}
              summary={monthlySummary}
              insights={insights}
            />

            <section className="dashboard-grid">
              <article className="panel spending-panel">
                <div className="panel__header">
                  <div>
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
                      role="img"
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
                      <span style={{ width: progressPercent(dashboard.budgetUsage) }} />
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
                      <span style={{ width: progressPercent(dashboard.goalProgress) }} />
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
  )
}
