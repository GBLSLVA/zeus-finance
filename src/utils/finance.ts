import type { Income } from '../domain/finance'

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

export const percent = (value: number) => `${Math.round(Math.max(0, value))}%`
export const progressPercent = (value: number) => `${Math.round(Math.max(0, Math.min(100, value)))}%`

export const effectiveIncomeEnd = (entry: Income) =>
  entry.activeUntil ?? (!entry.active ? entry.updatedAt?.slice(0, 10) || entry.activeFrom : null)
