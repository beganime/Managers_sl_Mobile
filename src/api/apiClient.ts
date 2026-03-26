import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { APP_CONFIG, STORAGE_KEYS } from '../config/app';
import { clearSession, getToken, saveToken } from '../utils/storage';

const BASE_URL = APP_CONFIG.apiBaseUrl;

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
  },
});

async function tryRefresh() {
  const refreshToken = await getToken(STORAGE_KEYS.refreshToken);
  if (!refreshToken) {
    throw new Error('No refresh token');
  }

  const candidates = ['auth/refresh/', 'token/refresh/'];
  for (const endpoint of candidates) {
    try {
      const response = await axios.post(`${BASE_URL}${endpoint}`, { refresh: refreshToken }, { timeout: 15000 });
      if (response.data?.access) {
        await saveToken(STORAGE_KEYS.accessToken, response.data.access);
      }
      if (response.data?.refresh) {
        await saveToken(STORAGE_KEYS.refreshToken, response.data.refresh);
      }
      return response.data;
    } catch {}
  }

  throw new Error('Refresh failed');
}

apiClient.interceptors.request.use(
  async (config) => {
    const token = await getToken(STORAGE_KEYS.accessToken);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  async (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<any>) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshed = await tryRefresh();
        const access = refreshed.access;
        if (originalRequest.headers && access) {
          originalRequest.headers.Authorization = `Bearer ${access}`;
        }
        return apiClient(originalRequest);
      } catch {
        await clearSession();
      }
    }

    return Promise.reject(error);
  }
);

export async function fetchAllPages<T = any>(endpoint: string, limit = 100): Promise<T[]> {
  let offset = 0;
  let output: T[] = [];

  while (true) {
    const response = await apiClient.get(endpoint, { params: { limit, offset } });
    const data = response.data;
    const items = Array.isArray(data) ? data : (data.results ?? []);
    output = output.concat(items);

    if (Array.isArray(data) || !data.next || items.length === 0) {
      break;
    }

    offset += limit;
  }

  return output;
}

export function extractResults<T = any>(payload: any): T[] {
  return Array.isArray(payload) ? payload : (payload?.results ?? []);
}

export default apiClient;
