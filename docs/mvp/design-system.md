# Design System: ZenDash

**Source:** Zencoder.ai visual identity, adapted for the analytics dashboard.
**Date:** 2026-04-03

---

## 1. Color Palette

### Core (Dark Theme — Default)

| Token | Hex | Usage |
|---|---|---|
| `--background` | `#100f0d` | Page background |
| `--background-secondary` | `#131210` | Sidebar, secondary surfaces |
| `--card` | `#151513` | Cards, panels, table containers |
| `--popover` | `#181715` | Dropdowns, tooltips |
| `--muted` | `#1a1917` | Muted backgrounds, disabled states |
| `--accent` | `#232320` | Active states, hover backgrounds, input focus |
| `--input` | `#1f1e1b` | Input fields, select boxes |

### Text

| Token | Hex | Usage |
|---|---|---|
| `--foreground` | `#f6f5f3` | Primary text, headings, values |
| `--foreground-secondary` | `#e5e4e2` | Section titles, chart titles |
| `--foreground-muted` | `#9f9e9c` | Labels, axis text, helper text, timestamps |

### Brand

| Token | Hex | Usage |
|---|---|---|
| `--primary` | `#c34513` | CTA buttons, primary progress bars, chart lines |
| `--primary-hover` | `#a83b10` | Button hover |
| `--primary-foreground` | `#f6f5f2` | Text on primary bg |
| `--brand-mark` | `#e65c2c` | Logo mark, brand dot |
| `--accent-foreground` | `#fda16b` | Active nav text, links, file paths, highlights |

### Semantic

| Token | Hex | Usage |
|---|---|---|
| `--success` | `#218b30` | Positive metrics, completion, cache savings |
| `--error` | `#d1003e` | Errors, over-budget, negative trends |
| `--warning` | `#ffb900` | Warnings, approaching thresholds, caution |

### Chart

| Token | Hex | Usage |
|---|---|---|
| `--chart-blue` | `#3b82f6` | Input tokens, Haiku model |
| `--chart-purple` | `#8b5cf6` | Output tokens, Sonnet model |
| `--chart-cyan` | `#06b6d4` | Cache creation tokens |
| `--chart-green` | `#218b30` | Cache read tokens, success bars |
| `--chart-orange` | `#c34513` | Cost line, Opus model |
| `--chart-red` | `#d1003e` | Error bars |
| `--chart-gray` | `#9f9e9c` | Cancelled, neutral |

### Borders & Surfaces

| Token | Value | Usage |
|---|---|---|
| `--border` | `rgba(246,245,243,0.09)` | Card borders, dividers, table lines |
| `--ring` | `rgba(246,245,243,0.05)` | Focus rings |
| `--row-alt` | `rgba(246,245,243,0.03)` | Alternating table rows |
| `--grid-line` | `rgba(246,245,243,0.05)` | Chart grid lines |

---

## 2. Typography

| Element | Font | Weight | Size | Color | Extras |
|---|---|---|---|---|---|
| Headings (h1-h2) | Funnel Sans, Inter | 500 | 24-30px | `--foreground` | letter-spacing: tight |
| Section titles | Inter | 500 | 14px | `--foreground-secondary` | — |
| KPI values | Inter | 600 | 28-32px | `--foreground` | tabular-nums |
| KPI labels | Inter | 500 | 11px | `--foreground-muted` | uppercase, letter-spacing: 0.05em |
| Body text | Inter | 400 | 14px | `--foreground` | — |
| Helper text | Inter | 400 | 12px | `--foreground-muted` | — |
| Table headers | Inter | 500 | 11px | `--foreground-muted` | uppercase, letter-spacing: 0.05em |
| Table cells | Inter | 400 | 13px | `--foreground` | — |
| Code / file paths | Geist Mono | 400 | 12px | `--accent-foreground` | — |
| Chart axis | Inter | 400 | 11px | `--foreground-muted` | — |

---

## 3. Spacing & Layout

| Token | Value | Usage |
|---|---|---|
| `--sidebar-width` | 220px | Fixed left sidebar |
| `--filter-bar-height` | 56px | Sticky top filter bar |
| `--card-padding` | 24px | Inner padding for cards |
| `--card-gap` | 16px | Gap between cards in a row |
| `--row-gap` | 20px | Gap between rows of cards |
| `--section-gap` | 32px | Gap between major sections |

### Border Radius

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | 4px | Badges, small pills |
| `--radius-md` | 6px | Tags, inline elements |
| `--radius-lg` | 8px | Inputs, smaller cards |
| `--radius-xl` | 12px | Cards, buttons, panels |
| `--radius-2xl` | 16px | Modal dialogs |

---

## 4. Component Patterns

### Cards

```
background: var(--card)
border: 1px solid var(--border)
border-radius: var(--radius-xl)
padding: var(--card-padding)
```

### Sidebar Nav Item

```
-- Inactive:
color: var(--foreground-muted)
background: transparent
padding: 8px 16px
font-size: 14px

-- Active:
color: var(--accent-foreground)
background: var(--accent)
border-left: 3px solid var(--primary)
```

### KPI Card

```
background: var(--card)
border: 1px solid var(--border)
border-radius: var(--radius-xl)
padding: 20px 24px

-- Label: uppercase, 11px, var(--foreground-muted), letter-spacing 0.05em
-- Value: 28px, weight 600, var(--foreground), tabular-nums
-- Delta: 12px, colored by sentiment (success/warning/error)
```

### Buttons

```
-- Primary:
background: var(--primary)
color: var(--primary-foreground)
border-radius: var(--radius-xl)
padding: 8px 16px
font-size: 14px, weight 500
hover: opacity 0.9

-- Ghost/Outline:
background: transparent
color: var(--foreground-muted)
border: 1px solid var(--border)
hover: background var(--accent), color var(--foreground)

-- Pill (filter toggle):
background: transparent (inactive) / var(--accent) (active)
color: var(--foreground-muted) (inactive) / var(--foreground) (active)
border-radius: var(--radius-xl)
padding: 6px 12px
font-size: 13px
```

### Toggle Switch

```
-- Track: 36px x 20px, border-radius 10px
-- ON:  background var(--primary), circle white at right
-- OFF: background var(--accent), circle var(--foreground-muted) at left
```

### Tables

```
-- Header: var(--foreground-muted), 11px uppercase, letter-spacing 0.05em
-- Row: var(--foreground) text, padding 10px 16px
-- Alternating: transparent / var(--row-alt)
-- Hover: background var(--accent)
-- Borders: bottom border var(--border) on rows
```

### Progress Bars

```
-- Track: var(--accent), height 8px, border-radius 4px
-- Fill: var(--primary) for budget, var(--success/warning/error) for status
-- Threshold markers: 2px wide ticks, var(--foreground-muted)
```

### Insight Cards

```
background: var(--card)
border-left: 4px solid (contextual: --primary, --error, --warning)
padding: 12px 16px
-- Title: 13px var(--foreground)
-- Sublabel: 12px var(--foreground-muted)
-- Action link: 12px var(--accent-foreground)
```

---

## 5. Tailwind Config

```js
// tailwind.config.js
const config = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: '#100f0d',
          secondary: '#131210',
        },
        card: '#151513',
        popover: '#181715',
        muted: {
          DEFAULT: '#1a1917',
          foreground: '#9f9e9c',
        },
        accent: {
          DEFAULT: '#232320',
          foreground: '#fda16b',
        },
        input: '#1f1e1b',
        foreground: {
          DEFAULT: '#f6f5f3',
          secondary: '#e5e4e2',
          muted: '#9f9e9c',
        },
        primary: {
          DEFAULT: '#c34513',
          hover: '#a83b10',
          foreground: '#f6f5f2',
        },
        brand: '#e65c2c',
        success: '#218b30',
        error: '#d1003e',
        warning: '#ffb900',
        chart: {
          blue: '#3b82f6',
          purple: '#8b5cf6',
          cyan: '#06b6d4',
          green: '#218b30',
          orange: '#c34513',
          red: '#d1003e',
          gray: '#9f9e9c',
        },
        border: 'rgba(246,245,243,0.09)',
        ring: 'rgba(246,245,243,0.05)',
        'row-alt': 'rgba(246,245,243,0.03)',
        'grid-line': 'rgba(246,245,243,0.05)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        heading: ['Funnel Sans', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'monospace'],
      },
      fontSize: {
        'kpi-value': ['28px', { lineHeight: '1.2', fontWeight: '600' }],
        'kpi-label': ['11px', { lineHeight: '1.4', fontWeight: '500', letterSpacing: '0.05em' }],
        'table-header': ['11px', { lineHeight: '1.4', fontWeight: '500', letterSpacing: '0.05em' }],
      },
      spacing: {
        'sidebar': '220px',
        'filter-bar': '56px',
        'card-padding': '24px',
      },
      borderRadius: {
        sm: '4px',
        md: '6px',
        lg: '8px',
        xl: '12px',
        '2xl': '16px',
      },
    },
  },
}

export default config
```

---

## 6. CSS Custom Properties

```css
/* globals.css — paste into your global stylesheet */

@layer base {
  :root {
    --background: #100f0d;
    --background-secondary: #131210;
    --card: #151513;
    --popover: #181715;
    --muted: #1a1917;
    --accent: #232320;
    --input: #1f1e1b;

    --foreground: #f6f5f3;
    --foreground-secondary: #e5e4e2;
    --foreground-muted: #9f9e9c;

    --primary: #c34513;
    --primary-hover: #a83b10;
    --primary-foreground: #f6f5f2;
    --brand-mark: #e65c2c;
    --accent-foreground: #fda16b;

    --success: #218b30;
    --error: #d1003e;
    --warning: #ffb900;

    --chart-blue: #3b82f6;
    --chart-purple: #8b5cf6;
    --chart-cyan: #06b6d4;
    --chart-green: #218b30;
    --chart-orange: #c34513;
    --chart-red: #d1003e;
    --chart-gray: #9f9e9c;

    --border: rgba(246, 245, 243, 0.09);
    --ring: rgba(246, 245, 243, 0.05);
    --row-alt: rgba(246, 245, 243, 0.03);
    --grid-line: rgba(246, 245, 243, 0.05);

    --radius-sm: 4px;
    --radius-md: 6px;
    --radius-lg: 8px;
    --radius-xl: 12px;
    --radius-2xl: 16px;

    --sidebar-width: 220px;
    --filter-bar-height: 56px;
    --card-padding: 24px;
    --card-gap: 16px;
    --row-gap: 20px;
  }

  body {
    background-color: var(--background);
    color: var(--foreground);
    font-family: 'Inter', system-ui, sans-serif;
  }
}
```

---

## 7. Mockup Reference

| Mockup | File |
|---|---|
| Overview | [`mockup-overview.svg`](./mockup-overview.svg) |
| Costs | [`mockup-costs.svg`](./mockup-costs.svg) |
| Teams | [`mockup-teams.svg`](./mockup-teams.svg) |
| Settings | [`mockup-settings.svg`](./mockup-settings.svg) |
