# Popup 归档标签数量展示与跳转 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 popup 统计网格中新增一张"Archived"卡片显示已归档标签数量，点击后跳转到 dashboard 的 Archives 视图。

**Architecture:** 用 URL hash 作为 popup → dashboard 的视图传参载体。popup 发送带 `view: 'archives'` 的 `OPEN_DASHBOARD` 消息；background 据此在 dashboard URL 后拼 `#archives`，并对"新建"与"聚焦已打开"两种情况统一处理；dashboard 从 `location.hash` 推导初始视图并监听 `hashchange`。hash → view 的映射抽成纯函数以便单测。

**Tech Stack:** React 18 + TypeScript、Vite + @crxjs/vite-plugin（MV3）、Tailwind CSS、vitest（仅用于纯逻辑单测）。

## Global Constraints

- 使用 `@/` 路径别名从 `src/` 导入。
- 函数式组件 + hooks，全部 TypeScript。
- Chrome API 调用需处理异步、注意 `chrome` 可用性。
- 用 `chrome.storage`，不用 localStorage。
- 代码/注释/commit 用英文；面向用户的 UI 文案本项目 popup 现状为英文（Total Tabs / Groups），新增卡片沿用英文 "Archived" 保持一致。
- 为生成的函数添加函数级注释。
- 验证命令：`npm run check`（tsc 类型检查）、`npm run lint`（ESLint）、`npm run test`（vitest）。

---

### Task 1: hash → view 纯函数 + 单测

把 "URL hash 映射到 dashboard 视图" 的逻辑抽成一个可单测的纯函数，供 dashboard 的初始化与 `hashchange` 监听共用。

**Files:**
- Create: `src/dashboard/viewFromHash.ts`
- Test: `src/dashboard/viewFromHash.test.ts`

**Interfaces:**
- Produces:
  - `type DashboardView = 'current' | 'archives' | 'settings'`
  - `function viewFromHash(hash: string): DashboardView` — 入参为 `location.hash`（形如 `''`、`'#archives'`、`'#anything'`）。`'#archives'` → `'archives'`，其余一律 → `'current'`。settings 不纳入 hash 映射。

- [ ] **Step 1: Write the failing test**

创建 `src/dashboard/viewFromHash.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';
import { viewFromHash } from './viewFromHash';

describe('viewFromHash', () => {
  it('maps "#archives" to the archives view', () => {
    expect(viewFromHash('#archives')).toBe('archives');
  });

  it('maps empty hash to the current view', () => {
    expect(viewFromHash('')).toBe('current');
  });

  it('maps unknown hash to the current view', () => {
    expect(viewFromHash('#something-else')).toBe('current');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/dashboard/viewFromHash.test.ts`
Expected: FAIL，报错类似 `Failed to resolve import "./viewFromHash"` 或 `viewFromHash is not a function`。

- [ ] **Step 3: Write minimal implementation**

创建 `src/dashboard/viewFromHash.ts`：

```typescript
/** Dashboard 顶部可切换的视图标识。 */
export type DashboardView = 'current' | 'archives' | 'settings';

/**
 * 将 location.hash 映射为 dashboard 的初始视图。
 * 仅识别 '#archives'，其余（空 hash 或未知 hash）一律回落到 'current'。
 * settings 视图无外部入口，不纳入 hash 映射。
 */
export function viewFromHash(hash: string): DashboardView {
  return hash === '#archives' ? 'archives' : 'current';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/dashboard/viewFromHash.test.ts`
Expected: PASS（3 个用例全部通过）。

- [ ] **Step 5: Commit**

```bash
git add src/dashboard/viewFromHash.ts src/dashboard/viewFromHash.test.ts
git commit -m "feat: add viewFromHash helper for dashboard hash routing"
```

---

### Task 2: dashboard 从 hash 初始化视图并监听 hashchange

让 dashboard 的 `activeTab` 初值由 `location.hash` 决定，并在 hash 变化时同步（覆盖"聚焦已打开 dashboard"时 background 改 hash 的场景）。

**Files:**
- Modify: `src/dashboard/App.tsx:85`（`activeTab` 声明处）及其 import 区、组件内新增一个 `useEffect`

**Interfaces:**
- Consumes: Task 1 的 `viewFromHash` 与 `DashboardView`

- [ ] **Step 1: 引入 helper**

在 `src/dashboard/App.tsx` 顶部 import 区新增（与现有 `@/` 别名 import 风格一致）：

```typescript
import { viewFromHash, type DashboardView } from '@/dashboard/viewFromHash';
```

- [ ] **Step 2: 用 hash 初始化 activeTab**

将 `src/dashboard/App.tsx:85` 的：

```typescript
  const [activeTab, setActiveTab] = useState<'current' | 'archives' | 'settings'>('current');
```

改为：

```typescript
  const [activeTab, setActiveTab] = useState<DashboardView>(() => viewFromHash(window.location.hash));
```

- [ ] **Step 3: 新增 hashchange 监听**

在组件内、`activeTab` 声明之后（其它 `useEffect` 附近即可）新增：

```typescript
  /** 监听 URL hash 变化，将其映射为当前视图（用于 popup 聚焦已打开 dashboard 时切换视图）。 */
  useEffect(() => {
    const onHashChange = () => setActiveTab(viewFromHash(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
```

> 注意：`useEffect` 已在该文件被使用（如 `src/dashboard/App.tsx:317-327`），无需新增 import；若类型检查提示 `useEffect` 未导入，则确认 React import 已含 `useEffect`。

- [ ] **Step 4: 类型检查与 lint**

Run: `npm run check`
Expected: PASS（无类型错误）。

Run: `npm run lint`
Expected: PASS（无新增 lint 错误）。

- [ ] **Step 5: Commit**

```bash
git add src/dashboard/App.tsx
git commit -m "feat: initialize dashboard view from URL hash and sync on hashchange"
```

---

### Task 3: background 支持 view 参数并拼接 hash

让 `openOrFocusDashboard` 接受可选 `view`，据此拼接 `#archives`，并在聚焦已存在标签时也更新 URL。

**Files:**
- Modify: `src/background/index.ts:121-153`

**Interfaces:**
- Produces: `openOrFocusDashboard(view?: 'archives')` — 供消息监听调用；消息形如 `{ type: 'OPEN_DASHBOARD', view?: 'archives' }`。

- [ ] **Step 1: 改造 openOrFocusDashboard**

将 `src/background/index.ts:121-143` 的函数体替换为（保留原有聚焦/新建逻辑，仅增加 hash 拼接与聚焦时更新 URL）：

```typescript
/** Opens the extension dashboard: focuses an existing tab, or creates a new one.
 *  When `view` is 'archives', the dashboard opens on the Archives view via URL hash. */
const openOrFocusDashboard = async (
  view?: 'archives',
): Promise<{ action: 'focused' | 'created' }> => {
  const dashboardIndexUrl = chrome.runtime.getURL('src/dashboard/index.html');
  const targetUrl = view === 'archives' ? `${dashboardIndexUrl}#archives` : dashboardIndexUrl;

  const allTabs = await chrome.tabs.query({});
  const targetTab = allTabs.find(
    (tab) =>
      typeof tab.url === 'string' &&
      tab.url.startsWith(dashboardIndexUrl) &&
      typeof tab.id === 'number' &&
      typeof tab.windowId === 'number',
  );

  if (targetTab?.id !== undefined && targetTab.windowId !== undefined) {
    await chrome.windows.update(targetTab.windowId, { focused: true });
    await chrome.tabs.update(targetTab.id, { active: true, url: targetUrl });

    return { action: 'focused' };
  }

  await chrome.tabs.create({ url: targetUrl });
  return { action: 'created' };
};
```

- [ ] **Step 2: 透传消息中的 view**

将 `src/background/index.ts:145-153` 的消息监听改为把 `message.view` 传入：

```typescript
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'OPEN_DASHBOARD') return;

  openOrFocusDashboard(message.view)
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => sendResponse({ ok: false, error: String(error) }));

  return true;
});
```

- [ ] **Step 3: 类型检查与 lint**

Run: `npm run check`
Expected: PASS。

Run: `npm run lint`
Expected: PASS。

- [ ] **Step 4: Commit**

```bash
git add src/background/index.ts
git commit -m "feat: support opening dashboard on a specific view via hash"
```

---

### Task 4: popup 新增 Archived 卡片并跳转

在 popup 统计网格中新增可点击的 "Archived" 卡片，数字为已归档数量，点击后跳转到 dashboard Archives 视图。

**Files:**
- Modify: `src/popup/App.tsx`

**Interfaces:**
- Consumes: `useArchivedTabs`（`@/hooks/useArchivedTabs`）返回的 `archivedTabs`；Task 3 的 `{ type: 'OPEN_DASHBOARD', view: 'archives' }` 消息协议。

- [ ] **Step 1: 引入 useArchivedTabs**

在 `src/popup/App.tsx` import 区新增：

```typescript
import { useArchivedTabs } from '@/hooks/useArchivedTabs';
```

在组件内、`const { tabs, duplicates, ... } = useTabs();` 之后新增：

```typescript
  const { archivedTabs } = useArchivedTabs();
```

- [ ] **Step 2: 泛化 handleOpenDashboard 以携带目标视图**

将 `src/popup/App.tsx:13-25` 的 `handleOpenDashboard` 改为接受可选 `view` 并透传到消息（fallback 分支保持原样，无法带 hash 时打开默认视图，属可接受降级）：

```typescript
  /** Opens dashboard: focus existing dashboard tab or create a new one.
   *  Optionally targets a specific view (e.g. 'archives') via the background message. */
  const handleOpenDashboard = async (view?: 'archives') => {
    void chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD', view }).catch(async () => {
      try {
        await chrome.runtime.openOptionsPage();
      } catch {
        const dashboardUrl = chrome.runtime.getURL('src/dashboard/index.html');
        await chrome.tabs.create({ url: dashboardUrl });
      }
    });

    window.setTimeout(() => window.close(), 0);
  };
```

> 注意：header 里现有的 `onClick={handleOpenDashboard}`（`src/popup/App.tsx:45`）无需改动——React 会把事件对象作为参数传入，`view` 变成事件对象，但 `view === 'archives'` 为 false，行为不变（打开默认视图）。若希望更严格，可改为 `onClick={() => handleOpenDashboard()}`，非必需。

- [ ] **Step 3: 新增 Archived 卡片**

将 `src/popup/App.tsx:86-95` 的统计网格（Total Tabs / Groups 两张卡片所在的 `grid grid-cols-2` 容器）在 "Groups" 卡片之后追加第三张卡片。整块 `grid grid-cols-2` 容器保持不变，新增卡片自然换行到第二行：

```tsx
            <button
                onClick={() => handleOpenDashboard('archives')}
                className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 text-left hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800 transition-all cursor-pointer"
                title="View archived tabs in dashboard"
            >
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Archived</div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">{archivedTabs.length}</div>
            </button>
```

> 说明：现有两张卡片是 `<div>`，此张为可点击卡片故用 `<button>`，并加 `text-left` 抵消 button 默认居中，视觉与相邻卡片一致。

- [ ] **Step 4: 类型检查与 lint**

Run: `npm run check`
Expected: PASS。

Run: `npm run lint`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/popup/App.tsx
git commit -m "feat: show archived tab count in popup and link to dashboard archives"
```

---

### Task 5: 全量验证

**Files:** 无（仅运行验证）。

- [ ] **Step 1: 全部单测**

Run: `npm run test`
Expected: PASS（含 `viewFromHash` 与既有 `previewCache` 测试）。

- [ ] **Step 2: 类型检查 + lint**

Run: `npm run check`
Expected: PASS。

Run: `npm run lint`
Expected: PASS。

- [ ] **Step 3: 手动验证（加载扩展）**

`npm run dev` 或构建后加载 unpacked 扩展，逐项确认：
1. popup 显示 Archived 卡片，数字与 dashboard Archives 列表数量一致。
2. dashboard 未打开时点击卡片 → 新建 dashboard 且停在 Archives 视图。
3. dashboard 已打开（任意视图，含 settings）时点击卡片 → 聚焦该标签并切到 Archives 视图。
4. 在 dashboard 归档/删除标签后，popup 数字随 `storage.onChanged` 自动更新。

---

## 备注

- 手动验证（Task 5 Step 3）需在真实 Chrome 中加载扩展，无法由自动化 gate 覆盖，执行者应人工确认或明确标注跳过。
- 除 `viewFromHash` 外的 UI/background 改动，本项目无既有组件级自动化测试约定，故以 `npm run check` + `npm run lint` + 手动验证作为 gate。
