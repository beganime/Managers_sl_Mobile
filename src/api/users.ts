import { ApiListItem, ApiParams, CollectionResponse } from '../types';
import { getJson, requestFirst, v1 } from './client';

export function listUsers(params?: ApiParams) {
  return requestFirst<CollectionResponse<ApiListItem>>(
    [v1('/users/'), v1('/employees/'), '/api/users/users/'],
    (path) => getJson<CollectionResponse<ApiListItem>>(path, { params })
  );
}
