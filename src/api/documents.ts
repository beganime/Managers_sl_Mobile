import { ApiListItem, ApiParams, CollectionResponse, EntityId } from '../types';
import { API_BASE_URL, getJson, postJson, v1 } from './client';

function absoluteUrl(path: string) {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

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

export function getGeneratedDocumentOriginalDownloadUrl(id: EntityId) {
  return absoluteUrl(v1(`/documents/generated/${id}/download-original/`));
}

export function getGeneratedDocumentApprovedDownloadUrl(id: EntityId) {
  return absoluteUrl(v1(`/documents/generated/${id}/download-approved/`));
}

export function getGeneratedDocumentStampPreviewUrl(id: EntityId) {
  return absoluteUrl(v1(`/documents/generated/${id}/preview-stamp-preview/`));
}

export function getGeneratedDocumentApprovedPreviewUrl(id: EntityId) {
  return absoluteUrl(v1(`/documents/generated/${id}/preview-approved/`));
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
