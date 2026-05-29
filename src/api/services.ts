import { ApiListItem, ApiParams, CollectionResponse, EntityId } from '../types';
import { getJson, v1 } from './client';

export function listServiceCategories(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/services/categories/'), { params });
}

export function getServiceCategory(id: EntityId) {
  return getJson<ApiListItem>(v1(`/services/categories/${id}/`));
}

export function listServices(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/services/services/'), { params });
}

export function getService(id: EntityId) {
  return getJson<ApiListItem>(v1(`/services/services/${id}/`));
}

export function listServicePrices(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/services/prices/'), { params });
}

export function getServicePrice(id: EntityId) {
  return getJson<ApiListItem>(v1(`/services/prices/${id}/`));
}
