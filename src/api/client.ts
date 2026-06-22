import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, isAxiosError } from 'axios';

import { CollectionResponse, PaginatedResponse } from '../types';
import {
  buildApiCacheKey,
  clearApiCache,
  DEFAULT_API_CACHE_MAX_STALE_MS,
  DEFAULT_API_CACHE_TTL_MS,
  readApiCache,
  writeApiCache,
} from '../utils/apiCache';
import { clearSession, getToken, saveToken } from '../utils/storage';

export const API_BASE_URL = 'https://medisinskayaodezhda.ru/manager-sl';
export const API_V1_PREFIX = '/api/v1';
export const ACCESS_TOKEN_KEY = 'access_token';
export const REFRESH_TOKEN_KEY = 'refresh_token';
export const CACHED_PROFILE_KEY = 'cache_my_profile';

export type ApiRequestConfig = AxiosRequestConfig & {
  _retry?: boolean;
  skipAuthRefresh?: boolean;
  cache?: boolean;
  cacheTtlMs?: number;
  cacheMaxStaleMs?: number;
  cacheBackgroundRefresh?: boolean;
};

export class ApiRequestError extends Error {
  status?: number;
  data?: unknown;

  constructor(message: string, status?: number, data?: unknown) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.data = data;
  }
}

let unauthorizedHandler: (() => void) | null = null;
let refreshTokenRequest: Promise<{ access?: string; refresh?: string }> | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

function buildClient(): AxiosInstance {
  return axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });
}

export const rawApiClient = buildClient();
export const apiClient = buildClient();

export function v1(path: string) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_V1_PREFIX}${cleanPath}`;
}

export function normalizeApiPath(path: string) {
  return path.startsWith('/') ? path : `/${path}`;
}

function getMessageFromPayload(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;

  const payload = data as Record<string, unknown>;
  const detail = payload.detail;

  if (typeof detail === 'string' && detail.trim()) return detail;

  const nonFieldErrors = payload.non_field_errors;

  if (Array.isArray(nonFieldErrors) && typeof nonFieldErrors[0] === 'string') {
    return nonFieldErrors[0];
  }

  for (const value of Object.values(payload)) {
    if (Array.isArray(value) && typeof value[0] === 'string') {
      return value[0];
    }
  }

  return null;
}

export function toApiError(error: unknown): ApiRequestError {
  if (error instanceof ApiRequestError) return error;

  if (isAxiosError(error)) {
    const axiosError = error as AxiosError;
    const status = axiosError.response?.status;
    const data = axiosError.response?.data;
    const message =
      getMessageFromPayload(data) ||
      axiosError.message ||
      'Не удалось выполнить запрос к ManagerSL.';

    return new ApiRequestError(message, status, data);
  }

  if (error instanceof Error) {
    return new ApiRequestError(error.message);
  }

  return new ApiRequestError('Не удалось выполнить запрос к ManagerSL.');
}

async function refreshAccessToken(refreshToken: string) {
  const candidates = [v1('/auth/refresh/'), '/api/auth/refresh/'];
  let lastError: unknown = null;

  for (const endpoint of candidates) {
    try {
      const response = await rawApiClient.post(
        endpoint,
        { refresh: refreshToken },
        { skipAuthRefresh: true } as ApiRequestConfig
      );

      return response.data as { access?: string; refresh?: string };
    } catch (error) {
      const apiError = toApiError(error);
      lastError = apiError;

      if (apiError.status && [400, 401, 403].includes(apiError.status)) {
        throw apiError;
      }
    }
  }

  throw toApiError(lastError);
}

function refreshAccessTokenOnce(refreshToken: string) {
  if (!refreshTokenRequest) {
    refreshTokenRequest = refreshAccessToken(refreshToken).finally(() => {
      refreshTokenRequest = null;
    });
  }

  return refreshTokenRequest;
}

function shouldLogoutAfterRefreshError(error: unknown) {
  const apiError = toApiError(error);
  return Boolean(apiError.status && [400, 401, 403].includes(apiError.status));
}

function isRefreshRequest(url?: string) {
  return Boolean(url?.includes('/auth/refresh/'));
}

async function forceLogout() {
  await clearSession();
  await clearApiCache();
  unauthorizedHandler?.();
}

apiClient.interceptors.request.use(async (config) => {
  const token = await getToken(ACCESS_TOKEN_KEY);

  config.headers = config.headers || {};

  if (token) {
    (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError & { config?: ApiRequestConfig }) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.skipAuthRefresh &&
      !isRefreshRequest(originalRequest.url)
    ) {
      originalRequest._retry = true;

      const refreshToken = await getToken(REFRESH_TOKEN_KEY);

      if (refreshToken) {
        try {
          const tokens = await refreshAccessTokenOnce(refreshToken);

          if (!tokens.access) {
            throw new ApiRequestError('Сервер не вернул новый access token.', 401);
          }

          await saveToken(ACCESS_TOKEN_KEY, tokens.access);

          if (tokens.refresh) {
            await saveToken(REFRESH_TOKEN_KEY, tokens.refresh);
          }

          originalRequest.headers = originalRequest.headers || {};
          (originalRequest.headers as Record<string, string>).Authorization =
            `Bearer ${tokens.access}`;

          return apiClient(originalRequest);
        } catch (refreshError) {
          if (shouldLogoutAfterRefreshError(refreshError)) {
            await forceLogout();
          }
          return Promise.reject(toApiError(refreshError));
        }
      }

      await forceLogout();
    }

    return Promise.reject(toApiError(error));
  }
);

export function extractItems<T>(payload: CollectionResponse<T> | unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];

  const paginated = payload as PaginatedResponse<T> | null;

  if (Array.isArray(paginated?.results)) return paginated.results;

  return [];
}

export function extractCount<T>(payload: CollectionResponse<T> | unknown): number {
  if (Array.isArray(payload)) return payload.length;

  const paginated = payload as PaginatedResponse<T> | null;

  if (typeof paginated?.count === 'number') return paginated.count;

  return extractItems<T>(payload).length;
}

function shouldUseCachedGet(path: string, config?: ApiRequestConfig) {
  if (config?.cache === false) return false;
  if (path.includes('/auth/')) return false;
  return true;
}

function canUseStaleCache(error: ApiRequestError) {
  if (!error.status) return true;
  if (error.status === 408 || error.status === 429) return true;
  return error.status >= 500;
}

async function clearCacheAfterMutation() {
  await clearApiCache();
}

export async function getJson<T>(path: string, config?: ApiRequestConfig) {
  const normalizedPath = normalizeApiPath(path);

  if (!shouldUseCachedGet(normalizedPath, config)) {
    const response = await apiClient.get<T>(normalizedPath, config);
    return response.data;
  }

  const cacheKey = buildApiCacheKey(normalizedPath, config?.params);
  const cached = await readApiCache<T>(cacheKey);
  const now = Date.now();
  const ttlMs = config?.cacheTtlMs ?? DEFAULT_API_CACHE_TTL_MS;
  const maxStaleMs = config?.cacheMaxStaleMs ?? DEFAULT_API_CACHE_MAX_STALE_MS;
  const cacheAge = cached ? now - cached.savedAt : Number.POSITIVE_INFINITY;

  if (cached && cacheAge <= ttlMs) {
    if (config?.cacheBackgroundRefresh !== false) {
      void apiClient
        .get<T>(normalizedPath, config)
        .then((response) => writeApiCache(cacheKey, response.data))
        .catch(() => undefined);
    }

    return cached.data;
  }

  try {
    const response = await apiClient.get<T>(normalizedPath, config);
    await writeApiCache(cacheKey, response.data);
    return response.data;
  } catch (error) {
    const apiError = toApiError(error);

    if (cached && cacheAge <= maxStaleMs && canUseStaleCache(apiError)) {
      return cached.data;
    }

    throw apiError;
  }
}

export async function postJson<T>(path: string, data?: unknown, config?: ApiRequestConfig) {
  const response = await apiClient.post<T>(normalizeApiPath(path), data, config);
  await clearCacheAfterMutation();
  return response.data;
}

export async function patchJson<T>(path: string, data?: unknown, config?: ApiRequestConfig) {
  const response = await apiClient.patch<T>(normalizeApiPath(path), data, config);
  await clearCacheAfterMutation();
  return response.data;
}

export async function deleteJson<T>(path: string, config?: ApiRequestConfig) {
  const response = await apiClient.delete<T>(normalizeApiPath(path), config);
  await clearCacheAfterMutation();
  return response.data;
}

export async function requestFirst<T>(
  paths: string[],
  request: (path: string) => Promise<T>
): Promise<T> {
  let lastError: unknown = null;

  for (const path of paths) {
    try {
      return await request(path);
    } catch (error) {
      lastError = error;

      const apiError = toApiError(error);
      if (apiError.status && apiError.status !== 404) {
        throw apiError;
      }
    }
  }

  throw toApiError(lastError);
}

export function createMissingEndpointError(feature: string, expectedEndpoint: string) {
  void expectedEndpoint;
  return new ApiRequestError(
    `Для раздела «${feature}» ещё нужен backend-метод. Запрос записан в документацию мобильного API.`
  );
}

export default apiClient;
