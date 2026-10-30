import type { IconName } from '../../components/Icon'
import type { View } from '../../domain/finance'

export type NavItem = Readonly<{
  key: View
  label: string
  icon: IconName
}>

/** Single source of truth for desktop and mobile navigation. */
export const navigationItems: readonly NavItem[] = [
  { key: 'overview', label: 'Visão geral', icon: 'overview' },
  { key: 'incomes', label: 'Receitas', icon: 'income' },
  { key: 'transactions', label: 'Gastos', icon: 'wallet' },
  { key: 'budgets', label: 'Orçamentos', icon: 'budget' },
  { key: 'recurring', label: 'Recorrentes', icon: 'calendar' },
  { key: 'debts', label: 'Dívidas', icon: 'debt' },
  { key: 'goals', label: 'Metas', icon: 'goal' },
  { key: 'categories', label: 'Categorias', icon: 'tag' },
]

/** Small-screen quick access; additional sections live in the full drawer. */
export const mobileNavItems = navigationItems.filter(item =>
  item.key === 'overview' || item.key === 'incomes' ||
  item.key === 'transactions' || item.key === 'goals'
)
