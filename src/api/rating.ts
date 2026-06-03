import { ApiListItem, ApiParams, CollectionResponse } from '../types';
import { getJson, requestFirst, v1 } from './client';

export function getRating(params?: ApiParams) {
  return requestFirst<CollectionResponse<ApiListItem>>(
    [v1('/rating/'), '/api/gamification/leaderboard/'],
    (path) => getJson<CollectionResponse<ApiListItem>>(path, { params })
  );
}
