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

    </>
  )
}
