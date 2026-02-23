import { useState, useEffect } from 'react';

export type PreviewMap = Record<string, string | null>;

export const useDomainPreviews = (urls: string[]) => {
  const [previews, setPreviews] = useState<PreviewMap>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (urls.length === 0) {
      setPreviews({});
      return;
    }

    setLoading(true);
    const keys = urls.map(url => `preview_${url}`);

    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get(keys, (result) => {
        const map: PreviewMap = {};
        urls.forEach(url => {
          map[url] = (result[`preview_${url}`] as string) ?? null;
        });
        setPreviews(map);
        setLoading(false);
      });
    } else {
      const map: PreviewMap = {};
      urls.forEach(url => { map[url] = null; });
      setPreviews(map);
      setLoading(false);
    }
  // Use joined string to avoid re-fetching on array reference changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urls.join(',')]);

  return { previews, loading };
};
