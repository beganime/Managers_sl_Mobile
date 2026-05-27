import { ApiListItem, ApiParams, CollectionResponse } from '../types';
import { getJson, postJson, v1 } from './client';

export function listDeals(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/finance/deals/'), { params });
}

export function listIncomes(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/finance/incomes/'), { params });
}

export function createIncome(payload: Record<string, unknown>) {
  return postJson<ApiListItem>(v1('/finance/incomes/'), payload);
}

export function listExpenses(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/finance/expenses/'), { params });
}

export function createExpense(payload: Record<string, unknown>) {
  return postJson<ApiListItem>(v1('/finance/expenses/'), payload);
}

export function listTransactions(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/finance/transactions/'), { params });
}

export function listCommissions(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/finance/commissions/'), { params });
}
