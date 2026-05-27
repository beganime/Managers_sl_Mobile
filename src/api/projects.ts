import { ApiListItem, ApiParams, CollectionResponse } from '../types';
import { getJson, postJson, v1 } from './client';

export function listProjects(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/projects/'), { params });
}

export function listProjectTasks(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/projects/tasks/'), { params });
}

export function createProjectTask(payload: Record<string, unknown>) {
  return postJson<ApiListItem>(v1('/projects/tasks/'), payload);
}
