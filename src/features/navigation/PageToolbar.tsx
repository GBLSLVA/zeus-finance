import type { Dispatch, SetStateAction } from 'react'
import { Icon } from '../../components/Icon'
import type { View } from '../../domain/finance'
import { titles, descriptions } from '../../domain/finance'
import { currentMonthKey, shiftMonthKey } from '../../utils/finance'

interface Props {
  view: View
  monthLabel: string
  selectedMonth: string
  onMonthChange: Dispatch<SetStateAction<string>>
  onNavigate: (view: View) => void
  onOpenMenu: () => void
  menuOpen: boolean
}

/** App toolbar is UI-only; financial period calculations live in utils. */
export function PageToolbar({
  view, monthLabel, selectedMonth, onMonthChange, onNavigate, onOpenMenu, menuOpen,
}: Props) {
  return (
    <>
        <header className="page-header">
          <div className="page-header__left">
            <button
              className="menu-button"
              aria-controls="navigation"
              aria-expanded={menuOpen}
              onClick={() => onOpenMenu()}
              aria-label="Abrir menu"
            >
              <Icon name="menu" size={21} />
            </button>
            <div>
              {view === 'overview' && <span className="section-kicker">{monthLabel}</span>}
              <h1>{titles[view]}</h1>
              <p>{descriptions[view]}</p>
            </div>
          </div>
          {view === 'overview' && (
            <button className="primary page-header__action" onClick={() => onNavigate('incomes')}>
              <Icon name="plus" size={18} />
              Nova receita
            </button>
          )}
        </header>

        {(view === 'overview' || view === 'budgets' || view === 'recurring') && (
          <div className="period-toolbar" aria-label="Selecionar período">
            <button className="period-button" onClick={() => onMonthChange(current => shiftMonthKey(current, -1))} aria-label="Mês anterior">‹</button>
            <div className="period-toolbar__current">
              <Icon name="calendar" size={16} />
              <strong>{monthLabel}</strong>
            </div>
            <button className="period-button" onClick={() => onMonthChange(current => shiftMonthKey(current, 1))} aria-label="Próximo mês">›</button>
            {selectedMonth !== currentMonthKey() && (
              <button className="period-today" onClick={() => onMonthChange(currentMonthKey())}>Mês atual</button>
            )}
          </div>
        )}

    </>
  )
}
