import {
  ACCESS_TOKEN_KEY,
  apiClient,
  ApiRequestConfig,
  CACHED_PROFILE_KEY,
  REFRESH_TOKEN_KEY,
  toApiError,
  v1,
} from './client';
import { AppUser, AuthResponse } from '../types';
import { clearSession, getToken, saveJSON, saveToken } from '../utils/storage';

export type LoginCredentials = {
  email: string;
  password: string;
};

async function postFirst<T>(paths: string[], payload?: unknown): Promise<T> {
  let lastError: unknown = null;

  for (const path of paths) {
    try {
      const response = await apiClient.post<T>(path, payload, {
        skipAuthRefresh: true,
      } as ApiRequestConfig);

      return response.data;
    } catch (error) {
      lastError = error;
    }
  }

  throw toApiError(lastError);
}

export async function login(credentials: LoginCredentials) {
  const data = await postFirst<AuthResponse>([v1('/auth/login/'), '/api/auth/login/'], {
    email: credentials.email,
    password: credentials.password,
  });

  if (!data.access) {
    throw new Error('Сервер не вернул access token.');
  }

  await saveToken(ACCESS_TOKEN_KEY, data.access);

  if (data.refresh) {
    await saveToken(REFRESH_TOKEN_KEY, data.refresh);
  }

  const user = data.user || (await getMe());

  await saveJSON(CACHED_PROFILE_KEY, user);

  return { ...data, user };
}

export async function getMe() {
  const response = await apiClient.get<AppUser>(v1('/me/'));
  await saveJSON(CACHED_PROFILE_KEY, response.data);
  return response.data;
}

export async function logout() {
  const refresh = await getToken(REFRESH_TOKEN_KEY);

  try {
    await postFirst([v1('/auth/logout/'), '/api/auth/logout/'], refresh ? { refresh } : {});
  } catch {
  } finally {
    await clearSession();
  }
}
