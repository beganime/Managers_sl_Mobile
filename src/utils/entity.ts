import { ApiListItem, EntityId } from '../types';

type EntityRecord = ApiListItem | Record<string, unknown> | null | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function getEntityValue(entity: EntityRecord, keys: string[]) {
  if (!isRecord(entity)) return undefined;

  for (const key of keys) {
    const value = entity[key];

    if (value === null || value === undefined) continue;
    if (typeof value === 'string' && !value.trim()) continue;

    return value;
  }

  return undefined;
}

export function getEntityString(entity: EntityRecord, keys: string[], fallback = '') {
  const value = getEntityValue(entity, keys);

  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  if (isRecord(value)) {
    return getEntityString(value, ['full_name', 'name', 'title', 'email', 'username', 'id'], fallback);
  }

  return fallback;
}

export function getEntityNumber(entity: EntityRecord, keys: string[], fallback = 0) {
  const value = getEntityValue(entity, keys);

  if (typeof value === 'number' && Number.isFinite(value)) return value;

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return fallback;
}

export function getEntityId(entity: EntityRecord): EntityId | undefined {
  const value = getEntityValue(entity, ['id', 'pk']);
  if (typeof value === 'number' || typeof value === 'string') return value;
  return undefined;
}

export function getEntityTitle(entity: EntityRecord, fallback = 'Запись') {
  return getEntityString(
    entity,
    ['title', 'name', 'full_name', 'client_name', 'university_name', 'program_name', 'email', 'phone', 'id'],
    fallback
  );
}

export function getEntityArray<T = ApiListItem>(entity: EntityRecord, key: string): T[] {
  if (!isRecord(entity)) return [];

  const value = entity[key];
  return Array.isArray(value) ? (value as T[]) : [];
}

export function getStatusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    active: 'Активно',
    archived: 'Архив',
    cancelled: 'Отменено',
    done: 'Готово',
    draft: 'Черновик',
    high: 'Высокий',
    in_progress: 'В работе',
    low: 'Низкий',
    medium: 'Средний',
    new: 'Новый',
    paused: 'Пауза',
    published: 'Опубликовано',
    review: 'Проверка',
    todo: 'К работе',
    urgent: 'Срочно',
  };

  if (!status) return 'Не указан';

  return labels[status] || status.replace(/_/g, ' ');
}

export function formatEntityDate(value: unknown) {
  if (!value) return '';

  const source = String(value);
  const date = new Date(source);

  if (Number.isNaN(date.getTime())) return source;

  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function stripHtml(value: unknown) {
  if (!value) return '';

  return String(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}
