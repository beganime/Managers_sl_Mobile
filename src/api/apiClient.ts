import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { deleteToken, getToken, saveToken } from '../utils/storage';

const BASE_URL = 'https://manager-sl.ru/api/';

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
  },
});

function normalizePath(path: string) {
  if (!path) return '';
  return path.startsWith('/') ? path.slice(1) : path;
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
      nextUrl = data.next.startsWith(cleanBase)
        ? data.next.replace(cleanBase, '')
        : data.next;
    } else {
      nextUrl = null;
    }
  }

  return all;
}

export async function loginRequest(email: string, password: string) {
  const response = await apiClient.post('auth/login/', { email, password });

  if (response.data?.access) {
    await saveToken('access_token', response.data.access);
  }

  if (response.data?.refresh) {
    await saveToken('refresh_token', response.data.refresh);
  }

  if (response.data?.user) {
    await saveToken('cache_my_profile', JSON.stringify(response.data.user));
  }

  return response.data;
}

export async function logoutRequest() {
  const refresh = await getToken('refresh_token');

  try {
    if (refresh) {
      await apiClient.post('auth/logout/', { refresh });
    }
  } catch {
    // игнорируем ошибку logout, локально всё равно чистим токены
  } finally {
    await deleteToken('access_token');
    await deleteToken('refresh_token');
    await deleteToken('cache_my_profile');
  }
}

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await getToken('access_token');

    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      const requestUrl = originalRequest.url || '';

      // чтобы не уйти в цикл, не рефрешим если уже auth/login или auth/refresh
      if (requestUrl.includes('auth/login/') || requestUrl.includes('auth/refresh/')) {
        await deleteToken('access_token');
        await deleteToken('refresh_token');
        await deleteToken('cache_my_profile');
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      try {
        const refreshToken = await getToken('refresh_token');

        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        const refreshResponse = await axios.post(`${BASE_URL}auth/refresh/`, {
          refresh: refreshToken,
        });

        const newAccess = refreshResponse.data?.access;

        if (!newAccess) {
          throw new Error('No new access token');
        }

        await saveToken('access_token', newAccess);

        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${newAccess}`;

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