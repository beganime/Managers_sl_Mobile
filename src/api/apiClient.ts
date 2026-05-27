import { AxiosRequestConfig } from 'axios';
import { Platform } from 'react-native';

import {
  API_BASE_URL,
  apiClient,
  extractItems,
  getJson,
  normalizeApiPath,
  v1,
} from './client';
import { getMe, login, logout, updateMe } from './auth';

export const BASE_URL = API_BASE_URL;
export const API_ORIGIN = API_BASE_URL;

type UploadInput = {
  uri: string;
  name?: string;
  type?: string;
  mimeType?: string;
};

export const multipartConfig: AxiosRequestConfig = {
  headers: {
    Accept: 'application/json',
  },
  transformRequest: [(data) => data],
};

export function buildAbsoluteFileUrl(value?: string | null) {
  if (!value) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  if (/^(https?:|mailto:|tel:|blob:|data:)/i.test(raw)) {
    return raw;
  }

  if (raw.startsWith('/')) {
    return `${API_ORIGIN}${raw}`;
  }

  return `${API_ORIGIN}/${raw.replace(/^\/+/, '')}`;
}

export function extractList(payload: unknown): any[] {
  return extractItems<any>(payload);
}

export function extractResults(payload: unknown): any[] {
  return extractList(payload);
}

function asV1Path(path: string) {
  const normalized = normalizeApiPath(path);

  if (normalized.startsWith('/api/')) return normalized;

  return v1(normalized);
}

export async function fetchAllPages(path: string, limit = 100) {
  const all: any[] = [];
  let offset = 0;
  let nextPath: string | null = asV1Path(path);

  while (nextPath) {
    const currentPath: string = nextPath;
    const separator = currentPath.includes('?') ? '&' : '?';
    const url: string = currentPath.includes('limit=')
      ? currentPath
      : `${currentPath}${separator}limit=${limit}&offset=${offset}`;
    const payload: any = await getJson<any>(url);

    all.push(...extractList(payload));

    if (typeof payload?.next === 'string' && payload.next) {
      nextPath = payload.next.startsWith(API_BASE_URL)
        ? payload.next.slice(API_BASE_URL.length)
        : payload.next;
      offset += limit;
    } else {
      nextPath = null;
    }
  }

  return all;
}

export async function loginRequest(email: string, password: string) {
  return login({ email, password });
}

export async function logoutRequest() {
  return logout();
}

export async function getMyProfile() {
  return getMe();
}

export async function updateMyProfile(payload: Record<string, any>) {
  return updateMe(payload);
}

export function getFileNameFromUri(uri?: string, fallbackName = 'file') {
  if (!uri) return fallbackName;

  const clean = uri.split('?')[0].split('#')[0];
  const last = clean.split('/').pop();

  return last || fallbackName;
}

export function ensureFileNameHasExtension(name: string, mimeType?: string) {
  const cleanName = String(name || 'file').trim() || 'file';

  if (/\.[a-zA-Z0-9]{2,8}$/.test(cleanName)) {
    return cleanName;
  }

  const type = String(mimeType || '').toLowerCase();

  if (type.includes('jpeg')) return `${cleanName}.jpg`;
  if (type.includes('jpg')) return `${cleanName}.jpg`;
  if (type.includes('png')) return `${cleanName}.png`;
  if (type.includes('webp')) return `${cleanName}.webp`;
  if (type.includes('gif')) return `${cleanName}.gif`;
  if (type.includes('pdf')) return `${cleanName}.pdf`;
  if (type.includes('msword')) return `${cleanName}.doc`;
  if (type.includes('wordprocessingml')) return `${cleanName}.docx`;
  if (type.includes('spreadsheetml')) return `${cleanName}.xlsx`;

  return cleanName;
}

export function normalizeUploadFile(file: UploadInput, fallbackName = 'file') {
  const mimeType = file.type || file.mimeType || 'application/octet-stream';
  const rawName = file.name || getFileNameFromUri(file.uri, fallbackName);
  const name = ensureFileNameHasExtension(rawName, mimeType);

  return {
    uri: file.uri,
    name,
    type: mimeType,
  } as any;
}

export async function prepareUploadFile(file: UploadInput, fallbackName = 'file') {
  const normalized = normalizeUploadFile(file, fallbackName);

  if (Platform.OS !== 'web') {
    return normalized;
  }

  const response = await fetch(normalized.uri);
  const blob = await response.blob();
  const fileType = normalized.type || blob.type || 'application/octet-stream';

  if (typeof File !== 'undefined') {
    return new File([blob], normalized.name, { type: fileType });
  }

  return blob;
}

export async function appendPreparedFile(
  fd: FormData,
  fieldName: string,
  file: UploadInput,
  fallbackName = 'file'
) {
  const prepared = await prepareUploadFile(file, fallbackName);
  fd.append(fieldName, prepared as any);
}

export async function uploadMyAvatar(file: UploadInput) {
  const fd = new FormData();
  await appendPreparedFile(fd, 'avatar', file, 'avatar.jpg');

  return updateMe({ avatar: fd } as any);
}

export async function removeMyAvatar() {
  return updateMe({ remove_avatar: true });
}

export default apiClient;
