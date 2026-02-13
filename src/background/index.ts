console.log('Duplicate Tabs Killer: Background service worker started.');

// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Duplicate Tabs Killer installed.');
});
