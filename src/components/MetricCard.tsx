import { Icon, type IconName } from './Icon'

export function MetricCard({
  label,
  value,
  detail,
  icon,
  tone = 'default',
}: {
  label: string
  value: string
  detail: string
  icon: Extract<IconName, 'income' | 'budget' | 'wallet' | 'debt' | 'goal'>
  tone?: 'default' | 'accent' | 'warning'
}) {
  return (
    <article className={`metric-card metric-card--${tone}`}>
      <div className="metric-card__top">
        <span className="metric-card__label">{label}</span>
        <span className="metric-card__icon"><Icon name={icon} size={18} /></span>
      </div>
      <strong>{value}</strong>
      <span className="metric-card__detail">{detail}</span>
    </article>
  )
}
