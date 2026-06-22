import { ApiListItem, ApiParams, CollectionResponse } from '../types';
import { getJson } from './client';

export function listUsers(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>('/api/users/users/', { params });
}
