import { ApiListItem, EntityId } from '../types';
import { getJson, postJson } from './client';

export type ClientExamPayload = {
  subject: string;
  university: string;
  exam_date: string;
  exam_time: string;
  timezone?: string;
  comment?: string;
  repeat_until_acknowledged?: boolean;
  manager_sl_exam_id?: string;
};

export type ClientExamListResponse = {
  client: ApiListItem;
  exams: ApiListItem[];
};

export type ClientExamCreateResponse = {
  client: ApiListItem;
  exam: ApiListItem;
};

export function listClientExams(clientId: EntityId) {
  return getJson<ClientExamListResponse>(`/api/app/clients/${clientId}/exams/`, {
    cache: false,
  });
}

export function createClientExam(clientId: EntityId, payload: ClientExamPayload) {
  return postJson<ClientExamCreateResponse>(`/api/app/clients/${clientId}/exams/`, payload);
}
