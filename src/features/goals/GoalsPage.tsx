import type { FormEvent } from 'react'
import { Icon } from '../../components/Icon'
import { MetricCard } from '../../components/MetricCard'
import type { Dashboard, EditState, Entry, GoalMovement } from '../../domain/finance'
import { currentDateKey, money, percent, progressPercent } from '../../utils/finance'

type Props = {
  dashboard: Dashboard
  goals: Entry[]
  movements: GoalMovement[]
  editing: EditState
  selectedGoalId: number | null
  busy: boolean
  onSave: (event: FormEvent<HTMLFormElement>) => void
  onEdit: (goal: Entry) => void
  onRemove: (id: number) => void
  onCancelEdit: () => void
  onOpenMovements: (id: number) => void
  onCloseMovements: () => void
  onAddMovement: (event: FormEvent<HTMLFormElement>) => void
  onRemoveMovement: (id: number) => void
}

const movementLabel = (type: GoalMovement['type']) => {
  if (type === 'deposit') return 'Aporte'
  if (type === 'withdrawal') return 'Retirada'
  return 'Saldo inicial'
}

export function GoalsPage({
  dashboard,
  goals,
  movements,
  editing,
  selectedGoalId,
  busy,
  onSave,
  onEdit,
  onRemove,
  onCancelEdit,
  onOpenMovements,
  onCloseMovements,
  onAddMovement,
  onRemoveMovement,
}: Props) {
  const editingGoal = editing?.kind === 'goals' ? editing.entry : null
  const selectedGoal = selectedGoalId ? goals.find(item => item.id === selectedGoalId) ?? null : null

  return (
    <div className="goal-page">
      <section className="budget-summary-grid" aria-label="Resumo das metas">
        <MetricCard
          label="Total reservado"
          value={money(dashboard.saved)}
          detail={goals.length ? `${goals.length} meta${goals.length === 1 ? '' : 's'} em acompanhamento` : 'Nenhuma meta cadastrada'}
          icon="goal"
          tone="accent"
        />
        <MetricCard
          label="Objetivo total"
          value={money(dashboard.targets)}
          detail="Soma dos valores alvo das suas metas"
          icon="budget"
        />
        <MetricCard
          label="Progresso geral"
          value={percent(dashboard.goalProgress)}
          detail={dashboard.targets > 0 ? `${money(dashboard.targets - dashboard.saved)} ainda faltam para os objetivos` : 'Crie uma meta para começar'}
          icon="income"
        />
      </section>

      <div className="records-layout">
        <section className="panel records-panel">
          <div className="panel__header records-panel__header">
            <div>
              <span className="panel__eyebrow">OBJETIVOS</span>
              <h2>Metas financeiras</h2>
            </div>
            <span className="records-count">{goals.length} {goals.length === 1 ? 'item' : 'itens'}</span>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Meta</th><th>Progresso</th><th className="table-action">Ação</th></tr>
              </thead>
              <tbody>
                {goals.map(goal => {
                  const progress = goal.target > 0 ? (goal.saved / goal.target) * 100 : 0
                  return (
                    <tr key={goal.id}>
                      <td>
                        <div className="record-name">
                          <span className="record-icon record-icon--goals"><Icon name="goal" size={17} /></span>
                          <div>
                            <strong>{goal.name}</strong>
                            <span>Objetivo: {money(goal.target)}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="table-progress">
                          <strong>{money(goal.saved)}</strong>
                          <span>{percent(progress)}</span>
                        </div>
                        <div className="progress-track goal-table-progress">
                          <span style={{ width: progressPercent(progress) }} />
                        </div>
                      </td>
                      <td className="table-action">
                        <div className="table-actions">
                          <button className="secondary-button" disabled={busy} onClick={() => onOpenMovements(goal.id)}>
                            Movimentações
                          </button>
                          <button className="icon-action" disabled={busy} onClick={() => onEdit(goal)} aria-label={`Editar ${goal.name}`}>
                            <Icon name="edit" size={17} />
                          </button>
                          <button className="icon-action icon-action--danger" disabled={busy} onClick={() => onRemove(goal.id)} aria-label={`Excluir ${goal.name}`}>
                            <Icon name="trash" size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {!goals.length && (
                  <tr>
                    <td colSpan={3} className="table-empty">
                      <div className="empty-block__icon"><Icon name="goal" size={22} /></div>
                      <strong>Nenhuma meta cadastrada.</strong>
                      <span>Crie um objetivo e acompanhe cada aporte ou retirada.</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="panel record-form-panel">
          <span className="panel__eyebrow">{editingGoal ? 'EDITAR META' : 'NOVA META'}</span>
          <h2>{editingGoal ? 'Atualizar objetivo' : 'Adicionar meta'}</h2>
          <p>
            {editingGoal
              ? 'Nome e valor alvo podem ser alterados. O saldo reservado é controlado pelas movimentações.'
              : 'Defina o objetivo. Se já houver dinheiro reservado, informe o saldo inicial.'}
          </p>
          <form key={`goal-${editingGoal?.id ?? 'new'}`} onSubmit={onSave}>
            <label>
              <span>Descrição</span>
              <input name="name" defaultValue={editingGoal?.name ?? ''} placeholder="Ex.: Reserva de emergência" required maxLength={120} />
            </label>
            <label>
              <span>Valor alvo</span>
              <div className="money-input">
                <span>R$</span>
                <input name="value" type="number" min="0.01" max="100000000" step="0.01" defaultValue={editingGoal?.target} placeholder="0,00" required />
              </div>
            </label>
            {!editingGoal && (
              <label>
                <span>Saldo inicial reservado</span>
                <div className="money-input">
                  <span>R$</span>
                  <input name="saved" type="number" min="0" max="100000000" step="0.01" defaultValue={0} required />
                </div>
              </label>
            )}
            {editingGoal && (
              <div className="form-security">
                <Icon name="goal" size={17} />
                <span>Saldo atual: {money(editingGoal.saved)}. Use Movimentações para alterar esse valor.</span>
              </div>
            )}
            <div className="form-actions">
              <button className="primary primary--full" disabled={busy}>
                {busy ? 'Salvando…' : editingGoal ? 'Atualizar meta' : 'Salvar meta'}
                {!busy && <Icon name="arrow" size={17} />}
              </button>
              {editingGoal && <button type="button" className="secondary-button" onClick={onCancelEdit}>Cancelar edição</button>}
            </div>
          </form>
        </aside>
      </div>

      {selectedGoal && (
        <section className="panel payments-panel goal-movements-panel">
          <div className="panel__header">
            <div>
              <span className="panel__eyebrow">HISTÓRICO DA META</span>
              <h2>{selectedGoal.name}</h2>
              <p>{money(selectedGoal.saved)} reservados de {money(selectedGoal.target)}</p>
            </div>
            <button className="link-button" onClick={onCloseMovements}>Fechar</button>
          </div>

          <div className="payments-layout">
            <form className="payment-form" onSubmit={onAddMovement}>
              <label>
                <span>Tipo</span>
                <select name="type" defaultValue="deposit">
                  <option value="deposit">Aporte</option>
                  <option value="withdrawal">Retirada</option>
                </select>
              </label>
              <label>
                <span>Valor</span>
                <div className="money-input">
                  <span>R$</span>
                  <input name="amount" type="number" min="0.01" max="100000000" step="0.01" placeholder="0,00" required />
                </div>
              </label>
              <label>
                <span>Data</span>
                <input name="movementDate" type="date" defaultValue={currentDateKey()} required />
              </label>
              <label>
                <span>Observação</span>
                <input name="note" placeholder="Ex.: Aporte do salário" maxLength={240} />
              </label>
              <button className="primary primary--full" disabled={busy}>
                {busy ? 'Salvando…' : 'Registrar movimentação'}
              </button>
            </form>

            <div className="payment-history">
              {movements.map(movement => (
                <div className="payment-row goal-movement-row" key={movement.id}>
                  <div>
                    <strong className={movement.type === 'withdrawal' ? 'negative-value' : 'positive-value'}>
                      {movement.type === 'withdrawal' ? '−' : '+'} {money(movement.amount)}
                    </strong>
                    <span>
                      {movementLabel(movement.type)} • {new Date(movement.movementDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                      {movement.note ? ` • ${movement.note}` : ''}
                    </span>
                  </div>
                  <button
                    className="icon-action icon-action--danger"
                    disabled={busy}
                    onClick={() => onRemoveMovement(movement.id)}
                    aria-label="Excluir movimentação"
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              ))}
              {!movements.length && (
                <div className="mini-empty">
                  <span>Nenhuma movimentação registrada para esta meta.</span>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
