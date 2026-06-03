import { ApiListItem, ApiParams, CollectionResponse, EntityId } from '../types';
import { deleteJson, getJson, patchJson, postJson, v1 } from './client';

export type CrmClientPayload = {
  full_name: string;
  phone?: string;
  email?: string;
  direction?: string;
  dob?: string;
  citizenship?: string;
  city?: string;
  address?: string;
  registration_address?: string;
  passport_local_num?: string;
  passport_inter_num?: string;
  passport_issued_by?: string;
  passport_issued_date?: string;
  passport_valid_until?: string;
  interested_country?: string;
  interested_university?: string;
  interested_program?: string;
  comments?: string;
  status?: string;
};

export type CrmLeadPayload = {
  full_name: string;
  phone: string;
  email?: string;
  country?: string;
  city?: string;
  direction?: string;
  interested_country?: string;
  interested_program?: string;
  status?: string;
  comment?: string;
};

export function listLeadSources(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/crm/lead-sources/'), { params });
}

export function listLeads(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/crm/leads/'), { params });
}

export function listIncomingLeads(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/crm/incoming-leads/'), { params });
}

export function getLead(id: EntityId) {
  return getJson<ApiListItem>(v1(`/crm/leads/${id}/`));
}

export function createLead(payload: CrmLeadPayload) {
  return postJson<ApiListItem>(v1('/crm/leads/'), payload);
}

export function updateLead(id: EntityId, payload: Partial<CrmLeadPayload>) {
  return patchJson<ApiListItem>(v1(`/crm/leads/${id}/`), payload);
}

export function convertLead(id: EntityId, payload?: Record<string, unknown>) {
  return postJson<ApiListItem>(v1(`/crm/leads/${id}/convert/`), payload || {});
}

export function takeLead(id: EntityId) {
  return postJson<{ detail?: string; lead?: ApiListItem }>(v1(`/crm/leads/${id}/take/`), {});
}

export function listClients(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/crm/clients/'), { params });
}

export function createClient(payload: CrmClientPayload) {
  return postJson<ApiListItem>(v1('/crm/clients/'), payload);
}

export function getClient(id: EntityId) {
  return getJson<ApiListItem>(v1(`/crm/clients/${id}/`));
}

export function updateClient(id: EntityId, payload: Partial<CrmClientPayload>) {
  return patchJson<ApiListItem>(v1(`/crm/clients/${id}/`), payload);
}

export function deleteClient(id: EntityId) {
  return deleteJson(v1(`/crm/clients/${id}/`));
}

export function getClientTimeline(id: EntityId) {
  return getJson<CollectionResponse<ApiListItem>>(v1(`/crm/clients/${id}/timeline/`));
}

export function listApplications(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/crm/applications/'), { params });
}

export function getApplication(id: EntityId) {
  return getJson<ApiListItem>(v1(`/crm/applications/${id}/`));
}

export function createApplication(payload: Record<string, unknown>) {
  return postJson<ApiListItem>(v1('/crm/applications/'), payload);
}
