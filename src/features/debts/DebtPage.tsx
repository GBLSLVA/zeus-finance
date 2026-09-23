import type { FormEvent } from 'react'
import { Icon } from '../../components/Icon'
import type { Dashboard, Debt, DebtPayment, EditState } from '../../domain/finance'
import { currentDateKey, money, percent, progressPercent } from '../../utils/finance'

type Props = {
  dashboard: Dashboard
  debts: Debt[]
  debtPayments: DebtPayment[]
  editing: EditState
  selectedDebtId: number | null
  busy: boolean
  onSave: (event: FormEvent<HTMLFormElement>) => void
  onEdit: (debt: Debt) => void
  onRemove: (id: number) => void
  onCancelEdit: () => void
  onOpenPayments: (id: number) => void
  onClosePayments: () => void
  onAddPayment: (event: FormEvent<HTMLFormElement>) => void
  onRemovePayment: (id: number) => void
}

export function DebtPage({
  dashboard,
  debts,
  debtPayments,
  editing,
  selectedDebtId,
  busy,
  onSave,
  onEdit,
  onRemove,
  onCancelEdit,
  onOpenPayments,
  onClosePayments,
  onAddPayment,
  onRemovePayment,
}: Props) {
  const editingDebt = editing?.kind === 'debts' ? editing.entry as Debt : null
  const selectedDebt = selectedDebtId ? debts.find(item => item.id === selectedDebtId) ?? null : null

  return (
    <div className="debt-page">
      <section className="debt-summary-grid" aria-label="Resumo das dívidas">
        <article className="metric-card metric-card--warning">
          <div className="metric-card__top">
            <span className="metric-card__label">Saldo devedor atual</span>
            <span className="metric-card__icon"><Icon name="debt" size={18} /></span>
          </div>
          <strong>{money(dashboard.debt)}</strong>
          <span className="metric-card__detail">{debts.filter(debt => debt.status === 'active').length} dívida(s) ativa(s)</span>
        </article>
        <article className="metric-card">
          <div className="metric-card__top">
            <span className="metric-card__label">Valor original</span>
            <span className="metric-card__icon"><Icon name="debt" size={18} /></span>
          </div>
          <strong>{money(dashboard.debtOriginal)}</strong>
          <span className="metric-card__detail">Soma dos valores originais cadastrados</span>
        </article>
        <article className="metric-card metric-card--accent">
          <div className="metric-card__top">
            <span className="metric-card__label">Total já pago</span>
            <span className="metric-card__icon"><Icon name="income" size={18} /></span>
          </div>
          <strong>{money(dashboard.debtPaid)}</strong>
          <span className="metric-card__detail">{percent(dashboard.debtProgress)} das dívidas já foi quitado</span>
        </article>
      </section>

      <div className="records-layout debt-records-layout">
        <section className="panel records-panel debt-records-panel">
          <div className="panel__header records-panel__header">
            <div>
              <h2>Dívidas cadastradas</h2>
            </div>
            <span className="records-count">{debts.length} {debts.length === 1 ? 'item' : 'itens'}</span>
          </div>

          <div className="debt-card-list">
            {debts.map(debt => {
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

                  <div className="progress-track debt-progress"><span style={{ width: progressPercent(progress) }} /></div>

                  <div className="debt-card__meta">
                    <span>{percent(progress)} quitado</span>
                    <span>{debt.installmentsTotal > 0 ? `${debt.installmentsPaid}/${debt.installmentsTotal} parcelas` : 'Sem parcelamento informado'}</span>
                    <span>{debt.interestRate > 0 ? `Juros: ${debt.interestRate.toLocaleString('pt-BR')}% a.m.` : 'Juros não informados'}</span>
                  </div>

                  <div className="debt-card__actions">
                    <button className="secondary-button" onClick={() => onOpenPayments(debt.id)}>Pagamentos</button>
                    <button className="icon-action" onClick={() => onEdit(debt)} aria-label={`Editar ${debt.name}`}><Icon name="edit" size={17} /></button>
                    <button className="icon-action icon-action--danger" onClick={() => onRemove(debt.id)} aria-label={`Excluir ${debt.name}`}><Icon name="trash" size={17} /></button>
                  </div>
                </article>
              )
            })}
            {!debts.length && (
              <div className="table-empty debt-empty">
                <div className="empty-block__icon"><Icon name="debt" size={22} /></div>
                <strong>Nenhuma dívida cadastrada.</strong>
                <span>Use o formulário ao lado para registrar seu primeiro compromisso.</span>
              </div>
            )}
          </div>
        </section>

        <aside className="panel record-form-panel">
          <h2>{editingDebt ? 'Atualizar dívida' : 'Adicionar dívida'}</h2>
          <p>Informe o valor original. O saldo atual será calculado automaticamente a partir dos pagamentos registrados.</p>
          <form key={`debt-${editingDebt?.id ?? 'new'}`} onSubmit={onSave}>
            <label><span>Descrição</span><input name="name" defaultValue={editingDebt?.name ?? ''} placeholder="Ex.: Cartão, empréstimo, financiamento" required maxLength={120} /></label>
            <label><span>Credor</span><input name="creditor" defaultValue={editingDebt?.creditor ?? ''} placeholder="Ex.: Banco, loja, pessoa" maxLength={120} /></label>
            <label><span>Valor original</span><div className="money-input"><span>R$</span><input name="originalAmount" type="number" min="0.01" max="100000000" step="0.01" defaultValue={editingDebt?.originalAmount} placeholder="0,00" required /></div></label>
            <div className="form-grid-2">
              <label><span>Juros ao mês (%)</span><input name="interestRate" type="number" min="0" max="100" step="0.01" defaultValue={editingDebt?.interestRate ?? 0} /></label>
              <label><span>Dia de vencimento</span><input name="dueDay" type="number" min="1" max="31" defaultValue={editingDebt?.dueDay ?? undefined} placeholder="10" /></label>
            </div>
            <label><span>Total de parcelas</span><input name="installmentsTotal" type="number" min="0" max="600" step="1" defaultValue={editingDebt?.installmentsTotal ?? 0} /></label>
            <div className="form-actions">
              <button className="primary primary--full" disabled={busy}>
                {busy ? 'Salvando…' : editingDebt ? 'Atualizar dívida' : 'Salvar dívida'}
                {!busy && <Icon name="arrow" size={17} />}
              </button>
              {editingDebt && <button type="button" className="secondary-button" onClick={onCancelEdit}>Cancelar edição</button>}
            </div>
          </form>
        </aside>
      </div>

      {selectedDebt && (
        <section className="panel payments-panel">
          <div className="panel__header">
            <div>
              <h2>Pagamentos de {selectedDebt.name}</h2>
            </div>
            <button className="link-button" onClick={onClosePayments}>Fechar</button>
          </div>

          <div className="payments-layout">
            <form className="payment-form" onSubmit={onAddPayment}>
              <label><span>Valor pago</span><div className="money-input"><span>R$</span><input name="amount" type="number" min="0.01" max={selectedDebt.currentBalance} step="0.01" placeholder="0,00" required /></div></label>
              <label><span>Data do pagamento</span><input name="paymentDate" type="date" defaultValue={currentDateKey()} required /></label>
              <label><span>Observação</span><input name="note" placeholder="Ex.: Parcela de setembro" maxLength={240} /></label>
              <label className="check-field"><input name="countsAsInstallment" type="checkbox" defaultChecked /><span>Contar como parcela paga</span></label>
              <button className="primary primary--full" disabled={busy || selectedDebt.currentBalance <= 0}>
                {selectedDebt.currentBalance <= 0 ? 'Dívida quitada' : busy ? 'Salvando…' : 'Registrar pagamento'}
              </button>
            </form>

            <div className="payment-history">
              {debtPayments.map(payment => (
                <div className="payment-row" key={payment.id}>
                  <div>
                    <strong>{money(payment.amount)}</strong>
                    <span>{new Date(payment.paymentDate + 'T12:00:00').toLocaleDateString('pt-BR')}{payment.note ? ` • ${payment.note}` : ''}</span>
                  </div>
                  <button className="icon-action icon-action--danger" onClick={() => onRemovePayment(payment.id)} aria-label="Excluir pagamento">
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              ))}
              {!debtPayments.length && <div className="mini-empty"><span>Nenhum pagamento registrado para esta dívida.</span></div>}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
