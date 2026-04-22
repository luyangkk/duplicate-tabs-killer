import { TabInfo } from './tabs';

export interface Archive {
  id: string;
  name: string;
  tabs: TabInfo[];
  createdAt: number;
  domainCount: Record<string, number>;
}

export const saveArchive = async (name: string, tabs: TabInfo[]): Promise<Archive> => {
  const domainCount: Record<string, number> = {};
  tabs.forEach(tab => {
    try {
      const domain = new URL(tab.url).hostname;
      domainCount[domain] = (domainCount[domain] || 0) + 1;
    } catch {
      return;
    }
  });

  const archive: Archive = {
    id: crypto.randomUUID(),
    name,
    tabs,
    createdAt: Date.now(),
    domainCount
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
