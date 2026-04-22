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

# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
