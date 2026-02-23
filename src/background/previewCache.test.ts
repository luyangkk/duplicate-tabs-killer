import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  savePreview,
  removePreview,
  cleanupExpiredPreviews,
  TIMESTAMPS_KEY,
  MAX_PREVIEWS,
  TTL_MS,
} from './previewCache';

// In-memory store simulating chrome.storage.local
let store: Record<string, unknown> = {};

const chromeMock = {
  storage: {
    local: {
      get: vi.fn(async (keys: string[]) => {
        const result: Record<string, unknown> = {};
        keys.forEach((k) => {
          if (k in store) result[k] = store[k];
        });
        return result;
      }),
      set: vi.fn(async (items: Record<string, unknown>) => {
        Object.assign(store, items);
      }),
      remove: vi.fn(async (keys: string[]) => {
        keys.forEach((k) => delete store[k]);
      }),
    },
  },
};

vi.stubGlobal('chrome', chromeMock);

beforeEach(() => {
  store = {};
  vi.clearAllMocks();
});

// ─── savePreview ────────────────────────────────────────────────────────────

describe('savePreview', () => {
  it('writes screenshot and timestamp to storage', async () => {
    const url = 'https://example.com';
    await savePreview(url, 'data:image/jpeg;base64,AAA');

    expect(store[`preview_${url}`]).toBe('data:image/jpeg;base64,AAA');
    const timestamps = store[TIMESTAMPS_KEY] as Record<string, number>;
    expect(timestamps[url]).toBeGreaterThan(0);
  });

  it('refreshes timestamp when saving the same URL again', async () => {
    const url = 'https://example.com';
    await savePreview(url, 'data:old');
    const t1 = (store[TIMESTAMPS_KEY] as Record<string, number>)[url];

    await new Promise((r) => setTimeout(r, 5));
    await savePreview(url, 'data:new');
    const t2 = (store[TIMESTAMPS_KEY] as Record<string, number>)[url];

    expect(t2).toBeGreaterThan(t1);
    expect(store[`preview_${url}`]).toBe('data:new');
  });

  it('evicts the oldest entry when MAX_PREVIEWS is exceeded', async () => {
    // Pre-fill MAX_PREVIEWS entries with incrementing timestamps
    const now = Date.now();
    const existingTimestamps: Record<string, number> = {};
    for (let i = 0; i < MAX_PREVIEWS; i++) {
      const u = `https://example.com/page${i}`;
      store[`preview_${u}`] = `data:${i}`;
      existingTimestamps[u] = now + i; // smaller i = older timestamp
    }
    store[TIMESTAMPS_KEY] = existingTimestamps;

    // Adding one more entry should trigger LRU eviction
    const newUrl = 'https://example.com/new';
    await savePreview(newUrl, 'data:new');

    // The oldest entry (page0) should be removed
    expect(store['preview_https://example.com/page0']).toBeUndefined();
    const timestamps = store[TIMESTAMPS_KEY] as Record<string, number>;
    expect(timestamps['https://example.com/page0']).toBeUndefined();

    // The new URL should exist
    expect(store[`preview_${newUrl}`]).toBe('data:new');
    expect(Object.keys(timestamps).length).toBe(MAX_PREVIEWS);
  });
});

// ─── removePreview ──────────────────────────────────────────────────────────

describe('removePreview', () => {
  it('removes the screenshot and its timestamp metadata', async () => {
    const url = 'https://example.com';
    store[`preview_${url}`] = 'data:image/jpeg;base64,AAA';
    store[TIMESTAMPS_KEY] = { [url]: Date.now() };

    await removePreview(url);

    expect(store[`preview_${url}`]).toBeUndefined();
    const timestamps = store[TIMESTAMPS_KEY] as Record<string, number>;
    expect(timestamps[url]).toBeUndefined();
  });

  it('removing one URL does not affect other URLs', async () => {
    const url1 = 'https://a.com';
    const url2 = 'https://b.com';
    store[`preview_${url1}`] = 'data:a';
    store[`preview_${url2}`] = 'data:b';
    store[TIMESTAMPS_KEY] = { [url1]: Date.now(), [url2]: Date.now() };

    await removePreview(url1);

    expect(store[`preview_${url1}`]).toBeUndefined();
    expect(store[`preview_${url2}`]).toBe('data:b');
    const timestamps = store[TIMESTAMPS_KEY] as Record<string, number>;
    expect(timestamps[url2]).toBeDefined();
  });
});

// ─── cleanupExpiredPreviews ─────────────────────────────────────────────────

describe('cleanupExpiredPreviews', () => {
  it('does not remove previews that have not expired', async () => {
    const url = 'https://example.com';
    store[`preview_${url}`] = 'data:fresh';
    store[TIMESTAMPS_KEY] = { [url]: Date.now() };

    await cleanupExpiredPreviews();

    expect(store[`preview_${url}`]).toBe('data:fresh');
  });

  it('removes previews that exceed TTL', async () => {
    const url = 'https://old.com';
    store[`preview_${url}`] = 'data:old';
    store[TIMESTAMPS_KEY] = { [url]: Date.now() - TTL_MS - 1000 };

    await cleanupExpiredPreviews();

    expect(store[`preview_${url}`]).toBeUndefined();
    const timestamps = store[TIMESTAMPS_KEY] as Record<string, number>;
    expect(timestamps[url]).toBeUndefined();
  });

  it('mixed scenario: removes only expired entries, keeps fresh ones', async () => {
    const fresh = 'https://fresh.com';
    const expired = 'https://expired.com';
    const now = Date.now();

    store[`preview_${fresh}`] = 'data:fresh';
    store[`preview_${expired}`] = 'data:expired';
    store[TIMESTAMPS_KEY] = {
      [fresh]: now,
      [expired]: now - TTL_MS - 1000,
    };

    await cleanupExpiredPreviews();

    expect(store[`preview_${fresh}`]).toBe('data:fresh');
    expect(store[`preview_${expired}`]).toBeUndefined();
    const timestamps = store[TIMESTAMPS_KEY] as Record<string, number>;
    expect(timestamps[fresh]).toBeDefined();
    expect(timestamps[expired]).toBeUndefined();
  });

  it('does not throw when storage is empty', async () => {
    await expect(cleanupExpiredPreviews()).resolves.toBeUndefined();
  });
});
