import { savePreview, removePreview, cleanupExpiredPreviews } from './previewCache';
import { saveArchivedTab } from '../utils/storage';
import type { TabInfo } from '../utils/tabs';

console.log('Duplicate Tabs Killer: Background service worker started.');

const ARCHIVE_CURRENT_TAB_MENU_ID = 'archive_current_tab';
const ROOT_MENU_ID = 'tabs_killer_root';

// In-memory map of tabId -> url (needed because onRemoved doesn't provide the URL)
const tabUrlMap = new Map<number, string>();

// Initialize tab URL map from existing open tabs on service worker startup
chrome.tabs.query({}, (tabs) => {
  tabs.forEach(tab => {
    if (tab.id != null && tab.url) {
      tabUrlMap.set(tab.id, tab.url);
    }
  });
});

// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Duplicate Tabs Killer installed.');
  // Setup daily cleanup alarm for expired previews
  chrome.alarms.create('preview_cleanup', { periodInMinutes: 24 * 60 });

  ensureContextMenus();
});

chrome.runtime.onStartup?.addListener(() => {
  ensureContextMenus();
});

/** Returns whether a tab URL is eligible for being archived via context menu. */
const isArchivableUrl = (url: string): boolean => {
  if (url.startsWith('chrome://')) return false;
  if (url.startsWith('edge://')) return false;
  if (url.startsWith('about:')) return false;
  if (url.startsWith('devtools://')) return false;
  if (url.startsWith('chrome-extension://')) return false;

  return true;
};

/** Ensures the context menu items exist (idempotent). */
const ensureContextMenus = (): void => {
  if (typeof chrome === 'undefined' || !chrome.contextMenus?.create) return;

  chrome.contextMenus.remove(ROOT_MENU_ID, () => {
    void chrome.runtime.lastError;

    chrome.contextMenus.remove(ARCHIVE_CURRENT_TAB_MENU_ID, () => {
      void chrome.runtime.lastError;

      chrome.contextMenus.create(
        {
          id: ROOT_MENU_ID,
          title: 'Tabs killer',
          documentUrlPatterns: ['http://*/*', 'https://*/*', 'file://*/*'],
          contexts: ['page', 'link', 'selection', 'image', 'video', 'audio']
        },
        () => {
          void chrome.runtime.lastError;

          chrome.contextMenus.create(
            {
              id: ARCHIVE_CURRENT_TAB_MENU_ID,
              parentId: ROOT_MENU_ID,
              title: 'Archive current tab',
              documentUrlPatterns: ['http://*/*', 'https://*/*', 'file://*/*'],
              contexts: ['page', 'link', 'selection', 'image', 'video', 'audio']
            },
            () => {
              void chrome.runtime.lastError;
            }
          );
        }
      );
    });
  });
};

ensureContextMenus();

/** Archives the current tab into storage and then closes it. */
const archiveAndCloseTab = async (tab: chrome.tabs.Tab): Promise<void> => {
  if (typeof tab.id !== 'number') return;
  if (typeof tab.url !== 'string' || typeof tab.title !== 'string') return;
  if (!isArchivableUrl(tab.url)) return;

  const tabInfo: TabInfo = {
    ...tab,
    id: tab.id,
    url: tab.url,
    title: tab.title
  };

  await saveArchivedTab(tabInfo);
  await chrome.tabs.remove(tab.id);
};

chrome.contextMenus?.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== ARCHIVE_CURRENT_TAB_MENU_ID) return;

  const work = async () => {
    if (tab) {
      await archiveAndCloseTab(tab);
      return;
    }

    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab) await archiveAndCloseTab(activeTab);
  };

  work().catch((error) => {
    console.warn('[ContextMenu] Archive current tab failed:', error);
  });
});

/** Opens the extension dashboard: focuses an existing tab, or creates a new one. */
const openOrFocusDashboard = async (): Promise<{ action: 'focused' | 'created' }> => {
  const dashboardIndexUrl = chrome.runtime.getURL('src/dashboard/index.html');

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
    await chrome.tabs.update(targetTab.id, { active: true });

    return { action: 'focused' };
  }

  await chrome.tabs.create({ url: dashboardIndexUrl });
  return { action: 'created' };
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'OPEN_DASHBOARD') return;

  openOrFocusDashboard()
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => sendResponse({ ok: false, error: String(error) }));

  return true;
});

// Alarm handler for periodic TTL cleanup
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'preview_cleanup') {
    cleanupExpiredPreviews().catch(err => console.error('[Cleanup] Alarm cleanup failed:', err));
  }
});

// Tab Capture Logic
const captureTab = async (tabId: number, windowId: number, retryCount = 0) => {
  const logPrefix = `[Capture ${tabId}-${windowId}-${retryCount}]`;
  console.log(`${logPrefix} Starting capture process...`);

  try {
    const tab = await chrome.tabs.get(tabId);
    console.log(`${logPrefix} Tab info:`, { active: tab.active, status: tab.status, url: tab.url });

    if (tab.active && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://') && !tab.url.startsWith('about:')) {
      const window = await chrome.windows.get(windowId);
      console.log(`${logPrefix} Window info:`, { id: window.id, focused: window.focused, state: window.state });

      chrome.tabs.captureVisibleTab(windowId, { format: 'jpeg', quality: 50 }, (dataUrl) => {
        if (chrome.runtime.lastError) {
          console.warn(`${logPrefix} Capture failed:`, chrome.runtime.lastError.message);

          if (retryCount < 3) {
            const delay = 500 * (retryCount + 1);
            console.log(`${logPrefix} Retrying in ${delay}ms...`);
            setTimeout(() => captureTab(tabId, windowId, retryCount + 1), delay);
          }
          return;
        }

        if (dataUrl) {
          const url = tab.url!;
          savePreview(url, dataUrl)
            .then(() => console.log(`${logPrefix} Preview saved successfully.`))
            .catch(err => console.error(`${logPrefix} Storage save failed:`, err));
        } else {
          console.warn(`${logPrefix} Capture returned no dataUrl.`);
        }
      });
    } else {
      console.log(`${logPrefix} Skipped: Tab not active or invalid URL.`);
    }
  } catch (error) {
    console.error(`${logPrefix} Error in captureTab:`, error);
  }
};

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Keep URL map up to date
  if (tab.url) {
    tabUrlMap.set(tabId, tab.url);
  }

  if (changeInfo.status === 'complete' && tab.active) {
    console.log(`[Event] onUpdated: Tab ${tabId} complete and active.`);
    captureTab(tabId, tab.windowId);
  }
});

// Listen for tab activation
chrome.tabs.onActivated.addListener((activeInfo) => {
  console.log(`[Event] onActivated: Tab ${activeInfo.tabId} activated in Window ${activeInfo.windowId}.`);
  // Update URL map
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab.url) tabUrlMap.set(activeInfo.tabId, tab.url);
  });
  setTimeout(() => {
    captureTab(activeInfo.tabId, activeInfo.windowId);
  }, 500);
});

// Listen for window focus change
chrome.windows.onFocusChanged.addListener((windowId) => {
  console.log(`[Event] onFocusChanged: Window ${windowId} focused.`);
  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    chrome.tabs.query({ active: true, windowId }, (tabs) => {
      if (tabs.length > 0) {
        console.log(`[Event] onFocusChanged: Triggering capture for Tab ${tabs[0].id}`);
        setTimeout(() => {
          captureTab(tabs[0].id!, windowId);
        }, 500);
      }
    });
  }
});

// Cleanup screenshot when a tab is closed
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const url = tabUrlMap.get(tabId);
  tabUrlMap.delete(tabId);

  if (!url) return;

  // Only delete if no other open tab still references this URL
  const allTabs = await chrome.tabs.query({});
  const hasOtherTab = allTabs.some(tab => tab.url === url);

  if (!hasOtherTab) {
    await removePreview(url);
    console.log(`[Cleanup] Removed preview for closed tab: ${url}`);
  }
});
