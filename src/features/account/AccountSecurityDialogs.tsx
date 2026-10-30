import type { FormEvent } from 'react'
import { Icon } from '../../components/Icon'

interface Props {
  passwordOpen: boolean
  passwordChanged: boolean
  passwordError: string
  passwordBusy: boolean
  deleteAccountOpen: boolean
  deleteAccountBusy: boolean
  deleteAccountError: string
  closePasswordDialog: () => void
  closeDeleteAccountDialog: () => void
  changePassword: (event: FormEvent<HTMLFormElement>) => void
  deleteAccount: (event: FormEvent<HTMLFormElement>) => void
}

/** Account security UI is isolated from user/data orchestration. */
export function AccountSecurityDialogs({
  passwordOpen, passwordChanged, passwordError, passwordBusy,
  deleteAccountOpen, deleteAccountBusy, deleteAccountError,
  closePasswordDialog, closeDeleteAccountDialog, changePassword, deleteAccount,
}: Props) {
  return (
    <>
      {passwordOpen && (
        <div className="security-modal-backdrop" role="presentation" onMouseDown={event => {
          if (event.target === event.currentTarget) closePasswordDialog()
        }}>
          <section className="security-modal" role="dialog" aria-modal="true" aria-labelledby="change-password-title">
            <div className="security-modal__header">
              <div>
                <h2 id="change-password-title">Alterar senha</h2>
                <p>Ao salvar, as outras sessões da sua conta serão encerradas.</p>
              </div>
              <button className="icon-action" type="button" onClick={closePasswordDialog} aria-label="Fechar alteração de senha">
                <Icon name="close" size={19} />
              </button>
            </div>

            {passwordChanged ? (
              <div className="security-success" role="status">
                <Icon name="shield" size={19} />
                <div>
                  <strong>Senha alterada com sucesso.</strong>
                  <span>Este dispositivo continua conectado e as outras sessões foram encerradas.</span>
                </div>
                <button className="secondary-button" type="button" onClick={closePasswordDialog}>Fechar</button>
              </div>
            ) : (
              <form className="security-form" onSubmit={changePassword}>
                <label>
                  <span>Senha atual</span>
                  <input name="currentPassword" type="password" minLength={12} maxLength={128} autoComplete="current-password" required />
                </label>
                <label>
                  <span>Nova senha</span>
                  <input name="newPassword" type="password" minLength={12} maxLength={128} autoComplete="new-password" required />
                  <small>Use entre 12 e 128 caracteres.</small>
                </label>
                <label>
                  <span>Confirmar nova senha</span>
                  <input name="confirmation" type="password" minLength={12} maxLength={128} autoComplete="new-password" required />
                </label>

                {passwordError && <div className="security-error" role="alert">{passwordError}</div>}

                <div className="form-actions">
                  <button className="primary primary--full" disabled={passwordBusy}>
                    {passwordBusy ? 'Alterando…' : 'Salvar nova senha'}
                    {!passwordBusy && <Icon name="shield" size={17} />}
                  </button>
                  <button className="secondary-button" type="button" onClick={closePasswordDialog} disabled={passwordBusy}>Cancelar</button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}

      {deleteAccountOpen && (
        <div className="security-modal-backdrop" role="presentation" onMouseDown={event => {
          if (event.target === event.currentTarget) closeDeleteAccountDialog()
        }}>
          <section className="security-modal security-modal--danger" role="dialog" aria-modal="true" aria-labelledby="delete-account-title">
            <div className="security-modal__header">
              <div>
                <span className="panel__eyebrow danger-eyebrow">ÁREA DE RISCO</span>
                <h2 id="delete-account-title">Excluir conta</h2>
                <p>Esta ação remove definitivamente seus gastos, receitas, dívidas, pagamentos, metas, orçamentos e sessões.</p>
              </div>
              <button className="icon-action" type="button" onClick={closeDeleteAccountDialog} aria-label="Fechar exclusão de conta">
                <Icon name="close" size={19} />
              </button>
            </div>

            <form className="security-form" onSubmit={deleteAccount}>
              <div className="danger-warning">
                <Icon name="trash" size={19} />
                <div>
                  <strong>Esta ação não pode ser desfeita.</strong>
                  <span>Confirme sua senha e digite EXCLUIR no campo abaixo.</span>
                </div>
              </div>

              <label>
                <span>Senha atual</span>
                <input name="password" type="password" minLength={12} maxLength={128} autoComplete="current-password" required />
              </label>
              <label>
                <span>Confirmação</span>
                <input name="confirmation" type="text" placeholder="EXCLUIR" autoComplete="off" required />
              </label>

              {deleteAccountError && <div className="security-error" role="alert">{deleteAccountError}</div>}

              <div className="form-actions">
                <button className="danger-button primary--full" disabled={deleteAccountBusy}>
                  {deleteAccountBusy ? 'Excluindo…' : 'Excluir minha conta'}
                  {!deleteAccountBusy && <Icon name="trash" size={17} />}
                </button>
                <button className="secondary-button" type="button" onClick={closeDeleteAccountDialog} disabled={deleteAccountBusy}>Cancelar</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  )
}
