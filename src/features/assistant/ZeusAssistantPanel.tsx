import type { FormEvent } from 'react'
import { Icon } from '../../components/Icon'
import type { AssistantResponse } from '../../domain/finance'

type Props = {
  monthLabel: string
  answer: AssistantResponse | null
  question: string
  busy: boolean
  onQuestionChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onSuggestion: (suggestion: string) => void
}

const defaultSuggestions = [
  'Quanto gastei este mês?',
  'Qual meu saldo?',
  'Maior categoria de gastos',
  'Resumo do mês',
]

export function ZeusAssistantPanel({
  monthLabel,
  answer,
  question,
  busy,
  onQuestionChange,
  onSubmit,
  onSuggestion,
}: Props) {
  const suggestions = (answer?.suggestions ?? defaultSuggestions).slice(0,4)

  return (
    <section className="panel assistant-panel" aria-labelledby="zeus-assistant-title">
      <div className="panel__header assistant-panel__header">
        <div>
          <div className="assistant-title-row">
            <h2 id="zeus-assistant-title">Pergunte ao ZEUS</h2>
            <span className="assistant-beta">BETA</span>
          </div>
          <p>Respostas baseadas nos seus dados de {monthLabel.toLowerCase()}.</p>
        </div>
      </div>

      {answer && (
        <div className="assistant-answer" role="status">
          <strong>Resposta do ZEUS</strong>
          <p>{answer.answer}</p>
        </div>
      )}

      <form className="assistant-form" onSubmit={onSubmit}>
        <div className="assistant-composer">
          <input
            value={question}
            onChange={event => onQuestionChange(event.target.value)}
            placeholder="Pergunte algo sobre suas finanças..."
            maxLength={300}
            aria-label="Pergunta para o ZEUS"
          />
          <button
            className="assistant-send"
            type="submit"
            disabled={busy || !question.trim()}
            aria-label={busy ? 'ZEUS analisando pergunta' : 'Enviar pergunta ao ZEUS'}
          >
            {busy ? <span aria-hidden="true">•••</span> : <Icon name="arrow" size={18} />}
          </button>
        </div>
      </form>

      <div className="assistant-suggestions" aria-label="Sugestões de perguntas">
        <span className="assistant-suggestions__label">Sugestões</span>
        {suggestions.map(suggestion => (
          <button
            type="button"
            key={suggestion}
            disabled={busy}
            onClick={() => onSuggestion(suggestion)}
          >
            {suggestion}
          </button>
        ))}
      </div>
    </section>
  )
}
