import { APP_CONFIG, STORAGE_KEYS } from '../config/app';
import { clearSession, saveJSON, saveToken } from '../utils/storage';
import apiClient, { extractList, fetchAllPages } from './apiClient';

export type AppUser = {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  role?: 'admin' | 'manager' | string;
  is_superuser?: boolean;
  is_staff?: boolean;
  work_status?: string;
  is_effective?: boolean;
  office?: { id: number; city?: string; address?: string } | null;
  managersalary?: {
    monthly_plan?: number;
    current_month_revenue?: number;
    current_balance?: number;
    fixed_salary?: number;
    motivation_target?: number;
    motivation_reward?: number;
  } | null;
};

export async function login(email: string, password: string) {
  const candidates = [
    { url: 'auth/login/' },
    { url: 'token/' },
  ];

  let lastError: any = null;

  for (const candidate of candidates) {
    try {
      const response = await apiClient.post(candidate.url, { email, password });
      const data = response.data;

      if (data?.access) await saveToken(STORAGE_KEYS.accessToken, data.access);
      if (data?.refresh) await saveToken(STORAGE_KEYS.refreshToken, data.refresh);
      if (data?.user) await saveJSON(STORAGE_KEYS.cachedProfile, data.user);

      return data;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

export async function logout() {
  try {
    await apiClient.post('auth/logout/', {});
  } catch {}
  await clearSession();
}

export async function getCurrentUser(): Promise<AppUser> {
  const response = await apiClient.get('users/users/me/');
  const user = response.data;
  await saveJSON(STORAGE_KEYS.cachedProfile, user);
  return user;
}

export async function getAppConfig() {
  try {
    const response = await apiClient.get('app/config/');
    return response.data;
  } catch {
    return {
      appName: APP_CONFIG.appName,
      companyName: APP_CONFIG.companyName,
    };
  }
}

export async function getDashboard() {
  try {
    const response = await apiClient.get('app/dashboard/');
    await saveJSON(STORAGE_KEYS.cachedDashboard, response.data);
    return response.data;
  } catch {
    const [clients, deals, tasks] = await Promise.all([
      fetchAllPages('clients/').catch(() => []),
      fetchAllPages('analytics/deals/').catch(() => []),
      fetchAllPages('tasks/').catch(() => []),
    ]);

    const fallback = {
      role: 'manager',
      metrics: {
        clients_total: clients.length,
        active_deals: deals.length,
        open_tasks: tasks.length,
      },
      recent: {
        clients: clients.slice(0, 5),
        deals: deals.slice(0, 5),
        tasks: tasks.slice(0, 5),
      },
    };

    await saveJSON(STORAGE_KEYS.cachedDashboard, fallback);
    return fallback;
  }
}

export async function getClients(params?: { search?: string; limit?: number; offset?: number }) {
  const response = await apiClient.get('clients/', { params });
  const items = extractList(response.data);
  return { items, raw: response.data };
}

export async function getUniversities(params?: { search?: string; limit?: number; offset?: number }) {
  const response = await apiClient.get('catalog/universities/', { params });
  const items = extractList(response.data);
  return { items, raw: response.data };
}

export async function getTasks() {
  const response = await apiClient.get('tasks/');
  return extractList(response.data);
}

export async function createTask(payload: any) {
  const response = await apiClient.post('tasks/', payload);
  return response.data;
}

export async function updateTask(id: number, payload: any) {
  const response = await apiClient.patch(`tasks/${id}/`, payload);
  return response.data;
}

export async function deleteTask(id: number) {
  await apiClient.delete(`tasks/${id}/`);
}

export async function getCurrentShift() {
  const candidates = ['timetracking/shifts/current/', 'timetracking/shifts/current'];

  for (const candidate of candidates) {
    try {
      const response = await apiClient.get(candidate);
      return response.data;
    } catch {}
  }

  return null;
}

export async function startDay() {
  try {
    const response = await apiClient.post('timetracking/shifts/start_day/', {});
    return response.data;
  } catch {
    const response = await apiClient.post('timetracking/shifts/', {});
    return response.data;
  }
}

export async function endDay() {
  try {
    const response = await apiClient.post('timetracking/shifts/end_day/', {});
    return response.data;
  } catch {
    const response = await apiClient.patch('timetracking/shifts/current/', {});
    return response.data;
  }
}

export async function getTodayReport() {
  const response = await apiClient.get('reports/daily/today/');
  return response.data;
}

export async function submitTodayReport(payload: any) {
  try {
    const response = await apiClient.post('reports/daily/submit_today/', payload);
    return response.data;
  } catch {
    const response = await apiClient.post('reports/daily/', payload);
    return response.data;
  }
}