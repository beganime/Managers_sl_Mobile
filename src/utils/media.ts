import { getRuntimeApiBaseUrl } from '../api/client';
import { ApiListItem } from '../types';
import { getEntityValue } from './entity';

export function resolveMediaUrl(value: string | null | undefined): string | null {
  const source = String(value || '').trim();
  if (!source) return null;

  if (/^https?:\/\//i.test(source)) return source;
  if (source.startsWith('//')) return `https:${source}`;

  const base = getRuntimeApiBaseUrl().replace(/\/$/, '');

  if (source.startsWith('/')) {
    return `${base}${source}`;
  }

  if (source.startsWith('media/')) {
    return `${base}/${source}`;
  }

  return `${base}/media/${source}`;
}

export function getEntityMediaUrl(entity: ApiListItem | Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = getEntityValue(entity, [key]);

    if (typeof value === 'string') {
      const resolved = resolveMediaUrl(value);
      if (resolved) return resolved;
    }

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = value as Record<string, unknown>;
      const nestedValue = nested.url || nested.file || nested.path;
      if (typeof nestedValue === 'string') {
        const resolved = resolveMediaUrl(nestedValue);
        if (resolved) return resolved;
      }
    }
  }

  return null;
}
