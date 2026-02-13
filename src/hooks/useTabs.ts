import { useState, useEffect, useCallback } from 'react';
import { getAllTabs, getDuplicateTabs, DuplicateGroup, TabInfo, closeTabs } from '@/utils/tabs';

export const useTabs = () => {
  const [tabs, setTabs] = useState<TabInfo[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTabs = useCallback(async () => {
    // Don't set loading to true here to avoid flickering on updates
    try {
      const allTabs = await getAllTabs();
      setTabs(allTabs);
      setDuplicates(getDuplicateTabs(allTabs));
    } catch (error) {
      console.error('Failed to fetch tabs:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTabs();
    
    // Listen for tab changes
    const handleTabUpdate = () => fetchTabs();
    
    // Check if chrome API is available
    if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.onCreated.addListener(handleTabUpdate);
        chrome.tabs.onUpdated.addListener(handleTabUpdate);
        chrome.tabs.onRemoved.addListener(handleTabUpdate);
    }

    return () => {
      if (typeof chrome !== 'undefined' && chrome.tabs) {
          chrome.tabs.onCreated.removeListener(handleTabUpdate);
          chrome.tabs.onUpdated.removeListener(handleTabUpdate);
          chrome.tabs.onRemoved.removeListener(handleTabUpdate);
      }
    };
  }, [fetchTabs]);

  const closeDuplicateTabs = async () => {
    const tabsToClose: number[] = [];
    duplicates.forEach(group => {
      // Keep the active tab if present, otherwise the first one
      const activeTab = group.tabs.find(t => t.active);
      const tabToKeep = activeTab || group.tabs[0];
      
      group.tabs.forEach(tab => {
        if (tab.id !== tabToKeep.id) {
          tabsToClose.push(tab.id);
        }
      });
    });

    if (tabsToClose.length > 0) {
      await closeTabs(tabsToClose);
      // fetchTabs will be triggered by onRemoved listener
    }
  };

  return {
    tabs,
    duplicates,
    loading,
    refresh: fetchTabs,
    closeDuplicateTabs
  };
};
