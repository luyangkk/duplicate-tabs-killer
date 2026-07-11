# Open-Source Project Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the community + automation layer (CI, contributing docs, GitHub templates, governance, CHANGELOG, README badges) to bring the repo to standard open-source quality, and bump the release to 1.2.0.

**Architecture:** Pure additive config/docs work. No `src/` changes. A GitHub Actions workflow codifies the existing npm scripts (`lint` / `check` / `test` / `build`) as a PR quality gate; standard community Markdown files and GitHub templates are added; `package.json` is bumped 1.1.0 → 1.2.0 and a `CHANGELOG.md` is introduced.

**Tech Stack:** GitHub Actions, YAML issue/PR forms, Contributor Covenant v2.1, Keep a Changelog, Node 22.

## Global Constraints

- Owner/Repo: `luyangkk/duplicate-tabs-killer` (hyphenated form everywhere).
- Contact email (Code of Conduct / Security): `luyangkk@gmail.com`.
- GitHub username (CODEOWNERS): `@luyangkk`.
- Node version: `22` (single version, no CI matrix); `.nvmrc` is the single source of truth.
- Release version for this work: `1.2.0` (bump `package.json` from 1.1.0).
- Docs language: English. Formatter: ESLint only — NO Prettier.
- Do NOT modify any file under `src/`. The only `package.json` edit is the version bump.
- Use `npm ci` in CI (honor `package-lock.json`).
- Commit style: Conventional Commits (`feat:`, `docs:`, `chore:`, `ci:`).

---

### Task 1: Editor & Node conventions

**Files:**
- Create: `.nvmrc`
- Create: `.editorconfig`

**Interfaces:**
- Consumes: nothing.
- Produces: `.nvmrc` containing `22` — consumed by Task 2's CI workflow via `node-version-file: .nvmrc`.

- [ ] **Step 1: Create `.nvmrc`**

File `.nvmrc` (single line, no trailing blank line beyond the newline):

```
22
```

- [ ] **Step 2: Create `.editorconfig`**

File `.editorconfig`:

```ini
# EditorConfig — https://editorconfig.org
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
indent_style = space
indent_size = 2

[*.md]
trim_trailing_whitespace = false
```

- [ ] **Step 3: Verify contents**

Run: `cat .nvmrc && echo "---" && cat .editorconfig`
Expected: `.nvmrc` prints `22`; `.editorconfig` prints the config above.

- [ ] **Step 4: Verify build still green (sanity, no source touched)**

Run: `npm run lint && npm run check`
Expected: both exit 0 (unchanged from baseline).

- [ ] **Step 5: Commit**

```bash
git add .nvmrc .editorconfig
git commit -m "chore: add .nvmrc (node 22) and .editorconfig"
```

---

### Task 2: CI quality gate

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `.nvmrc` (Task 1) for the Node version; existing npm scripts `lint`, `check`, `test`, `build`.
- Produces: a workflow named `CI` with a job `quality` — the badge in Task 8 references this workflow file (`ci.yml`).

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

File `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type-check
        run: npm run check

      - name: Test
        run: npm run test

      - name: Build
        run: npm run build
```

- [ ] **Step 2: Validate the YAML parses**

Run: `node -e "const fs=require('fs');const s=fs.readFileSync('.github/workflows/ci.yml','utf8');if(!/name:\s*CI/.test(s)||!/npm run build/.test(s)){process.exit(1)}console.log('ci.yml shape OK')"`
Expected: prints `ci.yml shape OK`.

- [ ] **Step 3: Confirm the referenced scripts exist**

Run: `node -e "const p=require('./package.json');['lint','check','test','build'].forEach(k=>{if(!p.scripts[k]){throw new Error('missing '+k)}});console.log('scripts OK')"`
Expected: prints `scripts OK`.

- [ ] **Step 4: Locally reproduce the gate**

Run: `npm run lint && npm run check && npm run test && npm run build`
Expected: all four succeed (exit 0). This is exactly what CI will run.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions quality gate (lint, check, test, build)"
```

---

### Task 3: Contributing guide

**Files:**
- Create: `CONTRIBUTING.md`

**Interfaces:**
- Consumes: nothing.
- Produces: `CONTRIBUTING.md` — linked from README badges area is not required, but PR template (Task 6) references its checklist expectations.

- [ ] **Step 1: Create `CONTRIBUTING.md`**

File `CONTRIBUTING.md`:

```markdown
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
```

- [ ] **Step 2: Placeholder scan**

Run: `grep -nE "TBD|TODO|FIXME|INSERT_" CONTRIBUTING.md || echo "OK: no placeholders"`
Expected: prints `OK: no placeholders`.

- [ ] **Step 3: Commit**

```bash
git add CONTRIBUTING.md
git commit -m "docs: add CONTRIBUTING guide"
```

---

### Task 4: Code of Conduct & Security policy

**Files:**
- Create: `CODE_OF_CONDUCT.md`
- Create: `SECURITY.md`

**Interfaces:**
- Consumes: contact email `luyangkk@gmail.com`.
- Produces: `SECURITY.md` — referenced by `CONTRIBUTING.md` (Task 3) and issue template `config.yml` (Task 5).

- [ ] **Step 1: Create `CODE_OF_CONDUCT.md`**

File `CODE_OF_CONDUCT.md` (Contributor Covenant v2.1, abridged standard text with the contact filled in):

```markdown
# Contributor Covenant Code of Conduct

## Our Pledge

We as members, contributors, and leaders pledge to make participation in our
community a harassment-free experience for everyone, regardless of age, body
size, visible or invisible disability, ethnicity, sex characteristics, gender
identity and expression, level of experience, education, socio-economic status,
nationality, personal appearance, race, religion, or sexual identity and
orientation.

We pledge to act and interact in ways that contribute to an open, welcoming,
diverse, inclusive, and healthy community.

## Our Standards

Examples of behavior that contributes to a positive environment include:

- Demonstrating empathy and kindness toward other people
- Being respectful of differing opinions, viewpoints, and experiences
- Giving and gracefully accepting constructive feedback
- Accepting responsibility and apologizing to those affected by our mistakes
- Focusing on what is best for the overall community

Examples of unacceptable behavior include:

- The use of sexualized language or imagery, and sexual attention or advances
- Trolling, insulting or derogatory comments, and personal or political attacks
- Public or private harassment
- Publishing others' private information without explicit permission
- Other conduct which could reasonably be considered inappropriate in a
  professional setting

## Enforcement Responsibilities

Community leaders are responsible for clarifying and enforcing our standards of
acceptable behavior and will take appropriate and fair corrective action in
response to any behavior that they deem inappropriate, threatening, offensive,
or harmful.

## Scope

This Code of Conduct applies within all community spaces, and also applies when
an individual is officially representing the community in public spaces.

## Enforcement

Instances of abusive, harassing, or otherwise unacceptable behavior may be
reported to the community leaders responsible for enforcement at
**luyangkk@gmail.com**. All complaints will be reviewed and investigated
promptly and fairly.

## Attribution

This Code of Conduct is adapted from the [Contributor Covenant][homepage],
version 2.1, available at
https://www.contributor-covenant.org/version/2/1/code_of_conduct.html.

[homepage]: https://www.contributor-covenant.org
```

- [ ] **Step 2: Create `SECURITY.md`**

File `SECURITY.md`:

```markdown
# Security Policy

## Supported versions

The latest released version receives security updates.

| Version | Supported          |
|---------|--------------------|
| 1.2.x   | :white_check_mark: |
| < 1.2   | :x:                |

## Reporting a vulnerability

Please **do not** open a public issue for security vulnerabilities.

Report privately via one of:

- GitHub Security Advisories ("Report a vulnerability" on the Security tab)
- Email: **luyangkk@gmail.com**

Please include reproduction steps and affected version. We aim to acknowledge
reports within 5 business days and to provide a remediation timeline after
triage.

## Scope note

Duplicate Tabs Killer runs entirely on your machine: no server, no account, and
no external API calls. All data (archived sessions, screenshot previews) is
stored locally via `chrome.storage.local`. This narrows the attack surface to
the extension bundle and the Chrome APIs it uses.
```

- [ ] **Step 3: Placeholder & email scan**

Run: `grep -nE "TBD|TODO|FIXME|INSERT_" CODE_OF_CONDUCT.md SECURITY.md || echo "OK: no placeholders" ; grep -c "luyangkk@gmail.com" CODE_OF_CONDUCT.md SECURITY.md`
Expected: `OK: no placeholders`; email count `1` in each file.

- [ ] **Step 4: Commit**

```bash
git add CODE_OF_CONDUCT.md SECURITY.md
git commit -m "docs: add Code of Conduct and Security policy"
```

---

### Task 5: Issue templates

**Files:**
- Create: `.github/ISSUE_TEMPLATE/bug_report.yml`
- Create: `.github/ISSUE_TEMPLATE/feature_request.yml`
- Create: `.github/ISSUE_TEMPLATE/config.yml`

**Interfaces:**
- Consumes: `SECURITY.md` (Task 4) — referenced from `config.yml` contact links.
- Produces: nothing consumed downstream.

- [ ] **Step 1: Create `.github/ISSUE_TEMPLATE/bug_report.yml`**

File `.github/ISSUE_TEMPLATE/bug_report.yml`:

```yaml
name: Bug report
description: Report a problem with the extension
labels: [bug]
body:
  - type: textarea
    id: what-happened
    attributes:
      label: What happened?
      description: A clear description of the bug and the actual behavior.
    validations:
      required: true
  - type: textarea
    id: steps
    attributes:
      label: Steps to reproduce
      placeholder: |
        1. Open the popup
        2. Click "Close All Duplicates"
        3. ...
    validations:
      required: true
  - type: textarea
    id: expected
    attributes:
      label: Expected behavior
    validations:
      required: true
  - type: input
    id: chrome-version
    attributes:
      label: Chrome version
      placeholder: e.g. 126.0.6478.127
    validations:
      required: true
  - type: input
    id: ext-version
    attributes:
      label: Extension version
      placeholder: e.g. 1.2.0
    validations:
      required: true
  - type: textarea
    id: screenshots
    attributes:
      label: Screenshots or console logs
      description: Optional, but very helpful.
    validations:
      required: false
```

- [ ] **Step 2: Create `.github/ISSUE_TEMPLATE/feature_request.yml`**

File `.github/ISSUE_TEMPLATE/feature_request.yml`:

```yaml
name: Feature request
description: Suggest an idea for the extension
labels: [enhancement]
body:
  - type: textarea
    id: problem
    attributes:
      label: What problem does this solve?
      description: Describe the use case or pain point.
    validations:
      required: true
  - type: textarea
    id: solution
    attributes:
      label: Proposed solution
    validations:
      required: true
  - type: textarea
    id: alternatives
    attributes:
      label: Alternatives considered
    validations:
      required: false
```

- [ ] **Step 3: Create `.github/ISSUE_TEMPLATE/config.yml`**

File `.github/ISSUE_TEMPLATE/config.yml`:

```yaml
blank_issues_enabled: false
contact_links:
  - name: Security vulnerability
    url: https://github.com/luyangkk/duplicate-tabs-killer/security/advisories/new
    about: Please report security issues privately, not as a public issue.
```

- [ ] **Step 4: Validate the three YAML files parse**

Run: `for f in .github/ISSUE_TEMPLATE/bug_report.yml .github/ISSUE_TEMPLATE/feature_request.yml .github/ISSUE_TEMPLATE/config.yml; do node -e "require('fs').readFileSync('$f','utf8')" && echo "$f readable"; done`
Expected: each file prints `<path> readable`.

- [ ] **Step 5: Commit**

```bash
git add .github/ISSUE_TEMPLATE/
git commit -m "chore: add GitHub issue templates"
```

---

### Task 6: PR template & repo governance

**Files:**
- Create: `.github/PULL_REQUEST_TEMPLATE.md`
- Create: `.github/CODEOWNERS`
- Create: `.github/dependabot.yml`

**Interfaces:**
- Consumes: GitHub username `@luyangkk` (CODEOWNERS); the four CI checks from Task 2 (referenced in the PR checklist).
- Produces: nothing consumed downstream.

- [ ] **Step 1: Create `.github/PULL_REQUEST_TEMPLATE.md`**

File `.github/PULL_REQUEST_TEMPLATE.md`:

```markdown
## Summary

<!-- What does this change do and why? -->

## Related issue

<!-- e.g. Closes #123 -->

## Checklist

- [ ] `npm run lint` passes
- [ ] `npm run check` passes
- [ ] `npm run test` passes
- [ ] `npm run build` passes
- [ ] Updated `CHANGELOG.md` under `[Unreleased]` (for user-facing changes)
- [ ] Added screenshots for UI changes
```

- [ ] **Step 2: Create `.github/CODEOWNERS`**

File `.github/CODEOWNERS`:

```
# Default owner for everything in this repo
*       @luyangkk
```

- [ ] **Step 3: Create `.github/dependabot.yml`**

File `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    open-pull-requests-limit: 5
    groups:
      minor-and-patch:
        update-types:
          - minor
          - patch
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
```

- [ ] **Step 4: Validate & scan**

Run: `node -e "require('fs').readFileSync('.github/dependabot.yml','utf8')" && grep -q "@luyangkk" .github/CODEOWNERS && grep -q "npm run build" .github/PULL_REQUEST_TEMPLATE.md && echo "governance files OK"`
Expected: prints `governance files OK`.

- [ ] **Step 5: Commit**

```bash
git add .github/PULL_REQUEST_TEMPLATE.md .github/CODEOWNERS .github/dependabot.yml
git commit -m "chore: add PR template, CODEOWNERS, and Dependabot config"
```

---

### Task 7: CHANGELOG & version bump to 1.2.0

**Files:**
- Create: `CHANGELOG.md`
- Modify: `package.json:5` (version `1.1.0` → `1.2.0`)

**Interfaces:**
- Consumes: repo path `luyangkk/duplicate-tabs-killer` for compare links.
- Produces: `CHANGELOG.md` with a `[1.2.0]` entry — referenced by the README release badge (Task 8) and the PR template (Task 6).

- [ ] **Step 1: Bump `package.json` version**

In `package.json`, change line 5 from:

```json
  "version": "1.1.0",
```

to:

```json
  "version": "1.2.0",
```

- [ ] **Step 2: Verify the bump**

Run: `node -p "require('./package.json').version"`
Expected: prints `1.2.0`.

- [ ] **Step 3: Create `CHANGELOG.md`**

File `CHANGELOG.md`:

```markdown
# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.0] - 2026-07-11

### Added

- Popup now shows the archived-tabs count and links to the Dashboard archives view.
- Dashboard supports opening a specific view via URL hash and syncs on `hashchange`.
- Project hardening: GitHub Actions CI (lint, type-check, test, build),
  `CONTRIBUTING`, `CODE_OF_CONDUCT`, `SECURITY`, issue/PR templates, `CODEOWNERS`,
  Dependabot, `.editorconfig`, `.nvmrc`, and this changelog.
- README badges (license, CI status, release).

## [1.1.0]

### Added

- Earlier release. See git history for details.

## [1.0.0]

### Added

- Initial release: duplicate detection, domain grouping, screenshot previews,
  and session archive/restore.

[Unreleased]: https://github.com/luyangkk/duplicate-tabs-killer/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/luyangkk/duplicate-tabs-killer/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/luyangkk/duplicate-tabs-killer/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/luyangkk/duplicate-tabs-killer/releases/tag/v1.0.0
```

- [ ] **Step 4: Placeholder scan & build sanity**

Run: `grep -nE "TBD|TODO|FIXME|INSERT_" CHANGELOG.md || echo "OK: no placeholders" ; npm run check`
Expected: `OK: no placeholders`; `npm run check` exits 0.

- [ ] **Step 5: Commit**

```bash
git add CHANGELOG.md package.json
git commit -m "chore: add CHANGELOG and bump version to 1.2.0"
```

---

### Task 8: README badges

**Files:**
- Modify: `README.md:1-4` (insert a badge row after the title, before the tagline)

**Interfaces:**
- Consumes: CI workflow file name `ci.yml` (Task 2); repo path `luyangkk/duplicate-tabs-killer`.
- Produces: nothing consumed downstream.

- [ ] **Step 1: Insert the badge row**

The README currently starts:

```markdown
# Duplicate Tabs Killer

**Kill duplicates. Archive sessions. Stay organized.**
```

Change it to (add one badge line + a blank line, immediately under the `# Duplicate Tabs Killer` heading):

```markdown
# Duplicate Tabs Killer

[![CI](https://github.com/luyangkk/duplicate-tabs-killer/actions/workflows/ci.yml/badge.svg)](https://github.com/luyangkk/duplicate-tabs-killer/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/luyangkk/duplicate-tabs-killer)](https://github.com/luyangkk/duplicate-tabs-killer/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Kill duplicates. Archive sessions. Stay organized.**
```

Use the Edit tool: match the exact three lines (`# Duplicate Tabs Killer`, blank, `**Kill duplicates. Archive sessions. Stay organized.**`) and replace with the block above. Do NOT touch any other part of the README.

- [ ] **Step 2: Verify badges present and body unchanged**

Run: `head -8 README.md ; echo "---" ; grep -c "badge" README.md`
Expected: the three badge lines appear under the title; `grep -c "badge"` returns `2` (CI badge.svg + shields badge; the release/license shields also match "badge" — accept any count ≥ 2, the key check is the head output shows all three badges).

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add CI, release, and license badges to README"
```

---

## Self-Review

**Spec coverage** (each spec §4 deliverable → task):
- §4.1 CI workflow → Task 2 ✅
- §4.2 CONTRIBUTING / CODE_OF_CONDUCT / SECURITY → Tasks 3, 4 ✅
- §4.3 Issue templates + PR template → Tasks 5, 6 ✅
- §4.4 CODEOWNERS + dependabot → Task 6 ✅
- §4.5 .editorconfig + .nvmrc → Task 1 ✅
- §4.6 CHANGELOG + version bump 1.1.0→1.2.0 → Task 7 ✅
- §4.7 README badges → Task 8 ✅

**Placeholder scan:** no `TBD`/`TODO`/`FIXME`/`INSERT_` in any file content (the only `INSERT_` occurrences are inside `grep` verification commands that check for their absence).

**Type/name consistency:** repo path `luyangkk/duplicate-tabs-killer` (hyphenated), email `luyangkk@gmail.com`, username `@luyangkk`, Node `22`, version `1.2.0`, CI workflow `ci.yml`, workflow name `CI` — used consistently across Tasks 2, 4, 5, 6, 7, 8.

**Dependency order:** Task 1 (.nvmrc) precedes Task 2 (CI consumes it); Task 4 (SECURITY.md) precedes Task 5 (config.yml links it); Task 2 (ci.yml) precedes Task 8 (badge references it). Order is safe.

