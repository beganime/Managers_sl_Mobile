import { ApiListItem, ApiParams, CollectionResponse, EntityId } from '../types';
import { deleteJson, getJson, patchJson, postJson, v1 } from './client';

export type ProjectPayload = {
  title: string;
  code?: string;
  description?: string;
  status?: 'active' | 'paused' | 'done' | 'archived' | string;
  deadline?: string | null;
  owner?: EntityId | null;
  is_pinned?: boolean;
};

export type ProjectTaskPayload = {
  project: EntityId;
  title: string;
  description?: string;
  status?: 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled' | string;
  priority?: 'low' | 'medium' | 'high' | 'urgent' | string;
  deadline?: string | null;
  assigned_to?: EntityId | null;
  section?: EntityId | null;
};

export function listProjects(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/projects/'), { params });
}

export function getProject(id: EntityId) {
  return getJson<ApiListItem>(v1(`/projects/${id}/`));
}

export function createProject(payload: ProjectPayload) {
  return postJson<ApiListItem>(v1('/projects/'), payload);
}

export function updateProject(id: EntityId, payload: Partial<ProjectPayload>) {
  return patchJson<ApiListItem>(v1(`/projects/${id}/`), payload);
}

export function deleteProject(id: EntityId) {
  return deleteJson<void>(v1(`/projects/${id}/`));
}

export function listProjectTasks(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/projects/tasks/'), { params });
}

export function getProjectTask(id: EntityId) {
  return getJson<ApiListItem>(v1(`/projects/tasks/${id}/`));
}

export function createProjectTask(payload: ProjectTaskPayload) {
  return postJson<ApiListItem>(v1('/projects/tasks/'), payload);
}

export function updateProjectTask(id: EntityId, payload: Partial<ProjectTaskPayload>) {
  return patchJson<ApiListItem>(v1(`/projects/tasks/${id}/`), payload);
}

export function completeProjectTask(id: EntityId) {
  return postJson<ApiListItem>(v1(`/projects/tasks/${id}/complete_task/`));
}

export function reopenProjectTask(id: EntityId) {
  return postJson<ApiListItem>(v1(`/projects/tasks/${id}/reopen_task/`));
}

export function assignProjectTask(id: EntityId, user: EntityId) {
  return postJson<ApiListItem>(v1(`/projects/tasks/${id}/assign/`), { user });
}

export function listProjectTaskComments(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/projects/comments/'), { params });
}

export function addProjectTaskComment(id: EntityId, text: string) {
  return postJson<ApiListItem>(v1(`/projects/tasks/${id}/add_comment/`), { text });
}

export function listProjectSections(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/projects/sections/'), { params });
}
