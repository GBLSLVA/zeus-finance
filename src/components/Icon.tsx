import type { ReactNode } from 'react'

export type IconName =
  | 'overview' | 'income' | 'budget' | 'wallet' | 'debt' | 'goal'
  | 'logout' | 'plus' | 'menu' | 'close' | 'arrow' | 'edit' | 'trash'
  | 'shield' | 'calendar' | 'download'

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  const paths: Record<IconName, ReactNode> = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="5" rx="2" /><rect x="14" y="12" width="7" height="9" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /></>,
    income: <><path d="M12 3v18" /><path d="m7 8 5-5 5 5" /><path d="M5 14h14" /><path d="M5 18h14" /></>,
    budget: <><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h10" /><circle cx="18" cy="18" r="3" /></>,
    wallet: <><path d="M4 7.5h13.5A2.5 2.5 0 0 1 20 10v7.5A2.5 2.5 0 0 1 17.5 20h-13A2.5 2.5 0 0 1 2 17.5v-11A2.5 2.5 0 0 1 4.5 4H17v3.5" /><path d="M15.5 12h4.5v4h-4.5a2 2 0 1 1 0-4Z" /></>,
    debt: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 10h18" /><path d="M7 15h4" /></>,
    goal: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><path d="M12 4V2" /><path d="M20 12h2" /></>,
    logout: <><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /><path d="M14 4h4a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3h-4" /></>,
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    menu: <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>,
    close: <><path d="M6 6l12 12" /><path d="M18 6L6 18" /></>,
    arrow: <><path d="M5 12h14" /><path d="m14 7 5 5-5 5" /></>,
    edit: <><path d="M4 20h4l11-11-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></>,
    trash: <><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M7 7l1 13h8l1-13" /><path d="M10 11v5" /><path d="M14 11v5" /></>,
    shield: <><path d="M12 3 5 6v5c0 4.7 2.7 8 7 10 4.3-2 7-5.3 7-10V6l-7-3Z" /><path d="m9.5 12 1.7 1.7 3.6-4" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4" /><path d="M16 3v4" /><path d="M3 10h18" /></>,
    download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>,
  }

  return <svg {...common}>{paths[name]}</svg>
}
