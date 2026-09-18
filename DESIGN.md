# ZEUS Finance — Design System

This file documents the visual rules that ship with the ZEUS Finance interface.

## Direction

ZEUS Finance should feel calm, trustworthy, practical, and clearly financial.

- Clarity before decoration.
- Financial numbers are the strongest visual anchors.
- Use hierarchy, spacing, and contrast before adding containers.
- Keep the dark theme sober rather than neon/cyberpunk.
- Use one clear primary action per area.
- Prefer flat surfaces, dividers, and compact lists over cards inside cards.
- Motion should explain state changes, never decorate them.

## Core palette

- Canvas: `#090c10`
- Sidebar: `#0c1015`
- Surface: `#11161c`
- Raised surface: `#151b22`
- Strong surface: `#1a2129`
- Border: `#242d37`
- Strong border: `#34404c`
- Primary text: `#f7f9fb`
- Muted text: `#9ca9b6`
- Subtle text: `#758392`
- Primary accent: `#58d6a3`
- Danger: `#ff8f96`

The primary accent is reserved for actions, focus, goal progress, and key financial emphasis.

## Data visualization palette

The dashboard may use a small categorical palette when colors encode data:

- Casa: `#58d6a3`
- Comida: `#7ca8ff`
- Transporte: `#f1c96b`
- Lazer: `#bd91ff`
- Outros: `#ff8f96`

Gradients are not decorative UI styling. A `conic-gradient` is allowed only where it directly encodes category distribution in the spending chart.

## Typography

Font stack:

`Aptos, "Segoe UI Variable", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif`

Guidance:

- Page title: 30–40px, strong weight, tight readable tracking.
- Primary financial amount: 34–52px where it is the page focus.
- Card/panel title: 17–19px.
- Body: 14–15px.
- Labels/meta: 10–13px depending on density; never use tiny text for primary actions or required form information.
- Currency and metrics use tabular numerals.

## Hierarchy

The dashboard deliberately avoids making every element equally important.

1. Monthly spend summary is the primary financial focal point.
2. Debt, reserved value, and goal count are secondary metrics.
3. Category distribution is the primary analytical block.
4. Debt and goal lists are compact supporting blocks.

Do not convert every section into the same card size or visual weight.

## Shape

Approved radii:

- Controls: 9–11px
- Compact panels: 14px
- Main panels: 18px
- Primary summary: 24px
- Progress tracks only: fully rounded

Avoid oversized pill-shaped cards.

## Surfaces

- Use solid surfaces with one 1px border.
- Avoid broad decorative shadows.
- A shadow is allowed when it communicates elevation, such as the mobile navigation drawer.
- Avoid card-inside-card compositions.
- Prefer row dividers and spacing inside panels.

## Navigation

- Sidebar stays visually quieter than the content.
- Active navigation uses a restrained raised surface and border.
- Accent color appears on the active icon rather than as a thick side stripe.
- Record counts are secondary metadata.

## Buttons and forms

- Interactive targets should be at least about 44px high where practical.
- Primary buttons use the green accent with dark text.
- Secondary actions use borders or text buttons.
- Hover states change color/background only; no zoom or bounce.
- Inputs keep visible labels and strong keyboard focus states.
- Monetary inputs show the `R$` prefix visually without changing submitted numeric values.

## Tables and record lists

- Keep row scanning easy with aligned values and dividers.
- Use icons to help distinguish record types.
- Destructive actions remain visually quiet until hover/focus.
- Tables may scroll horizontally on small screens rather than squeezing columns into unreadable widths.

## Responsive behavior

- Desktop: persistent sidebar and multi-column dashboard.
- Medium screens: sidebar becomes an off-canvas drawer.
- Tablet/mobile: dashboard blocks stack.
- Mobile: primary financial summary remains first and most prominent.
- Keep at least 15–16px page padding on narrow screens.

## Accessibility

- Preserve semantic headings and visible form labels.
- Maintain visible keyboard focus.
- Use text with color for error states.
- Respect `prefers-reduced-motion`.
- Do not hide required information inside hover-only interactions.

## Avoid

- Decorative radial background halos.
- Neon glow.
- Glassmorphism.
- Gradient text.
- Pulsing status dots.
- Repeated decorative badges.
- Multiple identical metric cards competing equally for attention.
- Nested cards.
- Hover zooms.
- Vague marketing copy inside product screens.
