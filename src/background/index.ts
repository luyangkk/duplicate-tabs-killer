console.log('Duplicate Tabs Killer: Background service worker started.');

// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Duplicate Tabs Killer installed.');
});

// Tab Capture Logic
const captureTab = async (tabId: number, windowId: number, retryCount = 0) => {
  const logPrefix = `[Capture ${tabId}-${windowId}-${retryCount}]`;
  console.log(`${logPrefix} Starting capture process...`);

  try {
    const tab = await chrome.tabs.get(tabId);
    console.log(`${logPrefix} Tab info:`, { active: tab.active, status: tab.status, url: tab.url });

    if (tab.active && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://') && !tab.url.startsWith('about:')) {
      // Check if window is focused
      const window = await chrome.windows.get(windowId);
      console.log(`${logPrefix} Window info:`, { id: window.id, focused: window.focused, state: window.state });

      // Try to capture even if window.focused is false, sometimes it works or is necessary during switching
      // But chrome.tabs.captureVisibleTab requires the window to be the "current" window in some contexts, 
      // or simply the windowId provided. The doc says "Captures the visible area of the currently active tab in the specified window."
      // It implies the window doesn't strictly need to be focused, but the tab MUST be active in that window.
      
      chrome.tabs.captureVisibleTab(windowId, { format: 'jpeg', quality: 50 }, (dataUrl) => {
        if (chrome.runtime.lastError) {
          console.warn(`${logPrefix} Capture failed:`, chrome.runtime.lastError.message);
          
          // Retry logic
          if (retryCount < 3) {
             const delay = 500 * (retryCount + 1);
             console.log(`${logPrefix} Retrying in ${delay}ms...`);
             setTimeout(() => captureTab(tabId, windowId, retryCount + 1), delay);
          }
          return;
        }

        if (dataUrl) {
          const key = `preview_${tab.url}`;
          console.log(`${logPrefix} Capture success! Saving to storage. Length: ${dataUrl.length}`);
          chrome.storage.local.set({ [key]: dataUrl }, () => {
              if (chrome.runtime.lastError) {
                  console.error(`${logPrefix} Storage save failed:`, chrome.runtime.lastError);
              } else {
                  console.log(`${logPrefix} Preview saved successfully.`);
              }
          });
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
  if (changeInfo.status === 'complete' && tab.active) {
    console.log(`[Event] onUpdated: Tab ${tabId} complete and active.`);
    captureTab(tabId, tab.windowId);
  }
});

// Listen for tab activation
chrome.tabs.onActivated.addListener((activeInfo) => {
  console.log(`[Event] onActivated: Tab ${activeInfo.tabId} activated in Window ${activeInfo.windowId}.`);
  // Give a small delay to ensure rendering is complete and window is focused
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
