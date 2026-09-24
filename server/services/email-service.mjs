const escapeHtml = value => String(value)
  .replaceAll('&','&amp;')
  .replaceAll('<','&lt;')
  .replaceAll('>','&gt;')
  .replaceAll('"','&quot;')
  .replaceAll("'","&#039;");

export class ResendEmailService {
  constructor({
    apiKey = process.env.RESEND_API_KEY,
    from = process.env.PASSWORD_RESET_EMAIL_FROM,
    appBaseUrl = process.env.APP_BASE_URL,
  } = {}) {
    this.apiKey = apiKey;
    this.from = from;
    this.appBaseUrl = appBaseUrl?.replace(/\/$/,'') ?? '';
  }

  get enabled() {
    return Boolean(this.apiKey && this.from && this.appBaseUrl);
  }

  resetUrl(token) {
    if (!this.appBaseUrl) throw new Error('APP_BASE_URL não configurada.');
    return `${this.appBaseUrl}/#reset=${encodeURIComponent(token)}`;
  }

  async sendPasswordReset(email, token) {
    if (!this.enabled) {
      const error = new Error('Serviço de recuperação por e-mail não configurado.');
      error.code = 'EMAIL_NOT_CONFIGURED';
      throw error;
    }

    const resetUrl = this.resetUrl(token);
    const response = await fetch('https://api.resend.com/emails', {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        Authorization:`Bearer ${this.apiKey}`,
      },
      body:JSON.stringify({
        from:this.from,
        to:[email],
        subject:'Redefina sua senha do ZEUS Finance',
        html:`
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#111827">
            <h1 style="font-size:24px">Redefinição de senha</h1>
            <p>Recebemos uma solicitação para redefinir a senha da sua conta no ZEUS Finance.</p>
            <p>
              <a href="${escapeHtml(resetUrl)}" style="display:inline-block;padding:12px 18px;background:#111827;color:#fff;text-decoration:none;border-radius:8px">
                Criar nova senha
              </a>
            </p>
            <p>Este link expira em 30 minutos e só pode ser usado uma vez.</p>
            <p>Se você não fez essa solicitação, ignore este e-mail.</p>
          </div>
        `,
        text:`Redefina sua senha do ZEUS Finance: ${resetUrl}\n\nO link expira em 30 minutos e só pode ser usado uma vez.`,
        tags:[{name:'category',value:'password_reset'}],
      }),
    });

    if (!response.ok) {
      throw new Error(`Falha ao enviar e-mail de recuperação (HTTP ${response.status}).`);
    }
  }
}
