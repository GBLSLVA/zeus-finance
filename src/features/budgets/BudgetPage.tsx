import type { FormEvent } from 'react'
import { Icon } from '../../components/Icon'
import { MetricCard } from '../../components/MetricCard'
import { categoryColor, type Budget, type Category, type Dashboard } from '../../domain/finance'
import { money, percent, progressPercent } from '../../utils/finance'

type Props = {
  dashboard: Dashboard
  budgets: Budget[]
  monthLabel: string
  busy: boolean
  onSave: (event: FormEvent<HTMLFormElement>, category: Category) => void
  onRemove: (id: number) => void
}

export function BudgetPage({ dashboard, budgets, monthLabel, busy, onSave, onRemove }: Props) {
  return (
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
              {item.budget && (
                <button
                  className="icon-action icon-action--danger"
                  onClick={() => onRemove(item.budget!.id)}
                  aria-label={`Remover orçamento de ${item.category}`}
                >
                  <Icon name="trash" size={16} />
                </button>
              )}
            </div>

            <div className="budget-category-card__numbers">
              <div><span>Gasto</span><strong>{money(item.spent)}</strong></div>
              <div><span>Limite</span><strong>{item.limit > 0 ? money(item.limit) : '—'}</strong></div>
              <div><span>Restante</span><strong className={item.remaining < 0 ? 'negative-value' : ''}>{item.limit > 0 ? money(item.remaining) : '—'}</strong></div>
            </div>

            <div className="progress-track budget-category-progress">
              <span style={{ width: item.limit > 0 ? progressPercent(item.usage) : '0%' }} />
            </div>
            <div className="budget-category-card__usage">
              <span>{item.limit > 0 ? `${percent(item.usage)} utilizado` : 'Defina um limite abaixo'}</span>
              {item.remaining < 0 && <strong>Excedido</strong>}
            </div>

            <form className="budget-inline-form" onSubmit={event => onSave(event, item.category)}>
              <label>
                <span>Limite para {monthLabel.toLowerCase()}</span>
                <div className="money-input">
                  <span>R$</span>
                  <input
                    name="limit"
                    type="number"
                    min="0.01"
                    max="100000000"
                    step="0.01"
                    defaultValue={item.limit || undefined}
                    placeholder="0,00"
                    required
                  />
                </div>
              </label>
              <button className="primary" disabled={busy}>{item.budget ? 'Atualizar' : 'Definir limite'}</button>
            </form>
          </article>
        ))}
      </section>
    </div>
  )
}
