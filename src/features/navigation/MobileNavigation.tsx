import type { View } from '../../domain/finance'
import { Icon } from '../../components/Icon'
import { mobileNavItems } from './navigation'

type Props = {
  activeView: View
  navigate: (view: View) => void
  onMore: () => void
  menuOpen: boolean
}

export function MobileNavigation({ activeView, navigate, onMore, menuOpen }: Props) {
  const moreActive = !mobileNavItems.some(item => item.key === activeView)
  return (
    <nav className="mobile-dock" aria-label="Navegação rápida">
      {mobileNavItems.map(item => (
        <button
          key={item.key}
          className={'mobile-dock__item' + (item.key === activeView ? ' is-current' : '')}
          type="button"
          aria-current={item.key === activeView ? 'page' : undefined}
          onClick={() => navigate(item.key)}
        >
          <Icon name={item.icon} size={21} />
          <span>{item.key === 'overview' ? 'Início' : item.label}</span>
        </button>
      ))}
      <button
        className={'mobile-dock__item' + (moreActive || menuOpen ? ' is-current' : '')}
        type="button"
        onClick={onMore}
        aria-label="Mais seções"
        aria-controls="navigation"
        aria-expanded={menuOpen}
      >
        <Icon name="menu" size={21} />
        <span>Mais</span>
      </button>
    </nav>
  )
}
