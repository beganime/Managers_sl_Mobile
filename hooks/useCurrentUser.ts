import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import apiClient from '../src/api/apiClient';
import { clearSession, getToken, saveToken } from '../src/utils/storage';

export interface CurrentUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  middle_name?: string | null;
  full_name?: string | null;
  role?: 'admin' | 'manager' | string;
  is_superuser: boolean;
  is_staff: boolean;
  avatar?: string | null;
  avatar_url?: string | null;
  work_status?: string | null;
  is_effective?: boolean;
  dob?: string | null;
  social_contacts?: string | null;
  job_description?: string | null;
  office?: {
    id: number;
    city?: string | null;
    address?: string | null;
    phone?: string | null;
  } | null;
  managersalary?: {
    monthly_plan?: number | null;
    current_month_revenue?: number | null;
    current_balance?: number | null;
    fixed_salary?: number | null;
    motivation_target?: number | null;
    motivation_reward?: number | null;
  } | null;
  access_profile?: {
    id?: number;
    can_view_office_dashboard?: boolean;
    can_be_in_leaderboard?: boolean;
    managed_office?: {
      id: number;
      city?: string | null;
      address?: string | null;
    } | null;
  } | null;
}

type ReloadOptions = {
  preferCache?: boolean;
  silent?: boolean;
};

type CurrentUserContextValue = {
  user: CurrentUser | null;
  loading: boolean;
  hydrated: boolean;
  reload: (options?: ReloadOptions) => Promise<CurrentUser | null>;
  setUser: React.Dispatch<React.SetStateAction<CurrentUser | null>>;
  clearUser: () => Promise<void>;
};

const CurrentUserContext = createContext<CurrentUserContextValue | undefined>(undefined);

function parseCachedProfile(raw: string | null): CurrentUser | null {
  if (!raw) return null;

  try {
    return JSON.parse(raw) as CurrentUser;
  } catch {
    return null;
  }
}

export function CurrentUserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  const didBootstrapRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const clearUser = useCallback(async () => {
    await clearSession();
    if (mountedRef.current) {
      setUser(null);
      setHydrated(true);
      setLoading(false);
    }
  }, []);

  const reload = useCallback(
    async (options?: ReloadOptions) => {
      const preferCache = options?.preferCache ?? false;
      const silent = options?.silent ?? false;

      if (!silent && mountedRef.current) {
        setLoading(true);
      }

      let resolvedUser: CurrentUser | null = null;

      try {
        const accessToken = await getToken('access_token');
        const cachedProfileRaw = await getToken('cache_my_profile');
        const cachedProfile = parseCachedProfile(cachedProfileRaw);

        if (preferCache && cachedProfile && mountedRef.current) {
          setUser(cachedProfile);
          resolvedUser = cachedProfile;
        }

        if (!accessToken) {
          if (cachedProfileRaw) {
            await clearSession();
          }

          if (mountedRef.current) {
            setUser(null);
          }

          return null;
        }

        const response = await apiClient.get('users/users/me/');
        const remoteUser = response.data as CurrentUser;

        await saveToken('cache_my_profile', JSON.stringify(remoteUser));

        if (mountedRef.current) {
          setUser(remoteUser);
        }

        resolvedUser = remoteUser;
        return remoteUser;
      } catch (error: any) {
        if (error?.response?.status === 401) {
          await clearSession();

          if (mountedRef.current) {
            setUser(null);
          }

          return null;
        }

        const cachedProfileRaw = await getToken('cache_my_profile');
        const cachedProfile = parseCachedProfile(cachedProfileRaw);

        if (mountedRef.current) {
          setUser(cachedProfile);
        }

        resolvedUser = cachedProfile;
        return cachedProfile;
      } finally {
        if (mountedRef.current) {
          setHydrated(true);
          setLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    if (didBootstrapRef.current) return;
    didBootstrapRef.current = true;

    void reload({ preferCache: true });
  }, [reload]);

  const value = useMemo<CurrentUserContextValue>(
    () => ({
      user,
      loading,
      hydrated,
      reload,
      setUser,
      clearUser,
    }),
    [user, loading, hydrated, reload, clearUser]
  );

  return React.createElement(CurrentUserContext.Provider, { value }, children);
}

export function useCurrentUser() {
  const context = useContext(CurrentUserContext);

  if (!context) {
    throw new Error('useCurrentUser must be used inside CurrentUserProvider');
  }

  return context;
}