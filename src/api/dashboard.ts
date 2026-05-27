import { DashboardSummary } from '../types';
import { extractCount, toApiError } from './client';
import { getTodayWorkday } from './attendance';
import { listClients, listLeads } from './crm';
import { listDeals } from './finance';
import { listNotifications } from './notifications';
import { listProjectTasks } from './projects';

type DashboardPart<T> = {
  key: keyof DashboardSummary['stats'] | 'workday';
  load: () => Promise<T>;
};

const dashboardParts: DashboardPart<unknown>[] = [
  { key: 'workday', load: getTodayWorkday },
  { key: 'leads', load: () => listLeads({ limit: 1 }) },
  { key: 'clients', load: () => listClients({ limit: 1 }) },
  { key: 'tasks', load: () => listProjectTasks({ limit: 1 }) },
  { key: 'deals', load: () => listDeals({ limit: 1 }) },
  { key: 'notifications', load: () => listNotifications({ limit: 1 }) },
];

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const settled = await Promise.allSettled(dashboardParts.map((part) => part.load()));
  const warnings: string[] = [];
  const summary: DashboardSummary = {
    workday: null,
    stats: {
      leads: 0,
      clients: 0,
      tasks: 0,
      deals: 0,
      notifications: 0,
    },
    warnings,
  };

  settled.forEach((result, index) => {
    const key = dashboardParts[index].key;

    if (result.status === 'rejected') {
      warnings.push(toApiError(result.reason).message);
      return;
    }

    if (key === 'workday') {
      summary.workday = (result.value as DashboardSummary['workday']) || null;
      return;
    }

    summary.stats[key] = extractCount(result.value);
  });

  if (warnings.length === dashboardParts.length) {
    throw toApiError(new Error(warnings[0]));
  }

  return summary;
}
