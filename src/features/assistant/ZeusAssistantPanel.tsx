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
  'Qual foi minha maior categoria de gastos?',
  'Quanto ainda tenho de saldo?',
  'Me dê um resumo do mês.',
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
          <span className="panel__eyebrow">PERGUNTE AO ZEUS</span>
          <h2 id="zeus-assistant-title">Seu painel também responde</h2>
          <p>Faça perguntas sobre os números de {monthLabel.toLowerCase()} usando os dados já registrados na sua conta.</p>
        </div>
        <span className="insights-badge">Beta</span>
      </div>

      {answer && (
        <div className="assistant-answer" role="status">
          <span>ZEUS</span>
          <p>{answer.answer}</p>
        </div>
      )}

      <form className="assistant-form" onSubmit={onSubmit}>
        <input
          value={question}
          onChange={event => onQuestionChange(event.target.value)}
          placeholder="Ex.: Quanto ainda tenho de saldo?"
          maxLength={300}
          aria-label="Pergunta para o ZEUS"
        />
        <button className="primary" type="submit" disabled={busy || !question.trim()}>
          {busy ? 'Analisando…' : 'Perguntar'}
          {!busy && <Icon name="arrow" size={17} />}
        </button>
      </form>

      <div className="assistant-suggestions" aria-label="Sugestões de perguntas">
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
