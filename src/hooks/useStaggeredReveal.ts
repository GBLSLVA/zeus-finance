import { useEffect, useRef } from 'react'

/**
 * Small staggered reveal inspired by the Motion choreography at abn.ooo.
 * Uses the native Web Animations API without adding a runtime dependency.
 * Content is visible by default: unsupported APIs, reduced motion and
 * interrupted animations never hide essential financial information.
 */
export function useStaggeredReveal(view: string, enabled: boolean) {
  const rootRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!enabled || !root || view !== 'overview') return
    if (typeof window.matchMedia !== 'function') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const selectors = [
      '.dashboard-hero',
      '.metrics-grid > .metric-card',
      '.dashboard > .assistant-panel',
      '.dashboard > .insights-panel',
    ]

    const targets = Array.from(
      root.querySelectorAll<HTMLElement>(selectors.join(',')),
    ).slice(0, 8)

    const animations = targets
      .filter(target => typeof target.animate === 'function')
      .map((target, index) => {
        const animation = target.animate(
          [
            { opacity: 0, transform: 'translateY(14px)' },
            { opacity: 1, transform: 'translateY(0)' },
          ],
          {
            duration: 350,
            delay: Math.min(index, 6) * 55,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            fill: 'both',
          },
        )
        // Release fill effects so later hover/focus and layout styles win.
        void animation.finished.then(() => animation.cancel(), () => {})
        return animation
      })

    return () => animations.forEach(animation => animation.cancel())
  }, [view, enabled])

  return rootRef
}
