# Contributing to Duplicate Tabs Killer

Thanks for your interest in improving Duplicate Tabs Killer! This document
explains how to set up the project, the conventions we follow, and how to get a
change merged.

## Development setup

This project targets **Node 22** (see `.nvmrc`).

```bash
nvm use            # or install Node 22 manually
npm ci             # install exact locked dependencies
npm run dev        # start Vite dev server with HMR (loads as unpacked extension)
```

### Loading the unpacked extension

1. Run `npm run dev` (or `npm run build` for a production bundle).
2. Open `chrome://extensions`.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the `dist/` folder.

## Available commands

| Command          | What it does                                  |
|------------------|-----------------------------------------------|
| `npm run dev`    | Dev server with HMR (CRXJS)                   |
| `npm run check`  | TypeScript type-check only (no emit)          |
| `npm run lint`   | Run ESLint                                     |
| `npm run test`   | Run Vitest                                     |
| `npm run build`  | Type-check then production build              |
| `npm run zip`    | Build and package a versioned `.zip`          |

## Code conventions

- Use the `@/` path alias for imports from `src/` (e.g. `import X from "@/hooks/useTabs"`).
- Functional components with hooks only — no class components.
- TypeScript for all source files (`.ts` / `.tsx`).
- Styling: Tailwind utility classes; use `cn()` from `@/lib/utils` for conditional merging.
- State: Zustand stores, kept small and focused.
- Chrome APIs: check `chrome` availability and handle async calls properly.
- **Code, comments, and commit messages are in English.** User-facing UI strings are in Chinese.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`, `ci:`).

## Before you open a pull request

Make sure the same checks CI runs pass locally:

```bash
npm run lint
npm run check
npm run test
npm run build
```

Then:

1. Keep changes focused — one logical change per PR.
2. Update `CHANGELOG.md` under `[Unreleased]` if your change is user-facing.
3. Include screenshots for any UI change.
4. Fill in the pull request template.

## Reporting bugs and requesting features

Use the issue templates (Bug report / Feature request). For security issues, do
**not** open a public issue — see [SECURITY.md](SECURITY.md).
