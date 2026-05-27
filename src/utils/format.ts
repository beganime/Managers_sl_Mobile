import { ApiListItem, AppUser, Workday } from '../types';

export function getUserDisplayName(user?: AppUser | null) {
  if (!user) return 'Пользователь';

  const parts = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();

  return user.full_name || parts || user.email || user.username || 'Пользователь';
}

export function getItemTitle(item: ApiListItem) {
  const title =
    item.title ||
    item.name ||
    item.full_name ||
    item.client_name ||
    item.university_name ||
    item.program_name ||
    item.email ||
    item.phone ||
    item.id ||
    'Запись';

  return String(title);
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

  if (status === 'not_started') {
    return 'Рабочий день ещё не начат';
  }

  if (status === 'closed' || status === 'finished' || status === 'auto_closed') {
    return 'Рабочий день закрыт';
  }

  return workday.status ? `Статус: ${workday.status}` : 'Статус рабочего дня не указан';
}
