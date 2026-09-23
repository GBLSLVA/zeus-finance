import type { FormEvent } from 'react'
import { Icon } from '../../components/Icon'
import { categories, type EditState, type Entry } from '../../domain/finance'
import { currentDateKey, money } from '../../utils/finance'

type Props = {
  entries: Entry[]
  editing: EditState
  busy: boolean
  onSave: (event: FormEvent<HTMLFormElement>) => void
  onEdit: (entry: Entry) => void
  onRemove: (id: number) => void
  onCancelEdit: () => void
}

export function TransactionsPage({
  entries,
  editing,
  busy,
  onSave,
  onEdit,
  onRemove,
  onCancelEdit,
}: Props) {
  const editingTransaction = editing?.kind === 'transactions' ? editing.entry : null

  return (
    <div className="records-layout">
      <section className="panel records-panel">
        <div className="panel__header records-panel__header">
          <div>
            <h2>Gastos cadastrados</h2>
          </div>
          <span className="records-count">{entries.length} {entries.length === 1 ? 'item' : 'itens'}</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead><tr><th>Descrição</th><th>Valor</th><th className="table-action">Ação</th></tr></thead>
            <tbody>
              {entries.map(entry => (
                <tr key={entry.id}>
                  <td>
                    <div className="record-name">
                      <span className="record-icon record-icon--transactions"><Icon name="wallet" size={17} /></span>
                      <div>
                        <strong>{entry.name}</strong>
                        <span>{entry.category} • {new Date(entry.transactionDate + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>
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
              ))}
              {!entries.length && (
                <tr>
                  <td colSpan={3} className="table-empty">
                    <div className="empty-block__icon"><Icon name="wallet" size={22} /></div>
                    <strong>Nenhum gasto por aqui.</strong>
                    <span>Use o formulário ao lado para adicionar o primeiro.</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <aside className="panel record-form-panel">
        <h2>{editingTransaction ? 'Atualizar gasto' : 'Adicionar gasto'}</h2>
        <p>Registre o gasto e escolha a categoria para acompanhar a distribuição.</p>

        <form key={`transaction-${editingTransaction?.id ?? 'new'}`} onSubmit={onSave}>
          <label>
            <span>Descrição</span>
            <input name="name" defaultValue={editingTransaction?.name ?? ''} placeholder="Ex.: Mercado" required maxLength={120} />
          </label>
          <label>
            <span>Categoria</span>
            <select name="category" defaultValue={editingTransaction?.category ?? categories[0]}>
              {categories.map(category => <option key={category}>{category}</option>)}
            </select>
          </label>
          <label>
            <span>Valor</span>
            <div className="money-input">
              <span>R$</span>
              <input name="value" type="number" min="0.01" max="100000000" step="0.01" defaultValue={editingTransaction?.value} placeholder="0,00" required />
            </div>
          </label>
          <label>
            <span>Data do gasto</span>
            <input name="transactionDate" type="date" defaultValue={editingTransaction?.transactionDate ?? currentDateKey()} required />
          </label>

          <div className="form-actions">
            <button className="primary primary--full" disabled={busy}>
              {busy ? 'Salvando…' : editingTransaction ? 'Atualizar gasto' : 'Salvar gasto'}
              {!busy && <Icon name="arrow" size={17} />}
            </button>
            {editingTransaction && <button type="button" className="secondary-button" onClick={onCancelEdit}>Cancelar edição</button>}
          </div>
        </form>

        <div className="form-security">
          <Icon name="shield" size={17} />
          <span>O registro será salvo apenas na sua conta.</span>
        </div>
      </aside>
    </div>
  )
}
