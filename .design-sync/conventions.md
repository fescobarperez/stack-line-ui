# Stackline — Design System

Retail ERP UI (Inventario · POS · Facturación · Reportería). Dense, desktop-first
data screens. React 18. The look is driven by **CSS custom properties (design
tokens)** defined in the global stylesheet — style with `var(--token)`, not a
utility-class framework.

## Styling idiom — use these tokens

All theming flows through CSS variables on `:root` (light) with a dark override.
Reference them as `var(--token)`. The real tokens are:

- **Surfaces / text:** `--bg`, `--surface`, `--surface-2`, `--surface-3`,
  `--text`, `--text-2`, `--muted`, `--border`, `--border-strong`
- **Brand accent:** `--accent`, `--accent-2`, `--accent-ink`, `--accent-soft`
- **Semantic (each has a `-soft` background pair):** `--success` / `--success-soft`,
  `--warning` / `--warning-soft`, `--danger` / `--danger-soft`, `--info` / `--info-soft`
- **Radii:** `--r-sm`, `--r-md`, `--r-lg`, `--r-xl`
- **Elevation:** `--shadow-sm`, `--shadow-md`, `--shadow-lg`
- **Type:** `--font-sans` (IBM Plex Sans), `--font-mono` (IBM Plex Mono)

Do not invent token names — if a value you need isn't above, use a literal and
match the nearest token. Read `styles.css` and the `@import`ed
`_ds_bundle.css` for the full class vocabulary before styling.

## Fonts

The brand faces (IBM Plex Sans / IBM Plex Mono) are served at runtime from Google
Fonts, the same as the app. If a preview shows a system font, wire the Google
Fonts stylesheet; nothing ships in the bundle by design.

## Components

- **`Icon`** — single stroked-SVG icon by name. `<Icon name="dashboard" size={20} />`.
  Color inherits via `currentColor`, so set the parent's `color`. Names include
  `dashboard, pos, box, receipt, chart, settings, user, users, search, bell, cash,
  card, transfer, print, download, edit, trash, alert, calendar, clock, refresh,
  filter, truck` and more (see `Icon.prompt.md`).
- **`GlobalSearch`** — command-palette overlay. Props: `navItems`, `onClose`,
  `onNavigate`. Uses i18n and router context in the real app.
- **`NotificationsPanel`** — dropdown of notifications. Props: `notifications`,
  `unreadCount`, `onMarkRead`, `onMarkAllRead`. Pair with the `useNotifications` hook.
- **`TweaksPanel`** — floating dev/tuning panel (`title`, `children`).

## Build snippet

```jsx
import { Icon } from 'stackline';

function Toolbar() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--r-md)',
                  padding: 12, background: 'var(--surface)',
                  border: '1px solid var(--border)', borderRadius: 'var(--r-lg)',
                  color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
      <Icon name="search" size={16} />
      <span>Buscar productos…</span>
    </div>
  );
}
```
