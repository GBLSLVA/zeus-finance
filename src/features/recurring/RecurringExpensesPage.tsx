import type { FormEvent } from 'react'
import { Icon } from '../../components/Icon'
import { MetricCard } from '../../components/MetricCard'
import { type Dashboard, type FinanceCategory, type RecurringExpense } from '../../domain/finance'
import { currentDateKey, money } from '../../utils/finance'

type Props = {
  dashboard: Dashboard
  recurringExpenses: RecurringExpense[]
  monthLabel: string
  busy: boolean
  editing: RecurringExpense | null
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onEdit: (entry: RecurringExpense) => void
  onRemove: (id: number) => void
  onMarkPaid: (id: number) => void
  onCancelEdit: () => void
  categories: FinanceCategory[]
}

export function RecurringExpensesPage({
  dashboard,
  recurringExpenses,
  monthLabel,
  busy,
  editing,
  onSubmit,
  onEdit,
  onRemove,
  onMarkPaid,
  onCancelEdit,
  categories,
}: Props) {
  const pendingCount = dashboard.recurringExpenses.filter(item => !item.paid).length

  return (
    <div className="recurring-page">
      <section className="budget-summary-grid" aria-label="Resumo dos gastos recorrentes">
        <MetricCard
          label="Recorrências pendentes"
          value={money(dashboard.recurringTotal)}
          detail={dashboard.recurringExpenses.length
            ? `${pendingCount} de ${dashboard.recurringExpenses.length} compromisso${dashboard.recurringExpenses.length === 1 ? '' : 's'} ainda pendente${pendingCount === 1 ? '' : 's'} em ${monthLabel.toLowerCase()}`
            : 'Nenhum compromisso recorrente ativo no período'}
          icon="budget"
        />
        <MetricCard
          label="Gasto realizado"
          value={money(dashboard.spent)}
          detail="Somente lançamentos já registrados"
          icon="wallet"
        />
        <MetricCard
          label="Saldo projetado"
          value={money(dashboard.projectedBalance)}
          detail={dashboard.income > 0
            ? `Renda menos gastos realizados e ${money(dashboard.recurringTotal)} recorrentes`
            : 'Cadastre receitas para completar a projeção'}
          icon="income"
          tone={dashboard.projectedBalance >= 0 ? 'accent' : 'warning'}
        />
      </section>

      <div className="records-layout recurring-records-layout">
        <section className="panel records-panel recurring-records-panel">
          <div className="panel__header records-panel__header">
            <div>
              <h2>Gastos recorrentes</h2>
            </div>
            <span className="records-count">{recurringExpenses.length} {recurringExpenses.length === 1 ? 'item' : 'itens'}</span>
          </div>

          <div className="recurring-list" role="list" aria-label="Compromissos recorrentes">
            {recurringExpenses.map(entry => {
              const monthEntry = dashboard.recurringExpenses.find(item => item.id === entry.id)
              const status = monthEntry?.paid ? 'paid' : monthEntry ? 'pending' : 'outside'
              return (
                <article className="recurring-item" role="listitem" key={entry.id}>
                  <div className="recurring-item__top">
                    <div className="record-name">
                      <span className="record-icon record-icon--transactions">
                        <Icon name="calendar" size={18} />
                      </span>
                      <div>
                        <strong>{entry.name}</strong>
                        <span>{entry.category} · {entry.active ? 'Ativo' : 'Inativo'}</span>
                      </div>
                    </div>
                    <span className={`recurring-state recurring-state--${status}`}>
                      {status === 'paid' ? 'Pago no mês' : status === 'pending' ? 'Pendente' : 'Fora da vigência'}
                    </span>
                  </div>

                  <div className="recurring-item__details">
                    <div>
                      <span>Valor mensal</span>
                      <strong className="recurring-item__amount">{money(entry.value)}</strong>
                    </div>
                    <div>
                      <span>Vencimento</span>
                      <strong>Dia {entry.dueDay}</strong>
                    </div>
                    <div>
                      <span>Período ativo</span>
                      <strong>
                        {new Date(entry.activeFrom + 'T12:00:00').toLocaleDateString('pt-BR')} até{' '}
                        {entry.activeUntil
                          ? new Date(entry.activeUntil + 'T12:00:00').toLocaleDateString('pt-BR')
                          : 'atualmente'}
                      </strong>
                    </div>
                  </div>

                  <div className="recurring-item__actions">
                    {status === 'pending' ? (
                      <button
                        type="button"
                        className="secondary-button recurring-pay-button"
                        disabled={busy}
                        onClick={() => onMarkPaid(entry.id)}
                      >
                        Marcar como pago
                      </button>
                    ) : (
                      <span className="recurring-item__hint">
                        {status === 'paid' ? 'Compromisso registrado neste mês' : 'Sem cobrança neste período'}
                      </span>
                    )}
                    <div className="table-actions">
                      <button
                        type="button"
                        className="icon-action"
                        disabled={busy}
                        onClick={() => onEdit(entry)}
                        aria-label={`Editar ${entry.name}`}
                      >
                        <Icon name="edit" size={17} />
                      </button>
                      <button
                        type="button"
                        className="icon-action icon-action--danger"
                        disabled={busy}
                        onClick={() => onRemove(entry.id)}
                        aria-label={`Excluir ${entry.name}`}
                      >
                        <Icon name="trash" size={17} />
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
            {!recurringExpenses.length && (
              <div className="table-empty recurring-empty">
                <div className="empty-block__icon"><Icon name="calendar" size={22} /></div>
                <strong>Nenhum gasto recorrente cadastrado.</strong>
                <span>Adicione aluguel, internet, assinaturas ou outros compromissos mensais.</span>
              </div>
            )}
          </div>
        </section>

        <aside className="panel record-form-panel">
          <h2>{editing ? 'Atualizar compromisso' : 'Adicionar compromisso mensal'}</h2>
          <p>O valor entra como projeção mensal e não será marcado automaticamente como gasto já pago.</p>
          <form key={`recurring-${editing?.id ?? 'new'}`} onSubmit={onSubmit}>
            <label>
              <span>Descrição</span>
              <input name="name" defaultValue={editing?.name ?? ''} placeholder="Ex.: Internet, aluguel, academia" required maxLength={120} />
            </label>
            <label>
              <span>Categoria</span>
              <select name="category" defaultValue={editing?.category ?? categories[0]?.name ?? ''} required>
                {categories.map(category => <option key={category.id} value={category.name}>{category.name}</option>)}
              </select>
            </label>
            <label>
              <span>Valor mensal</span>
              <div className="money-input">
                <span>R$</span>
                <input name="value" type="number" min="0.01" max="100000000" step="0.01" defaultValue={editing?.value} placeholder="0,00" required />
              </div>
            </label>
            <div className="form-grid-2">
              <label>
                <span>Dia de vencimento</span>
                <input name="dueDay" type="number" min="1" max="31" step="1" defaultValue={editing?.dueDay ?? 10} required />
              </label>
              <label>
                <span>Vigente a partir de</span>
                <input name="activeFrom" type="date" defaultValue={editing?.activeFrom ?? currentDateKey()} required />
              </label>
            </div>
            <label>
              <span>Vigente até (opcional)</span>
              <input name="activeUntil" type="date" defaultValue={editing?.activeUntil ?? ''} />
            </label>
            <label className="check-field">
              <input name="active" type="checkbox" defaultChecked={editing ? editing.active : true} />
              <span>Compromisso ativo</span>
            </label>
            <div className="form-actions">
              <button className="primary primary--full" disabled={busy}>
                {busy ? 'Salvando…' : editing ? 'Atualizar recorrência' : 'Salvar recorrência'}
                {!busy && <Icon name="arrow" size={17} />}
              </button>
              {editing && <button type="button" className="secondary-button" onClick={onCancelEdit}>Cancelar edição</button>}
            </div>
          </form>
          <div className="form-security"><Icon name="shield" size={17} /><span>Recorrências são isoladas por conta e usadas apenas nas projeções do ZEUS.</span></div>
        </aside>
      </div>
    </div>
  )
}
