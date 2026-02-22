export const TIMESTAMPS_KEY = 'preview_timestamps';
export const MAX_PREVIEWS = 200;
export const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Save screenshot with timestamp; enforce max entries limit via LRU eviction
export const savePreview = async (url: string, dataUrl: string): Promise<void> => {
  const key = `preview_${url}`;
  const result = await chrome.storage.local.get([TIMESTAMPS_KEY]);
  const timestamps = (result[TIMESTAMPS_KEY] ?? {}) as Record<string, number>;

  timestamps[url] = Date.now();

  // Enforce max entries: remove oldest entries when over limit
  const entries = Object.entries(timestamps);
  if (entries.length > MAX_PREVIEWS) {
    entries.sort((a, b) => a[1] - b[1]); // ascending by timestamp
    const toRemove = entries.slice(0, entries.length - MAX_PREVIEWS);
    const keysToRemove = toRemove.map(([u]) => `preview_${u}`);
    await chrome.storage.local.remove(keysToRemove);
    toRemove.forEach(([u]) => delete timestamps[u]);
    console.log(`[Cleanup] Evicted ${toRemove.length} oldest previews to stay within limit.`);
  }

  await chrome.storage.local.set({ [key]: dataUrl, [TIMESTAMPS_KEY]: timestamps });
};

// Remove a preview entry and its timestamp metadata
export const removePreview = async (url: string): Promise<void> => {
  const key = `preview_${url}`;
  const result = await chrome.storage.local.get([TIMESTAMPS_KEY]);
  const timestamps = (result[TIMESTAMPS_KEY] ?? {}) as Record<string, number>;

  delete timestamps[url];
  await chrome.storage.local.remove([key]);
  await chrome.storage.local.set({ [TIMESTAMPS_KEY]: timestamps });
};

// TTL cleanup: remove previews not updated within TTL_MS
export const cleanupExpiredPreviews = async (): Promise<void> => {
  const result = await chrome.storage.local.get([TIMESTAMPS_KEY]);
  const timestamps = (result[TIMESTAMPS_KEY] ?? {}) as Record<string, number>;
  const now = Date.now();

  const expiredUrls = Object.entries(timestamps)
    .filter(([, ts]) => now - ts > TTL_MS)
    .map(([url]) => url);

  if (expiredUrls.length > 0) {
    const keysToRemove = expiredUrls.map(url => `preview_${url}`);
    await chrome.storage.local.remove(keysToRemove);
    expiredUrls.forEach(url => delete timestamps[url]);
    await chrome.storage.local.set({ [TIMESTAMPS_KEY]: timestamps });
    console.log(`[Cleanup] Removed ${expiredUrls.length} expired previews (TTL: 7 days).`);
  }
};
