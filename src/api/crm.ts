import { ApiListItem, ApiParams, CollectionResponse, EntityId } from '../types';
import { getJson, postJson, v1 } from './client';

export function listLeads(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/crm/leads/'), { params });
}

export function createLead(payload: Record<string, unknown>) {
  return postJson<ApiListItem>(v1('/crm/leads/'), payload);
}

export function convertLead(id: EntityId, payload?: Record<string, unknown>) {
  return postJson<ApiListItem>(v1(`/crm/leads/${id}/convert/`), payload || {});
}

export function listClients(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/crm/clients/'), { params });
}

export function createClient(payload: Record<string, unknown>) {
  return postJson<ApiListItem>(v1('/crm/clients/'), payload);
}

export function getClient(id: EntityId) {
  return getJson<ApiListItem>(v1(`/crm/clients/${id}/`));
}

export function getClientTimeline(id: EntityId) {
  return getJson<CollectionResponse<ApiListItem>>(v1(`/crm/clients/${id}/timeline/`));
}

export function listApplications(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/crm/applications/'), { params });
}

export function createApplication(payload: Record<string, unknown>) {
  return postJson<ApiListItem>(v1('/crm/applications/'), payload);
}
