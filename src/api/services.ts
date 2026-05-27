import { ApiListItem, ApiParams, CollectionResponse } from '../types';
import { getJson, v1 } from './client';

export function listServiceCategories(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/services/categories/'), { params });
}

export function listServices(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/services/services/'), { params });
}

export function listServicePrices(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/services/prices/'), { params });
}
