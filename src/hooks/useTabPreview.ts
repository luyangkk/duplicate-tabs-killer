import { useState, useEffect } from 'react';

export const useTabPreview = (url: string | undefined) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!url) {
      setPreview(null);
      return;
    }

    setLoading(true);
    const key = `preview_${url}`;
    
    // In dev environment without chrome extension context, this will fail or do nothing
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get([key], (result) => {
        if (result[key]) {
          setPreview(result[key] as string);
        } else {
          setPreview(null);
        }
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [url]);

  return { preview, loading };
};
