export interface TabInfo extends chrome.tabs.Tab {
  id: number;
  url: string;
  title: string;
}

export interface DuplicateGroup {
  url: string;
  tabs: TabInfo[];
}

export const getAllTabs = async (): Promise<TabInfo[]> => {
  const tabs = await chrome.tabs.query({});
  // Filter out tabs without id, url, or title
  return tabs.filter((tab): tab is TabInfo => 
    tab.id !== undefined && tab.url !== undefined && tab.title !== undefined
  );
};

export const getDuplicateTabs = (tabs: TabInfo[]): DuplicateGroup[] => {
  const groups: Record<string, TabInfo[]> = {};
  
  tabs.forEach(tab => {
    // Normalize URL: remove hash and maybe query params if strict mode?
    // For now, exact URL match.
    const url = tab.url;
    if (!groups[url]) {
      groups[url] = [];
    }
    groups[url].push(tab);
  });

  // Filter groups with > 1 tab
  return Object.entries(groups)
    .filter(([_, groupTabs]) => groupTabs.length > 1)
    .map(([url, groupTabs]) => ({
      url,
      tabs: groupTabs
    }));
};

export const closeTabs = async (tabIds: number[]): Promise<void> => {
  if (tabIds.length > 0) {
    await chrome.tabs.remove(tabIds);
  }
};
