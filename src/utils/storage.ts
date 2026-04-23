import { TabInfo } from './tabs';

export interface Archive {
  id: string;
  name: string;
  tabs: TabInfo[];
  createdAt: number;
  domainCount: Record<string, number>;
  domainFavicons?: Record<string, string>;
}

export interface ArchivedTab {
  id: string;
  url: string;
  title: string;
  favIconUrl?: string;
  domain: string;
  archivedAt: number;
}

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

  const archive: Archive = {
    id: crypto.randomUUID(),
    name,
    tabs,
    createdAt: Date.now(),
    domainCount,
    domainFavicons
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
  if (typeof chrome === 'undefined' || !chrome.tabs?.create) return;
  for (const tab of archive.tabs) {
    await chrome.tabs.create({ url: tab.url, active: false });
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
    archivedAt: Date.now()
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
  await chrome.tabs.create({ url: archivedTab.url, active: true });
};
