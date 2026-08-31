import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { getMe, login as loginRequest, logout as logoutRequest, LoginCredentials } from '../api/auth';
import {
  ACCESS_TOKEN_KEY,
  CACHED_PROFILE_KEY,
  setUnauthorizedHandler,
  toApiError,
} from '../api/client';
import { AppUser } from '../types';
import { ensurePushNotificationsRegistered } from '../notifications/pushNotifications';
import { getJSON, getToken, saveJSON } from '../utils/storage';

export type AuthStatus = 'loading' | 'authenticated' | 'guest';

type AuthContextValue = {
  user: AppUser | null;
  status: AuthStatus;
  error: string | null;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<AppUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<AppUser | null>;
  setUser: React.Dispatch<React.SetStateAction<AppUser | null>>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [error, setError] = useState<string | null>(null);

  const setGuest = useCallback(() => {
    setUser(null);
    setStatus('guest');
  }, []);

  const refreshUser = useCallback(async () => {
    const accessToken = await getToken(ACCESS_TOKEN_KEY);

    if (!accessToken) {
      setGuest();
      return null;
    }

    try {
      const profile = await getMe();
      setUser(profile);
      setStatus('authenticated');
      setError(null);
      void ensurePushNotificationsRegistered(profile.id, { requestPermission: false });
      return profile;
    } catch (requestError) {
      const cachedProfile = await getJSON<AppUser | null>(CACHED_PROFILE_KEY, null);

      if (cachedProfile) {
        setUser(cachedProfile);
        setStatus('authenticated');
        setError(toApiError(requestError).message);
        return cachedProfile;
      }

      setGuest();
      setError(toApiError(requestError).message);
      return null;
    }
  }, [setGuest]);

  const bootstrap = useCallback(async () => {
    setStatus('loading');

    const cachedProfile = await getJSON<AppUser | null>(CACHED_PROFILE_KEY, null);

    if (cachedProfile) {
      setUser(cachedProfile);
    }

    await refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setGuest();
    });

    void bootstrap();

    return () => {
      setUnauthorizedHandler(null);
    };
  }, [bootstrap, setGuest]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setError(null);

    try {
      const response = await loginRequest(credentials);
      const profile = response.user;

      if (!profile) {
        throw new Error('Сервер не вернул профиль пользователя.');
      }

      await saveJSON(CACHED_PROFILE_KEY, profile);
      setUser(profile);
      setStatus('authenticated');
      void ensurePushNotificationsRegistered(profile.id, { requestPermission: true });

      return profile;
    } catch (requestError) {
      const message = toApiError(requestError).message;
      await logoutRequest();
      setGuest();
      setError(message);
      throw requestError;
    }
  }, [setGuest]);

  const logout = useCallback(async () => {
    setError(null);
    await logoutRequest();
    setGuest();
  }, [setGuest]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      error,
      isAuthenticated: status === 'authenticated' && Boolean(user),
      login,
      logout,
      refreshUser,
      setUser,
    }),
    [error, login, logout, refreshUser, status, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
