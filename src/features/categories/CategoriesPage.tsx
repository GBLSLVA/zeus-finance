import type { FormEvent } from 'react'
import { Icon } from '../../components/Icon'
import type { FinanceCategory } from '../../domain/finance'

type CategoriesPageProps = {
  categories: FinanceCategory[]
  busy: boolean
  onAdd: (event: FormEvent<HTMLFormElement>) => void
  onUpdate: (event: FormEvent<HTMLFormElement>, category: FinanceCategory) => void
  onRemove: (id: number) => void
}

export function CategoriesPage({
  categories,
  busy,
  onAdd,
  onUpdate,
  onRemove,
}: CategoriesPageProps) {
  return (
    <div className="records-layout categories-page">
      <section className="panel records-panel">
        <div className="panel__header records-panel__header">
          <div>
            <span className="panel__eyebrow">ORGANIZAÇÃO</span>
            <h2>Suas categorias</h2>
          </div>
          <span className="records-count">{categories.length} {categories.length === 1 ? 'categoria' : 'categorias'}</span>
        </div>

        <div className="category-manager-list">
          {categories.map(category => (
            <form
              className="category-manager-row"
              key={category.id}
              onSubmit={event => onUpdate(event,category)}
            >
              <span className="category-manager-swatch" style={{ background: category.color }} />
              <label>
                <span>Nome</span>
                <input
                  name="name"
                  defaultValue={category.name}
                  maxLength={60}
                  required
                  aria-label={`Nome da categoria ${category.name}`}
                />
              </label>
              <label className="category-color-field">
                <span>Cor</span>
                <input
                  name="color"
                  type="color"
                  defaultValue={category.color}
                  aria-label={`Cor da categoria ${category.name}`}
                />
              </label>
              <div className="category-manager-meta">
                {category.isDefault && <span className="category-default-badge">Inicial</span>}
              </div>
              <div className="category-manager-actions">
                <button className="secondary-button" disabled={busy} type="submit">
                  <Icon name="edit" size={16} />
                  Salvar
                </button>
                <button
                  className="icon-action icon-action--danger"
                  disabled={busy}
                  type="button"
                  onClick={() => onRemove(category.id)}
                  aria-label={`Excluir categoria ${category.name}`}
                >
                  <Icon name="trash" size={17} />
                </button>
              </div>
            </form>
          ))}
        </div>

        {!categories.length && (
          <div className="table-empty category-empty">
            <div className="empty-block__icon"><Icon name="tag" size={22} /></div>
            <strong>Nenhuma categoria disponível.</strong>
            <span>Crie uma categoria no formulário ao lado.</span>
          </div>
        )}
      </section>

      <aside className="panel record-form-panel">
        <span className="panel__eyebrow">NOVA CATEGORIA</span>
        <h2>Adicionar categoria</h2>
        <p>Crie grupos que façam sentido para sua rotina. A cor será usada nos gráficos e orçamentos.</p>
        <form onSubmit={onAdd}>
          <label>
            <span>Nome</span>
            <input name="name" placeholder="Ex.: Pets, Saúde, Estudos" required maxLength={60} />
          </label>
          <label>
            <span>Cor</span>
            <div className="category-color-picker">
              <input name="color" type="color" defaultValue="#7ca8ff" aria-label="Cor da nova categoria" />
              <small>Escolha uma cor para identificar a categoria no painel.</small>
            </div>
          </label>
          <button className="primary primary--full" disabled={busy}>
            {busy ? 'Salvando…' : 'Criar categoria'}
            {!busy && <Icon name="plus" size={17} />}
          </button>
        </form>
        <div className="form-security">
          <Icon name="shield" size={17} />
          <span>Categorias são exclusivas da sua conta.</span>
        </div>
      </aside>
    </div>
  )
}
