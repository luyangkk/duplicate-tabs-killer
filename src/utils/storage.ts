import { TabInfo } from './tabs';

export interface Archive {
  id: string;
  name: string;
  tabs: TabInfo[];
  createdAt: number;
  domainCount: Record<string, number>;
  domainFavicons?: Record<string, string>;
  tabGroups?: ArchiveTabGroup[];
}

export interface ArchiveTabGroup {
  id: number;
  windowId: number;
  title?: string;
  color: chrome.tabGroups.TabGroup['color'];
  collapsed: boolean;
}

export interface ArchivedTab {
  id: string;
  url: string;
  title: string;
  favIconUrl?: string;
  domain: string;
  archivedAt: number;
  pinned?: boolean;
  windowId?: number;
  index?: number;
}

const shouldSkipArchivedUrl = (url: string) => {
  return url.startsWith('chrome-extension://');
};

const getTabGroupsForArchive = async (tabs: TabInfo[]): Promise<ArchiveTabGroup[] | undefined> => {
  if (typeof chrome === 'undefined' || !chrome.tabGroups?.get) return undefined;

  const groupIdNone = chrome.tabGroups?.TAB_GROUP_ID_NONE ?? -1;
  const groupIds = Array.from(
    new Set(
      tabs
        .map(t => t.groupId)
        .filter((id): id is number => typeof id === 'number' && id !== groupIdNone)
    )
  );

  if (groupIds.length === 0) return [];

  const groups: ArchiveTabGroup[] = [];
  for (const groupId of groupIds) {
    try {
      const group = await chrome.tabGroups.get(groupId);
      groups.push({
        id: group.id,
        windowId: group.windowId,
        title: group.title,
        color: group.color,
        collapsed: group.collapsed
      });
    } catch {
      continue;
    }
  }
  return groups;
};

const mapArchiveTabGroups = (archive: Archive) => {
  if (!archive.tabGroups) return new Map<number, ArchiveTabGroup>();
  return new Map(archive.tabGroups.map(g => [g.id, g] as const));
};

const getWindowIdKey = (tab: TabInfo) => {
  return typeof tab.windowId === 'number' ? tab.windowId : chrome.windows.WINDOW_ID_CURRENT;
};

const getTabIndex = (tab: TabInfo) => {
  return typeof tab.index === 'number' ? tab.index : Number.MAX_SAFE_INTEGER;
};

const WINDOW_ID_CURRENT_FALLBACK = -2;
const archivedTabRestoreWindowMap = new Map<number, number>();

/**
 * Resolves the target windowId for restoring a previously archived tab.
 * If the original window no longer exists, a new window is created and mapped for reuse.
 */
const resolveRestoreWindowId = async (
  originalWindowId: number | undefined,
  url: string,
  sessionWindowMap: Map<number, number>
): Promise<number> => {
  if (typeof chrome === 'undefined' || !chrome.windows?.getCurrent) return WINDOW_ID_CURRENT_FALLBACK;

  const currentWindow = await chrome.windows.getCurrent();
  if (typeof originalWindowId !== 'number') return currentWindow.id;
  if (originalWindowId === (chrome.windows?.WINDOW_ID_CURRENT ?? WINDOW_ID_CURRENT_FALLBACK)) return currentWindow.id;

  const mapped = sessionWindowMap.get(originalWindowId);
  if (mapped) return mapped;

  if (chrome.windows?.getAll) {
    const existingWindows = await chrome.windows.getAll({ populate: false });
    const existingWindowIds = new Set(existingWindows.map(w => w.id).filter((id): id is number => typeof id === 'number'));
    if (existingWindowIds.has(originalWindowId)) {
      sessionWindowMap.set(originalWindowId, originalWindowId);
      return originalWindowId;
    }
  }

  if (chrome.windows?.create) {
    try {
      const created = await chrome.windows.create({ url, focused: false });
      if (typeof created.id === 'number') {
        sessionWindowMap.set(originalWindowId, created.id);
        return created.id;
      }
    } catch {
      return currentWindow.id;
    }
  }

  return currentWindow.id;
};

export const saveArchive = async (name: string, tabs: TabInfo[]): Promise<Archive> => {
  const domainCount: Record<string, number> = {};
  const domainFavicons: Record<string, string> = {};
  tabs.forEach(tab => {
    try {
      const domain = new URL(tab.url).hostname;
      domainCount[domain] = (domainCount[domain] || 0) + 1;
      if (!domainFavicons[domain] && tab.favIconUrl) domainFavicons[domain] = tab.favIconUrl;
    } catch {
      return;
    }
  });

  const tabGroups = await getTabGroupsForArchive(tabs);

  const archive: Archive = {
    id: crypto.randomUUID(),
    name,
    tabs,
    createdAt: Date.now(),
    domainCount,
    domainFavicons,
    tabGroups: tabGroups && tabGroups.length > 0 ? tabGroups : undefined
  };

  if (typeof chrome === 'undefined' || !chrome.storage?.local) return archive;

  const { archives } = await chrome.storage.local.get(['archives']);
  const currentArchives: Archive[] = (archives as Archive[]) || [];
  const newArchives = [archive, ...currentArchives];
  await chrome.storage.local.set({ archives: newArchives });
  
  return archive;
};

export const getArchives = async (): Promise<Archive[]> => {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return [];
  const { archives } = await chrome.storage.local.get(['archives']);
  return (archives as Archive[]) || [];
};

export const deleteArchive = async (id: string): Promise<void> => {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  const { archives } = await chrome.storage.local.get(['archives']);
  const currentArchives: Archive[] = (archives as Archive[]) || [];
  const newArchives = currentArchives.filter((a: Archive) => a.id !== id);
  await chrome.storage.local.set({ archives: newArchives });
};

export const restoreArchive = async (archive: Archive): Promise<void> => {
  if (typeof chrome === 'undefined' || !chrome.tabs?.create || !chrome.windows?.getAll) return;

  const existingWindows = await chrome.windows.getAll({ populate: false });
  const existingWindowIds = new Set(existingWindows.map(w => w.id).filter((id): id is number => typeof id === 'number'));
  const originalToTargetWindowId = new Map<number, number>();

  const groupsByWindow = new Map<number, TabInfo[]>();
  for (const tab of archive.tabs) {
    if (shouldSkipArchivedUrl(tab.url)) continue;
    const key = getWindowIdKey(tab);
    const list = groupsByWindow.get(key) ?? [];
    list.push(tab);
    groupsByWindow.set(key, list);
  }

  const tabGroupsById = mapArchiveTabGroups(archive);
  const restoredTabIdsByOriginalGroup = new Map<number, number[]>();
  const activeTabByTargetWindow = new Map<number, number>();

  for (const [originalWindowId, tabs] of groupsByWindow) {
    const sortedTabs = [...tabs].sort((a, b) => getTabIndex(a) - getTabIndex(b));
    if (sortedTabs.length === 0) continue;

    const registerRestoredTab = async (sourceTab: TabInfo, restoredTab: chrome.tabs.Tab) => {
      if (typeof restoredTab.id !== 'number') return;
      const groupIdNone = chrome.tabGroups?.TAB_GROUP_ID_NONE ?? -1;
      if (typeof sourceTab.groupId === 'number' && sourceTab.groupId !== groupIdNone) {
        const list = restoredTabIdsByOriginalGroup.get(sourceTab.groupId) ?? [];
        list.push(restoredTab.id);
        restoredTabIdsByOriginalGroup.set(sourceTab.groupId, list);
      }
      if (sourceTab.active) activeTabByTargetWindow.set(restoredTab.windowId, restoredTab.id);
      if (typeof sourceTab.pinned === 'boolean' && sourceTab.pinned !== restoredTab.pinned) {
        await chrome.tabs.update(restoredTab.id, { pinned: sourceTab.pinned });
      }
    };

    let targetWindowId = originalWindowId;
    let tabsToCreate = sortedTabs;
    if (typeof originalWindowId === 'number' && originalWindowId !== chrome.windows.WINDOW_ID_CURRENT) {
      const mapped = originalToTargetWindowId.get(originalWindowId);
      if (mapped) {
        targetWindowId = mapped;
      } else if (existingWindowIds.has(originalWindowId)) {
        originalToTargetWindowId.set(originalWindowId, originalWindowId);
        targetWindowId = originalWindowId;
      } else {
        try {
          const first = sortedTabs[0];
          const createdWindow = await chrome.windows.create({ url: first.url, focused: false });
          if (typeof createdWindow.id === 'number') {
            originalToTargetWindowId.set(originalWindowId, createdWindow.id);
            targetWindowId = createdWindow.id;
            existingWindowIds.add(createdWindow.id);
            if (createdWindow.tabs?.[0]) {
              await registerRestoredTab(first, createdWindow.tabs[0]);
              tabsToCreate = sortedTabs.slice(1);
            }
          }
        } catch {
          const currentWindow = await chrome.windows.getCurrent();
          targetWindowId = currentWindow.id;
        }
      }
    } else {
      const currentWindow = await chrome.windows.getCurrent();
      targetWindowId = currentWindow.id;
    }

    for (const tab of tabsToCreate) {
      try {
        const createProperties: chrome.tabs.CreateProperties = {
          url: tab.url,
          active: false,
          windowId: targetWindowId
        };
        if (typeof tab.index === 'number') createProperties.index = tab.index;
        if (typeof tab.pinned === 'boolean') createProperties.pinned = tab.pinned;

        const createdTab = await chrome.tabs.create(createProperties);
        if (!createdTab) continue;
        await registerRestoredTab(tab, createdTab);
      } catch {
        continue;
      }
    }
  }

  if (chrome.tabs?.group && chrome.tabGroups?.update) {
    for (const [originalGroupId, tabIds] of restoredTabIdsByOriginalGroup) {
      if (tabIds.length === 0) continue;
      try {
        const [firstTabId, ...restTabIds] = tabIds;
        const newGroupId = await chrome.tabs.group({ tabIds: [firstTabId, ...restTabIds] });
        const meta = tabGroupsById.get(originalGroupId);
        if (meta) {
          await chrome.tabGroups.update(newGroupId, {
            title: meta.title,
            color: meta.color,
            collapsed: meta.collapsed
          });
        }
      } catch {
        continue;
      }
    }
  }

  for (const [, tabId] of activeTabByTargetWindow) {
    try {
      await chrome.tabs.update(tabId, { active: true });
    } catch {
      continue;
    }
  }
};

/** Saves a single tab into persistent storage for later retrieval. */
export const saveArchivedTab = async (tab: TabInfo): Promise<ArchivedTab> => {
  const domain = (() => {
    try {
      return new URL(tab.url).hostname;
    } catch {
      return 'unknown';
    }
  })();

  const archivedTab: ArchivedTab = {
    id: crypto.randomUUID(),
    url: tab.url,
    title: tab.title,
    favIconUrl: tab.favIconUrl,
    domain,
    archivedAt: Date.now(),
    pinned: typeof tab.pinned === 'boolean' ? tab.pinned : undefined,
    windowId: typeof tab.windowId === 'number' ? tab.windowId : undefined,
    index: typeof tab.index === 'number' ? tab.index : undefined
  };

  if (typeof chrome === 'undefined' || !chrome.storage?.local) return archivedTab;

  const { archivedTabs } = await chrome.storage.local.get(['archivedTabs']);
  const current: ArchivedTab[] = (archivedTabs as ArchivedTab[]) || [];
  const withoutSameUrl = current.filter(t => t.url !== archivedTab.url);
  await chrome.storage.local.set({ archivedTabs: [archivedTab, ...withoutSameUrl] });

  return archivedTab;
};

/** Reads archived single tabs from storage. */
export const getArchivedTabs = async (): Promise<ArchivedTab[]> => {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return [];
  const { archivedTabs } = await chrome.storage.local.get(['archivedTabs']);
  return (archivedTabs as ArchivedTab[]) || [];
};

/** Deletes a previously archived single tab by id. */
export const deleteArchivedTab = async (id: string): Promise<void> => {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  const { archivedTabs } = await chrome.storage.local.get(['archivedTabs']);
  const current: ArchivedTab[] = (archivedTabs as ArchivedTab[]) || [];
  await chrome.storage.local.set({ archivedTabs: current.filter(t => t.id !== id) });
};

/** Opens an archived single tab as a new tab. */
export const restoreArchivedTab = async (archivedTab: ArchivedTab): Promise<void> => {
  if (typeof chrome === 'undefined' || !chrome.tabs?.create) return;

  const targetWindowId = await resolveRestoreWindowId(archivedTab.windowId, archivedTab.url, archivedTabRestoreWindowMap);

  const created = await chrome.tabs.create({
    url: archivedTab.url,
    active: true,
    pinned: archivedTab.pinned,
    windowId: targetWindowId,
    index: archivedTab.index
  });

  if (typeof created?.id !== 'number') return;
  if (typeof archivedTab.pinned === 'boolean' && created.pinned !== archivedTab.pinned) {
    await chrome.tabs.update(created.id, { pinned: archivedTab.pinned });
  }
};
