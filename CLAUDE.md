# Duplicate Tabs Killer

Chrome 浏览器扩展，用于自动检测并关闭重复标签页，支持标签分组和归档。

## Tech Stack

- **Framework**: React 18 + TypeScript
- **Build**: Vite + @crxjs/vite-plugin (Chrome Extension MV3)
- **Styling**: Tailwind CSS 3 + clsx + tailwind-merge
- **State**: Zustand 5
- **Routing**: React Router v7
- **UI Components**: Headless UI + Heroicons + Lucide React
- **Linting**: ESLint 9 (flat config) + typescript-eslint

## Project Structure

```
src/
├── background/       # Chrome extension service worker
├── popup/            # Extension popup entry
├── dashboard/        # Extension options page entry
├── pages/            # Page-level components
├── components/       # Shared UI components
├── hooks/            # Custom React hooks (useTabs, useTheme, etc.)
├── utils/            # Utility functions (tabs, storage, grouping)
├── lib/              # General utilities (cn helper, etc.)
├── assets/           # Static assets
├── manifest.json     # Chrome Extension MV3 manifest
├── App.tsx           # Main app with React Router
└── main.tsx          # App entry point
```

## Commands

- `npm run dev` — Start dev server with HMR (loads as unpacked extension)
- `npm run build` — Type-check (tsc) then build for production
- `npm run check` — TypeScript type-check only (no emit)
- `npm run lint` — Run ESLint
- `npm run preview` — Preview production build

## Code Conventions

- Use `@/` path alias for imports from `src/` (e.g., `import X from "@/hooks/useTabs"`)
- Use functional components with hooks, no class components
- Use TypeScript for all source files (.ts/.tsx)
- Styling: prefer Tailwind utility classes; use `cn()` from `@/lib/utils` for conditional class merging
- State management: use Zustand stores; keep stores focused and small
- Chrome APIs: always check `chrome` object availability; handle async Chrome API calls properly
- Component files: PascalCase (e.g., `Empty.tsx`); hooks: camelCase with `use` prefix; utils: camelCase
- Keep components small and focused; extract reusable logic into hooks

## Chrome Extension Notes

- This is a Manifest V3 extension
- Service worker in `src/background/` — no DOM access, use Chrome APIs only
- Popup UI in `src/popup/` — lightweight, quick interactions
- Dashboard/Options in `src/dashboard/` — full-page settings UI
- Use `chrome.storage` for persistence, not localStorage
- Permissions are declared in `src/manifest.json`

## Language

- Code: English (variable names, comments, commit messages)
- UI text: 中文 (Chinese) for user-facing strings
- Communication with developer: 中文
