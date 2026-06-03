import { ApiListItem, ApiParams, CollectionResponse, EntityId } from '../types';
import { getJson, postJson, v1 } from './client';

export type DeviceTokenPayload = {
  token: string;
  platform: 'ios' | 'android' | 'web' | 'unknown';
  device_name?: string;
  app_version?: string;
  locale?: string;
  timezone?: string;
};

export function listNotifications(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/notifications/'), { params });
}

export function getNotification(id: EntityId) {
  return getJson<ApiListItem>(v1(`/notifications/${id}/`));
}

export function markNotificationRead(id: EntityId) {
  return postJson<ApiListItem>(v1(`/notifications/${id}/mark-read/`));
}

export function markAllNotificationsRead() {
  return postJson<{ updated?: number }>(v1('/notifications/mark-all-read/'));
}

export function listNotificationBatches(params?: ApiParams) {
  return getJson<CollectionResponse<ApiListItem>>(v1('/notifications/batches/'), { params });
}

export function registerDeviceToken(payload: DeviceTokenPayload) {
  return postJson<ApiListItem>(v1('/notifications/device-tokens/register/'), payload);
}

export function unregisterDeviceToken(token: string) {
  return postJson<{ detail?: string }>(v1('/notifications/device-tokens/unregister/'), { token });
}
