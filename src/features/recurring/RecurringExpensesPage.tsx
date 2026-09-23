import type { FormEvent } from 'react'
import { Icon } from '../../components/Icon'
import { MetricCard } from '../../components/MetricCard'
import { categories, type Dashboard, type RecurringExpense } from '../../domain/finance'
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

      <div className="records-layout">
        <section className="panel records-panel">
          <div className="panel__header records-panel__header">
            <div>
              <h2>Gastos recorrentes</h2>
            </div>
            <span className="records-count">{recurringExpenses.length} {recurringExpenses.length === 1 ? 'item' : 'itens'}</span>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Descrição</th><th>Vencimento / vigência</th><th>Status no mês</th><th>Valor</th><th className="table-action">Ação</th></tr>
              </thead>
              <tbody>
                {recurringExpenses.map(entry => {
                  const monthEntry = dashboard.recurringExpenses.find(item => item.id === entry.id)
                  return (
                    <tr key={entry.id}>
                      <td>
                        <div className="record-name">
                          <span className="record-icon record-icon--transactions"><Icon name="calendar" size={17} /></span>
                          <div>
                            <strong>{entry.name}</strong>
                            <span>{entry.category} • {entry.active ? 'Ativo' : 'Inativo'}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <strong>Dia {entry.dueDay}</strong>
                        <small className="income-date">
                          {new Date(entry.activeFrom + 'T12:00:00').toLocaleDateString('pt-BR')} → {entry.activeUntil ? new Date(entry.activeUntil + 'T12:00:00').toLocaleDateString('pt-BR') : 'atual'}
                        </small>
                      </td>
                      <td>
                        {monthEntry?.paid ? (
                          <span className="debt-status debt-status--paid">Pago</span>
                        ) : monthEntry ? (
                          <button className="secondary-button recurring-pay-button" disabled={busy} onClick={() => onMarkPaid(entry.id)}>
                            Marcar como pago
                          </button>
                        ) : (
                          <span className="debt-status">Fora da vigência</span>
                        )}
                      </td>
                      <td><strong className="table-value">{money(entry.value)}</strong></td>
                      <td className="table-action">
                        <div className="table-actions">
                          <button className="icon-action" disabled={busy} onClick={() => onEdit(entry)} aria-label={`Editar ${entry.name}`}>
                            <Icon name="edit" size={17} />
                          </button>
                          <button className="icon-action icon-action--danger" disabled={busy} onClick={() => onRemove(entry.id)} aria-label={`Excluir ${entry.name}`}>
                            <Icon name="trash" size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {!recurringExpenses.length && (
                  <tr>
                    <td colSpan={5} className="table-empty">
                      <div className="empty-block__icon"><Icon name="calendar" size={22} /></div>
                      <strong>Nenhum gasto recorrente cadastrado.</strong>
                      <span>Cadastre aluguel, internet, academia, assinaturas e outros compromissos mensais.</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
              <select name="category" defaultValue={editing?.category ?? categories[0]}>
                {categories.map(category => <option key={category}>{category}</option>)}
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
