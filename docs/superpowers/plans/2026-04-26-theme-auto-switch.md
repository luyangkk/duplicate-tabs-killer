# Theme Auto-Switch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a three-mode theme system (light/dark/system) with OS auto-switching and a manual toggle in Dashboard Settings, covering both popup and dashboard UI.

**Architecture:** A rewritten `useTheme` hook exposes `themeMode` ('light'|'dark'|'system'), persists to `chrome.storage.sync` with a `localStorage` mirror for synchronous reads. Each page's `main.tsx` applies the initial theme class before React renders to prevent flash of wrong theme (MV3 disallows inline `<script>` tags). Tailwind `dark:` variants provide all visual theming, toggled by a `dark` class on `<html>`.

**Tech Stack:** React 18, TypeScript, Tailwind CSS 3 (`darkMode: "class"`), Vitest, `chrome.storage.sync`

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Rewrite | `src/hooks/useTheme.ts` | ThemeMode type, pure helpers, hook |
| Create | `src/hooks/useTheme.test.ts` | Unit tests for pure helpers |
| Modify | `src/popup/main.tsx` | FOWT prevention before React render |
| Modify | `src/dashboard/main.tsx` | FOWT prevention before React render |
| Modify | `src/popup/index.html` | dark: body background |
| Modify | `src/dashboard/index.html` | dark: body background |
| Modify | `src/popup/App.tsx` | call useTheme(), dark: variants |
| Modify | `src/dashboard/App.tsx` | call useTheme(), pass to Settings, dark: variants |
| Modify | `src/dashboard/Settings.tsx` | theme segmented control, accept theme props, dark: variants |
| Modify | `src/components/DomainPreviewModal.tsx` | dark: variants |

---

### Task 1: Write failing tests for useTheme pure helpers

**Files:**
- Create: `src/hooks/useTheme.test.ts`

- [ ] **Step 1: Create the test file**

```ts
// src/hooks/useTheme.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  resolveTheme,
  readThemeMirror,
  readThemeStorage,
  writeThemeStorage,
  THEME_STORAGE_KEY,
} from './useTheme';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear() { store = {}; },
  };
})();

const chromeMock = {
  storage: {
    sync: {
      get: vi.fn(),
      set: vi.fn(),
    },
  },
};

beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
  vi.stubGlobal('localStorage', localStorageMock);
  vi.stubGlobal('chrome', chromeMock);
  chromeMock.storage.sync.get.mockImplementation((_: string, cb: (r: Record<string, unknown>) => void) => cb({}));
  chromeMock.storage.sync.set.mockImplementation((_: Record<string, unknown>, cb?: () => void) => cb?.());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('resolveTheme', () => {
  it('returns "dark" for mode "dark" regardless of system', () => {
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('dark', true)).toBe('dark');
  });

  it('returns "light" for mode "light" regardless of system', () => {
    expect(resolveTheme('light', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
  });

  it('returns "dark" for mode "system" when system prefers dark', () => {
    expect(resolveTheme('system', true)).toBe('dark');
  });

  it('returns "light" for mode "system" when system prefers light', () => {
    expect(resolveTheme('system', false)).toBe('light');
  });
});

describe('readThemeMirror', () => {
  it('returns "system" when localStorage has no value', () => {
    expect(readThemeMirror()).toBe('system');
  });

  it('returns stored value when it is a valid ThemeMode', () => {
    localStorageMock.setItem(THEME_STORAGE_KEY, 'dark');
    expect(readThemeMirror()).toBe('dark');
  });

  it('returns "system" for invalid stored values', () => {
    localStorageMock.setItem(THEME_STORAGE_KEY, 'invalid');
    expect(readThemeMirror()).toBe('system');
  });
});

describe('readThemeStorage', () => {
  it('returns mode from chrome.storage.sync', async () => {
    chromeMock.storage.sync.get.mockImplementation((_: string, cb: (r: Record<string, unknown>) => void) =>
      cb({ [THEME_STORAGE_KEY]: 'light' })
    );
    expect(await readThemeStorage()).toBe('light');
  });

  it('returns "system" when chrome.storage.sync has no stored value', async () => {
    expect(await readThemeStorage()).toBe('system');
  });

  it('falls back to localStorage mirror when chrome is unavailable', async () => {
    vi.stubGlobal('chrome', undefined);
    localStorageMock.setItem(THEME_STORAGE_KEY, 'dark');
    expect(await readThemeStorage()).toBe('dark');
  });
});

describe('writeThemeStorage', () => {
  it('writes mode to localStorage mirror', async () => {
    await writeThemeStorage('dark');
    expect(localStorageMock.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('writes mode to chrome.storage.sync', async () => {
    await writeThemeStorage('light');
    expect(chromeMock.storage.sync.set).toHaveBeenCalledWith(
      { [THEME_STORAGE_KEY]: 'light' },
      expect.any(Function)
    );
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npm test -- src/hooks/useTheme.test.ts`

Expected: FAIL — import errors because the named exports don't exist yet in `useTheme.ts`

---

### Task 2: Rewrite useTheme.ts — make tests pass

**Files:**
- Modify: `src/hooks/useTheme.ts`

- [ ] **Step 1: Replace the entire file**

```ts
import { useState, useEffect } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'themeMode';
const DEFAULT_MODE: ThemeMode = 'system';

export function resolveTheme(mode: ThemeMode, systemPrefersDark: boolean): 'light' | 'dark' {
  if (mode === 'system') return systemPrefersDark ? 'dark' : 'light';
  return mode;
}

export function readThemeMirror(): ThemeMode {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  return DEFAULT_MODE;
}

export async function readThemeStorage(): Promise<ThemeMode> {
  if (typeof chrome === 'undefined' || !chrome.storage?.sync) return readThemeMirror();
  return new Promise<ThemeMode>((resolve) => {
    chrome.storage.sync.get(THEME_STORAGE_KEY, (result) => {
      const mode = result[THEME_STORAGE_KEY] as ThemeMode | undefined;
      if (mode === 'light' || mode === 'dark' || mode === 'system') resolve(mode);
      else resolve(DEFAULT_MODE);
    });
  });
}

export async function writeThemeStorage(mode: ThemeMode): Promise<void> {
  localStorage.setItem(THEME_STORAGE_KEY, mode);
  if (typeof chrome === 'undefined' || !chrome.storage?.sync) return;
  return new Promise<void>((resolve) => {
    chrome.storage.sync.set({ [THEME_STORAGE_KEY]: mode }, () => resolve());
  });
}

export function useTheme() {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(readThemeMirror);
  const [systemPrefersDark, setSystemPrefersDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  const resolvedTheme = resolveTheme(themeMode, systemPrefersDark);
  const isDark = resolvedTheme === 'dark';

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  // Reconcile with chrome.storage.sync once on mount
  useEffect(() => {
    readThemeStorage().then((stored) => {
      if (stored !== themeMode) {
        setThemeModeState(stored);
        localStorage.setItem(THEME_STORAGE_KEY, stored);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep system preference current at all times
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    await writeThemeStorage(mode);
  };

  return { themeMode, resolvedTheme, setThemeMode, isDark };
}
```

- [ ] **Step 2: Run tests**

Run: `npm test -- src/hooks/useTheme.test.ts`

Expected: All 11 tests PASS

- [ ] **Step 3: Run full test suite to confirm no regressions**

Run: `npm test`

Expected: All tests pass

- [ ] **Step 4: Type-check**

Run: `npm run check`

Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useTheme.ts src/hooks/useTheme.test.ts
git commit -m "feat(theme): rewrite useTheme with light/dark/system modes and chrome.storage.sync"
```

---

### Task 3: FOWT prevention in main.tsx + dark body class in index.html

**Files:**
- Modify: `src/popup/main.tsx`
- Modify: `src/dashboard/main.tsx`
- Modify: `src/popup/index.html`
- Modify: `src/dashboard/index.html`

- [ ] **Step 1: Replace src/popup/main.tsx**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import '../index.css'

// Apply initial theme class synchronously before React renders.
// MV3 extensions cannot use inline <script> in HTML, so this is the earliest safe point.
// Reads the localStorage mirror written by writeThemeStorage.
;(function applyInitialTheme() {
  const mode = localStorage.getItem('themeMode') ?? 'system'
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  if (mode === 'dark' || (mode === 'system' && prefersDark)) {
    document.documentElement.classList.add('dark')
  }
})()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 2: Replace src/dashboard/main.tsx**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import '../index.css'

;(function applyInitialTheme() {
  const mode = localStorage.getItem('themeMode') ?? 'system'
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  if (mode === 'dark' || (mode === 'system' && prefersDark)) {
    document.documentElement.classList.add('dark')
  }
})()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 3: Update src/popup/index.html body class**

```html
<body class="bg-gray-50 dark:bg-gray-900 w-[400px] h-[600px] overflow-hidden">
```

- [ ] **Step 4: Update src/dashboard/index.html body class**

```html
<body class="bg-gray-100 dark:bg-gray-900 min-h-screen">
```

- [ ] **Step 5: Commit**

```bash
git add src/popup/main.tsx src/dashboard/main.tsx src/popup/index.html src/dashboard/index.html
git commit -m "feat(theme): add FOWT prevention in main.tsx and dark body classes"
```

---

### Task 4: Wire useTheme() into App roots + update Settings interface

**Files:**
- Modify: `src/popup/App.tsx`
- Modify: `src/dashboard/App.tsx`
- Modify: `src/dashboard/Settings.tsx`

- [ ] **Step 1: Add useTheme() call to src/popup/App.tsx**

Add import at the top of the file (after existing imports):
```tsx
import { useTheme } from '@/hooks/useTheme';
```

Add as the first line inside the `App()` function body:
```tsx
useTheme(); // applies dark class to <html>; popup needs no theme controls
```

- [ ] **Step 2: Wire useTheme() into src/dashboard/App.tsx**

Add import at the top:
```tsx
import { useTheme, ThemeMode } from '@/hooks/useTheme';
```

Add inside `App()` function, after the existing hook calls near the top:
```tsx
const { themeMode, setThemeMode } = useTheme();
```

Find the `<Settings />` render and update it:
```tsx
// from:
{activeTab === 'settings' ? (
    <Settings />
// to:
{activeTab === 'settings' ? (
    <Settings themeMode={themeMode} setThemeMode={setThemeMode} />
```

- [ ] **Step 3: Add props interface to src/dashboard/Settings.tsx**

Add import at the top:
```tsx
import { ThemeMode } from '@/hooks/useTheme';
```

Replace the function signature:
```tsx
// from:
export function Settings() {
// to:
interface SettingsProps {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
}

export function Settings({ themeMode, setThemeMode }: SettingsProps) {
```

- [ ] **Step 4: Type-check**

Run: `npm run check`

Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/popup/App.tsx src/dashboard/App.tsx src/dashboard/Settings.tsx
git commit -m "feat(theme): wire useTheme into App roots and update Settings props interface"
```

---

### Task 5: Theme switcher UI + Settings dark styles

**Files:**
- Modify: `src/dashboard/Settings.tsx`

- [ ] **Step 1: Replace the entire Settings.tsx**

```tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Trash2, Database, Check, Sun, Moon, Monitor } from 'lucide-react';
import { ThemeMode } from '@/hooks/useTheme';

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

const THEME_OPTIONS: { mode: ThemeMode; label: string; Icon: React.ElementType }[] = [
  { mode: 'light', label: '日间', Icon: Sun },
  { mode: 'dark', label: '夜间', Icon: Moon },
  { mode: 'system', label: '跟随系统', Icon: Monitor },
];

interface SettingsProps {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
}

export function Settings({ themeMode, setThemeMode }: SettingsProps) {
  const [cacheSize, setCacheSize] = useState<string>('Calculating...');
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);

  const calculateCacheSize = useCallback(() => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.getBytesInUse(null, (bytes) => {
        setCacheSize(formatBytes(bytes));
      });
    } else {
      setCacheSize('Unknown');
    }
  }, []);

  useEffect(() => {
    calculateCacheSize();
  }, [calculateCacheSize]);

  const handleClearCache = () => {
    setClearing(true);
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(null, (items) => {
        const keysToRemove = Object.keys(items).filter(key => key.startsWith('preview_'));
        if (keysToRemove.length > 0) {
          chrome.storage.local.remove(keysToRemove, () => {
            setClearing(false);
            setCleared(true);
            calculateCacheSize();
            setTimeout(() => setCleared(false), 3000);
          });
        } else {
          setClearing(false);
          setCleared(true);
          setTimeout(() => setCleared(false), 3000);
        }
      });
    } else {
      setTimeout(() => {
        setClearing(false);
        setCleared(true);
        setTimeout(() => setCleared(false), 3000);
      }, 1000);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Appearance */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-50 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Sun className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            外观
          </h2>
          <p className="text-sm text-gray-500 mt-1">控制界面的明暗主题</p>
        </div>
        <div className="p-6">
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg w-fit">
            {THEME_OPTIONS.map(({ mode, label, Icon }) => (
              <button
                key={mode}
                onClick={() => setThemeMode(mode)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                  themeMode === mode
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
          {themeMode === 'system' && (
            <p className="mt-3 text-xs text-gray-400">当前跟随系统偏好</p>
          )}
        </div>
      </div>

      {/* Storage */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-50 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Database className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            存储设置
          </h2>
          <p className="text-sm text-gray-500 mt-1">管理本地存储和缓存数据</p>
        </div>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-600">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100">预览图缓存</h3>
              <p className="text-sm text-gray-500 mt-1">
                本地存储的标签页预览图。当前占用：<span className="font-semibold text-gray-700 dark:text-gray-300">{cacheSize}</span>
              </p>
            </div>
            <button
              onClick={handleClearCache}
              disabled={clearing}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                cleared
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:border-red-100 shadow-sm'
              }`}
            >
              {clearing ? (
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : cleared ? (
                <Check className="w-4 h-4" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              {clearing ? '清除中...' : cleared ? '已清除！' : '清除缓存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npm run check`

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/dashboard/Settings.tsx
git commit -m "feat(theme): add theme switcher segmented control and dark styles to Settings"
```

---

### Task 6: Dark mode styles — Popup App.tsx

**Files:**
- Modify: `src/popup/App.tsx`

Apply the following targeted class changes (find by context, keep all other attributes unchanged):

- [ ] **Step 1: Root div, header, dashboard button**

```tsx
// Root div — add dark bg/text:
// from: "w-[400px] h-[600px] bg-gray-50 flex flex-col font-sans text-gray-800"
// to:   "w-[400px] h-[600px] bg-gray-50 dark:bg-gray-900 flex flex-col font-sans text-gray-800 dark:text-gray-200"

// <header> — add dark bg:
// from: "bg-white shadow-sm px-6 py-4 flex justify-between items-center z-10"
// to:   "bg-white dark:bg-gray-800 shadow-sm px-6 py-4 flex justify-between items-center z-10"

// Dashboard icon button — add dark hover:
// from: "text-gray-500 hover:text-blue-600 transition-colors p-1 rounded-md hover:bg-gray-100"
// to:   "text-gray-500 dark:text-gray-400 hover:text-blue-600 transition-colors p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
```

- [ ] **Step 2: Status card and skeleton**

```tsx
// Status card — add dark bg/border:
// from: "bg-white rounded-xl shadow-sm p-6 flex flex-col items-center justify-center border border-gray-100 shrink-0"
// to:   "bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 flex flex-col items-center justify-center border border-gray-100 dark:border-gray-700 shrink-0"

// Skeleton divs (two instances) — add dark:
// from: "h-10 w-24 bg-gray-200 rounded mb-3"
// to:   "h-10 w-24 bg-gray-200 dark:bg-gray-600 rounded mb-3"
// from: "h-4 w-32 bg-gray-200 rounded"
// to:   "h-4 w-32 bg-gray-200 dark:bg-gray-600 rounded"

// Count number:
// from: "text-4xl font-bold text-gray-900 mb-1"
// to:   "text-4xl font-bold text-gray-900 dark:text-gray-100 mb-1"

// "Duplicate Tabs Found" label:
// from: "text-sm text-gray-500 mb-4"
// to:   "text-sm text-gray-500 dark:text-gray-400 mb-4"
```

- [ ] **Step 3: Stats grid**

```tsx
// Both stat cards:
// from: "bg-white p-4 rounded-xl shadow-sm border border-gray-100"
// to:   "bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700"

// Stat label ("Total Tabs", "Groups"):
// from: "text-sm text-gray-500 mb-1"
// to:   "text-sm text-gray-500 dark:text-gray-400 mb-1"

// Stat value:
// from: "text-xl font-bold text-gray-900"
// to:   "text-xl font-bold text-gray-900 dark:text-gray-100"
```

- [ ] **Step 4: Duplicate list**

```tsx
// Section heading:
// from: "text-sm font-semibold text-gray-700 mb-3 shrink-0"
// to:   "text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 shrink-0"

// Group card:
// from: "bg-white p-3 rounded-lg border border-gray-100 text-sm shadow-sm hover:shadow-md transition-shadow"
// to:   "bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-100 dark:border-gray-700 text-sm shadow-sm hover:shadow-md transition-shadow"

// Group title:
// from: "font-medium text-gray-800 truncate mb-1"
// to:   "font-medium text-gray-800 dark:text-gray-200 truncate mb-1"

// Duplicate count badge:
// from: "bg-red-50 text-red-600 px-2 py-0.5 rounded text-xs font-medium"
// to:   "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded text-xs font-medium"

// Tab row:
// from: "flex justify-between items-center text-xs p-1.5 rounded hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-colors group/item cursor-pointer"
// to:   "flex justify-between items-center text-xs p-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 border border-transparent hover:border-gray-100 dark:hover:border-gray-600 transition-colors group/item cursor-pointer"

// Tab active/inactive text (conditional class):
// from: `truncate ${tab.active ? 'text-blue-600 font-medium' : 'text-gray-500'}`
// to:   `truncate ${tab.active ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`
```

- [ ] **Step 5: Type-check and commit**

```bash
npm run check
git add src/popup/App.tsx
git commit -m "feat(theme): add dark mode styles to popup"
```

Expected from check: No errors

---

### Task 7: Dark mode styles — Dashboard App.tsx

**Files:**
- Modify: `src/dashboard/App.tsx`

- [ ] **Step 1: PreviewTooltip component**

```tsx
// Tooltip container:
// from: "fixed z-50 bg-white p-2 rounded-lg shadow-xl border border-gray-200 pointer-events-none transition-all duration-200 animate-in fade-in zoom-in-95"
// to:   "fixed z-50 bg-white dark:bg-gray-800 p-2 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 pointer-events-none transition-all duration-200 animate-in fade-in zoom-in-95"

// Loading state inside tooltip:
// from: "w-64 h-40 bg-gray-100 animate-pulse rounded flex items-center justify-center text-gray-400 text-sm"
// to:   "w-64 h-40 bg-gray-100 dark:bg-gray-700 animate-pulse rounded flex items-center justify-center text-gray-400 text-sm"

// Empty state inside tooltip:
// from: "w-64 h-32 bg-gray-50 rounded flex flex-col items-center justify-center text-gray-400 text-xs text-center p-4 border border-dashed border-gray-200"
// to:   "w-64 h-32 bg-gray-50 dark:bg-gray-700 rounded flex flex-col items-center justify-center text-gray-400 text-xs text-center p-4 border border-dashed border-gray-200 dark:border-gray-600"
```

- [ ] **Step 2: Main layout**

```tsx
// Root div:
// from: "min-h-screen bg-gray-50 text-gray-800 font-sans"
// to:   "min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-sans"

// Toast inner div:
// from: "bg-white border border-gray-100 shadow-lg rounded-xl px-4 py-2 text-sm text-gray-700 flex items-center gap-2"
// to:   "bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-lg rounded-xl px-4 py-2 text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2"

// Sidebar:
// from: "fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 flex flex-col z-20"
// to:   "fixed inset-y-0 left-0 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col z-20"

// Sidebar logo section border:
// from: "p-6 border-b border-gray-100"
// to:   "p-6 border-b border-gray-100 dark:border-gray-700"

// Nav button active state (inside className template literal):
// from: 'bg-blue-50 text-blue-700'
// to:   'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'

// Nav button inactive state:
// from: 'text-gray-600 hover:bg-gray-100'
// to:   'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'

// Nav count badge spans (three instances — tabs, archives, none for settings):
// from: "ml-auto bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs"
// to:   "ml-auto bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full text-xs"

// Page heading h2:
// from: "text-2xl font-bold text-gray-900"
// to:   "text-2xl font-bold text-gray-900 dark:text-gray-100"

// Search input:
// from: "pl-10 pr-10 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
// to:   "pl-10 pr-10 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"

// Search clear button:
// from: "absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
// to:   "absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
```

- [ ] **Step 3: Current Tabs section**

```tsx
// Domain group card:
// from: className includes "bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6 break-inside-avoid"
// to: add "dark:bg-gray-800 dark:border-gray-700"

// Domain group header bar:
// from: "p-4 border-b border-gray-50 bg-gray-50 flex justify-between items-center"
// to:   "p-4 border-b border-gray-50 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex justify-between items-center"

// Domain name h3:
// from: "font-semibold text-gray-800 truncate"
// to:   "font-semibold text-gray-800 dark:text-gray-200 truncate"

// Tab count badge (small span in domain header):
// from: "text-xs font-medium text-gray-500 bg-white px-2 py-0.5 rounded border border-gray-100"
// to:   "text-xs font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-700 px-2 py-0.5 rounded border border-gray-100 dark:border-gray-600"

// Tab row:
// from: className includes "p-2 hover:bg-gray-50 rounded group flex..."
// to: add "dark:hover:bg-gray-700/50" after "hover:bg-gray-50"

// Tab title div:
// from: "text-gray-600 hover:text-blue-600 truncate cursor-pointer transition-colors"
// to:   "text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 truncate cursor-pointer transition-colors"
```

- [ ] **Step 4: Archives section**

```tsx
// Section headings (two: "Archived Domains", "Archived Tabs"):
// from: "text-sm font-semibold text-gray-700"
// to:   "text-sm font-semibold text-gray-700 dark:text-gray-300"

// Archive card:
// from: className includes "bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col h-full"
// to: add "dark:bg-gray-800 dark:border-gray-700"

// Archive name h3:
// from: "font-bold text-gray-800 text-lg mb-1"
// to:   "font-bold text-gray-800 dark:text-gray-200 text-lg mb-1"

// Restore button:
// from: "p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
// to:   "p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"

// Delete button:
// from: "p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
// to:   "p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"

// Tabs count row:
// from: "text-sm text-gray-600 mb-3 flex items-center gap-2"
// to:   "text-sm text-gray-600 dark:text-gray-400 mb-3 flex items-center gap-2"

// Domain tag spans:
// from: "text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded inline-flex items-center gap-1.5"
// to:   "text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-1 rounded inline-flex items-center gap-1.5"

// Deleting overlay background:
// from: "absolute inset-0 bg-white/40"
// to:   "absolute inset-0 bg-white/40 dark:bg-gray-800/40"

// Deleting badge:
// from: "absolute top-3 right-3 flex items-center gap-2 rounded-full bg-white/80 px-2.5 py-1 text-xs text-gray-600 shadow-sm border border-gray-100"
// to:   add "dark:bg-gray-800/80 dark:text-gray-400 dark:border-gray-700"

// Archived tab card:
// from: className includes "bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col"
// to: add "dark:bg-gray-800 dark:border-gray-700"

// Archived tab title p:
// from: "font-semibold text-gray-800 text-sm truncate"
// to:   "font-semibold text-gray-800 dark:text-gray-200 text-sm truncate"
```

- [ ] **Step 5: Archive modal**

```tsx
// Modal inner box:
// from: "bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200"
// to:   "bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200"

// Modal title h3:
// from: "text-xl font-bold text-gray-900"
// to:   "text-xl font-bold text-gray-900 dark:text-gray-100"

// Modal close button:
// from: "text-gray-400 hover:text-gray-600"
// to:   "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"

// Session Name label:
// from: "block text-sm font-medium text-gray-700 mb-2"
// to:   "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"

// Archive name input:
// from: "w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
// to:   "w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"

// Tabs count note p:
// from: "mt-2 text-sm text-gray-500"
// to:   "mt-2 text-sm text-gray-500 dark:text-gray-400"

// Cancel button:
// from: "px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
// to:   "px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium"
```

- [ ] **Step 6: Type-check and commit**

```bash
npm run check
git add src/dashboard/App.tsx
git commit -m "feat(theme): add dark mode styles to dashboard"
```

Expected from check: No errors

---

### Task 8: Dark mode styles — DomainPreviewModal.tsx

**Files:**
- Modify: `src/components/DomainPreviewModal.tsx`

- [ ] **Step 1: PreviewCard component**

```tsx
// Card wrapper:
// from: className includes "bg-white rounded-lg border border-gray-100 overflow-hidden shadow-sm hover:shadow-md"
// to: add "dark:bg-gray-800 dark:border-gray-700"

// Thumbnail area:
// from: "relative aspect-video w-full bg-gray-50"
// to:   "relative aspect-video w-full bg-gray-50 dark:bg-gray-700"

// Loading pulse:
// from: "absolute inset-0 bg-gray-100 animate-pulse"
// to:   "absolute inset-0 bg-gray-100 dark:bg-gray-700 animate-pulse"

// No-preview placeholder:
// from: "absolute inset-0 flex flex-col items-center justify-center text-gray-300 border-b border-gray-100"
// to:   "absolute inset-0 flex flex-col items-center justify-center text-gray-300 dark:text-gray-600 border-b border-gray-100 dark:border-gray-700"

// Tab title in card:
// from: "text-sm font-medium text-gray-800 line-clamp-2 leading-snug"
// to:   "text-sm font-medium text-gray-800 dark:text-gray-200 line-clamp-2 leading-snug"
```

- [ ] **Step 2: Modal container and header**

```tsx
// Modal inner box:
// from: "bg-white rounded-xl shadow-2xl w-[80vw] max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
// to:   "bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-[80vw] max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"

// Header border:
// from: "flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0"
// to:   "flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 shrink-0"

// Domain title h2:
// from: "text-lg font-bold text-gray-900"
// to:   "text-lg font-bold text-gray-900 dark:text-gray-100"

// Tab count badge:
// from: "text-sm text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full"
// to:   "text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2.5 py-0.5 rounded-full"

// Close button:
// from: "p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
// to:   "p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
```

- [ ] **Step 3: Search bar and input**

```tsx
// Search bar border row:
// from: "px-6 py-3 border-b border-gray-50 shrink-0"
// to:   "px-6 py-3 border-b border-gray-50 dark:border-gray-700 shrink-0"

// Search input:
// from: "w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
// to:   "w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
```

- [ ] **Step 4: Type-check and commit**

```bash
npm run check
git add src/components/DomainPreviewModal.tsx
git commit -m "feat(theme): add dark mode styles to DomainPreviewModal"
```

Expected from check: No errors
