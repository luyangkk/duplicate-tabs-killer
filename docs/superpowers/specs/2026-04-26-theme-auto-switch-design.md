# Theme Auto-Switch Design

**Date:** 2026-04-26  
**Scope:** Dashboard + Popup  
**Status:** Approved

## Overview

Implement a three-mode theme system (`light | dark | system`) that automatically follows the OS day/night preference and allows manual override from the Dashboard Settings page. Both the popup and dashboard apply dark mode styles.

---

## 1. Theme Logic & Storage

### Modes

```ts
type ThemeMode = 'light' | 'dark' | 'system'
// 'system' resolves to 'light' or 'dark' based on OS preference
```

Default mode on first install: `'system'`.

### Storage

- **Primary:** `chrome.storage.sync`, key `'themeMode'` — persists user preference across devices.
- **Mirror:** `localStorage`, key `'themeMode'` — written in sync whenever `chrome.storage.sync` is written, used only for flash prevention.

### Flash of Wrong Theme (FOWT) Prevention

Each HTML entry file (`src/popup/index.html`, `src/dashboard/index.html`) gets an inline `<script>` in `<head>` that synchronously reads the `localStorage` mirror and applies the `dark` class to `<html>` before React renders:

```html
<script>
  (function () {
    var mode = localStorage.getItem('themeMode') || 'system';
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (mode === 'dark' || (mode === 'system' && prefersDark)) {
      document.documentElement.classList.add('dark');
    }
  })();
</script>
```

### `useTheme` Hook Interface

Replace the existing `src/hooks/useTheme.ts` entirely:

```ts
function useTheme(): {
  themeMode: ThemeMode           // stored user preference
  resolvedTheme: 'light' | 'dark' // actual applied theme
  setThemeMode: (mode: ThemeMode) => void
  isDark: boolean
}
```

**Responsibilities:**

1. Initialize `themeMode` synchronously from `localStorage` mirror (avoids async gap).
2. Async-sync with `chrome.storage.sync` on mount (reconciles if storage differs from mirror).
3. Compute `resolvedTheme`: if `themeMode === 'system'`, query `matchMedia('(prefers-color-scheme: dark)')`.
4. When `themeMode === 'system'`, register a `matchMedia` `change` listener; clean it up on mode change or unmount.
5. Apply `dark` / remove `dark` class on `document.documentElement` whenever `resolvedTheme` changes.
6. On `setThemeMode`: write to `chrome.storage.sync` and `localStorage` mirror together.

### Usage

Both `src/popup/main.tsx` and `src/dashboard/main.tsx` call `useTheme()` at the app root (or in the top-level `App` component) so the class is applied once per page.

---

## 2. Settings UI

### Theme Card in Settings

Add a new "外观" card **above** the existing "Storage Settings" card in `src/dashboard/Settings.tsx`.

**Structure:**
- Header: palette icon + "外观" title + subtitle "控制界面的明暗主题"
- Segmented control with three buttons: `☀️ 日间` / `🌙 夜间` / `💻 跟随系统`
- Below control: small descriptive text shown only when `themeMode === 'system'`, e.g. "当前跟随系统（夜间）"

**Segmented control behavior:**
- Active segment: `bg-white shadow dark:bg-gray-700` on the button, container has `bg-gray-100 dark:bg-gray-800` background
- Clicking a segment calls `setThemeMode(mode)`

---

## 3. Dark Mode Styles

Tailwind is already configured with `darkMode: "class"`. No config changes needed.

### Color Mapping

| Light class | Dark variant |
|---|---|
| `bg-white` | `dark:bg-gray-800` |
| `bg-gray-50` | `dark:bg-gray-900` |
| `bg-gray-100` | `dark:bg-gray-700` |
| `text-gray-900` | `dark:text-gray-100` |
| `text-gray-800` | `dark:text-gray-200` |
| `text-gray-700` | `dark:text-gray-300` |
| `text-gray-600` | `dark:text-gray-400` |
| `text-gray-500` | `dark:text-gray-500` |
| `text-gray-400` | `dark:text-gray-500` |
| `border-gray-200` | `dark:border-gray-700` |
| `border-gray-100` | `dark:border-gray-700` |
| `border-gray-50` | `dark:border-gray-800` |

Blue accent colors (`text-blue-600`, `bg-blue-50`, etc.) are kept as-is or lightly adjusted — no major changes.

### Files to Update

**Dashboard**
- `src/dashboard/App.tsx` — main bg, sidebar, cards, search input, modals, toasts, archive cards, tab rows
- `src/dashboard/Settings.tsx` — setting cards, buttons

**Popup**
- `src/popup/App.tsx` — header, status card, stats grid, duplicate list items

**Shared Components**
- `src/components/DomainPreviewModal.tsx`
- `src/components/Empty.tsx`

---

## 4. Architecture Summary

```
chrome.storage.sync ('themeMode')
        │  write + read (async)
        ▼
localStorage mirror ('themeMode')
        │  read sync (FOWT prevention)
        ▼
inline <script> in index.html
        │  applies 'dark' class to <html> before React
        ▼
useTheme() at App root
        │  reconciles, listens to matchMedia if 'system'
        ▼
document.documentElement.classList (dark / light)
        │
        ▼
Tailwind dark: variants render correctly
```

---

## 5. Out of Scope

- Popup does not have its own theme toggle (only respects stored preference).
- No CSS custom property / design token approach.
- No scheduled theme switching (e.g., "go dark at 9pm") — follows OS only.
