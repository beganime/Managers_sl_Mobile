import { StatusTone } from '../../components/ui/StatusPill';
import { getStatusLabel } from '../../utils/entity';

export const documentSections = [
  { label: 'Шаблоны', value: 'templates' },
  { label: 'Документы', value: 'generated' },
  { label: 'Согласования', value: 'approvals' },
];

export const documentStatusOptions = [
  { label: 'Все', value: 'all' },
  { label: 'Черновик', value: 'draft' },
  { label: 'На согласовании', value: 'pending' },
  { label: 'Одобрено', value: 'approved' },
  { label: 'Отклонено', value: 'rejected' },
];

export function documentStatusTone(status: string): StatusTone {
  if (['approved', 'ready'].includes(status)) return 'success';
  if (['pending', 'submitted', 'in_review'].includes(status)) return 'warning';
  if (['rejected', 'failed', 'error'].includes(status)) return 'danger';
  if (['archived'].includes(status)) return 'muted';
  return 'primary';
}

export function displayDocumentStatus(status: string, display?: string) {
  return display || getStatusLabel(status);
}
