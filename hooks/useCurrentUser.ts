import { useCallback, useEffect, useState } from 'react';
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
  work_status?: string | null;
  is_effective?: boolean;
  dob?: string | null;
  social_contacts?: string | null;
  job_description?: string | null;
  office?: {
    id: number;
    city?: string | null;
    address?: string | null;
  } | null;
  managersalary?: {
    monthly_plan?: number | null;
    current_month_revenue?: number | null;
    current_balance?: number | null;
    fixed_salary?: number | null;
    motivation_target?: number | null;
    motivation_reward?: number | null;
  } | null;
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);

    try {
      const accessToken = await getToken('access_token');
      const cachedProfile = await getToken('cache_my_profile');

      if (!accessToken) {
        setUser(null);

        if (cachedProfile) {
          await clearSession();
        }

        return;
      }

      if (cachedProfile) {
        try {
          setUser(JSON.parse(cachedProfile));
        } catch {
          setUser(null);
        }
      }

      const response = await apiClient.get('users/users/me/');
      setUser(response.data);
      await saveToken('cache_my_profile', JSON.stringify(response.data));
    } catch (error: any) {
      if (error?.response?.status === 401) {
        await clearSession();
        setUser(null);
      } else {
        const cachedProfile = await getToken('cache_my_profile');

        if (cachedProfile) {
          try {
            setUser(JSON.parse(cachedProfile));
          } catch {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return {
    user,
    loading,
    reload,
  };
}