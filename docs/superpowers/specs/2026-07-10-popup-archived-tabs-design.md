# Popup 归档标签数量展示与跳转设计

日期：2026-07-10

## 背景

当前 popup（`src/popup/App.tsx`）展示：Header → 状态卡（重复数量 + 一键关闭）→ 两列统计网格（Total Tabs / Groups）→ 单列的"重复标签详情"列表。

归档能力已在 dashboard 落地：`useArchivedTabs` hook 提供已归档标签数据，dashboard 的 Archives 视图负责查看与管理。popup 目前完全没有归档入口。

## 目标

1. 在 popup 的统计网格中新增一张"Archived"卡片，样式与现有 Total Tabs / Groups 卡片一致，数字显示已归档标签的数量。
2. 点击该卡片跳转到 dashboard，并直接落在 Archives 视图。

## 非目标

- popup 内不内嵌已归档标签列表，也不在 popup 内直接 restore/删除归档项（这些仍在 dashboard 完成）。
- 不改动归档的存储结构、`useArchivedTabs` 的实现，或归档/恢复逻辑。

## 现状要点

- 归档数量：`useArchivedTabs()` 返回 `archivedTabs: ArchivedTab[]`，数量即 `archivedTabs.length`。hook 内部监听 `chrome.storage.onChanged`，跨 popup/dashboard 自动同步。
- 打开 dashboard：popup 通过 `chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' })` 触发 background 的 `openOrFocusDashboard()`（`src/background/index.ts:121-153`），该函数会聚焦已存在的 dashboard 标签，否则新建。
- dashboard 视图切换：`activeTab` 是纯 `useState<'current' | 'archives' | 'settings'>`，默认 `'current'`，**不走路由**（`src/dashboard/App.tsx:85`）。因此需要一个"指定初始视图"的传参机制。

## 方案：URL hash 路由（方案 A）

选用 URL hash 作为 popup → dashboard 的视图传参载体。相比 chrome.storage 标志位，hash 无读取/清除竞态，且能统一覆盖"新建 dashboard"与"聚焦已打开 dashboard"两种情况。

### 数据流

```
popup 点击 Archived 卡片
  → chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD', view: 'archives' })
  → window.close()

background openOrFocusDashboard({ view })
  → 构造 URL：view === 'archives' 时追加 '#archives'
  → 已存在 dashboard 标签：chrome.tabs.update(id, { active: true, url: urlWithHash })
                          + chrome.windows.update(windowId, { focused: true })
  → 不存在：chrome.tabs.create({ url: urlWithHash })

dashboard 挂载
  → activeTab 初值由 location.hash 决定（'#archives' → 'archives'）
  → 监听 hashchange，同步 activeTab（覆盖"聚焦已打开 dashboard"时 hash 变化的场景）
```

### 各文件改动

1. **`src/popup/App.tsx`**
   - 引入 `useArchivedTabs`，取 `archivedTabs`（用于数量）。
   - 现有 `handleOpenDashboard` 泛化为可携带目标视图；新增点击归档卡片的处理：发送带 `view: 'archives'` 的消息后关闭 popup。fallback 分支（`openOptionsPage` / `tabs.create`）保留现有行为，无法携带 hash 时退化为打开默认视图即可。
   - 在统计网格（当前 `grid grid-cols-2`）中，Total Tabs / Groups 之后新增第三张 "Archived" 卡片，数字为 `archivedTabs.length`。`grid-cols-2` 不变，第三张卡片自然换行至第二行。卡片整体可点击（`button` 或带 `onClick` 的容器），带 hover/cursor 视觉反馈。

2. **`src/background/index.ts`**
   - `openOrFocusDashboard` 增加可选参数 `view?: 'archives'`（预留字符串以便未来扩展），据此在 `dashboardIndexUrl` 后拼接 `#archives`。
   - 聚焦已存在标签时，除 `active: true` 外补充 `url: urlWithHash`，使已打开的 dashboard 也能切到 Archives（仅改 hash 不会重载页面，会触发 `hashchange`）。
   - 消息监听处将 `message.view` 透传给 `openOrFocusDashboard`。

3. **`src/dashboard/App.tsx`**
   - `activeTab` 初始值由 `location.hash` 推导：`#archives` → `'archives'`，否则 `'current'`。
   - 新增 `useEffect` 监听 `window` 的 `hashchange` 事件，将 hash 映射为 `activeTab` 并 `setActiveTab`；卸载时移除监听。

## 边界与错误处理

- background 消息 fallback：popup 若 `sendMessage` 失败，走原有 `openOptionsPage` / `tabs.create` fallback，此时无法附加 hash，dashboard 打开默认 current 视图——可接受的降级。
- hash 仅识别 `#archives`；未识别或空 hash 一律回落到 `'current'`，不影响 settings 视图（settings 无 popup 入口，不纳入 hash 映射）。
- 已打开 dashboard 停留在 settings 时被 popup 触发跳转：`tabs.update` 改 hash 为 `#archives`，`hashchange` 监听将 `activeTab` 切到 archives，符合预期。

## 验证

- `npm run check`（tsc 类型检查）通过。
- `npm run lint` 通过。
- 手动验证（加载扩展）：
  1. popup 显示 Archived 卡片，数字与 dashboard Archives 列表数量一致。
  2. dashboard 未打开时点击卡片 → 新建 dashboard 且停在 Archives 视图。
  3. dashboard 已打开（任意视图）时点击卡片 → 聚焦该标签并切到 Archives 视图。
  4. 在 dashboard 归档/删除标签后，popup 数字随 `storage.onChanged` 自动更新。
