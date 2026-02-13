import { TabInfo } from './tabs';

export interface DomainGroup {
  domain: string;
  tabs: TabInfo[];
  favicon?: string;
}

export const getDomainFromUrl = (url: string): string => {
  try {
    const u = new URL(url);
    return u.hostname;
  } catch (e) {
    return 'unknown';
  }
};

export const groupTabsByDomain = (tabs: TabInfo[]): DomainGroup[] => {
  const groups: Record<string, DomainGroup> = {};

  tabs.forEach(tab => {
    const domain = getDomainFromUrl(tab.url);
    if (!groups[domain]) {
      groups[domain] = {
        domain,
        tabs: [],
        favicon: tab.favIconUrl
      };
    }
    groups[domain].tabs.push(tab);
    // Update favicon if missing
    if (!groups[domain].favicon && tab.favIconUrl) {
      groups[domain].favicon = tab.favIconUrl;
    }
  });

  return Object.values(groups).sort((a, b) => b.tabs.length - a.tabs.length);
};
