import { ApiListItem, ApiParams, CollectionResponse } from '../types';
import { getJson, v1 } from './client';

export function listDocumentTemplates(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/documents/templates/'), { params });
}

export function listGeneratedDocuments(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/documents/generated/'), { params });
}
