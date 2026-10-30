import { useEffect, useRef, type ChangeEvent } from 'react'
import { Icon } from '../../components/Icon'
import { navigationItems } from './navigation'
import type { View } from '../../domain/finance'

export interface AccountActions {
  exportBusy: boolean
  restoreBusy: boolean
  exportBackup: () => void
  exportCsv: () => void
  onRestoreFile: (event: ChangeEvent<HTMLInputElement>) => void
  onChangePassword: () => void
  onDeleteAccount: () => void
  onLogout: () => void
}

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  activeView: View
  navigate: (view: View) => void
  email: string
  counts: Record<View, number>
  actions: AccountActions
}

/** Presentational shell: no persistence, API calls or business rules. */
export function NavigationSidebar({
  isOpen, onClose, activeView, navigate, email, counts, actions,
}: SidebarProps) {
  const sidebarRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const panel = sidebarRef.current
    if (!panel) return
    const trigger = document.activeElement instanceof HTMLElement
      ? document.activeElement : null
    panel.querySelector<HTMLButtonElement>('.sidebar-close')?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const elements = Array.from(panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), summary, select, textarea',
      )).filter(element => element.getClientRects().length > 0)
      if (!elements.length) return
      const first = elements[0]
      const last = elements[elements.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      trigger?.focus()
    }
  }, [isOpen])

  return (
      <aside
        ref={sidebarRef}
        id="navigation"
        role={isOpen ? 'dialog' : undefined}
        aria-label={isOpen ? 'Menu de navegação e conta' : undefined}
        aria-modal={isOpen ? true : undefined}
        className={`sidebar ${isOpen ? 'open' : ''}`}
      >
        <div className="sidebar__brand">
          <span className="brand-mark">Z</span>
          <div>
            <strong>ZEUS</strong>
            <span>FINANCE</span>
          </div>
          <button className="sidebar-close" onClick={() => onClose()} aria-label="Fechar menu">
            <Icon name="close" size={20} />
          </button>
        </div>

        <div className="sidebar__section-label">PAINEL</div>
        <nav aria-label="Navegação principal">
          {navigationItems.map(item => (
            <button
              key={item.key}
              className={`nav-item ${activeView === item.key ? 'active' : ''}`}
              aria-current={activeView === item.key ? 'page' : undefined}
              onClick={() => navigate(item.key)}
            >
              <Icon name={item.icon} size={19} />
              <span>{item.label}</span>
              {item.key !== 'overview' && (
                <span className="nav-count">
                  {counts[item.key]}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar__bottom">
          <details className="account-menu">
            <summary className="account-card account-card--interactive">
              <span className="account-avatar">{email.slice(0, 1).toUpperCase()}</span>
              <div className="account-card__identity">
                <strong>{email}</strong>
                <span className="account-card__status"><i aria-hidden="true" />Conta ativa</span>
              </div>
              <span className="account-menu__chevron" aria-hidden="true">›</span>
            </summary>

            <div className="account-menu__panel">
              <div className="account-menu__header">
                <span>Minha conta</span>
                <strong>{email}</strong>
              </div>

              <div className="account-menu__group">
                <span className="account-menu__label">Dados</span>
                <button className="account-menu__action" onClick={actions.exportBackup} disabled={actions.exportBusy}>
                  <Icon name="download" size={17} />
                  {actions.exportBusy ? 'Exportando…' : 'Fazer backup'}
                </button>
                <button className="account-menu__action" onClick={actions.exportCsv} disabled={actions.exportBusy}>
                  <Icon name="download" size={17} />
                  {actions.exportBusy ? 'Exportando…' : 'Exportar CSV'}
                </button>
                <button
                  className="account-menu__action"
                  onClick={() => document.getElementById('restore-backup-input')?.click()}
                  disabled={actions.restoreBusy || actions.exportBusy}
                >
                  <Icon name="upload" size={17} />
                  {actions.restoreBusy ? 'Restaurando…' : 'Restaurar backup'}
                </button>
                <input
                  id="restore-backup-input"
                  type="file"
                  accept="application/json,.json"
                  hidden
                  disabled={actions.restoreBusy}
                  onChange={actions.onRestoreFile}
                />
              </div>

              <div className="account-menu__group">
                <span className="account-menu__label">Segurança</span>
                <button className="account-menu__action" onClick={actions.onChangePassword}>
                  <Icon name="shield" size={17} />
                  Alterar senha
                </button>
              </div>

              <div className="account-menu__group account-menu__group--danger">
                <span className="account-menu__label">Zona de perigo</span>
                <button className="account-menu__action account-menu__action--danger" onClick={actions.onDeleteAccount}>
                  <Icon name="trash" size={17} />
                  Excluir conta
                </button>
              </div>
            </div>
          </details>

          <button className="logout-button sidebar-logout" onClick={actions.onLogout}>
            <Icon name="logout" size={18} />
            Sair da conta
          </button>
        </div>
      </aside>
  )
}
