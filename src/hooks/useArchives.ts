import { useState, useEffect, useCallback } from 'react';
import { Archive, getArchives, saveArchive, deleteArchive, restoreArchive } from '@/utils/storage';
import { TabInfo } from '@/utils/tabs';

export const useArchives = () => {
  const [archives, setArchives] = useState<Archive[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchArchives = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getArchives();
      setArchives(data);
    } catch (error) {
      console.error('Failed to fetch archives:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchArchives();
    
    // Listen for storage changes
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.archives) {
        fetchArchives();
      }
    };
    
    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.onChanged.addListener(handleStorageChange);
    }
    
    return () => {
       if (typeof chrome !== 'undefined' && chrome.storage) {
          chrome.storage.onChanged.removeListener(handleStorageChange);
       }
    };
  }, [fetchArchives]);

  const addArchive = async (name: string, tabs: TabInfo[]) => {
    await saveArchive(name, tabs);
    // fetchArchives will be triggered by onChanged listener
  };

  const removeArchive = async (id: string) => {
    await deleteArchive(id);
  };

  const restore = async (archive: Archive) => {
    await restoreArchive(archive);
  };

  return {
    archives,
    loading,
    addArchive,
    removeArchive,
    restore
  };
};
