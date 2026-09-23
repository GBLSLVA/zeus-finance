import type { Category, Income, View } from './types'

export const titles: Record<View, string> = {
  overview: 'Visão geral',
  incomes: 'Receitas',
  budgets: 'Orçamentos',
  transactions: 'Gastos',
  debts: 'Dívidas',
  goals: 'Metas',
}

export const descriptions: Record<View, string> = {
  overview: 'Receitas, gastos, dívidas e metas no mesmo panorama.',
  incomes: 'Cadastre seu salário mensal e todas as rendas extras.',
  budgets: 'Defina limites mensais por categoria e acompanhe o consumo.',
  transactions: 'Acompanhe para onde o seu dinheiro está indo.',
  debts: 'Organize os valores que ainda precisam ser pagos.',
  goals: 'Transforme objetivos em progresso visível.',
}

export const categories: readonly Category[] = ['Casa', 'Comida', 'Transporte', 'Lazer', 'Outros']

export const categoryColor: Record<Category, string> = {
  Casa: '#58d6a3',
  Comida: '#7ca8ff',
  Transporte: '#f1c96b',
  Lazer: '#bd91ff',
  Outros: '#ff8f96',
}

export const money = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const currentMonthKey = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export const currentDateKey = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export const shiftMonthKey = (monthKey: string, offset: number) => {
  const [year, month] = monthKey.split('-').map(Number)
  const date = new Date(year, month - 1 + offset, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export const formatMonth = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
    .format(new Date(year, month - 1, 1))
    .replace(/^./, letter => letter.toUpperCase())
}

export const percent = (value: number) =>
  `${Math.round(Math.max(0, Math.min(100, value)))}%`

export const effectiveIncomeEnd = (entry: Income) =>
  entry.activeUntil ?? (!entry.active ? entry.updatedAt?.slice(0, 10) || entry.activeFrom : null)
