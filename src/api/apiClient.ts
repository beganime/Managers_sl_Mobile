import axios, { AxiosError, AxiosRequestConfig } from 'axios';

import { deleteToken, getToken, saveToken } from '../utils/storage';

export const BASE_URL = 'https://manager-sl.ru/api/';

export const API_ORIGIN = BASE_URL.replace(/\/api\/?$/i, '').replace(/\/$/, '');

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

function normalizePath(path: string) {
  if (!path) return '';
  return path.startsWith('/') ? path.slice(1) : path;
}

export function buildAbsoluteFileUrl(value?: string | null) {
  if (!value) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  if (/^(https?:|mailto:|tel:)/i.test(raw)) {
    return raw;
  }

  if (raw.startsWith('/')) {
    return `${API_ORIGIN}${raw}`;
  }

  return `${API_ORIGIN}/${raw.replace(/^\/+/, '')}`;
}

function isFormDataPayload(data: unknown) {
  if (!data) return false;
  if (typeof FormData !== 'undefined' && data instanceof FormData) return true;

  const maybeFormData = data as any;
  return (
    typeof maybeFormData === 'object' &&
    typeof maybeFormData.append === 'function' &&
    (typeof maybeFormData.getParts === 'function' || String(maybeFormData).includes('FormData'))
  );
}

function stripJsonContentType(config: AxiosRequestConfig) {
  if (!config.headers) return;

  const headers: any = config.headers;

  if (typeof headers.delete === 'function') {
    headers.delete('Content-Type');
    headers.delete('content-type');
    return;
  }

  delete headers['Content-Type'];
  delete headers['content-type'];
}

export const multipartConfig: AxiosRequestConfig = {
  headers: { Accept: 'application/json' },
  transformRequest: [(data) => data],
};

async function persistUserCacheFromResponse(payload: any) {
  if (payload && typeof payload === 'object') {
    if (payload.user) {
      await saveToken('cache_my_profile', JSON.stringify(payload.user));
      return;
    }

    if (payload.id && payload.email) {
      await saveToken('cache_my_profile', JSON.stringify(payload));
    }
  }
}

export function extractList(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

export async function fetchAllPages(path: string, limit = 100) {
  let url = normalizePath(path);

  if (!url.includes('limit=')) {
    url += `${url.includes('?') ? '&' : '?'}limit=${limit}&offset=0`;
  }

  const all: any[] = [];
  let nextUrl: string | null = url;

  while (nextUrl) {
    const response = await apiClient.get(nextUrl);
    const data = response.data;

    all.push(...extractList(data));

    if (typeof data?.next === 'string' && data.next.length > 0) {
      const cleanBase = BASE_URL.endsWith('/') ? BASE_URL : `${BASE_URL}/`;
      nextUrl = data.next.startsWith(cleanBase) ? data.next.replace(cleanBase, '') : data.next;
    } else {
      nextUrl = null;
    }
  }

  return all;
}

export async function loginRequest(email: string, password: string) {
  try {
    const response = await apiClient.post('auth/login/', { email, password });

    if (response.data?.access) await saveToken('access_token', response.data.access);
    if (response.data?.refresh) await saveToken('refresh_token', response.data.refresh);

    await persistUserCacheFromResponse(response.data);
    return response.data;
  } catch {
    const fallback = await apiClient.post('token/', { email, password });

    if (fallback.data?.access) await saveToken('access_token', fallback.data.access);
    if (fallback.data?.refresh) await saveToken('refresh_token', fallback.data.refresh);

    return fallback.data;
  }
}

export async function logoutRequest() {
  const refresh = await getToken('refresh_token');

  try {
    if (refresh) await apiClient.post('auth/logout/', { refresh });
  } catch {
  } finally {
    await deleteToken('access_token');
    await deleteToken('refresh_token');
    await deleteToken('cache_my_profile');
  }
}

export async function getMyProfile() {
  const response = await apiClient.get('users/users/me/');
  await persistUserCacheFromResponse(response.data);
  return response.data;
}

export async function updateMyProfile(payload: Record<string, any>) {
  const response = await apiClient.patch('users/users/me/', payload);
  await persistUserCacheFromResponse(response.data);
  return response.data;
}

export function normalizeUploadFile(
  file: { uri: string; name?: string; type?: string },
  fallbackName = 'file'
) {
  const cleanName = file.name || file.uri?.split('/')?.pop() || fallbackName;

  return {
    uri: file.uri,
    name: cleanName,
    type: file.type || 'application/octet-stream',
  } as any;
}

export async function uploadMyAvatar(file: { uri: string; name?: string; type?: string }) {
  const fd = new FormData();
  fd.append('avatar', normalizeUploadFile(file, 'avatar.jpg'));

  const response = await apiClient.patch('users/users/me/', fd, multipartConfig);

  await persistUserCacheFromResponse(response.data);
  return response.data;
}

export async function removeMyAvatar() {
  const response = await apiClient.patch('users/users/me/', { remove_avatar: true });
  await persistUserCacheFromResponse(response.data);
  return response.data;
}

apiClient.interceptors.request.use(
  async (config) => {
    const token = await getToken('access_token');

    config.headers = config.headers || {};

    if (token) {
      (config.headers as any).Authorization = `Bearer ${token}`;
    }

    if (isFormDataPayload(config.data)) {
      stripJsonContentType(config);
      config.transformRequest = [(data) => data];
    }

    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  async (response) => {
    await persistUserCacheFromResponse(response.data);
    return response;
  },
  async (error: AxiosError & { config?: any }) => {
    const originalRequest = error.config;

    if (error?.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await getToken('refresh_token');
        if (!refreshToken) throw new Error('No refresh token');

        let refreshResponse;
        try {
          refreshResponse = await axios.post(`${BASE_URL}auth/refresh/`, { refresh: refreshToken });
        } catch {
          refreshResponse = await axios.post(`${BASE_URL}token/refresh/`, { refresh: refreshToken });
        }

        const newAccess = (refreshResponse as any).data?.access;
        if (!newAccess) throw new Error('No new access token');

        await saveToken('access_token', newAccess);

        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${newAccess}`;

        if (isFormDataPayload(originalRequest.data)) {
          if (typeof originalRequest.headers.delete === 'function') {
            originalRequest.headers.delete('Content-Type');
            originalRequest.headers.delete('content-type');
          } else {
            delete originalRequest.headers['Content-Type'];
            delete originalRequest.headers['content-type'];
          }
          originalRequest.transformRequest = [(data: any) => data];
        }

        return apiClient(originalRequest);
      } catch (refreshError) {
        await deleteToken('access_token');
        await deleteToken('refresh_token');
        await deleteToken('cache_my_profile');
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;