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
  it('截图和时间戳都被写入 storage', async () => {
    const url = 'https://example.com';
    await savePreview(url, 'data:image/jpeg;base64,AAA');

    expect(store[`preview_${url}`]).toBe('data:image/jpeg;base64,AAA');
    const timestamps = store[TIMESTAMPS_KEY] as Record<string, number>;
    expect(timestamps[url]).toBeGreaterThan(0);
  });

  it('同 URL 重复保存会刷新时间戳', async () => {
    const url = 'https://example.com';
    await savePreview(url, 'data:old');
    const t1 = (store[TIMESTAMPS_KEY] as Record<string, number>)[url];

    await new Promise((r) => setTimeout(r, 5));
    await savePreview(url, 'data:new');
    const t2 = (store[TIMESTAMPS_KEY] as Record<string, number>)[url];

    expect(t2).toBeGreaterThan(t1);
    expect(store[`preview_${url}`]).toBe('data:new');
  });

  it('超过 MAX_PREVIEWS 时淘汰最旧条目', async () => {
    // 先写入 MAX_PREVIEWS 条，时间戳递增
    const now = Date.now();
    const existingTimestamps: Record<string, number> = {};
    for (let i = 0; i < MAX_PREVIEWS; i++) {
      const u = `https://example.com/page${i}`;
      store[`preview_${u}`] = `data:${i}`;
      existingTimestamps[u] = now + i; // 越早的 i 越小
    }
    store[TIMESTAMPS_KEY] = existingTimestamps;

    // 新增第 MAX_PREVIEWS+1 条，应触发淘汰
    const newUrl = 'https://example.com/new';
    await savePreview(newUrl, 'data:new');

    // 最旧的 page0 应被删除
    expect(store['preview_https://example.com/page0']).toBeUndefined();
    const timestamps = store[TIMESTAMPS_KEY] as Record<string, number>;
    expect(timestamps['https://example.com/page0']).toBeUndefined();

    // 新 URL 应存在
    expect(store[`preview_${newUrl}`]).toBe('data:new');
    expect(Object.keys(timestamps).length).toBe(MAX_PREVIEWS);
  });
});

// ─── removePreview ──────────────────────────────────────────────────────────

describe('removePreview', () => {
  it('删除截图及时间戳元数据', async () => {
    const url = 'https://example.com';
    store[`preview_${url}`] = 'data:image/jpeg;base64,AAA';
    store[TIMESTAMPS_KEY] = { [url]: Date.now() };

    await removePreview(url);

    expect(store[`preview_${url}`]).toBeUndefined();
    const timestamps = store[TIMESTAMPS_KEY] as Record<string, number>;
    expect(timestamps[url]).toBeUndefined();
  });

  it('删除一个 URL 不影响其他 URL', async () => {
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
  it('不清理未过期的截图', async () => {
    const url = 'https://example.com';
    store[`preview_${url}`] = 'data:fresh';
    store[TIMESTAMPS_KEY] = { [url]: Date.now() };

    await cleanupExpiredPreviews();

    expect(store[`preview_${url}`]).toBe('data:fresh');
  });

  it('清理超过 TTL 的截图', async () => {
    const url = 'https://old.com';
    store[`preview_${url}`] = 'data:old';
    store[TIMESTAMPS_KEY] = { [url]: Date.now() - TTL_MS - 1000 };

    await cleanupExpiredPreviews();

    expect(store[`preview_${url}`]).toBeUndefined();
    const timestamps = store[TIMESTAMPS_KEY] as Record<string, number>;
    expect(timestamps[url]).toBeUndefined();
  });

  it('混合场景：只清理过期条目，保留未过期条目', async () => {
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

  it('storage 为空时不报错', async () => {
    await expect(cleanupExpiredPreviews()).resolves.toBeUndefined();
  });
});
