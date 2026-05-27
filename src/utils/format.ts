import { ApiListItem, AppUser, Workday } from '../types';

export function getUserDisplayName(user?: AppUser | null) {
  if (!user) return 'Пользователь';

  const parts = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();

  return user.full_name || parts || user.email || user.username || 'Пользователь';
}

export function getItemTitle(item: ApiListItem) {
  return (
    item.title ||
    item.name ||
    item.full_name ||
    String(item.email || item.phone || item.id || 'Запись')
  );
}

export function getItemSubtitle(item: ApiListItem) {
  const values = [item.status, item.created_at].filter(Boolean);
  return values.length ? values.join(' · ') : null;
}

export function formatWorkdayStatus(workday?: Workday | null) {
  if (!workday) return 'Нет данных по рабочему дню';

  const status = String(workday.status || '').toLowerCase();

  if (status === 'open' || status === 'started' || status === 'active') {
    return 'Рабочий день открыт';
  }

  if (status === 'closed' || status === 'finished') {
    return 'Рабочий день закрыт';
  }

  return workday.status ? `Статус: ${workday.status}` : 'Статус рабочего дня не указан';
}
