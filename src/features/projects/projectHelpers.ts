import { StatusTone } from '../../components/ui/StatusPill';
import { ApiListItem } from '../../types';
import { getEntityString, getStatusLabel } from '../../utils/entity';

export const taskStatusOptions = [
  { label: 'Все', value: 'all' },
  { label: 'К работе', value: 'todo' },
  { label: 'В работе', value: 'in_progress' },
  { label: 'Проверка', value: 'review' },
  { label: 'Готово', value: 'done' },
];

export const projectStatusOptions = [
  { label: 'Все', value: 'all' },
  { label: 'Активные', value: 'active' },
  { label: 'Пауза', value: 'paused' },
  { label: 'Готово', value: 'done' },
  { label: 'Архив', value: 'archived' },
];

export const taskFormStatusOptions = [
  { label: 'К работе', value: 'todo' },
  { label: 'В работе', value: 'in_progress' },
  { label: 'Проверка', value: 'review' },
  { label: 'Готово', value: 'done' },
];

export const taskPriorityOptions = [
  { label: 'Низкий', value: 'low' },
  { label: 'Средний', value: 'medium' },
  { label: 'Высокий', value: 'high' },
  { label: 'Срочно', value: 'urgent' },
];

export const projectFormStatusOptions = [
  { label: 'Активно', value: 'active' },
  { label: 'Пауза', value: 'paused' },
  { label: 'Готово', value: 'done' },
  { label: 'Архив', value: 'archived' },
];

export function getTaskStatus(task: ApiListItem) {
  return getEntityString(task, ['status'], 'todo');
}

export function getTaskPriority(task: ApiListItem) {
  return getEntityString(task, ['priority'], 'medium');
}

export function getProjectStatus(project: ApiListItem) {
  return getEntityString(project, ['status'], 'active');
}

export function taskStatusTone(status: string): StatusTone {
  if (status === 'done') return 'success';
  if (status === 'review') return 'warning';
  if (status === 'cancelled') return 'danger';
  if (status === 'in_progress') return 'accent';
  return 'primary';
}

export function priorityTone(priority: string): StatusTone {
  if (priority === 'urgent') return 'danger';
  if (priority === 'high') return 'warning';
  if (priority === 'low') return 'muted';
  return 'accent';
}

export function projectStatusTone(status: string): StatusTone {
  if (status === 'done') return 'success';
  if (status === 'paused') return 'warning';
  if (status === 'archived') return 'muted';
  return 'primary';
}

export function displayStatus(status: string, fallback?: string) {
  return fallback || getStatusLabel(status);
}
