# ZEUS Finance — Design System

This document records the visual rules for the ZEUS Finance interface. It is intentionally small and operational so future UI changes stay consistent.

## Direction

ZEUS Finance should feel calm, trustworthy, and practical. The interface is a financial tool, not a marketing page.

- Clarity before decoration.
- One visual priority per section.
- Use typography, spacing, and contrast to create hierarchy.
- Keep the dark theme restrained; avoid neon/cyberpunk styling.
- Green is functional: primary actions, focus, and progress.
- Use motion only when it explains a state change.
- Prefer flat surfaces and dividers over stacked cards and heavy shadows.

## Color

Approved palette:

- Canvas: `#0b0e12`
- Sidebar: `#0f1318`
- Surface: `#13181e`
- Raised surface: `#171d24`
- Hover surface: `#1b222a`
- Border: `#28323d`
- Strong border: `#394653`
- Primary text: `#f4f7f9`
- Muted text: `#a7b2bd`
- Subtle text: `#7f8c99`
- Accent: `#38d49a`
- Accent hover: `#2bc38c`
- Accent ink: `#07160f`
- Danger: `#ff8793`

Do not introduce decorative gradients, glow effects, purple/cyan AI palettes, glassmorphism, or gradient text.

## Typography

Font stack:

`Aptos, "Segoe UI Variable", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif`

Type guidance:

- Page title: 30–40px, weight 760, tight but readable tracking.
- Card title: 19px, weight 720.
- Body: 15px, line-height 1.5–1.6.
- Controls and labels: 14px minimum.
- Secondary/meta text: 13px minimum.
- Financial values: tabular numerals.

Avoid body/interface text below 13px. Avoid decorative all-caps labels above headings unless they add information that is not repeated by the heading.

## Spacing

Use a restrained spacing scale based on:

`4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 72px`

Related elements stay close. Separate sections receive more space than elements inside the same group.

## Shape

Approved radii:

- Small controls: 10px
- Compact cards: 14px
- Primary cards: 18px
- Progress tracks/pills only: 999px

Do not use oversized rounded cards.

## Surfaces

Cards use:

- One solid surface color.
- One 1px border.
- No broad decorative shadow.

A shadow is allowed only when it communicates layering, such as the mobile navigation drawer.

Avoid card-inside-card layouts. Use spacing, dividers, or typography first.

## Buttons and inputs

- Minimum interactive height: 44px; primary controls use 46px.
- Primary button uses the accent green with dark text.
- Hover changes color; avoid bounce, zoom, glow, or elastic motion.
- Inputs use a solid dark field, visible border, and a clear focus ring.
- Focus states must remain visible for keyboard users.

## Navigation

- Active navigation uses a restrained raised surface and border.
- Do not use thick colored side tabs for ordinary navigation states.
- User/session information is visually secondary and should not compete with navigation.

## Tables and financial data

- Use dividers instead of nested containers.
- Keep labels and amounts aligned and scannable.
- Use tabular numerals for currency.
- Allow horizontal scrolling when a table cannot safely collapse on narrow screens.

## Responsive behavior

- Desktop: fixed sidebar and two-column content where useful.
- Tablet: content becomes one column; metrics may remain two columns.
- Mobile: drawer navigation; metrics become one column below 460px.
- Keep at least 16px horizontal page padding on narrow screens.
- Avoid horizontal page overflow.

## Accessibility and quality

- Aim for WCAG AA contrast.
- Preserve semantic heading order.
- Keep visible labels on form fields.
- Respect `prefers-reduced-motion`.
- Do not hide content behind entrance animations.
- Error states use both text and color, not color alone.

## Avoid

- Radial-gradient background halos.
- Neon glows on dark UI.
- Glass/frosted panels used decoratively.
- Hairline border plus large soft shadow on the same card.
- Pulsing status dots.
- Repeated decorative badges/eyebrows.
- Tiny interface text.
- Identical decorative feature-card grids.
- Nested cards.
- Hover zooms and unnecessary motion.
