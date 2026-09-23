import type { Insight, MonthlySummary } from '../../domain/finance'

type Props = {
  monthLabel: string
  summary: MonthlySummary | null
  insights: Insight[]
}

export function ZeusInsightsPanel({ monthLabel, summary, insights }: Props) {
  return (
    <section className="panel insights-panel" aria-labelledby="zeus-insights-title">
      <div className="panel__header insights-panel__header">
        <div>
          <span className="panel__eyebrow">ANÁLISE AUTOMÁTICA</span>
          <h2 id="zeus-insights-title">ZEUS Insights</h2>
          <p>Leituras automáticas do seu comportamento financeiro em {monthLabel.toLowerCase()}.</p>
        </div>
        <span className="insights-badge">Beta</span>
      </div>

      {summary && (
        <article className={`monthly-summary monthly-summary--${summary.tone}`}>
          <div className="monthly-summary__body">
            <span className="monthly-summary__label">RESUMO DO MÊS</span>
            <h3>{summary.title}</h3>
            <p>{summary.message}</p>
          </div>
          {summary.highlights.length > 0 && (
            <ul className="monthly-summary__highlights">
              {summary.highlights.map(highlight => <li key={highlight}>{highlight}</li>)}
            </ul>
          )}
        </article>
      )}

      <div className="insights-grid">
        {insights.map(insight => (
          <article className={`insight-card insight-card--${insight.tone}`} key={insight.id}>
            <span className="insight-card__signal" aria-hidden="true" />
            <div>
              <strong>{insight.title}</strong>
              <p>{insight.message}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
