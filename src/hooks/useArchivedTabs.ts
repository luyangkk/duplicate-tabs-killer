import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArchivedTab, deleteArchivedTab, getArchivedTabs, restoreArchivedTab, saveArchivedTab } from '@/utils/storage';
import { TabInfo } from '@/utils/tabs';

export const useArchivedTabs = () => {
  const [archivedTabs, setArchivedTabs] = useState<ArchivedTab[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchArchivedTabs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getArchivedTabs();
      setArchivedTabs(data);
    } catch (error) {
      console.error('Failed to fetch archived tabs:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchArchivedTabs();

    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.archivedTabs) fetchArchivedTabs();
    };

    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.onChanged.addListener(handleStorageChange);
    }

    return () => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      }
    };
  }, [fetchArchivedTabs]);

  /** Archives a single tab into persistent storage (deduplicated by URL). */
  const archiveTab = async (tab: TabInfo) => {
    await saveArchivedTab(tab);
  };

  /** Deletes a single archived tab record (does not affect current browser tabs). */
  const removeArchivedTab = async (id: string) => {
    await deleteArchivedTab(id);
  };

  /** Restores an archived tab as a new browser tab. */
  const restoreTab = async (archivedTab: ArchivedTab) => {
    await restoreArchivedTab(archivedTab);
  };

  const archivedUrlSet = useMemo(() => {
    return new Set(archivedTabs.map(t => t.url));
  }, [archivedTabs]);

  return {
    archivedTabs,
    archivedUrlSet,
    loading,
    refresh: fetchArchivedTabs,
    archiveTab,
    removeArchivedTab,
    restoreTab
  };
};

