import { ApiListItem, ApiParams, CollectionResponse, EntityId } from '../types';
import { getJson, postJson, v1 } from './client';

export type FinanceEntryPayload = {
  company?: EntityId;
  office?: EntityId | null;
  cashbox?: EntityId | null;
  category?: EntityId;
  employee?: EntityId | null;
  client?: EntityId | null;
  deal?: EntityId | null;
  service?: EntityId | null;
  title: string;
  amount: string | number;
  currency?: EntityId;
  date?: string;
  source?: string;
  comment?: string;
};

export function listCashboxes(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/finance/cashboxes/'), { params });
}

export function listPayments(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/finance/payments/'), { params });
}

export function listExpenseCategories(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/finance/expense-categories/'), { params });
}

export function listDeals(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/finance/deals/'), { params });
}

export function getDeal(id: EntityId) {
  return getJson<ApiListItem>(v1(`/finance/deals/${id}/`));
}

export function listIncomes(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/finance/incomes/'), { params });
}

export function getIncome(id: EntityId) {
  return getJson<ApiListItem>(v1(`/finance/incomes/${id}/`));
}

export function createIncome(payload: FinanceEntryPayload) {
  return postJson<ApiListItem>(v1('/finance/incomes/'), payload);
}

export function confirmIncome(id: EntityId) {
  return postJson<ApiListItem>(v1(`/finance/incomes/${id}/confirm/`));
}

export function rejectIncome(id: EntityId, reason: string) {
  return postJson<ApiListItem>(v1(`/finance/incomes/${id}/reject/`), { reason });
}

export function listExpenses(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/finance/expenses/'), { params });
}

export function getExpense(id: EntityId) {
  return getJson<ApiListItem>(v1(`/finance/expenses/${id}/`));
}

export function createExpense(payload: FinanceEntryPayload) {
  return postJson<ApiListItem>(v1('/finance/expenses/'), payload);
}

export function confirmExpense(id: EntityId) {
  return postJson<ApiListItem>(v1(`/finance/expenses/${id}/confirm/`));
}

export function listTransactions(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/finance/transactions/'), { params });
}

export function getTransaction(id: EntityId) {
  return getJson<ApiListItem>(v1(`/finance/transactions/${id}/`));
}

export function listCommissions(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/finance/commissions/'), { params });
}

export function listFinancialPeriods(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/finance/periods/'), { params });
}
