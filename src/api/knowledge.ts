import { ApiListItem, ApiParams, CollectionResponse, EntityId } from '../types';
import { getJson, postJson, v1 } from './client';

export function listKnowledgeCategories(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/knowledge/categories/'), { params });
}

export function getKnowledgeCategory(id: EntityId) {
  return getJson<ApiListItem>(v1(`/knowledge/categories/${id}/`));
}

export function createKnowledgeCategory(payload: Record<string, unknown>) {
  return postJson<ApiListItem>(v1('/knowledge/categories/'), payload);
}

export function listKnowledgeFolders(params?: ApiParams) {
  return listKnowledgeCategories(params);
}

export function listKnowledgeArticles(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/knowledge/articles/'), { params });
}

export function getKnowledgeArticle(id: EntityId) {
  return getJson<ApiListItem>(v1(`/knowledge/articles/${id}/`));
}

export function createKnowledgeArticle(payload: Record<string, unknown>) {
  return postJson<ApiListItem>(v1('/knowledge/articles/'), payload);
}

export function markKnowledgeArticleRead(id: EntityId) {
  return postJson<ApiListItem>(v1(`/knowledge/articles/${id}/mark-read/`));
}
