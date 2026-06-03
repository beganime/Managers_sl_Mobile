const numberFormatter = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function parseMoneyValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.replace(/\s/g, '').replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function formatMoneyValue(value: unknown, currency = 'USD') {
  const amount = parseMoneyValue(value);

  if (amount === null || amount === 0) {
    return '';
  }

  return `${numberFormatter.format(amount)} ${String(currency || 'USD').toUpperCase()}`;
}

export function formatRateToUsd(rate: unknown, currency = 'USD') {
  const value = parseMoneyValue(rate);
  const code = String(currency || 'USD').toUpperCase();

  if (value === null || code === 'USD') {
    return '';
  }

  return `1 ${code} = ${numberFormatter.format(value)} USD`;
}
