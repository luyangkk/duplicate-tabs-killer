# Open-Source Project Hardening — Design

**Date:** 2026-07-11
**Status:** Approved (design), pending implementation plan
**Owner:** luyangkk

## 1. Background & Goal

`duplicate-tabs-killer` is already a solid Chrome extension repo: it ships an
English README, an MIT `LICENSE`, product/architecture docs under `docs/`,
ESLint config, Vitest tests, and a complete `.gitignore`. What it lacks is the
**community collaboration layer** and the **automation layer** that distinguish
a standard, well-run open-source project.

The goal of this work is to add those missing pieces so the repository meets
common "excellent open-source project" expectations — without touching any
`src/` source code and without changing the existing build toolchain.

## 2. Scope Decisions (locked with user)

| Dimension        | Decision                                                            |
|------------------|---------------------------------------------------------------------|
| Completeness     | **Full community grade** (community files + CI quality gate)         |
| Hosting platform | **GitHub** (Actions CI, GitHub-style Issue/PR templates)             |
| Doc language     | **English** (consistent with existing README)                        |
| Formatter        | **No Prettier** — keep ESLint only, avoid a large formatting diff    |
| Release          | **Manual** — keep existing `npm run zip` workflow; no release automation in this iteration |
| Node version     | **22** (single version, no CI matrix)                                |

### Repository facts
- Owner/Repo: `luyangkk/duplicate-tabs-killer`
- Latest published release: `v1.1.0`
- Version to release with this work: `1.2.0` (bump `package.json` from 1.1.0)
- Contact email (Code of Conduct / Security): `luyangkk@gmail.com`
- GitHub username (CODEOWNERS): `@luyangkk`

### Explicit non-goals
- No changes to any file under `src/`.
- No changes to build config (`vite.config.ts`, `tsconfig.json`, etc.). The only
  edit to `package.json` is the version bump 1.1.0 → 1.2.0.
- No Prettier / `.prettierrc`.
- No release automation workflow (deferred to a future iteration).
- README body stays unchanged; only a badge row is **added** at the top.

## 3. Deliverables

| Category      | Files                                                                                     |
|---------------|-------------------------------------------------------------------------------------------|
| CI            | `.github/workflows/ci.yml`                                                                 |
| Community docs| `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`                                      |
| Templates     | `.github/ISSUE_TEMPLATE/bug_report.yml`, `feature_request.yml`, `config.yml`, `.github/PULL_REQUEST_TEMPLATE.md` |
| Governance    | `.github/CODEOWNERS`, `.github/dependabot.yml`                                             |
| Conventions   | `.editorconfig`, `.nvmrc`                                                                   |
| Versioning    | `CHANGELOG.md`, `package.json` version bump 1.1.0 → 1.2.0                  |
| README        | Badge row added at the top                                                                  |

## 4. Detailed Design

### 4.1 CI quality gate — `.github/workflows/ci.yml`

**Triggers**
- `push` to `main`
- all `pull_request`

**Job** (single job, sequential steps, fail-fast)
```
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - actions/checkout@v4
      - actions/setup-node@v4   # node-version-file: .nvmrc, cache: npm
      - npm ci
      - npm run lint            # ESLint
      - npm run check           # tsc type-check (--noEmit)
      - npm run test            # vitest run
      - npm run build           # verify production build succeeds
```

**Key decisions**
- Single Node version (**22**) — this is an extension build toolchain, not a
  multi-runtime library; a matrix would waste CI minutes.
- `npm ci` (not `npm install`) to honor `package-lock.json` for reproducibility.
- `.nvmrc` is the single source of truth for the Node version, shared by CI and
  local dev via `node-version-file`.

### 4.2 Community documents (English)

- **`CONTRIBUTING.md`** — dev environment (Node 22 via `.nvmrc`, `npm ci`),
  local command table (`dev` / `check` / `lint` / `test` / `build` / `zip`),
  how to load the unpacked extension for debugging (mirrors README), code
  conventions summary (from `CLAUDE.md`: `@/` alias, function components,
  code-English / UI-Chinese, Conventional Commits), and the PR flow
  (pass `lint` + `check` + `test` before opening a PR).
- **`CODE_OF_CONDUCT.md`** — Contributor Covenant v2.1, contact
  `luyangkk@gmail.com`.
- **`SECURITY.md`** — supported versions, private reporting channel (GitHub
  Security Advisories + `luyangkk@gmail.com`), response expectations, plus a
  note that the extension is fully local: no server, no account, no external
  API calls (echoing the README).

### 4.3 GitHub templates

- **Issue templates** (YAML forms format):
  - `bug_report.yml` — reproduction steps, expected/actual behavior, Chrome
    version, extension version, screenshots.
  - `feature_request.yml` — problem context, proposed solution, alternatives.
  - `config.yml` — `blank_issues_enabled: false`.
- **`PULL_REQUEST_TEMPLATE.md`** — change description, linked issue, self-check
  list (passed lint/check/test, updated CHANGELOG, screenshots for UI changes).

### 4.4 Governance

- **`.github/CODEOWNERS`** — default owner for the whole repo is `@luyangkk`.
- **`.github/dependabot.yml`** — weekly updates for two ecosystems: `npm` (root
  `package.json`) and `github-actions` (workflow deps); group minor/patch
  updates to reduce PR noise.

### 4.5 Conventions

- **`.editorconfig`** — 2-space indent, LF line endings, UTF-8, insert final
  newline, trim trailing whitespace; matches existing code style (no source
  changes).
- **`.nvmrc`** — content `22`.

### 4.6 CHANGELOG — `CHANGELOG.md`

- Format: **Keep a Changelog** + **Semantic Versioning**.
- Top `[Unreleased]` section for future accumulation.
- `package.json` version bumped from `1.1.0` to **`1.2.0`**; this work ships as
  the `1.2.0` release.
- Backfilled release history, derived from git history (concise, no fabricated
  detail):
  - `[1.2.0]` — this release, two parts:
    1. Popup archived-tabs count display + Dashboard hash-route navigation, and
       related recent work (commits since 1.1.0).
    2. Open-source hardening: CI, community docs, templates, governance,
       CHANGELOG, README badges.
  - `[1.1.0]` — previous published release (entries kept concise; derived from
    git history at implementation time).
  - `[1.0.0]` — initial release: duplicate detection, domain grouping,
    screenshot previews, session archive/restore.
- Version compare links at the bottom pointing to GitHub compare URLs under
  `luyangkk/duplicate-tabs-killer`.

### 4.7 README badges

Add a single badge row directly under the title:
- **License** — MIT (links to `LICENSE`)
- **CI** — GitHub Actions `ci` workflow status
- **Release** — latest release version

Badge URLs use the `luyangkk/duplicate-tabs-killer` path. The rest of the README
is unchanged.

## 5. Testing / Verification

- `npm run lint`, `npm run check`, `npm run test`, `npm run build` all pass
  locally after changes (they must, since no source is touched).
- `.github/workflows/ci.yml` is validated as syntactically correct YAML.
- Issue/PR template YAML validated against GitHub form schema shape.
- Manual read-through of each Markdown file for placeholder scan (no leftover
  `INSERT_*` tokens) and correct repo/email substitution.

## 6. Risks & Mitigations

- **CI runs before source is confirmed green:** existing scripts already pass
  locally; CI simply codifies them. Low risk.
- **CHANGELOG accuracy:** entries are derived from real git history; uncertain
  granularity is written as concise summary rather than invented specifics.
- **Badge/CI status shows "no runs" until first push:** expected; resolves after
  the workflow's first execution on `main`.
