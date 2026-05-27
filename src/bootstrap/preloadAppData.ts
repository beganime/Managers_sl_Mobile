import { getMe } from '../api/auth';
import { extractItems } from '../api/client';
import { listClients } from '../api/crm';
import { listUniversities } from '../api/education';
import { listProjectTasks } from '../api/projects';
import { saveJSON } from '../utils/storage';

async function saveJson(key: string, value: unknown) {
  try {
    await saveJSON(key, value);
  } catch {
  }
}

export async function preloadAppData() {
  try {
    const me = await getMe();
    await saveJson('cache_my_profile', me);
  } catch {
  }

  const [clients, tasks, universities] = await Promise.allSettled([
    listClients({ limit: 100 }),
    listProjectTasks({ limit: 100 }),
    listUniversities({ limit: 100 }),
  ]);

  if (clients.status === 'fulfilled') {
    await saveJson('cache_clients', extractItems(clients.value));
  }

  if (tasks.status === 'fulfilled') {
    await saveJson('cache_tasks', extractItems(tasks.value));
  }

  if (universities.status === 'fulfilled') {
    const items = extractItems(universities.value);
    await saveJson('cache_universities', items);
    await saveJson('cache_universities_full', items);
  }
}
