import { useCallback, useEffect, useState } from 'react';
import apiClient from '../src/api/apiClient';
import { getToken, saveToken } from '../src/utils/storage';

export interface CurrentUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  full_name?: string;
  role?: 'admin' | 'manager';
  is_superuser: boolean;
  is_staff: boolean;
  avatar: string | null;
  work_status: string;
  is_effective: boolean;
  office: { id: number; city: string; address: string } | null;
  managersalary: {
    monthly_plan: number;
    current_month_revenue: number;
    current_balance: number;
    fixed_salary: number;
    motivation_target: number;
    motivation_reward: number;
  } | null;
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const cached = await getToken('cache_my_profile');
      if (cached) {
        setUser(JSON.parse(cached));
      }

      const response = await apiClient.get('users/users/me/');
      setUser(response.data);
      await saveToken('cache_my_profile', JSON.stringify(response.data));
    } catch {
      // оффлайн — остаёмся на кэше
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { user, loading, reload };
}