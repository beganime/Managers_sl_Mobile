import { ApiListItem, ApiParams, CollectionResponse } from '../types';
import { getJson, v1 } from './client';

export function listKnowledgeFolders(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/knowledge/folders/'), { params });
}

export function listKnowledgeArticles(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/knowledge/articles/'), { params });
}
