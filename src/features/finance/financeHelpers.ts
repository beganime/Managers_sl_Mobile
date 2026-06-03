import { StatusTone } from '../../components/ui/StatusPill';
import { ApiListItem } from '../../types';
import { getEntityNumber, getEntityString, getStatusLabel } from '../../utils/entity';

export const financeSections = [
  { label: 'Доходы', value: 'incomes' },
  { label: 'Расходы', value: 'expenses' },
  { label: 'Сделки', value: 'deals' },
  { label: 'Транзакции', value: 'transactions' },
];

export const incomeStatusOptions = [
  { label: 'Все', value: 'all' },
  { label: 'Ожидают', value: 'pending' },
  { label: 'Подтверждены', value: 'confirmed' },
  { label: 'Отклонены', value: 'rejected' },
];

export const dealStatusOptions = [
  { label: 'Все', value: 'all' },
  { label: 'Новые', value: 'new' },
  { label: 'Частично', value: 'paid_partial' },
  { label: 'Оплачены', value: 'paid_full' },
  { label: 'Отменены', value: 'cancelled' },
];

export function getMoneyAmount(item: ApiListItem) {
  const amount = getEntityString(item, ['amount', 'price_client', 'total_to_pay_usd', 'amount_usd'], '0');
  const currency = getEntityString(item, ['currency_code', 'currency_symbol'], 'USD');
  return `${amount} ${currency}`;
}

export function getUsdAmount(item: ApiListItem) {
  const amount = getEntityNumber(item, ['amount_usd', 'total_to_pay_usd', 'paid_amount_usd'], 0);
  return `${amount.toLocaleString('ru-RU')} USD`;
}

export function financeStatusTone(status: string): StatusTone {
  if (['confirmed', 'paid_full', 'income', 'approved', 'paid'].includes(status)) return 'success';
  if (['pending', 'new', 'paid_partial'].includes(status)) return 'warning';
  if (['rejected', 'cancelled', 'expense'].includes(status)) return 'danger';
  return 'primary';
}

export function displayFinanceStatus(item: ApiListItem, keys: string[]) {
  const status = getEntityString(item, keys, 'status');
  const display = getEntityString(item, ['status_display', 'payment_status_display', 'transaction_type_display']);
  return display || getStatusLabel(status);
}
