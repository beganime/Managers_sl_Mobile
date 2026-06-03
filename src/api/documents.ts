import { ApiListItem, ApiParams, CollectionResponse, EntityId } from '../types';
import { getJson, postJson, v1 } from './client';

export function listDocumentTemplates(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/documents/templates/'), { params });
}

export function getDocumentTemplate(id: EntityId) {
  return getJson<ApiListItem>(v1(`/documents/templates/${id}/`));
}

export function listDocumentTemplateFields(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/documents/template-fields/'), { params });
}

export function generateDocumentFromTemplate(id: EntityId, payload: Record<string, unknown>) {
  return postJson<ApiListItem>(v1(`/documents/templates/${id}/generate/`), payload);
}

export function listGeneratedDocuments(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/documents/generated/'), { params });
}

export function getGeneratedDocument(id: EntityId) {
  return getJson<ApiListItem>(v1(`/documents/generated/${id}/`));
}

export function regenerateDocument(id: EntityId, payload?: Record<string, unknown>) {
  return postJson<ApiListItem>(v1(`/documents/generated/${id}/generate/`), payload || {});
}

export function submitDocumentForApproval(id: EntityId, comment = '') {
  return postJson<ApiListItem>(v1(`/documents/generated/${id}/submit-for-approval/`), { comment });
}

export function approveGeneratedDocument(id: EntityId, payload?: Record<string, unknown>) {
  return postJson<ApiListItem>(v1(`/documents/generated/${id}/approve/`), payload || {});
}

export function rejectGeneratedDocument(id: EntityId, reason: string) {
  return postJson<ApiListItem>(v1(`/documents/generated/${id}/reject/`), { reason });
}

export function listDocumentApprovals(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/documents/approvals/'), { params });
}

export function getDocumentApproval(id: EntityId) {
  return getJson<ApiListItem>(v1(`/documents/approvals/${id}/`));
}

export function approveDocumentApproval(id: EntityId, payload?: Record<string, unknown>) {
  return postJson<ApiListItem>(v1(`/documents/approvals/${id}/approve/`), payload || {});
}

export function rejectDocumentApproval(id: EntityId, reason: string) {
  return postJson<ApiListItem>(v1(`/documents/approvals/${id}/reject/`), { reason });
}
