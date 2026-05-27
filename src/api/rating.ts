import { ApiListItem, ApiParams, CollectionResponse } from '../types';
import { getJson, v1 } from './client';

export function getRating(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/rating/'), { params });
}
