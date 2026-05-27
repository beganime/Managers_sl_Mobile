export const leadStatuses = [
  { label: 'Все', value: '' },
  { label: 'Новые', value: 'new' },
  { label: 'Связались', value: 'contacted' },
  { label: 'Квалиф.', value: 'qualified' },
  { label: 'Клиент', value: 'converted' },
  { label: 'Потерян', value: 'lost' },
];

export const clientStatuses = [
  { label: 'Все', value: '' },
  { label: 'Новый', value: 'new' },
  { label: 'Консультация', value: 'consultation' },
  { label: 'Документы', value: 'documents' },
  { label: 'Подача', value: 'application' },
  { label: 'Визовый этап', value: 'visa' },
  { label: 'Завершён', value: 'completed' },
];

export const directions = [
  { label: 'Поступление', value: 'admission' },
  { label: 'Виза', value: 'visa' },
  { label: 'Переводы', value: 'translation' },
  { label: 'Билеты', value: 'tickets' },
  { label: 'Другое', value: 'other' },
];

export function statusLabel(value?: unknown) {
  const raw = String(value || '');
  return (
    [...leadStatuses, ...clientStatuses].find((status) => status.value === raw)?.label ||
    raw ||
    'Без статуса'
  );
}
