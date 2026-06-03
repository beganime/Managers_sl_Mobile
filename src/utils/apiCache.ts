import AsyncStorage from '@react-native-async-storage/async-storage';

const API_CACHE_PREFIX = 'manager_sl_api_cache_v1:';

export const DEFAULT_API_CACHE_TTL_MS = 3 * 60 * 60 * 1000;
export const DEFAULT_API_CACHE_MAX_STALE_MS = 7 * 24 * 60 * 60 * 1000;

export type ApiCacheEntry<T> = {
  data: T;
  savedAt: number;
};

function normalizeForKey(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeForKey);

  const record = value as Record<string, unknown>;
  return Object.keys(record)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      const normalized = normalizeForKey(record[key]);
      if (normalized !== undefined) {
        acc[key] = normalized;
      }
      return acc;
    }, {});
}

function stableStringify(value: unknown) {
  return JSON.stringify(normalizeForKey(value));
}

export function buildApiCacheKey(path: string, params?: unknown) {
  return `${API_CACHE_PREFIX}${stableStringify({ path, params })}`;
}

export async function readApiCache<T>(key: string): Promise<ApiCacheEntry<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as ApiCacheEntry<T>;
    if (!parsed || typeof parsed.savedAt !== 'number') return null;

    return parsed;
  } catch {
    return null;
  }
}

export async function writeApiCache<T>(key: string, data: T) {
  try {
    const entry: ApiCacheEntry<T> = {
      data,
      savedAt: Date.now(),
    };
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  } catch {
  }
}

export async function clearApiCache() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const apiKeys = keys.filter((key) => key.startsWith(API_CACHE_PREFIX));

    if (apiKeys.length) {
      await AsyncStorage.multiRemove(apiKeys);
    }
  } catch {
  }
}
