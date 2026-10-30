import type { FormEvent } from 'react'
import { Icon } from '../../components/Icon'
import type { Dashboard, EditState, Income } from '../../domain/finance'
import { currentDateKey, effectiveIncomeEnd, money } from '../../utils/finance'

interface Props {
  incomes: Income[]
  dashboard: Dashboard
  editing: EditState
  busy: boolean
  onSave: (event: FormEvent<HTMLFormElement>) => void
  onEdit: (entry: Income) => void
  onRemove: (id: number) => void
  onCancelEdit: () => void
}

/**
 * Income feature owns its markup; App retains orchestration and API state.
 * Keeps domain rules in the backend, following composition over inheritance.
 */
export function IncomePage({
  incomes, dashboard, editing, busy, onSave, onEdit, onRemove, onCancelEdit,
}: Props) {
  return (
    <div className="records-layout">
            <section className="panel records-panel">
              <div className="panel__header records-panel__header">
                <div>
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
                            <button className="icon-action" disabled={busy} onClick={() => onEdit(entry)} aria-label={`Editar ${entry.name}`}><Icon name="edit" size={17} /></button>
                            <button className="icon-action icon-action--danger" disabled={busy} onClick={() => onRemove(entry.id)} aria-label={`Excluir ${entry.name}`}><Icon name="trash" size={17} /></button>
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
              <h2>{editing?.kind === 'incomes' ? 'Atualizar entrada' : 'Adicionar entrada'}</h2>
              <p>Salários são recorrentes durante o período de vigência. Receitas extras entram somente no mês informado.</p>
              <form key={`incomes-${editing?.kind === 'incomes' ? editing.entry.id : 'new'}`} onSubmit={onSave}>
                <label><span>Descrição</span><input name="name" defaultValue={editing?.kind === 'incomes' ? editing.entry.name : ''} placeholder="Ex.: Salário empresa / Freelance" required maxLength={120} /></label>
                <label><span>Tipo de receita</span><select name="type" defaultValue={editing?.kind === 'incomes' ? editing.entry.type : 'salary'}><option value="salary">Salário mensal</option><option value="extra">Renda extra</option></select></label>
                <label><span>Valor</span><div className="money-input"><span>R$</span><input name="value" type="number" min="0.01" max="100000000" step="0.01" defaultValue={editing?.kind === 'incomes' ? editing.entry.value : undefined} placeholder="0,00" required /></div></label>
                <label><span>Data de referência / início</span><input name="date" type="date" defaultValue={editing?.kind === 'incomes' ? (editing.entry.type === 'salary' ? editing.entry.activeFrom : editing.entry.receivedAt.slice(0, 10)) : currentDateKey()} required /></label>
                <label><span>Vigente até (opcional para salário)</span><input name="activeUntil" type="date" defaultValue={editing?.kind === 'incomes' ? editing.entry.activeUntil ?? '' : ''} /></label>
                <label className="check-field"><input name="active" type="checkbox" defaultChecked={editing?.kind === 'incomes' ? editing.entry.active : true} /><span>Receita ativa</span></label>
                <div className="form-actions">
                  <button className="primary primary--full" disabled={busy}>{busy ? 'Salvando…' : editing?.kind === 'incomes' ? 'Atualizar receita' : 'Salvar receita'}{!busy && <Icon name="arrow" size={17} />}</button>
                  {editing?.kind === 'incomes' && <button type="button" className="secondary-button" onClick={onCancelEdit}>Cancelar edição</button>}
                </div>
              </form>
              <div className="form-security"><Icon name="shield" size={17} /><span>O registro será salvo apenas na sua conta.</span></div>
            </aside>
          </div>
  )
}
